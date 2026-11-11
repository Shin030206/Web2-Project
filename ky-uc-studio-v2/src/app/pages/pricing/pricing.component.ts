import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { PackageService } from '../../services/package.service';
import { Package } from '../../models/package.model';
import { formatDuration, formatVnd } from '../../utils/format';

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
export class PricingComponent implements OnInit {
  private packageService = inject(PackageService);
  private cdr = inject(ChangeDetectorRef);

  // Giá, thời lượng, quyền lợi lấy từ MongoDB (/api/packages, /api/addons)
  portraitTiers: PricingTier[] = [];
  coupleTiers: PricingTier[] = [];
  familyTiers: PricingTier[] = [];
  addOns: AddOnService[] = [];

  // Câu giới thiệu ngắn theo cấp gói (nội dung marketing, không phải dữ liệu)
  private readonly levelSubtitles: { [level: string]: string } = {
    'tiêu chuẩn': 'Ghi lại một khoảnh khắc đẹp — nhẹ nhàng, trọn vẹn',
    'nâng cao': 'Kể câu chuyện của bạn qua từng khung hình tinh tế',
    'cao cấp': 'Tác phẩm để lưu giữ — không chỉ cho hôm nay'
  };
  private readonly levelOrder = ['tiêu chuẩn', 'nâng cao', 'cao cấp'];

  ngOnInit(): void {
    this.packageService.getPackages().subscribe({
      next: (pkgs) => {
        const active = (pkgs || []).filter(p => (p.status || 'ACTIVE') === 'ACTIVE');
        this.portraitTiers = this.buildTiers(active, 'chân dung');
        this.coupleTiers = this.buildTiers(active, 'cặp đôi');
        this.familyTiers = this.buildTiers(active, 'gia đình');
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });

    this.packageService.getAddons().subscribe({
      next: (addons) => {
        this.addOns = (addons || [])
          .filter(a => (a.status || 'ACTIVE') === 'ACTIVE')
          .map(a => ({
            name: a.addon_name,
            price: formatVnd(a.price, false) + (a.unit ? ` / ${a.unit}` : ''),
            desc: a.description || ''
          }));
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  private buildTiers(pkgs: Package[], category: string): PricingTier[] {
    return pkgs
      .filter(p => (p.category || '').toLowerCase() === category)
      .sort((a, b) => this.levelIndex(a.level) - this.levelIndex(b.level) || (a.price || 0) - (b.price || 0))
      .map(p => {
        const level = (p.level || '').toLowerCase();
        const duration = formatDuration(p.duration_minutes);
        return {
          id: String(p.package_id),
          name: p.level || p.package_name || '',
          subtitle: this.levelSubtitles[level] || p.description || '',
          price: formatVnd(p.price),
          highlighted: level === 'nâng cao',
          features: [...(duration ? [`${duration} chụp ảnh cùng ekip KUS`] : []), ...(p.includes || [])]
        };
      });
  }

  private levelIndex(level?: string): number {
    const i = this.levelOrder.indexOf((level || '').toLowerCase());
    return i === -1 ? this.levelOrder.length : i;
  }

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
