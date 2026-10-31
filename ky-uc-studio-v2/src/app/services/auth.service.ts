import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  points?: number;
  avatar_url?: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  rememberMe?: boolean;
  draftRestored?: boolean;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public checkedSession = false;

  constructor(private http: HttpClient) {
    this.checkSession();
  }

  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  checkSession(): void {
    this.getMe().subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
        this.checkedSession = true;
      },
      error: () => {
        this.currentUserSubject.next(null);
        this.checkedSession = true;
      }
    });
  }

  register(data: { fullName: string; email: string; phone: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', data).pipe(
      tap((res) => {
        if (res && res.user) {
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  login(data: { account: string; password: string; rememberMe?: boolean }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', data).pipe(
      tap((res) => {
        if (res && res.user) {
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  getMe(): Observable<User> {
    return this.http.get<User>('/api/auth/me').pipe(
      tap((user) => {
        if (user) {
          this.currentUserSubject.next(user);
        }
      })
    );
  }

  logout(): Observable<any> {
    return this.http.post('/api/auth/logout', {}).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      }),
      catchError(() => {
        this.currentUserSubject.next(null);
        return of(null);
      })
    );
  }

  forgotPassword(data: { phone?: string; email?: string; account?: string }): Observable<any> {
    return this.http.post('/api/auth/forgot-password', data);
  }

  verifyResetOtp(data: { phone?: string; email?: string; account?: string; otp: string }): Observable<any> {
    return this.http.post('/api/auth/verify-reset-otp', data);
  }

  resetPassword(data: { phone?: string; email?: string; account?: string; otp: string; newPassword: string }): Observable<any> {
    return this.http.post('/api/auth/reset-password', data);
  }
}
