import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-booking',
  standalone: false,
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.css'
})
export class BookingComponent implements OnInit, OnDestroy {
  // Booking Data
  selectedConceptName: string = 'CD VƯỜN HOA';
  selectedConceptImage: string = 'assets/03.03. Concept/Chân dung/CD Vườn hoa.png';
  orderCode: string = 'KYUC-892415';
  selectedDateFormatted: string = '08/10/2026';
  selectedSlot: string = '15:00';
  totalPrice: number = 3800000;
  depositAmount: number = 1140000; // 30% of 3.8tr
  depositAmountFormatted: string = '1.140.000đ';

  // Timer
  secondsRemaining: number = 1800; // 30 minutes
  timerInterval: any = null;

  // Payment Method
  selectedPaymentMethod: 'bank' | 'momo' | 'vnpay' = 'bank';

  // VietQR URL
  get vietQrUrl(): string {
    const bankId = 'MB';
    const accountNo = '0396581067';
    const template = 'compact2';
    const amount = this.depositAmount;
    const memo = encodeURIComponent(this.orderCode);
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${memo}&accountName=NGUYEN%20NGOC%20KHANH`;
  }

  // Consultation Form (Frame 46)
  consultForm = {
    fullName: '',
    phone: '',
    favoriteConcept: 'CD Vườn Hoa',
    conceptIdea1: '',
    conceptIdea2: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['concept']) {
        this.selectedConceptName = params['concept'];
      }
      if (params['tier']) {
        this.selectedConceptName = 'Gói chụp: ' + params['tier'];
      }
    });

    // Generate random order code if not set
    const randNum = Math.floor(100000 + Math.random() * 900000);
    this.orderCode = `KYUC-${randNum}`;

    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.secondsRemaining > 0) {
        this.secondsRemaining--;
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  get formatTime(): string {
    const mins = Math.floor(this.secondsRemaining / 60);
    const secs = this.secondsRemaining % 60;
    const mStr = mins < 10 ? '0' + mins : mins;
    const sStr = secs < 10 ? '0' + secs : secs;
    return `${mStr}:${sStr}`;
  }

  setPaymentMethod(method: 'bank' | 'momo' | 'vnpay'): void {
    this.selectedPaymentMethod = method;
  }

  confirmPayment(): void {
    alert(`Đã ghi nhận thanh toán tiền cọc cho đơn ${this.orderCode}! Ký Ức Studio sẽ gửi tin nhắn SMS xác nhận trong giây lát.`);
    this.router.navigate(['/account']);
  }

  submitConsult(): void {
    if (!this.consultForm.fullName || !this.consultForm.phone) {
      alert('Vui lòng nhập Họ tên và Số điện thoại!');
      return;
    }
    alert('Ký Ức Studio đã ghi nhận thông tin đặt lịch! Ekip sẽ liên hệ lại với bạn trong vòng 30 phút.');
    this.consultForm = {
      fullName: '',
      phone: '',
      favoriteConcept: '',
      conceptIdea1: '',
      conceptIdea2: ''
    };
  }
}
