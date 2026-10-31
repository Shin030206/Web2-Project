import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, retry, throwError } from 'rxjs';
import { Package } from '../models/package.model';

@Injectable({
  providedIn: 'root'
})
export class PackageService {
  constructor(private http: HttpClient) {}

  getPackages(): Observable<Package[]> {
    return this.http.get<Package[]>('/api/packages').pipe(
      retry(3),
      catchError(this.handleError)
    );
  }

  getPackage(id: string): Observable<Package> {
    return this.http.get<Package>(`/api/packages/${id}`).pipe(
      retry(3),
      catchError(this.handleError)
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
