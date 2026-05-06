import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PaginatedResponseDTO, StockMovement } from '../core/models';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class StockService extends BaseService {
  private readonly baseUrl = `${environment.apiUrl}/stock-movements`;

  constructor(http: HttpClient, router: Router, toastr: ToastrService) {
    super(http, router, toastr);
  }

  createMovement(movement: StockMovement): Observable<StockMovement> {
    return this.post<StockMovement>(this.baseUrl, movement);
  }

  listMovements(page = 0, limit = 20): Observable<PaginatedResponseDTO<StockMovement>> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this.get<PaginatedResponseDTO<StockMovement>>(this.baseUrl, params);
  }

  movementsByMenuItem(menuItemId: number, page = 0, limit = 20): Observable<PaginatedResponseDTO<StockMovement>> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this.get<PaginatedResponseDTO<StockMovement>>(`${this.baseUrl}/by-menu-item/${menuItemId}`, params);
  }
}
