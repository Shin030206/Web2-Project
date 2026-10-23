const jwt = require('jsonwebtoken');
const { httpError } = require('../utils/helpers');
const { ROLES, AUTH_COOKIE, REMEMBER_DAYS, SESSION_HOURS } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || "ky-uc-studio-dev-secret";

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  Chưa đặt JWT_SECRET trong .env, đang dùng secret mặc định (chỉ dùng khi dev)!");
}

// Có "Lưu đăng nhập" thì token sống 30 ngày, không thì 1 ngày
function signToken(user, remember = false) {
  return jwt.sign(
    { userId: String(user._id), role: user.role },
    JWT_SECRET,
    { expiresIn: remember ? `${REMEMBER_DAYS}d` : `${SESSION_HOURS}h` }
  );
}

// Cookie httpOnly: JavaScript trên trình duyệt không đọc được -> khó bị đánh cắp token
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",       // bật khi deploy HTTPS
    sameSite: process.env.COOKIE_SAMESITE || "lax",     // "none" nếu frontend và backend khác domain
    path: "/"
  };
}

// Không lưu đăng nhập -> cookie phiên, tắt trình duyệt là mất
function setAuthCookie(res, token, remember) {
  const options = cookieOptions();
  if (remember) options.maxAge = REMEMBER_DAYS * 24 * 3600 * 1000;
  res.cookie(AUTH_COOKIE, token, options);
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

// Lấy token từ header "Authorization: Bearer ..." (Postman/mobile) hoặc từ cookie (trình duyệt)
function readToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    try {
      return jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      throw httpError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn!");
    }
  }

  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (!cookieToken) return null;
  try {
    return jwt.verify(cookieToken, JWT_SECRET);
  } catch {
    return null; // Cookie hết hạn thì coi như khách chưa đăng nhập
  }
}

// Bắt buộc đăng nhập
exports.requireAuth = (req, res, next) => {
  const payload = readToken(req);
  if (!payload) throw httpError(401, "Vui lòng đăng nhập!");
  req.user = payload;
  next();
};

// Không bắt buộc: khách vãng lai vẫn dùng được, nếu có token thì gắn vào tài khoản
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
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;
exports.cookieOptions = cookieOptions;
