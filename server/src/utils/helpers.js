const { ObjectId } = require('../config/db');
const { TIMEZONE_OFFSET } = require('../config/constants');

// Tạo lỗi kèm HTTP status, middleware error.js sẽ trả về cho client
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isObjectId(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

function toObjectId(value, label = "ID") {
  if (value instanceof ObjectId) return value;
  if (!isObjectId(value)) throw httpError(400, `${label} không hợp lệ!`);
  return new ObjectId(value);
}

// Tìm theo _id hoặc theo mã nghiệp vụ (package_id, concept_code, ...) để frontend dùng mã nào cũng được
function identifierQuery(identifier, idField, numeric) {
  if (isObjectId(identifier)) return { _id: new ObjectId(identifier) };
  if (numeric) {
    const n = Number(identifier);
    return Number.isInteger(n) ? { [idField]: n } : { [idField]: identifier };
  }
  return { [idField]: identifier };
}

function requireFields(body, fields) {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length) throw httpError(400, `Vui lòng nhập đầy đủ thông tin bắt buộc: ${missing.join(", ")}`);
}

function isValidPhone(phone) {
  return /^(0|\+84)\d{9,10}$/.test(String(phone).replace(/\s/g, ""));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Họ tên: chỉ chữ cái (có dấu tiếng Việt) và khoảng trắng, 2–50 ký tự. Trả về tên đã chuẩn hóa "Võ Thị Thanh Vy"
function normalizeFullName(name) {
  const cleaned = String(name || "").trim().replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > 50) throw httpError(400, "Họ tên phải từ 2 đến 50 ký tự!");
  if (!/^\p{L}+( \p{L}+)*$/u.test(cleaned)) throw httpError(400, "Họ tên chỉ được chứa chữ cái và khoảng trắng, không có số hay ký tự đặc biệt!");
  return cleaned.split(" ").map(w => w.charAt(0).toLocaleUpperCase("vi") + w.slice(1).toLocaleLowerCase("vi")).join(" ");
}

// Mật khẩu mạnh: 8–32 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt; không dấu tiếng Việt, không khoảng trắng
function validatePassword(password) {
  const value = String(password || "");
  const missing = [];
  if (value.length < 8 || value.length > 32) missing.push("dài 8–32 ký tự");
  if (!/[A-Z]/.test(value)) missing.push("ít nhất 1 chữ hoa");
  if (!/[a-z]/.test(value)) missing.push("ít nhất 1 chữ thường");
  if (!/[0-9]/.test(value)) missing.push("ít nhất 1 chữ số");
  if (!/[^A-Za-z0-9]/.test(value)) missing.push("ít nhất 1 ký tự đặc biệt (vd @ # $ ! %)");
  if (!/^[\x21-\x7E]*$/.test(value)) missing.push("không chứa chữ có dấu hoặc khoảng trắng");
  if (missing.length) throw httpError(400, `Mật khẩu chưa hợp lệ, cần: ${missing.join(", ")}!`);
}

function normalizePhone(phone) {
  return String(phone).replace(/\s/g, "").replace(/^\+84/, "0");
}

// ---- Thời gian (luôn tính theo giờ Việt Nam, không phụ thuộc múi giờ của máy chủ) ----

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === dateStr;
}

function timeToMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return NaN;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return NaN;
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function toShootDate(dateStr, time) {
  return new Date(`${dateStr}T${time}:00${TIMEZONE_OFFSET}`);
}

function hoursUntil(date) {
  return (date - new Date()) / (1000 * 60 * 60);
}

function todayInVN() {
  const offsetMs = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePaging(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = {
  httpError,
  isObjectId,
  toObjectId,
  identifierQuery,
  requireFields,
  isValidPhone,
  isValidEmail,
  normalizePhone,
  normalizeFullName,
  validatePassword,
  isValidDate,
  timeToMinutes,
  minutesToTime,
  toShootDate,
  hoursUntil,
  todayInVN,
  parsePaging,
  escapeRegex
};
