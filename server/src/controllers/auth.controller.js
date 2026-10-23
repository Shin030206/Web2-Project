const bcrypt = require('bcryptjs');
const { collections } = require('../config/db');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middlewares/auth');
const { claimGuestDraft } = require('../services/draft.service');
const { ROLES } = require('../config/constants');
const {
  httpError, toObjectId, requireFields, isValidEmail, isValidPhone, normalizePhone, normalizeFullName, validatePassword,
  parsePaging, escapeRegex
} = require('../utils/helpers');

// Không bao giờ trả passwordHash về client
function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// Đăng nhập thành công: gửi token về cả cookie (trình duyệt) lẫn body (Postman/mobile),
// đồng thời chuyển bản nháp đặt lịch lúc chưa đăng nhập sang tài khoản
async function startSession(req, res, user) {
  const remember = req.body.rememberMe === true || req.body.rememberMe === "true";
  const token = signToken(user, remember);
  setAuthCookie(res, token, remember);
  const draftRestored = await claimGuestDraft(req, res, user._id);
  return { token, rememberMe: remember, draftRestored, user: publicUser(user) };
}

function validateProfile({ email, phone }) {
  if (email !== undefined && !isValidEmail(email)) throw httpError(400, "Email không hợp lệ!");
  if (phone !== undefined && !isValidPhone(phone)) throw httpError(400, "Số điện thoại không hợp lệ!");
}

// Đăng ký tài khoản khách hàng
exports.register = async (req, res) => {
  requireFields(req.body, ["fullName", "email", "phone", "password"]);
  const { password } = req.body;
  const fullName = normalizeFullName(req.body.fullName);
  validateProfile(req.body);
  validatePassword(password);

  const email = req.body.email.trim().toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const exists = await collections.userCollection.findOne({ $or: [{ email }, { phone }] });
  if (exists) throw httpError(409, "Email hoặc số điện thoại đã được đăng ký!");

  const user = {
    fullName,
    email,
    phone,
    passwordHash: await bcrypt.hash(String(password), 10),
    role: ROLES.CUSTOMER,
    points: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await collections.userCollection.insertOne(user);
  user._id = result.insertedId;

  res.status(201).send({ message: "Đăng ký thành công!", ...(await startSession(req, res, user)) });
};

// Đăng nhập bằng email hoặc số điện thoại
exports.login = async (req, res) => {
  requireFields(req.body, ["account", "password"]);
  const account = String(req.body.account).trim().toLowerCase();
  const user = await collections.userCollection.findOne(
    account.includes("@") ? { email: account } : { phone: normalizePhone(account) }
  );
  if (!user || !(await bcrypt.compare(String(req.body.password), user.passwordHash))) {
    throw httpError(401, "Sai tài khoản hoặc mật khẩu!");
  }
  if (user.isLocked) throw httpError(403, "Tài khoản đã bị khóa, vui lòng liên hệ studio!");

  res.send({ message: "Đăng nhập thành công!", ...(await startSession(req, res, user)) });
};

exports.logout = async (req, res) => {
  clearAuthCookie(res);
  res.send({ message: "Đã đăng xuất!" });
};

exports.getMe = async (req, res) => {
  const user = await collections.userCollection.findOne({ _id: toObjectId(req.user.userId) });
  if (!user) throw httpError(404, "Không tìm thấy tài khoản!");
  res.send(publicUser(user));
};

exports.updateMe = async (req, res) => {
  validateProfile(req.body);
  const update = { updatedAt: new Date() };
  if (req.body.fullName !== undefined) update.fullName = normalizeFullName(req.body.fullName);
  if (req.body.phone) update.phone = normalizePhone(req.body.phone);
  if (req.body.email) update.email = req.body.email.trim().toLowerCase();
  if (req.body.avatar_url) update.avatar_url = String(req.body.avatar_url);

  const user = await collections.userCollection.findOneAndUpdate(
    { _id: toObjectId(req.user.userId) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!user) throw httpError(404, "Không tìm thấy tài khoản!");
  res.send({ message: "Cập nhật thông tin thành công!", user: publicUser(user) });
};

exports.changePassword = async (req, res) => {
  requireFields(req.body, ["oldPassword", "newPassword"]);
  validatePassword(req.body.newPassword);
  if (req.body.newPassword === req.body.oldPassword) throw httpError(400, "Mật khẩu mới phải khác mật khẩu cũ!");

  const _id = toObjectId(req.user.userId);
  const user = await collections.userCollection.findOne({ _id });
  if (!user || !(await bcrypt.compare(String(req.body.oldPassword), user.passwordHash))) {
    throw httpError(400, "Mật khẩu cũ không đúng!");
  }
  await collections.userCollection.updateOne(
    { _id },
    { $set: { passwordHash: await bcrypt.hash(String(req.body.newPassword), 10), updatedAt: new Date() } }
  );
  res.send({ message: "Đổi mật khẩu thành công!" });
};

// Số Ký Ức Xu + lịch sử cộng/trừ xu
exports.getMyPoints = async (req, res) => {
  const userId = toObjectId(req.user.userId);
  const user = await collections.userCollection.findOne({ _id: userId }, { projection: { points: 1 } });
  const history = await collections.pointCollection.find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
  res.send({ points: user?.points || 0, history });
};

// ---- Admin quản lý tài khoản ----

exports.listUsers = async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const regex = { $regex: escapeRegex(req.query.q), $options: "i" };
    filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }
  const [data, total] = await Promise.all([
    collections.userCollection.find(filter, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    collections.userCollection.countDocuments(filter)
  ]);
  res.send({ data, page, limit, total });
};

exports.updateUserByAdmin = async (req, res) => {
  const update = { updatedAt: new Date() };
  if (req.body.role !== undefined) {
    if (!Object.values(ROLES).includes(req.body.role)) throw httpError(400, "Role không hợp lệ!");
    update.role = req.body.role;
  }
  if (req.body.isLocked !== undefined) update.isLocked = req.body.isLocked === true;

  const user = await collections.userCollection.findOneAndUpdate(
    { _id: toObjectId(req.params.id) },
    { $set: update },
    { returnDocument: "after", projection: { passwordHash: 0 } }
  );
  if (!user) throw httpError(404, "Không tìm thấy tài khoản!");
  res.send(user);
};
