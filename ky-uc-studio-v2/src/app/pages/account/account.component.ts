import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

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

  // User Profile
  user = {
    name: 'Võ Thị Thanh Vy',
    phone: '0396581067',
    email: 'thanhvy@gmail.com',
    points: 150,
    avatar: 'assets/images/intro-photo.png',
    membershipTier: 'Thành viên Bạc'
  };

  // Mock & Real bookings list
  bookings: BookingRecord[] = [
    {
      orderCode: 'KUC12345',
      packageName: 'Chân Dung Tiêu Chuẩn',
      conceptName: 'CD Ngày Mưa',
      bookingDate: '08/10/2026',
      timeSlot: '09:00 - 10:30',
      totalPrice: 1500000,
      depositAmount: 450000,
      status: 'PENDING',
      statusText: 'Chờ xác nhận',
      image: 'assets/03.03. Concept/Chân dung/CD Ngày mưa.jpg'
    },
    {
      orderCode: 'KUC12346',
      packageName: 'Cặp Đôi Tình Thơ',
      conceptName: 'CP Hoàng Hôn',
      bookingDate: '11/10/2026',
      timeSlot: '15:30 - 17:00',
      totalPrice: 4800000,
      depositAmount: 1440000,
      status: 'DEPOSITED',
      statusText: 'Đã đặt cọc',
      image: 'assets/03.07. Bộ sưu tập/Ký ức đôi ta/CP Hoàng hôn.jpg'
    },
    {
      orderCode: 'KUC12347',
      packageName: 'Áo Dài Truyền Thống',
      conceptName: 'AD Áo Tấc',
      bookingDate: '20/09/2026',
      timeSlot: '13:30 - 15:00',
      totalPrice: 3800000,
      depositAmount: 1140000,
      status: 'COMPLETED',
      statusText: 'Hoàn thành',
      image: 'assets/03.03. Concept/Áo dài/AD ÁO TẤC.jpg'
    }
  ];

  // Profile Edit form
  profileForm = {
    name: this.user.name,
    phone: this.user.phone,
    email: this.user.email,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  profileSaved: boolean = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
  }

  get filteredBookings(): BookingRecord[] {
    if (this.bookingFilter === 'all') return this.bookings;
    if (this.bookingFilter === 'pending') return this.bookings.filter(b => b.status === 'PENDING');
    if (this.bookingFilter === 'deposited') return this.bookings.filter(b => b.status === 'DEPOSITED');
    if (this.bookingFilter === 'completed') return this.bookings.filter(b => b.status === 'COMPLETED');
    if (this.bookingFilter === 'cancelled') return this.bookings.filter(b => b.status === 'CANCELLED');
    return this.bookings;
  }

  saveProfile(): void {
    this.user.name = this.profileForm.name;
    this.user.email = this.profileForm.email;
    this.profileSaved = true;
    setTimeout(() => {
      this.profileSaved = false;
    }, 2500);
  }
}

