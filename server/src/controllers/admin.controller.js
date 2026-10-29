const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { collections } = require('../config/db');
const C = require('../config/constants');
const { httpError, isValidDate, todayInVN } = require('../utils/helpers');

// Thống kê cho trang dashboard admin
// GET /api/admin/stats?from=2026-11-01&to=2026-11-30 (lọc theo ngày chụp)
exports.getStats = async (req, res) => {
  const { from, to } = req.query;
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) throw httpError(400, "from/to phải có định dạng YYYY-MM-DD!");

  const match = {};
  if (from || to) {
    match.bookingDate = {};
    if (from) match.bookingDate.$gte = from;
    if (to) match.bookingDate.$lte = to;
  }

  const today = todayInVN();
  const [byStatus, revenue, topPackages, upcoming, newCustomers] = await Promise.all([
    collections.bookingCollection.aggregate([
      { $match: match },
      { $group: { _id: "$bookingStatus", count: { $sum: 1 } } }
    ]).toArray(),
    collections.bookingCollection.aggregate([
      { $match: { ...match, bookingStatus: { $in: [C.BOOKING_STATUS.CONFIRMED, C.BOOKING_STATUS.COMPLETED, C.BOOKING_STATUS.NO_SHOW] } } },
      { $group: { _id: null, expected: { $sum: "$pricing.totalAmount" }, collected: { $sum: "$paidAmount" } } }
    ]).toArray(),
    collections.bookingCollection.aggregate([
      { $match: { ...match, bookingStatus: { $ne: C.BOOKING_STATUS.CANCELLED } } },
      { $group: { _id: "$pricing.package.package_id", package_name: { $first: "$pricing.package.package_name" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray(),
    collections.bookingCollection.find(
      { bookingDate: { $gte: today }, bookingStatus: { $in: [C.BOOKING_STATUS.PENDING, C.BOOKING_STATUS.CONFIRMED] } },
      { projection: { bookingCode: 1, bookingDate: 1, timeSlot: 1, customer: 1, bookingStatus: 1, paymentStatus: 1, "pricing.package.package_name": 1 } }
    ).sort({ shootAt: 1 }).limit(10).toArray(),
    collections.userCollection.countDocuments({ role: C.ROLES.CUSTOMER, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } })
  ]);

  const statusCount = Object.fromEntries(Object.values(C.BOOKING_STATUS).map(s => [s, 0]));
  for (const s of byStatus) statusCount[s._id] = s.count;

  res.send({
    range: { from: from || null, to: to || null },
    bookings: { total: byStatus.reduce((sum, s) => sum + s.count, 0), byStatus: statusCount },
    revenue: { expected: revenue[0]?.expected || 0, collected: revenue[0]?.collected || 0 },
    topPackages: topPackages.map(p => ({ package_id: p._id, package_name: p.package_name, count: p.count })),
    upcoming,
    newCustomersLast30Days: newCustomers
  });
};

const IMAGE_EXTENSIONS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
const UPLOAD_DIR = path.join(__dirname, "../../public/uploads");

// Upload ảnh cho concept/gói chụp, trả về URL để lưu vào thumbnail_url / image_url
exports.uploadImage = async (req, res) => {
  const file = req.files?.image;
  if (!file || Array.isArray(file)) throw httpError(400, "Vui lòng gửi đúng 1 file ở field 'image'!");
  const ext = IMAGE_EXTENSIONS[file.mimetype];
  if (!ext) throw httpError(400, "Chỉ nhận file ảnh jpg, png, webp, gif!");

  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await file.mv(path.join(UPLOAD_DIR, fileName));

  res.status(201).send({ message: "Upload ảnh thành công!", url: `/uploads/${fileName}` });
};
