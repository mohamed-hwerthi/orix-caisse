import { Injectable, signal } from '@angular/core';
import { Theme } from '../core/models/theme.model';
import { effect } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Dark mode disabled — always light.
  public theme = signal<Theme>({ mode: 'light', color: 'base' });

  constructor() {
    this.loadTheme();
    // Force light regardless of stored preference
    if (this.theme().mode !== 'light') {
      this.theme.update((t) => ({ ...t, mode: 'light' }));
    }
    effect(() => {
      this.setTheme();
    });
  }

  private loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme) {
      try {
        const parsed = JSON.parse(theme) as Theme;
        // Override mode to light always
        this.theme.set({ ...parsed, mode: 'light' });
      } catch {
        // ignore corrupted storage
      }
    }
  }

  private setTheme() {
    localStorage.setItem('theme', JSON.stringify(this.theme()));
    this.setThemeClass();
  }

  /** Always false — dark mode is disabled. */
  public get isDark(): boolean {
    return false;
  }

  private setThemeClass() {
    // Force light class regardless of theme mode
    document.querySelector('html')!.className = 'light';
    document.querySelector('html')!.setAttribute('data-theme', this.theme().color);
  }
}
