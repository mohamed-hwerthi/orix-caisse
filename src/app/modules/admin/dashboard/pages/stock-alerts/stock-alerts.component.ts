import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MenuItem } from '../../../../../core/models';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';
import { MenuItemsService } from '../../../../../services/menuItems.service';

type StockState = 'rupture' | 'critique' | 'bas';

@Component({
  selector: 'app-stock-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-alerts.component.html',
})
export class StockAlertsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  items = signal<MenuItem[]>([]);
  filter = signal<'all' | StockState>('all');

  ruptureCount = computed(() => this.items().filter((i) => (i.stockQuantity ?? 0) <= 0).length);
  basCount = computed(
    () => this.items().filter((i) => (i.stockQuantity ?? 0) > 0 && (i.stockQuantity ?? 0) <= (i.minStockAlert ?? 0)).length,
  );

  filtered = computed(() => {
    const f = this.filter();
    if (f === 'all') return this.items();
    return this.items().filter((i) => this.stateOf(i) === f);
  });

  totalReorderCost = computed(() =>
    this.items().reduce((sum, i) => {
      const reorder = i.reorderQty ?? this.suggestedReorder(i);
      const cost = (i.purchasePrice ?? 0) * reorder;
      return sum + cost;
    }, 0),
  );

  private subs = new Subscription();

  constructor(
    private menuItemsService: MenuItemsService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  load(): void {
    this.loading.set(true);
    this.subs.add(
      this.menuItemsService.getLowStockItems().subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.toaster.handelErrorToaster('Erreur de chargement');
          this.loading.set(false);
        },
      }),
    );
  }

  stateOf(i: MenuItem): StockState {
    const qty = i.stockQuantity ?? 0;
    const min = i.minStockAlert ?? 0;
    if (qty <= 0) return 'rupture';
    if (qty <= Math.floor(min / 2)) return 'critique';
    return 'bas';
  }

  stateLabel(i: MenuItem): { label: string; color: string } {
    const s = this.stateOf(i);
    if (s === 'rupture') return { label: 'RUPTURE', color: 'bg-red-100 text-red-700 border-red-300' };
    if (s === 'critique') return { label: 'Critique', color: 'bg-orange-100 text-orange-700 border-orange-300' };
    return { label: 'Bas', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
  }

  suggestedReorder(i: MenuItem): number {
    if (i.reorderQty != null && i.reorderQty > 0) return i.reorderQty;
    const min = i.minStockAlert ?? 0;
    const qty = i.stockQuantity ?? 0;
    return Math.max(min * 2, 10) - qty;
  }

  exportCsv(): void {
    const rows = [
      ['SKU', 'Article', 'Stock actuel', 'Seuil', 'État', 'Suggestion réappro', 'Prix achat', 'Coût estimé'],
      ...this.filtered().map((i) => [
        i.sku ?? '',
        i.title,
        (i.stockQuantity ?? 0).toString(),
        (i.minStockAlert ?? 0).toString(),
        this.stateOf(i),
        this.suggestedReorder(i).toString(),
        (i.purchasePrice ?? 0).toFixed(2),
        ((i.purchasePrice ?? 0) * this.suggestedReorder(i)).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
