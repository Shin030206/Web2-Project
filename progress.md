# Tiến độ Dự án Ký Ức Studio (Web Nâng Cao)

## Trạng thái hiện tại: ĐỒNG BỘ 100% GIAO DIỆN VÀ CAROUSEL SLIDER THEO FIGMA

### 1. Phân hệ Trang chủ (`03.01 Home` - Figma `64:26` & `❖ Slider` `82:158`)
- **Carousel Hero Slider tự động chuyển động**:
  - Tích hợp 3 slide chất lượng cao gốc từ `public/assets/03.01. Home/Hero/` (`Hero.png`, `Hero 1.png`, `Hero 2.png`).
  - Tự động chuyển slide sau mỗi 5 giây (`setInterval`).
  - Hỗ trợ dừng chuyển động khi rê chuột (`mouseenter`) và tiếp tục khi rời chuột (`mouseleave`).
  - Có 2 nút mũi tên điều hướng trái/phải (`prevSlide()`, `nextSlide()`) dạng kính mờ glassmorphism.
  - Có thanh chấm tròn chỉ báo slide (`slider-dots`) tương tác mượt mà (`goToSlide()`).
- **Phần Giới thiệu**:
  - Khung ảnh lồng viền kép nghệ thuật (`Về chúng tôi.jpg`).
  - 2 đoạn văn xuôi và nút `[ Khám phá gói dịch vụ ↗ ]` liên kết đến `/bang-gia`.
- **Gói Dịch Vụ (Nền nâu đậm `#2D1E17`)**:
  - 3 thẻ dọc: Personal Story, Couple Story, Family Story mang ảnh thật từ `public/assets/03.01. Home/Dịch vụ/`.
  - Hiển thị giá gốc gạch ngang và giá ưu đãi, danh sách đặc quyền và nút `[ Đặt lịch gói này → ]`.
- **Bộ Sưu Tập Ánh Mắt (Lưới Mosaic 6 ảnh Figma `64:26`)**:
  - Bố trí chính xác 3 cột bất đối xứng nghệ thuật:
    - Cột 1: Ảnh dọc cao (`CD Nắng.jpg`).
    - Cột 2: 3 ảnh xếp tầng (`CP Hoàng hôn.jpg`, `CD Bên cửa.jpg`, `GD Sum vầy.jpg`).
    - Cột 3: 2 ảnh xếp tầng (`NB Thanh xuân.jpg`, `WD Phóng sự.jpg`).
  - Nút xem thêm `[ Xem bộ sưu tập ↗ ]` chuyển hướng đến `/bo-suu-tap`.
- **Form Đặt lịch tư vấn (Frame 46)**:
  - Form bo tròn viên thuốc (`pill`), nút gửi màu đồng hoàng gia `[ Để ekip liên hệ với bạn → ]`.

### 2. Phân hệ Bảng giá (`03.02 Pricing` - Figma `115:1818`)
- Tiêu đề `CÂU CHUYỆN NÀO THUỘC VỀ BẠN ?` kèm trích dẫn văn xuôi.
- 3 phân hệ cuộn dọc đầy đủ: Chân dung, Cặp đôi, Gia đình.
- Thẻ trung tâm "Nâng cao" nền vàng đồng `#9E7D4E` chữ trắng nổi bật.
- 5 thẻ capsule dịch vụ gia tăng nằm ngang và form Frame 46.

### 3. Phân hệ Bộ sưu tập (`03.07 Gallery` - Figma `147:2486`)
- 5 khối bộ sưu tập lớn đánh số `01` đến `05` kèm ảnh thật, slogan, văn xuôi và nút khám phá.

### 4. Header Navbar (`64:27`) & Footer (`85:1964`)
- Header chuẩn 3 nút `[Đăng nhập]`, `[Đăng ký]`, `[Đặt lịch]`.
- Footer 5 cột nền nâu sẫm `#38261E` chuẩn Figma.

## Cổng kiểm định chất lượng (Verification Gate)
- `ng build`: ✅ Thành công 100% trong 4.57s (Exit code: 0).
- Trình duyệt đang chạy dev-server trên cổng 4200 tự động reload và phản ánh ngay lập tức.
