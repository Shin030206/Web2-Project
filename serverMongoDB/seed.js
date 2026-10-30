const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

const DATA_DIR = path.join(__dirname, '..', 'ky-uc-studio-v2', 'public', 'assets', 'data');
const ASSETS_DIR = path.join(__dirname, '..', 'ky-uc-studio-v2', 'public', 'assets');

// Helper to find real image path
function findConceptImage(conceptName, category) {
  const conceptFolder = path.join(ASSETS_DIR, '03.03. Concept');
  if (!fs.existsSync(conceptFolder)) return null;

  const cleanName = conceptName.toLowerCase().replace(/^(cd|cp|gd|mc|ad|ky)\s*/i, '').trim();
  const categories = ['Chân dung', 'Couple', 'Gia đình', 'Mẹ và con', 'Áo dài'];
  
  for (const cat of categories) {
    const catDir = path.join(conceptFolder, cat);
    if (fs.existsSync(catDir)) {
      const files = fs.readdirSync(catDir);
      for (const file of files) {
        const fileLower = file.toLowerCase();
        if (fileLower.includes(cleanName) || fileLower.includes(conceptName.toLowerCase())) {
          return `assets/03.03. Concept/${cat}/${file}`;
        }
      }
    }
  }
  return null;
}

// Helper to find collection image
function findCollectionImage(conceptName) {
  const colFolder = path.join(ASSETS_DIR, '03.07. Bộ sưu tập');
  if (!fs.existsSync(colFolder)) return null;

  const clean = conceptName.toLowerCase().replace(/^(cd|cp|gd|nb|wd)\s*/i, '').trim();
  const files = fs.readdirSync(colFolder);
  for (const file of files) {
    const fLower = file.toLowerCase();
    if (fLower.includes(clean) || fLower.includes(conceptName.toLowerCase())) {
      return `assets/03.07. Bộ sưu tập/${file}`;
    }
  }
  return null;
}

async function seed() {
  try {
    console.log("🔄 Đang kết nối tới MongoDB...");
    await client.connect();
    const db = client.db("KyUcStudioDB");
    console.log("✅ Đã kết nối KyUcStudioDB!");

    // 1. SEED PACKAGES
    const packagesPath = path.join(DATA_DIR, 'packages.json');
    if (fs.existsSync(packagesPath)) {
      const rawPackages = JSON.parse(fs.readFileSync(packagesPath, 'utf8'));
      const packages = rawPackages.map(p => ({
        ...p,
        priceFormatted: (p.price || 0).toLocaleString('vi-VN') + 'đ',
        image: p.category.includes('Chân Dung') ? 'assets/03.01. Home/Cá nhân.jpg' :
               p.category.includes('Cặp Đôi') ? 'assets/03.01. Home/Cặp đôi.jpg' :
               p.category.includes('Gia Đình') ? 'assets/03.01. Home/Gia đình.jpg' : 'assets/03.01. Home/Hero.png'
      }));

      await db.collection("packages").deleteMany({});
      const resPkg = await db.collection("packages").insertMany(packages);
      console.log(`📦 Đã nạp ${resPkg.insertedCount} gói chụp (packages) vào CSDL.`);
    }

    // 2. SEED CONCEPTS WITH REAL IMAGES
    const conceptsPath = path.join(DATA_DIR, 'concepts.json');
    if (fs.existsSync(conceptsPath)) {
      const rawConcepts = JSON.parse(fs.readFileSync(conceptsPath, 'utf8'));
      const concepts = rawConcepts.map(c => {
        const realImg = findConceptImage(c.concept_name, c.category);
        return {
          ...c,
          thumbnail_url: realImg || c.thumbnail_url || 'assets/images/intro-photo.png',
          starting_price_formatted: (c.starting_price || 1500000).toLocaleString('vi-VN') + 'đ'
        };
      });

      await db.collection("concepts").deleteMany({});
      const resConcepts = await db.collection("concepts").insertMany(concepts);
      console.log(`🎨 Đã nạp ${resConcepts.insertedCount} concepts nghệ thuật (kèm ánh xạ ảnh thực tế) vào CSDL.`);
    }

    // 3. SEED COLLECTIONS
    const collectionsPath = path.join(DATA_DIR, 'collections.json');
    if (fs.existsSync(collectionsPath)) {
      const rawCollections = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
      const collections = rawCollections.map(col => ({
        ...col,
        concepts: col.concepts.map(cp => {
          const colImg = findCollectionImage(cp.concept_name);
          return {
            ...cp,
            image: colImg || 'assets/images/hero-bg.png'
          };
        })
      }));

      await db.collection("collections").deleteMany({});
      const resCol = await db.collection("collections").insertMany(collections);
      console.log(`🖼️ Đã nạp ${resCol.insertedCount} bộ sưu tập (collections) vào CSDL.`);
    }

    // 4. SEED ADD-ONS
    const addonsPath = path.join(DATA_DIR, 'add-ons.json');
    if (fs.existsSync(addonsPath)) {
      const rawAddons = JSON.parse(fs.readFileSync(addonsPath, 'utf8'));
      const addons = rawAddons.map(a => ({
        ...a,
        priceFormatted: (a.price || 0).toLocaleString('vi-VN') + 'đ'
      }));

      await db.collection("addons").deleteMany({});
      const resAddons = await db.collection("addons").insertMany(addons);
      console.log(`✨ Đã nạp ${resAddons.insertedCount} dịch vụ gia tăng (addons) vào CSDL.`);
    }

    // 5. SEED VOUCHERS
    const vouchersPath = path.join(DATA_DIR, 'vouchers.json');
    if (fs.existsSync(vouchersPath)) {
      const vouchers = JSON.parse(fs.readFileSync(vouchersPath, 'utf8'));
      await db.collection("vouchers").deleteMany({});
      const resVouchers = await db.collection("vouchers").insertMany(vouchers);
      console.log(`🎟️ Đã nạp ${resVouchers.insertedCount} mã voucher vào CSDL.`);
    }

    console.log("\n🚀 TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC ĐỒNG BỘ THÀNH CÔNG VÀO MONGODB (KyUcStudioDB)!");
  } catch (err) {
    console.error("❌ Lỗi khi seed dữ liệu:", err);
  } finally {
    await client.close();
  }
}

seed();

