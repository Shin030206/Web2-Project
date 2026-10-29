// Gửi SMS (mã OTP). Chọn nhà cung cấp bằng SMS_PROVIDER trong .env:
//  - console (mặc định): in tin nhắn ra terminal server, không tốn tiền, dùng khi dev/demo
//  - twilio: gửi SMS thật qua Twilio (tài khoản dùng thử chỉ gửi được tới số đã xác minh)
const outbox = []; // NODE_ENV=test: lưu tin đã gửi để test đọc lại

// 0901234567 -> +84901234567
function toE164(phone) {
  const p = String(phone).replace(/\s/g, "");
  if (p.startsWith("+")) return p;
  return "+84" + p.replace(/^0/, "");
}

async function sendViaTwilio(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Thiếu TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER trong .env");

  const apiUrl = process.env.TWILIO_API_URL || "https://api.twilio.com";
  const res = await fetch(`${apiUrl}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: to, From: from, Body: body })
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Twilio lỗi ${res.status}: ${detail.message || res.statusText}`);
  }
}

async function sendSms(phone, body) {
  const to = toE164(phone);
  const provider = process.env.SMS_PROVIDER || "console";
  if (process.env.NODE_ENV === "test" && provider === "console") {
    outbox.push({ to, body });
    return;
  }
  if (provider === "twilio") return sendViaTwilio(to, body);
  console.log(`📱 [SMS_PROVIDER=console – tin nhắn không được gửi thật]\n   Tới: ${to}\n   ${body}`);
}

module.exports = { sendSms, toE164, outbox };
