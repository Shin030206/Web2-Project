const { collections } = require('../config/db');
const C = require('../config/constants');
const { httpError } = require('../utils/helpers');

async function addPointHistory(userId, points, type, reason, bookingId) {
  await collections.pointCollection.insertOne({ userId, points, type, reason, bookingId, createdAt: new Date() });
}

// Giữ lượt dùng voucher + trừ xu khi tạo đơn
async function redeemVoucher(voucher, userId, bookingCode) {
  if (!voucher) return;

  const used = await collections.voucherCollection.updateOne(
    {
      voucher_code: voucher.voucher_code,
      $or: [{ usage_limit: { $in: [null, 0] } }, { $expr: { $lt: [{ $ifNull: ["$used_count", 0] }, "$usage_limit"] } }]
    },
    { $inc: { used_count: 1 } }
  );
  if (!used.modifiedCount) throw httpError(400, "Mã giảm giá đã hết lượt sử dụng!");

  if (voucher.required_points > 0) {
    const spent = await collections.userCollection.updateOne(
      { _id: userId, points: { $gte: voucher.required_points } },
      { $inc: { points: -voucher.required_points } }
    );
    if (!spent.modifiedCount) {
      await collections.voucherCollection.updateOne({ voucher_code: voucher.voucher_code }, { $inc: { used_count: -1 } });
      throw httpError(400, `Bạn cần ${voucher.required_points} Ký Ức Xu để dùng voucher này!`);
    }
    await addPointHistory(userId, -voucher.required_points, "redeem", `Đổi voucher ${voucher.voucher_code} cho đơn ${bookingCode}`);
  }
}

// Trả lại lượt voucher + xu khi đơn bị hủy mà khách không mất cọc
async function releaseVoucher(booking) {
  const voucher = booking.pricing?.voucher;
  if (!voucher) return;

  await collections.voucherCollection.updateOne(
    { voucher_code: voucher.voucher_code, used_count: { $gt: 0 } },
    { $inc: { used_count: -1 } }
  );
  if (voucher.required_points > 0 && booking.userId) {
    await collections.userCollection.updateOne({ _id: booking.userId }, { $inc: { points: voucher.required_points } });
    await addPointHistory(booking.userId, voucher.required_points, "refund", `Hoàn xu do hủy đơn ${booking.bookingCode}`, booking._id);
  }
}

// Hoàn thành buổi chụp -> tích Ký Ức Xu
async function awardPoints(booking) {
  if (!booking.userId || booking.pointsAwarded) return 0;
  const points = Math.floor(booking.pricing.totalAmount / C.POINT_PER_VND);
  if (points <= 0) return 0;

  await collections.userCollection.updateOne({ _id: booking.userId }, { $inc: { points } });
  await collections.bookingCollection.updateOne({ _id: booking._id }, { $set: { pointsAwarded: points } });
  await addPointHistory(booking.userId, points, "earn", `Hoàn thành buổi chụp ${booking.bookingCode}`, booking._id);
  return points;
}

module.exports = { redeemVoucher, releaseVoucher, awardPoints };
