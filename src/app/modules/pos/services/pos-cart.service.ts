import { Injectable, computed, signal } from '@angular/core';
import { MenuItem } from '../../../core/models';

export interface PosLine {
  menuItemId: number;
  title: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class PosCartService {
  private readonly _lines = signal<PosLine[]>([]);

  readonly lines = this._lines.asReadonly();

  readonly count = computed(() =>
    this._lines().reduce((sum, l) => sum + l.quantity, 0),
  );

  readonly totalTTC = computed(() =>
    round2(this._lines().reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
  );

  readonly totalTax = computed(() =>
    round2(
      this._lines().reduce((s, l) => {
        const rate = l.taxRate || 0;
        const ht = l.unitPrice / (1 + rate / 100);
        return s + (l.unitPrice - ht) * l.quantity;
      }, 0),
    ),
  );

  readonly totalHT = computed(() => round2(this.totalTTC() - this.totalTax()));

  add(item: MenuItem, qty = 1): void {
    const lines = [...this._lines()];
    const idx = lines.findIndex((l) => l.menuItemId === item.id);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + qty };
    } else {
      lines.push({
        menuItemId: item.id,
        title: item.title,
        unitPrice: item.price,
        taxRate: item.tax?.rate ?? 0,
        quantity: qty,
      });
    }
    this._lines.set(lines);
  }

  setQuantity(menuItemId: number, quantity: number): void {
    if (quantity <= 0) {
      this.remove(menuItemId);
      return;
    }
    this._lines.set(
      this._lines().map((l) =>
        l.menuItemId === menuItemId ? { ...l, quantity } : l,
      ),
    );
  }

  increment(menuItemId: number): void {
    const line = this._lines().find((l) => l.menuItemId === menuItemId);
    if (line) this.setQuantity(menuItemId, line.quantity + 1);
  }

  decrement(menuItemId: number): void {
    const line = this._lines().find((l) => l.menuItemId === menuItemId);
    if (line) this.setQuantity(menuItemId, line.quantity - 1);
  }

  remove(menuItemId: number): void {
    this._lines.set(this._lines().filter((l) => l.menuItemId !== menuItemId));
  }

  clear(): void {
    this._lines.set([]);
  }

  toOrderQuantities(): { [menuItemId: number]: number } {
    const map: { [k: number]: number } = {};
    this._lines().forEach((l) => (map[l.menuItemId] = l.quantity));
    return map;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
