import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BookingService } from '../../services/booking.service';

@Component({
  selector: 'app-payment-result',
  standalone: false,
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.css'
})
export class PaymentResultComponent implements OnInit {
  loading: boolean = true;
  success: boolean = false;
  message: string = '';
  amount: number = 0;
  transactionCode: string = '';
  bankCode: string = '';
  booking: any = null;
  errorMessage: string = '';

  constructor(
    private bookingService: BookingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const search = window.location.search;
    if (!search) {
      this.loading = false;
      this.errorMessage = 'Không tìm thấy thông tin phản hồi từ cổng thanh toán.';
      return;
    }

    this.bookingService.verifyVnpayReturn(search).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = res.success === true;
        this.message = res.message || (this.success ? 'Thanh toán thành công!' : 'Thanh toán không thành công.');
        this.amount = res.amount || 0;
        this.transactionCode = res.transactionCode || '';
        this.bankCode = res.bankCode || '';
        this.booking = res.booking || null;
      },
      error: (err) => {
        this.loading = false;
        this.success = false;
        this.errorMessage = err.message || 'Chữ ký phản hồi không hợp lệ hoặc giao dịch đã hết hạn.';
      }
    });
  }
}
