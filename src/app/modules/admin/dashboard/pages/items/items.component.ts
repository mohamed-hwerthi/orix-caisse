import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MenuItem } from '../../../../../core/models';
import { MenuItemsService } from '../../../../../services/menuItems.service';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';

interface ItemFormModel {
  id?: number;
  title: string;
  description: string;
  barCode?: string;
  sku?: string;
  price: number;
  purchasePrice?: number;
  stockQuantity: number;
  minStockAlert: number;
  unit?: string;
  isActive: boolean;
}

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
})
export class ItemsComponent implements OnInit, OnDestroy {
  items: MenuItem[] = [];
  lowStockOnly = false;
  loading = false;
  showForm = false;
  editing = false;
  search = '';

  // Filtres avancés
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  stockFilter: 'all' | 'in' | 'low' | 'out' = 'all';
  sortBy: 'title' | 'price' | 'stock' | 'margin' = 'title';
  sortDir: 'asc' | 'desc' = 'asc';

  form: ItemFormModel = this.emptyForm();
  errors: { [field: string]: string } = {};
  submitted = false;

  page = 1;
  limit = 10;
  totalCount = 0;
  pageSizes = [10, 20, 50, 100];

  private subs = new Subscription();

  constructor(
    private menuItemsService: MenuItemsService,
    private toaster: CustomToasterService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
    // Auto-trigger edit/delete from query param (used when arriving from /admin/dashboard table)
    this.subs.add(
      this.route.queryParams.subscribe((params) => {
        const editId = params['edit'] ? Number(params['edit']) : null;
        const deleteId = params['delete'] ? Number(params['delete']) : null;
        if (!editId && !deleteId) return;
        // Wait for items list to load, then trigger
        const tryTrigger = () => {
          if (this.loading || this.items.length === 0) {
            setTimeout(tryTrigger, 200);
            return;
          }
          if (editId) {
            const item = this.items.find((i) => i.id === editId);
            if (item) this.openEdit(item);
          } else if (deleteId) {
            const item = this.items.find((i) => i.id === deleteId);
            if (item) this.remove(item);
          }
          // Clear the query param so refresh doesn't re-trigger
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        };
        tryTrigger();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  load(): void {
    this.loading = true;
    // Charger TOUS les articles (filtre/tri/pagination en local)
    this.subs.add(
      this.menuItemsService.getAllMenuItems(1, 1000).subscribe({
        next: (res) => {
          this.items = res.items;
          this.loading = false;
          this.page = 1;
        },
        error: () => {
          this.toaster.handelErrorToaster('Erreur de chargement');
          this.loading = false;
        },
      }),
    );
  }

  toggleLowStock(): void {
    this.lowStockOnly = !this.lowStockOnly;
    this.stockFilter = this.lowStockOnly ? 'low' : 'all';
    this.page = 1;
  }

  setStatusFilter(v: 'all' | 'active' | 'inactive'): void {
    this.statusFilter = v;
    this.page = 1;
  }

  setStockFilter(v: 'all' | 'in' | 'low' | 'out'): void {
    this.stockFilter = v;
    this.page = 1;
  }

  statusOptions: { v: 'all' | 'active' | 'inactive'; label: string }[] = [
    { v: 'all', label: 'Tous' },
    { v: 'active', label: 'Actifs' },
    { v: 'inactive', label: 'Inactifs' },
  ];

  stockOptions: { v: 'all' | 'in' | 'low' | 'out'; label: string; icon: string }[] = [
    { v: 'all', label: 'Tous', icon: '📦' },
    { v: 'in', label: 'En stock', icon: '✓' },
    { v: 'low', label: 'Stock bas', icon: '⚠' },
    { v: 'out', label: 'Rupture', icon: '✗' },
  ];

  resetFilters(): void {
    this.search = '';
    this.statusFilter = 'all';
    this.stockFilter = 'all';
    this.lowStockOnly = false;
    this.sortBy = 'title';
    this.sortDir = 'asc';
    this.page = 1;
  }

  setSort(col: 'title' | 'price' | 'stock' | 'margin'): void {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
  }

  sortIcon(col: string): string {
    if (this.sortBy !== col) return '↕';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  // Filtrage + tri
  filteredItems(): MenuItem[] {
    let list = [...this.items];

    // Recherche
    const q = this.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (it) =>
          it.title?.toLowerCase().includes(q) ||
          it.barCode?.toLowerCase().includes(q) ||
          it.sku?.toLowerCase().includes(q),
      );
    }

    // Statut
    if (this.statusFilter === 'active') list = list.filter((it) => it.isActive !== false);
    if (this.statusFilter === 'inactive') list = list.filter((it) => it.isActive === false);

    // Stock
    if (this.stockFilter === 'low') list = list.filter((it) => this.isLow(it) && (it.stockQuantity ?? 0) > 0);
    if (this.stockFilter === 'out') list = list.filter((it) => (it.stockQuantity ?? 0) <= 0);
    if (this.stockFilter === 'in') list = list.filter((it) => (it.stockQuantity ?? 0) > 0 && !this.isLow(it));

    // Tri
    list.sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortBy) {
        case 'price': va = a.price ?? 0; vb = b.price ?? 0; break;
        case 'stock': va = a.stockQuantity ?? 0; vb = b.stockQuantity ?? 0; break;
        case 'margin': va = this.margin(a) ?? -Infinity; vb = this.margin(b) ?? -Infinity; break;
        default: va = (a.title ?? '').toLowerCase(); vb = (b.title ?? '').toLowerCase();
      }
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }

  // Pagination
  pagedItems(): MenuItem[] {
    const all = this.filteredItems();
    const start = (this.page - 1) * this.limit;
    return all.slice(start, start + this.limit);
  }

  get totalFiltered(): number {
    return this.filteredItems().length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalFiltered / this.limit));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur = this.page;
    const pages: number[] = [];
    const window = 2;
    const start = Math.max(1, cur - window);
    const end = Math.min(total, cur + window);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
  }

  changeLimit(n: number): void {
    this.limit = n;
    this.page = 1;
  }

  openCreate(): void {
    this.editing = false;
    this.form = this.emptyForm();
    this.errors = {};
    this.submitted = false;
    this.showForm = true;
  }

  openEdit(it: MenuItem): void {
    this.editing = true;
    this.form = {
      id: it.id,
      title: it.title,
      description: it.description ?? '',
      barCode: it.barCode,
      sku: it.sku,
      price: it.price,
      purchasePrice: it.purchasePrice,
      stockQuantity: it.stockQuantity ?? 0,
      minStockAlert: it.minStockAlert ?? 0,
      unit: it.unit,
      isActive: it.isActive ?? true,
    };
    this.errors = {};
    this.submitted = false;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
  }

  validate(): boolean {
    const e: { [k: string]: string } = {};
    const f = this.form;

    // Titre
    const title = (f.title || '').trim();
    if (!title) e['title'] = 'Le titre est obligatoire';
    else if (title.length < 2) e['title'] = 'Le titre doit faire au moins 2 caractères';
    else if (title.length > 150) e['title'] = 'Le titre ne peut dépasser 150 caractères';

    // Description
    if (f.description && f.description.length > 500) e['description'] = 'La description ne peut dépasser 500 caractères';

    // SKU
    if (f.sku && !/^[A-Za-z0-9\-_]{2,50}$/.test(f.sku)) {
      e['sku'] = 'SKU : 2-50 caractères (lettres, chiffres, - ou _)';
    }

    // Code-barres
    if (f.barCode && !/^[0-9]{6,14}$/.test(f.barCode)) {
      e['barCode'] = 'Code-barres : 6 à 14 chiffres';
    }

    // Prix vente
    if (f.price == null || isNaN(Number(f.price))) {
      e['price'] = 'Le prix de vente est obligatoire';
    } else if (Number(f.price) <= 0) {
      e['price'] = 'Le prix de vente doit être strictement positif';
    } else if (Number(f.price) > 999999) {
      e['price'] = 'Prix trop élevé';
    }

    // Prix achat
    if (f.purchasePrice != null && f.purchasePrice !== ('' as any)) {
      const pa = Number(f.purchasePrice);
      if (isNaN(pa)) e['purchasePrice'] = 'Valeur invalide';
      else if (pa < 0) e['purchasePrice'] = 'Le prix d\'achat ne peut être négatif';
      else if (f.price && pa > Number(f.price)) {
        e['purchasePrice'] = 'Le prix d\'achat ne devrait pas dépasser le prix de vente';
      }
    }

    // Stock
    if (f.stockQuantity != null && (isNaN(Number(f.stockQuantity)) || Number(f.stockQuantity) < 0)) {
      e['stockQuantity'] = 'Le stock doit être un nombre ≥ 0';
    }
    if (!Number.isInteger(Number(f.stockQuantity ?? 0))) {
      e['stockQuantity'] = 'Le stock doit être un nombre entier';
    }

    // Seuil
    if (f.minStockAlert != null && (isNaN(Number(f.minStockAlert)) || Number(f.minStockAlert) < 0)) {
      e['minStockAlert'] = 'Le seuil doit être un nombre ≥ 0';
    }
    if (!Number.isInteger(Number(f.minStockAlert ?? 0))) {
      e['minStockAlert'] = 'Le seuil doit être un nombre entier';
    }

    this.errors = e;
    return Object.keys(e).length === 0;
  }

  hasError(field: string): boolean {
    return this.submitted && !!this.errors[field];
  }

  onFieldChange(): void {
    if (this.submitted) {
      this.validate();
    }
  }

  fieldClass(field: string): string {
    return this.hasError(field) ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
  }

  save(): void {
    this.submitted = true;
    if (!this.validate()) {
      this.toaster.handelErrorToaster('Veuillez corriger les erreurs du formulaire');
      return;
    }
    const payload = { ...this.form } as Partial<MenuItem>;

    if (this.editing && this.form.id) {
      this.subs.add(
        this.menuItemsService.updateMenuItem(this.form.id, payload).subscribe({
          next: () => {
            this.toaster.handelSuccessToaster('Produit mis à jour');
            this.showForm = false;
            this.load();
          },
          error: () => this.toaster.handelErrorToaster('Échec de la mise à jour'),
        }),
      );
    } else {
      this.subs.add(
        this.menuItemsService.createMenuItem(payload as MenuItem).subscribe({
          next: () => {
            this.toaster.handelSuccessToaster('Produit créé');
            this.showForm = false;
            this.load();
          },
          error: () => this.toaster.handelErrorToaster('Échec de la création'),
        }),
      );
    }
  }

  remove(it: MenuItem): void {
    if (!confirm(`Supprimer "${it.title}" ?`)) return;
    this.subs.add(
      this.menuItemsService.deleteMenuItem(it.id).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Produit supprimé');
          this.load();
        },
        error: () => this.toaster.handelErrorToaster('Échec de la suppression'),
      }),
    );
  }

  isLow(it: MenuItem): boolean {
    if (it.lowStock != null) return it.lowStock;
    return (it.stockQuantity ?? 0) <= (it.minStockAlert ?? 0);
  }

  margin(it: MenuItem): number | null {
    if (it.purchasePrice == null || !it.price) return null;
    return ((it.price - it.purchasePrice) / it.price) * 100;
  }

  // KPI
  get totalActive(): number {
    return this.items.filter((it) => it.isActive !== false).length;
  }

  get totalLow(): number {
    return this.items.filter((it) => this.isLow(it)).length;
  }

  get totalStockUnits(): number {
    return this.items.reduce((sum, it) => sum + (it.stockQuantity ?? 0), 0);
  }

  get totalStockValue(): number {
    return this.items.reduce((sum, it) => sum + (it.stockQuantity ?? 0) * (it.purchasePrice ?? 0), 0);
  }

  initials(title: string): string {
    if (!title) return '?';
    return title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }

  colorFromTitle(title: string): string {
    const palette = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-indigo-500', 'bg-fuchsia-500', 'bg-teal-500', 'bg-orange-500'];
    let hash = 0;
    for (let i = 0; i < (title || '').length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  trackById(_: number, it: MenuItem): number {
    return it.id;
  }

  private emptyForm(): ItemFormModel {
    return {
      title: '',
      description: '',
      barCode: '',
      sku: '',
      price: 0,
      purchasePrice: 0,
      stockQuantity: 0,
      minStockAlert: 0,
      unit: 'pcs',
      isActive: true,
    };
  }
}
