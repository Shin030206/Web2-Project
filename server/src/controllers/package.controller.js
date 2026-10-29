const { collections } = require('../config/db');
const { makeCrud } = require('../utils/crud');
const { httpError, escapeRegex } = require('../utils/helpers');
const { BOOKING_STATUS } = require('../config/constants');

const packageCrud = makeCrud({
  collection: "packageCollection",
  idField: "package_id",
  numericId: true,
  label: "gói chụp",
  schema: {
    package_id: { type: "number", required: true },
    category: { type: "string", required: true },
    level: { type: "string" },
    package_name: { type: "string", required: true },
    slug: { type: "string" },
    price: { type: "number", required: true },
    duration_minutes: { type: "number", required: true },
    description: { type: "string" },
    includes: { type: "array", default: [] },
    image_url: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
  },
  activeFilter: { status: "ACTIVE" },
  // Lọc theo khoảng giá min/max, category, level, từ khóa
  buildFilter: ({ minPrice, maxPrice, category, level, q }) => {
    const filter = {};
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (q) filter.package_name = { $regex: escapeRegex(q), $options: "i" };
    return filter;
  },
  // Không cho xóa gói đang có lịch chụp sắp tới (nên chuyển status = INACTIVE)
  beforeDelete: async (pkg) => {
    const activeBooking = await collections.bookingCollection.findOne({
      "pricing.package.package_id": pkg.package_id,
      bookingStatus: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED] }
    });
    if (activeBooking) throw httpError(409, "Gói này đang có lịch chụp chưa hoàn thành, hãy chuyển sang INACTIVE thay vì xóa!");
  }
});

exports.getAllPackages = packageCrud.list;
exports.getPackageByIdentifier = async (req, res) => {
  // Hỗ trợ cả slug ngoài _id và package_id
  const pkg = await collections.packageCollection.findOne({ slug: req.params.id });
  if (pkg) return res.send(pkg);
  return packageCrud.getOne(req, res);
};
exports.createPackage = packageCrud.create;
exports.updatePackage = packageCrud.update;
exports.deletePackage = packageCrud.remove;
