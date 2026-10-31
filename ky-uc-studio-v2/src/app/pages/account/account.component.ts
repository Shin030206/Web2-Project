import { Component, OnInit } from '@angular/core';
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
  status: 'PENDING' | 'DEPOSITED' | 'COMPLETED' | 'CANCELLED';
  statusText: string;
  image: string;
}

@Component({
  selector: 'app-account',
  standalone: false,
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {
  activeTab: 'overview' | 'bookings' | 'profile' | 'points' = 'overview';
  bookingFilter: 'all' | 'pending' | 'deposited' | 'completed' | 'cancelled' = 'all';

  currentUser: User | null = null;
  loading: boolean = true;
  profileSaved: boolean = false;

  // User Profile
  user = {
    name: 'Khách hàng Ký Ức',
    phone: '',
    email: '',
    points: 0,
    avatar: 'assets/images/intro-photo.png',
    membershipTier: 'Thành viên Ký Ức'
  };

  profileForm = {
    name: '',
    phone: '',
    email: '',
    newPassword: '',
    confirmPassword: ''
  };

  bookings: BookingRecord[] = [];

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

        this.loadBookings();
      },
      error: () => {
        this.loading = false;
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
            packageName: b.pricing?.packageName || 'Gói chụp nghệ thuật',
            conceptName: b.conceptCode || 'Concept Ký Ức',
            bookingDate: b.bookingDate || '',
            timeSlot: b.timeSlot || (b.startTime + ' - ' + b.endTime),
            totalPrice: b.pricing?.totalPrice || b.pricing?.totalAmount || 0,
            depositAmount: b.pricing?.depositAmount || 0,
            status: b.bookingStatus === 'CONFIRMED' ? 'DEPOSITED' : (b.bookingStatus === 'CANCELLED' ? 'CANCELLED' : (b.bookingStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING')),
            statusText: b.bookingStatus === 'CONFIRMED' ? 'Đã đặt cọc' : (b.bookingStatus === 'CANCELLED' ? 'Đã hủy' : (b.bookingStatus === 'COMPLETED' ? 'Hoàn thành' : 'Chờ cọc')),
            image: 'assets/images/gallery-bst-01.png'
          }));
        } else {
          this.bookings = [];
        }
      },
      error: () => {
        this.loading = false;
        this.bookings = [];
      }
    });
  }

  saveProfile(): void {
    this.user.name = this.profileForm.name;
    this.user.email = this.profileForm.email;
    this.profileSaved = true;
    setTimeout(() => {
      this.profileSaved = false;
    }, 3000);
  }

  setTab(tab: 'overview' | 'bookings' | 'profile' | 'points'): void {
    this.activeTab = tab;
  }

  setFilter(filter: 'all' | 'pending' | 'deposited' | 'completed' | 'cancelled'): void {
    this.bookingFilter = filter;
  }

  get filteredBookings(): BookingRecord[] {
    if (this.bookingFilter === 'all') return this.bookings;
    return this.bookings.filter(b => b.status.toLowerCase() === this.bookingFilter);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
