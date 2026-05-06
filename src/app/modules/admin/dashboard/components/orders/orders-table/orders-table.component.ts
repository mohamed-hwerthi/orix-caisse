import { Observable, Subscription, interval, startWith, switchMap } from 'rxjs';
import { Store } from '@ngrx/store';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgFor, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order } from '../../../../../../core/models';
import { OrdersTableItemComponent } from '../orders-table-item/orders-table-item.component';
import { LoaderComponent } from '../../../../../../shared/components/loader/loader.component';
import { OrdersService } from '../../../../../../services/orders.service';
import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { openCreateOrderModal } from '../../../../../../core/state/modal/order/modal.actions';
import { OrderCreateModalComponent } from '../order-create-modal/order-create-modal.component';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../../../shared/components/pagination/pagination.component';

type DateFilter = 'all' | 'today' | 'yesterday' | 'custom';

@Component({
  selector: '[orders-table]',
  templateUrl: './orders-table.component.html',
  standalone: true,
  imports: [
    NgFor,
    OrdersTableItemComponent,
    OrderCreateModalComponent,
    CommonModule,
    CurrencyPipe,
    FormsModule,
    LoaderComponent,
    AngularSvgIconModule,
    ButtonComponent,
    PaginationComponent,
  ],
})
export class OrdersTableComponent implements OnInit, OnDestroy {
  public allOrders: Order[] = [];
  public filteredOrders: Order[] = [];
  public orders: Order[] = [];
  public isLoading: boolean = true;
  public currentPage = 1;
  public pageSize = 10;
  public totalPages = 1;
  public timeSinceLastUpdate$!: Observable<number>;
  public lastUpdated: Date = new Date();

  public dateFilter: DateFilter = 'today';
  public customDate: string = this.toIsoDate(new Date());

  public stats = { count: 0, revenue: 0, paid: 0, avg: 0 };

  // Refund modal state
  public refundOrder: Order | null = null;
  public refundReason: 'GENERIC' | 'DAMAGED' | 'EXPIRED' | 'CUSTOMER_ERROR' = 'GENERIC';
  public refundNotes = '';
  public refundLines: { menuItemId: number; quantity: number; maxQty: number }[] = [];
  public refundSubmitting = false;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private ordersService: OrdersService,
    private store: Store,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.initializeSubscriptions();
    this.initializeTimeSinceLastUpdate();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.ordersService.getAllOrders(1, 500).subscribe({
        next: (orders) => {
          this.allOrders = orders ?? [];
          this.lastUpdated = new Date();
          this.applyFilter();
          this.isLoading = false;
        },
        error: () => {
          this.toastr.error('Failed to load orders');
          this.isLoading = false;
        },
      }),
    );
  }

  setDateFilter(filter: DateFilter): void {
    this.dateFilter = filter;
    this.currentPage = 1;
    this.applyFilter();
  }

  onCustomDateChange(): void {
    this.dateFilter = 'custom';
    this.currentPage = 1;
    this.applyFilter();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.paginate();
  }

  openCreateModal() {
    this.store.dispatch(openCreateOrderModal());
  }

  openRefundModal(order: Order): void {
    this.refundOrder = order;
    this.refundReason = 'GENERIC';
    this.refundNotes = '';
    this.refundLines = Object.entries(order.menuItemQuantities || {}).map(([id, qty]) => ({
      menuItemId: Number(id),
      quantity: qty,
      maxQty: qty,
    }));
  }

  closeRefundModal(): void {
    this.refundOrder = null;
    this.refundLines = [];
    this.refundSubmitting = false;
  }

  submitRefund(): void {
    if (!this.refundOrder) return;
    const items = this.refundLines.filter((l) => l.quantity > 0);
    if (items.length === 0) {
      this.toastr.error('Sélectionnez au moins une quantité à retourner');
      return;
    }
    this.refundSubmitting = true;
    this.subscriptions.add(
      this.ordersService
        .refundOrder(this.refundOrder.id, {
          items: items.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
          reason: this.refundReason,
          notes: this.refundNotes || undefined,
        })
        .subscribe({
          next: () => {
            this.toastr.success('Retour enregistré');
            this.closeRefundModal();
            this.loadOrders();
          },
          error: (err) => {
            this.refundSubmitting = false;
            this.toastr.error(err?.error?.error || 'Échec du retour');
          },
        }),
    );
  }

  private applyFilter(): void {
    const range = this.computeRange();
    this.filteredOrders = range
      ? this.allOrders.filter((o) => this.isInRange(new Date(o.createdOn), range))
      : [...this.allOrders];

    this.computeStats();
    this.totalPages = Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    this.paginate();
  }

  private paginate(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.orders = this.filteredOrders.slice(start, start + this.pageSize);
  }

  private computeStats(): void {
    const orders = this.filteredOrders;
    const revenue = orders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
    const paid = orders.filter((o) => o.paid).length;
    this.stats = {
      count: orders.length,
      revenue,
      paid,
      avg: orders.length ? revenue / orders.length : 0,
    };
  }

  private computeRange(): { start: Date; end: Date } | null {
    const now = new Date();
    if (this.dateFilter === 'all') return null;
    if (this.dateFilter === 'today') return this.dayRange(now);
    if (this.dateFilter === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return this.dayRange(y);
    }
    return this.dayRange(new Date(this.customDate));
  }

  private dayRange(d: Date): { start: Date; end: Date } {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private isInRange(date: Date, range: { start: Date; end: Date }): boolean {
    const t = date.getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private initializeTimeSinceLastUpdate(): void {
    this.timeSinceLastUpdate$ = interval(60000).pipe(
      startWith(0),
      switchMap(() => {
        const diff = new Date().getTime() - this.lastUpdated.getTime();
        return [Math.floor(diff / 60000)];
      }),
    );
  }

  private initializeSubscriptions(): void {
    this.subscriptions.add(
      this.ordersService.orderCreated$.subscribe((order) => {
        if (order) this.loadOrders();
      }),
    );
    this.subscriptions.add(
      this.ordersService.orderDeleted$.subscribe((deletedId) => {
        if (deletedId) {
          this.allOrders = this.allOrders.filter((o) => o.id !== deletedId);
          this.applyFilter();
        }
      }),
    );
    this.subscriptions.add(
      this.ordersService.orderUpdated$.subscribe((updated) => {
        if (updated) {
          const idx = this.allOrders.findIndex((o) => o.id === updated.id);
          if (idx !== -1) {
            this.allOrders[idx] = updated;
            this.applyFilter();
          }
        }
      }),
    );
  }
}
