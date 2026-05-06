import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { OverviewComponent } from './pages/overview/overview.component';
import { ItemsComponent } from './pages/items/items.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { UsersComponent } from './pages/users/users.component';
import { ReviewsComponent } from './pages/reviews/reviews.component';
import { StockComponent } from './pages/stock/stock.component';
import { StockAlertsComponent } from './pages/stock-alerts/stock-alerts.component';
import { StockLotsComponent } from './pages/stock-lots/stock-lots.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { CashSessionsComponent } from './pages/cash-sessions/cash-sessions.component';
import { PromotionsComponent } from './pages/promotions/promotions.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'items', component: ItemsComponent },
      { path: 'stock', component: StockComponent },
      { path: 'stock-alerts', component: StockAlertsComponent },
      { path: 'stock-lots', component: StockLotsComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'cash-sessions', component: CashSessionsComponent },
      { path: 'promotions', component: PromotionsComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'reviews', component: ReviewsComponent },
      { path: 'users', component: UsersComponent },
      { path: 'dashboard', component: OverviewComponent },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
