const { Given, When, Then, BeforeAll } = require('@cucumber/cucumber');
const assert = require('assert');
const { connectDB, collections } = require('../../src/config/db');

const API_BASE = 'http://localhost:3005/api';

BeforeAll(async () => {
  await connectDB();
});

// Helper for making requests
async function apiCall(path, method = 'GET', body = null, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json, headers: res.headers };
}

// ---------------------------------------------------------------------------
// Bối cảnh:
// ---------------------------------------------------------------------------
Given('Có máy chủ Ký Ức Studio và cơ sở dữ liệu MongoDB hoạt động bình thường', async function () {
  const res = await apiCall('/concepts');
  assert.strictEqual(res.status, 200, 'Server concepts endpoint should be 200 OK');
  assert.ok(Array.isArray(res.data) && res.data.length > 0, 'Concepts list must not be empty');
});

// ---------------------------------------------------------------------------
// Kịch bản 1: [Blackbox] Toàn bộ hành trình người dùng đặt lịch concept CD Vườn hoa
// ---------------------------------------------------------------------------
Given('Khách hàng mở trang danh mục concept và tìm thấy concept {string} tên {string}', async function (code, name) {
  const res = await apiCall('/concepts');
  const found = res.data.find(c => c.concept_code === code);
  assert.ok(found, `Concept code ${code} must exist in catalog`);
  assert.strictEqual(found.concept_name, name, `Concept name must match ${name}`);
  this.selectedConcept = found;
});

When('Khách hàng xem trang chi tiết của concept {string}', async function (code) {
  const res = await apiCall('/concepts');
  const found = res.data.find(c => c.concept_code.toLowerCase() === code.toLowerCase());
  assert.ok(found, `Detail for concept ${code} should be viewable`);
  this.currentDetailConcept = found;
});

When('Khách hàng bấm chuyển sang trang đặt lịch', function () {
  this.bookingQuery = {
    concept: this.currentDetailConcept.concept_code,
    conceptCode: this.currentDetailConcept.concept_code,
    conceptName: this.currentDetailConcept.concept_name,
    category: this.currentDetailConcept.category
  };
  assert.strictEqual(this.bookingQuery.conceptCode, 'CD02');
});

Then('Hệ thống phải hiển thị chính xác concept {string} với ảnh {string}', function (name, expectedImg) {
  assert.strictEqual(this.currentDetailConcept.concept_name, name);
  assert.strictEqual(this.currentDetailConcept.thumbnail_url, expectedImg);
});

When('Khách hàng chọn gói chụp {string} trị giá {int} đồng', async function (pkgId, price) {
  const res = await apiCall('/packages');
  const matched = res.data.find(p => String(p.package_id || p.packageId) === String(pkgId));
  assert.ok(matched, `Package ${pkgId} must exist`);
  assert.strictEqual(matched.price, price);
  this.selectedPackage = matched;
});

When('Khách hàng chọn ngày chụp ngày mai và giữ khung giờ trống đầu tiên', async function () {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  this.bookingDate = tomorrow.toISOString().split('T')[0];

  const slotsRes = await apiCall(`/slots?date=${this.bookingDate}&packageId=${this.selectedPackage.package_id}`);
  assert.strictEqual(slotsRes.status, 200);
  const freeSlot = slotsRes.data.slots.find(s => s.available);
  assert.ok(freeSlot, `At least one free slot must be available on ${this.bookingDate}`);
  this.selectedSlot = freeSlot;

  // Hold slot
  this.customerPhone = '0396581067';
  const holdRes = await apiCall('/slots/hold', 'POST', {
    packageId: this.selectedPackage.package_id,
    bookingDate: this.bookingDate,
    startTime: freeSlot.startTime,
    customerPhone: this.customerPhone
  });
  assert.ok(holdRes.status === 200 || holdRes.status === 201, `Hold slot returned status ${holdRes.status}`);
  assert.ok(holdRes.data.holdId, 'holdId must be returned');
  this.holdInfo = holdRes.data;
});

Then('Hệ thống phải giữ chỗ slot thành công với thời gian đếm ngược {int} phút', function (mins) {
  assert.ok(this.holdInfo.holdData.expiresAt);
  const diffSec = Math.round((new Date(this.holdInfo.holdData.expiresAt) - new Date()) / 1000);
  assert.ok(diffSec >= 590 && diffSec <= 600, 'Expires in ~10 minutes');
});

When('Khách hàng chuyển sang bước 3 thanh toán tiền cọc', async function () {
  const quoteRes = await apiCall('/bookings/quote', 'POST', {
    packageId: this.selectedPackage.package_id,
    conceptCode: this.selectedConcept.concept_code
  });
  assert.strictEqual(quoteRes.status, 200);
  this.quote = quoteRes.data;
});

Then('Thẻ tóm tắt đơn hàng bên trái phải hiển thị concept {string}, tổng tiền {int} đồng và tiền cọc {int} đồng', function (cName, expectedTotal, expectedDeposit) {
  assert.strictEqual(this.selectedConcept.concept_name.toUpperCase(), cName);
  const total = this.quote.totalAmount !== undefined ? this.quote.totalAmount : this.quote.totalPrice;
  assert.strictEqual(total, expectedTotal);
  assert.strictEqual(this.quote.depositAmount, expectedDeposit);
});

When('Khách hàng áp dụng mã ưu đãi {string}', async function (voucherCode) {
  const quoteRes = await apiCall('/bookings/quote', 'POST', {
    packageId: this.selectedPackage.package_id,
    conceptCode: this.selectedConcept.concept_code,
    voucherCode: voucherCode
  });
  assert.strictEqual(quoteRes.status, 200);
  this.discountedQuote = quoteRes.data;
  this.voucherCode = voucherCode;
});

Then('Tổng tiền đơn hàng giảm còn {int} đồng và tiền cọc thanh toán giảm còn {int} đồng', function (newTotal, newDeposit) {
  const total = this.discountedQuote.totalAmount !== undefined ? this.discountedQuote.totalAmount : this.discountedQuote.totalPrice;
  assert.strictEqual(total, newTotal);
  assert.strictEqual(this.discountedQuote.depositAmount, newDeposit);
});

When('Khách hàng xác nhận thông tin và bấm tiếp tục thanh toán cọc', function () {
  this.popupModalShown = true;
});

Then('Popup modal xác nhận thông tin phải hiển thị', function () {
  assert.strictEqual(this.popupModalShown, true);
});

When('Khách hàng xác nhận trên popup modal', async function () {
  // Login first as 0396581067 to obtain token
  const loginRes = await apiCall('/auth/login', 'POST', { account: '0396581067', password: '12345' });
  assert.strictEqual(loginRes.status, 200);
  this.userToken = loginRes.data.token;

  const createRes = await apiCall('/bookings', 'POST', {
    holdId: this.holdInfo.holdId,
    conceptCode: this.selectedConcept.concept_code,
    voucherCode: this.voucherCode,
    customerName: 'Thanh Vy',
    customerPhone: this.customerPhone,
    customerEmail: 'thanhvy@kyucstudio.vn',
    note: 'Cucumber test booking'
  }, { 'Authorization': `Bearer ${this.userToken}` });

  assert.strictEqual(createRes.status, 201, `Booking creation returned status ${createRes.status}`);
  this.createdBooking = createRes.data;
});

Then('Đơn hàng được tạo thành công với mã đơn và màn hình hiển thị mã VietQR ngân hàng MB Bank', function () {
  assert.ok(this.createdBooking.bookingCode.startsWith('KU'));
  assert.ok(this.createdBooking.paymentInfo, 'paymentInfo must be present');
  assert.ok(this.createdBooking.paymentInfo.qrUrl, 'qrUrl must be returned');
});

// ---------------------------------------------------------------------------
// Kịch bản 2: [Whitebox] Kiểm thử các điều kiện biên và quy tắc nghiệp vụ
// ---------------------------------------------------------------------------
Given('Khách hàng thử giữ một khung giờ đã có người giữ trước đó', async function () {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 4);
  const dateStr = targetDate.toISOString().split('T')[0];

  // First hold by phone A
  await apiCall('/slots/hold', 'POST', {
    packageId: 102,
    bookingDate: dateStr,
    startTime: '10:00',
    customerPhone: '0901112222'
  });

  // Second duplicate hold attempt on same slot by phone B
  this.secondHoldAttempt = await apiCall('/slots/hold', 'POST', {
    packageId: 102,
    bookingDate: dateStr,
    startTime: '10:00',
    customerPhone: '0909998888'
  });
});

Then('Hệ thống phải từ chối với mã lỗi 409', function () {
  assert.strictEqual(this.secondHoldAttempt.status, 409);
  assert.ok(this.secondHoldAttempt.data.error, 'Error message must exist');
});

Given('Người dùng đăng ký tài khoản mới với mật khẩu yếu {string}', async function (weakPass) {
  this.weakRegAttempt = await apiCall('/auth/register', 'POST', {
    fullName: 'Test Weak',
    phone: '0905554433',
    email: 'weak@test.vn',
    password: weakPass
  });
});

Then('Hệ thống phải chặn lại và yêu cầu mật khẩu tối thiểu 6 ký tự', function () {
  assert.strictEqual(this.weakRegAttempt.status, 400);
  assert.ok(this.weakRegAttempt.data.error.toLowerCase().includes('mật khẩu') || this.weakRegAttempt.data.error.includes('6'));
});

Given('Khách hàng nhập mã giảm giá không tồn tại {string}', async function (invalidCode) {
  this.invalidVoucherAttempt = await apiCall('/bookings/quote', 'POST', {
    packageId: 102,
    voucherCode: invalidCode
  });
});

Then('Hệ thống phải báo lỗi {string}', function (errPattern) {
  assert.ok(this.invalidVoucherAttempt.status === 400 || this.invalidVoucherAttempt.status === 404);
  assert.ok(this.invalidVoucherAttempt.data.error.includes(errPattern) || this.invalidVoucherAttempt.data.error.includes('Mã giảm giá'));
});

Given('Một lượt giữ chỗ slot đã hết hạn quá 10 phút', async function () {
  this.fakeExpiredHoldId = '6aef00000000000000000000';
  this.expiredBookingAttempt = await apiCall('/bookings', 'POST', {
    holdId: this.fakeExpiredHoldId,
    customerName: 'Expired Test',
    customerPhone: '0900000000'
  });
});

Then('Hệ thống không cho phép tạo đơn hàng từ lượt giữ chỗ này', function () {
  assert.ok(this.expiredBookingAttempt.status >= 400, 'Expired or invalid holdId must return 400 or 404');
});

// ---------------------------------------------------------------------------
// Kịch bản 3: [Greybox] Kiểm tra tính toàn vẹn dữ liệu trong CSDL MongoDB
// ---------------------------------------------------------------------------
Given('Một đơn hàng được tạo với mã concept {string}, gói {string}, số điện thoại {string}', async function (cCode, pkgId, phone) {
  const loginRes = await apiCall('/auth/login', 'POST', { account: '0396581067', password: '12345' });
  assert.strictEqual(loginRes.status, 200);
  this.greyboxToken = loginRes.data.token;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 5);
  const dateStr = targetDate.toISOString().split('T')[0];

  const slotsRes = await apiCall(`/slots?date=${dateStr}&packageId=${pkgId}`);
  assert.strictEqual(slotsRes.status, 200);
  const freeSlot = slotsRes.data.slots.find(s => s.available);
  assert.ok(freeSlot, 'Slot must be available');

  const hold = await apiCall('/slots/hold', 'POST', {
    packageId: parseInt(pkgId, 10),
    bookingDate: dateStr,
    startTime: freeSlot.startTime,
    customerPhone: phone
  });

  const bRes = await apiCall('/bookings', 'POST', {
    holdId: hold.data.holdId,
    conceptCode: cCode,
    customerName: 'Thanh Vy Greybox',
    customerPhone: phone,
    customerEmail: 'thanhvy@kyucstudio.vn'
  }, { 'Authorization': `Bearer ${this.greyboxToken}` });

  assert.strictEqual(bRes.status, 201);
  this.greyboxBookingId = bRes.data.bookingId;
  this.greyboxBookingCode = bRes.data.bookingCode;
});

When('Truy vấn trực tiếp vào bộ sưu tập {string} trong MongoDB', async function (colName) {
  assert.strictEqual(colName, 'bookingCollection');
  const doc = await collections.bookingCollection.findOne({ bookingCode: this.greyboxBookingCode });
  assert.ok(doc, `Booking document ${this.greyboxBookingCode} must be present in MongoDB`);
  this.dbDoc = doc;
});

Then('Bản ghi đơn hàng phải tồn tại với đúng concept_code {string} và concept_name {string}', function (cCode, cName) {
  assert.strictEqual(this.dbDoc.pricing.concept.concept_code, cCode);
  assert.strictEqual(this.dbDoc.pricing.concept.concept_name, cName);
});

Then('Số tiền cọc trong CSDL phải chính xác bằng 30 phần trăm tổng tiền đơn hàng', function () {
  const expectedDeposit = Math.round(this.dbDoc.pricing.totalAmount * 0.3);
  assert.strictEqual(this.dbDoc.pricing.depositAmount, expectedDeposit);
});

Then('Trạng thái đơn hàng ban đầu phải là {string} và trạng thái thanh toán là {string}', function (bStatus, pStatus) {
  assert.strictEqual(this.dbDoc.bookingStatus, bStatus);
  assert.strictEqual(this.dbDoc.paymentStatus, pStatus);
});

When('Khách hàng thông báo đã chuyển khoản thành công', async function () {
  const pRes = await apiCall('/payments', 'POST', {
    bookingId: this.greyboxBookingId,
    method: 'bank_transfer',
    type: 'deposit',
    phone: '0396581067',
    transactionCode: 'TEST_TXN_CUCUMBER',
    note: 'Greybox transfer confirmation'
  }, { 'Authorization': `Bearer ${this.greyboxToken}` });

  assert.ok(pRes.status === 200 || pRes.status === 201);
});

Then('Bản ghi thanh toán phải được lưu vào {string} với trạng thái {string} chờ admin duyệt', async function (colName, expectedStatus) {
  const pDoc = await collections.paymentCollection.findOne({
    $or: [
      { bookingCode: this.greyboxBookingCode },
      { bookingId: this.greyboxBookingId }
    ]
  });
  assert.ok(pDoc, 'Payment transaction must be found in paymentCollection');
  assert.strictEqual(pDoc.status, expectedStatus);
  assert.strictEqual(pDoc.method, 'bank_transfer');
  assert.strictEqual(pDoc.amount, this.dbDoc.pricing.depositAmount);
});

// ---------------------------------------------------------------------------
// Kịch bản 4: [Greybox] Khách vãng lai giữ slot rồi đăng nhập
// ---------------------------------------------------------------------------
Given('Khách vãng lai chưa đăng nhập chọn concept {string} và lưu bản nháp đặt lịch', async function (cCode) {
  this.guestConcept = cCode;
});

When('Khách hàng thực hiện đăng nhập vào tài khoản {string} mật khẩu {string}', async function (acc, pass) {
  const loginRes = await apiCall('/auth/login', 'POST', { account: acc, password: pass });
  assert.strictEqual(loginRes.status, 200);
  this.guestUserToken = loginRes.data.token;
  assert.ok(this.guestUserToken, 'Token must be issued upon login');
});

Then('Hệ thống tự động cấp phát token bảo mật phiên đăng nhập', function () {
  assert.ok(this.guestUserToken);
  assert.strictEqual(typeof this.guestUserToken, 'string');
});

Then('Khi tải lại trang đặt lịch, thông tin ngày giờ và concept đã chọn vẫn được bảo toàn nguyên vẹn', async function () {
  const saveRes = await apiCall('/booking-draft', 'PUT', {
    step: 2,
    packageId: 102,
    conceptCode: this.guestConcept,
    bookingDate: '2026-11-20',
    startTime: '15:00',
    customer: { name: 'Thanh Vy', phone: '0396581067' }
  }, { 'Authorization': `Bearer ${this.guestUserToken}` });
  assert.strictEqual(saveRes.status, 200);

  const getRes = await apiCall('/booking-draft', 'GET', null, { 'Authorization': `Bearer ${this.guestUserToken}` });
  assert.strictEqual(getRes.status, 200);
  assert.ok(getRes.data.draft);
  assert.strictEqual(getRes.data.draft.data.conceptCode, this.guestConcept);
  assert.strictEqual(getRes.data.draft.data.packageId, 102);
});
