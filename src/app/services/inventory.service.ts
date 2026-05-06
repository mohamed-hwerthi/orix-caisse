import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseService } from './base.service';

export interface InventoryCount {
  id?: number;
  menuItemId: number;
  menuItemTitle?: string;
  sku?: string;
  expectedQuantity?: number;
  countedQuantity: number;
  delta?: number;
}

export interface InventorySession {
  id?: number;
  label: string;
  notes?: string;
  createdAt?: string;
  committedAt?: string;
  userEmail?: string;
  status?: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  counts?: InventoryCount[];
  totalDelta?: number;
  itemsWithDiff?: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/inventory-sessions`;

  constructor(http: HttpClient, router: Router, toastr: ToastrService) {
    super(http, router, toastr);
  }

  list(): Observable<InventorySession[]> {
    return this.get<InventorySession[]>(this.baseUrl);
  }

  byId(id: number): Observable<InventorySession> {
    return this.get<InventorySession>(`${this.baseUrl}/${id}`);
  }

  create(s: InventorySession): Observable<InventorySession> {
    return this.post<InventorySession>(this.baseUrl, s);
  }

  updateCounts(id: number, counts: InventoryCount[]): Observable<InventorySession> {
    return this.put<InventorySession>(`${this.baseUrl}/${id}/counts`, counts);
  }

  commit(id: number): Observable<InventorySession> {
    return this.post<InventorySession>(`${this.baseUrl}/${id}/commit`, {});
  }

  cancel(id: number): Observable<InventorySession> {
    return this.post<InventorySession>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
