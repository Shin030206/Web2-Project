const { collections } = require('../config/db');
const C = require('../config/constants');
const { httpError, identifierQuery, toObjectId, todayInVN } = require('../utils/helpers');

async function findActivePackage(packageId) {
  if (packageId === undefined || packageId === null || packageId === "") throw httpError(400, "Vui lòng chọn gói chụp!");
  const pkg = await collections.packageCollection.findOne(identifierQuery(String(packageId), "package_id", true));
  if (!pkg) throw httpError(404, "Gói chụp không tồn tại!");
  if (pkg.status && pkg.status !== "ACTIVE") throw httpError(400, "Gói chụp này hiện đã ngừng nhận lịch!");
  return pkg;
}

async function findConcept(conceptCode) {
  if (!conceptCode) return null;
  const concept = await collections.conceptCollection.findOne(identifierQuery(String(conceptCode), "concept_code"));
  if (!concept) throw httpError(404, "Concept không tồn tại!");
  return concept;
}

// addons: [{ addon_id, quantity }] hoặc [addon_id, ...]
async function resolveAddons(addons = []) {
  if (!Array.isArray(addons)) throw httpError(400, "addons phải là một mảng!");
  const quantities = new Map();
  for (const item of addons) {
    const id = Number(typeof item === "object" ? item.addon_id : item);
    const qty = Number(typeof item === "object" && item.quantity !== undefined ? item.quantity : 1);
    if (!Number.isInteger(id)) throw httpError(400, "addon_id không hợp lệ!");
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw httpError(400, "Số lượng dịch vụ thêm phải từ 1 đến 10!");
    quantities.set(id, (quantities.get(id) || 0) + qty);
  }
  if (!quantities.size) return [];

  const docs = await collections.addonCollection.find({ addon_id: { $in: [...quantities.keys()] } }).toArray();
  return [...quantities.entries()].map(([id, quantity]) => {
    const doc = docs.find(d => d.addon_id === id);
    if (!doc || (doc.status && doc.status !== "ACTIVE")) throw httpError(404, `Dịch vụ thêm #${id} không tồn tại!`);
    return {
      addon_id: doc.addon_id,
      addon_name: doc.addon_name,
      unit: doc.unit,
      price: doc.price,
      quantity,
      amount: doc.price * quantity
    };
  });
}

async function checkVoucher(voucherCode, subtotal, userId) {
  if (!voucherCode) return null;
  const voucher = await collections.voucherCollection.findOne({ voucher_code: String(voucherCode).trim().toUpperCase() });
  if (!voucher || voucher.is_active === false) throw httpError(404, "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng!");

  const today = todayInVN();
  if (voucher.start_date && today < voucher.start_date) throw httpError(400, "Mã giảm giá chưa tới thời gian áp dụng!");
  if (voucher.end_date && today > voucher.end_date) throw httpError(400, "Mã giảm giá đã hết hạn!");
  if (voucher.usage_limit && (voucher.used_count || 0) >= voucher.usage_limit) throw httpError(400, "Mã giảm giá đã hết lượt sử dụng!");
  if (subtotal < (voucher.min_order_value || 0)) {
    throw httpError(400, `Đơn hàng phải từ ${voucher.min_order_value.toLocaleString("vi-VN")}đ mới áp dụng được mã này!`);
  }

  const requiredPoints = voucher.required_points || 0;
  if (requiredPoints > 0) {
    if (!userId) throw httpError(401, "Vui lòng đăng nhập để đổi Ký Ức Xu lấy voucher này!");
    const user = await collections.userCollection.findOne({ _id: toObjectId(userId) });
    if (!user || (user.points || 0) < requiredPoints) throw httpError(400, `Bạn cần ${requiredPoints} Ký Ức Xu để dùng voucher này!`);
  }

  return {
    voucher_code: voucher.voucher_code,
    voucher_name: voucher.voucher_name,
    required_points: requiredPoints,
    discountAmount: Math.min(voucher.discount_value, subtotal)
  };
}

function roundThousand(value) {
  return Math.round(value / 1000) * 1000;
}

// Server tự tính tiền, không tin số tiền frontend gửi lên
async function calculateQuote({ packageId, conceptCode, addons, voucherCode, userId }) {
  const pkg = await findActivePackage(packageId);
  const concept = await findConcept(conceptCode);
  const addonItems = await resolveAddons(addons);

  const subtotal = pkg.price + addonItems.reduce((sum, a) => sum + a.amount, 0);
  const voucher = await checkVoucher(voucherCode, subtotal, userId);
  const discountAmount = voucher ? voucher.discountAmount : 0;
  const totalAmount = subtotal - discountAmount;
  const depositAmount = roundThousand(totalAmount * C.DEPOSIT_RATE);

  return {
    pkg,
    concept: concept ? { concept_code: concept.concept_code, concept_name: concept.concept_name } : null,
    package: {
      packageId: pkg._id,
      package_id: pkg.package_id,
      package_name: pkg.package_name,
      category: pkg.category,
      level: pkg.level,
      duration_minutes: pkg.duration_minutes,
      price: pkg.price
    },
    addons: addonItems,
    voucher,
    subtotal,
    discountAmount,
    totalAmount,
    depositRate: C.DEPOSIT_RATE,
    depositAmount,
    remainingAmount: totalAmount - depositAmount
  };
}

// Bỏ object pkg gốc khi trả về cho client
function publicQuote(quote) {
  const { pkg, ...rest } = quote;
  return rest;
}

module.exports = { calculateQuote, publicQuote, findActivePackage };
