import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseService } from './base.service';

export interface StockLot {
  id?: number;
  menuItemId: number;
  menuItemTitle?: string;
  batchNumber?: string;
  quantity: number;
  initialQuantity?: number;
  expiryDate: string;
  receivedDate?: string;
  createdAt?: string;
  status?: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'DAMAGED';
  daysUntilExpiry?: number;
}

@Injectable({ providedIn: 'root' })
export class StockLotService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/stock-lots`;

  constructor(http: HttpClient, router: Router, toastr: ToastrService) {
    super(http, router, toastr);
  }

  create(lot: StockLot): Observable<StockLot> {
    return this.post<StockLot>(this.baseUrl, lot);
  }

  byItem(menuItemId: number): Observable<StockLot[]> {
    return this.get<StockLot[]>(`${this.baseUrl}/by-item/${menuItemId}`);
  }

  expiring(days = 7): Observable<StockLot[]> {
    return this.get<StockLot[]>(`${this.baseUrl}/expiring?days=${days}`);
  }

  expiringCount(days = 7): Observable<{ count: number }> {
    return this.get<{ count: number }>(`${this.baseUrl}/expiring/count?days=${days}`);
  }

  markExpired(id: number): Observable<StockLot> {
    return this.post<StockLot>(`${this.baseUrl}/${id}/mark-expired`, {});
  }

  remove(id: number): Observable<void> {
    return this.delete<void>(`${this.baseUrl}/${id}`);
  }
}
