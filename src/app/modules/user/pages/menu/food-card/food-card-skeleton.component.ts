import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-food-card-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="aspect-square bg-gray-200 dark:bg-gray-700"></div>
      <div class="space-y-2 p-3">
        <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-6 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
    </div>
  `,
})
export class FoodCardSkeletonComponent {}
