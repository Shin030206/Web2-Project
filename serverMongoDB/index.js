const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3005;
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "KyUcStudioDB";

// ==========================================
// 1. CẤU HÌNH MIDDLEWARE (Chuẩn bài học UEL)
// ==========================================
app.use(morgan('combined'));
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Phục vụ tài nguyên tĩnh ảnh từ public/assets của ứng dụng Angular
const assetsPath = path.join(__dirname, '..', 'ky-uc-studio-v2', 'public', 'assets');
app.use('/assets', express.static(assetsPath));

// Hỗ trợ alias tiền tố /api/... chuẩn RESTful
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.substring(4);
  }
  next();
});

// ==========================================
// 2. KẾT NỐI CƠ SỞ DỮ LIỆU MONGODB
// ==========================================
const client = new MongoClient(mongoUri);
let database;
let packageCollection;
let conceptCollection;
let collectionCollection;
let addonCollection;
let voucherCollection;
let bookingCollection;

async function initMongoDB() {
  try {
    await client.connect();
    database = client.db(dbName);
    console.log(`✅ [MongoDB] Kết nối thành công tới Database '${dbName}' tại ${mongoUri}`);

    packageCollection = database.collection("packages");
    conceptCollection = database.collection("concepts");
    collectionCollection = database.collection("collections");
    addonCollection = database.collection("addons");
    voucherCollection = database.collection("vouchers");
    bookingCollection = database.collection("bookings");

    // Tự động kiểm tra và seed dữ liệu khởi tạo nếu database chưa có
    const countPackages = await packageCollection.countDocuments();
    if (countPackages === 0) {
      console.log("ℹ️ Database chưa có dữ liệu, đang tự động nạp từ assets/data...");
      await autoSeedData();
    }
  } catch (err) {
    console.error("❌ [MongoDB] Lỗi kết nối CSDL:", err.message);
  }
}

// Hàm tự động nạp dữ liệu từ thư mục assets/data
async function autoSeedData() {
  try {
    const dataDir = path.join(__dirname, '..', 'ky-uc-studio-v2', 'public', 'assets', 'data');
    if (!fs.existsSync(dataDir)) return;

    // 1. Packages
    const pkgFile = path.join(dataDir, 'packages.json');
    if (fs.existsSync(pkgFile)) {
      const pkgs = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).map(p => ({
        ...p,
        priceFormatted: (p.price || 0).toLocaleString('vi-VN') + 'đ',
        image: p.category.includes('Chân Dung') ? 'assets/03.01. Home/Cá nhân.jpg' :
               p.category.includes('Cặp Đôi') ? 'assets/03.01. Home/Cặp đôi.jpg' :
               p.category.includes('Gia Đình') ? 'assets/03.01. Home/Gia đình.jpg' : 'assets/03.01. Home/Hero.png'
      }));
      await packageCollection.insertMany(pkgs);
      console.log(`📦 Đã tự động nạp ${pkgs.length} gói chụp vào MongoDB.`);
    }

    // 2. Concepts
    const cptFile = path.join(dataDir, 'concepts.json');
    if (fs.existsSync(cptFile)) {
      const cpts = JSON.parse(fs.readFileSync(cptFile, 'utf8'));
      await conceptCollection.insertMany(cpts);
      console.log(`🎨 Đã tự động nạp ${cpts.length} concepts vào MongoDB.`);
    }

    // 3. Collections
    const colFile = path.join(dataDir, 'collections.json');
    if (fs.existsSync(colFile)) {
      const cols = JSON.parse(fs.readFileSync(colFile, 'utf8'));
      await collectionCollection.insertMany(cols);
      console.log(`🖼️ Đã tự động nạp ${cols.length} collections vào MongoDB.`);
    }

    // 4. Addons
    const addFile = path.join(dataDir, 'add-ons.json');
    if (fs.existsSync(addFile)) {
      const adds = JSON.parse(fs.readFileSync(addFile, 'utf8')).map(a => ({
        ...a,
        priceFormatted: (a.price || 0).toLocaleString('vi-VN') + 'đ'
      }));
      await addonCollection.insertMany(adds);
      console.log(`✨ Đã tự động nạp ${adds.length} addons vào MongoDB.`);
    }
  } catch (seedErr) {
    console.error("Lỗi khi tự động seed dữ liệu:", seedErr);
  }
}

// ==========================================
// 3. CÁC API ENDPOINTS RESTFUL
// ==========================================

// Route kiểm tra trạng thái
app.get("/", (req, res) => {
  res.send({
    message: "Ky Uc Studio MongoDB Server is running successfully!",
    database: dbName,
    port: port,
    status: "ONLINE"
  });
});

// A. GÓI DỊCH VỤ (PACKAGES)
app.get("/packages", async (req, res) => {
  try {
    const { minPrice, maxPrice, category } = req.query;
    let query = {};

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (category) {
      query.category = { $regex: new RegExp(category, 'i') };
    }

    const result = await packageCollection.find(query).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/packages/:id", async (req, res) => {
  try {
    const id = req.params["id"];
    let query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: new ObjectId(id) } 
      : { package_id: Number(id) || id };

    const result = await packageCollection.findOne(query);
    res.json(result || { message: "Package not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// B. CONCEPTS CHỤP ẢNH
app.get("/concepts", async (req, res) => {
  try {
    const { category, tag, search } = req.query;
    let query = {};

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    if (tag) {
      query.tag = { $regex: new RegExp(tag, 'i') };
    }
    if (search) {
      query.$or = [
        { concept_name: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const result = await conceptCollection.find(query).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/concepts/:code", async (req, res) => {
  try {
    const code = req.params["code"];
    let query = code.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: new ObjectId(code) } 
      : { concept_code: { $regex: new RegExp('^' + code + '$', 'i') } };

    let result = await conceptCollection.findOne(query);
    if (!result) {
      result = await conceptCollection.findOne({
        concept_name: { $regex: new RegExp(code.replace(/-/g, ' '), 'i') }
      });
    }
    res.json(result || { message: "Concept not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// C. BỘ SƯU TẬP (COLLECTIONS)
app.get("/collections", async (req, res) => {
  try {
    const result = await collectionCollection.find({}).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// D. DỊCH VỤ GIA TĂNG (ADD-ONS)
app.get("/addons", async (req, res) => {
  try {
    const result = await addonCollection.find({}).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// E. KHUNG GIỜ KHẢ DỤNG (SLOTS)
app.get("/slots", async (req, res) => {
  try {
    const { date } = req.query;
    const defaultSlots = [
      { time: '09:00 - 10:30', available: true },
      { time: '10:30 - 12:00', available: true },
      { time: '13:30 - 15:00', available: true },
      { time: '15:30 - 17:00', available: true },
      { time: '17:30 - 19:00', available: true },
      { time: '19:00 - 20:30', available: true }
    ];
    res.json(defaultSlots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// F. ĐẶT LỊCH HẸN & GIỮ CHỖ (BOOKINGS)
app.post("/bookings", async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      createdAt: new Date(),
      status: "PENDING_DEPOSIT"
    };

    const insertRes = await bookingCollection.insertOne(bookingData);
    res.json({
      success: true,
      message: "Tạo đơn đặt lịch thành công!",
      bookingId: insertRes.insertedId,
      orderCode: bookingData.orderCode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/bookings/:orderCode", async (req, res) => {
  try {
    const code = req.params["orderCode"];
    const result = await bookingCollection.findOne({ orderCode: code });
    res.json(result || { message: "Không tìm thấy đơn đặt lịch" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. KHỞI CHẠY SERVER
// ==========================================
initMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 [Server] KyUcStudio MongoDB Server đang lắng nghe tại http://localhost:${port}`);
  });
});

