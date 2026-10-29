const crypto = require('crypto');
const { collections } = require('../config/db');
const C = require('../config/constants');
const { httpError, toObjectId, requireFields, normalizePhone, parsePaging } = require('../utils/helpers');
const { isAdmin } = require('../middlewares/auth');
const { applySuccessfulPayment, buildPaymentInfo } = require('../services/payment.service');
const vnpay = require('../services/vnpay.service');

const S = C.BOOKING_STATUS;
const P = C.PAYMENT_STATUS;

async function findBookingForPayer(req, bookingId) {
  const booking = await collections.bookingCollection.findOne({ _id: toObjectId(bookingId, "bookingId") });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt lịch!");
  if (isAdmin(req)) return booking;
  if (req.user && booking.userId && String(booking.userId) === req.user.userId) return booking;
  const phone = req.body?.phone || req.query.phone;
  if (phone && normalizePhone(phone) === booking.customer.phone) return booking;
  throw httpError(403, "Bạn không có quyền với đơn đặt lịch này!");
}

function checkPayable(booking, type) {
  if (type === "deposit" && (booking.bookingStatus !== S.PENDING || booking.paymentStatus !== P.UNPAID)) {
    throw httpError(400, "Đơn này không ở trạng thái chờ thanh toán cọc!");
  }
  if (type === "remaining" && (booking.bookingStatus !== S.CONFIRMED || booking.paymentStatus !== P.DEPOSIT_PAID)) {
    throw httpError(400, "Đơn này chưa cọc hoặc đã thanh toán đủ!");
  }
}

function amountFor(booking, type) {
  return type === "deposit" ? booking.pricing.depositAmount : booking.pricing.remainingAmount;
}

// Link VNPay cũ khách bỏ dở (đã quá 15 phút) -> đánh dấu hết hạn để không chặn lần thanh toán mới
async function expireOldVnpayAttempts(bookingId, type) {
  await collections.paymentCollection.updateMany(
    { bookingId, type, method: "vnpay", status: "Pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "Expired", updatedAt: new Date() } }
  );
}

// Khách báo đã chuyển khoản cọc (hoặc admin ghi nhận thanh toán tại quầy)
exports.createPayment = async (req, res) => {
  requireFields(req.body, ["bookingId", "method"]);
  const { method, transactionCode, note } = req.body;
  const type = req.body.type || "deposit";
  if (!C.PAYMENT_METHODS.includes(method)) throw httpError(400, `Phương thức thanh toán chỉ nhận: ${C.PAYMENT_METHODS.join(", ")}`);
  if (!C.PAYMENT_TYPES.includes(type)) throw httpError(400, `Loại thanh toán chỉ nhận: ${C.PAYMENT_TYPES.join(", ")}`);

  const booking = await findBookingForPayer(req, req.body.bookingId);
  checkPayable(booking, type);
  // Khách bỏ VNPay giữa chừng để chuyển khoản -> hủy link VNPay đang chờ
  await collections.paymentCollection.updateMany(
    { bookingId: booking._id, type, method: "vnpay", status: "Pending" },
    { $set: { status: "Cancelled", updatedAt: new Date() } }
  );

  const pending = await collections.paymentCollection.findOne({ bookingId: booking._id, type, status: "Pending" });
  if (pending) throw httpError(409, "Đơn này đang có một giao dịch chờ studio xác nhận!");

  const payment = {
    bookingId: booking._id,
    bookingCode: booking.bookingCode,
    type,
    method,
    // Số tiền do server tính theo đơn, không lấy từ client
    amount: amountFor(booking, type),
    transactionCode: transactionCode || "",
    note: note || "",
    status: "Pending",
    createdBy: isAdmin(req) ? "admin" : "customer",
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await collections.paymentCollection.insertOne(payment);
  res.status(201).send({ message: "Đã ghi nhận thanh toán, studio sẽ xác nhận trong thời gian sớm nhất!", data: { ...payment, _id: result.insertedId } });
};

// Mã QR chuyển khoản (VietQR) cho đơn đang chờ cọc (giữ lại API GET /payments/qr/:bookingId từ nhánh main)
exports.getPaymentQR = async (req, res) => {
  const booking = await findBookingForPayer(req, req.params.bookingId);
  if (booking.bookingStatus === S.CANCELLED) throw httpError(400, "Đơn này đã bị hủy!");
  const type = booking.paymentStatus === P.DEPOSIT_PAID ? "remaining" : "deposit";
  if (booking.paymentStatus !== P.UNPAID && type === "deposit") throw httpError(400, "Đơn này đã thanh toán đủ!");
  const info = buildPaymentInfo(booking, amountFor(booking, type));
  res.send({ bookingId: booking._id, bookingCode: booking.bookingCode, type, depositAmount: booking.pricing.depositAmount, ...info, qrImageUrl: info.qrUrl });
};

// Admin: danh sách giao dịch
exports.getPayments = async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.bookingId) filter.bookingId = toObjectId(req.query.bookingId, "bookingId");
  const [data, total] = await Promise.all([
    collections.paymentCollection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    collections.paymentCollection.countDocuments(filter)
  ]);
  res.send({ data, page, limit, total });
};

// Admin xác nhận đã nhận tiền -> cập nhật trạng thái đơn
exports.confirmPayment = async (req, res) => {
  const _id = toObjectId(req.params.id);
  const pending = await collections.paymentCollection.findOne({ _id, status: "Pending" });
  if (!pending) throw httpError(404, "Không tìm thấy giao dịch đang chờ xác nhận!");
  const current = await collections.bookingCollection.findOne({ _id: pending.bookingId });
  if (!current || current.bookingStatus === S.CANCELLED) {
    throw httpError(400, "Đơn đã bị hủy, hãy từ chối giao dịch này và hoàn tiền cho khách!");
  }

  const payment = await collections.paymentCollection.findOneAndUpdate(
    { _id, status: "Pending" },
    { $set: { status: "Success", confirmedAt: new Date(), confirmedBy: toObjectId(req.user.userId), updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!payment) throw httpError(404, "Không tìm thấy giao dịch đang chờ xác nhận!");

  const updated = await applySuccessfulPayment(payment, "admin");
  res.send({ message: "Đã xác nhận thanh toán!", payment, booking: updated });
};

exports.rejectPayment = async (req, res) => {
  const payment = await collections.paymentCollection.findOneAndUpdate(
    { _id: toObjectId(req.params.id), status: "Pending" },
    { $set: { status: "Rejected", rejectReason: req.body?.reason || "", updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!payment) throw httpError(404, "Không tìm thấy giao dịch đang chờ xác nhận!");
  res.send({ message: "Đã từ chối giao dịch!", payment });
};

// ================= VNPay =================

// Tạo link thanh toán VNPay -> frontend chuyển trang tới paymentUrl
exports.createVnpayPayment = async (req, res) => {
  if (!vnpay.isConfigured()) throw httpError(503, "Studio chưa cấu hình thanh toán VNPay!");
  requireFields(req.body, ["bookingId"]);
  const type = req.body.type || "deposit";
  if (!C.PAYMENT_TYPES.includes(type)) throw httpError(400, `Loại thanh toán chỉ nhận: ${C.PAYMENT_TYPES.join(", ")}`);

  const booking = await findBookingForPayer(req, req.body.bookingId);
  checkPayable(booking, type);
  await expireOldVnpayAttempts(booking._id, type);

  const manualPending = await collections.paymentCollection.findOne({ bookingId: booking._id, type, status: "Pending", method: { $ne: "vnpay" } });
  if (manualPending) throw httpError(409, "Đơn này đang có một giao dịch chuyển khoản chờ studio xác nhận!");
  // Khách bấm thanh toán lại -> link cũ chưa trả tiền bị thay bằng link mới
  await collections.paymentCollection.updateMany(
    { bookingId: booking._id, type, method: "vnpay", status: "Pending" },
    { $set: { status: "Cancelled", updatedAt: new Date() } }
  );

  const now = new Date();
  const amount = amountFor(booking, type);
  const txnRef = booking.bookingCode + crypto.randomBytes(2).toString("hex").toUpperCase();
  const orderInfo = `Thanh toan ${type === "deposit" ? "coc" : "con lai"} don ${booking.bookingCode}`;

  const payment = {
    bookingId: booking._id,
    bookingCode: booking.bookingCode,
    type,
    method: "vnpay",
    amount,
    txnRef,
    status: "Pending",
    createdBy: isAdmin(req) ? "admin" : "customer",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + C.VNPAY_EXPIRE_MINUTES * 60 * 1000)
  };
  await collections.paymentCollection.insertOne(payment);

  const paymentUrl = vnpay.buildPaymentUrl({
    txnRef,
    amount,
    orderInfo,
    ipAddr: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    bankCode: req.body.bankCode,
    locale: req.body.locale,
    createdAt: now
  });
  res.status(201).send({ message: "Đã tạo link thanh toán VNPay!", paymentUrl, txnRef, amount, expiresAt: payment.expiresAt });
};

// Xử lý kết quả VNPay gửi về. Dùng chung cho IPN và Return URL, gọi nhiều lần cũng chỉ ghi nhận 1 lần.
async function processVnpayResult(query) {
  if (!vnpay.verifyReturn(query)) return { RspCode: "97", Message: "Invalid signature" };

  const payment = await collections.paymentCollection.findOne({ txnRef: String(query.vnp_TxnRef || ""), method: "vnpay" });
  if (!payment) return { RspCode: "01", Message: "Order not found" };
  if (Number(query.vnp_Amount) / 100 !== payment.amount) return { RspCode: "04", Message: "Invalid amount", payment };
  if (payment.status !== "Pending") return { RspCode: "02", Message: "Order already confirmed", payment };

  const success = query.vnp_ResponseCode === "00" && query.vnp_TransactionStatus === "00";
  const set = {
    status: success ? "Success" : "Failed",
    transactionCode: query.vnp_TransactionNo || "",
    bankCode: query.vnp_BankCode || "",
    vnpResponseCode: query.vnp_ResponseCode,
    vnpPayDate: query.vnp_PayDate || "",
    updatedAt: new Date()
  };
  if (success) Object.assign(set, { confirmedAt: new Date(), confirmedBy: "vnpay" });
  else set.failReason = vnpay.responseMessage(query.vnp_ResponseCode);

  const updated = await collections.paymentCollection.findOneAndUpdate(
    { _id: payment._id, status: "Pending" },
    { $set: set },
    { returnDocument: "after" }
  );
  if (!updated) return { RspCode: "02", Message: "Order already confirmed", payment };
  if (success) await applySuccessfulPayment(updated, "vnpay");
  return { RspCode: "00", Message: "Confirm Success", payment: updated };
}

// IPN: máy chủ VNPay gọi thẳng vào server để báo kết quả (cần server có địa chỉ public)
exports.vnpayIpn = async (req, res) => {
  const { RspCode, Message } = await processVnpayResult(req.query);
  res.status(200).json({ RspCode, Message });
};

// Return URL: VNPay chuyển khách về trang frontend kèm tham số, frontend gửi nguyên query string lên đây để lấy kết quả
exports.vnpayReturn = async (req, res) => {
  const result = await processVnpayResult(req.query);
  if (result.RspCode === "97") throw httpError(400, "Chữ ký không hợp lệ, kết quả thanh toán không đáng tin cậy!");
  if (result.RspCode === "01") throw httpError(404, "Không tìm thấy giao dịch!");
  if (result.RspCode === "04") throw httpError(400, "Số tiền thanh toán không khớp!");

  const payment = await collections.paymentCollection.findOne({ _id: result.payment._id });
  const booking = await collections.bookingCollection.findOne(
    { _id: payment.bookingId },
    { projection: { bookingCode: 1, bookingStatus: 1, paymentStatus: 1, bookingDate: 1, timeSlot: 1, paidAmount: 1 } }
  );
  const success = payment.status === "Success";
  res.send({
    success,
    message: success ? "Thanh toán thành công!" : (payment.failReason || vnpay.responseMessage(req.query.vnp_ResponseCode)),
    amount: payment.amount,
    type: payment.type,
    transactionCode: payment.transactionCode || null,
    bankCode: payment.bankCode || null,
    booking
  });
};
