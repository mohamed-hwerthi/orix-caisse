import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subscription, firstValueFrom, interval } from 'rxjs';
import { selectCurrentUser } from '../../core/state/auth/auth.selectors';
import { CategoryDTO } from '../../core/models/categoryDTO.model';
import { MenuItem, Promotion } from '../../core/models';
import { CategoryService } from '../../services/category.service';
import { CustomToasterService } from '../../services/custom-toaster.service';
import { MenuItemsService } from '../../services/menuItems.service';
import { OrdersService } from '../../services/orders.service';
import { PromotionService } from '../../services/promotion.service';
import { PromotionEngineService } from '../../services/promotion-engine.service';
import { CashSession, CashSessionService, CashSessionSummary, CashMovementReason, CashMovementType } from '../../services/cash-session.service';
import { PosCartService } from './services/pos-cart.service';
import { Router } from '@angular/router';
import * as AuthActions from '../../core/state/auth/auth.actions';

type PaymentMethod = 'CASH' | 'CARD' | 'MIXED';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit, OnDestroy {
  products: MenuItem[] = [];
  categories: CategoryDTO[] = [];
  selectedCategoryId: number | null = null;
  search = '';

  paymentOpen = signal(false);
  paymentMethod = signal<PaymentMethod>('CASH');
  cashGiven = signal(0);
  cardAmount = signal(0);
  submitting = signal(false);

  promoCodeInput = '';
  appliedPromo = signal<Promotion | null>(null);
  promoChecking = signal(false);

  // Stock sync
  lastStockSync = signal<Date | null>(null);
  syncSecondsAgo = signal<number>(0);

  // Insufficient stock modal
  insufficientStock = signal<{ items: { menuItemId: number; title: string; requested: number; available: number }[] } | null>(null);

  // Cash session
  session = signal<CashSession | null>(null);
  showOpenSession = signal(false);
  openingAmountInput = 0;
  openingNotesInput = '';

  // Cash movement modal
  showMovementModal = signal(false);
  movementType: CashMovementType = 'OUT';
  movementReason: CashMovementReason = 'PURCHASE';
  movementAmount = 0;
  movementNote = '';

  // Close session modal
  showCloseModal = signal(false);
  closeSummary = signal<CashSessionSummary | null>(null);
  countedCashInput = 0;
  countedCardInput = 0;
  closingNotesInput = '';
  closing = signal(false);

  // Counters per denomination (for cash counting helper)
  cashDenominations = [
    { value: 50, count: 0 },
    { value: 20, count: 0 },
    { value: 10, count: 0 },
    { value: 5, count: 0 },
    { value: 2, count: 0 },
    { value: 1, count: 0 },
    { value: 0.5, count: 0 },
    { value: 0.2, count: 0 },
    { value: 0.1, count: 0 },
    { value: 0.05, count: 0 },
  ];

  private currentUserEmail: string | null = null;
  private barcodeBuffer = '';
  private barcodeTimer: any = null;
  private subs = new Subscription();

  constructor(
    public cart: PosCartService,
    public promotionEngine: PromotionEngineService,
    private menuItemsService: MenuItemsService,
    private categoryService: CategoryService,
    private ordersService: OrdersService,
    private promotionService: PromotionService,
    private toaster: CustomToasterService,
    private store: Store,
    private router: Router,
    private cashSessionService: CashSessionService,
  ) {}

  // Computed cash count from denominations
  get computedCashCount(): number {
    const total = this.cashDenominations.reduce((sum, d) => sum + d.value * (d.count || 0), 0);
    return Math.round(total * 100) / 100;
  }

  goToSalesHistory(): void {
    this.router.navigate(['/sales-history']);
  }

  goToAdmin(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }

  readonly codeDiscount = computed(() => {
    const promo = this.appliedPromo();
    if (!promo) return 0;
    let discount = 0;
    for (const line of this.cart.lines()) {
      const matches =
        (promo.menuItemIds.length === 0 && promo.categoryIds.length === 0) ||
        promo.menuItemIds.includes(line.menuItemId);
      if (!matches) continue;
      let unitDiscount = 0;
      switch (promo.type) {
        case 'PERCENT':
          unitDiscount = line.unitPrice * (promo.value / 100);
          break;
        case 'FIXED_AMOUNT':
          unitDiscount = Math.min(line.unitPrice, promo.value);
          break;
        case 'FIXED_PRICE':
          unitDiscount = Math.max(0, line.unitPrice - promo.value);
          break;
      }
      discount += unitDiscount * line.quantity;
    }
    return Math.round(discount * 100) / 100;
  });

  readonly totalAfterCode = computed(() =>
    Math.max(0, Math.round((this.cart.totalTTC() - this.codeDiscount()) * 100) / 100),
  );

  readonly change = computed(() => {
    const total = this.totalAfterCode();
    if (this.paymentMethod() === 'CASH') {
      return Math.max(0, this.cashGiven() - total);
    }
    if (this.paymentMethod() === 'MIXED') {
      return Math.max(0, this.cashGiven() + this.cardAmount() - total);
    }
    return 0;
  });

  readonly canConfirm = computed(() => {
    const total = this.totalAfterCode();
    if (this.cart.count() === 0) return false;
    if (this.paymentMethod() === 'CARD') return true;
    if (this.paymentMethod() === 'CASH') return this.cashGiven() >= total;
    return this.cashGiven() + this.cardAmount() >= total;
  });

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
    this.loadPromotions();
    this.checkSession();
    this.subs.add(
      this.store.select(selectCurrentUser).subscribe((u: any) => {
        this.currentUserEmail = u?.email ?? null;
      }),
    );
    // Stock sync polling every 30s
    this.subs.add(
      interval(30000).subscribe(() => this.refreshStock()),
    );
    // Tick every 5s to update "X seconds ago" badge
    this.subs.add(
      interval(5000).subscribe(() => {
        const last = this.lastStockSync();
        if (last) this.syncSecondsAgo.set(Math.floor((Date.now() - last.getTime()) / 1000));
      }),
    );
  }

  refreshStock(): void {
    this.subs.add(
      this.menuItemsService.getStockSummary().subscribe({
        next: (rows) => {
          const byId = new Map<number, { stockQuantity: number; lowStock: boolean; nearestExpiryDays?: number }>();
          for (const r of rows)
            byId.set(r.id, { stockQuantity: r.stockQuantity, lowStock: r.lowStock, nearestExpiryDays: r.nearestExpiryDays });
          this.products = this.products.map((p) => {
            const s = byId.get(p.id);
            return s
              ? { ...p, stockQuantity: s.stockQuantity, lowStock: s.lowStock, nearestExpiryDays: s.nearestExpiryDays }
              : p;
          });
          this.lastStockSync.set(new Date());
          this.syncSecondsAgo.set(0);
        },
      }),
    );
  }

  /** Refresh stock then alert if any of the sold items just crossed into low/empty stock. */
  refreshStockAndAlert(soldIds: Set<number>): void {
    this.subs.add(
      this.menuItemsService.getStockSummary().subscribe({
        next: (rows) => {
          const byId = new Map<number, { stockQuantity: number; lowStock: boolean; nearestExpiryDays?: number }>();
          for (const r of rows)
            byId.set(r.id, { stockQuantity: r.stockQuantity, lowStock: r.lowStock, nearestExpiryDays: r.nearestExpiryDays });

          // Detect items in alert state among sold ones
          const ruptures: string[] = [];
          const lows: string[] = [];
          for (const p of this.products) {
            if (!soldIds.has(p.id)) continue;
            const s = byId.get(p.id);
            if (!s) continue;
            if (s.stockQuantity <= 0) ruptures.push(p.title);
            else if (s.lowStock) lows.push(p.title);
          }

          this.products = this.products.map((p) => {
            const s = byId.get(p.id);
            return s
              ? { ...p, stockQuantity: s.stockQuantity, lowStock: s.lowStock, nearestExpiryDays: s.nearestExpiryDays }
              : p;
          });
          this.lastStockSync.set(new Date());
          this.syncSecondsAgo.set(0);

          if (ruptures.length > 0) {
            this.toaster.handelErrorToaster(
              `🚨 RUPTURE : ${ruptures.join(', ')}`,
            );
          }
          if (lows.length > 0) {
            this.toaster.handelInfoToaster(
              `⚠️ Stock bas : ${lows.join(', ')} — à réapprovisionner`,
            );
          }
        },
      }),
    );
  }

  expiryBadge(p: MenuItem): { label: string; color: string } | null {
    const days = p.nearestExpiryDays;
    if (days == null) return null;
    if (days < 0) return { label: 'PÉRIMÉ', color: 'bg-red-600 text-white' };
    if (days === 0) return { label: 'Périme aujourd’hui', color: 'bg-red-500 text-white' };
    if (days <= 3) return { label: `Périme ${days}j`, color: 'bg-orange-500 text-white' };
    if (days <= 7) return { label: `${days}j`, color: 'bg-yellow-400 text-yellow-900' };
    return null;
  }

  closeInsufficientStock(): void {
    this.insufficientStock.set(null);
    this.refreshStock();
  }

  // ===== Cash session lifecycle =====
  checkSession(): void {
    this.subs.add(
      this.cashSessionService.current().subscribe({
        next: (s) => this.session.set(s),
        error: () => {
          this.session.set(null);
          this.showOpenSession.set(true);
        },
      }),
    );
  }

  openSession(): void {
    if (this.openingAmountInput < 0) return;
    this.subs.add(
      this.cashSessionService.open({
        openingAmount: this.openingAmountInput,
        openingNotes: this.openingNotesInput || undefined,
      }).subscribe({
        next: (s) => {
          this.session.set(s);
          this.showOpenSession.set(false);
          this.openingAmountInput = 0;
          this.openingNotesInput = '';
          this.toaster.handelSuccessToaster(`Caisse ouverte avec ${s.openingAmount} DT`);
        },
        error: () => this.toaster.handelErrorToaster('Échec ouverture caisse'),
      }),
    );
  }

  // ===== Cash movement =====
  openMovementModal(): void {
    this.movementType = 'OUT';
    this.movementReason = 'PURCHASE';
    this.movementAmount = 0;
    this.movementNote = '';
    this.showMovementModal.set(true);
  }

  closeMovementModal(): void {
    this.showMovementModal.set(false);
  }

  saveMovement(): void {
    const s = this.session();
    if (!s?.id || this.movementAmount <= 0) return;
    this.subs.add(
      this.cashSessionService.addMovement(s.id, {
        type: this.movementType,
        reason: this.movementReason,
        amount: this.movementAmount,
        note: this.movementNote || undefined,
      }).subscribe({
        next: () => {
          this.toaster.handelSuccessToaster('Mouvement enregistré');
          this.closeMovementModal();
        },
        error: () => this.toaster.handelErrorToaster('Échec mouvement'),
      }),
    );
  }

  // ===== Close session =====
  openCloseModal(): void {
    const s = this.session();
    if (!s?.id) return;
    this.subs.add(
      this.cashSessionService.summary(s.id).subscribe({
        next: (sum) => {
          this.closeSummary.set(sum);
          this.countedCashInput = sum.expectedCashInDrawer;
          this.countedCardInput = sum.expectedCardTotal;
          this.closingNotesInput = '';
          this.cashDenominations.forEach((d) => (d.count = 0));
          this.showCloseModal.set(true);
        },
      }),
    );
  }

  applyDenominationCount(): void {
    this.countedCashInput = this.computedCashCount;
  }

  closeCloseModal(): void {
    this.showCloseModal.set(false);
  }

  confirmClose(): void {
    const s = this.session();
    if (!s?.id || this.closing()) return;
    this.closing.set(true);
    this.subs.add(
      this.cashSessionService.close(s.id, {
        countedCash: this.countedCashInput,
        countedCard: this.countedCardInput,
        closingNotes: this.closingNotesInput || undefined,
      }).subscribe({
        next: (closed) => {
          this.toaster.handelSuccessToaster(`Z-report ${closed.zReportNumber} généré`);
          // Auto download Z-report PDF
          if (closed.id) {
            this.cashSessionService.downloadZReport(closed.id).subscribe({
              next: (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const d = new Date(closed.closedAt || Date.now());
                const pad = (n: number) => n.toString().padStart(2, '0');
                const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
                const zNum = closed.zReportNumber || `S${closed.id}`;
                a.download = `Orix_Z-report_${datePart}_${zNum}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              },
              error: () => this.toaster.handelErrorToaster('Échec téléchargement Z-report'),
            });
          }
          this.session.set(null);
          this.showCloseModal.set(false);
          this.closing.set(false);
          this.openingAmountInput = closed.countedCash || 0;
          this.showOpenSession.set(true);
        },
        error: (err) => {
          this.closing.set(false);
          this.toaster.handelErrorToaster(err?.error?.message || 'Échec clôture');
        },
      }),
    );
  }

  get cashVarianceLive(): number {
    const sum = this.closeSummary();
    if (!sum) return 0;
    return Math.round((this.countedCashInput - sum.expectedCashInDrawer) * 100) / 100;
  }

  get cardVarianceLive(): number {
    const sum = this.closeSummary();
    if (!sum) return 0;
    return Math.round((this.countedCardInput - sum.expectedCardTotal) * 100) / 100;
  }

  loadPromotions(): void {
    this.subs.add(
      this.promotionService.getActive().subscribe({
        next: (promos) => this.promotionEngine.setActivePromotions(promos),
      }),
    );
  }

  priceFor(item: MenuItem): number {
    return this.promotionEngine.computePrice(item).unitPrice;
  }

  hasPromo(item: MenuItem): boolean {
    return this.promotionEngine.computePrice(item).promotion != null;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadProducts(): void {
    this.subs.add(
      this.menuItemsService.getAllMenuItems(1, 500).subscribe({
        next: (res) => {
          this.products = res.items.filter((p) => p.isActive !== false);
          this.lastStockSync.set(new Date());
          this.syncSecondsAgo.set(0);
        },
      }),
    );
  }

  loadCategories(): void {
    this.subs.add(
      this.categoryService.findAllCategories().subscribe({
        next: (cats) => (this.categories = cats),
      }),
    );
  }

  filteredProducts(): MenuItem[] {
    let list = this.products;
    if (this.selectedCategoryId != null) {
      list = list.filter((p) => p.categories?.some((c) => c.id === this.selectedCategoryId));
    }
    const q = this.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.barCode?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q),
      );
    }
    return list;
  }

  selectCategory(id: number | null): void {
    this.selectedCategoryId = id;
  }

  addToCart(p: MenuItem): void {
    if ((p.stockQuantity ?? 0) <= 0) {
      this.toaster.handelInfoToaster('Stock épuisé');
      return;
    }
    const applied = this.promotionEngine.computePrice(p);
    const itemForCart: MenuItem = applied.promotion
      ? { ...p, price: applied.unitPrice }
      : p;
    this.cart.add(itemForCart);
  }

  // Capteur scanner code-barres : suite de touches rapides finie par Enter
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.paymentOpen()) return;
    const target = e.target as HTMLElement;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'Enter') {
      if (this.barcodeBuffer.length >= 4) {
        this.handleBarcode(this.barcodeBuffer);
      }
      this.barcodeBuffer = '';
      return;
    }
    if (e.key.length === 1 && /[\w-]/.test(e.key)) {
      this.barcodeBuffer += e.key;
      clearTimeout(this.barcodeTimer);
      this.barcodeTimer = setTimeout(() => (this.barcodeBuffer = ''), 100);
    }
  }

  private handleBarcode(code: string): void {
    this.subs.add(
      this.menuItemsService.filterMenuItemsByBarCode(code).subscribe({
        next: (item) => {
          if (item) this.cart.add(item);
        },
        error: () => this.toaster.handelErrorToaster('Code-barres inconnu'),
      }),
    );
  }

  applyPromoCode(): void {
    const code = (this.promoCodeInput || '').trim();
    if (!code) return;
    this.promoChecking.set(true);
    this.subs.add(
      this.promotionService.validateCode(code).subscribe({
        next: (promo) => {
          this.appliedPromo.set(promo);
          this.promoCodeInput = '';
          this.promoChecking.set(false);
          this.toaster.handelSuccessToaster(`Code « ${promo.promoCode} » appliqué`);
        },
        error: (err) => {
          this.promoChecking.set(false);
          const status = err?.status;
          if (status === 404) {
            this.toaster.handelErrorToaster('Code invalide, expiré ou épuisé');
          } else {
            this.toaster.handelErrorToaster('Erreur de validation du code');
          }
        },
      }),
    );
  }

  removePromoCode(): void {
    this.appliedPromo.set(null);
    this.promoCodeInput = '';
  }

  // Paiement
  openPayment(): void {
    if (this.cart.count() === 0) return;
    this.cashGiven.set(this.totalAfterCode());
    this.cardAmount.set(0);
    this.paymentMethod.set('CASH');
    this.paymentOpen.set(true);
  }

  closePayment(): void {
    this.paymentOpen.set(false);
  }

  setMethod(m: PaymentMethod): void {
    this.paymentMethod.set(m);
    const total = this.totalAfterCode();
    if (m === 'CARD') {
      this.cashGiven.set(0);
      this.cardAmount.set(total);
    } else if (m === 'CASH') {
      this.cardAmount.set(0);
      if (this.cashGiven() < total) this.cashGiven.set(total);
    }
  }

  pad(value: number): void {
    this.cashGiven.set(value);
  }

  async confirmPayment(): Promise<void> {
    if (!this.canConfirm() || this.submitting()) return;
    if (!this.currentUserEmail) {
      this.toaster.handelErrorToaster('Utilisateur non identifié');
      return;
    }
    this.submitting.set(true);

    const promo = this.appliedPromo();
    const payload = {
      userEmail: this.currentUserEmail,
      menuItemQuantities: this.cart.toOrderQuantities(),
      createdOn: new Date().toISOString(),
      paid: true,
      status: 'COMPLETED' as const,
      paymentMethod: this.paymentMethod() as 'CASH' | 'CARD' | 'MIXED',
      ...(promo?.promoCode ? { promoCode: promo.promoCode } : {}),
    };

    // Snapshot of sold items BEFORE the sale (id + title) for low-stock detection after refresh
    const soldIds = new Set<number>(this.cart.lines().map((l) => l.menuItemId));

    try {
      await firstValueFrom(this.ordersService.createOrder(payload));
      this.toaster.handelSuccessToaster('Commande encaissée');
      this.cart.clear();
      this.appliedPromo.set(null);
      this.paymentOpen.set(false);
      this.cashGiven.set(0);
      this.cardAmount.set(0);
      this.refreshStockAndAlert(soldIds);
    } catch (err: any) {
      const errorBody = err?.error;
      if (errorBody?.code === 'STOCK_INSUFFICIENT' && Array.isArray(errorBody.items)) {
        this.insufficientStock.set({ items: errorBody.items });
        this.paymentOpen.set(false);
      } else {
        this.toaster.handelErrorToaster('Échec de la commande');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  @HostListener('window:keydown.F5', ['$event'])
  onF5(e: KeyboardEvent): void {
    e.preventDefault();
    this.refreshStock();
    this.toaster.handelInfoToaster('Stock actualisé');
  }

  trackProductId(_: number, p: MenuItem): number {
    return p.id;
  }

  trackLineId(_: number, l: { menuItemId: number }): number {
    return l.menuItemId;
  }
}
