import { Component } from '@angular/core';

interface TeamMember {
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

interface CoreValue {
  title: string;
  desc: string;
  icon: string;
}

@Component({
  selector: 'app-about',
  standalone: false,
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent {
  // Stats from Figma 198:3066
  stats = [
    { value: '200+', label: 'Đánh giá 5 sao' },
    { value: '4.8/5', label: 'Điểm đánh giá' },
    { value: '96%', label: 'Khách hàng hài lòng' }
  ];

  // Team Members from Figma 198:3066
  teamMembers: TeamMember[] = [
    {
      name: 'Nguyễn Thị Thu Hồng',
      role: 'Giám đốc Nghệ thuật & Sáng lập',
      avatar: 'assets/images/team-hong.png',
      bio: 'Người thổi hồn vào từng bối cảnh mang đậm văn hóa và chiều sâu hoài niệm.'
    },
    {
      name: 'Trương Thanh Phong',
      role: 'Nhiếp ảnh gia Trưởng & Ánh sáng',
      avatar: 'assets/images/team-phong.png',
      bio: 'Hơn 8 năm kinh nghiệm ghi lại những khoảnh khắc điện ảnh chân thật nhất.'
    },
    {
      name: 'Nguyễn Ngọc Khánh',
      role: 'Đạo diễn Concept & Tạo hình',
      avatar: 'assets/images/team-khanh.png',
      bio: 'Chuyên gia nghiên cứu và cách điệu cổ phục Việt Nam trong không gian đương đại.'
    },
    {
      name: 'Trần Tuấn Kiệt',
      role: 'Kỹ thuật Công nghệ & Trải nghiệm Số',
      avatar: 'assets/images/team-kiet.png',
      bio: 'Kiến tạo nền tảng số hóa đặt lịch thông minh, tiện lợi cho khách hàng.'
    },
    {
      name: 'Võ Thị Thanh Vy',
      role: 'Chuyên gia Tạo mẫu & Hậu kỳ Mỹ thuật',
      avatar: 'assets/images/team-vy.png',
      bio: 'Chăm chút tỉ mỉ từng layout makeup, ánh mắt và phom dáng tự nhiên của khách hàng.'
    }
  ];

  // Core Values from Figma 198:3066
  coreValues: CoreValue[] = [
    {
      title: 'TẬN TÂM',
      desc: 'Mỗi khách hàng là một câu chuyện riêng cần được kể bằng tất cả sự tận tụy.',
      icon: 'heart'
    },
    {
      title: 'SÁNG TẠO',
      desc: 'Không ngừng đổi mới concept, bắt kịp xu hướng để mang đến trải nghiệm độc đáo.',
      icon: 'lightbulb'
    },
    {
      title: 'CHẤT LƯỢNG',
      desc: 'Từ makeup, trang phục đến hậu kỳ — mọi khâu đều đạt tiêu chuẩn cao nhất.',
      icon: 'star'
    },
    {
      title: 'ẤM ÁP',
      desc: 'Không gian thân thiện giúp bạn tự tin tỏa sáng trước ống kính.',
      icon: 'sparkles'
    }
  ];
}

