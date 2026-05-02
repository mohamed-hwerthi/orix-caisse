import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type OrderProgressState = 'idle' | 'placing' | 'invoicing' | 'done' | 'error';

@Component({
  selector: 'app-order-progress-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="state !== 'idle'"
         class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
         (click)="onBackdropClick($event)">
      <div class="w-[420px] max-w-[92vw] rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
           (click)="$event.stopPropagation()">

        <h3 class="mb-5 text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ headerLabel }}
        </h3>

        <ul class="space-y-3">
          <li class="flex items-center gap-3 text-sm" [ngClass]="rowClass('placing')">
            <ng-container [ngSwitch]="rowState('placing')">
              <span *ngSwitchCase="'pending'" class="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-700"></span>
              <span *ngSwitchCase="'active'"
                    class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
              <svg *ngSwitchCase="'done'" class="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <svg *ngSwitchCase="'error'" class="h-5 w-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </ng-container>
            <span>Placing order…</span>
          </li>

          <li class="flex items-center gap-3 text-sm" [ngClass]="rowClass('invoicing')">
            <ng-container [ngSwitch]="rowState('invoicing')">
              <span *ngSwitchCase="'pending'" class="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-700"></span>
              <span *ngSwitchCase="'active'"
                    class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
              <svg *ngSwitchCase="'done'" class="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <svg *ngSwitchCase="'error'" class="h-5 w-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </ng-container>
            <span>Generating invoice…</span>
          </li>
        </ul>

        <p *ngIf="state === 'done'"
           class="mt-5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ✓ Order #{{ orderId }} ready — invoice opened.
        </p>

        <div *ngIf="state === 'error'" class="mt-5 space-y-3">
          <p class="text-sm font-medium text-rose-600 dark:text-rose-400">
            {{ errorMessage || 'Something went wrong.' }}
          </p>
          <div class="flex justify-end gap-2">
            <button type="button"
                    class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    (click)="close.emit()">Close</button>
            <button type="button"
                    class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    (click)="retry.emit()">Retry</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class OrderProgressModalComponent {
  @Input() state: OrderProgressState = 'idle';
  @Input() orderId?: string | number;
  @Input() errorMessage?: string;

  @Output() retry = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  get headerLabel(): string {
    switch (this.state) {
      case 'done': return 'Order completed';
      case 'error': return 'Order failed';
      default: return 'Processing your order';
    }
  }

  rowState(row: 'placing' | 'invoicing'): 'pending' | 'active' | 'done' | 'error' {
    if (row === 'placing') {
      if (this.state === 'placing') return 'active';
      if (this.state === 'invoicing' || this.state === 'done') return 'done';
      if (this.state === 'error') return 'error';
      return 'pending';
    }
    if (row === 'invoicing') {
      if (this.state === 'invoicing') return 'active';
      if (this.state === 'done') return 'done';
      return 'pending';
    }
    return 'pending';
  }

  rowClass(row: 'placing' | 'invoicing'): string {
    const s = this.rowState(row);
    if (s === 'pending') return 'text-gray-400 dark:text-gray-500';
    if (s === 'active') return 'text-gray-900 dark:text-gray-100 font-medium';
    if (s === 'done') return 'text-emerald-600 dark:text-emerald-400';
    if (s === 'error') return 'text-rose-600 dark:text-rose-400';
    return '';
  }

  onBackdropClick(_: Event) {
    if (this.state === 'done' || this.state === 'error') this.close.emit();
  }
}
