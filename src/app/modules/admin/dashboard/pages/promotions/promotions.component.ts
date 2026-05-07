import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { CategoryDTO } from '../../../../../core/models/categoryDTO.model';
import { MenuItem, Promotion, PromotionType } from '../../../../../core/models';
import { CategoryService } from '../../../../../services/category.service';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';
import { MenuItemsService } from '../../../../../services/menuItems.service';
import { PromotionOrderRow, PromotionService, PromotionStats } from '../../../../../services/promotion.service';

type StatusFilter = 'all' | 'active' | 'upcoming' | 'expired' | 'inactive';
type TypeFilter = PromotionType | 'all';
type SortKey = 'name' | 'value' | 'startDate' | 'endDate' | 'status';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotions.component.html',
})
export class PromotionsComponent implements OnInit, OnDestroy {
  promotions = signal<Promotion[]>([]);
  products: MenuItem[] = [];
  categories: CategoryDTO[] = [];
  loading = false;
  showForm = false;
  editing = false;
  form: Promotion = this.empty();
  formErrors: string[] = [];

  // Stepper
  currentStep = signal<number>(1);
  readonly totalSteps = 3;
  steps = [
    { n: 1, title: 'Informations', subtitle: 'Nom et description', icon: '📝' },
    { n: 2, title: 'Remise', subtitle: 'Type, valeur et période', icon: '💰' },
    { n: 3, title: 'Cibles', subtitle: 'Articles ciblés', icon: '🎯' },
  ];

  productSearch = '';

  // Filtres
  searchInput = '';
  searchTerm = signal('');
  statusFilter = signal<StatusFilter>('all');
  typeFilter = signal<TypeFilter>('all');

  // Tri
  sortKey = signal<SortKey>('endDate');
  sortDir = signal<SortDir>('desc');

  // Pagination
  pageSize = signal<number>(10);
  currentPage = signal<number>(1);

  // Sélection
  selectedIds = signal<Set<number>>(new Set());

  // Stats
  statsByPromoId = signal<Map<number, PromotionStats>>(new Map());

  // Stats modal
  showStatsModal = false;
  statsLoading = false;
  selectedStats: PromotionStats | null = null;
  selectedStatsOrders: PromotionOrderRow[] = [];

  promotionTypes: { value: PromotionType; label: string; suffix: string }[] = [
    { value: 'PERCENT', label: 'Pourcentage', suffix: '%' },
    { value: 'FIXED_AMOUNT', label: 'Montant fixe (-)', suffix: 'DT' },
    { value: 'FIXED_PRICE', label: 'Prix imposé (=)', suffix: 'DT' },
  ];

  statusFilters: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Toutes', color: 'bg-gray-100 text-gray-700' },
    { key: 'active', label: 'En cours', color: 'bg-green-100 text-green-700' },
    { key: 'upcoming', label: 'À venir', color: 'bg-yellow-100 text-yellow-700' },
    { key: 'expired', label: 'Expirées', color: 'bg-red-100 text-red-700' },
    { key: 'inactive', label: 'Inactives', color: 'bg-gray-200 text-gray-600' },
  ];

  filtered = computed<Promotion[]>(() => {
    const search = this.searchTerm().toLowerCase().trim();
    const status = this.statusFilter();
    const type = this.typeFilter();

    let list = this.promotions().filter((p) => {
      if (search && !this.matchSearch(p, search)) return false;
      if (status !== 'all' && this.statusKey(p) !== status) return false;
      if (type !== 'all' && p.type !== type) return false;
      return true;
    });

    return this.sortList(list, this.sortKey(), this.sortDir());
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));

  paginated = computed<Promotion[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  allOnPageSelected = computed<boolean>(() => {
    const ids = this.paginated().map((p) => p.id).filter((id): id is number => id != null);
    if (ids.length === 0) return false;
    const sel = this.selectedIds();
    return ids.every((id) => sel.has(id));
  });

  selectionCount = computed(() => this.selectedIds().size);

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  private subs = new Subscription();
  private searchSubject = new Subject<string>();

  constructor(
    private promotionService: PromotionService,
    private menuItemsService: MenuItemsService,
    private categoryService: CategoryService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.subs.add(this.menuItemsService.getAllMenuItems(1, 1000).subscribe({ next: (r) => (this.products = r.items) }));
    this.subs.add(this.categoryService.findAllCategories().subscribe({ next: (c) => (this.categories = c) }));
    this.subs.add(
      this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((v) => {
        this.searchTerm.set(v);
        this.currentPage.set(1);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  setStatusFilter(s: StatusFilter): void {
    this.statusFilter.set(s);
    this.currentPage.set(1);
  }

  setTypeFilter(t: TypeFilter): void {
    this.typeFilter.set(t);
    this.currentPage.set(1);
  }

  setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  resetFilters(): void {
    this.searchInput = '';
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.typeFilter.set('all');
    this.currentPage.set(1);
  }

  // Sélection
  toggleSelection(id: number | undefined): void {
    if (id == null) return;
    const sel = new Set(this.selectedIds());
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    this.selectedIds.set(sel);
  }

  isSelected(id: number | undefined): boolean {
    return id != null && this.selectedIds().has(id);
  }

  toggleAllOnPage(): void {
    const ids = this.paginated().map((p) => p.id).filter((id): id is number => id != null);
    const sel = new Set(this.selectedIds());
    const allSelected = ids.every((id) => sel.has(id));
    if (allSelected) ids.forEach((id) => sel.delete(id));
    else ids.forEach((id) => sel.add(id));
    this.selectedIds.set(sel);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  bulkDelete(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    if (!confirm(`Supprimer ${ids.length} promotion(s) ?`)) return;
    let done = 0;
    let failed = 0;
    ids.forEach((id) => {
      this.subs.add(
        this.promotionService.remove(id).subscribe({
          next: () => {
            done++;
            if (done + failed === ids.length) this.afterBulk(done, failed);
          },
          error: () => {
            failed++;
            if (done + failed === ids.length) this.afterBulk(done, failed);
          },
        }),
      );
    });
  }

  bulkSetActive(active: boolean): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    const targets = this.promotions().filter((p) => p.id != null && ids.includes(p.id));
    let done = 0;
    let failed = 0;
    targets.forEach((p) => {
      const updated = { ...p, isActive: active };
      this.subs.add(
        this.promotionService.update(p.id!, updated).subscribe({
          next: () => {
            done++;
            if (done + failed === targets.length) this.afterBulk(done, failed);
          },
          error: () => {
            failed++;
            if (done + failed === targets.length) this.afterBulk(done, failed);
          },
        }),
      );
    });
  }

  private afterBulk(done: number, failed: number): void {
    if (failed === 0) {
      this.toaster.handelSuccessToaster(`${done} promotion(s) traitée(s)`);
    } else {
      this.toaster.handelErrorToaster(`${done} OK / ${failed} en échec`);
    }
    this.clearSelection();
    this.load();
  }

  // CRUD existing
  load(): void {
    this.loading = true;
    this.subs.add(
      this.promotionService.getAll().subscribe({
        next: (data) => {
          this.promotions.set(data);
          this.loading = false;
          this.loadStats();
        },
        error: () => {
          this.toaster.handelErrorToaster('Erreur de chargement');
          this.loading = false;
        },
      }),
    );
  }

  private loadStats(): void {
    this.subs.add(
      this.promotionService.getAllStats().subscribe({
        next: (stats) => {
          const m = new Map<number, PromotionStats>();
          for (const s of stats) m.set(s.promotionId, s);
          this.statsByPromoId.set(m);
        },
      }),
    );
  }

  getStats(id: number | undefined): PromotionStats | null {
    if (id == null) return null;
    return this.statsByPromoId().get(id) ?? null;
  }

  openStats(p: Promotion): void {
    if (!p.id) return;
    this.statsLoading = true;
    this.showStatsModal = true;
    this.selectedStats = null;
    this.selectedStatsOrders = [];
    this.subs.add(
      this.promotionService.getStats(p.id).subscribe({
        next: (s) => {
          this.selectedStats = s;
          this.statsLoading = false;
        },
        error: () => {
          this.toaster.handelErrorToaster('Échec du chargement des stats');
          this.statsLoading = false;
        },
      }),
    );
    this.subs.add(
      this.promotionService.getOrdersUsing(p.id).subscribe({
        next: (rows) => (this.selectedStatsOrders = rows),
      }),
    );
  }

  closeStats(): void {
    this.showStatsModal = false;
    this.selectedStats = null;
    this.selectedStatsOrders = [];
  }

  exportPromoOrdersCsv(): void {
    if (!this.selectedStats || this.selectedStatsOrders.length === 0) return;
    const headers = ['Order ID', 'Date', 'Buyer', 'Status', 'Original', 'Discount', 'Total'];
    const rows = this.selectedStatsOrders.map((o) => [
      o.orderId,
      o.createdOn,
      o.userEmail,
      o.status,
      o.originalAmount.toFixed(2),
      o.discountAmount.toFixed(2),
      o.totalCost.toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promo-${this.selectedStats.promotionId}-orders.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openCreate(): void {
    this.editing = false;
    this.form = this.empty();
    this.formErrors = [];
    this.currentStep.set(1);
    this.productSearch = '';
    this.showForm = true;
  }

  openEdit(p: Promotion): void {
    this.editing = true;
    this.form = structuredClone(p);
    this.formErrors = [];
    this.currentStep.set(1);
    this.productSearch = '';
    this.showForm = true;
  }

  duplicate(p: Promotion): void {
    this.editing = false;
    const copy = structuredClone(p);
    copy.id = undefined;
    copy.usesCount = 0;
    copy.name = `${p.name} (copie)`;
    if (copy.promoCode) copy.promoCode = `${copy.promoCode}-COPY`;
    this.form = copy;
    this.formErrors = [];
    this.currentStep.set(1);
    this.productSearch = '';
    this.showForm = true;
  }

  // Stepper helpers
  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps) return;
    // Allow going back freely; for forward, validate the current step first
    if (step > this.currentStep()) {
      const err = this.validateStep(this.currentStep());
      if (err) {
        this.toaster.handelErrorToaster(err);
        return;
      }
    }
    this.currentStep.set(step);
  }

  nextStep(): void {
    const err = this.validateStep(this.currentStep());
    if (err) {
      this.toaster.handelErrorToaster(err);
      return;
    }
    if (this.currentStep() < this.totalSteps) this.currentStep.set(this.currentStep() + 1);
  }

  prevStep(): void {
    if (this.currentStep() > 1) this.currentStep.set(this.currentStep() - 1);
  }

  isStepValid(step: number): boolean {
    return this.validateStep(step) == null;
  }

  validateStep(step: number): string | null {
    switch (step) {
      case 1:
        if (!this.form.name?.trim()) return 'Le nom est obligatoire';
        return null;
      case 2:
        if (this.form.value == null) return 'La valeur est obligatoire';
        if (this.form.value <= 0) return 'La valeur doit être supérieure à 0';
        if (this.form.type === 'PERCENT' && this.form.value > 100) return 'Le pourcentage doit être entre 1 et 100';
        if (!this.form.startDate) return 'Date de début obligatoire';
        if (!this.form.endDate) return 'Date de fin obligatoire';
        if (this.form.endDate < this.form.startDate) return 'La date de fin doit être après la date de début';
        return null;
      case 3:
        return null; // Cibles optionnelles
      default:
        return null;
    }
  }

  filteredProducts(): MenuItem[] {
    const q = this.productSearch.toLowerCase().trim();
    if (!q) return this.products;
    return this.products.filter((p) => p.title?.toLowerCase().includes(q));
  }

  selectAllCategories(): void {
    this.form.categoryIds = this.categories.map((c) => c.id);
  }

  clearCategories(): void {
    this.form.categoryIds = [];
  }

  selectAllProducts(): void {
    this.form.menuItemIds = this.products.map((p) => p.id);
  }

  clearProducts(): void {
    this.form.menuItemIds = [];
  }

  promoTypeLabel(type: PromotionType): string {
    const t = this.promotionTypes.find((x) => x.value === type);
    return t?.label || type;
  }

  promoTypeSuffix(type: PromotionType): string {
    const t = this.promotionTypes.find((x) => x.value === type);
    return t?.suffix || '';
  }

  closeForm(): void {
    this.showForm = false;
  }

  validateForm(): string[] {
    const errors: string[] = [];
    if (!this.form.name?.trim()) errors.push('Nom obligatoire');
    if (!this.form.startDate) errors.push('Date de début obligatoire');
    if (!this.form.endDate) errors.push('Date de fin obligatoire');
    if (this.form.value == null) errors.push('Valeur obligatoire');
    if (this.form.value != null && this.form.value <= 0) errors.push('La valeur doit être supérieure à 0');
    if (this.form.type === 'PERCENT' && this.form.value != null && this.form.value > 100) {
      errors.push('Le pourcentage doit être entre 0 et 100');
    }
    if (this.form.startDate && this.form.endDate && this.form.endDate < this.form.startDate) {
      errors.push('La date de fin doit être après la date de début');
    }
    return errors;
  }

  get isFormValid(): boolean {
    return this.validateForm().length === 0;
  }

  save(): void {
    this.formErrors = this.validateForm();
    if (this.formErrors.length > 0) {
      this.toaster.handelErrorToaster(this.formErrors[0]);
      return;
    }

    const op = this.editing && this.form.id
      ? this.promotionService.update(this.form.id, this.form)
      : this.promotionService.create(this.form);

    this.subs.add(
      op.subscribe({
        next: () => {
          this.toaster.handelSuccessToaster(this.editing ? 'Promotion mise à jour' : 'Promotion créée');
          this.showForm = false;
          this.formErrors = [];
          this.load();
        },
        error: (err) => this.handleSaveError(err),
      }),
    );
  }

  private handleSaveError(err: any): void {
    const status = err?.status;
    const backendMsg = err?.error?.message || err?.error?.detail;
    if (status === 409) {
      this.toaster.handelErrorToaster(backendMsg || 'Code promo déjà utilisé');
    } else if (status === 400) {
      this.toaster.handelErrorToaster(backendMsg || 'Données invalides');
    } else {
      this.toaster.handelErrorToaster(backendMsg || 'Échec de la sauvegarde');
    }
  }

  remove(p: Promotion): void {
    if (!p.id || !confirm(`Supprimer "${p.name}" ?`)) return;
    this.subs.add(
      this.promotionService.remove(p.id).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Promotion supprimée');
          this.load();
        },
        error: () => this.toaster.handelErrorToaster('Échec'),
      }),
    );
  }

  toggleProduct(id: number): void {
    const i = this.form.menuItemIds.indexOf(id);
    if (i >= 0) this.form.menuItemIds.splice(i, 1);
    else this.form.menuItemIds.push(id);
  }

  toggleCategory(id: number): void {
    const i = this.form.categoryIds.indexOf(id);
    if (i >= 0) this.form.categoryIds.splice(i, 1);
    else this.form.categoryIds.push(id);
  }

  isExpired(p: Promotion): boolean {
    return new Date(p.endDate) < new Date(new Date().toDateString());
  }

  isUpcoming(p: Promotion): boolean {
    return new Date(p.startDate) > new Date();
  }

  statusKey(p: Promotion): StatusFilter {
    if (!p.isActive) return 'inactive';
    if (this.isExpired(p)) return 'expired';
    if (this.isUpcoming(p)) return 'upcoming';
    return 'active';
  }

  status(p: Promotion): { label: string; color: string } {
    const key = this.statusKey(p);
    const found = this.statusFilters.find((s) => s.key === key);
    return { label: found?.label ?? '', color: found?.color ?? '' };
  }

  formatValue(p: Promotion): string {
    switch (p.type) {
      case 'PERCENT':
        return `-${p.value}%`;
      case 'FIXED_AMOUNT':
        return `-${p.value} DT`;
      case 'FIXED_PRICE':
        return `${p.value} DT`;
    }
  }

  trackById(_: number, p: Promotion): number {
    return p.id ?? 0;
  }

  private matchSearch(p: Promotion, q: string): boolean {
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.promoCode || '').toLowerCase().includes(q)
    );
  }

  private sortList(list: Promotion[], key: SortKey, dir: SortDir): Promotion[] {
    const factor = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: any;
      let bv: any;
      switch (key) {
        case 'name':
          av = (a.name || '').toLowerCase();
          bv = (b.name || '').toLowerCase();
          break;
        case 'value':
          av = a.value;
          bv = b.value;
          break;
        case 'startDate':
          av = a.startDate;
          bv = b.startDate;
          break;
        case 'endDate':
          av = a.endDate;
          bv = b.endDate;
          break;
        case 'status':
          av = this.statusKey(a);
          bv = this.statusKey(b);
          break;
      }
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }

  private empty(): Promotion {
    const today = new Date().toISOString().slice(0, 10);
    return {
      name: '',
      description: '',
      type: 'PERCENT',
      value: 10,
      startDate: today,
      endDate: today,
      isActive: true,
      promoCode: '',
      maxUses: undefined,
      usesCount: 0,
      minOrderAmount: undefined,
      maxDiscountAmount: undefined,
      firstOrderOnly: false,
      oncePerUser: false,
      menuItemIds: [],
      categoryIds: [],
    };
  }
}
