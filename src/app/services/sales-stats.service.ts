import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SalesStats, TopProduct } from '../core/models';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class SalesStatsService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/sales-stats`;

  constructor(private readonly http2: HttpClient, router: Router, toastr: ToastrService) {
    super(http2, router, toastr);
  }

  getStats(from: string, to: string): Observable<SalesStats> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.get<SalesStats>(this.baseUrl, params);
  }

  getTopProducts(from: string, to: string, limit = 10): Observable<TopProduct[]> {
    const params = new HttpParams().set('from', from).set('to', to).set('limit', limit.toString());
    return this.get<TopProduct[]>(`${this.baseUrl}/top-products`, params);
  }

  exportCsvUrl(from: string, to: string): string {
    return `${this.baseUrl}/export.csv?from=${from}&to=${to}`;
  }

  downloadCsv(from: string, to: string): Observable<Blob> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http2.get(`${this.baseUrl}/export.csv`, { params, responseType: 'blob' });
  }
}
