const { collections, ObjectId } = require('../config/db');
const C = require('../config/constants');
const {
  httpError, isValidDate, timeToMinutes, minutesToTime, toShootDate, hoursUntil
} = require('../utils/helpers');

const OPEN = timeToMinutes(C.OPEN_TIME);
const CLOSE = timeToMinutes(C.CLOSE_TIME);
const STEP = C.SLOT_STEP_MINUTES;

// Một buổi chụp chiếm nhiều ô 30 phút, vd 10:30 + 90 phút -> ["10:30", "11:00", "11:30"]
function buildUnits(startMin, durationMinutes) {
  const units = [];
  for (let m = startMin; m < startMin + durationMinutes; m += STEP) units.push(minutesToTime(m));
  return units;
}

// Nhận "10:30" hoặc "10:30 - 12:00" (định dạng cũ của frontend)
function parseStartTime(value) {
  return String(value || "").split("-")[0].trim();
}

function validateSlot(bookingDate, startTime, durationMinutes) {
  if (!isValidDate(bookingDate)) throw httpError(400, "Ngày chụp không hợp lệ (định dạng YYYY-MM-DD)!");
  const startMin = timeToMinutes(startTime);
  if (isNaN(startMin)) throw httpError(400, "Giờ bắt đầu không hợp lệ (định dạng HH:mm)!");
  if ((startMin - OPEN) % STEP !== 0) throw httpError(400, `Giờ bắt đầu phải theo bước ${STEP} phút!`);

  const duration = Math.ceil(durationMinutes / STEP) * STEP;
  const endMin = startMin + duration;
  if (startMin < OPEN || endMin > CLOSE) {
    throw httpError(400, `Studio chỉ nhận lịch từ ${C.OPEN_TIME} đến ${C.CLOSE_TIME}!`);
  }

  const shootAt = toShootDate(bookingDate, startTime);
  if (hoursUntil(shootAt) < C.MIN_LEAD_HOURS) {
    throw httpError(400, `Vui lòng đặt lịch trước giờ chụp ít nhất ${C.MIN_LEAD_HOURS} tiếng!`);
  }
  if (hoursUntil(shootAt) > C.MAX_DAYS_AHEAD * 24) {
    throw httpError(400, `Chỉ nhận đặt lịch trong vòng ${C.MAX_DAYS_AHEAD} ngày tới!`);
  }

  const endTime = minutesToTime(endMin);
  return {
    bookingDate,
    startTime,
    endTime,
    timeSlot: `${startTime} - ${endTime}`,
    shootAt,
    units: buildUnits(startMin, duration)
  };
}

// Chiếm các ô 30 phút. Unique index (bookingDate, unit) đảm bảo 2 người không thể chiếm cùng 1 ô.
async function lockUnits(bookingDate, units, { ownerType, ownerId, expiresAt }) {
  if (!units.length) return;
  const batchId = new ObjectId();
  const docs = units.map(unit => {
    const doc = { bookingDate, unit, ownerType, ownerId, batchId, createdAt: new Date() };
    if (expiresAt) doc.expiresAt = expiresAt;
    return doc;
  });

  // TTL của MongoDB chạy mỗi ~60s nên dọn trước các lock giữ chỗ đã hết hạn
  await collections.slotLockCollection.deleteMany({ bookingDate, unit: { $in: units }, expiresAt: { $lte: new Date() } });

  try {
    await collections.slotLockCollection.insertMany(docs, { ordered: false });
  } catch (err) {
    await collections.slotLockCollection.deleteMany({ batchId });
    if (err.code === 11000 || err.writeErrors) throw httpError(409, "Khung giờ này đã có người đặt hoặc đang được giữ chỗ!");
    throw err;
  }
}

async function releaseLocks(ownerId, filter = {}) {
  await collections.slotLockCollection.deleteMany({ ownerId, ...filter });
}

async function getOccupiedUnits(bookingDate) {
  const now = new Date();
  const locks = await collections.slotLockCollection.find({
    bookingDate,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }]
  }).toArray();

  const map = {};
  for (const l of locks) map[l.unit] = l.ownerType === "hold" ? "HOLDING" : "BOOKED";
  return map;
}

// Danh sách giờ bắt đầu trong ngày, kèm trạng thái còn trống với thời lượng của gói
async function getAvailability(bookingDate, durationMinutes) {
  if (!isValidDate(bookingDate)) throw httpError(400, "Vui lòng cung cấp tham số date (YYYY-MM-DD)");
  const occupied = await getOccupiedUnits(bookingDate);
  const duration = Math.ceil(durationMinutes / STEP) * STEP;
  const slots = [];

  for (let start = OPEN; start + duration <= CLOSE; start += STEP) {
    const startTime = minutesToTime(start);
    const units = buildUnits(start, duration);
    const busy = units.map(u => occupied[u]).filter(Boolean);
    const tooLate = hoursUntil(toShootDate(bookingDate, startTime)) < C.MIN_LEAD_HOURS;

    let status = "AVAILABLE";
    if (tooLate) status = "PAST";
    else if (busy.includes("BOOKED")) status = "BOOKED";
    else if (busy.length) status = "HOLDING";

    slots.push({
      startTime,
      endTime: minutesToTime(start + duration),
      timeSlot: `${startTime} - ${minutesToTime(start + duration)}`,
      available: status === "AVAILABLE",
      status
    });
  }
  return slots;
}

module.exports = {
  buildUnits,
  parseStartTime,
  validateSlot,
  lockUnits,
  releaseLocks,
  getOccupiedUnits,
  getAvailability
};
