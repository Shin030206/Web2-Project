const { collections } = require('../config/db');
const C = require('../config/constants');
const { httpError, toObjectId, requireFields, normalizePhone, parsePaging } = require('../utils/helpers');
const { isAdmin } = require('../middlewares/auth');

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

// Khách báo đã chuyển khoản cọc (hoặc admin ghi nhận thanh toán tại quầy)
exports.createPayment = async (req, res) => {
  requireFields(req.body, ["bookingId", "method"]);
  const { method, transactionCode, note } = req.body;
  const type = req.body.type || "deposit";
  if (!C.PAYMENT_METHODS.includes(method)) throw httpError(400, `Phương thức thanh toán chỉ nhận: ${C.PAYMENT_METHODS.join(", ")}`);
  if (!C.PAYMENT_TYPES.includes(type)) throw httpError(400, `Loại thanh toán chỉ nhận: ${C.PAYMENT_TYPES.join(", ")}`);

  const booking = await findBookingForPayer(req, req.body.bookingId);
  if (type === "deposit" && (booking.bookingStatus !== S.PENDING || booking.paymentStatus !== P.UNPAID)) {
    throw httpError(400, "Đơn này không ở trạng thái chờ thanh toán cọc!");
  }
  if (type === "remaining" && booking.paymentStatus !== P.DEPOSIT_PAID) {
    throw httpError(400, "Đơn này chưa cọc hoặc đã thanh toán đủ!");
  }

  const pending = await collections.paymentCollection.findOne({ bookingId: booking._id, type, status: "Pending" });
  if (pending) throw httpError(409, "Đơn này đang có một giao dịch chờ studio xác nhận!");

  const payment = {
    bookingId: booking._id,
    bookingCode: booking.bookingCode,
    type,
    method,
    // Số tiền do server tính theo đơn, không lấy từ client
    amount: type === "deposit" ? booking.pricing.depositAmount : booking.pricing.remainingAmount,
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

  const booking = await collections.bookingCollection.findOne({ _id: payment.bookingId });
  const set = { updatedAt: new Date(), paidAmount: (booking.paidAmount || 0) + payment.amount };
  const push = {};
  if (payment.type === "deposit") {
    set.paymentStatus = P.DEPOSIT_PAID;
    if (booking.bookingStatus === S.PENDING) {
      set.bookingStatus = S.CONFIRMED;
      push.statusHistory = { status: S.CONFIRMED, at: new Date(), by: "admin", note: "Đã nhận cọc" };
    }
  } else {
    set.paymentStatus = P.FULLY_PAID;
  }

  const update = { $set: set };
  if (push.statusHistory) update.$push = push;
  const updated = await collections.bookingCollection.findOneAndUpdate({ _id: booking._id }, update, { returnDocument: "after" });

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
