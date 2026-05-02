import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-food-category-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="overflow-hidden">
      <div class="container relative z-10 mx-auto px-5 pt-10 pb-4">
        <div class="flex flex-wrap items-start justify-center gap-4 md:gap-6">
          <div *ngFor="let i of skeletons" class="flex animate-pulse flex-col items-center">
            <div class="h-24 w-24 rounded-2xl bg-gray-200 dark:bg-gray-700"></div>
            <div class="mt-2 h-3 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
    </section>
    <div class="relative flex items-center px-5 pb-5">
      <div class="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
      <div class="mx-4 h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
      <div class="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
    </div>
  `,
})
export class FoodCategorySkeletonComponent {
  skeletons = [1, 2, 3, 4];
}
