// Định dạng tiền và thời lượng dùng chung cho các trang lấy dữ liệu từ API

// 1500000 -> "1.500.000đ" (withSymbol = false -> "1.500.000")
export function formatVnd(value?: number | null, withSymbol = true): string {
  if (value === undefined || value === null || isNaN(Number(value))) return '';
  const text = Number(value).toLocaleString('vi-VN');
  return withSymbol ? `${text}đ` : text;
}

// 90 -> "1 giờ 30 phút", 60 -> "1 giờ", 45 -> "45 phút"
export function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} giờ ${m} phút`;
  if (h) return `${h} giờ`;
  return `${m} phút`;
}
