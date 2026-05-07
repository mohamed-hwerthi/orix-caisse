import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { CategoryDTO } from 'src/app/core/models/categoryDTO.model';
import { CategoryService } from 'src/app/services/category.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-food-category',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './food-category.component.html',
  animations: [
    trigger('slideIn', [
      state('slideInFromLeft', style({ transform: 'translateX(0)', opacity: 1 })), // Define end state for clarity, even if not used for animation
      state('slideInFromRight', style({ transform: 'translateX(0)', opacity: 1 })), // Define end state for clarity
      transition('* => slideInFromLeft', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('1s ease-out'),
      ]),
      transition('* => slideInFromRight', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('1s ease-out'),
      ]),
      state('fadeInOut', style({ opacity: 1 })),
      transition(':enter', [style({ opacity: 0 }), animate('3.5s ease-in', style({ opacity: 1 }))]),
      transition(':leave', [animate('0.5s ease-out', style({ opacity: 0 }))]),
    ]),
  ],
})
export class FoodCategoryComponent implements OnInit {
  selectedCategory: any; // Default category
  @Output() categorySelected = new EventEmitter<string>();
  allCategories: CategoryDTO[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly toastr: ToastrService,
    private readonly router: Router,
    private readonly categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }
  loadAndSelectCategory(category: string): void {}

  selectCategory(category: CategoryDTO): void {
    // Toggle: clicking the active category clears the filter
    if (this.selectedCategory == category.id) {
      this.clearCategory();
      return;
    }
    this.router.navigate(['/menu'], { queryParams: { category: category.id } });
  }

  clearCategory(): void {
    this.selectedCategory = null;
    this.router.navigate(['/menu'], { queryParams: { category: null }, queryParamsHandling: 'merge' });
  }
  getCategoryImage(category: CategoryDTO): string {
    if (category.medias.length > 0) {
      return environment.apiStaticUrl + category.medias[0].url;
    } else {
      return '';
    }
  }

  loadCategories(): void {
    this.categoryService.findAllCategories().subscribe({
      next: (res: CategoryDTO[]) => {
        this.allCategories = res;
        this.route.queryParams.subscribe((params) => {
          // Update selectedCategory based on queryParams or default to 'Burger'
          this.selectedCategory = params['category'] || this.selectedCategory;
        });
      },
      error: (error) => {
        this.toastr.error('Error fetching categories:', error);
      },
    });

    // Update URL query parameters
    /*   this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page, category: categoryFilter, sort: priceSortDirection, default: isDefault },
          queryParamsHandling: 'merge',
        }); */
  }

  determineAnimation(i: number): string {
    return i < 4 ? 'slideInFromLeft' : 'slideInFromRight';
  }
}
