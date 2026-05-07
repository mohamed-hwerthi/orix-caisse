import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { debounceTime, distinctUntilChanged, map, Observable, Subscription, switchMap, take } from 'rxjs';

import { ToastrService } from 'ngx-toastr';
import { addItem } from 'src/app/core/state/shopping-cart/cart.actions';
import { selectCartItems } from 'src/app/core/state/shopping-cart/cart.selectors';
import { CustomToasterService } from 'src/app/services/custom-toaster.service';
import { SharedService } from 'src/app/services/shared.service';
import { MenuItem, PaginatedResponseDTO, Promotion } from '../../../../core/models';
import { PromotionService } from '../../../../services/promotion.service';
import { PromotionEngineService } from '../../../../services/promotion-engine.service';
import * as AuthActions from '../../../../core/state/auth/auth.actions';
import {
  selectIsCreateReviewUserModalOpen,
  selectIsUserReviewsModalOpen,
} from '../../../../core/state/modal/review/modal.selectors';
import { MenuItemsService } from '../../../../services/menuItems.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { FoodCardComponent } from './food-card/food-card.component';
import { FoodCardSkeletonComponent } from './food-card/food-card-skeleton.component';
import { FoodCategoryComponent } from './food-category/food-category.component';
import { FoodCategorySkeletonComponent } from './food-category/food-category-skeleton.component';
import { SubmitUserReviewModal } from './submit-review-modal/submit-review-modal.component';
import { UserReviewsModalComponent } from './user-reviews-modal/user-reviews-modal.component';
import { ProfileMenuComponent } from '../../layout/components/navbar/profile-menu/profile-menu.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { LogoutButtonComponent } from '../../../../shared/components/logout-button/logout-button.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    FoodCardComponent,
    FoodCardSkeletonComponent,
    FoodCategoryComponent,
    FoodCategorySkeletonComponent,
    LoaderComponent,
    SubmitUserReviewModal,
    UserReviewsModalComponent,
    ProfileMenuComponent,
    ThemeToggleComponent,
    LogoutButtonComponent,
    FormsModule,
  ],
  templateUrl: './menu.component.html',
})
export class MenuComponent implements OnInit, OnDestroy {
  @ViewChild('menuItemsContainer') menuItemsContainer?: ElementRef;
  isDisplayingOnlyBarCoes$!: Observable<boolean>;
  allMenuItems: MenuItem[] = [];
  displayMenuItems: MenuItem[] = [];
  isLoading = true;
  selectedCategory!: number;
  lastCategory!: number;
  itemsPerPage = 200; // Show up to 200 articles at once (POS use case)
  currentPage = 1;
  showSubmitReviewModal$!: Observable<boolean>;
  showUserReviewsModal$!: Observable<boolean>;

  private queryParamsSubscription!: Subscription;
  private reviewNotificationSubscription!: Subscription;
  private cartSubscription?: Subscription;
  barCode?: string;
  seachInput: string = '';
  showCategoryFilter = false;
  cartItemsCount = 0;
  cartTotal = 0;
  currentCurrency = '';
  lastScannedItem?: MenuItem;
  skeletonItems = Array(10).fill(0);
  activePromotions: Promotion[] = [];
  public profileMenu = [
    {
      key: 'PROFILE_MENU.LOGOUT',
      icon: './assets/icons/heroicons/outline/logout.svg',
      link: '/auth',
    },
  ];

  constructor(
    private readonly menuItemsService: MenuItemsService,
    private readonly route: ActivatedRoute,
    private readonly store: Store,
    private readonly menuItemService: MenuItemsService,
    private readonly customToasterService: CustomToasterService,
    private readonly toastr: ToastrService,
    private readonly sharedService: SharedService,
    private readonly router: Router,
    private readonly promotionService: PromotionService,
    public readonly promotionEngine: PromotionEngineService,
  ) {
    this.isDisplayingOnlyBarCoes$ = this.sharedService.getIsBarcodeOnlyMode();
  }

  ngOnInit(): void {
    this.showSubmitReviewModal$ = this.store.select(selectIsCreateReviewUserModalOpen);
    this.showUserReviewsModal$ = this.store.select(selectIsUserReviewsModalOpen);

    // Load active promotions for the menu engine
    this.promotionService.getActive().subscribe({
      next: (promos) => {
        this.activePromotions = promos.filter((p) => !p.promoCode);
        this.promotionEngine.setActivePromotions(promos);
      },
    });

    // Listen for any changes in the URL query parameters
    this.queryParamsSubscription = this.route.queryParams
      .pipe(
        debounceTime(300), // Debounce to avoid rapid consecutive fetches
        distinctUntilChanged(), // Only fetch if there is a change in category
        switchMap((params) => {
          const category = params['category'];
          const categoryChanged = this.selectedCategory !== category;

          // Update selected category and fetch items if necessary
          if (categoryChanged || !this.allMenuItems.length) {
            this.selectedCategory = category;
            // Auto-close the filter drawer after a category change
            if (this.showCategoryFilter) this.showCategoryFilter = false;
            return this.menuItemsService.getAllMenuItems(1, 100);
          } else {
            return [];
          }
        }),
      )
      .subscribe({
        next: (response: PaginatedResponseDTO<MenuItem>) => {
          if (response.items) {
            this.allMenuItems = response.items;
            this.filterItemsByCategory();
            this.isLoading = false;
          }
        },
        error: (error) => {
          this.isLoading = false;
        },
      });

    // Listen for review submission notifications
    this.reviewNotificationSubscription = this.menuItemsService.reviewSubmitted$.subscribe(() => {
      this.fetchMenuItems(true);
    });

    // Track cart for scan-mode stats
    this.cartSubscription = this.store.select(selectCartItems).subscribe((items: MenuItem[]) => {
      this.cartItemsCount = items.length;
      this.cartTotal = items.reduce((sum, it: any) => sum + (it.price * (it.quantity || 1)), 0);
      this.currentCurrency = items[0]?.currency?.symbol || '';
    });
  }

  fetchMenuItems(forceFetch: boolean = false): void {
    if (!this.allMenuItems.length || forceFetch) {
      // Check if items have already been fetched or force fetching
      this.isLoading = true;
      this.menuItemsService.getAllMenuItems(1, 100).subscribe({
        next: (response: PaginatedResponseDTO<MenuItem>) => {
          this.allMenuItems = response.items; // Saving all items then only filter based on selected category
          // Filter immediately after fetching based on the selected category
          this.filterItemsByCategory();
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
        },
      });
    } else {
      this.filterItemsByCategory(); // Filter existing items if they've already been fetched
    }
  }

  filterItemsByCategory(): void {
    // w/o this, while changing categories displayItems count will be same until page refresh
    if (this.lastCategory !== this.selectedCategory) {
      // Reset currentPage if the category has changed
      this.currentPage = 1;
      this.lastCategory = this.selectedCategory;
    }
    let filteredItems: any;
    if (this.selectedCategory) {
      filteredItems = this.allMenuItems.filter((item) =>
        item.categories.some((category) => category.id == this.selectedCategory),
      );
    } else {
      filteredItems = this.allMenuItems;
    }

    // Only show items up to the current page
    //creates a new array rather than mutating it
    this.displayMenuItems = [...filteredItems.slice(0, this.currentPage * this.itemsPerPage)];
  }
  @HostListener('window:scroll', ['$event'])
  onWindowScroll(): void {
    // Calculate the distance from the top of the page to the bottom of the viewport
    const distanceFromTopToBottom = window.innerHeight + window.scrollY;
    // Calculate the threshold for triggering the event (95% of the document height)
    const scrollThreshold = document.body.offsetHeight * 0.95;

    // Check if we're at 95% of the bottom of the page
    if (distanceFromTopToBottom >= scrollThreshold) {
      this.loadMoreItems();
    }
  }

  loadMoreItems(): void {
    this.currentPage++;
    this.filterItemsByCategory();
  }
  filterMenuItemsByBarCode() {
    if (this.barCode) {
      this.menuItemService.filterMenuItemsByBarCode(this.barCode).subscribe({
        next: (res) => {
          this.addToCart(res);
          this.displayMenuItems = [res];
          this.lastScannedItem = res;
          this.barCode = undefined;
        },
        error: (err: { error: string; status: string }) => {
          if (err.status === '404') {
            this.customToasterService.handelErrorToaster('TOASTER_MESSAGE.AUCUN_MENU_ITEM_TROUVE_POUR_CE_BARCODE');
            this.barCode = undefined;
          } else {
            this.customToasterService.handelErrorToaster('HTTP_ERROR_MESSAGES.ENEXPECTED_ERROR');
            this.barCode = undefined;
          }
        },
      });
    }
  }

  searchByQuery() {
    if (this.seachInput) {
      this.menuItemService.filterMenuItemsByQuery(this.seachInput).subscribe({
        next: (res: PaginatedResponseDTO<MenuItem>) => {
          this.displayMenuItems = res.items;
        },
        error: (err) => {
          this.customToasterService.handelErrorToaster('HTTP_ERROR_MESSAGES.ENEXPECTED_ERROR');
        },
      });
    } else {
      this.loadMoreItems();
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe to prevent memory leaks
    this.queryParamsSubscription?.unsubscribe();
    this.reviewNotificationSubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
  }
  addToCart(item: MenuItem): void {
    // Reducer dedups + increments — scanning the same barcode twice now adds qty=2.
    this.store.dispatch(addItem({ item }));
    this.toastr.success(`${item.title} ajouté`, '', {
      positionClass: 'custom-toast-top-right',
      timeOut: 1500,
    });
  }
  toggleCategoryFilter(): void {
    this.showCategoryFilter = !this.showCategoryFilter;
  }

  closeCategoryFilter(): void {
    this.showCategoryFilter = false;
  }

  goToSalesHistory(): void {
    this.router.navigate(['/sales-history']);
  }

  goToAdmin(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  getLastScannedImage(): string {
    if (this.lastScannedItem?.medias?.length) {
      return environment.apiStaticUrl + this.lastScannedItem.medias[0].url;
    }
    return '';
  }

  public onMenuItemClick(item: any): void {
    if (item.key === 'PROFILE_MENU.LOGOUT') {
      this.logout();
    } else {
      this.router.navigate([item.link]);
    }
  }
  logout() {
    this.store.dispatch(AuthActions.logout());
  }
}
