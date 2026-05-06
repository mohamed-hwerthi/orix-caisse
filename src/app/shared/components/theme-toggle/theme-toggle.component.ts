import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

/**
 * Dark mode is disabled across the app — this component renders nothing.
 * Kept as a no-op so existing usages don't need to be removed.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: ``,
})
export class ThemeToggleComponent {}
