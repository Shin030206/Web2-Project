# language: vi
Tính năng: Đặt lịch chụp ảnh Ký Ức Studio hoàn chỉnh (E2E Cucumber BDD)
  Là một khách hàng của Ký Ức Studio
  Tôi muốn duyệt danh mục concept, xem chi tiết, chọn gói dịch vụ và đặt lịch chụp ảnh
  Để có một buổi chụp trọn vẹn và thanh toán tiền cọc an toàn, minh bạch

  Bối cảnh:
    Có máy chủ Ký Ức Studio và cơ sở dữ liệu MongoDB hoạt động bình thường

  @blackbox @e2e
  Kịch bản: [Blackbox] Toàn bộ hành trình người dùng đặt lịch concept CD Vườn hoa
    Cho Khách hàng mở trang danh mục concept và tìm thấy concept "CD02" tên "CD Vườn Hoa"
    Khi Khách hàng xem trang chi tiết của concept "CD02"
    Và Khách hàng bấm chuyển sang trang đặt lịch
    Thì Hệ thống phải hiển thị chính xác concept "CD Vườn Hoa" với ảnh "assets/03.03. Concept/Chân dung/CD Vườn hoa.png"
    Khi Khách hàng chọn gói chụp "102" trị giá 2500000 đồng
    Và Khách hàng chọn ngày chụp ngày mai và giữ khung giờ trống đầu tiên
    Thì Hệ thống phải giữ chỗ slot thành công với thời gian đếm ngược 10 phút
    Khi Khách hàng chuyển sang bước 3 thanh toán tiền cọc
    Thì Thẻ tóm tắt đơn hàng bên trái phải hiển thị concept "CD VƯỜN HOA", tổng tiền 2500000 đồng và tiền cọc 750000 đồng
    Khi Khách hàng áp dụng mã ưu đãi "KYUC2026"
    Thì Tổng tiền đơn hàng giảm còn 2400000 đồng và tiền cọc thanh toán giảm còn 720000 đồng
    Khi Khách hàng xác nhận thông tin và bấm tiếp tục thanh toán cọc
    Thì Popup modal xác nhận thông tin phải hiển thị
    Khi Khách hàng xác nhận trên popup modal
    Thì Đơn hàng được tạo thành công với mã đơn và màn hình hiển thị mã VietQR ngân hàng MB Bank

  @whitebox @validation
  Kịch bản: [Whitebox] Kiểm thử các điều kiện biên và quy tắc nghiệp vụ chặt chẽ
    Cho Khách hàng thử giữ một khung giờ đã có người giữ trước đó
    Thì Hệ thống phải từ chối với mã lỗi 409
    Cho Người dùng đăng ký tài khoản mới với mật khẩu yếu "123"
    Thì Hệ thống phải chặn lại và yêu cầu mật khẩu tối thiểu 6 ký tự
    Cho Khách hàng nhập mã giảm giá không tồn tại "INVALID_VOUCHER_XYZ"
    Thì Hệ thống phải báo lỗi "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng"
    Cho Một lượt giữ chỗ slot đã hết hạn quá 10 phút
    Thì Hệ thống không cho phép tạo đơn hàng từ lượt giữ chỗ này

  @greybox @database
  Kịch bản: [Greybox] Kiểm tra tính toàn vẹn dữ liệu trong CSDL MongoDB và giao dịch thanh toán
    Cho Một đơn hàng được tạo với mã concept "CD02", gói "102", số điện thoại "0396581067"
    Khi Truy vấn trực tiếp vào bộ sưu tập "bookingCollection" trong MongoDB
    Thì Bản ghi đơn hàng phải tồn tại với đúng concept_code "CD02" và concept_name "CD Vườn Hoa"
    Và Số tiền cọc trong CSDL phải chính xác bằng 30 phần trăm tổng tiền đơn hàng
    Và Trạng thái đơn hàng ban đầu phải là "Pending" và trạng thái thanh toán là "Unpaid"
    Khi Khách hàng thông báo đã chuyển khoản thành công
    Thì Bản ghi thanh toán phải được lưu vào "paymentCollection" với trạng thái "Pending" chờ admin duyệt

  @greybox @guest_flow
  Kịch bản: [Greybox] Khách vãng lai giữ slot rồi đăng nhập không bị mất tiến trình
    Cho Khách vãng lai chưa đăng nhập chọn concept "CD02" và lưu bản nháp đặt lịch
    Khi Khách hàng thực hiện đăng nhập vào tài khoản "12345" mật khẩu "12345"
    Thì Hệ thống tự động cấp phát token bảo mật phiên đăng nhập
    Và Khi tải lại trang đặt lịch, thông tin ngày giờ và concept đã chọn vẫn được bảo toàn nguyên vẹn
