const crypto = require('crypto');
const { collections } = require('../config/db');
const { DRAFT_COOKIE, DRAFT_DAYS } = require('../config/constants');
const { toObjectId } = require('../utils/helpers');
const { cookieOptions } = require('../middlewares/auth');

function draftExpiry() {
  return new Date(Date.now() + DRAFT_DAYS * 24 * 3600 * 1000);
}

function setDraftCookie(res, draftKey) {
  res.cookie(DRAFT_COOKIE, draftKey, { ...cookieOptions(), maxAge: DRAFT_DAYS * 24 * 3600 * 1000 });
}

function clearDraftCookie(res) {
  res.clearCookie(DRAFT_COOKIE, cookieOptions());
}

// Đã đăng nhập -> bản nháp theo tài khoản; khách vãng lai -> bản nháp theo cookie
function draftFilter(req) {
  if (req.user) return { userId: toObjectId(req.user.userId) };
  const draftKey = req.cookies?.[DRAFT_COOKIE];
  return draftKey ? { draftKey, userId: null } : null;
}

async function findDraft(req) {
  const filter = draftFilter(req);
  if (!filter) return null;
  return collections.draftCollection.findOne({ ...filter, expiresAt: { $gt: new Date() } });
}

async function saveDraft(req, res, data, step) {
  const set = { updatedAt: new Date(), expiresAt: draftExpiry() };
  for (const [key, value] of Object.entries(data)) set[`data.${key}`] = value;
  if (step !== undefined) set.step = step;

  let filter = draftFilter(req);
  if (!filter) {
    // Khách vãng lai lần đầu lưu -> tạo mã bản nháp và gửi về bằng cookie
    const draftKey = crypto.randomBytes(16).toString("hex");
    filter = { draftKey, userId: null };
    setDraftCookie(res, draftKey);
  } else if (filter.draftKey) {
    setDraftCookie(res, filter.draftKey); // gia hạn cookie
  }

  return collections.draftCollection.findOneAndUpdate(
    filter,
    { $set: set, $setOnInsert: { ...filter, createdAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
}

// Sau khi đăng nhập/đăng ký: chuyển bản nháp của khách vãng lai sang tài khoản
async function claimGuestDraft(req, res, userId) {
  const draftKey = req.cookies?.[DRAFT_COOKIE];
  if (!draftKey) return false;
  clearDraftCookie(res);

  const guestDraft = await collections.draftCollection.findOne({ draftKey, userId: null, expiresAt: { $gt: new Date() } });
  if (!guestDraft) return false;

  // Bản nháp vừa làm (lúc chưa đăng nhập) mới nhất -> thay bản nháp cũ của tài khoản
  await collections.draftCollection.deleteMany({ userId });
  await collections.draftCollection.updateOne(
    { _id: guestDraft._id },
    { $set: { userId, updatedAt: new Date(), expiresAt: draftExpiry() }, $unset: { draftKey: "" } }
  );

  // Gắn slot đang giữ vào tài khoản luôn
  if (guestDraft.data?.holdId) {
    await collections.holdSlotCollection.updateOne({ _id: toObjectId(guestDraft.data.holdId) }, { $set: { userId } }).catch(() => {});
  }
  return true;
}

async function deleteDraft(req, res) {
  const filter = draftFilter(req);
  if (filter) await collections.draftCollection.deleteMany(filter);
  if (req.cookies?.[DRAFT_COOKIE]) clearDraftCookie(res);
}

module.exports = { findDraft, saveDraft, claimGuestDraft, deleteDraft };
