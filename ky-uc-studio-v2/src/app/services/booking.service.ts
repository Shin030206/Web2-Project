import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, retry, throwError } from 'rxjs';

export interface SlotAvailability {
  slot: string;      // e.g. "08:00"
  available: boolean;
  timeSlot?: string; // e.g. "08:00 - 09:30"
}

export interface SlotsResponse {
  date: string;
  durationMinutes: number;
  openTime: string;
  closeTime: string;
  slots: SlotAvailability[];
}

export interface HoldSlotPayload {
  packageId: number | string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;   // HH:mm
  customerPhone: string;
}

export interface HoldSlotResponse {
  message: string;
  holdId: string;
  bookingDate: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface QuotePayload {
  packageId: number | string;
  conceptCode?: string;
  addons?: string[];
  voucherCode?: string;
}

export interface QuoteResponse {
  packagePrice: number;
  conceptPrice: number;
  addonsPrice: number;
  discountAmount: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  voucher?: any;
}

export interface DraftPayload {
  step?: number;
  data: {
    packageId?: number | string;
    conceptCode?: string;
    addons?: string[];
    voucherCode?: string;
    bookingDate?: string;
    startTime?: string;
    holdId?: string;
    customer?: {
      name?: string;
      phone?: string;
      email?: string;
      note?: string;
    };
  };
}

export interface CreateBookingPayload {
  holdId: string;
  conceptCode?: string;
  addons?: string[];
  voucherCode?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  note?: string;
}

export interface PaymentInfo {
  amount: number;
  transferContent: string;
  bankId: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  qrUrl: string | null;
}

export interface BookingResponse {
  message: string;
  bookingId: string;
  bookingCode: string;
  data: any;
  paymentInfo?: PaymentInfo;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  constructor(private http: HttpClient) {}

  // 1. Lấy danh sách giờ trống theo ngày & gói
  getAvailableSlots(date: string, packageId: number | string): Observable<SlotsResponse> {
    return this.http.get<SlotsResponse>(`/api/slots?date=${encodeURIComponent(date)}&packageId=${encodeURIComponent(packageId)}`).pipe(
      catchError(this.handleError)
    );
  }

  // 2. Giữ slot 10 phút
  holdSlot(payload: HoldSlotPayload): Observable<HoldSlotResponse> {
    return this.http.post<HoldSlotResponse>('/api/slots/hold', payload).pipe(
      catchError(this.handleError)
    );
  }

  // 3. Tính giá đơn hàng trước khi đặt
  getQuote(payload: QuotePayload): Observable<QuoteResponse> {
    return this.http.post<QuoteResponse>('/api/bookings/quote', payload).pipe(
      catchError(this.handleError)
    );
  }

  // 4. Lưu nháp tiến trình đặt lịch
  saveDraft(payload: DraftPayload): Observable<any> {
    return this.http.put<any>('/api/booking-draft', payload).pipe(
      catchError(this.handleError)
    );
  }

  // 5. Lấy nháp đã lưu
  getDraft(): Observable<any> {
    return this.http.get<any>('/api/booking-draft').pipe(
      catchError(this.handleError)
    );
  }

  // 6. Xóa nháp
  deleteDraft(): Observable<any> {
    return this.http.delete<any>('/api/booking-draft').pipe(
      catchError(this.handleError)
    );
  }

  // 7. Tạo đơn đặt lịch chính thức
  createBooking(payload: CreateBookingPayload): Observable<BookingResponse> {
    return this.http.post<BookingResponse>('/api/bookings', payload).pipe(
      catchError(this.handleError)
    );
  }

  // 8. Tạo link thanh toán VNPay
  createVnpayPayment(bookingId: string, type: 'deposit' | 'remaining' = 'deposit'): Observable<{ paymentUrl: string; txnRef: string; amount: number }> {
    return this.http.post<any>('/api/payments/vnpay', { bookingId, type }).pipe(
      catchError(this.handleError)
    );
  }

  // 9. Xác thực kết quả VNPay (Return URL)
  verifyVnpayReturn(queryString: string): Observable<any> {
    const q = queryString.startsWith('?') ? queryString : `?${queryString}`;
    return this.http.get<any>(`/api/payments/vnpay/return${q}`).pipe(
      catchError(this.handleError)
    );
  }

  // 10. Lấy mã QR chuyển khoản VietQR từ server
  getPaymentQR(bookingId: string): Observable<PaymentInfo & { bookingCode: string; depositAmount: number }> {
    return this.http.get<any>(`/api/payments/qr/${encodeURIComponent(bookingId)}`).pipe(
      catchError(this.handleError)
    );
  }

  // 11. Báo đã chuyển khoản
  confirmBankTransfer(payload: { bookingId: string; transactionCode?: string; note?: string }): Observable<any> {
    return this.http.post<any>('/api/payments', {
      bookingId: payload.bookingId,
      method: 'bank_transfer',
      type: 'deposit',
      transactionCode: payload.transactionCode || '',
      note: payload.note || ''
    }).pipe(
      catchError(this.handleError)
    );
  }

  // 12. Tra cứu đơn hàng của tài khoản
  getMyBookings(): Observable<any> {
    return this.http.get<any>('/api/bookings/my').pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMsg = error.error?.error || error.error?.message || error.message || 'Lỗi kết nối máy chủ.';
    console.error('BookingService Error:', errorMsg);
    return throwError(() => ({ message: errorMsg, status: error.status, error: error.error }));
  }
}
