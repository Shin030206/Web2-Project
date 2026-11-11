import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { Addon, Package } from '../models/package.model';

@Injectable({
  providedIn: 'root'
})
export class PackageService {
  constructor(private http: HttpClient) {}

  // Lấy gói chụp từ MongoDB, server lỗi thì dùng tạm assets/data/packages.json
  getPackages(): Observable<Package[]> {
    return this.http.get<Package[]>('/api/packages').pipe(
      catchError(() => {
        console.warn('Backend /api/packages chưa kết nối, sử dụng assets/data/packages.json');
        return this.http.get<Package[]>('assets/data/packages.json');
      })
    );
  }

  getPackage(id: string): Observable<Package> {
    return this.http.get<Package>(`/api/packages/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  // Lấy dịch vụ thêm (add-ons) từ MongoDB, server lỗi thì dùng tạm assets/data/add-ons.json
  getAddons(): Observable<Addon[]> {
    return this.http.get<Addon[]>('/api/addons').pipe(
      catchError(() => {
        console.warn('Backend /api/addons chưa kết nối, sử dụng assets/data/add-ons.json');
        return this.http.get<Addon[]>('assets/data/add-ons.json');
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMsg = '';
    if (error.error instanceof ErrorEvent) {
      errorMsg = `Client Error: ${error.error.message}`;
    } else {
      errorMsg = `Server Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMsg);
    return throwError(() => new Error(errorMsg));
  }
}
