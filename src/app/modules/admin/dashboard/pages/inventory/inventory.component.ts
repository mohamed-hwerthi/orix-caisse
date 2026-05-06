import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';
import { InventoryCount, InventorySession, InventoryService } from '../../../../../services/inventory.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
})
export class InventoryComponent implements OnInit, OnDestroy {
  loading = signal(true);
  sessions = signal<InventorySession[]>([]);
  active = signal<InventorySession | null>(null);
  search = '';

  newLabel = '';
  newNotes = '';
  showCreate = false;

  filtered = computed(() => {
    const s = this.active();
    if (!s) return [] as InventoryCount[];
    const q = this.search.toLowerCase().trim();
    if (!q) return s.counts ?? [];
    return (s.counts ?? []).filter(
      (c) => (c.menuItemTitle || '').toLowerCase().includes(q) || (c.sku || '').toLowerCase().includes(q),
    );
  });

  diffCount = computed(() => (this.active()?.counts ?? []).filter((c) => (c.countedQuantity ?? 0) !== (c.expectedQuantity ?? 0)).length);
  totalDelta = computed(() =>
    (this.active()?.counts ?? []).reduce((sum, c) => sum + ((c.countedQuantity ?? 0) - (c.expectedQuantity ?? 0)), 0),
  );

  private subs = new Subscription();

  constructor(
    private inventoryService: InventoryService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.loadList();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadList(): void {
    this.loading.set(true);
    this.subs.add(
      this.inventoryService.list().subscribe({
        next: (data) => {
          this.sessions.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toaster.handelErrorToaster('Erreur de chargement');
        },
      }),
    );
  }

  open(s: InventorySession): void {
    if (!s.id) return;
    this.subs.add(
      this.inventoryService.byId(s.id).subscribe({
        next: (full) => this.active.set(full),
      }),
    );
  }

  close(): void {
    this.active.set(null);
    this.search = '';
  }

  startCreate(): void {
    this.newLabel = `Inventaire ${new Date().toLocaleDateString('fr-FR')}`;
    this.newNotes = '';
    this.showCreate = true;
  }

  cancelCreate(): void {
    this.showCreate = false;
  }

  doCreate(): void {
    if (!this.newLabel.trim()) return;
    this.subs.add(
      this.inventoryService.create({ label: this.newLabel, notes: this.newNotes }).subscribe({
        next: (s) => {
          this.toaster.handelSuccessToaster('Session créée');
          this.showCreate = false;
          this.loadList();
          this.active.set(s);
        },
        error: () => this.toaster.handelErrorToaster('Échec création'),
      }),
    );
  }

  saveCounts(): void {
    const s = this.active();
    if (!s?.id) return;
    this.subs.add(
      this.inventoryService.updateCounts(s.id, s.counts ?? []).subscribe({
        next: (updated) => {
          this.toaster.handelSuccessToaster('Comptages enregistrés');
          this.active.set(updated);
        },
      }),
    );
  }

  commitSession(): void {
    const s = this.active();
    if (!s?.id) return;
    if (!confirm(`Valider la session ? ${this.diffCount()} ajustement(s) seront générés.`)) return;
    this.subs.add(
      this.inventoryService.commit(s.id).subscribe({
        next: (committed) => {
          this.toaster.handelSuccessToaster('Inventaire validé — stock mis à jour');
          this.active.set(committed);
          this.loadList();
        },
      }),
    );
  }

  cancelSession(): void {
    const s = this.active();
    if (!s?.id || !confirm('Annuler cette session ?')) return;
    this.subs.add(
      this.inventoryService.cancel(s.id).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Session annulée');
          this.close();
          this.loadList();
        },
      }),
    );
  }

  exportCsv(): void {
    const s = this.active();
    if (!s) return;
    const rows = [
      ['SKU', 'Article', 'Stock attendu', 'Stock compté', 'Écart'],
      ...(s.counts ?? []).map((c) => [
        c.sku ?? '',
        c.menuItemTitle ?? '',
        String(c.expectedQuantity ?? 0),
        String(c.countedQuantity ?? 0),
        String((c.countedQuantity ?? 0) - (c.expectedQuantity ?? 0)),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire-${s.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  isReadonly(): boolean {
    return this.active()?.status !== 'DRAFT';
  }

  badgeForStatus(status?: string): { label: string; color: string } {
    switch (status) {
      case 'COMMITTED':
        return { label: 'Validé', color: 'bg-green-100 text-green-700' };
      case 'CANCELLED':
        return { label: 'Annulé', color: 'bg-gray-200 text-gray-600' };
      default:
        return { label: 'Brouillon', color: 'bg-yellow-100 text-yellow-700' };
    }
  }
}
