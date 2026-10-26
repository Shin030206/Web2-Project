const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
// Dùng MONGO_URI từ .env để chạy trên MongoDB Atlas
const uri = process.env.MONGO_URI || "mongodb+srv://hongnttk24406h_db_user:93dg1ivPM7AuRywq@cluster0.jfpg0ey.mongodb.net/";
const client = new MongoClient(uri);

let db = null;
const collections = {};

async function connectDB() {
  try {
    await client.connect();
    // Kết nối tới database KyUcStudioDB theo đúng source code trên GitHub
    db = client.db("KyUcStudioDB");
    
    collections.packageCollection = db.collection("packages");
    collections.bookingCollection = db.collection("bookings");
    collections.holdSlotCollection = db.collection("holdSlots");
    collections.paymentCollection = db.collection("payments");

    // Tự động xóa slot giữ chỗ sau 1800 giây (30 phút)
    await collections.holdSlotCollection.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 1800 });

    console.log("✅ Đã kết nối thành công tới KyUcStudioDB trên MongoDB Atlas!");
  } catch (err) {
    console.error("❌ Lỗi kết nối CSDL:", err.message);
  }
}
module.exports = {
  connectDB,
  collections,
  ObjectId
};
