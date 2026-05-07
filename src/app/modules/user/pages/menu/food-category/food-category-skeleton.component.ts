import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-food-category-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto px-3 pt-2 pb-1">
      <div class="flex items-center gap-1.5">
        <div *ngFor="let i of skeletons" class="h-6 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
      </div>
    </div>
  `,
})
export class FoodCategorySkeletonComponent {
  skeletons = [1, 2, 3, 4, 5];
}
