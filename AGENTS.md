# Ký Ức Studio — Project Agent Harness

Dự án Web Kinh Doanh Nâng Cao (Khoa HTTT - UEL) theo giáo trình TS. Trần Duy Thanh kết hợp thiết kế Figma chính xác 100%.

## 1. Kiến trúc hệ thống (Monorepo)
- **Frontend**: `ky-uc-studio-v2/` (Angular 22, TypeScript, RxJS, Vitest)
  - Port phát triển: `http://localhost:4200`
  - Proxy API: `proxy.conf.json` chuyển tiếp các request `/api/` hoặc `/packages`, `/bookings`, `/slots`, `/payments` sang backend port 3005.
- **Backend**: `server/` (Node.js, Express, MongoDB Atlas / Local MongoDB `KyUcStudioDB`)
  - Port dịch vụ: `http://localhost:3005`
  - Các collection MongoDB: `packages`, `bookings`, `holdSlots`, `payments`.

## 2. Nguồn tham chiếu kỹ thuật & Chuẩn bài học (Web2_Slides_VN)
- **Module 1 - 3 (Angular Binding & Forms)**:
  - Property Binding `[src]`, Class Binding `[class.active]`, Style Binding `[style.color]`, Event Binding `(click)`.
  - Two-way binding `[(ngModel)]` với `FormsModule` hoặc `ReactiveFormsModule` có validation đầy đủ.
- **Module 4 & 6 (Services & MongoDB RESTful API)**:
  - Dùng `HttpClient`, `HttpHeaders`, RxJS operators `retry(3)`, `catchError()`, `Observable`.
  - Service trả về Typed Models (`Package`, `Booking`, `Slot`, `Payment`).
  - Backend sử dụng chuẩn MongoDB Driver: `MongoClient`, `ObjectId`, `find()`, `findOne()`, `insertOne()`, `updateOne()`.

## 3. Quy chuẩn Design Tokens Figma (Bắt buộc 100% Pixel & Token)
- **Figma Canvas**: `03 Public Website` (Node ID: `1:78`)
- **Color Palette**:
  - Primary Bronze/Gold: `#A68A5B` (Buttons, Viền ảnh nghệ thuật, Highlight)
  - Dark Espresso (Chữ chính): `#5C4840` / `#473833`
  - Deep Charcoal (Nền tối Hero/Footer): `#2B211D`
  - Cream Background (Nền sáng): `#FAF9F6` / `#F7F3EE`
  - White Surface: `#FFFFFF`
- **Typography**:
  - Tiêu đề nghệ thuật (H1, H2): `'Playfair Display', Georgia, serif` (56px, 40px, 32px, 24px)
  - Văn bản phụ & Nội dung: `'Inter', 'Poppins', sans-serif` (14px, 16px, line-height 1.6)
  - Tagline danh mục: `'Inter', sans-serif`, 13px, font-weight 600, letter-spacing: 2px
- **Border Radius**:
  - Buttons & Cards: `16px`
  - Badges & Sub-elements: `8px`

## 4. Lệnh kiểm thử & Xác thực (Verification Gates)
Mọi thay đổi code phải pass các cổng xác thực sau trước khi đánh dấu hoàn thành:
1. **Kiểm tra biên dịch Frontend**:
   ```bash
   cd ky-uc-studio-v2 && npm run build
   ```
2. **Kiểm tra Backend Syntax & Run**:
   ```bash
   cd server && node -c index.js
   ```
3. **Độ chính xác UI so với Figma**:
   - Đối chiếu trực tiếp với screenshot canvas node `1:78` (file `scratch/figma_1_78.png`).

## 5. Quy tắc thực thi (Ponytail & Matt Pocock)
- Áp dụng triệt để TDD và YAGNI: Viết code tối giản vừa đủ đáp ứng giao diện Figma và nghiệp vụ MongoDB.
- Tuyệt đối không xóa logic backend đã có trong `server/src/controllers`.
