const bcrypt = require('bcryptjs');
const { collections } = require('../config/db');
const { signToken } = require('../middlewares/auth');
const { ROLES } = require('../config/constants');
const {
  httpError, toObjectId, requireFields, isValidEmail, isValidPhone, normalizePhone, parsePaging, escapeRegex
} = require('../utils/helpers');

// Không bao giờ trả passwordHash về client
function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function validateProfile({ email, phone }) {
  if (email !== undefined && !isValidEmail(email)) throw httpError(400, "Email không hợp lệ!");
  if (phone !== undefined && !isValidPhone(phone)) throw httpError(400, "Số điện thoại không hợp lệ!");
}

// Đăng ký tài khoản khách hàng
exports.register = async (req, res) => {
  requireFields(req.body, ["fullName", "email", "phone", "password"]);
  const { fullName, password } = req.body;
  validateProfile(req.body);
  if (String(password).length < 6) throw httpError(400, "Mật khẩu phải có ít nhất 6 ký tự!");

  const email = req.body.email.trim().toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const exists = await collections.userCollection.findOne({ $or: [{ email }, { phone }] });
  if (exists) throw httpError(409, "Email hoặc số điện thoại đã được đăng ký!");

  const user = {
    fullName: fullName.trim(),
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

  res.status(201).send({ message: "Đăng ký thành công!", token: signToken(user), user: publicUser(user) });
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

  res.send({ message: "Đăng nhập thành công!", token: signToken(user), user: publicUser(user) });
};

exports.getMe = async (req, res) => {
  const user = await collections.userCollection.findOne({ _id: toObjectId(req.user.userId) });
  if (!user) throw httpError(404, "Không tìm thấy tài khoản!");
  res.send(publicUser(user));
};

exports.updateMe = async (req, res) => {
  validateProfile(req.body);
  const update = { updatedAt: new Date() };
  if (req.body.fullName) update.fullName = String(req.body.fullName).trim();
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
  if (String(req.body.newPassword).length < 6) throw httpError(400, "Mật khẩu mới phải có ít nhất 6 ký tự!");

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
