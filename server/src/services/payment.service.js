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
    deadline: booking.depositDeadline || null
  };
}

module.exports = { buildPaymentInfo };
