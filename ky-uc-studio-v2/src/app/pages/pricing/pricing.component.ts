import { Component } from '@angular/core';

interface PricingTier {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  highlighted?: boolean;
  features: string[];
}

interface AddOnService {
  name: string;
  price: string;
  desc: string;
}

@Component({
  selector: 'app-pricing',
  standalone: false,
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css'
})
export class PricingComponent {
  // Gói chụp Chân dung
  portraitTiers: PricingTier[] = [
    {
      id: 'p-std',
      name: 'Tiêu chuẩn',
      subtitle: 'Ghi lại một khoảnh khắc đẹp — nhẹ nhàng, trọn vẹn',
      price: '1.500.000đ',
      features: [
        '1 layout makeup và làm tóc dành cho nữ',
        '1 layout trang phục của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '15 ảnh chỉnh sửa kỹ lưỡng (Retouch chuyên sâu)',
        '1 giờ chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Trả toàn bộ file ảnh gốc trong ngày'
      ]
    },
    {
      id: 'p-adv',
      name: 'Nâng cao',
      subtitle: 'Kể câu chuyện của bạn qua từng khung hình tinh tế',
      price: '2.500.000đ',
      highlighted: true,
      features: [
        '1 layout makeup và làm tóc cao cấp dành cho nữ',
        '2 layout trang phục của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '30 ảnh chỉnh sửa kỹ lưỡng',
        '1 giờ 30 phút chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Trả toàn bộ file ảnh gốc trong ngày'
      ]
    },
    {
      id: 'p-vip',
      name: 'Cao cấp',
      subtitle: 'Tác phẩm để lưu giữ — không chỉ cho hôm nay',
      price: '3.800.000đ',
      features: [
        '1 layout makeup và làm tóc CAO CẤP dành cho nữ',
        '3 layout trang phục của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '50 ảnh chỉnh sửa kỹ lưỡng',
        '2 giờ chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Trả toàn bộ file ảnh gốc trong ngày'
      ]
    }
  ];

  // Gói chụp Cặp đôi
  coupleTiers: PricingTier[] = [
    {
      id: 'c-std',
      name: 'Tiêu chuẩn',
      subtitle: 'Ghi lại một khoảnh khắc đẹp — nhẹ nhàng, trọn vẹn',
      price: '2.200.000đ',
      features: [
        '1 layout makeup và làm tóc dành cho nữ',
        '1 layout trang phục đôi của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '20 ảnh chỉnh sửa kỹ lưỡng',
        '1 giờ 30 phút chụp cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Trả toàn bộ file ảnh gốc trong ngày'
      ]
    },
    {
      id: 'c-adv',
      name: 'Nâng cao',
      subtitle: 'Kể câu chuyện của bạn qua từng khung hình tinh tế',
      price: '3.500.000đ',
      highlighted: true,
      features: [
        '1 layout makeup và làm tóc dành cho nữ',
        '2 layout trang phục đôi của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '45 ảnh chỉnh sửa kỹ lưỡng',
        '2 giờ chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Trả toàn bộ file ảnh gốc trong ngày'
      ]
    },
    {
      id: 'c-vip',
      name: 'Cao cấp',
      subtitle: 'Tác phẩm để lưu giữ — không chỉ cho hôm nay',
      price: '5.200.000đ',
      features: [
        '1 layout makeup và làm tóc CAO CẤP dành cho nữ',
        '3 layout trang phục đôi của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '65 ảnh chỉnh sửa kỹ lưỡng',
        '2 giờ 30 phút chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Trả toàn bộ file ảnh gốc trong ngày'
      ]
    }
  ];

  // Gói chụp Gia đình
  familyTiers: PricingTier[] = [
    {
      id: 'f-std',
      name: 'Tiêu chuẩn',
      subtitle: 'Ghi lại một khoảnh khắc đẹp — nhẹ nhàng, trọn vẹn',
      price: '3.000.000đ',
      features: [
        'Hỗ trợ tối đa 4 người',
        '1 layout makeup và làm tóc dành cho nữ',
        '1 layout trang phục của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '25 ảnh chỉnh sửa kỹ lưỡng',
        '1 giờ 30 phút chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc'
      ]
    },
    {
      id: 'f-adv',
      name: 'Nâng cao',
      subtitle: 'Kể câu chuyện của bạn qua từng khung hình tinh tế',
      price: '4.500.000đ',
      highlighted: true,
      features: [
        'Hỗ trợ tối đa 5 người',
        '1 layout makeup và làm tóc dành cho nữ',
        '2 layout trang phục của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '50 ảnh chỉnh sửa kỹ lưỡng',
        '2 giờ chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc'
      ]
    },
    {
      id: 'f-vip',
      name: 'Cao cấp',
      subtitle: 'Tác phẩm để lưu giữ — không chỉ cho hôm nay',
      price: '6.800.000đ',
      features: [
        'Hỗ trợ tối đa 6 người',
        '1 layout makeup và làm tóc CAO CẤP dành cho các thành viên',
        'Layout trang phục của Ký Ức chuẩn bị & phụ kiện kèm theo concept',
        '75 ảnh chỉnh sửa kỹ lưỡng',
        '2 giờ 30 phút chụp ảnh cùng ekip KUS',
        'Dịch vụ chăm sóc trước buổi chụp (đắp mặt nạ & massage chân)',
        'Ekip hỗ trợ tạo dáng, chọn góc xuyên suốt buổi chụp',
        'Không gian và bối cảnh chụp',
        'Toàn bộ ảnh gốc',
        'Xây dựng storyboard theo câu chuyện của gia đình'
      ]
    }
  ];

  // 5 Dịch vụ giá trị gia tăng
  addOns: AddOnService[] = [
    {
      name: 'Thuê thêm trang phục Việt phục cách tân',
      price: '150.000 / bộ / buổi',
      desc: 'Trang phục được thiết kế riêng, kết hợp họa tiết truyền thống với form dáng hiện đại, đa dạng kích cỡ và phong cách.'
    },
    {
      name: 'Trang điểm và làm tóc chuyên sâu',
      price: '300.000 / người',
      desc: 'Áp dụng cho khách hàng sử dụng gói Tiêu Chuẩn nhưng có nhu cầu nâng cấp phần trang điểm theo concept đặc biệt.'
    },
    {
      name: 'Thuê bối cảnh studio theo giờ',
      price: '400.000 / giờ',
      desc: 'Dành cho các đơn vị sản xuất hình ảnh bên ngoài hoặc khách hàng có nhu cầu tự thực hiện buổi chụp với ê-kíp riêng.'
    },
    {
      name: 'Album photobook cao cấp',
      price: 'Từ 450.000 / cuốn',
      desc: 'In ấn chất lượng cao trên giấy mỹ thuật, bìa da hoặc bìa vải tùy chọn, số trang và kích thước theo yêu cầu.'
    },
    {
      name: 'Khung ảnh gỗ nghệ thuật',
      price: 'Từ 200.000 / khung',
      desc: 'Khung ảnh thủ công, nhiều kích thước, phù hợp trưng bày hoặc làm quà tặng lưu niệm.'
    }
  ];

  // Consultation Form (Frame 46)
  consultForm = {
    fullName: '',
    phone: '',
    favoriteConcept: '',
    conceptIdea1: '',
    conceptIdea2: ''
  };
  formSuccess: boolean = false;

  scrollTo(elementId: string): void {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  submitConsult(): void {
    if (!this.consultForm.fullName || !this.consultForm.phone) {
      alert('Vui lòng nhập Họ tên và Số điện thoại để Ký Ức liên hệ lại!');
      return;
    }
    this.formSuccess = true;
    setTimeout(() => {
      alert('Ký Ức Studio đã ghi nhận thông tin! Ekip sẽ liên hệ lại với bạn trong vòng 30 phút.');
      this.consultForm = {
        fullName: '',
        phone: '',
        favoriteConcept: '',
        conceptIdea1: '',
        conceptIdea2: ''
      };
      this.formSuccess = false;
    }, 400);
  }
}
