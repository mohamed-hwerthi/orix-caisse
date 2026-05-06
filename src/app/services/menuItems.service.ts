import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MenuItem, PaginatedResponseDTO } from '../core/models';
import { BaseService } from './base.service';

export interface StockSummaryEntry {
  id: number;
  stockQuantity: number;
  lowStock: boolean;
  nearestExpiryDays?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MenuItemsService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/menu-items`;
  private menuItemCreatedSource = new BehaviorSubject<MenuItem | null>(null);
  private menuItemUpdatedSource = new BehaviorSubject<MenuItem | null>(null);
  private menuItemDeletedSource = new BehaviorSubject<number | undefined | null>(null);
  private reviewSubmittedSource = new BehaviorSubject<void>(undefined);

  // Observable stream to be consumed by components
  menuItemCreated$ = this.menuItemCreatedSource.asObservable();
  menuItemDeleted$ = this.menuItemDeletedSource.asObservable();
  menuItemUpdated$ = this.menuItemUpdatedSource.asObservable();
  reviewSubmitted$ = this.reviewSubmittedSource.asObservable();

  constructor(http: HttpClient, router: Router, toastr: ToastrService) {
    super(http, router, toastr);
  }

  menuItemCreated(menuItem: MenuItem): void {
    this.menuItemCreatedSource.next(menuItem);
  }

  menuItemUpdated(menuItem: MenuItem): void {
    this.menuItemUpdatedSource.next(menuItem);
  }

  menuItemDeleted(menuItemId: number | undefined | null): void {
    this.menuItemDeletedSource.next(menuItemId);
  }

  notifyReviewSubmitted() {
    this.reviewSubmittedSource.next();
  }

  getAllMenuItems(
    page: number = 1,
    limit: number = 10,
    categoryFilter: string = '',
    isDefault: string = 'all',
    priceSortDirection: string = '',
    sortBy: string = '',
    desc: boolean = true,
  ): Observable<PaginatedResponseDTO<MenuItem>> {
    let params = new HttpParams()
      .set('page', (page - 1).toString())
      .set('limit', limit.toString())
      .set('sortBy', sortBy)
      .set('desc', desc.toString());

    if (categoryFilter) {
      params = params.set('categoryFilter', categoryFilter);
    }
    if (isDefault !== 'all') {
      params = params.set('isDefault', isDefault === 'yes' ? 'true' : 'false');
    }
    if (priceSortDirection) {
      params = params.set('priceSortDirection', priceSortDirection);
    }
    return this.get<PaginatedResponseDTO<MenuItem>>(`${this.baseUrl}`, params);
  }

  createMenuItem(menuItemData: MenuItem): Observable<MenuItem> {
    return this.post<MenuItem>(this.baseUrl, menuItemData).pipe(tap((result) => this.menuItemCreated(result)));
  }

  getMenuItemById(menuItemId: number): Observable<MenuItem> {
    return this.get<MenuItem>(`${this.baseUrl}/${menuItemId}`).pipe(map((result) => result));
  }

  getMenuItemsByIds(ids: number[]): Observable<MenuItem[]> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.get<MenuItem[]>(`${this.baseUrl}/batch`, params).pipe(
      map((result) => {
        if (!result) throw new Error('No result');
        return result;
      }),
    );
  }

  updateMenuItem(menuItemId: number, menuItemData: Partial<MenuItem>): Observable<MenuItem> {
    return this.put<MenuItem>(`${this.baseUrl}/${menuItemId}`, menuItemData).pipe(
      tap((result) => this.menuItemUpdated(result)),
    );
  }

  deleteMenuItem(menuItemId: number): Observable<void> {
    return this.delete<void>(`${this.baseUrl}/${menuItemId}`).pipe(tap(() => this.menuItemDeleted(menuItemId)));
  }

  // Get top MenuItems by order count
  getTopMenuItemsByOrderCount(size: number = 5): Observable<MenuItem[]> {
    return this.getAllMenuItems(1, 1000).pipe(
      map((response: PaginatedResponseDTO<MenuItem>) => {
        return response.items.sort((a, b) => b.salesCount - a.salesCount).slice(0, size);
      }),
    );
  }

  deleteMenuItemsByIds(ids: number[]): Observable<void> {
    let params = new HttpParams().set('ids', ids.join(','));

    return this.deleteWithParams<void>(`${this.baseUrl}/batch`, params).pipe(
      catchError((error: any) => {
        return throwError(() => new Error(error.message || 'An unexpected error occurred'));
      }),
    );
  }

  filterMenuItemsByBarCode(barCode: string): Observable<MenuItem> {
    return this.get<MenuItem>(`${this.baseUrl}/bar-code/${barCode}`).pipe(
      catchError((error: { error: string; status: string }) => {
        return throwError(() => {
          return error;
        });
      }),
    );
  }

  getLowStockItems(): Observable<MenuItem[]> {
    return this.get<MenuItem[]>(`${this.baseUrl}/low-stock`).pipe(
      catchError((error: any) => {
        return throwError(() => new Error(error.message || 'An unexpected error occurred'));
      }),
    );
  }

  getStockSummary(): Observable<StockSummaryEntry[]> {
    return this.get<StockSummaryEntry[]>(`${this.baseUrl}/stock-summary`);
  }
  filterMenuItemsByQuery(query: string): Observable<PaginatedResponseDTO<MenuItem>> {
    return this.get<PaginatedResponseDTO<MenuItem>>(`${this.baseUrl}/search/${query}`).pipe(
      catchError((error: any) => {
        return throwError(() => new Error(error.message || 'An unexpected error occurred'));
      }),
    );
  }
}
