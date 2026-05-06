import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseService } from './base.service';

export interface CashSession {
  id?: number;
  openingAmount: number;
  openingNotes?: string;
  openedAt?: string;
  openedByEmail?: string;
  closedAt?: string;
  closedByEmail?: string;
  countedCash?: number;
  countedCard?: number;
  expectedCash?: number;
  expectedCard?: number;
  cashVariance?: number;
  cardVariance?: number;
  closingNotes?: string;
  zReportNumber?: string;
  status?: 'OPEN' | 'CLOSED';
}

export interface CashSessionSummary {
  sessionId: number;
  openedAt: string;
  asOf: string;
  openingAmount: number;
  ordersCount: number;
  unitsSold: number;
  totalRevenue: number;
  totalDiscount: number;
  totalOriginal: number;
  cashSales: number;
  cardSales: number;
  mixedSales: number;
  otherSales: number;
  refundsCount: number;
  refundsAmount: number;
  cashIn: number;
  cashOut: number;
  expectedCashInDrawer: number;
  expectedCardTotal: number;
  topProducts: { menuItemId: number; title: string; quantitySold: number; revenue: number }[];
}

export type CashMovementType = 'IN' | 'OUT';
export type CashMovementReason =
  | 'PURCHASE'
  | 'WITHDRAWAL'
  | 'DEPOSIT'
  | 'CHANGE_GIVEN'
  | 'CHANGE_RECEIVED'
  | 'OTHER';

export interface CashMovement {
  id?: number;
  sessionId?: number;
  type: CashMovementType;
  reason: CashMovementReason;
  amount: number;
  note?: string;
  userEmail?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class CashSessionService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/cash-sessions`;

  constructor(
    private readonly httpClient: HttpClient,
    router: Router,
    toastr: ToastrService,
  ) {
    super(httpClient, router, toastr);
  }

  open(payload: { openingAmount: number; openingNotes?: string }): Observable<CashSession> {
    return this.post<CashSession>(`${this.baseUrl}/open`, payload);
  }

  current(): Observable<CashSession> {
    return this.get<CashSession>(`${this.baseUrl}/current`);
  }

  all(): Observable<CashSession[]> {
    return this.get<CashSession[]>(this.baseUrl);
  }

  byId(id: number): Observable<CashSession> {
    return this.get<CashSession>(`${this.baseUrl}/${id}`);
  }

  summary(id: number): Observable<CashSessionSummary> {
    return this.get<CashSessionSummary>(`${this.baseUrl}/${id}/summary`);
  }

  close(id: number, payload: { countedCash: number; countedCard: number; closingNotes?: string }): Observable<CashSession> {
    return this.post<CashSession>(`${this.baseUrl}/${id}/close`, payload);
  }

  addMovement(id: number, m: CashMovement): Observable<CashMovement> {
    return this.post<CashMovement>(`${this.baseUrl}/${id}/movements`, m);
  }

  listMovements(id: number): Observable<CashMovement[]> {
    return this.get<CashMovement[]>(`${this.baseUrl}/${id}/movements`);
  }

  zReportUrl(id: number): string {
    return `${this.baseUrl}/${id}/z-report.pdf`;
  }

  /** Authenticated PDF download (Blob) — needed because /z-report.pdf requires JWT */
  downloadZReport(id: number): Observable<Blob> {
    return this.httpClient.get(`${this.baseUrl}/${id}/z-report.pdf`, {
      headers: new HttpHeaders({ Accept: 'application/pdf' }),
      responseType: 'blob',
    });
  }
}
