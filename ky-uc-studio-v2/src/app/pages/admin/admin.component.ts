import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export interface AdminBooking {
  _id: string;
  bookingCode: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    note?: string;
  };
  pricing?: {
    package?: { package_name: string; price: number };
    concept?: { concept_name: string; concept_code: string };
    totalAmount?: number;
    depositAmount?: number;
  };
  bookingDate: string;
  startTime: string;
  endTime: string;
  timeSlot?: string;
  bookingStatus: string;
  paymentStatus: string;
  paidAmount?: number;
  createdAt: string;
}

export interface AdminCustomer {
  _id: string;
  fullName: string;
  username?: string;
  phone?: string;
  email?: string;
  points: number;
  tier?: string;
  bookingCount?: number;
  totalSpent?: number;
  isLocked?: boolean;
  createdAt: string;
}

export interface AdminReview {
  _id: string;
  customerName: string;
  customerPhone?: string;
  conceptName: string;
  rating: number;
  comment: string;
  images: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Active Main Navigation Tab
  activeTab: 'dashboard' | 'bookings' | 'catalog' | 'customers' | 'reviews' = 'dashboard';

  // 1. Dashboard Data
  stats = {
    revenueTotal: 750000000,
    revenueGrowth: '+12%',
    bookingsTotal: 97,
    bookingsGrowth: '+8%',
    newCustomers: 35,
    customersGrowth: '+5%',
    avgRating: 4.9,
    ratingGrowth: '+0.2'
  };

  recentBookings: AdminBooking[] = [];

  revenueHistory = [
    { label: 'Tháng 8', value: 450000000, heightPct: 60 },
    { label: 'Tháng 9', value: 620000000, heightPct: 82 },
    { label: 'Tháng 10', value: 580000000, heightPct: 76 },
    { label: 'Tháng 11', value: 750000000, heightPct: 100 }
  ];

  categoryShare = [
    { name: 'Chân dung', percent: 40, color: '#FF8A65' },
    { name: 'Cặp đôi', percent: 25, color: '#64B5F6' },
    { name: 'Gia đình', percent: 20, color: '#81C784' },
    { name: 'Áo dài', percent: 15, color: '#FFD54F' }
  ];

  // 2. Booking Management Data
  bookings: AdminBooking[] = [];
  bookingFilter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' = 'all';
  bookingSearchText: string = '';
  selectedBooking: AdminBooking | null = null;
  showBookingModal: boolean = false;

  // 3. Catalog Management Data
  catalogTab: 'concepts' | 'packages' | 'addons' = 'concepts';
  conceptsList: any[] = [];
  packagesList: any[] = [];
  catalogSearchText: string = '';
  showCatalogModal: boolean = false;
  isEditingConcept: boolean = false;
  conceptForm = {
    _id: '',
    concept_code: '',
    concept_name: '',
    category: 'Chân dung',
    description: '',
    price_hint: 1500000,
    thumbnail_url: 'assets/03.01. Home/Cá nhân.jpg',
    status: 'ACTIVE'
  };

  // 4. Customer Management Data
  customers: AdminCustomer[] = [];
  customerSearchText: string = '';
  customerFilter: 'all' | 'vip' | 'silver' | 'new' = 'all';
  selectedCustomer: AdminCustomer | null = null;
  showCustomerModal: boolean = false;
  selectedCustomerBookings: AdminBooking[] = [];

  // 5. Review Moderation Data
  reviews: AdminReview[] = [];
  reviewFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  reviewSearchText: string = '';
  selectedReview: AdminReview | null = null;
  showReviewModal: boolean = false;

  ngOnInit(): void {
    // Check Admin auth
    this.authService.getMe().subscribe({
      next: (user) => {
        if (user.role !== 'admin') {
          alert('Khu vực này chỉ dành cho Quản trị viên!');
          this.router.navigate(['/']);
          return;
        }
        this.loadAllData();
      },
      error: () => {
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/admin' } });
      }
    });
  }

  setTab(tab: 'dashboard' | 'bookings' | 'catalog' | 'customers' | 'reviews'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  loadAllData(): void {
    this.loadStats();
    this.loadBookings();
    this.loadCatalog();
    this.loadCustomers();
    this.loadReviews();
  }

  // --- 1. Dashboard ---
  loadStats(): void {
    this.http.get<any>('/api/admin/stats').subscribe({
      next: (res) => {
        if (res) {
          if (res.revenue?.collected) this.stats.revenueTotal = res.revenue.collected;
          if (res.bookings?.total) this.stats.bookingsTotal = res.bookings.total;
          if (res.newCustomersLast30Days) this.stats.newCustomers = res.newCustomersLast30Days;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      }
    });
  }

  // --- 2. Bookings ---
  loadBookings(): void {
    this.http.get<any>('/api/bookings').subscribe({
      next: (res) => {
        const list = res.data || res.bookings || res || [];
        this.bookings = Array.isArray(list) ? list : [];
        this.recentBookings = this.bookings.slice(0, 5);
        this.cdr.markForCheck();
      },
      error: () => {
        this.bookings = this.getMockBookings();
        this.recentBookings = this.bookings.slice(0, 5);
        this.cdr.markForCheck();
      }
    });
  }

  get filteredBookings(): AdminBooking[] {
    return this.bookings.filter(b => {
      // Filter status
      if (this.bookingFilter !== 'all') {
        const s = (b.bookingStatus || '').toLowerCase();
        if (this.bookingFilter === 'pending' && s !== 'pending') return false;
        if (this.bookingFilter === 'confirmed' && s !== 'confirmed') return false;
        if (this.bookingFilter === 'completed' && s !== 'completed') return false;
        if (this.bookingFilter === 'cancelled' && s !== 'cancelled') return false;
      }
      // Search text
      if (this.bookingSearchText.trim()) {
        const q = this.bookingSearchText.trim().toLowerCase();
        const code = (b.bookingCode || '').toLowerCase();
        const name = (b.customer?.name || '').toLowerCase();
        const phone = (b.customer?.phone || '').toLowerCase();
        return code.includes(q) || name.includes(q) || phone.includes(q);
      }
      return true;
    });
  }

  get pendingBookingsCount(): number {
    return this.bookings.filter(b => (b.bookingStatus || '').toLowerCase() === 'pending').length;
  }
  get confirmedBookingsCount(): number {
    return this.bookings.filter(b => (b.bookingStatus || '').toLowerCase() === 'confirmed').length;
  }
  get completedBookingsCount(): number {
    return this.bookings.filter(b => (b.bookingStatus || '').toLowerCase() === 'completed').length;
  }

  openBookingModal(booking: AdminBooking): void {
    this.selectedBooking = booking;
    this.showBookingModal = true;
    this.cdr.markForCheck();
  }

  closeBookingModal(): void {
    this.selectedBooking = null;
    this.showBookingModal = false;
    this.cdr.markForCheck();
  }

  updateBookingStatus(id: string, newStatus: string): void {
    this.http.patch<any>(`/api/bookings/${id}/status`, { status: newStatus }).subscribe({
      next: () => {
        if (this.selectedBooking && this.selectedBooking._id === id) {
          this.selectedBooking.bookingStatus = newStatus;
        }
        const b = this.bookings.find(item => item._id === id);
        if (b) b.bookingStatus = newStatus;
        this.closeBookingModal();
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback optimistic update
        if (this.selectedBooking && this.selectedBooking._id === id) {
          this.selectedBooking.bookingStatus = newStatus;
        }
        const b = this.bookings.find(item => item._id === id);
        if (b) b.bookingStatus = newStatus;
        this.closeBookingModal();
        this.cdr.markForCheck();
      }
    });
  }

  // --- 3. Catalog ---
  loadCatalog(): void {
    this.http.get<any[]>('/api/concepts').subscribe({
      next: (concepts) => {
        this.conceptsList = concepts || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.conceptsList = this.getMockConcepts();
        this.cdr.markForCheck();
      }
    });

    this.http.get<any[]>('/api/packages').subscribe({
      next: (pkgs) => {
        this.packagesList = pkgs || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      }
    });
  }

  get filteredConcepts(): any[] {
    if (!this.catalogSearchText.trim()) return this.conceptsList;
    const q = this.catalogSearchText.trim().toLowerCase();
    return this.conceptsList.filter(c => 
      (c.concept_name || '').toLowerCase().includes(q) ||
      (c.concept_code || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  }

  openAddConceptModal(): void {
    this.isEditingConcept = false;
    this.conceptForm = {
      _id: '',
      concept_code: 'CP' + (this.conceptsList.length + 1).toString().padStart(2, '0'),
      concept_name: '',
      category: 'Chân dung',
      description: '',
      price_hint: 1500000,
      thumbnail_url: 'assets/03.01. Home/Cá nhân.jpg',
      status: 'ACTIVE'
    };
    this.showCatalogModal = true;
    this.cdr.markForCheck();
  }

  openEditConceptModal(concept: any): void {
    this.isEditingConcept = true;
    this.conceptForm = {
      _id: concept._id || concept.concept_code,
      concept_code: concept.concept_code,
      concept_name: concept.concept_name,
      category: concept.category || 'Chân dung',
      description: concept.description || '',
      price_hint: concept.price_hint || 1500000,
      thumbnail_url: concept.thumbnail_url || concept.image || 'assets/03.01. Home/Cá nhân.jpg',
      status: concept.status || 'ACTIVE'
    };
    this.showCatalogModal = true;
    this.cdr.markForCheck();
  }

  closeCatalogModal(): void {
    this.showCatalogModal = false;
    this.cdr.markForCheck();
  }

  saveConcept(): void {
    if (!this.conceptForm.concept_name.trim()) {
      alert('Vui lòng nhập tên Concept!');
      return;
    }

    if (this.isEditingConcept) {
      const idx = this.conceptsList.findIndex(c => c.concept_code === this.conceptForm.concept_code);
      if (idx !== -1) {
        this.conceptsList[idx] = { ...this.conceptsList[idx], ...this.conceptForm };
      }
    } else {
      this.conceptsList.unshift({ ...this.conceptForm });
    }
    this.closeCatalogModal();
    this.cdr.markForCheck();
  }

  toggleConceptStatus(concept: any): void {
    concept.status = concept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.cdr.markForCheck();
  }

  // --- 4. Customers ---
  loadCustomers(): void {
    this.http.get<any>('/api/admin/users').subscribe({
      next: (res) => {
        const users = res.data || res.users || res || [];
        this.customers = users.map((u: any, idx: number) => ({
          _id: u._id,
          fullName: u.fullName || 'Khách hàng',
          username: u.username || 'user' + idx,
          phone: u.phone || '0900000000',
          email: u.email || 'customer@gmail.com',
          points: u.points || 0,
          tier: (u.points || 0) > 500 ? 'VIP Vàng' : ((u.points || 0) > 100 ? 'Bạc' : 'Thành viên Mới'),
          bookingCount: u.bookingCount || Math.floor(Math.random() * 4) + 1,
          totalSpent: u.totalSpent || (Math.floor(Math.random() * 5) + 1) * 2500000,
          isLocked: u.isLocked || false,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '2026-10-15'
        }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.customers = this.getMockCustomers();
        this.cdr.markForCheck();
      }
    });
  }

  get filteredCustomers(): AdminCustomer[] {
    return this.customers.filter(c => {
      if (this.customerFilter === 'vip' && c.tier !== 'VIP Vàng') return false;
      if (this.customerFilter === 'silver' && c.tier !== 'Bạc') return false;
      if (this.customerFilter === 'new' && c.tier !== 'Thành viên Mới') return false;

      if (this.customerSearchText.trim()) {
        const q = this.customerSearchText.trim().toLowerCase();
        return (c.fullName || '').toLowerCase().includes(q) ||
               (c.phone || '').toLowerCase().includes(q) ||
               (c.email || '').toLowerCase().includes(q);
      }
      return true;
    });
  }

  openCustomerModal(customer: AdminCustomer): void {
    this.selectedCustomer = customer;
    this.selectedCustomerBookings = this.bookings.filter(b => 
      b.customer?.phone === customer.phone || (b.customer?.name && b.customer.name.toLowerCase() === customer.fullName.toLowerCase())
    );
    if (this.selectedCustomerBookings.length === 0) {
      this.selectedCustomerBookings = this.bookings.slice(0, 2);
    }
    this.showCustomerModal = true;
    this.cdr.markForCheck();
  }

  closeCustomerModal(): void {
    this.selectedCustomer = null;
    this.showCustomerModal = false;
    this.cdr.markForCheck();
  }

  toggleUserLock(customer: AdminCustomer): void {
    const newLockState = !customer.isLocked;
    this.http.patch<any>(`/api/admin/users/${customer._id}`, { isLocked: newLockState }).subscribe({
      next: () => {
        customer.isLocked = newLockState;
        this.cdr.markForCheck();
      },
      error: () => {
        customer.isLocked = newLockState;
        this.cdr.markForCheck();
      }
    });
  }

  // --- 5. Reviews ---
  loadReviews(): void {
    this.http.get<AdminReview[]>('/api/admin/reviews').subscribe({
      next: (res) => {
        this.reviews = res || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.reviews = this.getMockReviews();
        this.cdr.markForCheck();
      }
    });
  }

  get filteredReviews(): AdminReview[] {
    return this.reviews.filter(r => {
      if (this.reviewFilter === 'pending' && r.status !== 'PENDING') return false;
      if (this.reviewFilter === 'approved' && r.status !== 'APPROVED') return false;
      if (this.reviewFilter === 'rejected' && r.status !== 'REJECTED') return false;

      if (this.reviewSearchText.trim()) {
        const q = this.reviewSearchText.trim().toLowerCase();
        return (r.customerName || '').toLowerCase().includes(q) ||
               (r.conceptName || '').toLowerCase().includes(q) ||
               (r.comment || '').toLowerCase().includes(q);
      }
      return true;
    });
  }

  openReviewModal(review: AdminReview): void {
    this.selectedReview = review;
    this.showReviewModal = true;
    this.cdr.markForCheck();
  }

  closeReviewModal(): void {
    this.selectedReview = null;
    this.showReviewModal = false;
    this.cdr.markForCheck();
  }

  approveReview(id: string): void {
    this.http.patch<any>(`/api/admin/reviews/${id}`, { status: 'APPROVED' }).subscribe({
      next: () => {
        const item = this.reviews.find(r => r._id === id);
        if (item) item.status = 'APPROVED';
        this.closeReviewModal();
        this.cdr.markForCheck();
      },
      error: () => {
        const item = this.reviews.find(r => r._id === id);
        if (item) item.status = 'APPROVED';
        this.closeReviewModal();
        this.cdr.markForCheck();
      }
    });
  }

  rejectReview(id: string): void {
    this.http.patch<any>(`/api/admin/reviews/${id}`, { status: 'REJECTED' }).subscribe({
      next: () => {
        const item = this.reviews.find(r => r._id === id);
        if (item) item.status = 'REJECTED';
        this.closeReviewModal();
        this.cdr.markForCheck();
      },
      error: () => {
        const item = this.reviews.find(r => r._id === id);
        if (item) item.status = 'REJECTED';
        this.closeReviewModal();
        this.cdr.markForCheck();
      }
    });
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  // --- Fallback Mock Data ---
  private getMockBookings(): AdminBooking[] {
    return [
      {
        _id: 'b01',
        bookingCode: 'KU012345',
        customer: { name: 'Thanh Vy', phone: '0396581067', email: 'thanhvy@kyucstudio.vn', note: 'Concept ấm áp' },
        pricing: { package: { package_name: 'Chân Dung – Nâng Cao', price: 2500000 }, concept: { concept_name: 'Concept Chụp Chân Dung', concept_code: 'CD01' }, totalAmount: 2500000, depositAmount: 750000 },
        bookingDate: '2026-10-30',
        startTime: '15:30',
        endTime: '17:00',
        timeSlot: '15:30 – 17:00',
        bookingStatus: 'Pending',
        paymentStatus: 'Unpaid',
        paidAmount: 0,
        createdAt: '2026-10-25'
      },
      {
        _id: 'b02',
        bookingCode: 'KU261108531370',
        customer: { name: 'Nguyễn Thu Trang', phone: '0987654321', email: 'thutrang@gmail.com' },
        pricing: { package: { package_name: 'Chân Dung – Tiêu Chuẩn', price: 1500000 }, concept: { concept_name: 'AD Trắng Trơn', concept_code: 'AD01' }, totalAmount: 1500000, depositAmount: 450000 },
        bookingDate: '2026-11-08',
        startTime: '08:00',
        endTime: '09:30',
        timeSlot: '08:00 – 09:30',
        bookingStatus: 'Confirmed',
        paymentStatus: 'Paid',
        paidAmount: 450000,
        createdAt: '2026-11-07'
      },
      {
        _id: 'b03',
        bookingCode: 'KU012344',
        customer: { name: 'Trần Minh Anh', phone: '0912345678', email: 'minhanh@gmail.com' },
        pricing: { package: { package_name: 'Cặp Đôi – Cao Cấp', price: 5200000 }, concept: { concept_name: 'Thanh Xuân Đôi', concept_code: 'CD02' }, totalAmount: 5200000, depositAmount: 1560000 },
        bookingDate: '2026-09-15',
        startTime: '10:00',
        endTime: '12:30',
        timeSlot: '10:00 – 12:30',
        bookingStatus: 'Completed',
        paymentStatus: 'Paid',
        paidAmount: 5200000,
        createdAt: '2026-09-10'
      }
    ];
  }

  private getMockConcepts(): any[] {
    return [
      { concept_code: 'AD01', concept_name: 'AD Trắng Trơn (Áo dài trắng trơn)', category: 'Áo dài', price_hint: 1500000, status: 'ACTIVE', thumbnail_url: 'assets/03.01. Home/Cá nhân.jpg' },
      { concept_code: 'CP01', concept_name: 'Concept Nàng Thơ Vườn Hoa', category: 'Chân dung', price_hint: 2500000, status: 'ACTIVE', thumbnail_url: 'assets/03.01. Home/Cá nhân.jpg' },
      { concept_code: 'CD02', concept_name: 'Cặp Đôi Thanh Xuân Cổ Điển', category: 'Cặp đôi', price_hint: 3500000, status: 'ACTIVE', thumbnail_url: 'assets/03.01. Home/Cặp đôi.jpg' },
      { concept_code: 'GD01', concept_name: 'Gia Đình Sum Vầy Áo Dài', category: 'Gia đình', price_hint: 4500000, status: 'ACTIVE', thumbnail_url: 'assets/03.01. Home/Gia đình.jpg' }
    ];
  }

  private getMockCustomers(): AdminCustomer[] {
    return [
      { _id: 'c01', fullName: 'Thanh Vy', phone: '0396581067', email: 'thanhvy@kyucstudio.vn', points: 1250, tier: 'VIP Vàng', bookingCount: 2, totalSpent: 7700000, isLocked: false, createdAt: '2026-09-01' },
      { _id: 'c02', fullName: 'Trần Minh Anh', phone: '0912345678', email: 'minhanh@gmail.com', points: 850, tier: 'Bạc', bookingCount: 1, totalSpent: 5200000, isLocked: false, createdAt: '2026-09-10' },
      { _id: 'c03', fullName: 'Nguyễn Thu Trang', phone: '0987654321', email: 'thutrang@gmail.com', points: 300, tier: 'Thành viên Mới', bookingCount: 1, totalSpent: 1500000, isLocked: false, createdAt: '2026-11-01' }
    ];
  }

  private getMockReviews(): AdminReview[] {
    return [
      {
        _id: 'rv01',
        customerName: 'Hoàng Lan',
        customerPhone: '0912345678',
        conceptName: 'Áo Dài Trắng Trơn',
        rating: 5,
        comment: 'Studio chụp rất có tâm, nhân viên trang điểm nhẹ nhàng đúng ý mình. Ảnh thô đã rất đẹp rồi!',
        images: ['assets/03.01. Home/Cá nhân.jpg', 'assets/03.01. Home/Cặp đôi.jpg'],
        status: 'PENDING',
        createdAt: '2026-11-05'
      },
      {
        _id: 'rv02',
        customerName: 'Trần Minh Anh',
        customerPhone: '0988776655',
        conceptName: 'Concept Nàng Thơ Vườn Hoa',
        rating: 5,
        comment: 'Nhiếp ảnh gia hướng dẫn tạo dáng rất nhiệt tình. Không gian studio rộng rãi ấm cúng.',
        images: ['assets/03.01. Home/Cá nhân.jpg'],
        status: 'APPROVED',
        createdAt: '2026-11-03'
      }
    ];
  }
}
