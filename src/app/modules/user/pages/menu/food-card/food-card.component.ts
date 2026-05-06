import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { map, take } from 'rxjs';
import { MenuItem } from '../../../../../core/models';
import { openCreateReviewUserModal, openUsersReviewModal } from '../../../../../core/state/modal/review/modal.actions';
import { addItem } from '../../../../../core/state/shopping-cart/cart.actions';
import { selectCartItems } from '../../../../../core/state/shopping-cart/cart.selectors';
import { CartVisibilityService } from '../../../../../services/cart-visibility.service';
import { PromotionEngineService } from '../../../../../services/promotion-engine.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-food-card',
  standalone: true,
  imports: [RouterLink, CommonModule, CurrencyPipe],
  templateUrl: './food-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInOut', [
      state('in', style({ opacity: 1 })),
      transition(':enter', [style({ opacity: 0 }), animate('0.5s ease-in', style({ opacity: 1 }))]),
      transition(':leave', [animate('0.5s ease-out', style({ opacity: 0 }))]),
    ]),
  ],
})
export class FoodCardComponent {
  @Input() item!: MenuItem;
  imageLoaded = false;
  showFullDescription = false;

  constructor(
    private readonly store: Store,
    private readonly toastr: ToastrService,
    private readonly cartVisibility: CartVisibilityService,
    private readonly promotionEngine: PromotionEngineService,
  ) {}

  ngOnInit(): void {}

  get appliedPrice(): number {
    return this.promotionEngine.computePrice(this.item).unitPrice;
  }

  get hasPromo(): boolean {
    return this.promotionEngine.computePrice(this.item).promotion != null;
  }

  get promoLabel(): string {
    const ap = this.promotionEngine.computePrice(this.item);
    if (!ap.promotion) return '';
    switch (ap.promotion.type) {
      case 'PERCENT':
        return `-${ap.promotion.value}%`;
      case 'FIXED_AMOUNT':
        return `-${ap.promotion.value} ${this.item.currency?.symbol || ''}`;
      case 'FIXED_PRICE':
        return 'PROMO';
    }
  }

  onImageLoad(): void {
    this.imageLoaded = true;
  }

  toggleDescription(): void {
    this.showFullDescription = !this.showFullDescription;
  }

  openReviewModal(itemId: number): void {
    this.store.dispatch(openCreateReviewUserModal({ itemId }));
  }

  openUserReviewsModal(itemId: number): void {
    this.store.dispatch(openUsersReviewModal({ itemId }));
  }

  addToCart(item: MenuItem): void {
    this.store
      .select(selectCartItems)
      .pipe(
        take(1),
        map((items: MenuItem[]) => {
          const exists = items.some((existingItem) => existingItem.id === item.id);
          if (exists) {
            this.toastr.info('Item is already added', '', {
              positionClass: 'custom-toast-top-right',
            });
          } else {
            this.toastr.success('Item added to cart!', '', {
              positionClass: 'custom-toast-top-right',
            });
            this.store.dispatch(addItem({ item }));
          }
        }),
      )
      .subscribe();
  }

  getMenuItemImage(): string {
    if (this.item.medias.length > 0) {
      return environment.apiStaticUrl + this.item.medias[0].url;
    } else {
      return '';
    }
  }
}
