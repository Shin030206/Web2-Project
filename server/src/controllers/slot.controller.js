const { collections, ObjectId } = require('../config/db');
const C = require('../config/constants');
const { httpError, toObjectId, requireFields, isValidDate, isValidPhone, normalizePhone } = require('../utils/helpers');
const slotService = require('../services/slot.service');
const { findActivePackage } = require('../services/pricing.service');

// Danh sách giờ trống trong ngày theo thời lượng gói chụp
// GET /api/slots?date=2026-11-01&packageId=102
exports.getAvailableSlots = async (req, res) => {
  const { date, packageId } = req.query;
  let duration = C.SLOT_STEP_MINUTES;
  if (packageId) duration = (await findActivePackage(packageId)).duration_minutes;

  const slots = await slotService.getAvailability(date, duration);
  res.send({ date, durationMinutes: duration, openTime: C.OPEN_TIME, closeTime: C.CLOSE_TIME, slots });
};

// Các ô 30 phút đã bận trong ngày
exports.getOccupiedSlots = async (req, res) => {
  const { date } = req.query;
  if (!isValidDate(date)) throw httpError(400, "Vui lòng cung cấp tham số date (YYYY-MM-DD)");

  const occupied = await slotService.getOccupiedUnits(date);
  const occupiedSlots = Object.entries(occupied).sort().map(([slot, status]) => ({ slot, status }));
  res.send({ date, occupiedSlots });
};

// Giữ slot 10 phút trong lúc khách điền thông tin
exports.holdSlot = async (req, res) => {
  requireFields(req.body, ["packageId", "bookingDate", "customerPhone"]);
  const startTime = slotService.parseStartTime(req.body.startTime || req.body.timeSlot);
  if (!isValidPhone(req.body.customerPhone)) throw httpError(400, "Số điện thoại không hợp lệ!");

  const pkg = await findActivePackage(req.body.packageId);
  const slot = slotService.validateSlot(req.body.bookingDate, startTime, pkg.duration_minutes);
  const customerPhone = normalizePhone(req.body.customerPhone);

  // Mỗi số điện thoại chỉ giữ 1 slot tại 1 thời điểm
  const previous = await collections.holdSlotCollection.find({ customerPhone, expiresAt: { $gt: new Date() } }).toArray();
  for (const hold of previous) {
    await slotService.releaseLocks(hold._id);
    await collections.holdSlotCollection.deleteOne({ _id: hold._id });
  }

  const holdId = new ObjectId();
  const expiresAt = new Date(Date.now() + C.HOLD_MINUTES * 60 * 1000);
  await slotService.lockUnits(slot.bookingDate, slot.units, { ownerType: "hold", ownerId: holdId, expiresAt });

  const newHold = {
    _id: holdId,
    packageId: pkg._id,
    package_id: pkg.package_id,
    bookingDate: slot.bookingDate,
    startTime: slot.startTime,
    endTime: slot.endTime,
    timeSlot: slot.timeSlot,
    units: slot.units,
    customerPhone,
    userId: req.user ? toObjectId(req.user.userId) : null,
    createdAt: new Date(),
    expiresAt
  };
  await collections.holdSlotCollection.insertOne(newHold);

  res.status(201).send({
    message: `Giữ slot thành công ${C.HOLD_MINUTES} phút!`,
    holdId,
    holdData: newHold
  });
};

// Tra cứu slot đang giữ theo ID
exports.getHoldSlotById = async (req, res) => {
  const result = await collections.holdSlotCollection.findOne({ _id: toObjectId(req.params.id), expiresAt: { $gt: new Date() } });
  if (!result) throw httpError(404, `Không tìm thấy hoặc slot đã hết hạn ${C.HOLD_MINUTES} phút!`);
  res.send({ ...result, secondsLeft: Math.max(0, Math.floor((result.expiresAt - new Date()) / 1000)) });
};

// Khách đổi ý, trả slot lại ngay
exports.releaseHoldSlot = async (req, res) => {
  const _id = toObjectId(req.params.id);
  const hold = await collections.holdSlotCollection.findOne({ _id });
  if (!hold) throw httpError(404, "Không tìm thấy slot đang giữ!");
  const phone = req.body?.customerPhone || req.query.phone;
  if (!phone || normalizePhone(phone) !== hold.customerPhone) throw httpError(403, "Số điện thoại không khớp với slot đang giữ!");

  await slotService.releaseLocks(_id);
  await collections.holdSlotCollection.deleteOne({ _id });
  res.send({ message: "Đã hủy giữ slot." });
};
