# Ký Ức Studio – Backend API

Node.js + Express 5 + MongoDB (driver `mongodb`, chạy trên MongoDB Atlas).

## Cài đặt & chạy

```bash
cd server
npm install
cp .env.example .env     # điền MONGO_URI của Atlas, JWT_SECRET, thông tin ngân hàng
npm run seed             # đưa dữ liệu mẫu (JSON của frontend) lên DB + tạo tài khoản admin
npm run dev              # chạy với nodemon (npm start để chạy production)
```

- `npm run seed` chỉ **thêm** bản ghi chưa có, không đụng dữ liệu đang có. Thêm `-- --force` để ghi đè theo file JSON.
- Test bằng Postman: Import file `server/postman/KyUcStudio.postman_collection.json` → bấm **Run collection** để chạy hết theo thứ tự (token, holdId, bookingId tự lưu vào biến).
- `npm test` chạy test end-to-end trên DB riêng `KyUcStudioDB_test` (tự xóa khi xong). Mặc định dùng `mongodb://127.0.0.1:27017`, muốn dùng Atlas thì đặt `MONGO_URI`.
- Frontend Angular: copy `server/proxy.conf.json` vào `ky-uc-studio-v2/` và thêm `"proxyConfig": "proxy.conf.json"` vào `serve.options` trong `angular.json`, rồi gọi API bằng đường dẫn tương đối `/api/...`.

## Cấu trúc

```
server/
├── index.js                  # kết nối DB rồi mới mở server, chạy job tự hủy đơn quá hạn cọc
├── scripts/seed.js
├── tests/api.test.js
└── src/
    ├── app.js                # middleware + đăng ký route
    ├── config/db.js          # kết nối MongoDB + tạo index
    ├── config/constants.js   # quy định nghiệp vụ (giờ mở cửa, % cọc, 24h/48h, ...)
    ├── middlewares/          # auth (JWT), xử lý lỗi
    ├── controllers/          # nhận request, trả response
    ├── services/             # nghiệp vụ: giữ slot, tính giá, voucher/xu, hủy đơn
    ├── routes/
    └── utils/                # helpers, CRUD factory
```

## Quy định nghiệp vụ (sửa trong `src/config/constants.js`)

| Quy định | Giá trị |
|---|---|
| Giờ mở cửa | 08:00 – 20:00, chia ô 30 phút |
| Thời lượng buổi chụp | lấy theo `duration_minutes` của gói (60–150 phút) |
| Giữ slot khi đang điền form | 10 phút |
| Đặt trước tối thiểu / tối đa | 2 tiếng / 90 ngày |
| Tiền cọc | 30% tổng tiền (làm tròn nghìn) |
| Hạn thanh toán cọc | 24h sau khi đặt, quá hạn tự hủy đơn & nhả slot |
| Đổi lịch | trước giờ chụp ≥ 24h, tối đa 2 lần (admin không giới hạn) |
| Hủy lịch | trước ≥ 48h hoàn 100% cọc, dưới 48h mất cọc; studio hủy luôn hoàn tiền |
| Ký Ức Xu | hoàn thành buổi chụp được 1 xu / 10.000đ; dùng xu đổi voucher, hủy đơn (không mất cọc) được hoàn xu |

**Chống đặt trùng:** mỗi ô 30 phút là 1 document trong `slotLocks` có unique index `(bookingDate, unit)`, nên 2 request đến cùng lúc thì chỉ 1 request thắng (kể cả khi 2 buổi chụp chỉ chồng nhau một phần).

**Trạng thái đơn:** `Pending` (chờ cọc) → `Confirmed` (đã nhận cọc) → `Completed` / `No_Show`; `Pending`/`Confirmed` → `Cancelled`.
**Trạng thái thanh toán:** `Unpaid` → `Deposit_Paid` → `Fully_Paid`; hoặc `Refunded` / `Lost_Deposit`.

## Xác thực & lưu đăng nhập

- Đăng nhập/đăng ký trả token **và** đặt cookie httpOnly `kyuc_token` (JavaScript không đọc được cookie này nên khó bị lấy cắp token).
  - Gửi `rememberMe: true` (tick "Lưu đăng nhập") → đăng nhập 30 ngày, tắt trình duyệt vẫn còn.
  - Không tick → cookie phiên, tắt trình duyệt là mất (token sống tối đa 24h).
- **Frontend Angular** chỉ cần gọi API qua proxy (`/api/...`) và bật `withCredentials: true` (vd dùng một HTTP interceptor), không cần tự lưu token vào localStorage. Muốn biết đã đăng nhập chưa thì gọi `GET /api/auth/me` (401 = chưa đăng nhập).
- Postman/mobile vẫn dùng header `Authorization: Bearer <token>` như cũ.
- 🔓 = ai cũng gọi được, 👤 = cần đăng nhập, 🛡️ = chỉ admin.
- **Tạo đơn (bước thanh toán) bắt buộc đăng nhập** (tắt bằng `REQUIRE_LOGIN_TO_BOOK=false`). Xem/giữ slot, báo giá, lưu bản nháp thì khách vãng lai vẫn dùng được. Đơn cũ của khách vãng lai vẫn tra cứu/hủy bằng mã đơn + SĐT.
- Lỗi luôn trả `{ "error": "..." }` với mã HTTP: 400 dữ liệu sai, 401 chưa đăng nhập, 403 không có quyền, 404 không tìm thấy, 409 trùng/xung đột, 410 slot giữ chỗ đã hết hạn.

## Danh sách API (prefix `/api`)

### Tài khoản – `/api/auth`
| Method | URL | Quyền | Body / ghi chú |
|---|---|---|---|
| POST | `/register` | 🔓 | `fullName, email, phone, password` → `{ token, user }`. Họ tên: chỉ chữ cái + khoảng trắng, 2–50 ký tự (tự viết hoa chữ đầu). Mật khẩu: 8–32 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt, không dấu, không khoảng trắng |
| POST | `/login` | 🔓 | `account` (email hoặc SĐT), `password`, `rememberMe?` → `{ token, user, draftRestored }` |
| POST | `/logout` | 🔓 | xóa cookie đăng nhập |
| POST | `/forgot-password` | 🔓 | `{ email }` → gửi mã OTP 6 số qua email (hiệu lực 10 phút, 60 giây mới gửi lại được). Luôn trả cùng một câu để không lộ email nào đã đăng ký |
| POST | `/verify-reset-otp` | 🔓 | `{ email, otp }` → kiểm tra mã trước khi cho nhập mật khẩu mới (sai 5 lần phải xin mã mới) |
| POST | `/reset-password` | 🔓 | `{ email, otp, newPassword }` → đặt mật khẩu mới (vẫn theo quy tắc mật khẩu mạnh), đăng xuất mọi thiết bị, gửi mail thông báo |
| GET | `/me` | 👤 | thông tin tài khoản |
| PUT | `/me` | 👤 | `fullName, phone, email, avatar_url` |
| PUT | `/change-password` | 👤 | `oldPassword, newPassword` → trả token mới; các thiết bị khác bị đăng xuất |
| GET | `/me/points` | 👤 | `{ points, history[] }` |

### Danh mục – `/api/packages`, `/api/concepts`, `/api/collections`, `/api/addons`, `/api/vouchers`
Cùng một bộ route:

| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/` | 🔓 | danh sách (bản ghi INACTIVE bị ẩn; admin thêm `?all=true` để xem hết) |
| GET | `/:id` | 🔓 | `:id` là `_id` hoặc mã nghiệp vụ (`package_id`, `concept_code`, `collection_id`, `addon_id`, `voucher_code`); gói chụp nhận thêm `slug` |
| POST | `/` | 🛡️ | tạo mới, chỉ nhận các field có trong schema |
| PUT | `/:id` | 🛡️ | cập nhật một phần |
| DELETE | `/:id` | 🛡️ | gói đang có lịch chưa hoàn thành thì không xóa được, hãy chuyển sang `INACTIVE` |

Bộ lọc:
- `GET /api/packages?minPrice=&maxPrice=&category=&level=&q=`
- `GET /api/concepts?category=&tag=&q=`
- `GET /api/collections?category=`
- `POST /api/vouchers/validate` 🔓 — body `{ voucherCode, packageId, addons? }` → số tiền giảm (voucher đổi xu thì cần đăng nhập).

### Lịch trống & giữ slot – `/api/slots`
| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/?date=YYYY-MM-DD&packageId=102` | 🔓 | tất cả giờ bắt đầu trong ngày, mỗi giờ có `status`: `AVAILABLE`, `BOOKED`, `HOLDING`, `PAST` |
| GET | `/occupied?date=` | 🔓 | các ô 30 phút đang bận |
| POST | `/hold` | 🔓 | `{ packageId, bookingDate, startTime: "10:30", customerPhone }` → `{ holdId, holdData }`, giữ trong 10 phút |
| GET | `/hold/:id` | 🔓 | kèm `secondsLeft` để hiển thị đồng hồ đếm ngược |
| DELETE | `/hold/:id` | 🔓 | body `{ customerPhone }`, trả slot ngay |

### Đặt lịch – `/api/bookings`
| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/quote` | 🔓 | `{ packageId, conceptCode?, addons?: [{addon_id, quantity}], voucherCode? }` → bảng giá |
| POST | `/` | 🔓 | `{ holdId, customerName, customerPhone, customerEmail?, note?, conceptCode?, addons?, voucherCode? }` → `{ bookingCode, data, paymentInfo }` |
| GET | `/lookup?code=KU...&phone=...` | 🔓 | khách vãng lai tra cứu đơn |
| GET | `/my` | 👤 | lịch sử đặt lịch của tài khoản |
| GET | `/:id` | 🔓/👤 | chủ đơn, admin, hoặc gửi `?phone=` |
| PUT | `/:id/reschedule` | 🔓/👤 | `{ bookingDate, startTime, phone? }` |
| PUT | `/:id/cancel` | 🔓/👤 | `{ reason?, phone? }` |
| GET | `/` | 🛡️ | lọc `status, paymentStatus, date, from, to, phone, code, packageId, page, limit, sort=newest` |
| PATCH | `/:id/status` | 🛡️ | `{ status: "Confirmed" | "Completed" | "No_Show" | "Cancelled", note? }` |

`paymentInfo` gồm số tiền cọc, nội dung chuyển khoản và `qrUrl` (ảnh VietQR, frontend chỉ cần `<img [src]="qrUrl">`).

### Bản nháp đặt lịch – `/api/booking-draft`
Lưu tiến trình đặt lịch để khách không phải nhập lại. Khách vãng lai được nhận diện bằng cookie `kyuc_draft` (giữ 7 ngày); khi đăng nhập/đăng ký, bản nháp tự chuyển sang tài khoản (`draftRestored: true`).

| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| PUT | `/` | 🔓 | lưu từng phần, gửi field nào cập nhật field đó: `packageId, conceptCode, addons, voucherCode, bookingDate, startTime, holdId, customer: {name, phone, email, note}, step` |
| GET | `/` | 🔓 | `{ draft: { step, data }, quote, hold: { valid, secondsLeft } }` hoặc `{ draft: null }` |
| DELETE | `/` | 🔓 | xóa bản nháp (tự xóa khi tạo đơn thành công) |

### Thanh toán – `/api/payments`
| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/` | 🔓/👤 | `{ bookingId, method: bank_transfer|momo|cash, type: deposit|remaining, transactionCode?, phone? }`. Số tiền do server tính |
| GET | `/` | 🛡️ | `?status=Pending&bookingId=` |
| PUT | `/:id/confirm` | 🛡️ | xác nhận đã nhận tiền → đơn chuyển `Confirmed` / `Fully_Paid` |
| PUT | `/:id/reject` | 🛡️ | `{ reason }` |

### Thanh toán VNPay – `/api/payments/vnpay`
| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/vnpay` | 🔓/👤 | `{ bookingId, type?: deposit|remaining, bankCode?: "NCB", locale?: vn|en, phone? }` → `{ paymentUrl }`. Link hết hạn sau 15 phút, bấm lại sẽ tạo link mới |
| GET | `/vnpay/return?vnp_...` | 🔓 | frontend gửi nguyên query string VNPay trả về → `{ success, message, amount, transactionCode, booking }` |
| GET | `/vnpay/ipn?vnp_...` | VNPay | máy chủ VNPay gọi để báo kết quả, trả `{ RspCode, Message }` |

Server kiểm tra chữ ký HMAC-SHA512, số tiền, mã giao dịch; mỗi giao dịch chỉ được ghi nhận 1 lần dù Return và IPN cùng gọi. Thanh toán thành công thì đơn tự chuyển `Confirmed` / `Deposit_Paid` (hoặc `Fully_Paid` với `type: remaining`), admin không cần duyệt tay.

**Cách test VNPay sandbox:** (trong Postman có sẵn thư mục *8. Kịch bản thanh toán VNPay*, bấm Send lần lượt từng bước)
1. Đăng ký tài khoản test tại https://sandbox.vnpayment.vn/devreg/ → VNPay gửi `vnp_TmnCode` và `vnp_HashSecret` qua email → điền vào `.env` (`VNP_TMN_CODE`, `VNP_HASH_SECRET`).
2. Tạo đơn → `POST /api/payments/vnpay` → mở `paymentUrl` trên trình duyệt.
3. Chọn ngân hàng **NCB**, nhập thẻ test: số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, ngày phát hành `07/15`, OTP `123456`.
4. VNPay chuyển về `VNP_RETURN_URL?vnp_...` → frontend gọi `GET /api/payments/vnpay/return` + nguyên query string đó để hiện kết quả.
5. IPN chỉ chạy khi server có địa chỉ public (deploy hoặc dùng ngrok) và đã khai báo IPN URL `https://<domain>/api/payments/vnpay/ipn` trong trang quản trị merchant VNPay. Chạy local không có IPN vẫn được vì Return URL cũng ghi nhận kết quả.

### Admin – `/api/admin` 🛡️
| Method | URL | Ghi chú |
|---|---|---|
| GET | `/stats?from=&to=` | số đơn theo trạng thái, doanh thu, top gói, lịch sắp tới, khách mới |
| GET | `/users?q=&role=&page=` | danh sách tài khoản |
| PATCH | `/users/:id` | `{ role?, isLocked? }` |
| POST | `/uploads` | form-data field `image` (jpg/png/webp/gif, ≤10MB) → `{ url }` |

## Luồng đặt lịch cho frontend

1. `GET /api/slots?date=...&packageId=...` → hiển thị các giờ `available`.
2. Khách chọn gói, concept, dịch vụ thêm, giờ → `POST /api/slots/hold` (lưu `holdId`, hiện đếm ngược 10 phút) và `POST /api/bookings/quote` để hiện tổng tiền.
3. **Sau mỗi bước** gọi `PUT /api/booking-draft` để lưu lại lựa chọn + thông tin khách đã nhập.
4. Tới bước thanh toán mà chưa đăng nhập (`GET /api/auth/me` trả 401) → chuyển sang trang đăng nhập/đăng ký, kèm đường dẫn quay về (vd `/dang-nhap?returnUrl=/dat-lich`).
5. Đăng nhập/đăng ký xong → quay lại trang đặt lịch → `GET /api/booking-draft` để điền lại form đúng bước `step`. Nếu `hold.valid = false` thì cho khách chọn lại giờ.
6. `POST /api/bookings` với `holdId` → nhận `bookingCode` + `paymentInfo` (QR). Bản nháp tự xóa.
7. Thanh toán cọc: bấm **VNPay** → `POST /api/payments/vnpay` → `window.location.href = paymentUrl` → trang kết quả gọi `GET /api/payments/vnpay/return${location.search}`. Hoặc chuyển khoản QR → `POST /api/payments` → admin `PUT /api/payments/:id/confirm`.
8. Khách xem/đổi/hủy trong "Lịch của tôi" (`GET /api/bookings/my`).
