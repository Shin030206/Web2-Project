require('dotenv').config();

const { connectDB } = require('./src/config/db');
const { expireUnpaidBookings } = require('./src/services/booking.service');
const app = require('./src/app');

const port = process.env.PORT || 3005;
const EXPIRE_CHECK_MS = 5 * 60 * 1000;

async function start() {
  // Kết nối CSDL MongoDB Atlas xong mới mở server
  await connectDB();

  // Định kỳ hủy các đơn quá hạn chưa cọc để nhả slot
  setInterval(() => {
    expireUnpaidBookings().catch(err => console.error("Lỗi tự hủy đơn quá hạn:", err.message));
  }, EXPIRE_CHECK_MS);

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch(err => {
  console.error("❌ Lỗi kết nối CSDL:", err.message);
  process.exit(1);
});
