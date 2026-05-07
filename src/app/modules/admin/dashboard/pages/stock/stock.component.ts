import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MenuItem, StockMovement, StockMovementType } from '../../../../../core/models';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';
import { MenuItemsService } from '../../../../../services/menuItems.service';
import { StockService } from '../../../../../services/stock.service';

interface MovementFormModel {
  menuItemId: number | null;
  type: StockMovementType;
  quantity: number;
  reason: string;
  referenceDoc: string;
}

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock.component.html',
})
export class StockComponent implements OnInit, OnDestroy {
  movements: StockMovement[] = [];
  products: MenuItem[] = [];
  loading = false;
  showForm = false;
  filterMenuItemId: number | null = null;

  // Searchable product filter (replaces the long select)
  filterSearch = '';
  filterDropdownOpen = false;

  page = 0;
  limit = 20;
  totalCount = 0;

  form: MovementFormModel = this.emptyForm();

  movementTypes: { value: StockMovementType; label: string; color: string }[] = [
    { value: 'IN', label: 'Entrée (réception)', color: 'green' },
    { value: 'OUT', label: 'Sortie', color: 'orange' },
    { value: 'ADJUSTMENT', label: 'Ajustement (inventaire)', color: 'blue' },
    { value: 'LOSS', label: 'Perte / casse', color: 'red' },
  ];

  private subs = new Subscription();

  constructor(
    private stockService: StockService,
    private menuItemsService: MenuItemsService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadMovements();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadProducts(): void {
    this.subs.add(
      this.menuItemsService.getAllMenuItems(1, 1000).subscribe({
        next: (res) => (this.products = res.items),
      }),
    );
  }

  loadMovements(): void {
    this.loading = true;
    const obs = this.filterMenuItemId
      ? this.stockService.movementsByMenuItem(this.filterMenuItemId, this.page, this.limit)
      : this.stockService.listMovements(this.page, this.limit);

    this.subs.add(
      obs.subscribe({
        next: (res) => {
          this.movements = res.items;
          this.totalCount = res.totalCount;
          this.loading = false;
        },
        error: () => {
          this.toaster.handelErrorToaster('Erreur de chargement');
          this.loading = false;
        },
      }),
    );
  }

  onFilterChange(): void {
    this.page = 0;
    this.loadMovements();
  }

  openForm(): void {
    this.form = this.emptyForm();
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
  }

  save(): void {
    if (!this.form.menuItemId || !this.form.type || this.form.quantity == null) {
      this.toaster.handelErrorToaster('Produit, type et quantité requis');
      return;
    }
    const payload: StockMovement = {
      menuItemId: this.form.menuItemId,
      type: this.form.type,
      quantity: this.form.quantity,
      reason: this.form.reason,
      referenceDoc: this.form.referenceDoc,
    };
    this.subs.add(
      this.stockService.createMovement(payload).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Mouvement enregistré');
          this.showForm = false;
          this.loadMovements();
          this.loadProducts();
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Échec de l’opération';
          this.toaster.handelErrorToaster(msg);
        },
      }),
    );
  }

  typeColor(type: StockMovementType): string {
    switch (type) {
      case 'IN':
        return 'bg-green-100 text-green-700';
      case 'OUT':
        return 'bg-orange-100 text-orange-700';
      case 'SALE':
        return 'bg-purple-100 text-purple-700';
      case 'ADJUSTMENT':
        return 'bg-blue-100 text-blue-700';
      case 'LOSS':
        return 'bg-red-100 text-red-700';
    }
  }

  typeLabel(type: StockMovementType): string {
    switch (type) {
      case 'IN':
        return 'Entrée';
      case 'OUT':
        return 'Sortie';
      case 'SALE':
        return 'Vente';
      case 'ADJUSTMENT':
        return 'Ajustement';
      case 'LOSS':
        return 'Perte';
    }
  }

  trackById(_: number, m: StockMovement): number {
    return m.id ?? 0;
  }

  nextPage(): void {
    if ((this.page + 1) * this.limit < this.totalCount) {
      this.page++;
      this.loadMovements();
    }
  }

  prevPage(): void {
    if (this.page > 0) {
      this.page--;
      this.loadMovements();
    }
  }

  private emptyForm(): MovementFormModel {
    return {
      menuItemId: null,
      type: 'IN',
      quantity: 1,
      reason: '',
      referenceDoc: '',
    };
  }

  filteredProducts(): MenuItem[] {
    const q = this.filterSearch.toLowerCase().trim();
    if (!q) return this.products.slice(0, 50);
    return this.products
      .filter((p) =>
        p.title?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barCode?.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }

  selectFilterProduct(p: MenuItem | null): void {
    if (p) {
      this.filterMenuItemId = p.id;
      this.filterSearch = p.title;
    } else {
      this.filterMenuItemId = null;
      this.filterSearch = '';
    }
    this.filterDropdownOpen = false;
    this.onFilterChange();
  }

  clearFilter(): void {
    this.filterMenuItemId = null;
    this.filterSearch = '';
    this.filterDropdownOpen = false;
    this.onFilterChange();
  }

  onFilterBlur(): void {
    // Delay to allow mousedown on dropdown items to fire first
    setTimeout(() => (this.filterDropdownOpen = false), 150);
  }

  /**
   * Truncate full UUIDs in the reference doc.
   * "ORDER:c4164dba-3868-4704-bbb4-5926757d8564"        → "ORDER:#c4164dba"
   * "REFUND:c4164dba-... | LOTS:1,2"                    → "REFUND:#c4164dba | LOTS:1,2"
   * "INVENTORY:42"                                      → "INVENTORY:42"
   */
  shortRef(ref: string): string {
    if (!ref) return '';
    const uuidRegex = /([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    return ref.replace(uuidRegex, '#$1');
  }

  copyRef(ref: string): void {
    if (!ref) return;
    navigator.clipboard.writeText(ref).then(
      () => this.toaster.handelSuccessToaster('Référence copiée'),
      () => this.toaster.handelErrorToaster('Échec copie'),
    );
  }
}
