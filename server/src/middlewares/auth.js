const jwt = require('jsonwebtoken');
const { httpError } = require('../utils/helpers');
const { ROLES } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || "ky-uc-studio-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  Chưa đặt JWT_SECRET trong .env, đang dùng secret mặc định (chỉ dùng khi dev)!");
}

function signToken(user) {
  return jwt.sign({ userId: String(user._id), role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function readToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    throw httpError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn!");
  }
}

// Bắt buộc đăng nhập
exports.requireAuth = (req, res, next) => {
  const payload = readToken(req);
  if (!payload) throw httpError(401, "Vui lòng đăng nhập!");
  req.user = payload;
  next();
};

// Không bắt buộc: khách vãng lai vẫn đặt lịch được, nếu có token thì gắn đơn vào tài khoản
exports.optionalAuth = (req, res, next) => {
  req.user = readToken(req);
  next();
};

exports.requireAdmin = (req, res, next) => {
  const payload = readToken(req);
  if (!payload) throw httpError(401, "Vui lòng đăng nhập!");
  if (payload.role !== ROLES.ADMIN) throw httpError(403, "Bạn không có quyền thực hiện thao tác này!");
  req.user = payload;
  next();
};

exports.isAdmin = (req) => req.user?.role === ROLES.ADMIN;

exports.signToken = signToken;
