const { collections } = require('../config/db');
const C = require('../config/constants');
const { hoursUntil } = require('../utils/helpers');
const { releaseLocks } = require('./slot.service');
const { releaseVoucher } = require('./reward.service');

const S = C.BOOKING_STATUS;
const P = C.PAYMENT_STATUS;

// Dùng chung cho: khách hủy, admin hủy, tự hủy khi quá hạn cọc
async function cancelBooking(booking, { reason, byAdmin = false } = {}) {
  const hoursLeft = hoursUntil(booking.shootAt);
  let paymentStatus = booking.paymentStatus;
  let message = "Đã hủy đơn đặt lịch.";

  if (booking.paymentStatus === P.DEPOSIT_PAID || booking.paymentStatus === P.FULLY_PAID) {
    if (byAdmin || hoursLeft >= C.REFUND_MIN_HOURS) {
      paymentStatus = P.REFUNDED;
      message = byAdmin ? "Studio hủy lịch, khách được hoàn 100% tiền đã thanh toán." : `Hủy trước ${C.REFUND_MIN_HOURS}h, được hoàn 100% cọc.`;
    } else {
      paymentStatus = P.LOST_DEPOSIT;
      message = `Hủy dưới ${C.REFUND_MIN_HOURS}h, mất cọc theo quy định.`;
    }
  }

  await collections.bookingCollection.updateOne(
    { _id: booking._id },
    {
      $set: {
        bookingStatus: S.CANCELLED,
        paymentStatus,
        cancelReason: reason || "Khách yêu cầu hủy",
        cancelledBy: byAdmin ? "admin" : "customer",
        cancelledAt: new Date(),
        updatedAt: new Date()
      }
    }
  );
  await releaseLocks(booking._id);
  if (paymentStatus !== P.LOST_DEPOSIT) await releaseVoucher(booking);

  return message;
}

// Đơn chưa cọc quá hạn -> tự hủy để nhả slot cho khách khác
async function expireUnpaidBookings() {
  const expired = await collections.bookingCollection.find({
    bookingStatus: S.PENDING,
    paymentStatus: P.UNPAID,
    depositDeadline: { $lt: new Date() }
  }).toArray();

  for (const booking of expired) {
    const pendingPayment = await collections.paymentCollection.findOne({ bookingId: booking._id, status: "Pending" });
    if (pendingPayment) continue; // Khách đã báo chuyển khoản, chờ admin xác nhận
    await cancelBooking(booking, { reason: "Quá hạn thanh toán cọc" });
  }
  return expired.length;
}

module.exports = { cancelBooking, expireUnpaidBookings };
