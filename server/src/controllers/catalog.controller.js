// CRUD cho concept, bộ sưu tập, dịch vụ thêm, voucher
const { makeCrud } = require('../utils/crud');
const { calculateQuote } = require('../services/pricing.service');
const { requireFields, escapeRegex } = require('../utils/helpers');

exports.concept = makeCrud({
  collection: "conceptCollection",
  idField: "concept_code",
  label: "concept",
  schema: {
    concept_code: { type: "string", required: true, upper: true },
    concept_name: { type: "string", required: true },
    category: { type: "string", required: true },
    tag: { type: "string" },
    starting_price: { type: "number" },
    description: { type: "string" },
    thumbnail_url: { type: "string" },
    images: { type: "array", default: [] },
    status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
  },
  activeFilter: { status: { $ne: "INACTIVE" } },
  buildFilter: ({ category, tag, q }) => {
    const filter = {};
    if (category) filter.category = category;
    if (tag) filter.tag = tag;
    if (q) filter.concept_name = { $regex: escapeRegex(q), $options: "i" };
    return filter;
  }
});

exports.album = makeCrud({
  collection: "albumCollection",
  idField: "collection_id",
  label: "bộ sưu tập",
  schema: {
    collection_id: { type: "string", required: true, upper: true },
    collection_name: { type: "string", required: true },
    category: { type: "string" },
    slogan: { type: "string" },
    introduction: { type: "string" },
    cover_url: { type: "string" },
    concepts: { type: "array", default: [] }
  },
  buildFilter: ({ category }) => (category ? { category } : {})
});

exports.addon = makeCrud({
  collection: "addonCollection",
  idField: "addon_id",
  numericId: true,
  label: "dịch vụ thêm",
  schema: {
    addon_id: { type: "number", required: true },
    addon_name: { type: "string", required: true },
    price: { type: "number", required: true },
    unit: { type: "string" },
    description: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
  },
  activeFilter: { status: { $ne: "INACTIVE" } }
});

exports.voucher = makeCrud({
  collection: "voucherCollection",
  idField: "voucher_code",
  label: "voucher",
  schema: {
    voucher_id: { type: "number" },
    voucher_code: { type: "string", required: true, upper: true },
    voucher_name: { type: "string", required: true },
    discount_value: { type: "number", required: true },
    required_points: { type: "number", default: 0 },
    min_order_value: { type: "number", default: 0 },
    usage_limit: { type: "number" },
    used_count: { type: "number", default: 0 },
    start_date: { type: "string" },
    end_date: { type: "string" },
    is_active: { type: "boolean", default: true }
  },
  activeFilter: { is_active: { $ne: false } }
});

// Kiểm tra mã giảm giá cho giỏ hàng hiện tại
exports.validateVoucher = async (req, res) => {
  requireFields(req.body, ["voucherCode", "packageId"]);
  const quote = await calculateQuote({ ...req.body, userId: req.user?.userId });
  res.send({
    valid: true,
    voucher: quote.voucher,
    subtotal: quote.subtotal,
    discountAmount: quote.discountAmount,
    totalAmount: quote.totalAmount
  });
};
