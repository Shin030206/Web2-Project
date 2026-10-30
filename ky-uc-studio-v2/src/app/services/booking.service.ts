import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, retry, throwError } from 'rxjs';

export interface BookingPayload {
  packageId: string;
  packageName: string;
  bookingDate: string;
  timeSlot: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  note?: string;
  addOns?: string[];
  totalPrice: number;
  depositAmount: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  constructor(private http: HttpClient) {}

  createBooking(payload: BookingPayload): Observable<any> {
    return this.http.post<any>('/bookings', payload).pipe(
      retry(1),
      catchError(this.handleError)
    );
  }

  getBookings(phone?: string): Observable<any> {
    const url = phone ? `/bookings?phone=${encodeURIComponent(phone)}` : '/bookings';
    return this.http.get<any>(url).pipe(
      retry(2),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMsg = error.error?.error || error.message || 'Lỗi kết nối đặt lịch.';
    console.error('BookingService Error:', errorMsg);
    return throwError(() => new Error(errorMsg));
  }
}

