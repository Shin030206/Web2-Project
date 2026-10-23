// Lưu tiến trình đặt lịch để khách không phải nhập lại sau khi đi đăng nhập/đăng ký
const { collections } = require('../config/db');
const { httpError, isObjectId, toObjectId } = require('../utils/helpers');
const { calculateQuote, publicQuote } = require('../services/pricing.service');
const draftService = require('../services/draft.service');

// Chỉ nhận các field của form đặt lịch
const DRAFT_FIELDS = {
  packageId: v => (typeof v === "number" || typeof v === "string" ? v : bad("packageId")),
  conceptCode: v => (typeof v === "string" ? v.slice(0, 20) : bad("conceptCode")),
  addons: v => (Array.isArray(v) && v.length <= 20 ? v : bad("addons")),
  voucherCode: v => (typeof v === "string" ? v.slice(0, 30) : bad("voucherCode")),
  bookingDate: v => (typeof v === "string" ? v.slice(0, 10) : bad("bookingDate")),
  startTime: v => (typeof v === "string" ? v.slice(0, 5) : bad("startTime")),
  holdId: v => (typeof v === "string" && isObjectId(v) ? v : bad("holdId")),
  customer: v => {
    if (!v || typeof v !== "object") bad("customer");
    const limits = { name: 50, phone: 15, email: 100, note: 500 };
    const customer = {};
    for (const [key, max] of Object.entries(limits)) {
      if (v[key] !== undefined && v[key] !== null) customer[key] = String(v[key]).slice(0, max);
    }
    return customer;
  }
};

function bad(field) {
  throw httpError(400, `Trường ${field} không hợp lệ!`);
}

// Kèm báo giá hiện tại + tình trạng slot đang giữ để frontend hiển thị lại đúng bước
async function describeDraft(draft, req) {
  if (!draft) return { draft: null };
  const data = draft.data || {};
  const result = { draft: { step: draft.step ?? null, data, updatedAt: draft.updatedAt } };

  if (data.packageId !== undefined) {
    try {
      result.quote = publicQuote(await calculateQuote({ ...data, userId: req.user?.userId }));
    } catch (err) {
      result.quoteError = err.message; // vd voucher hết hạn -> frontend báo khách chọn lại
    }
  }
  if (data.holdId) {
    const hold = await collections.holdSlotCollection.findOne({ _id: toObjectId(data.holdId) });
    const secondsLeft = hold ? Math.floor((hold.expiresAt - new Date()) / 1000) : 0;
    result.hold = secondsLeft > 0
      ? { valid: true, secondsLeft, timeSlot: hold.timeSlot, bookingDate: hold.bookingDate }
      : { valid: false, message: "Slot giữ chỗ đã hết hạn, vui lòng chọn lại giờ!" };
  }
  return result;
}

exports.getDraft = async (req, res) => {
  const draft = await draftService.findDraft(req);
  res.send(await describeDraft(draft, req));
};

// Lưu từng phần: gửi field nào thì cập nhật field đó, field khác giữ nguyên
exports.saveDraft = async (req, res) => {
  const data = {};
  for (const [field, sanitize] of Object.entries(DRAFT_FIELDS)) {
    if (req.body[field] !== undefined && req.body[field] !== null) data[field] = sanitize(req.body[field]);
  }
  const step = req.body.step === undefined ? undefined : String(req.body.step).slice(0, 30);
  if (!Object.keys(data).length && step === undefined) throw httpError(400, "Không có dữ liệu để lưu!");

  const draft = await draftService.saveDraft(req, res, data, step);
  res.send({ message: "Đã lưu tiến trình đặt lịch!", ...(await describeDraft(draft, req)) });
};

exports.deleteDraft = async (req, res) => {
  await draftService.deleteDraft(req, res);
  res.send({ message: "Đã xóa bản nháp đặt lịch!" });
};
