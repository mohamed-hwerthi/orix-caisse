import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Promotion } from '../core/models';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class PromotionService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/promotions`;

  constructor(http: HttpClient, router: Router, toastr: ToastrService) {
    super(http, router, toastr);
  }

  getAll(): Observable<Promotion[]> {
    return this.get<Promotion[]>(this.baseUrl);
  }

  getActive(): Observable<Promotion[]> {
    return this.get<Promotion[]>(`${this.baseUrl}/active`);
  }

  getById(id: number): Observable<Promotion> {
    return this.get<Promotion>(`${this.baseUrl}/${id}`);
  }

  create(p: Promotion): Observable<Promotion> {
    return this.post<Promotion>(this.baseUrl, p);
  }

  update(id: number, p: Promotion): Observable<Promotion> {
    return this.put<Promotion>(`${this.baseUrl}/${id}`, p);
  }

  remove(id: number): Observable<void> {
    return this.delete<void>(`${this.baseUrl}/${id}`);
  }

  validateCode(code: string): Observable<Promotion> {
    return this.get<Promotion>(`${this.baseUrl}/validate-code/${encodeURIComponent(code)}`);
  }

  getAllStats(): Observable<PromotionStats[]> {
    return this.get<PromotionStats[]>(`${this.baseUrl}/stats`);
  }

  getStats(id: number): Observable<PromotionStats> {
    return this.get<PromotionStats>(`${this.baseUrl}/${id}/stats`);
  }

  getOrdersUsing(id: number): Observable<PromotionOrderRow[]> {
    return this.get<PromotionOrderRow[]>(`${this.baseUrl}/${id}/orders`);
  }
}

export interface PromotionStats {
  promotionId: number;
  promotionName: string;
  ordersCount: number;
  revenue: number;
  discountTotal: number;
  originalTotal: number;
  avgDiscountPerOrder: number;
  topProducts?: { menuItemId: number; title: string; quantitySold: number }[];
}

export interface PromotionOrderRow {
  orderId: string;
  createdOn: string;
  totalCost: number;
  originalAmount: number;
  discountAmount: number;
  status: string;
  userEmail: string;
}
