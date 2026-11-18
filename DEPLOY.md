# Deploy Ký Ức Studio

Mô hình (miễn phí):

```
Trình duyệt ──> Vercel (frontend Angular, https://<tên>.vercel.app)
                   │  /api/*, /uploads/*  (vercel.json chuyển tiếp)
                   ▼
                Render (server Node, https://ky-uc-studio-api.onrender.com)
                   │
                   ▼
                MongoDB Atlas (database đang dùng)
```

Khách chỉ thấy 1 địa chỉ là link Vercel, nên cookie đăng nhập hoạt động như khi chạy local.
Vercel và Render lấy code từ GitHub và **tự deploy lại mỗi lần push lên `main`**.

---

## Bước 0. Chuẩn bị

- Code mới nhất đã được push lên nhánh `main` trên GitHub.
- Có chuỗi kết nối MongoDB Atlas (`MONGO_URI`) đang dùng trong `server/.env`.
- **Atlas → Network Access → Add IP Address → `0.0.0.0/0` (Allow access from anywhere).**
  Render không có IP cố định nên phải mở cho mọi IP; dữ liệu vẫn được bảo vệ bằng user/mật khẩu trong `MONGO_URI`.

## Bước 1. Server trên Render

1. Vào https://render.com → **Sign in with GitHub**.
2. **New → Blueprint** → chọn repo `Web2-Project` → Render đọc file `render.yaml` ở thư mục gốc.
3. Render hỏi các biến `sync: false`, điền:

   | Biến | Giá trị |
   |---|---|
   | `MONGO_URI` | giống trong `server/.env` |
   | `DB_NAME` | `KyUcStudioDB` (tên database đang dùng trên Atlas) |
   | `CLIENT_URL` | tạm điền `https://ky-uc-studio.vercel.app`, sửa lại ở Bước 3 nếu Vercel đặt tên khác |
   | `VNP_RETURN_URL` | `https://ky-uc-studio.vercel.app/thanh-toan/ket-qua` (sửa như trên) |
   | `ADMIN_EMAIL`, `ADMIN_PHONE` | như `.env` |
   | `ADMIN_PASSWORD` | mật khẩu mạnh, hoặc để trống (chỉ dùng khi tạo admin lần đầu) |
   | `BANK_ID`, `BANK_ACCOUNT`, `BANK_ACCOUNT_NAME` | tài khoản nhận cọc chuyển khoản |
   | `VNP_TMN_CODE`, `VNP_HASH_SECRET` | mã VNPay sandbox (để trống thì nút VNPay báo chưa cấu hình) |
   | `SMTP_*`, `MAIL_FROM` | Gmail App Password để gửi OTP qua email (để trống thì OTP chỉ in trong log Render) |

   `JWT_SECRET` Render tự sinh, không cần điền. **Không ghi các giá trị này vào file nào trong repo.**
4. **Apply** → đợi build xong (3–5 phút). Mở `https://ky-uc-studio-api.onrender.com/api/packages` thấy danh sách gói là được.
   - Nếu tên `ky-uc-studio-api` đã có người dùng, Render đặt URL khác: sửa 2 dòng `destination` trong `ky-uc-studio-v2/vercel.json` theo URL mới rồi push.

## Bước 2. Frontend trên Vercel

1. Vào https://vercel.com → **Continue with GitHub**.
2. **Add New → Project** → chọn repo `Web2-Project`.
3. **Root Directory: `ky-uc-studio-v2`** (bấm Edit để chọn). Các mục build để nguyên, Vercel đọc từ `vercel.json`.
4. Project Name: `ky-uc-studio` → **Deploy** (2–3 phút).
5. Mở link Vercel, vào trang Bảng giá thấy giá là frontend đã gọi được server.

## Bước 3. Nối hai bên

1. Lấy đúng domain Vercel (vd `https://ky-uc-studio.vercel.app`).
2. Render → service → **Environment** → sửa `CLIENT_URL` và `VNP_RETURN_URL` theo domain đó → **Save** (Render tự khởi động lại).

## Bước 4. Giữ server không "ngủ"

Gói free của Render tắt server sau 15 phút không ai dùng, lần vào đầu tiên phải chờ 30–60 giây.
Vào https://cron-job.org (miễn phí) → tạo job gọi `https://ky-uc-studio-api.onrender.com/` **mỗi 10 phút**.

## Bước 5. Kiểm tra

- [ ] Mở thẳng `https://<vercel>/dat-lich` và `/concept/cd02` (không bị 404).
- [ ] Đăng ký, đăng nhập, F5 vẫn còn đăng nhập.
- [ ] Đặt lịch, tạo đơn; admin thấy đơn mới ở `/admin`.
- [ ] Quên mật khẩu: nhận OTP qua email (hoặc xem trong Render → Logs nếu chưa cấu hình SMTP).
- [ ] VNPay sandbox (nếu đã điền mã): thanh toán bằng thẻ NCB test, quay về web báo thành công.

## Lưu ý

- **Ảnh admin upload** lưu trên ổ đĩa của Render và **mất mỗi lần deploy lại** (giới hạn gói free). Ảnh có sẵn trong repo không bị ảnh hưởng.
- Đổi code: push lên `main` là Vercel và Render tự deploy lại. Mỗi PR còn có link xem thử riêng trên Vercel.
- Không cần chạy seed: server dùng chung database Atlas đang có dữ liệu.
- Xem lỗi server: Render → service → **Logs**.
