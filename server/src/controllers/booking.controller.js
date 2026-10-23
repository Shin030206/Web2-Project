const crypto = require('crypto');
const { collections, ObjectId } = require('../config/db');
const C = require('../config/constants');
const {
  httpError, toObjectId, requireFields, isValidEmail, isValidPhone, normalizePhone, normalizeFullName, hoursUntil, toShootDate, parsePaging
} = require('../utils/helpers');
const { isAdmin } = require('../middlewares/auth');
const slotService = require('../services/slot.service');
const { calculateQuote, publicQuote } = require('../services/pricing.service');
const { redeemVoucher, releaseVoucher, awardPoints } = require('../services/reward.service');
const { cancelBooking } = require('../services/booking.service');
const { buildPaymentInfo } = require('../services/payment.service');

const S = C.BOOKING_STATUS;
const P = C.PAYMENT_STATUS;

function generateBookingCode(bookingDate) {
  return "KU" + bookingDate.slice(2).replace(/-/g, "") + crypto.randomBytes(3).toString("hex").toUpperCase();
}

// Ai được xem/sửa đơn: admin, chủ tài khoản, hoặc khách vãng lai biết số điện thoại đặt lịch
async function loadBookingForActor(req) {
  const booking = await collections.bookingCollection.findOne({ _id: toObjectId(req.params.id, "Mã đơn") });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt lịch!");
  if (isAdmin(req)) return booking;
  if (req.user && booking.userId && String(booking.userId) === req.user.userId) return booking;

  const phone = req.body?.phone || req.query.phone;
  if (phone && normalizePhone(phone) === booking.customer.phone) return booking;
  throw httpError(403, "Bạn không có quyền với đơn đặt lịch này!");
}

function withPaymentInfo(booking) {
  if (booking.bookingStatus !== S.PENDING || booking.paymentStatus !== P.UNPAID) return booking;
  return { ...booking, paymentInfo: buildPaymentInfo(booking) };
}

// Xem trước giá (gói + dịch vụ thêm + voucher) trước khi đặt
exports.getQuote = async (req, res) => {
  const quote = await calculateQuote({ ...req.body, userId: req.user?.userId });
  res.send(publicQuote(quote));
};

// Tạo đơn đặt lịch từ slot đang giữ
exports.createBooking = async (req, res) => {
  requireFields(req.body, ["holdId", "customerName", "customerPhone"]);
  const { holdId, conceptCode, addons, voucherCode, customerName, customerEmail, note } = req.body;
  const customerPhone = normalizePhone(req.body.customerPhone);
  if (!isValidPhone(customerPhone)) throw httpError(400, "Số điện thoại không hợp lệ!");
  const name = normalizeFullName(customerName);
  if (customerEmail && !isValidEmail(customerEmail)) throw httpError(400, "Email không hợp lệ!");

  const hold = await collections.holdSlotCollection.findOne({ _id: toObjectId(holdId, "holdId"), expiresAt: { $gt: new Date() } });
  if (!hold) throw httpError(410, `Slot giữ chỗ không tồn tại hoặc đã quá ${C.HOLD_MINUTES} phút, vui lòng chọn lại giờ!`);
  if (hold.customerPhone !== customerPhone) throw httpError(403, "Số điện thoại không khớp với slot đang giữ!");

  const userId = req.user ? toObjectId(req.user.userId) : null;
  const quote = await calculateQuote({ packageId: String(hold.packageId), conceptCode, addons, voucherCode, userId: req.user?.userId });

  const bookingId = new ObjectId();
  const bookingCode = generateBookingCode(hold.bookingDate);
  await redeemVoucher(quote.voucher, userId, bookingCode);

  // Chuyển lock giữ chỗ thành lock của đơn (bỏ expiresAt để TTL không xóa)
  const converted = await collections.slotLockCollection.updateMany(
    { ownerId: hold._id, expiresAt: { $gt: new Date() } },
    { $set: { ownerType: "booking", ownerId: bookingId }, $unset: { expiresAt: "" } }
  );
  if (converted.modifiedCount !== hold.units.length) {
    await slotService.releaseLocks(bookingId);
    await releaseVoucher({ _id: bookingId, bookingCode, userId, pricing: { voucher: quote.voucher } });
    throw httpError(410, "Slot giữ chỗ vừa hết hạn, vui lòng chọn lại giờ!");
  }

  const shootAt = toShootDate(hold.bookingDate, hold.startTime);
  const depositDeadline = new Date(Math.min(Date.now() + C.DEPOSIT_DEADLINE_HOURS * 3600 * 1000, shootAt.getTime()));
  const { pkg, ...pricing } = quote;

  const newBooking = {
    _id: bookingId,
    bookingCode,
    userId,
    customer: {
      name,
      phone: customerPhone,
      email: customerEmail ? customerEmail.trim().toLowerCase() : "",
      note: note || ""
    },
    pricing,
    bookingDate: hold.bookingDate,
    startTime: hold.startTime,
    endTime: hold.endTime,
    timeSlot: hold.timeSlot,
    units: hold.units,
    shootAt,
    bookingStatus: S.PENDING,
    paymentStatus: P.UNPAID,
    paidAmount: 0,
    depositDeadline,
    rescheduleCount: 0,
    statusHistory: [{ status: S.PENDING, at: new Date(), by: userId ? "customer" : "guest" }],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await collections.bookingCollection.insertOne(newBooking);
  await collections.holdSlotCollection.deleteOne({ _id: hold._id });

  res.status(201).send({
    message: "Đặt lịch chụp thành công! Vui lòng thanh toán cọc để giữ lịch.",
    bookingId,
    bookingCode,
    data: newBooking,
    paymentInfo: buildPaymentInfo(newBooking)
  });
};

// Khách vãng lai tra cứu đơn bằng mã đơn + số điện thoại
exports.lookupBooking = async (req, res) => {
  const { code, phone } = req.query;
  if (!code || !phone) throw httpError(400, "Vui lòng nhập mã đơn và số điện thoại!");
  const booking = await collections.bookingCollection.findOne({
    bookingCode: String(code).trim().toUpperCase(),
    "customer.phone": normalizePhone(phone)
  });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt lịch!");
  res.send(withPaymentInfo(booking));
};

// Lịch sử đặt lịch của tài khoản đang đăng nhập
exports.getMyBookings = async (req, res) => {
  const filter = { userId: toObjectId(req.user.userId) };
  if (req.query.status) filter.bookingStatus = req.query.status;
  const result = await collections.bookingCollection.find(filter).sort({ shootAt: -1 }).toArray();
  res.send(result);
};

exports.getBookingById = async (req, res) => {
  const booking = await loadBookingForActor(req);
  const payments = await collections.paymentCollection.find({ bookingId: booking._id }).sort({ createdAt: -1 }).toArray();
  res.send({ ...withPaymentInfo(booking), payments });
};

// Admin: danh sách đơn có lọc + phân trang
exports.getBookings = async (req, res) => {
  const { phone, date, from, to, status, paymentStatus, code, packageId } = req.query;
  const { page, limit, skip } = parsePaging(req.query);
  const filter = {};
  if (phone) filter["customer.phone"] = normalizePhone(phone);
  if (code) filter.bookingCode = String(code).toUpperCase();
  if (date) filter.bookingDate = date;
  if (from || to) {
    filter.bookingDate = {};
    if (from) filter.bookingDate.$gte = from;
    if (to) filter.bookingDate.$lte = to;
  }
  if (status) filter.bookingStatus = { $in: String(status).split(",") };
  if (paymentStatus) filter.paymentStatus = { $in: String(paymentStatus).split(",") };
  if (packageId) filter["pricing.package.package_id"] = Number(packageId);

  const sort = req.query.sort === "newest" ? { createdAt: -1 } : { shootAt: 1 };
  const [data, total] = await Promise.all([
    collections.bookingCollection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    collections.bookingCollection.countDocuments(filter)
  ]);
  res.send({ data, page, limit, total });
};

// Đổi lịch (trước 24h, tối đa 2 lần; admin không bị giới hạn)
exports.rescheduleBooking = async (req, res) => {
  const booking = await loadBookingForActor(req);
  const admin = isAdmin(req);
  requireFields(req.body, ["bookingDate"]);
  const startTime = slotService.parseStartTime(req.body.startTime || req.body.timeSlot);

  if (![S.PENDING, S.CONFIRMED].includes(booking.bookingStatus)) throw httpError(400, "Đơn này không thể đổi lịch!");
  if (!admin && hoursUntil(booking.shootAt) < C.RESCHEDULE_MIN_HOURS) {
    throw httpError(400, `Chỉ được đổi lịch trước giờ chụp ít nhất ${C.RESCHEDULE_MIN_HOURS} tiếng!`);
  }
  if (!admin && booking.rescheduleCount >= C.MAX_RESCHEDULES) {
    throw httpError(400, `Mỗi đơn chỉ được đổi lịch tối đa ${C.MAX_RESCHEDULES} lần!`);
  }

  const slot = slotService.validateSlot(req.body.bookingDate, startTime, booking.pricing.package.duration_minutes);
  if (slot.bookingDate === booking.bookingDate && slot.startTime === booking.startTime) {
    throw httpError(400, "Giờ mới trùng với giờ hiện tại!");
  }

  // Chỉ chiếm thêm các ô mới, rồi nhả các ô cũ không còn dùng
  const sameDay = slot.bookingDate === booking.bookingDate;
  const newUnits = sameDay ? slot.units.filter(u => !booking.units.includes(u)) : slot.units;
  const oldUnits = sameDay ? booking.units.filter(u => !slot.units.includes(u)) : booking.units;
  await slotService.lockUnits(slot.bookingDate, newUnits, { ownerType: "booking", ownerId: booking._id });
  await slotService.releaseLocks(booking._id, { bookingDate: booking.bookingDate, unit: { $in: oldUnits } });

  const updated = await collections.bookingCollection.findOneAndUpdate(
    { _id: booking._id },
    {
      $set: {
        bookingDate: slot.bookingDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timeSlot: slot.timeSlot,
        units: slot.units,
        shootAt: slot.shootAt,
        updatedAt: new Date()
      },
      $inc: { rescheduleCount: 1 },
      $push: {
        rescheduleHistory: { from: `${booking.bookingDate} ${booking.timeSlot}`, to: `${slot.bookingDate} ${slot.timeSlot}`, at: new Date(), by: admin ? "admin" : "customer" }
      }
    },
    { returnDocument: "after" }
  );
  res.send({ message: "Đổi lịch chụp thành công!", data: updated });
};

// Hủy lịch (trước 48h hoàn cọc)
exports.cancelBooking = async (req, res) => {
  const booking = await loadBookingForActor(req);
  if (![S.PENDING, S.CONFIRMED].includes(booking.bookingStatus)) throw httpError(400, "Đơn này không thể hủy!");

  const message = await cancelBooking(booking, { reason: req.body?.reason, byAdmin: isAdmin(req) });
  const updated = await collections.bookingCollection.findOne({ _id: booking._id });
  res.send({ message, data: updated });
};

// Admin cập nhật trạng thái buổi chụp
const TRANSITIONS = {
  [S.PENDING]: [S.CONFIRMED],
  [S.CONFIRMED]: [S.COMPLETED, S.NO_SHOW]
};

exports.updateBookingStatus = async (req, res) => {
  requireFields(req.body, ["status"]);
  const { status, note } = req.body;
  const _id = toObjectId(req.params.id, "Mã đơn");
  const booking = await collections.bookingCollection.findOne({ _id });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt lịch!");

  if (status === S.CANCELLED) {
    if (![S.PENDING, S.CONFIRMED].includes(booking.bookingStatus)) throw httpError(400, "Đơn này không thể hủy!");
    const message = await cancelBooking(booking, { reason: note || "Studio hủy lịch", byAdmin: true });
    return res.send({ message, data: await collections.bookingCollection.findOne({ _id }) });
  }
  if (!(TRANSITIONS[booking.bookingStatus] || []).includes(status)) {
    throw httpError(400, `Không thể chuyển trạng thái từ ${booking.bookingStatus} sang ${status}!`);
  }
  if (status === S.COMPLETED && hoursUntil(booking.shootAt) > 0) {
    throw httpError(400, "Chưa tới giờ chụp, không thể đánh dấu hoàn thành!");
  }

  const set = { bookingStatus: status, updatedAt: new Date() };
  if (status === S.COMPLETED) {
    set.paymentStatus = P.FULLY_PAID;
    set.paidAmount = booking.pricing.totalAmount;
  }
  if (status === S.NO_SHOW) set.paymentStatus = P.LOST_DEPOSIT;

  await collections.bookingCollection.updateOne(
    { _id },
    { $set: set, $push: { statusHistory: { status, at: new Date(), by: "admin", note: note || "" } } }
  );
  const updated = await collections.bookingCollection.findOne({ _id });
  const pointsAwarded = status === S.COMPLETED ? await awardPoints(updated) : 0;

  res.send({ message: "Cập nhật trạng thái thành công!", pointsAwarded, data: updated });
};
