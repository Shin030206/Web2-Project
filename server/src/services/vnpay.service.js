// Tích hợp cổng thanh toán VNPay (phiên bản 2.1.0), viết theo code mẫu Node.js chính thức của VNPay
const crypto = require('crypto');
const { VNPAY_EXPIRE_MINUTES } = require('../config/constants');

function config() {
  return {
    tmnCode: process.env.VNP_TMN_CODE,
    hashSecret: process.env.VNP_HASH_SECRET,
    url: process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl: process.env.VNP_RETURN_URL || "http://localhost:4200/thanh-toan/ket-qua"
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.tmnCode && c.hashSecret);
}

// Sắp xếp tham số theo tên + encode giống hệt code mẫu VNPay (khoảng trắng thành dấu +)
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).map(encodeURIComponent).sort();
  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[decodeURIComponent(key)]).replace(/%20/g, "+");
  }
  return sorted;
}

// Ghép "key=value&..." từ object đã encode (tương đương qs.stringify(obj, { encode: false }) trong code mẫu VNPay)
function joinParams(sorted) {
  return Object.entries(sorted).map(([k, v]) => `${k}=${v}`).join("&");
}

function sign(params, secret) {
  const signData = joinParams(sortObject(params));
  return crypto.createHmac("sha512", secret).update(Buffer.from(signData, "utf-8")).digest("hex");
}

// yyyyMMddHHmmss theo giờ Việt Nam
function formatVNDate(date) {
  const d = new Date(date.getTime() + 7 * 3600 * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function normalizeIp(ip) {
  const value = String(ip || "").split(",")[0].trim();
  if (!value || value === "::1") return "127.0.0.1";
  return value.replace(/^::ffff:/, "");
}

/**
 * Tạo link chuyển sang trang thanh toán VNPay
 * amount: số tiền VND; orderInfo: nội dung không dấu
 */
function buildPaymentUrl({ txnRef, amount, orderInfo, ipAddr, bankCode, locale, createdAt = new Date() }) {
  const c = config();
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: c.tmnCode,
    vnp_Locale: locale === "en" ? "en" : "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Amount: Math.round(amount * 100), // VNPay tính theo đơn vị xu (x100)
    vnp_ReturnUrl: c.returnUrl,
    vnp_IpAddr: normalizeIp(ipAddr),
    vnp_CreateDate: formatVNDate(createdAt),
    vnp_ExpireDate: formatVNDate(new Date(createdAt.getTime() + VNPAY_EXPIRE_MINUTES * 60 * 1000))
  };
  if (bankCode) params.vnp_BankCode = bankCode;

  const secureHash = sign(params, c.hashSecret);
  const query = `${joinParams(sortObject(params))}&vnp_SecureHash=${secureHash}`;
  return `${c.url}?${query}`;
}

// Kiểm tra chữ ký VNPay gửi về (Return URL / IPN) để chống giả mạo kết quả thanh toán
function verifyReturn(query) {
  const params = { ...query };
  const secureHash = params.vnp_SecureHash;
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  if (!secureHash || !isConfigured()) return false;

  const expected = sign(params, config().hashSecret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(secureHash).toLowerCase(), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Ý nghĩa mã phản hồi vnp_ResponseCode
const RESPONSE_MESSAGES = {
  "00": "Giao dịch thành công",
  "07": "Trừ tiền thành công, giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)",
  "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking",
  "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
  "11": "Đã hết hạn chờ thanh toán",
  "12": "Thẻ/Tài khoản bị khóa",
  "13": "Nhập sai mật khẩu xác thực giao dịch (OTP)",
  "24": "Khách hàng hủy giao dịch",
  "51": "Tài khoản không đủ số dư",
  "65": "Tài khoản đã vượt quá hạn mức giao dịch trong ngày",
  "75": "Ngân hàng thanh toán đang bảo trì",
  "79": "Nhập sai mật khẩu thanh toán quá số lần quy định",
  "99": "Lỗi không xác định"
};

function responseMessage(code) {
  return RESPONSE_MESSAGES[code] || `Giao dịch không thành công (mã ${code})`;
}

module.exports = { isConfigured, buildPaymentUrl, verifyReturn, responseMessage, sign, sortObject, formatVNDate };
