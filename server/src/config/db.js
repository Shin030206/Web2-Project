const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// Dùng MONGO_URI từ .env để chạy trên MongoDB Atlas
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "KyUcStudioDB";
const client = new MongoClient(uri);

let db = null;
const collections = {};

async function connectDB() {
  await client.connect();
  db = client.db(dbName);

  collections.userCollection = db.collection("users");
  collections.packageCollection = db.collection("packages");
  collections.conceptCollection = db.collection("concepts");
  collections.albumCollection = db.collection("collections");
  collections.addonCollection = db.collection("addons");
  collections.voucherCollection = db.collection("vouchers");
  collections.bookingCollection = db.collection("bookings");
  collections.holdSlotCollection = db.collection("holdSlots");
  collections.slotLockCollection = db.collection("slotLocks");
  collections.paymentCollection = db.collection("payments");
  collections.pointCollection = db.collection("pointTransactions");

  await createIndexes();
  console.log(`✅ Đã kết nối thành công tới ${dbName}!`);
  return db;
}

async function createIndexes() {
  const c = collections;
  await Promise.all([
    c.userCollection.createIndex({ email: 1 }, { unique: true }),
    c.userCollection.createIndex({ phone: 1 }, { unique: true }),
    c.packageCollection.createIndex({ package_id: 1 }, { unique: true }),
    c.conceptCollection.createIndex({ concept_code: 1 }, { unique: true }),
    c.albumCollection.createIndex({ collection_id: 1 }, { unique: true }),
    c.addonCollection.createIndex({ addon_id: 1 }, { unique: true }),
    c.voucherCollection.createIndex({ voucher_code: 1 }, { unique: true }),
    c.bookingCollection.createIndex({ bookingCode: 1 }, { unique: true }),
    c.bookingCollection.createIndex({ bookingDate: 1, startTime: 1 }),
    c.bookingCollection.createIndex({ "customer.phone": 1 }),
    c.bookingCollection.createIndex({ userId: 1 }),
    c.paymentCollection.createIndex({ bookingId: 1 }),
    c.pointCollection.createIndex({ userId: 1, createdAt: -1 }),
    // Mỗi ô 30 phút trong ngày chỉ được 1 người chiếm -> chống đặt trùng khi 2 request tới cùng lúc
    c.slotLockCollection.createIndex({ bookingDate: 1, unit: 1 }, { unique: true }),
    c.slotLockCollection.createIndex({ ownerId: 1 }),
    // TTL: tự xóa slot giữ chỗ khi tới expiresAt (lock của booking không có expiresAt nên không bị xóa)
    c.slotLockCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.holdSlotCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
}

async function closeDB() {
  await client.close();
}

module.exports = {
  connectDB,
  closeDB,
  collections,
  ObjectId
};
