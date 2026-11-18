import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { BookingService } from '../../services/booking.service';

interface BookingRecord {
  orderCode: string;
  packageName: string;
  conceptName: string;
  bookingDate: string;
  timeSlot: string;
  totalPrice: number;
  depositAmount: number;
  status: BookingUiStatus;
  statusText: string;
  image: string;
  shootForm?: string;
  note?: string;
}

type BookingUiStatus = 'PENDING' | 'DEPOSITED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Server lưu trạng thái dạng "Pending", "Confirmed", "Completed", "Cancelled", "No_Show"
// (BOOKING_STATUS trong server/src/config/constants.js). So sánh không phân biệt hoa thường.
const BOOKING_STATUS_MAP: { [serverStatus: string]: { status: BookingUiStatus; statusText: string } } = {
  pending: { status: 'PENDING', statusText: 'Chờ xác nhận' },
  confirmed: { status: 'DEPOSITED', statusText: 'Đã đặt cọc' },
  completed: { status: 'COMPLETED', statusText: 'Hoàn thành' },
  cancelled: { status: 'CANCELLED', statusText: 'Đã hủy' },
  no_show: { status: 'NO_SHOW', statusText: 'Vắng mặt' }
};

function mapBookingStatus(serverStatus?: string): { status: BookingUiStatus; statusText: string } {
  return BOOKING_STATUS_MAP[String(serverStatus || '').toLowerCase()] || BOOKING_STATUS_MAP['pending'];
}

@Component({
  selector: 'app-account',
  standalone: false,
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  activeTab: 'overview' | 'bookings' | 'booking-detail' | 'profile' | 'points' = 'overview';
  bookingFilter: 'all' | 'pending' | 'deposited' | 'completed' | 'cancelled' = 'all';
  pointFilter: 'all' | 'earn' | 'spend' = 'all';

  currentUser: User | null = null;
  loading: boolean = true;
  profileSaved: boolean = false;
  savingProfile: boolean = false;
  profileError: string = '';
  selectedBooking: BookingRecord | null = null;

  // User Profile
  user = {
    name: 'Khách hàng Ký Ức',
    phone: '',
    email: '',
    points: 1250,
    avatar: 'assets/images/intro-photo.png',
    membershipTier: 'Thành viên Ký Ức'
  };

  profileForm = {
    name: '',
    phone: '',
    email: ''
  };

  // Đổi mật khẩu (PUT /api/auth/change-password)
  passwordForm = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  changingPassword: boolean = false;
  passwordMessage: string = '';
  passwordError: string = '';

  bookings: BookingRecord[] = [];

  pointTransactions = [
    { type: 'earn', title: 'Hoàn thành buổi chụp', date: '30/10/2026 - Tích lũy sau buổi chụp', amount: '+150 Xu' },
    { type: 'spend', title: 'Đổi Voucher 100k', date: '15/10/2026 - Đổi voucher ưu đãi', amount: '-100 Xu' },
    { type: 'earn', title: 'Hoàn thành buổi chụp', date: '25/09/2026 - Tích lũy sau buổi chụp', amount: '+150 Xu' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService,
    private bookingService: BookingService
  ) {}

  ngOnInit(): void {
    this.route.url.subscribe(segments => {
      const path = segments[segments.length - 1]?.path;
      if (path === 'bookings') {
        this.activeTab = 'bookings';
      } else if (path === 'profile') {
        this.activeTab = 'profile';
      }
      this.cdr.markForCheck();
    });

    this.loadUserData();
  }

  loadUserData(): void {
    this.authService.getMe().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.user.name = user.fullName || 'Khách hàng Ký Ức';
        this.user.phone = user.phone || '';
        this.user.email = user.email || '';
        this.user.points = user.points || 0;
        this.user.membershipTier = (user.points || 0) > 500 ? 'Thành viên VIP Vàng' : ((user.points || 0) > 100 ? 'Thành viên Bạc' : 'Thành viên Mới');
        
        this.profileForm.name = this.user.name;
        this.profileForm.phone = this.user.phone;
        this.profileForm.email = this.user.email;

        this.cdr.markForCheck();
        this.loadBookings();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
        if (!this.authService.isLoggedIn) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/account' } });
        }
      }
    });
  }

  loadBookings(): void {
    this.bookingService.getMyBookings().subscribe({
      next: (res) => {
        this.loading = false;
        const list = res.data || res || [];
        if (Array.isArray(list) && list.length > 0) {
          this.bookings = list.map((b: any) => ({
            orderCode: b.bookingCode || 'KU' + (b._id || '').slice(-6),
            packageName: b.packageName || b.pricing?.packageName || 'Gói Chân dung nâng cao',
            conceptName: b.conceptName || b.conceptCode || 'Concept chụp chân dung',
            bookingDate: b.bookingDate || '30/10/2026',
            timeSlot: b.timeSlot || (b.startTime + ' – ' + b.endTime),
            totalPrice: b.pricing?.totalPrice || b.pricing?.totalAmount || 2500000,
            depositAmount: b.pricing?.depositAmount || 750000,
            ...mapBookingStatus(b.bookingStatus),
            image: b.conceptCode === 'CP01' ? 'assets/images/gallery-bst-02.png' : 'assets/images/gallery-bst-01.png',
            shootForm: b.shootForm || 'Chân dung',
            note: b.customer?.note || b.note || 'Yêu cầu concept nhẹ nhàng'
          }));
          if (!this.selectedBooking) {
            this.selectedBooking = this.bookings[0];
          }
        } else {
          this.bookings = [];
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.bookings = [];
        this.cdr.markForCheck();
      }
    });
  }

  viewBookingDetail(booking: BookingRecord): void {
    this.selectedBooking = booking;
    this.activeTab = 'booking-detail';
    this.cdr.markForCheck();
  }

  get filteredPointTransactions() {
    if (this.pointFilter === 'earn') return this.pointTransactions.filter(p => p.type === 'earn');
    if (this.pointFilter === 'spend') return this.pointTransactions.filter(p => p.type === 'spend');
    return this.pointTransactions;
  }

  // Lưu họ tên và email lên server (PUT /api/auth/me); SĐT không cho tự đổi
  saveProfile(): void {
    this.profileSaved = false;
    this.profileError = '';
    const fullName = (this.profileForm.name || '').trim();
    const email = (this.profileForm.email || '').trim();
    if (!fullName) {
      this.profileError = 'Vui lòng nhập họ và tên!';
      return;
    }

    this.savingProfile = true;
    this.authService.updateMe({ fullName, ...(email ? { email } : {}) }).subscribe({
      next: (res) => {
        this.savingProfile = false;
        const user = res?.user;
        this.user.name = user?.fullName || fullName;
        this.user.email = user?.email || email;
        this.profileForm.name = this.user.name;
        this.profileForm.email = this.user.email;
        this.profileSaved = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.profileSaved = false;
          this.cdr.markForCheck();
        }, 3000);
      },
      error: (err) => {
        this.savingProfile = false;
        this.profileError = err?.error?.error || 'Cập nhật thông tin thất bại, vui lòng thử lại!';
        this.cdr.markForCheck();
      }
    });
  }

  changePassword(): void {
    this.passwordMessage = '';
    this.passwordError = '';
    const { oldPassword, newPassword, confirmPassword } = this.passwordForm;

    if (!oldPassword || !newPassword || !confirmPassword) {
      this.passwordError = 'Vui lòng nhập đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới!';
      return;
    }
    if (newPassword !== confirmPassword) {
      this.passwordError = 'Xác nhận mật khẩu mới không khớp!';
      return;
    }

    // Server tự kiểm tra mật khẩu cũ và độ mạnh mật khẩu mới, lỗi trả về được hiện nguyên văn
    this.changingPassword = true;
    this.authService.changePassword({ oldPassword, newPassword }).subscribe({
      next: (res) => {
        this.changingPassword = false;
        this.passwordMessage = res?.message || 'Đổi mật khẩu thành công!';
        this.passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.changingPassword = false;
        this.passwordError = err?.error?.error || 'Đổi mật khẩu thất bại, vui lòng thử lại!';
        this.cdr.markForCheck();
      }
    });
  }

  setTab(tab: 'overview' | 'bookings' | 'profile' | 'points'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  setFilter(filter: 'all' | 'pending' | 'deposited' | 'completed' | 'cancelled'): void {
    this.bookingFilter = filter;
    this.cdr.markForCheck();
  }

  get filteredBookings(): BookingRecord[] {
    if (this.bookingFilter === 'all') return this.bookings;
    return this.bookings.filter(b => b.status.toLowerCase() === this.bookingFilter);
  }

  alertContact(): void {
    alert('Để hủy hoặc dời lịch chụp, quý khách vui lòng liên hệ trực tiếp hotline 0396581067 trước ít nhất 48 giờ để được hỗ trợ bảo lưu tiền cọc.');
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
