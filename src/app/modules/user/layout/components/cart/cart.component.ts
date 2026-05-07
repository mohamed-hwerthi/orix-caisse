import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Observable, map, take } from 'rxjs';
import { PaymentMethode } from 'src/app/core/models/paymentMethode.model';
import { FilterModalComponent } from 'src/app/modules/admin/dashboard/components/filter-modal/filter-modal.component';
import { PaymentCreateModalComponent } from 'src/app/modules/admin/dashboard/components/payment/payment-create-modal/payment-create-modal.component';
import { InvoiceService } from 'src/app/services/invoice.service';
import { SharedService } from 'src/app/services/shared.service';
import { ThemeService } from 'src/app/services/theme.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { environment } from 'src/environments/environment';
import { MenuItem, OrderSubmission, User } from '../../../../../core/models';
import { selectCurrentUser } from '../../../../../core/state/auth/auth.selectors';
import { clearCart, decrementItem, incrementItem, removeItem, setItemQuantity } from '../../../../../core/state/shopping-cart/cart.actions';
import { selectCartItems } from '../../../../../core/state/shopping-cart/cart.selectors';
import { CartVisibilityService } from '../../../../../services/cart-visibility.service';
import { OrdersService } from '../../../../../services/orders.service';
import { MenuItemsService } from '../../../../../services/menuItems.service';
import { PromotionEngineService } from '../../../../../services/promotion-engine.service';
import { SoundService } from '../../../../../services/sound.service';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import {
  OrderProgressModalComponent,
  OrderProgressState,
} from '../../../../../shared/components/order-progress-modal/order-progress-modal.component';
import { PaymentDetails } from '../../../../admin/dashboard/components/payment/payment-create-modal/payment-create-modal.component';

interface CartItem extends MenuItem {
  quantityToSale: number;
}

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  standalone: true,
  imports: [CommonModule, LoaderComponent, FormsModule, ButtonComponent, TranslateModule, OrderProgressModalComponent],
  providers: [DialogService],

  animations: [
    trigger('slideInOut', [
      state('in', style({ transform: 'translateX(0%)' })),
      state('out', style({ transform: 'translateX(100%)' })),
      transition('in <=> out', animate('400ms ease-in-out')),
    ]),
    trigger('backdropFade', [
      state('visible', style({ opacity: 1 })),
      state('hidden', style({ opacity: 0 })),
      transition('visible <=> hidden', animate('1s ease-in-out')),
    ]),
  ],
})
export class CartComponent implements OnInit {
  handleKeyDown($event: KeyboardEvent) {
    // local handler kept for backward compatibility
  }

  @HostListener('document:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    // Don't intercept when typing in form fields, except for explicit function keys
    const target = event.target as HTMLElement;
    const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const isFunctionKey = /^F\d+$/.test(event.key) || event.key === 'Escape';

    if (isTyping && !isFunctionKey && !(event.ctrlKey || event.metaKey)) return;

    switch (event.key) {
      case 'F8':
        event.preventDefault();
        this.toggleDisplayingOnlyBarCode();
        break;
      case 'F9':
        event.preventDefault();
        if (this.cartItems.length > 0 && !this.isLoading) this.openPaymentDialog();
        break;
      case 'Delete':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (this.cartItems.length > 0 && confirm('Vider le panier ?')) {
            this.store.dispatch(clearCart());
          }
        }
        break;
      case 'F12':
        // Quick clear & rescan — no confirmation, refocus barcode input
        event.preventDefault();
        if (this.cartItems.length > 0) {
          this.store.dispatch(clearCart());
          this.toastr.info('Panier vidé', '', { positionClass: 'custom-toast-top-right', timeOut: 1200 });
        }
        setTimeout(() => this.focusInput('codeBarreScan') || this.focusInput('codeBarre'), 30);
        break;
      case 'F2':
        event.preventDefault();
        this.focusInput('codeBarreScan') || this.focusInput('codeBarre');
        break;
      case 'F3':
        event.preventDefault();
        this.focusInput('title');
        break;
    }
  }

  private focusInput(id: string): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select?.();
      return true;
    }
    return false;
  }
  currentUser$: Observable<User | null>;
  currentCurrency!: string;
  public profileMenu = [
    {
      key: 'PROFILE_MENU.LOGOUT',
      icon: './assets/icons/heroicons/outline/logout.svg',
      link: '/auth',
    },
  ];

  cartItems: CartItem[] = [];
  totalPrice: number = 0;
  originalTotal: number = 0;
  totalDiscount: number = 0;
  showCart: boolean = false;
  isLoading: boolean = false;
  orderProgressState: OrderProgressState = 'idle';
  lastOrderId?: string | number;
  orderErrorMessage?: string;
  public themeMode = ['light', 'dark'];
  amountGivenByUser: number = 0;
  amountToChange!: number;
  allPaymentMethode!: PaymentMethode[];
  ref: DynamicDialogRef | undefined;
  paymentDetail!: PaymentDetails;
  isDisplayingOnlyBarCoes$!: Observable<boolean>;

  constructor(
    private readonly store: Store,
    public readonly cartVisibilityService: CartVisibilityService,
    private readonly ordersService: OrdersService,
    private readonly toastr: ToastrService,
    private readonly router: Router,
    public themeService: ThemeService,
    public dialogService: DialogService,
    public sharedService: SharedService,
    private readonly invoiceService: InvoiceService,
    private readonly promotionEngine: PromotionEngineService,
    private readonly menuItemsService: MenuItemsService,
    private readonly soundService: SoundService,
  ) {
    this.isDisplayingOnlyBarCoes$! = sharedService.getIsBarcodeOnlyMode();

    this.store
      .select(selectCartItems)
      .pipe(
        map((items) => {
          return items.map((storeItem: any) => {
            const existingItem = this.cartItems.find((item) => item.id === storeItem.id);
            // Trust the store's quantityToSale (incremented when scanning twice).
            // Fall back to local value if store doesn't have one yet (legacy state).
            const qty = storeItem.quantityToSale ?? existingItem?.quantityToSale ?? 1;
            return { ...storeItem, quantityToSale: qty };
          }) as CartItem[];
        }),
      )
      .subscribe((items) => {
        this.cartItems = items;
        this.calculateTotalPrice();
        if (this.cartItems.length > 0 && this.cartItems[0].currency) {
          this.currentCurrency = this.cartItems[0].currency.symbol;
        }
      });
    this.currentUser$ = this.store.pipe(select(selectCurrentUser));
  }

  ngOnInit(): void {
    this.initialiseAllPaymentMethodes();
    this.cartVisibilityService.showCart$.subscribe((visible) => {
      this.showCart = visible;
    });
  }
  initialiseAllPaymentMethodes() {
    this.allPaymentMethode = Object.values(PaymentMethode);
  }

  toggleThemeMode() {
    this.themeService.theme.update((theme) => {
      const mode = !this.themeService.isDark ? 'dark' : 'light';
      return { ...theme, mode: mode };
    });
  }
  increaseQuantity(cartItem: CartItem): void {
    this.store.dispatch(incrementItem({ itemId: cartItem.id }));
  }

  decreaseQuantity(cartItem: CartItem): void {
    if (cartItem.quantityToSale > 1) {
      this.store.dispatch(decrementItem({ itemId: cartItem.id }));
    }
  }

  calculateTotalPrice(): void {
    let original = 0;
    let total = 0;
    for (const item of this.cartItems) {
      const ap = this.promotionEngine.computePrice(item);
      original += item.price * item.quantityToSale;
      total += ap.unitPrice * item.quantityToSale;
    }
    this.originalTotal = Math.round(original * 100) / 100;
    this.totalPrice = Math.round(total * 100) / 100;
    this.totalDiscount = Math.round((original - total) * 100) / 100;
    this.amountToChange = this.totalPrice;
  }

  getAppliedPrice(item: CartItem): number {
    return this.promotionEngine.computePrice(item).unitPrice;
  }

  hasPromoOnItem(item: CartItem): boolean {
    return this.promotionEngine.computePrice(item).promotion != null;
  }

  onQuantityChange(event: Event, cartItem: CartItem): void {
    const inputElement = event.target as HTMLInputElement;
    const quantityToSale = inputElement.valueAsNumber;
    if (quantityToSale && quantityToSale > 0) {
      this.store.dispatch(setItemQuantity({ itemId: cartItem.id, quantity: quantityToSale }));
    }
  }

  removeItem(itemId: number): void {
    this.store.dispatch(removeItem({ itemId }));
  }

  openPaymentDialog() {
    this.ref = this.dialogService.open(PaymentCreateModalComponent, {
      width: '480px',
      modal: true,
      showHeader: false,
      breakpoints: {
        '960px': '75vw',
        '640px': '90vw',
      },
      data: {
        orderTotal: this.totalPrice,
      },
    });
    this.ref.onClose.subscribe((dialogPaymentData: PaymentDetails) => {
      if (dialogPaymentData && this.cartItems.length > 0 && !this.isLoading) {
        this.paymentDetail = dialogPaymentData;
        if (dialogPaymentData.amountToChange > 0) {
          this.toastr.info(
            `Rendre ${dialogPaymentData.amountToChange.toFixed(2)} TND au client`,
            '',
            { positionClass: 'custom-toast-top-right', timeOut: 5000 },
          );
        }
        // Place order + print ticket immediately — no extra click needed
        this.placeOrderAndPrintTicket();
      }
    });
  }

  OpenFilterDialog() {
    this.ref = this.dialogService.open(FilterModalComponent, {
      width: '35vw',
      height: '20vh',
      modal: true,
      breakpoints: {
        '960px': '75vw',
        '640px': '90vw',
      },
      styleClass: 'custom-red-dialog', // Correct way to pass CSS clas
    });
    this.ref.onClose.subscribe((dialogPaymentData: PaymentDetails) => {
      if (dialogPaymentData) {
        this.paymentDetail = dialogPaymentData;
        console.log(dialogPaymentData);
      }
    });
  }

  getMenuItemImage(item: MenuItem): string {
    if (item.medias.length > 0) {
      console.log(environment.apiStaticUrl + item.medias[0].url);

      return environment.apiStaticUrl + item.medias[0].url;
    } else {
      return '';
    }
  }
  toggleDisplayingOnlyBarCode() {
    this.isDisplayingOnlyBarCoes$.pipe(take(1)).subscribe((currentValue) => {
      this.sharedService.toggleBarcodeOnlyMode(!currentValue);
    });
  }

  placeOrderAndPrintTicket(): void {
    this.currentUser$.pipe(take(1)).subscribe((currentUser) => {
      if (!currentUser || typeof currentUser.id !== 'string') {
        this.toastr.error('User information is missing');
        return;
      }

      this.isLoading = true;
      this.orderErrorMessage = undefined;
      this.orderProgressState = 'placing';

      const orderData: OrderSubmission = {
        userEmail: currentUser.email,
        menuItemQuantities: this.cartItems.reduce((acc, item) => {
          acc[item.id] = item.quantityToSale;
          return acc;
        }, {} as { [menuItemId: number]: number }),
        createdOn: new Date().toISOString(),
        paid: false,
        status: 'PENDING',
        paymentMethod: 'CASH',
      };

      // Snapshot sold items for low-stock alert after backend updates
      const soldItems = this.cartItems.map((it) => ({ id: it.id, title: it.title }));

      this.ordersService.createOrder(orderData).subscribe({
        next: (order) => {
          this.lastOrderId = order.id;

          // 🔔 Play success chime — pleasant register-style sound
          this.soundService.playCashIn();

          // Order placed → success immediately. Invoice downloads in BACKGROUND (don't block cashier).
          this.orderProgressState = 'done';
          this.isLoading = false;
          this.store.dispatch(clearCart());
          if (this.showCart) this.cartVisibilityService.toggleCart();

          // Check stock state after sale and toast if any sold item is now low/empty
          this.checkLowStockAfterSale(soldItems);

          setTimeout(() => {
            this.orderProgressState = 'idle';
            this.lastOrderId = undefined;
          }, 800);

          // Fire-and-forget: triggers download when ready (a few seconds later)
          this.invoiceService.downloadInvoice(order.id).subscribe({
            next: (pdfBlob) => {
              const fileURL = URL.createObjectURL(pdfBlob);
              const a = document.createElement('a');
              a.href = fileURL;
              a.download = `invoice_${order.id}.pdf`;
              a.click();
              URL.revokeObjectURL(fileURL);
            },
            error: (err) => {
              console.error('Invoice download failed', err);
              this.toastr.warning('Facture indisponible (commande OK)');
            },
          });
        },
        error: (error) => {
          console.error('Failed to place an order', error);
          this.orderErrorMessage = 'Failed to place the order';
          this.orderProgressState = 'error';
          this.isLoading = false;
        },
      });
    });
  }

  onOrderProgressRetry(): void {
    this.orderProgressState = 'idle';
    this.placeOrderAndPrintTicket();
  }

  onOrderProgressClose(): void {
    this.orderProgressState = 'idle';
    this.orderErrorMessage = undefined;
  }

  placeOrder(): void {
    this.currentUser$.pipe(take(1)).subscribe((currentUser) => {
      if (!currentUser || typeof currentUser.id !== 'string') {
        this.toastr.error('User information is missing');
        this.isLoading = false;
        return;
      }

      this.isLoading = true;

      const orderData: OrderSubmission = {
        userEmail: currentUser.email,
        menuItemQuantities: this.cartItems.reduce((acc, item) => {
          acc[item.id] = item.quantityToSale;
          return acc;
        }, {} as { [menuItemId: number]: number }),
        createdOn: new Date().toISOString(),
        paid: false,
        status: 'PENDING',
        paymentMethod: 'CASH',
      };

      const soldItems = this.cartItems.map((it) => ({ id: it.id, title: it.title }));

      this.ordersService.createOrder(orderData).subscribe({
        next: (order) => {
          this.soundService.playCashIn();
          this.toastr.success('Order placed successfully!');
          this.store.dispatch(clearCart());
          this.cartVisibilityService.toggleCart();
          this.checkLowStockAfterSale(soldItems);
        },
        error: (error) => {
          console.error('Failed to place an order', error);
          this.toastr.error('Failed to place an order');
          this.isLoading = false;
        },
      });
    });
  }

  /** Fetches fresh stock summary and toasts if any sold item just hit rupture or low-stock. */
  private checkLowStockAfterSale(sold: { id: number; title: string }[]): void {
    if (sold.length === 0) return;
    this.menuItemsService.getStockSummary().subscribe({
      next: (rows) => {
        const byId = new Map(rows.map((r) => [r.id, r]));
        const ruptures: string[] = [];
        const lows: string[] = [];
        for (const it of sold) {
          const s = byId.get(it.id);
          if (!s) continue;
          if (s.stockQuantity <= 0) ruptures.push(it.title);
          else if (s.lowStock) lows.push(it.title);
        }
        if (ruptures.length > 0) {
          this.toastr.error(`🚨 RUPTURE : ${ruptures.join(', ')}`, '', { timeOut: 6000 });
        }
        if (lows.length > 0) {
          this.toastr.warning(`⚠️ Stock bas : ${lows.join(', ')}`, '', { timeOut: 6000 });
        }
      },
    });
  }
}
