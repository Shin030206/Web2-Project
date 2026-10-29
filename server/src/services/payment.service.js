const { collections } = require('../config/db');
const C = require('../config/constants');
const vnpay = require('./vnpay.service');

const S = C.BOOKING_STATUS;
const P = C.PAYMENT_STATUS;

// Tiền đã về (admin xác nhận tay hoặc VNPay báo thành công) -> cập nhật trạng thái đơn
async function applySuccessfulPayment(payment, confirmedBy) {
  const booking = await collections.bookingCollection.findOne({ _id: payment.bookingId });
  if (!booking) return null;

  // Khách trả qua VNPay nhưng đơn đã bị hủy trước đó -> giữ đơn hủy, đánh dấu cần hoàn tiền
  if (booking.bookingStatus === S.CANCELLED) {
    await collections.paymentCollection.updateOne(
      { _id: payment._id },
      { $set: { needsRefund: true, note: "Đơn đã hủy trước khi nhận tiền, cần hoàn tiền cho khách" } }
    );
    return booking;
  }

  const set = { updatedAt: new Date(), paidAmount: (booking.paidAmount || 0) + payment.amount };
  const update = { $set: set };
  if (payment.type === "deposit") {
    set.paymentStatus = P.DEPOSIT_PAID;
    if (booking.bookingStatus === S.PENDING) {
      set.bookingStatus = S.CONFIRMED;
      update.$push = { statusHistory: { status: S.CONFIRMED, at: new Date(), by: confirmedBy, note: "Đã nhận cọc" } };
    }
  } else {
    set.paymentStatus = P.FULLY_PAID;
  }
  return collections.bookingCollection.findOneAndUpdate({ _id: booking._id }, update, { returnDocument: "after" });
}

// Thông tin chuyển khoản để frontend hiển thị mã QR (VietQR) cho khách quét
function buildPaymentInfo(booking, amount = booking.pricing.depositAmount) {
  const bankId = process.env.BANK_ID;
  const account = process.env.BANK_ACCOUNT;
  const accountName = process.env.BANK_ACCOUNT_NAME || "";
  const transferContent = `${booking.bookingCode} ${booking.customer.phone}`;

  return {
    amount,
    transferContent,
    bankId: bankId || null,
    bankAccount: account || null,
    bankAccountName: accountName || null,
    qrUrl: bankId && account
      ? `https://img.vietqr.io/image/${bankId}-${account}-compact2.png?amount=${amount}` +
        `&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`
      : null,
    deadline: booking.depositDeadline || null,
    vnpayAvailable: vnpay.isConfigured()
  };
}

module.exports = { buildPaymentInfo, applySuccessfulPayment };
