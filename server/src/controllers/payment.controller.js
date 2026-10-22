const { collections, ObjectId } = require('../config/db');

const STUDIO_BANK = {
  BANK_ID: "MB",
  ACCOUNT_NO: "1234567890",
  ACCOUNT_NAME: "KY UC STUDIO"
};

// Sinh mã QR VietQR
exports.getPaymentQR = async (req, res) => {
  try {
    const o_id = new ObjectId(req.params["bookingId"]);
    const booking = await collections.bookingCollection.findOne({ _id: o_id });

    if (!booking) return res.status(404).send({ error: "Không tìm thấy đơn đặt!" });
    if (booking.bookingStatus === "Cancelled") return res.status(400).send({ error: "Đơn này đã bị hủy!" });

    const amount = booking.packageSnapshot.depositAmount;
    const transferContent = `KYS_${booking._id.toString().slice(-6).toUpperCase()}`;
    const qrImageUrl = `https://img.vietqr.io/image/${STUDIO_BANK.BANK_ID}-${STUDIO_BANK.ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(STUDIO_BANK.ACCOUNT_NAME)}`;

    res.send({
      bookingId: booking._id,
      depositAmount: amount,
      transferContent,
      qrImageUrl
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Xác nhận thanh toán & Ghi log
exports.confirmPayment = async (req, res) => {
  try {
    const { bookingId, transactionCode, amountPaid, paymentMethod } = req.body;
    if (!bookingId || !amountPaid) return res.status(400).send({ error: "Thiếu dữ liệu bắt buộc!" });

    const o_id = new ObjectId(bookingId);
    const booking = await collections.bookingCollection.findOne({ _id: o_id });
    if (!booking) return res.status(404).send({ error: "Không tìm thấy đơn đặt!" });

    const paymentRecord = {
      bookingId: o_id,
      transactionCode: transactionCode || `TXN_${Date.now()}`,
      amount: Number(amountPaid),
      paymentMethod: paymentMethod || "VietQR_Transfer",
      status: "SUCCESS",
      paidAt: new Date()
    };
    await collections.paymentCollection.insertOne(paymentRecord);

    const isFull = Number(amountPaid) >= booking.packageSnapshot.price;
    const newPaymentStatus = isFull ? "Fully_Paid" : "Deposit_Paid";

    await collections.bookingCollection.updateOne(
      { _id: o_id },
      { $set: { paymentStatus: newPaymentStatus, updatedAt: new Date() } }
    );

    res.send({ message: "Xác nhận thanh toán thành công!", paymentStatus: newPaymentStatus, paymentRecord });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Xem lịch sử thanh toán
exports.getPaymentHistory = async (req, res) => {
  try {
    const { bookingId } = req.query;
    let query = bookingId ? { bookingId: new ObjectId(bookingId) } : {};
    const result = await collections.paymentCollection.find(query).sort({ paidAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};