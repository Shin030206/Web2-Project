const nodemailer = require('nodemailer');

// Gửi mail qua SMTP (vd Gmail + App Password). Chưa cấu hình SMTP thì in nội dung ra console để dev test.
const outbox = []; // NODE_ENV=test: lưu mail đã gửi để test đọc lại

let transporter = null;
function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

function layout(title, body) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2 style="color:#8b5e3c;margin-top:0">Ký Ức Studio</h2>
    <h3>${title}</h3>
    ${body}
    <p style="color:#888;font-size:12px;margin-top:32px">Email được gửi tự động, vui lòng không trả lời.</p>
  </div>`;
}

async function sendMail({ to, subject, html, text }) {
  const mail = { from: process.env.MAIL_FROM || `Ký Ức Studio <${process.env.SMTP_USER || "no-reply@kyucstudio.vn"}>`, to, subject, html, text };
  if (process.env.NODE_ENV === "test") {
    outbox.push(mail);
    return;
  }
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [Chưa cấu hình SMTP – mail không được gửi thật]\n   Tới: ${to}\n   Tiêu đề: ${subject}\n   ${text || ""}`);
    return;
  }
  await t.sendMail(mail);
}

module.exports = { sendMail, layout, outbox };
