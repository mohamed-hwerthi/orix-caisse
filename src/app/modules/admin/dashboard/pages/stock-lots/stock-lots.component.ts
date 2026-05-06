import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MenuItem } from '../../../../../core/models';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';
import { MenuItemsService } from '../../../../../services/menuItems.service';
import { StockLot, StockLotService } from '../../../../../services/stock-lot.service';

@Component({
  selector: 'app-stock-lots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-lots.component.html',
})
export class StockLotsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  expiring = signal<StockLot[]>([]);
  daysFilter = signal<number>(7);

  // Tracking products with expiry — to add new lot
  products: MenuItem[] = [];
  showForm = false;
  form: StockLot = this.empty();

  // Items selected to view their lots
  selectedItem = signal<MenuItem | null>(null);
  itemLots = signal<StockLot[]>([]);

  ruptureSoon = computed(() => this.expiring().filter((l) => (l.daysUntilExpiry ?? 999) <= 0).length);
  riskCount = computed(() => this.expiring().length);

  private subs = new Subscription();

  constructor(
    private stockLotService: StockLotService,
    private menuItemsService: MenuItemsService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.loadExpiring();
    this.subs.add(
      this.menuItemsService.getAllMenuItems(1, 1000).subscribe({
        next: (r) => (this.products = r.items.filter((p) => (p as any).hasExpiryDate)),
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadExpiring(): void {
    this.loading.set(true);
    this.subs.add(
      this.stockLotService.expiring(this.daysFilter()).subscribe({
        next: (lots) => {
          this.expiring.set(lots);
          this.loading.set(false);
        },
        error: () => {
          this.toaster.handelErrorToaster('Erreur de chargement');
          this.loading.set(false);
        },
      }),
    );
  }

  setDaysFilter(d: number): void {
    this.daysFilter.set(d);
    this.loadExpiring();
  }

  viewItemLots(item: MenuItem): void {
    this.selectedItem.set(item);
    this.subs.add(
      this.stockLotService.byItem(item.id).subscribe({
        next: (lots) => this.itemLots.set(lots),
      }),
    );
  }

  closeItemLots(): void {
    this.selectedItem.set(null);
    this.itemLots.set([]);
  }

  openCreate(): void {
    this.form = this.empty();
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
  }

  save(): void {
    if (!this.form.menuItemId || !this.form.quantity || !this.form.expiryDate) {
      this.toaster.handelErrorToaster('Champs obligatoires manquants');
      return;
    }
    this.subs.add(
      this.stockLotService.create(this.form).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Lot créé');
          this.showForm = false;
          this.loadExpiring();
          if (this.selectedItem()?.id === this.form.menuItemId) this.viewItemLots(this.selectedItem()!);
        },
        error: () => this.toaster.handelErrorToaster('Échec création lot'),
      }),
    );
  }

  markExpired(lot: StockLot): void {
    if (!lot.id || !confirm(`Marquer le lot #${lot.id} comme expiré ? Le stock sera décrémenté de ${lot.quantity}.`)) return;
    this.subs.add(
      this.stockLotService.markExpired(lot.id).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Lot marqué expiré');
          this.loadExpiring();
          if (this.selectedItem()) this.viewItemLots(this.selectedItem()!);
        },
      }),
    );
  }

  removeLot(lot: StockLot): void {
    if (!lot.id || !confirm(`Supprimer ce lot ? Le stock global sera réduit de ${lot.quantity} si actif.`)) return;
    this.subs.add(
      this.stockLotService.remove(lot.id).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Lot supprimé');
          this.loadExpiring();
          if (this.selectedItem()) this.viewItemLots(this.selectedItem()!);
        },
      }),
    );
  }

  badgeColor(days: number | undefined): string {
    if (days == null) return 'bg-gray-100 text-gray-600';
    if (days < 0) return 'bg-red-100 text-red-700 border-red-300';
    if (days === 0) return 'bg-red-100 text-red-700 border-red-300';
    if (days <= 3) return 'bg-orange-100 text-orange-700 border-orange-300';
    if (days <= 7) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  badgeLabel(days: number | undefined): string {
    if (days == null) return '';
    if (days < 0) return `Périmé (-${Math.abs(days)} j)`;
    if (days === 0) return 'Périme aujourd’hui';
    if (days === 1) return 'Périme demain';
    return `Dans ${days} j`;
  }

  private empty(): StockLot {
    const today = new Date().toISOString().slice(0, 10);
    const inSixMonths = new Date();
    inSixMonths.setMonth(inSixMonths.getMonth() + 6);
    return {
      menuItemId: 0,
      batchNumber: '',
      quantity: 1,
      expiryDate: inSixMonths.toISOString().slice(0, 10),
      receivedDate: today,
    };
  }
}
