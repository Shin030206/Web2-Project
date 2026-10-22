const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
// Dùng MONGO_URI từ .env để chạy trên MongoDB Atlas
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

let db = null;
const collections = {};

async function connectDB() {
  try {
    await client.connect();
    db = client.db("KyUcStudioDB");
    
    collections.packageCollection = db.collection("packages");
    collections.bookingCollection = db.collection("bookings");
    collections.holdSlotCollection = db.collection("holdSlots");
    collections.paymentCollection = db.collection("payments");

    // Tự động xóa slot giữ chỗ sau 10 phút (TTL Index)
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