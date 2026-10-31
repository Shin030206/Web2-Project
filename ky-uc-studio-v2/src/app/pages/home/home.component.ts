import { Component, OnInit, OnDestroy } from '@angular/core';

interface HeroSlide {
  image: string;
  tagline: string;
  title: string;
  description: string;
}

interface PackageHome {
  id: string;
  categoryName: string;
  englishName: string;
  oldPrice: string;
  price: string;
  image: string;
  features: string[];
}

interface MosaicPhoto {
  id: number;
  category: 'all' | 'family' | 'couple' | 'portrait';
  image: string;
  title: string;
  colClass: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  // 1. CAROUSEL SLIDER (❖ Slider Component Figma 82:158)
  heroSlides: HeroSlide[] = [
    {
      image: 'assets/03.01. Home/Hero/Hero.png',
      tagline: '— KÝ ỨC STUDIO',
      title: 'Mỗi Bức Ảnh\nLà Một Câu Chuyện',
      description: 'Lưu giữ khoảnh khắc của bạn qua ống kính nghệ thuật, nơi văn hóa Việt giao thoa cùng ánh sáng điện ảnh hiện đại.'
    },
    {
      image: 'assets/03.01. Home/Hero/Hero 1.png',
      tagline: '— KÝ ỨC STUDIO',
      title: 'Mỗi Bức Ảnh\nLà Một Câu Chuyện',
      description: 'Khám phá câu chuyện thanh xuân sâu lắng qua từng khung hình đậm chất điện ảnh hoài niệm.'
    },
    {
      image: 'assets/03.01. Home/Hero/Hero 2.png',
      tagline: '— KÝ ỨC STUDIO',
      title: 'Mỗi Bức Ảnh\nLà Một Câu Chuyện',
      description: 'Tôn vinh vẻ đẹp chân thật, mộc mạc và cảm xúc độc bản của riêng bạn trong không gian studio ấm cúng.'
    }
  ];

  currentSlideIndex: number = 0;
  slideTimer: any = null;
  autoPlayInterval: number = 5000; // 5 seconds auto transition

  // 2. SERVICE PACKAGES (Figma 64:26)
  homePackages: PackageHome[] = [
    {
      id: 'personal',
      categoryName: 'CÂU CHUYỆN CÁ NHÂN',
      englishName: 'PERSONAL STORY',
      oldPrice: '4.500.000đ',
      price: '2.500.000đ',
      image: 'assets/03.01. Home/Dịch vụ/Cá nhân.jpg',
      features: [
        '2 tiếng chụp ảnh cùng ê-kíp',
        '30 ảnh đã chỉnh sửa kỹ lưỡng',
        '1 concept trang phục chuẩn bị sẵn',
        'Makeup & hair cơ bản theo concept',
        'Studio indoor không giới hạn bối cảnh',
        '30 ảnh retouched chất lượng cao',
        'Toàn bộ file ảnh gốc trả trong ngày'
      ]
    },
    {
      id: 'couple',
      categoryName: 'CÂU CHUYỆN CẶP ĐÔI',
      englishName: 'COUPLE STORY',
      oldPrice: '5.500.000đ',
      price: '3.500.000đ',
      image: 'assets/03.01. Home/Dịch vụ/Cặp đôi.jpg',
      features: [
        '2 tiếng chụp ảnh lãng mạn',
        '30 ảnh đã chỉnh sửa kỹ lưỡng',
        '1 concept trang phục đôi',
        'Makeup & hair cơ bản cho cả hai',
        'Studio indoor & bối cảnh ngoài trời',
        '30 ảnh retouched chuyên sâu',
        'Toàn bộ file ảnh gốc trả trong ngày'
      ]
    },
    {
      id: 'family',
      categoryName: 'CÂU CHUYỆN GIA ĐÌNH',
      englishName: 'FAMILY STORY',
      oldPrice: '6.500.000đ',
      price: '4.500.000đ',
      image: 'assets/03.01. Home/Dịch vụ/Gia đình.jpg',
      features: [
        '3 tiếng chụp ảnh trọn gói',
        '50 ảnh đã chỉnh sửa kỹ lưỡng',
        'Tối đa 6 thành viên tham gia',
        'Concept gia đình ấm áp, tự nhiên',
        'Makeup & làm tóc cho 2 người lớn',
        '50 ảnh retouched chất lượng in ấn',
        'Tặng 01 ảnh ép gỗ kích thước 40×60'
      ]
    }
  ];

  // 3. MOSAIC GALLERY PREVIEW (Figma 64:26)
  selectedCategory: 'all' | 'family' | 'couple' | 'portrait' = 'all';

  allMosaicPhotos: MosaicPhoto[] = [
    {
      id: 1,
      category: 'portrait',
      image: 'assets/images/mosaic/mosaic-1.png',
      title: 'Thiếu nữ & Ánh nắng',
      colClass: 'mosaic-left-tall'
    },
    {
      id: 2,
      category: 'portrait',
      image: 'assets/images/mosaic/mosaic-2.png',
      title: 'Thiếu nữ áo dài',
      colClass: 'mosaic-left-bottom'
    },
    {
      id: 3,
      category: 'couple',
      image: 'assets/images/mosaic/mosaic-3.png',
      title: 'Hành trình thanh xuân',
      colClass: 'mosaic-mid-top'
    },
    {
      id: 4,
      category: 'portrait',
      image: 'assets/images/mosaic/mosaic-4.png',
      title: 'Ánh mắt sâu lắng',
      colClass: 'mosaic-mid-center'
    },
    {
      id: 5,
      category: 'family',
      image: 'assets/images/mosaic/mosaic-5.png',
      title: 'Đại gia đình sum vầy',
      colClass: 'mosaic-mid-bottom'
    },
    {
      id: 6,
      category: 'portrait',
      image: 'assets/images/mosaic/mosaic-6.png',
      title: 'Kỷ yếu thanh xuân',
      colClass: 'mosaic-right-top'
    },
    {
      id: 7,
      category: 'portrait',
      image: 'assets/images/mosaic/mosaic-7.png',
      title: 'Phố cổ retro',
      colClass: 'mosaic-right-mid'
    },
    {
      id: 8,
      category: 'couple',
      image: 'assets/images/mosaic/mosaic-8.png',
      title: 'Hạnh phúc ngập tràn',
      colClass: 'mosaic-right-bottom'
    }
  ];

  get filteredMosaic(): MosaicPhoto[] {
    if (this.selectedCategory === 'all') return this.allMosaicPhotos;
    return this.allMosaicPhotos.filter(p => p.category === this.selectedCategory);
  }

  // 4. CONSULTATION FORM
  consultForm = {
    fullName: '',
    phone: '',
    favoriteConcept: '',
    conceptIdea1: '',
    conceptIdea2: ''
  };

  ngOnInit(): void {
    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  startAutoPlay(): void {
    this.stopAutoPlay();
    this.slideTimer = setInterval(() => {
      this.nextSlide();
    }, this.autoPlayInterval);
  }

  stopAutoPlay(): void {
    if (this.slideTimer) {
      clearInterval(this.slideTimer);
      this.slideTimer = null;
    }
  }

  goToSlide(index: number): void {
    this.currentSlideIndex = index;
    this.startAutoPlay(); // Reset timer
  }

  nextSlide(): void {
    this.currentSlideIndex = (this.currentSlideIndex + 1) % this.heroSlides.length;
  }

  prevSlide(): void {
    this.currentSlideIndex = (this.currentSlideIndex - 1 + this.heroSlides.length) % this.heroSlides.length;
  }

  setCategory(cat: 'all' | 'family' | 'couple' | 'portrait'): void {
    this.selectedCategory = cat;
  }

  submitConsult(): void {
    if (!this.consultForm.fullName || !this.consultForm.phone) {
      alert('Vui lòng nhập Họ tên và Số điện thoại!');
      return;
    }
    alert('Ký Ức Studio đã ghi nhận thông tin! Ekip sẽ liên hệ lại với bạn trong vòng 30 phút.');
    this.consultForm = {
      fullName: '',
      phone: '',
      favoriteConcept: '',
      conceptIdea1: '',
      conceptIdea2: ''
    };
  }
}
