const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { collections, ObjectId } = require('../config/db');
const { httpError } = require('../utils/helpers');
const { ROLES, AUTH_COOKIE, REMEMBER_DAYS, SESSION_HOURS } = require('../config/constants');

// JWT_SECRET phải là chuỗi ngẫu nhiên riêng, không được để trống hay dùng giá trị mẫu:
// ai biết secret là tự tạo được token admin giả mà không cần mật khẩu.
const WEAK_SECRETS = ["", "change-me", "secret", "ky-uc-studio-dev-secret"];
function loadJwtSecret() {
  const secret = process.env.JWT_SECRET || "";
  if (secret.length >= 16 && !WEAK_SECRETS.includes(secret)) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET chưa đặt hoặc quá yếu! Tạo bằng: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  // Khi dev: dùng secret ngẫu nhiên tạm (khởi động lại server là phải đăng nhập lại)
  console.warn("⚠️  JWT_SECRET chưa đặt hoặc quá yếu, đang dùng secret ngẫu nhiên tạm. Hãy đặt JWT_SECRET trong .env!");
  return crypto.randomBytes(32).toString("hex");
}
const JWT_SECRET = loadJwtSecret();

// Có "Lưu đăng nhập" thì token sống 30 ngày, không thì 1 ngày
function signToken(user, remember = false) {
  return jwt.sign(
    { userId: String(user._id), role: user.role, rem: Boolean(remember) },
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

// Token hợp lệ chưa đủ: tài khoản phải còn tồn tại, không bị khóa, và token phải được cấp sau lần đổi mật khẩu gần nhất
async function loadActiveUser(payload) {
  if (!payload || !ObjectId.isValid(payload.userId)) return { error: "Vui lòng đăng nhập!" };
  const user = await collections.userCollection.findOne(
    { _id: new ObjectId(payload.userId) },
    { projection: { role: 1, isLocked: 1, passwordChangedAt: 1 } }
  );
  if (!user) return { error: "Tài khoản không tồn tại!" };
  if (user.isLocked) return { error: "Tài khoản đã bị khóa, vui lòng liên hệ studio!", status: 403 };
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return { error: "Mật khẩu đã được thay đổi, vui lòng đăng nhập lại!" };
  }
  return { user: { userId: payload.userId, role: user.role, rem: payload.rem } };
}

// Bắt buộc đăng nhập
exports.requireAuth = async (req, res, next) => {
  const payload = readToken(req);
  if (!payload) throw httpError(401, "Vui lòng đăng nhập!");
  const { user, error, status } = await loadActiveUser(payload);
  if (!user) throw httpError(status || 401, error);
  req.user = user;
  next();
};

// Không bắt buộc: khách vãng lai vẫn dùng được, nếu có token thì gắn vào tài khoản
exports.optionalAuth = async (req, res, next) => {
  const payload = readToken(req);
  req.user = payload ? (await loadActiveUser(payload)).user || null : null;
  next();
};

exports.requireAdmin = async (req, res, next) => {
  const payload = readToken(req);
  if (!payload) throw httpError(401, "Vui lòng đăng nhập!");
  const { user, error, status } = await loadActiveUser(payload);
  if (!user) throw httpError(status || 401, error);
  if (user.role !== ROLES.ADMIN) throw httpError(403, "Bạn không có quyền thực hiện thao tác này!");
  req.user = user;
  next();
};

exports.isAdmin = (req) => req.user?.role === ROLES.ADMIN;

exports.signToken = signToken;
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;
exports.cookieOptions = cookieOptions;
