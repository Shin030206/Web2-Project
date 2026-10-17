const { collections, ObjectId } = require('../config/db');

// Tạo đơn đặt lịch chính thức
exports.createBooking = async (req, res) => {
  try {
    const { packageId, bookingDate, timeSlot, customerName, customerPhone, customerEmail, note } = req.body;
    if (!packageId || !bookingDate || !timeSlot || !customerPhone) {
      return res.status(400).send({ error: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });
    }

    const pkg = await collections.packageCollection.findOne({ _id: new ObjectId(packageId) });
    if (!pkg) return res.status(404).send({ error: "Gói chụp không tồn tại!" });

    const originalPrice = pkg.price;
    const depositRate = pkg.depositRate || 0.3;
    const depositAmount = originalPrice * depositRate;

    const newBooking = {
      customer: { name: customerName, phone: customerPhone, email: customerEmail || "", note: note || "" },
      packageSnapshot: {
        packageId: new ObjectId(packageId),
        packageName: pkg.name,
        price: originalPrice,
        depositAmount,
        remainingAmount: originalPrice - depositAmount
      },
      bookingDate,
      timeSlot,
      bookingStatus: "Pending",
      paymentStatus: "Deposit_Paid",
      rescheduleCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collections.bookingCollection.insertOne(newBooking);
    await collections.holdSlotCollection.deleteOne({ bookingDate, timeSlot });

    res.send({ message: "Đặt lịch chụp thành công!", bookingId: result.insertedId, data: newBooking });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Xem danh sách đơn
exports.getBookings = async (req, res) => {
  try {
    const { phone, date } = req.query;
    let query = {};
    if (phone) query["customer.phone"] = phone;
    if (date) query.bookingDate = date;

    const result = await collections.bookingCollection.find(query).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Đổi lịch (trước 24h)
exports.rescheduleBooking = async (req, res) => {
  try {
    const { bookingId, newDate, newSlot } = req.body;
    const o_id = new ObjectId(bookingId);

    const booking = await collections.bookingCollection.findOne({ _id: o_id });
    if (!booking) return res.status(404).send({ error: "Không tìm thấy đơn đặt lịch!" });
    if (booking.bookingStatus === "Cancelled") return res.status(400).send({ error: "Đơn đã bị hủy!" });

    const shootTime = new Date(`${booking.bookingDate}T${booking.timeSlot.split(" - ")[0]}:00`);
    if ((shootTime - new Date()) / (1000 * 60 * 60) < 24) {
      return res.status(400).send({ error: "Chỉ được đổi lịch trước giờ chụp ít nhất 24 tiếng!" });
    }

    const isSlotTaken = await collections.bookingCollection.findOne({
      bookingDate: newDate,
      timeSlot: newSlot,
      bookingStatus: { $ne: "Cancelled" }
    });
    if (isSlotTaken) return res.status(409).send({ error: "Khung giờ mới này đã có người đặt!" });

    await collections.bookingCollection.updateOne(
      { _id: o_id },
      { $set: { bookingDate: newDate, timeSlot: newSlot, updatedAt: new Date() },$inc: { rescheduleCount: 1 } }
    );

    const updated = await collections.bookingCollection.findOne({ _id: o_id });
    res.send({ message: "Đổi lịch chụp thành công!", data: updated });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Hủy lịch (trước 48h hoàn cọc)
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const o_id = new ObjectId(bookingId);

    const booking = await collections.bookingCollection.findOne({ _id: o_id });
    if (!booking) return res.status(404).send({ error: "Không tìm thấy đơn đặt lịch!" });
    if (booking.bookingStatus === "Cancelled") return res.status(400).send({ error: "Đơn này đã được hủy trước đó!" });

    const shootTime = new Date(`${booking.bookingDate}T${booking.timeSlot.split(" - ")[0]}:00`);
    const diffHours = (shootTime - new Date()) / (1000 * 60 * 60);

    const refundStatus = diffHours >= 48 ? "Refunded" : "Lost_Deposit";
    const message = diffHours >= 48 ? "Hủy trước 48h, được hoàn 100% cọc." : "Hủy dưới 48h, mất cọc theo quy định.";

    await collections.bookingCollection.updateOne(
      { _id: o_id },
      {
        $set: {
          bookingStatus: "Cancelled",
          paymentStatus: refundStatus,
          cancelReason: reason || "Khách yêu cầu hủy",
          cancelledAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    const updated = await collections.bookingCollection.findOne({ _id: o_id });
    res.send({ message, data: updated });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};