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
  collections.draftCollection = db.collection("bookingDrafts");
  collections.passwordResetCollection = db.collection("passwordResets");

  await createIndexes();
  console.log(`✅ Đã kết nối thành công tới ${dbName}!`);
  return db;
}

// Unique chỉ áp dụng cho bản ghi có mã, để dữ liệu cũ (thiếu mã) trên Atlas không làm lỗi tạo index
function uniqueIfPresent(field, type) {
  return { unique: true, partialFilterExpression: { [field]: { $type: type } } };
}

// Nếu DB đã có index cùng tên nhưng khác tùy chọn (tạo từ code cũ) thì xóa đi rồi tạo lại
async function ensureIndex(collection, keys, options = {}) {
  try {
    await collection.createIndex(keys, options);
  } catch (err) {
    if (err.code !== 85 && err.code !== 86) throw err; // IndexOptionsConflict / IndexKeySpecsConflict
    const name = Object.entries(keys).map(([k, v]) => `${k}_${v}`).join("_");
    console.warn(`⚠️  Tạo lại index ${collection.collectionName}.${name} theo cấu hình mới`);
    await collection.dropIndex(name);
    await collection.createIndex(keys, options);
  }
}

async function createIndexes() {
  const c = collections;
  await Promise.all([
    ensureIndex(c.userCollection, { email: 1 }, uniqueIfPresent("email", "string")),
    ensureIndex(c.userCollection, { phone: 1 }, uniqueIfPresent("phone", "string")),
    ensureIndex(c.packageCollection, { package_id: 1 }, uniqueIfPresent("package_id", "number")),
    ensureIndex(c.conceptCollection, { concept_code: 1 }, uniqueIfPresent("concept_code", "string")),
    ensureIndex(c.albumCollection, { collection_id: 1 }, uniqueIfPresent("collection_id", "string")),
    ensureIndex(c.addonCollection, { addon_id: 1 }, uniqueIfPresent("addon_id", "number")),
    ensureIndex(c.voucherCollection, { voucher_code: 1 }, uniqueIfPresent("voucher_code", "string")),
    ensureIndex(c.bookingCollection, { bookingCode: 1 }, uniqueIfPresent("bookingCode", "string")),
    ensureIndex(c.bookingCollection, { bookingDate: 1, startTime: 1 }),
    ensureIndex(c.bookingCollection, { "customer.phone": 1 }),
    ensureIndex(c.bookingCollection, { userId: 1 }),
    ensureIndex(c.paymentCollection, { bookingId: 1 }),
    ensureIndex(c.paymentCollection, { txnRef: 1 }, uniqueIfPresent("txnRef", "string")),
    ensureIndex(c.pointCollection, { userId: 1, createdAt: -1 }),
    // Mỗi ô 30 phút trong ngày chỉ được 1 người chiếm -> chống đặt trùng khi 2 request tới cùng lúc
    ensureIndex(c.slotLockCollection, { bookingDate: 1, unit: 1 }, { unique: true }),
    ensureIndex(c.slotLockCollection, { ownerId: 1 }),
    // TTL: tự xóa slot giữ chỗ khi tới expiresAt (lock của booking không có expiresAt nên không bị xóa)
    ensureIndex(c.slotLockCollection, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ensureIndex(c.holdSlotCollection, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
    // Bản nháp đặt lịch: tìm theo cookie (khách vãng lai) hoặc theo tài khoản, tự xóa khi hết hạn
    ensureIndex(c.draftCollection, { draftKey: 1 }, uniqueIfPresent("draftKey", "string")),
    ensureIndex(c.draftCollection, { userId: 1 }),
    ensureIndex(c.draftCollection, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ensureIndex(c.passwordResetCollection, { email: 1 }),
    ensureIndex(c.passwordResetCollection, { expiresAt: 1 }, { expireAfterSeconds: 0 })
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
