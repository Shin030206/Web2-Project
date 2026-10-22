const { collections, ObjectId } = require('../config/db');

// Xem các giờ đã bận theo ngày
exports.getOccupiedSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).send({ error: "Vui lòng cung cấp tham số date (YYYY-MM-DD)" });

    const booked = await collections.bookingCollection.find(
      { bookingDate: date, bookingStatus: { $ne: "Cancelled" } },
      { projection: { timeSlot: 1, _id: 0 } }
    ).toArray();

    const holding = await collections.holdSlotCollection.find(
      { bookingDate: date },
      { projection: { timeSlot: 1, _id: 0 } }
    ).toArray();

    const occupiedSlots = [
      ...booked.map(b => ({ slot: b.timeSlot, status: "BOOKED" })),
      ...holding.map(h => ({ slot: h.timeSlot, status: "HOLDING" }))
    ];

    res.send({ date, occupiedSlots });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Giữ slot 10 phút
exports.holdSlot = async (req, res) => {
  try {
    const { bookingDate, timeSlot, customerPhone } = req.body;
    if (!bookingDate || !timeSlot || !customerPhone) {
      return res.status(400).send({ error: "Thiếu thông tin bắt buộc!" });
    }

    const isBooked = await collections.bookingCollection.findOne({
      bookingDate,
      timeSlot,
      bookingStatus: { $ne: "Cancelled" }
    });
    if (isBooked) return res.status(409).send({ error: "Khung giờ này đã có người đặt!" });

    const isHolding = await collections.holdSlotCollection.findOne({ bookingDate, timeSlot });
    if (isHolding) return res.status(409).send({ error: "Khung giờ này đang có khách khác giữ chỗ!" });

    const newHold = { bookingDate, timeSlot, customerPhone, createdAt: new Date() };
    const insertResult = await collections.holdSlotCollection.insertOne(newHold);

    res.send({
      message: "Giữ slot thành công 10 phút!",
      holdId: insertResult.insertedId,
      holdData: newHold
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Tra cứu slot đang giữ theo ID
exports.getHoldSlotById = async (req, res) => {
  try {
    const o_id = new ObjectId(req.params["id"]);
    const result = await collections.holdSlotCollection.findOne({ _id: o_id });
    if (!result) return res.status(404).send({ error: "Không tìm thấy hoặc slot đã hết hạn 10 phút!" });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};