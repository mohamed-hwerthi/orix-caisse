import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import * as AuthActions from '../../../core/state/auth/auth.actions';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="logout()"
      title="Déconnexion"
      class="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-rose-900/20 dark:hover:text-rose-400">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
      </svg>
      <span class="hidden sm:inline">Déconnexion</span>
    </button>
  `,
})
export class LogoutButtonComponent {
  constructor(private readonly store: Store) {}

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
