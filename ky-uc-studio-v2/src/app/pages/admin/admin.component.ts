import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Active Main Navigation Tab
  activeTab: 'dashboard' | 'bookings' | 'catalog' | 'customers' = 'dashboard';

  // 1. Dashboard Data
  stats = {
    revenueTotal: 0,
    revenueExpected: 0,
    bookingsTotal: 0,
    newCustomers: 0
  };

  topPackages: Array<{ package_id: number; package_name: string; count: number }> = [];
  recentBookings: AdminBooking[] = [];

  // 2. Booking Management Data
  bookings: AdminBooking[] = [];
  bookingFilter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' = 'all';
  bookingSearchText: string = '';
  bookingPage: number = 1;
  bookingLimit: number = 10;
  bookingTotal: number = 0;
  bookingError: string = '';
  selectedBooking: AdminBooking | null = null;
  showBookingModal: boolean = false;

  bookingStatusCounts = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0
  };

  // 3. Catalog Management Data
  catalogTab: 'concepts' | 'packages' = 'concepts';
  conceptsList: any[] = [];
  packagesList: any[] = [];
  catalogSearchText: string = '';
  showCatalogModal: boolean = false;
  isEditingConcept: boolean = false;
  uploadingImage: boolean = false;
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

  ngOnInit(): void {
    this.loadAllData();
  }

  setTab(tab: 'dashboard' | 'bookings' | 'catalog' | 'customers'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  loadAllData(): void {
    this.loadStats();
    this.loadBookings();
    this.loadCatalog();
    this.loadCustomers();
  }

  // --- 1. Dashboard ---
  loadStats(): void {
    this.http.get<any>('/api/admin/stats').subscribe({
      next: (res) => {
        if (res) {
          if (res.revenue) {
            this.stats.revenueTotal = res.revenue.collected || 0;
            this.stats.revenueExpected = res.revenue.expected || 0;
          }
          if (res.bookings) {
            this.stats.bookingsTotal = res.bookings.total || 0;
            if (res.bookings.byStatus) {
              this.bookingStatusCounts.pending = res.bookings.byStatus['Pending'] || 0;
              this.bookingStatusCounts.confirmed = res.bookings.byStatus['Confirmed'] || 0;
              this.bookingStatusCounts.completed = res.bookings.byStatus['Completed'] || 0;
              this.bookingStatusCounts.cancelled = res.bookings.byStatus['Cancelled'] || 0;
              this.bookingStatusCounts.no_show = res.bookings.byStatus['No_Show'] || 0;
            }
          }
          if (res.newCustomersLast30Days !== undefined) {
            this.stats.newCustomers = res.newCustomersLast30Days;
          }
          if (res.topPackages) {
            this.topPackages = res.topPackages;
          }
          if (res.upcoming && Array.isArray(res.upcoming)) {
            this.recentBookings = res.upcoming;
          }
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
    this.bookingError = '';
    const queryParams: string[] = [
      `page=${this.bookingPage}`,
      `limit=${this.bookingLimit}`,
      'sort=newest' // Đơn mới đặt hiện lên đầu (server sắp theo createdAt giảm dần)
    ];

    if (this.bookingFilter !== 'all') {
      const statusMap: Record<string, string> = {
        pending: 'Pending',
        confirmed: 'Confirmed',
        completed: 'Completed',
        cancelled: 'Cancelled',
        no_show: 'No_Show'
      };
      const mapped = statusMap[this.bookingFilter] || this.bookingFilter;
      queryParams.push(`status=${encodeURIComponent(mapped)}`);
    }

    if (this.bookingSearchText.trim()) {
      queryParams.push(`code=${encodeURIComponent(this.bookingSearchText.trim())}`);
    }

    this.http.get<any>(`/api/bookings?${queryParams.join('&')}`).subscribe({
      next: (res) => {
        this.bookings = res.data || [];
        this.bookingTotal = res.total !== undefined ? res.total : this.bookings.length;
        if (this.recentBookings.length === 0 && this.bookings.length > 0) {
          this.recentBookings = this.bookings.slice(0, 5);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.bookings = [];
        this.bookingTotal = 0;
        this.bookingError = err.error?.error || 'Không tải được danh sách đơn';
        this.cdr.markForCheck();
      }
    });
  }

  get filteredBookings(): AdminBooking[] {
    return this.bookings;
  }

  get pendingBookingsCount(): number {
    return this.bookingStatusCounts.pending;
  }

  get confirmedBookingsCount(): number {
    return this.bookingStatusCounts.confirmed;
  }

  get completedBookingsCount(): number {
    return this.bookingStatusCounts.completed;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.bookingTotal / this.bookingLimit));
  }

  setBookingFilter(filter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'): void {
    this.bookingFilter = filter;
    this.bookingPage = 1;
    this.loadBookings();
  }

  onBookingSearch(): void {
    this.bookingPage = 1;
    this.loadBookings();
  }

  goToBookingPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.bookingPage = page;
    this.loadBookings();
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
        this.loadStats();
        this.loadBookings();
        this.cdr.markForCheck();
      },
      error: (err) => {
        const errorMsg = err.error?.error || 'Cập nhật trạng thái thất bại!';
        alert(errorMsg);
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
        this.conceptsList = [];
        this.cdr.markForCheck();
      }
    });

    this.http.get<any[]>('/api/packages').subscribe({
      next: (pkgs) => {
        this.packagesList = pkgs || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.packagesList = [];
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
      _id: concept.concept_code || concept._id,
      concept_code: concept.concept_code,
      concept_name: concept.concept_name,
      category: concept.category || 'Chân dung',
      description: concept.description || '',
      price_hint: concept.starting_price || concept.price_hint || 1500000,
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

  onImageSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    this.uploadingImage = true;
    this.http.post<any>('/api/admin/uploads', formData).subscribe({
      next: (res) => {
        this.uploadingImage = false;
        if (res && res.url) {
          this.conceptForm.thumbnail_url = res.url;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.uploadingImage = false;
        alert(err.error?.error || 'Upload ảnh thất bại!');
        this.cdr.markForCheck();
      }
    });
  }

  saveConcept(): void {
    if (!this.conceptForm.concept_name.trim()) {
      alert('Vui lòng nhập tên Concept!');
      return;
    }

    const payload = {
      concept_code: this.conceptForm.concept_code.trim().toUpperCase(),
      concept_name: this.conceptForm.concept_name.trim(),
      category: this.conceptForm.category,
      starting_price: Number(this.conceptForm.price_hint) || 1500000,
      description: this.conceptForm.description || '',
      thumbnail_url: this.conceptForm.thumbnail_url,
      status: this.conceptForm.status || 'ACTIVE'
    };

    if (this.isEditingConcept && this.conceptForm._id) {
      this.http.put<any>(`/api/concepts/${encodeURIComponent(this.conceptForm._id)}`, payload).subscribe({
        next: () => {
          this.closeCatalogModal();
          this.loadCatalog();
        },
        error: (err) => {
          alert(err.error?.error || 'Cập nhật concept thất bại!');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.http.post<any>('/api/concepts', payload).subscribe({
        next: () => {
          this.closeCatalogModal();
          this.loadCatalog();
        },
        error: (err) => {
          alert(err.error?.error || 'Thêm concept mới thất bại!');
          this.cdr.markForCheck();
        }
      });
    }
  }

  toggleConceptStatus(concept: any): void {
    const nextStatus = concept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const id = concept.concept_code || concept._id;
    this.http.put<any>(`/api/concepts/${encodeURIComponent(id)}`, { status: nextStatus }).subscribe({
      next: () => {
        concept.status = nextStatus;
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert(err.error?.error || 'Không thể thay đổi trạng thái!');
        this.cdr.markForCheck();
      }
    });
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
          phone: u.phone || '—',
          email: u.email || '—',
          points: u.points || 0,
          tier: (u.points || 0) > 500 ? 'VIP Vàng' : ((u.points || 0) > 100 ? 'Bạc' : 'Thành viên Mới'),
          bookingCount: u.bookingCount || 0,
          totalSpent: u.totalSpent || 0,
          isLocked: u.isLocked || false,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '—'
        }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.customers = [];
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
      error: (err) => {
        alert(err.error?.error || 'Không thể đổi trạng thái khóa tài khoản!');
        this.cdr.markForCheck();
      }
    });
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
