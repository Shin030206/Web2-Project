const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { collections } = require('../config/db');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middlewares/auth');
const { claimGuestDraft } = require('../services/draft.service');
const { ROLES, OTP_EXPIRE_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS } = require('../config/constants');
const { sendMail, layout } = require('../services/mail.service');
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
  await setNewPassword(user, req.body.newPassword);

  // Các phiên đăng nhập cũ (thiết bị khác) bị đăng xuất, thiết bị hiện tại nhận token mới
  const token = signToken(user, req.user.rem);
  setAuthCookie(res, token, req.user.rem);
  res.send({ message: "Đổi mật khẩu thành công!", token });
};

// Đổi mật khẩu + ghi lại thời điểm để vô hiệu hóa mọi token cấp trước đó
async function setNewPassword(user, newPassword) {
  await collections.userCollection.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await bcrypt.hash(String(newPassword), 10), passwordChangedAt: new Date(), updatedAt: new Date() } }
  );
}

// ---- Quên mật khẩu: gửi mã OTP 6 số qua email ----

const RESET_MESSAGE = "Nếu email đã đăng ký tài khoản, mã xác nhận sẽ được gửi tới email trong giây lát!";

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp) + (process.env.JWT_SECRET || "")).digest("hex");
}

// Bước 1: nhập email -> gửi mã. Luôn trả cùng 1 câu để người lạ không dò được email nào đã đăng ký.
exports.forgotPassword = async (req, res) => {
  requireFields(req.body, ["email"]);
  const email = String(req.body.email).trim().toLowerCase();
  if (!isValidEmail(email)) throw httpError(400, "Email không hợp lệ!");

  const user = await collections.userCollection.findOne({ email });
  if (user && !user.isLocked) {
    const recent = await collections.passwordResetCollection.findOne({
      userId: user._id,
      createdAt: { $gt: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) }
    });
    if (!recent) {
      const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      await collections.passwordResetCollection.deleteMany({ userId: user._id });
      await collections.passwordResetCollection.insertOne({
        userId: user._id,
        email,
        otpHash: hashOtp(otp),
        attempts: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)
      });
      try {
        await sendMail({
          to: email,
          subject: `${otp} là mã đặt lại mật khẩu Ký Ức Studio`,
          text: `Mã đặt lại mật khẩu của bạn: ${otp} (hiệu lực ${OTP_EXPIRE_MINUTES} phút).`,
          html: layout("Đặt lại mật khẩu", `
            <p>Xin chào ${user.fullName},</p>
            <p>Mã xác nhận để đặt lại mật khẩu của bạn là:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#8b5e3c">${otp}</p>
            <p>Mã có hiệu lực trong <b>${OTP_EXPIRE_MINUTES} phút</b>. Không chia sẻ mã này cho bất kỳ ai.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>`)
        });
      } catch (err) {
        console.error("Gửi mail OTP thất bại:", err.message);
        await collections.passwordResetCollection.deleteMany({ userId: user._id });
        throw httpError(503, "Không gửi được email lúc này, vui lòng thử lại sau!");
      }
    }
  }
  res.send({ message: RESET_MESSAGE, expiresInMinutes: OTP_EXPIRE_MINUTES, resendAfterSeconds: OTP_RESEND_SECONDS });
};

// Kiểm tra mã, sai quá 5 lần thì phải xin mã mới
async function checkOtp(email, otp) {
  const reset = await collections.passwordResetCollection.findOne({ email, expiresAt: { $gt: new Date() } });
  if (!reset) throw httpError(400, "Mã xác nhận không đúng hoặc đã hết hạn, vui lòng yêu cầu mã mới!");
  if (reset.attempts >= OTP_MAX_ATTEMPTS) {
    await collections.passwordResetCollection.deleteOne({ _id: reset._id });
    throw httpError(400, `Bạn đã nhập sai quá ${OTP_MAX_ATTEMPTS} lần, vui lòng yêu cầu mã mới!`);
  }

  const a = Buffer.from(reset.otpHash, "hex");
  const b = Buffer.from(hashOtp(String(otp).trim()), "hex");
  if (!crypto.timingSafeEqual(a, b)) {
    await collections.passwordResetCollection.updateOne({ _id: reset._id }, { $inc: { attempts: 1 } });
    const left = OTP_MAX_ATTEMPTS - reset.attempts - 1;
    throw httpError(400, left > 0 ? `Mã xác nhận không đúng, bạn còn ${left} lần thử!` : "Mã xác nhận không đúng, vui lòng yêu cầu mã mới!");
  }
  return reset;
}

// Bước 2 (không bắt buộc): kiểm tra mã trước khi cho nhập mật khẩu mới
exports.verifyResetOtp = async (req, res) => {
  requireFields(req.body, ["email", "otp"]);
  await checkOtp(String(req.body.email).trim().toLowerCase(), req.body.otp);
  res.send({ valid: true, message: "Mã xác nhận hợp lệ!" });
};

// Bước 3: nhập mã + mật khẩu mới
exports.resetPassword = async (req, res) => {
  requireFields(req.body, ["email", "otp", "newPassword"]);
  validatePassword(req.body.newPassword);
  const email = String(req.body.email).trim().toLowerCase();
  const reset = await checkOtp(email, req.body.otp);

  const user = await collections.userCollection.findOne({ _id: reset.userId });
  if (!user) throw httpError(404, "Không tìm thấy tài khoản!");
  await setNewPassword(user, req.body.newPassword);
  await collections.passwordResetCollection.deleteMany({ userId: user._id });
  clearAuthCookie(res);

  // Mail thông báo gửi lỗi cũng không ảnh hưởng việc đổi mật khẩu
  sendMail({
    to: email,
    subject: "Mật khẩu Ký Ức Studio của bạn đã được thay đổi",
    text: "Mật khẩu tài khoản của bạn vừa được đặt lại.",
    html: layout("Mật khẩu đã được thay đổi", `
      <p>Xin chào ${user.fullName},</p>
      <p>Mật khẩu tài khoản của bạn vừa được đặt lại lúc ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.</p>
      <p>Nếu không phải bạn thực hiện, hãy liên hệ studio ngay.</p>`)
  }).catch(err => console.error("Gửi mail thông báo đổi mật khẩu thất bại:", err.message));
  res.send({ message: "Đặt lại mật khẩu thành công, vui lòng đăng nhập bằng mật khẩu mới!" });
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
