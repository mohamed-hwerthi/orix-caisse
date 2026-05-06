import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

import { OverviewComponent } from "../../admin/dashboard/pages/overview/overview.component";
import { CartComponent } from './components/cart/cart.component';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { CashSessionBarComponent } from '../../../shared/components/cash-session-bar/cash-session-bar.component';


@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, FooterComponent, CartComponent, OverviewComponent, CashSessionBarComponent],
})
export class LayoutComponent {
  showShortcuts = false;
  showCart = true;

  // Routes where the cart sidebar should be hidden
  private readonly cartHiddenRoutes = ['/sales-history'];

  constructor(private readonly router: Router) {
    this.updateCartVisibility(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateCartVisibility(e.urlAfterRedirects || e.url));
  }

  private updateCartVisibility(url: string): void {
    this.showCart = !this.cartHiddenRoutes.some((r) => url.startsWith(r));
  }

  toggleShortcuts(): void {
    this.showShortcuts = !this.showShortcuts;
  }
}
