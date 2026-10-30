import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { Concept, CollectionItem } from '../models/concept.model';

@Injectable({
  providedIn: 'root'
})
export class ConceptService {
  constructor(private http: HttpClient) {}

  // Lấy tất cả concepts từ MongoDB, fallback sang file assets/data/concepts.json
  getConcepts(): Observable<Concept[]> {
    return this.http.get<Concept[]>('/concepts').pipe(
      catchError(() => {
        console.warn('Backend /concepts chưa kết nối, sử dụng assets/data/concepts.json');
        return this.http.get<Concept[]>('assets/data/concepts.json');
      })
    );
  }

  // Lấy concept theo mã code hoặc id
  getConceptByCode(code: string): Observable<Concept | null> {
    return this.http.get<Concept>(`/concepts/${code}`).pipe(
      catchError(() => of(null))
    );
  }

  // Lấy bộ sưu tập (collections) từ MongoDB, fallback sang assets/data/collections.json
  getCollections(): Observable<CollectionItem[]> {
    return this.http.get<CollectionItem[]>('/collections').pipe(
      catchError(() => {
        console.warn('Backend /collections chưa kết nối, sử dụng assets/data/collections.json');
        return this.http.get<CollectionItem[]>('assets/data/collections.json');
      })
    );
  }
}

