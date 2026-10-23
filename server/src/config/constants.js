// Các quy định nghiệp vụ của studio, đổi ở đây là áp dụng cho toàn bộ server
module.exports = {
  TIMEZONE_OFFSET: "+07:00",

  // Giờ mở cửa studio, chia thành các ô 30 phút
  OPEN_TIME: "08:00",
  CLOSE_TIME: "20:00",
  SLOT_STEP_MINUTES: 30,
  MAX_DAYS_AHEAD: 90,

  HOLD_MINUTES: 10,
  MIN_LEAD_HOURS: 2,             // Phải đặt trước giờ chụp ít nhất 2 tiếng
  DEPOSIT_RATE: 0.3,
  DEPOSIT_DEADLINE_HOURS: 24,    // Quá 24h chưa cọc thì đơn tự hủy để nhả slot
  RESCHEDULE_MIN_HOURS: 24,
  MAX_RESCHEDULES: 2,
  REFUND_MIN_HOURS: 48,

  // Ký Ức Xu: hoàn thành buổi chụp được 1 xu cho mỗi 10.000đ thanh toán
  POINT_PER_VND: 10000,

  ROLES: { CUSTOMER: "customer", ADMIN: "admin" },

  // Đăng nhập & bản nháp đặt lịch
  AUTH_COOKIE: "kyuc_token",
  DRAFT_COOKIE: "kyuc_draft",
  REMEMBER_DAYS: 30,      // Tick "Lưu đăng nhập"
  SESSION_HOURS: 24,      // Không tick: token sống 24h, cookie mất khi tắt trình duyệt
  DRAFT_DAYS: 7,          // Bản nháp đặt lịch tự xóa sau 7 ngày không cập nhật

  BOOKING_STATUS: {
    PENDING: "Pending",       // Đã tạo đơn, chờ thanh toán cọc
    CONFIRMED: "Confirmed",   // Studio đã nhận cọc
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No_Show"
  },

  PAYMENT_STATUS: {
    UNPAID: "Unpaid",
    DEPOSIT_PAID: "Deposit_Paid",
    FULLY_PAID: "Fully_Paid",
    REFUNDED: "Refunded",
    LOST_DEPOSIT: "Lost_Deposit"
  },

  PAYMENT_METHODS: ["bank_transfer", "momo", "cash"],
  PAYMENT_TYPES: ["deposit", "remaining"]
};
