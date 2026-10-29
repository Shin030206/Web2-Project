// Đưa dữ liệu mẫu (JSON của frontend) lên MongoDB + tạo tài khoản admin
// Chạy: npm run seed            -> chỉ thêm bản ghi chưa có, không đụng dữ liệu đang có
//       npm run seed -- --force -> ghi đè bản ghi trùng mã bằng dữ liệu trong file JSON
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../src/utils/helpers');
const { connectDB, closeDB, collections } = require('../src/config/db');

const DATA_DIR = path.join(__dirname, '../../ky-uc-studio-v2/public/assets/data');
const force = process.argv.includes('--force');

const SOURCES = [
  { file: 'packages.json', collection: 'packageCollection', idField: 'package_id' },
  { file: 'concepts.json', collection: 'conceptCollection', idField: 'concept_code' },
  { file: 'collections.json', collection: 'albumCollection', idField: 'collection_id' },
  { file: 'add-ons.json', collection: 'addonCollection', idField: 'addon_id', defaults: { status: 'ACTIVE' } },
  { file: 'vouchers.json', collection: 'voucherCollection', idField: 'voucher_code', defaults: { used_count: 0 } }
];

async function seedCollection({ file, collection, idField, defaults = {} }) {
  const items = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  const now = new Date();
  const ops = items.map(item => {
    const doc = { ...defaults, ...item, updatedAt: now };
    return {
      updateOne: {
        filter: { [idField]: item[idField] },
        update: force ? { $set: doc, $setOnInsert: { createdAt: now } } : { $setOnInsert: { ...doc, createdAt: now } },
        upsert: true
      }
    };
  });
  const result = await collections[collection].bulkWrite(ops);
  console.log(`  ${file}: thêm mới ${result.upsertedCount}, cập nhật ${result.modifiedCount}`);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@kyucstudio.vn').toLowerCase();
  // Không có mật khẩu mặc định (repo public ai cũng đọc được): lấy từ .env, không có thì tạo ngẫu nhiên và in ra 1 lần
  let password = process.env.ADMIN_PASSWORD;
  if (password) {
    validatePassword(password);
  } else {
    password = 'Ky@9' + crypto.randomBytes(9).toString('base64url'); // tiền tố đảm bảo đủ hoa, thường, số, ký tự đặc biệt
  }
  const result = await collections.userCollection.updateOne(
    { email },
    {
      $setOnInsert: {
        fullName: 'Quản trị viên',
        email,
        phone: process.env.ADMIN_PHONE || '0900000000',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'admin',
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  if (!result.upsertedCount) return console.log(`  Admin ${email} đã tồn tại (không đổi mật khẩu)`);
  console.log(`  Đã tạo admin: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`  ⚠️  Mật khẩu admin (chỉ hiện 1 lần, hãy lưu lại): ${password}`);
}

(async () => {
  await connectDB();
  for (const source of SOURCES) await seedCollection(source);
  await seedAdmin();
  await closeDB();
  console.log('✅ Seed dữ liệu xong!');
})().catch(async err => {
  console.error('❌ Seed thất bại:', err.message);
  await closeDB();
  process.exit(1);
});
