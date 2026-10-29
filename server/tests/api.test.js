// Test luồng đặt lịch end-to-end. Cần 1 MongoDB để chạy (mặc định localhost, DB riêng cho test).
// Chạy: npm test   (hoặc MONGO_URI=... npm test). DB test sẽ bị xóa sau khi chạy xong.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'KyUcStudioDB_test';
process.env.JWT_SECRET = 'test-secret';
process.env.REQUIRE_LOGIN_TO_BOOK = 'false';
process.env.VNP_TMN_CODE = 'TESTTMN1';
process.env.VNP_HASH_SECRET = 'TESTSECRETKEY1234567890ABCDEFGHIJ'; // phần lớn test đặt lịch bằng khách vãng lai; test cookie bật lại

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { connectDB, closeDB, collections, ObjectId } = require('../src/config/db');
const { expireUnpaidBookings } = require('../src/services/booking.service');
const { outbox } = require('../src/services/mail.service');
const { outbox: smsOutbox } = require('../src/services/sms.service');
const vnpayService = require('../src/services/vnpay.service');
const app = require('../src/app');

let server;
let db;
let baseUrl;

async function api(method, url, body, token, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(baseUrl + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null), cookies: res.headers.getSetCookie() };
}

// Giả lập trình duyệt: giữ cookie server gửi về và gửi kèm ở các request sau
function browser() {
  const jar = {};
  return async (method, url, body) => {
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await api(method, url, body, null, cookie);
    for (const c of res.cookies) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (v === '' || /Expires=Thu, 01 Jan 1970/.test(c)) delete jar[k]; else jar[k] = v;
    }
    res.jar = { ...jar };
    return res;
  };
}

function futureDate(days) {
  return new Date(Date.now() + 7 * 3600 * 1000 + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

const DATE = futureDate(10);
let adminToken;
let userToken;

before(async () => {
  db = await connectDB();
  await db.dropDatabase();
  await connectDB(); // tạo lại index sau khi drop

  await collections.packageCollection.insertMany([
    { package_id: 102, category: 'Chân Dung', package_name: 'Chân Dung – Nâng Cao', price: 2500000, duration_minutes: 90, status: 'ACTIVE' },
    { package_id: 201, category: 'Cặp Đôi', package_name: 'Cặp Đôi – Tiêu Chuẩn', price: 2200000, duration_minutes: 60, status: 'ACTIVE' }
  ]);
  await collections.addonCollection.insertOne({ addon_id: 1, addon_name: 'Việt phục', price: 150000, unit: 'bộ' });
  await collections.conceptCollection.insertOne({ concept_code: 'BP01', concept_name: 'CD Nắng', category: 'Chân Dung' });
  await collections.voucherCollection.insertMany([
    { voucher_code: 'KYUC2026', voucher_name: 'Khách mới', discount_value: 100000, required_points: 0, min_order_value: 1500000, is_active: true },
    { voucher_code: 'XU200K', voucher_name: 'Đổi 200 xu', discount_value: 200000, required_points: 200, min_order_value: 2000000, is_active: true }
  ]);
  await collections.userCollection.insertOne({
    fullName: 'Admin', email: 'admin@test.vn', phone: '0900000000', role: 'admin', points: 0,
    passwordHash: await bcrypt.hash('admin123', 10), createdAt: new Date()
  });

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  adminToken = (await api('POST', '/auth/login', { account: 'admin@test.vn', password: 'admin123' })).body.token;
});

after(async () => {
  server?.close();
  await db.dropDatabase();
  await closeDB();
});

test('đăng ký, đăng nhập, xem thông tin tài khoản', async () => {
  const reg = await api('POST', '/auth/register', { fullName: 'Thanh Vy', email: 'vy@test.vn', phone: '0901234567', password: 'Vy@12345' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.passwordHash, undefined);

  const dup = await api('POST', '/auth/register', { fullName: 'Người Khác', email: 'vy@test.vn', phone: '0911111111', password: 'Vy@12345' });
  assert.equal(dup.status, 409);

  const bad = await api('POST', '/auth/login', { account: 'vy@test.vn', password: 'wrong' });
  assert.equal(bad.status, 401);

  const login = await api('POST', '/auth/login', { account: '0901234567', password: 'Vy@12345' });
  assert.equal(login.status, 200);
  userToken = login.body.token;

  const me = await api('GET', '/auth/me', null, userToken);
  assert.equal(me.body.email, 'vy@test.vn');
  assert.equal(me.body.role, 'customer');
});

test('quy tắc họ tên hợp lệ và mật khẩu mạnh', async () => {
  const base = { email: 'rule@test.vn', phone: '0909090909' };
  const weak = ['Vy12345', 'vy@12345', 'VY@12345', 'Vy@abcde', 'VyAbc123', 'Vy@1234 5', 'Vỹ@12345', 'V@1a'];
  for (const password of weak) {
    const res = await api('POST', '/auth/register', { ...base, fullName: 'Thanh Vy', password });
    assert.equal(res.status, 400, `mật khẩu "${password}" phải bị chặn`);
  }
  for (const fullName of ['A', 'Vy123', 'Vy@', 'Nguyễn_Văn A', 'x'.repeat(51)]) {
    const res = await api('POST', '/auth/register', { ...base, fullName, password: 'Vy@12345' });
    assert.equal(res.status, 400, `họ tên "${fullName}" phải bị chặn`);
  }
  const ok = await api('POST', '/auth/register', { ...base, fullName: '  võ   thị THANH vy ', password: 'Vy@12345' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.fullName, 'Võ Thị Thanh Vy', 'tên được chuẩn hóa');

  const token = ok.body.token;
  assert.equal((await api('PUT', '/auth/change-password', { oldPassword: 'Vy@12345', newPassword: '12345678' }, token)).status, 400);
  assert.equal((await api('PUT', '/auth/change-password', { oldPassword: 'Vy@12345', newPassword: 'Vy@12345' }, token)).status, 400);
  const changed = await api('PUT', '/auth/change-password', { oldPassword: 'Vy@12345', newPassword: 'Moi#2026' }, token);
  assert.equal(changed.status, 200);
  assert.equal((await api('PUT', '/auth/me', { fullName: 'Vy 2' }, changed.body.token)).status, 400);
});

test('phân quyền: khách không gọi được API admin', async () => {
  assert.equal((await api('GET', '/bookings')).status, 401);
  assert.equal((await api('GET', '/bookings', null, userToken)).status, 403);
  assert.equal((await api('POST', '/packages', { package_id: 999 }, userToken)).status, 403);
  assert.equal((await api('GET', '/admin/stats', null, adminToken)).status, 200);
});

test('CRUD gói chụp + lọc giá + validate dữ liệu', async () => {
  const missing = await api('POST', '/packages', { package_id: 999 }, adminToken);
  assert.equal(missing.status, 400);

  const created = await api('POST', '/packages', {
    package_id: 999, category: 'Test', package_name: 'Gói test', price: 1000000, duration_minutes: 60, hacker: 'x'
  }, adminToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.hacker, undefined);

  const filtered = await api('GET', '/packages?minPrice=2000000&maxPrice=2400000');
  assert.deepEqual(filtered.body.map(p => p.package_id), [201]);

  const updated = await api('PUT', '/packages/999', { status: 'INACTIVE' }, adminToken);
  assert.equal(updated.body.status, 'INACTIVE');
  const list = await api('GET', '/packages');
  assert.ok(!list.body.some(p => p.package_id === 999), 'gói INACTIVE bị ẩn với khách');

  assert.equal((await api('DELETE', '/packages/999', null, adminToken)).status, 200);
  assert.equal((await api('GET', '/packages/999')).status, 404);
});

test('báo giá: gói + dịch vụ thêm + voucher khớp với bookingDraft của frontend', async () => {
  const quote = await api('POST', '/bookings/quote', { packageId: 102, addons: [{ addon_id: 1 }], voucherCode: 'kyuc2026' });
  assert.equal(quote.status, 200);
  assert.equal(quote.body.subtotal, 2650000);
  assert.equal(quote.body.discountAmount, 100000);
  assert.equal(quote.body.totalAmount, 2550000);
  assert.equal(quote.body.depositAmount, 765000);

  const needLogin = await api('POST', '/vouchers/validate', { packageId: 102, voucherCode: 'XU200K' });
  assert.equal(needLogin.status, 401);
  const notEnough = await api('POST', '/vouchers/validate', { packageId: 102, voucherCode: 'XU200K' }, userToken);
  assert.equal(notEnough.status, 400);
});

test('giữ slot: chống trùng giờ, chồng giờ và 2 request cùng lúc', async () => {
  const slots = await api('GET', `/slots?date=${DATE}&packageId=102`);
  assert.equal(slots.status, 200);
  assert.equal(slots.body.slots[0].timeSlot, '08:00 - 09:30');

  const outside = await api('POST', '/slots/hold', { packageId: 102, bookingDate: DATE, startTime: '19:00', customerPhone: '0911111111' });
  assert.equal(outside.status, 400, 'buổi chụp vượt quá giờ đóng cửa');

  const results = await Promise.all(['0911111111', '0922222222', '0933333333', '0944444444', '0955555555'].map(phone =>
    api('POST', '/slots/hold', { packageId: 102, bookingDate: DATE, startTime: '13:00', customerPhone: phone })
  ));
  assert.equal(results.filter(r => r.status === 201).length, 1, 'chỉ 1 người giữ được slot');
  assert.equal(results.filter(r => r.status === 409).length, 4);

  // 12:30 + 90 phút chồng lên 13:00
  const overlap = await api('POST', '/slots/hold', { packageId: 102, bookingDate: DATE, startTime: '12:30', customerPhone: '0966666666' });
  assert.equal(overlap.status, 409);

  const occupied = await api('GET', `/slots/occupied?date=${DATE}`);
  assert.deepEqual(occupied.body.occupiedSlots.map(s => s.slot), ['13:00', '13:30', '14:00']);
  assert.ok(occupied.body.occupiedSlots.every(s => s.status === 'HOLDING'));

  const winner = results.find(r => r.status === 201).body;
  const release = await api('DELETE', `/slots/hold/${winner.holdId}`, { customerPhone: winner.holdData.customerPhone });
  assert.equal(release.status, 200);
  assert.equal((await api('GET', `/slots/occupied?date=${DATE}`)).body.occupiedSlots.length, 0);
});

let booking;

test('luồng đặt lịch: giữ slot -> tạo đơn -> tra cứu -> thanh toán cọc -> admin xác nhận', async () => {
  const hold = await api('POST', '/slots/hold', { packageId: 102, bookingDate: DATE, timeSlot: '10:30 - 12:00', customerPhone: '0901234567' }, userToken);
  assert.equal(hold.status, 201);

  const wrongPhone = await api('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Khách X', customerPhone: '0999999999' });
  assert.equal(wrongPhone.status, 403);

  const created = await api('POST', '/bookings', {
    holdId: hold.body.holdId,
    conceptCode: 'BP01',
    addons: [{ addon_id: 1, quantity: 1 }],
    voucherCode: 'KYUC2026',
    customerName: 'Võ Thị Thanh Vy',
    customerPhone: '0901234567',
    customerEmail: 'vy.vtt@gmail.com',
    note: 'Tone màu ấm'
  }, userToken);
  assert.equal(created.status, 201);
  booking = created.body.data;
  assert.equal(booking.bookingStatus, 'Pending');
  assert.equal(booking.paymentStatus, 'Unpaid');
  assert.equal(booking.pricing.totalAmount, 2550000);
  assert.equal(booking.timeSlot, '10:30 - 12:00');
  assert.equal(created.body.paymentInfo.amount, 765000);

  const reuse = await api('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Khách X', customerPhone: '0901234567' });
  assert.equal(reuse.status, 410, 'holdId chỉ dùng được 1 lần');

  const occupied = await api('GET', `/slots/occupied?date=${DATE}`);
  assert.ok(occupied.body.occupiedSlots.every(s => s.status === 'BOOKED'));

  const lookup = await api('GET', `/bookings/lookup?code=${booking.bookingCode}&phone=0901234567`);
  assert.equal(lookup.status, 200);
  assert.equal((await api('GET', `/bookings/lookup?code=${booking.bookingCode}&phone=0900000001`)).status, 404);

  const my = await api('GET', '/bookings/my', null, userToken);
  assert.equal(my.body.length, 1);

  const qr = await api('GET', `/payments/qr/${booking._id}?phone=0901234567`);
  assert.equal(qr.status, 200);
  assert.equal(qr.body.amount, 765000);
  assert.equal((await api('GET', `/payments/qr/${booking._id}?phone=0999999999`)).status, 403);

  const pay = await api('POST', '/payments', { bookingId: booking._id, phone: '0901234567', method: 'bank_transfer', amount: 1 });
  assert.equal(pay.status, 201);
  assert.equal(pay.body.data.amount, 765000, 'số tiền do server tính');
  assert.equal((await api('POST', '/payments', { bookingId: booking._id, phone: '0901234567', method: 'momo' })).status, 409);

  const confirm = await api('PUT', `/payments/${pay.body.data._id}/confirm`, null, adminToken);
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.booking.bookingStatus, 'Confirmed');
  assert.equal(confirm.body.booking.paymentStatus, 'Deposit_Paid');
});

test('đổi lịch: lùi 30 phút trong cùng ngày, không đè lên đơn khác', async () => {
  const other = await api('POST', '/slots/hold', { packageId: 201, bookingDate: DATE, startTime: '15:00', customerPhone: '0977777777' });
  await api('POST', '/bookings', { holdId: other.body.holdId, customerName: 'Khách B', customerPhone: '0977777777' });

  const noPerm = await api('PUT', `/bookings/${booking._id}/reschedule`, { bookingDate: DATE, startTime: '11:00', phone: '0977777777' });
  assert.equal(noPerm.status, 403);

  const moved = await api('PUT', `/bookings/${booking._id}/reschedule`, { bookingDate: DATE, startTime: '11:00' }, userToken);
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.timeSlot, '11:00 - 12:30');
  assert.equal(moved.body.data.rescheduleCount, 1);

  const clash = await api('PUT', `/bookings/${booking._id}/reschedule`, { bookingDate: DATE, startTime: '14:00' }, userToken);
  assert.equal(clash.status, 409);

  const occupied = await api('GET', `/slots/occupied?date=${DATE}`);
  assert.deepEqual(occupied.body.occupiedSlots.map(s => s.slot), ['11:00', '11:30', '12:00', '15:00', '15:30']);
});

test('hủy đơn trước 48h được hoàn cọc và nhả slot', async () => {
  const cancel = await api('PUT', `/bookings/${booking._id}/cancel`, { reason: 'Bận việc', phone: '0901234567' });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.bookingStatus, 'Cancelled');
  assert.equal(cancel.body.data.paymentStatus, 'Refunded');

  const occupied = await api('GET', `/slots/occupied?date=${DATE}`);
  assert.deepEqual(occupied.body.occupiedSlots.map(s => s.slot), ['15:00', '15:30']);
  assert.equal((await api('PUT', `/bookings/${booking._id}/cancel`, { phone: '0901234567' })).status, 400);
});

test('hoàn thành buổi chụp được tích xu, đổi xu lấy voucher, hủy thì hoàn xu', async () => {
  const hold = await api('POST', '/slots/hold', { packageId: 102, bookingDate: DATE, startTime: '08:00', customerPhone: '0901234567' }, userToken);
  const created = await api('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Vy', customerPhone: '0901234567' }, userToken);
  const id = created.body.bookingId;

  assert.equal((await api('PATCH', `/bookings/${id}/status`, { status: 'Completed' }, adminToken)).status, 400, 'Pending không chuyển thẳng sang Completed');
  await api('PATCH', `/bookings/${id}/status`, { status: 'Confirmed' }, adminToken);
  assert.equal((await api('PATCH', `/bookings/${id}/status`, { status: 'Completed' }, adminToken)).status, 400, 'chưa tới giờ chụp');

  await collections.bookingCollection.updateOne({ _id: new ObjectId(id) }, { $set: { shootAt: new Date(Date.now() - 3600 * 1000) } });
  const done = await api('PATCH', `/bookings/${id}/status`, { status: 'Completed' }, adminToken);
  assert.equal(done.status, 200);
  assert.equal(done.body.pointsAwarded, 250);

  const points = await api('GET', '/auth/me/points', null, userToken);
  assert.equal(points.body.points, 250);

  const hold2 = await api('POST', '/slots/hold', { packageId: 102, bookingDate: futureDate(20), startTime: '09:00', customerPhone: '0901234567' }, userToken);
  const withVoucher = await api('POST', '/bookings', { holdId: hold2.body.holdId, voucherCode: 'XU200K', customerName: 'Vy', customerPhone: '0901234567' }, userToken);
  assert.equal(withVoucher.status, 201);
  assert.equal(withVoucher.body.data.pricing.discountAmount, 200000);
  assert.equal((await api('GET', '/auth/me/points', null, userToken)).body.points, 50);

  await api('PUT', `/bookings/${withVoucher.body.bookingId}/cancel`, {}, userToken);
  assert.equal((await api('GET', '/auth/me/points', null, userToken)).body.points, 250);
});

test('đơn quá hạn cọc tự hủy và nhả slot', async () => {
  const date = futureDate(30);
  const hold = await api('POST', '/slots/hold', { packageId: 201, bookingDate: date, startTime: '09:00', customerPhone: '0988888888' });
  const created = await api('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Khách C', customerPhone: '0988888888' });
  await collections.bookingCollection.updateOne({ bookingCode: created.body.bookingCode }, { $set: { depositDeadline: new Date(Date.now() - 1000) } });

  await expireUnpaidBookings();
  const lookup = await api('GET', `/bookings/lookup?code=${created.body.bookingCode}&phone=0988888888`);
  assert.equal(lookup.body.bookingStatus, 'Cancelled');
  assert.equal((await api('GET', `/slots/occupied?date=${date}`)).body.occupiedSlots.length, 0);
});

test('slot giữ chỗ hết hạn thì không tạo đơn được', async () => {
  const hold = await api('POST', '/slots/hold', { packageId: 201, bookingDate: DATE, startTime: '17:00', customerPhone: '0912121212' });
  await collections.holdSlotCollection.updateOne({ customerPhone: '0912121212' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const created = await api('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Khách D', customerPhone: '0912121212' });
  assert.equal(created.status, 410);
});

test('lỗi đầu vào trả mã lỗi rõ ràng thay vì 500', async () => {
  assert.equal((await api('GET', '/bookings/abc', null, adminToken)).status, 400);
  assert.equal((await api('GET', '/slots?date=2026-02-30')).status, 400);
  assert.equal((await api('GET', '/khong-ton-tai')).status, 404);
  const res = await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(res.status, 400);
});

test('thống kê admin', async () => {
  const stats = await api('GET', '/admin/stats', null, adminToken);
  assert.equal(stats.status, 200);
  assert.ok(stats.body.bookings.total >= 4);
  assert.equal(stats.body.bookings.byStatus.Completed, 1);
  assert.equal(stats.body.revenue.collected, 2500000);
});

test('lưu đăng nhập bằng cookie httpOnly (có / không tick "Lưu đăng nhập")', async () => {
  const noRemember = await api('POST', '/auth/login', { account: '0901234567', password: 'Vy@12345' });
  const sessionCookie = noRemember.cookies.find(c => c.startsWith('kyuc_token='));
  assert.ok(sessionCookie.includes('HttpOnly'));
  assert.ok(!sessionCookie.includes('Max-Age'), 'không lưu đăng nhập -> cookie phiên');
  assert.equal(noRemember.body.rememberMe, false);

  const remember = await api('POST', '/auth/login', { account: '0901234567', password: 'Vy@12345', rememberMe: true });
  const longCookie = remember.cookies.find(c => c.startsWith('kyuc_token='));
  assert.match(longCookie, new RegExp(`Max-Age=${30 * 24 * 3600}`), 'lưu đăng nhập 30 ngày');

  const b = browser();
  await b('POST', '/auth/login', { account: '0901234567', password: 'Vy@12345', rememberMe: true });
  const me = await b('GET', '/auth/me');
  assert.equal(me.status, 200, 'chỉ cần cookie, không cần header Authorization');
  assert.equal(me.body.phone, '0901234567');

  await b('POST', '/auth/logout');
  assert.equal((await b('GET', '/auth/me')).status, 401, 'đăng xuất xong mất đăng nhập');

  // Cookie hỏng/hết hạn không làm lỗi các trang khách vãng lai xem được
  const stale = await api('GET', '/packages', null, null, 'kyuc_token=abc.def.ghi');
  assert.equal(stale.status, 200);
});

test('khách vãng lai đặt lịch -> đi đăng ký -> quay lại không phải nhập lại', async () => {
  process.env.REQUIRE_LOGIN_TO_BOOK = 'true';
  try {
    const b = browser();
    const date = futureDate(40);

    // Bước 1-3: chọn gói, concept, dịch vụ thêm, giờ, nhập thông tin
    const saved = await b('PUT', '/booking-draft', { packageId: 102, conceptCode: 'BP01', addons: [{ addon_id: 1 }], step: 'chon-goi' });
    assert.equal(saved.status, 200);
    assert.ok(saved.jar.kyuc_draft, 'khách vãng lai được cấp cookie bản nháp');
    assert.equal(saved.body.quote.subtotal, 2650000);

    const hold = await b('POST', '/slots/hold', { packageId: 102, bookingDate: date, startTime: '09:00', customerPhone: '0939393939' });
    await b('PUT', '/booking-draft', {
      bookingDate: date, startTime: '09:00', holdId: hold.body.holdId, step: 'thong-tin',
      customer: { name: 'Lê Minh Anh', phone: '0939393939', email: 'anh@test.vn', note: 'Chụp ngoài trời' }
    });

    // Bước 4: thanh toán -> chưa đăng nhập bị chặn
    const blocked = await b('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Lê Minh Anh', customerPhone: '0939393939' });
    assert.equal(blocked.status, 401);

    // Đi đăng ký tài khoản -> bản nháp chuyển sang tài khoản, cookie bản nháp bị xóa
    const reg = await b('POST', '/auth/register', { fullName: 'Lê Minh Anh', email: 'anh@test.vn', phone: '0939393939', password: 'Anh@2026' });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.draftRestored, true);
    assert.equal(reg.jar.kyuc_draft, undefined);

    // Quay lại trang đặt lịch: mọi thứ còn nguyên
    const back = await b('GET', '/booking-draft');
    assert.equal(back.body.draft.step, 'thong-tin');
    assert.equal(back.body.draft.data.conceptCode, 'BP01');
    assert.equal(back.body.draft.data.customer.note, 'Chụp ngoài trời');
    assert.equal(back.body.quote.totalAmount, 2650000);
    assert.equal(back.body.hold.valid, true, 'slot vẫn đang được giữ');

    // Bản nháp cũng thấy được khi đăng nhập trên thiết bị khác (theo tài khoản)
    const other = await api('GET', '/booking-draft', null, reg.body.token);
    assert.equal(other.body.draft.data.holdId, hold.body.holdId);

    const created = await b('POST', '/bookings', { ...back.body.draft.data, customerName: 'Lê Minh Anh', customerPhone: '0939393939' });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.userId, reg.body.user._id, 'đơn gắn vào tài khoản mới');
    assert.equal((await b('GET', '/booking-draft')).body.draft, null, 'đặt xong thì xóa bản nháp');
  } finally {
    process.env.REQUIRE_LOGIN_TO_BOOK = 'false';
  }
});

test('bản nháp: chỉ nhận field hợp lệ, báo slot hết hạn', async () => {
  const b = browser();
  assert.equal((await b('PUT', '/booking-draft', {})).status, 400);
  assert.equal((await b('PUT', '/booking-draft', { holdId: 'abc' })).status, 400);
  const saved = await b('PUT', '/booking-draft', { packageId: 102, hacker: 'x', holdId: new ObjectId().toString() });
  assert.equal(saved.body.draft.data.hacker, undefined);
  assert.equal(saved.body.hold.valid, false);

  const fresh = await api('GET', '/booking-draft');
  assert.equal(fresh.body.draft, null, 'trình duyệt khác không thấy bản nháp');
  assert.equal((await b('DELETE', '/booking-draft')).status, 200);
  assert.equal((await b('GET', '/booking-draft')).body.draft, null);
});

// Giả lập VNPay chuyển khách về / gọi IPN: lấy tham số từ link thanh toán, thêm kết quả rồi ký bằng HashSecret
function vnpayCallback(paymentUrl, overrides = {}) {
  const params = Object.fromEntries(new URL(paymentUrl).searchParams);
  delete params.vnp_SecureHash;
  const result = {
    vnp_Amount: params.vnp_Amount,
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP14212345',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: params.vnp_OrderInfo,
    vnp_PayDate: '20261105103000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: params.vnp_TmnCode,
    vnp_TransactionNo: '14212345',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: params.vnp_TxnRef,
    ...overrides
  };
  const hash = vnpayService.sign(result, process.env.VNP_HASH_SECRET);
  return new URLSearchParams({ ...result, vnp_SecureHash: hash }).toString();
}

async function newUnpaidBooking(phone, startTime, days) {
  const hold = await api('POST', '/slots/hold', { packageId: 102, bookingDate: futureDate(days), startTime, customerPhone: phone });
  return (await api('POST', '/bookings', { holdId: hold.body.holdId, customerName: 'Khách Vnpay', customerPhone: phone })).body;
}

test('VNPay: tạo link thanh toán đúng định dạng, chữ ký kiểm tra được', async () => {
  const bk = await newUnpaidBooking('0951515151', '08:00', 50);
  assert.equal(bk.paymentInfo.vnpayAvailable, true);
  assert.equal((await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0999999999' })).status, 403);

  const created = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0951515151', bankCode: 'NCB' });
  assert.equal(created.status, 201);
  const url = new URL(created.body.paymentUrl);
  assert.equal(url.origin + url.pathname, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
  const p = Object.fromEntries(url.searchParams);
  assert.equal(p.vnp_Version, '2.1.0');
  assert.equal(p.vnp_Command, 'pay');
  assert.equal(p.vnp_TmnCode, 'TESTTMN1');
  assert.equal(p.vnp_Amount, String(bk.data.pricing.depositAmount * 100), 'số tiền x100');
  assert.equal(p.vnp_CurrCode, 'VND');
  assert.equal(p.vnp_BankCode, 'NCB');
  assert.match(p.vnp_CreateDate, /^\d{14}$/);
  assert.match(p.vnp_OrderInfo, /^[\x20-\x7E]+$/, 'nội dung không dấu');
  assert.ok(Object.keys(p).filter(k => k !== 'vnp_SecureHash').every((k, i, arr) => i === 0 || arr[i - 1] < k), 'tham số đã sắp xếp');

  // Kiểm chữ ký độc lập theo đúng công thức VNPay: HMAC-SHA512(HashSecret, chuỗi tham số đã sắp xếp)
  const raw = created.body.paymentUrl.split('?')[1].split('&vnp_SecureHash=')[0];
  const expect = require('crypto').createHmac('sha512', process.env.VNP_HASH_SECRET).update(raw).digest('hex');
  assert.equal(p.vnp_SecureHash, expect);
});

test('VNPay: thanh toán thành công -> đơn Confirmed, gọi lại nhiều lần chỉ ghi nhận 1 lần', async () => {
  const bk = await newUnpaidBooking('0952525252', '09:30', 50);
  const created = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0952525252' });
  const query = vnpayCallback(created.body.paymentUrl);

  // IPN từ máy chủ VNPay
  const ipn = await api('GET', `/payments/vnpay/ipn?${query}`);
  assert.deepEqual(ipn.body, { RspCode: '00', Message: 'Confirm Success' });
  const ipnAgain = await api('GET', `/payments/vnpay/ipn?${query}`);
  assert.equal(ipnAgain.body.RspCode, '02', 'gọi lại báo đã xác nhận');

  // Khách quay về trang kết quả (công cụ như Postman có thể gửi lặp chuỗi tham số ở cuối -> vẫn nhận đúng)
  const ret = await api('GET', `/payments/vnpay/return?${query}&${encodeURIComponent(query)}`);
  assert.equal(ret.status, 200);
  assert.equal(ret.body.success, true);
  assert.equal(ret.body.transactionCode, '14212345');
  assert.equal(ret.body.booking.bookingStatus, 'Confirmed');
  assert.equal(ret.body.booking.paymentStatus, 'Deposit_Paid');
  assert.equal(ret.body.booking.paidAmount, bk.data.pricing.depositAmount, 'không cộng tiền 2 lần');

  const payments = await collections.paymentCollection.find({ bookingId: new ObjectId(bk.bookingId) }).toArray();
  assert.equal(payments.length, 1);
  assert.equal(payments[0].confirmedBy, 'vnpay');

  // Đã cọc rồi thì không tạo link cọc nữa, nhưng trả phần còn lại được
  assert.equal((await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0952525252' })).status, 400);
  const rest = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0952525252', type: 'remaining' });
  assert.equal(rest.status, 201);
  await api('GET', `/payments/vnpay/ipn?${vnpayCallback(rest.body.paymentUrl)}`);
  const lookup = await api('GET', `/bookings/lookup?code=${bk.bookingCode}&phone=0952525252`);
  assert.equal(lookup.body.paymentStatus, 'Fully_Paid');
  assert.equal(lookup.body.paidAmount, bk.data.pricing.totalAmount);
});

test('VNPay: khách hủy / chữ ký giả / sửa số tiền đều không được ghi nhận', async () => {
  const bk = await newUnpaidBooking('0953535353', '11:00', 50);
  const created = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0953535353' });

  const fake = vnpayCallback(created.body.paymentUrl).replace(/vnp_SecureHash=[0-9a-f]+/, 'vnp_SecureHash=' + 'a'.repeat(128));
  assert.equal((await api('GET', `/payments/vnpay/ipn?${fake}`)).body.RspCode, '97');
  assert.equal((await api('GET', `/payments/vnpay/return?${fake}`)).status, 400);

  const tampered = vnpayCallback(created.body.paymentUrl, { vnp_Amount: '100' });
  assert.equal((await api('GET', `/payments/vnpay/ipn?${tampered}`)).body.RspCode, '04');

  const unknown = vnpayCallback(created.body.paymentUrl, { vnp_TxnRef: 'KHONGTONTAI' });
  assert.equal((await api('GET', `/payments/vnpay/ipn?${unknown}`)).body.RspCode, '01');

  const cancelled = vnpayCallback(created.body.paymentUrl, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' });
  const ret = await api('GET', `/payments/vnpay/return?${cancelled}`);
  assert.equal(ret.body.success, false);
  assert.equal(ret.body.message, 'Khách hàng hủy giao dịch');
  assert.equal(ret.body.booking.paymentStatus, 'Unpaid');

  // Thanh toán lại bằng link mới thì được
  const retry = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0953535353' });
  assert.equal(retry.status, 201);
  assert.notEqual(retry.body.txnRef, created.body.txnRef);
  assert.equal((await api('GET', `/payments/vnpay/ipn?${vnpayCallback(retry.body.paymentUrl)}`)).body.RspCode, '00');
});

test('VNPay: bấm thanh toán 2 lần thì link cũ bị hủy, đang chờ VNPay thì đơn chưa bị tự hủy', async () => {
  const bk = await newUnpaidBooking('0954545454', '13:00', 50);
  const first = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0954545454' });
  const second = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0954545454' });
  assert.equal((await api('GET', `/payments/vnpay/ipn?${vnpayCallback(first.body.paymentUrl)}`)).body.RspCode, '02', 'link cũ không dùng được nữa');

  await collections.bookingCollection.updateOne({ bookingCode: bk.bookingCode }, { $set: { depositDeadline: new Date(Date.now() - 1000) } });
  await expireUnpaidBookings();
  assert.equal((await api('GET', `/bookings/lookup?code=${bk.bookingCode}&phone=0954545454`)).body.bookingStatus, 'Pending', 'đang thanh toán dở thì chưa hủy');

  await collections.paymentCollection.updateOne({ txnRef: second.body.txnRef }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await expireUnpaidBookings();
  assert.equal((await api('GET', `/bookings/lookup?code=${bk.bookingCode}&phone=0954545454`)).body.bookingStatus, 'Cancelled', 'link VNPay hết hạn mà chưa trả thì hủy');

  // Khách vẫn trả tiền sau khi đơn đã hủy -> ghi nhận tiền, đánh dấu cần hoàn tiền
  await collections.paymentCollection.updateOne({ txnRef: second.body.txnRef }, { $set: { expiresAt: new Date(Date.now() + 60000) } });
  await api('GET', `/payments/vnpay/ipn?${vnpayCallback(second.body.paymentUrl)}`);
  const paid = await collections.paymentCollection.findOne({ txnRef: second.body.txnRef });
  assert.equal(paid.status, 'Success');
  assert.equal(paid.needsRefund, true);
});

test('VNPay dở dang rồi đổi sang chuyển khoản QR vẫn được', async () => {
  const bk = await newUnpaidBooking('0955555556', '15:00', 50);
  const link = await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0955555556' });
  const manual = await api('POST', '/payments', { bookingId: bk.bookingId, phone: '0955555556', method: 'bank_transfer' });
  assert.equal(manual.status, 201);
  assert.equal((await api('GET', `/payments/vnpay/ipn?${vnpayCallback(link.body.paymentUrl)}`)).body.RspCode, '02', 'link VNPay đã bị hủy');
  assert.equal((await api('POST', '/payments/vnpay', { bookingId: bk.bookingId, phone: '0955555556' })).status, 409, 'đang chờ admin duyệt chuyển khoản');
});

test('quên mật khẩu: gửi OTP qua email -> nhập mã -> đặt mật khẩu mới', async () => {
  await api('POST', '/auth/register', { fullName: 'Quên Mật Khẩu', email: 'quen@test.vn', phone: '0961616161', password: 'Cu@12345' });
  const oldLogin = await api('POST', '/auth/login', { account: 'quen@test.vn', password: 'Cu@12345' });
  outbox.length = 0;

  // Email chưa đăng ký: trả cùng câu, không gửi mail
  const ghost = await api('POST', '/auth/forgot-password', { email: 'khongco@test.vn' });
  const real = await api('POST', '/auth/forgot-password', { email: 'QUEN@test.vn' });
  assert.equal(ghost.status, 200);
  assert.equal(ghost.body.message, real.body.message, 'không lộ email nào đã đăng ký');
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'quen@test.vn');
  const otp = outbox[0].subject.match(/^(\d{6})/)[1];
  assert.ok(outbox[0].html.includes(otp));

  // Bấm gửi lại ngay -> không gửi thêm (chống spam), mã cũ vẫn dùng được
  await api('POST', '/auth/forgot-password', { email: 'quen@test.vn' });
  assert.equal(outbox.length, 1);

  const wrong = await api('POST', '/auth/verify-reset-otp', { email: 'quen@test.vn', otp: otp === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /còn 4 lần/);
  assert.equal((await api('POST', '/auth/verify-reset-otp', { email: 'quen@test.vn', otp })).body.valid, true);

  assert.equal((await api('POST', '/auth/reset-password', { email: 'quen@test.vn', otp, newPassword: 'yeu' })).status, 400, 'mật khẩu mới vẫn phải mạnh');
  const reset = await api('POST', '/auth/reset-password', { email: 'quen@test.vn', otp, newPassword: 'Moi@12345' });
  assert.equal(reset.status, 200);
  assert.match(outbox.at(-1).subject, /đã được thay đổi/);

  assert.equal((await api('POST', '/auth/reset-password', { email: 'quen@test.vn', otp, newPassword: 'Moi@99999' })).status, 400, 'mã chỉ dùng 1 lần');
  assert.equal((await api('POST', '/auth/login', { account: 'quen@test.vn', password: 'Cu@12345' })).status, 401);
  assert.equal((await api('POST', '/auth/login', { account: 'quen@test.vn', password: 'Moi@12345' })).status, 200);

  await new Promise(r => setTimeout(r, 1100)); // token cấp trước lần đổi mật khẩu (khác giây)
  await collections.userCollection.updateOne({ email: 'quen@test.vn' }, { $set: { passwordChangedAt: new Date() } });
  const me = await api('GET', '/auth/me', null, oldLogin.body.token);
  assert.equal(me.status, 401, 'phiên đăng nhập cũ bị đăng xuất');
  assert.match(me.body.error, /Mật khẩu đã được thay đổi/);
});

test('quên mật khẩu: nhập sai quá 5 lần phải xin mã mới, mã hết hạn', async () => {
  await api('POST', '/auth/register', { fullName: 'Sai Nhiều', email: 'sai@test.vn', phone: '0962626262', password: 'Cu@12345' });
  outbox.length = 0;
  await api('POST', '/auth/forgot-password', { email: 'sai@test.vn' });
  const otp = outbox[0].subject.slice(0, 6);
  const bad = otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await api('POST', '/auth/verify-reset-otp', { email: 'sai@test.vn', otp: bad });
  const locked = await api('POST', '/auth/reset-password', { email: 'sai@test.vn', otp, newPassword: 'Moi@12345' });
  assert.equal(locked.status, 400);
  assert.match(locked.body.error, /quá 5 lần/);

  await collections.passwordResetCollection.deleteMany({});
  await api('POST', '/auth/forgot-password', { email: 'sai@test.vn' });
  const otp2 = outbox.at(-1).subject.slice(0, 6);
  await collections.passwordResetCollection.updateOne({ target: 'sai@test.vn' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await api('POST', '/auth/reset-password', { email: 'sai@test.vn', otp: otp2, newPassword: 'Moi@12345' })).status, 400, 'mã hết hạn');
});

test('admin khóa tài khoản thì phiên đang đăng nhập bị chặn ngay', async () => {
  await api('POST', '/auth/register', { fullName: 'Bị Khóa', email: 'khoa@test.vn', phone: '0963636363', password: 'Khoa@1234' });
  const login = await api('POST', '/auth/login', { account: 'khoa@test.vn', password: 'Khoa@1234' });
  assert.equal((await api('GET', '/auth/me', null, login.body.token)).status, 200);
  await api('PATCH', `/admin/users/${login.body.user._id}`, { isLocked: true }, adminToken);
  const me = await api('GET', '/auth/me', null, login.body.token);
  assert.equal(me.status, 403);
  assert.equal((await api('GET', '/packages', null, login.body.token)).status, 200, 'vẫn xem trang công khai được như khách');
});

test('quên mật khẩu qua SĐT: nhận OTP bằng SMS -> đặt mật khẩu mới', async () => {
  await api('POST', '/auth/register', { fullName: 'Quên Qua Sms', email: 'sms@test.vn', phone: '0971717171', password: 'Cu@12345' });
  smsOutbox.length = 0;
  outbox.length = 0;

  const ghost = await api('POST', '/auth/forgot-password', { phone: '0970000000' });
  const real = await api('POST', '/auth/forgot-password', { phone: '+84 971 717 171' });
  assert.equal(ghost.status, 200);
  assert.equal(ghost.body.message, real.body.message, 'không lộ SĐT nào đã đăng ký');
  assert.equal(real.body.channel, 'sms');
  assert.equal(real.body.sentTo, '097****171');
  assert.equal(smsOutbox.length, 1, 'chỉ gửi cho SĐT có tài khoản');
  assert.equal(outbox.length, 0, 'không gửi email');
  assert.equal(smsOutbox[0].to, '+84971717171');
  assert.match(smsOutbox[0].body, /^[\x20-\x7E]+$/, 'SMS không dấu');
  const otp = smsOutbox[0].body.match(/(\d{6})/)[1];

  assert.equal((await api('POST', '/auth/verify-reset-otp', { phone: '0971717171', otp })).body.valid, true);
  assert.equal((await api('POST', '/auth/reset-password', { phone: '0971717172', otp, newPassword: 'Moi@12345' })).status, 400, 'sai SĐT');
  const reset = await api('POST', '/auth/reset-password', { account: '0971717171', otp, newPassword: 'Moi@12345' });
  assert.equal(reset.status, 200);
  assert.equal(outbox.at(-1).to, 'sms@test.vn', 'báo đổi mật khẩu qua email');
  assert.equal((await api('POST', '/auth/login', { account: '0971717171', password: 'Moi@12345' })).status, 200);
});

test('quên mật khẩu: tối đa 5 mã mỗi ngày, thiếu SĐT/email báo lỗi', async () => {
  await api('POST', '/auth/register', { fullName: 'Spam Otp', email: 'spam@test.vn', phone: '0972727272', password: 'Cu@12345' });
  assert.equal((await api('POST', '/auth/forgot-password', {})).status, 400);
  assert.equal((await api('POST', '/auth/forgot-password', { phone: '123' })).status, 400);

  for (let i = 0; i < 5; i++) {
    await collections.passwordResetCollection.deleteMany({ target: '0972727272' }); // bỏ qua chờ 60 giây
    assert.equal((await api('POST', '/auth/forgot-password', { phone: '0972727272' })).status, 200);
  }
  await collections.passwordResetCollection.deleteMany({ target: '0972727272' });
  const sixth = await api('POST', '/auth/forgot-password', { phone: '0972727272' });
  assert.equal(sixth.status, 429);
});

test('gửi SMS thật qua Twilio: đúng API, đúng định dạng; Twilio lỗi thì báo 503', async () => {
  const http = require('node:http');
  const received = [];
  let fail = false;
  const fake = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      received.push({ url: req.url, auth: req.headers.authorization, body: Object.fromEntries(new URLSearchParams(body)) });
      res.writeHead(fail ? 400 : 201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fail ? { message: 'The number is unverified' } : { sid: 'SM123' }));
    });
  }).listen(0);
  Object.assign(process.env, {
    SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM_NUMBER: '+15005550006',
    TWILIO_API_URL: `http://127.0.0.1:${fake.address().port}`
  });
  try {
    await api('POST', '/auth/register', { fullName: 'Twilio Test', email: 'tw@test.vn', phone: '0973737373', password: 'Cu@12345' });
    assert.equal((await api('POST', '/auth/forgot-password', { phone: '0973737373' })).status, 200);
    assert.equal(received.length, 1);
    assert.equal(received[0].url, '/2010-04-01/Accounts/AC123/Messages.json');
    assert.equal(received[0].auth, 'Basic ' + Buffer.from('AC123:tok').toString('base64'));
    assert.equal(received[0].body.To, '+84973737373');
    assert.equal(received[0].body.From, '+15005550006');
    assert.match(received[0].body.Body, /Ma dat lai mat khau cua ban la \d{6}/);

    fail = true;
    await collections.passwordResetCollection.deleteMany({ target: '0973737373' });
    const err = await api('POST', '/auth/forgot-password', { phone: '0973737373' });
    assert.equal(err.status, 503);
    assert.equal(await collections.passwordResetCollection.countDocuments({ target: '0973737373' }), 0, 'gửi lỗi thì không giữ mã');
  } finally {
    delete process.env.SMS_PROVIDER;
    fake.close();
  }
});
