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

## Xác thực

- Đăng nhập trả về `token`, gửi kèm header `Authorization: Bearer <token>`.
- 🔓 = ai cũng gọi được, 👤 = cần đăng nhập, 🛡️ = chỉ admin.
- Khách **không cần tài khoản** vẫn đặt lịch được. Khi đó quyền xem/đổi/hủy đơn được xác minh bằng số điện thoại đặt lịch (gửi `phone` trong body hoặc query).
- Lỗi luôn trả `{ "error": "..." }` với mã HTTP: 400 dữ liệu sai, 401 chưa đăng nhập, 403 không có quyền, 404 không tìm thấy, 409 trùng/xung đột, 410 slot giữ chỗ đã hết hạn.

## Danh sách API (prefix `/api`)

### Tài khoản – `/api/auth`
| Method | URL | Quyền | Body / ghi chú |
|---|---|---|---|
| POST | `/register` | 🔓 | `fullName, email, phone, password` → `{ token, user }`. Họ tên: chỉ chữ cái + khoảng trắng, 2–50 ký tự (tự viết hoa chữ đầu). Mật khẩu: 8–32 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt, không dấu, không khoảng trắng |
| POST | `/login` | 🔓 | `account` (email hoặc SĐT), `password` → `{ token, user }` |
| GET | `/me` | 👤 | thông tin tài khoản |
| PUT | `/me` | 👤 | `fullName, phone, email, avatar_url` |
| PUT | `/change-password` | 👤 | `oldPassword, newPassword` |
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

### Thanh toán – `/api/payments`
| Method | URL | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/` | 🔓/👤 | `{ bookingId, method: bank_transfer|momo|cash, type: deposit|remaining, transactionCode?, phone? }`. Số tiền do server tính |
| GET | `/` | 🛡️ | `?status=Pending&bookingId=` |
| PUT | `/:id/confirm` | 🛡️ | xác nhận đã nhận tiền → đơn chuyển `Confirmed` / `Fully_Paid` |
| PUT | `/:id/reject` | 🛡️ | `{ reason }` |

### Admin – `/api/admin` 🛡️
| Method | URL | Ghi chú |
|---|---|---|
| GET | `/stats?from=&to=` | số đơn theo trạng thái, doanh thu, top gói, lịch sắp tới, khách mới |
| GET | `/users?q=&role=&page=` | danh sách tài khoản |
| PATCH | `/users/:id` | `{ role?, isLocked? }` |
| POST | `/uploads` | form-data field `image` (jpg/png/webp/gif, ≤10MB) → `{ url }` |

## Luồng đặt lịch cho frontend

1. `GET /api/slots?date=...&packageId=...` → hiển thị các giờ `available`.
2. Khách chọn giờ → `POST /api/slots/hold` → lưu `holdId`, hiện đếm ngược 10 phút.
3. Khách chọn concept, dịch vụ thêm, voucher → `POST /api/bookings/quote` để hiện tổng tiền.
4. Khách điền thông tin → `POST /api/bookings` với `holdId` → nhận `bookingCode` + `paymentInfo` (QR).
5. Khách chuyển khoản → `POST /api/payments` → admin `PUT /api/payments/:id/confirm`.
6. Khách tra cứu / đổi / hủy bằng `bookingCode` + SĐT, hoặc vào "Lịch của tôi" nếu đã đăng nhập.
