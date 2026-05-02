import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin } from 'rxjs';

import { Order } from '../../../../core/models/order.model';
import { MenuItem } from '../../../../core/models';
import { MenuItemsService } from '../../../../services/menuItems.service';
import { OrdersService } from '../../../../services/orders.service';
import { ChartOptions } from '../../../../shared/models/chart-options';

interface ProductStat {
  id: number;
  title: string;
  quantitySold: number;
  revenue: number;
}

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './sales-history.component.html',
})
export class SalesHistoryComponent implements OnInit {
  isLoading = true;
  orders: Order[] = [];
  menuItemsMap = new Map<number, MenuItem>();

  // Stats
  todayRevenue = 0;
  todayOrdersCount = 0;
  todayItemsCount = 0;
  todayAverage = 0;
  weekRevenue = 0;

  topProducts: ProductStat[] = [];
  recentOrders: Order[] = [];

  // Charts
  revenueByHourChart: Partial<ChartOptions> = {};
  weeklySalesChart: Partial<ChartOptions> = {};
  topProductsChart: Partial<ChartOptions> = {};
  statusChart: any = {};

  // Skeleton helpers
  skeletonStats = [1, 2, 3, 4];
  skeletonRows = [1, 2, 3, 4, 5, 6];

  constructor(
    private readonly ordersService: OrdersService,
    private readonly menuItemsService: MenuItemsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      orders: this.ordersService.getAllOrders(1, 200),
      menuItems: this.menuItemsService.getAllMenuItems(1, 1000),
    }).subscribe({
      next: ({ orders, menuItems }) => {
        this.orders = orders || [];
        const items = (menuItems as any).items || [];
        items.forEach((mi: MenuItem) => this.menuItemsMap.set(mi.id, mi));
        this.computeStats();
        this.buildCharts();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  computeStats(): void {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    let revenueToday = 0;
    let revenueWeek = 0;
    let itemsToday = 0;
    const todayOrders: Order[] = [];
    const productMap = new Map<number, { qty: number; revenue: number }>();

    for (const order of this.orders) {
      const created = new Date(order.createdOn);
      if (created >= startOfWeek) {
        revenueWeek += order.totalCost || 0;
      }
      if (created >= startOfToday) {
        todayOrders.push(order);
        revenueToday += order.totalCost || 0;
        const quantities = order.menuItemQuantities || {};
        for (const [itemId, qty] of Object.entries(quantities)) {
          const id = Number(itemId);
          const q = Number(qty) || 0;
          itemsToday += q;
          const item = this.menuItemsMap.get(id);
          const price = item?.price || 0;
          const existing = productMap.get(id) || { qty: 0, revenue: 0 };
          productMap.set(id, { qty: existing.qty + q, revenue: existing.revenue + price * q });
        }
      }
    }

    this.todayRevenue = revenueToday;
    this.todayOrdersCount = todayOrders.length;
    this.todayItemsCount = itemsToday;
    this.todayAverage = todayOrders.length > 0 ? revenueToday / todayOrders.length : 0;
    this.weekRevenue = revenueWeek;

    this.recentOrders = [...todayOrders]
      .sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime())
      .slice(0, 10);

    this.topProducts = Array.from(productMap.entries())
      .map(([id, data]) => {
        const item = this.menuItemsMap.get(id);
        return {
          id,
          title: item?.title || `Article #${id}`,
          quantitySold: data.qty,
          revenue: data.revenue,
        } as ProductStat;
      })
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);
  }

  buildCharts(): void {
    this.buildRevenueByHourChart();
    this.buildWeeklySalesChart();
    this.buildTopProductsChart();
    this.buildStatusChart();
  }

  private buildRevenueByHourChart(): void {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hourly = new Array(24).fill(0);

    for (const order of this.orders) {
      const created = new Date(order.createdOn);
      if (created >= startOfToday) {
        const h = created.getHours();
        hourly[h] += order.totalCost || 0;
      }
    }

    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}h`);

    this.revenueByHourChart = {
      series: [{ name: 'Revenus', data: hourly.map(v => Number(v.toFixed(2))) }],
      chart: { type: 'area', height: 240, toolbar: { show: false }, fontFamily: 'inherit' },
      stroke: { curve: 'smooth', width: 2 },
      colors: ['#e11d48'],
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
      dataLabels: { enabled: false },
      xaxis: { categories: labels, labels: { style: { colors: '#9aa0ac', fontSize: '10px' } } },
      yaxis: { labels: { style: { colors: '#9aa0ac' }, formatter: (v: number) => v.toFixed(0) } },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      tooltip: { y: { formatter: (v: number) => `${v.toFixed(2)} TND` } },
    };
  }

  private buildWeeklySalesChart(): void {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days: { label: string; revenue: number; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const day = new Date(startOfToday);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      let revenue = 0;
      let count = 0;
      for (const order of this.orders) {
        const created = new Date(order.createdOn);
        if (created >= day && created < next) {
          revenue += order.totalCost || 0;
          count++;
        }
      }
      const label = day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
      days.push({ label, revenue, count });
    }

    this.weeklySalesChart = {
      series: [
        { name: 'Revenus (TND)', data: days.map(d => Number(d.revenue.toFixed(2))) } as any,
        { name: 'Commandes', data: days.map(d => d.count) } as any,
      ],
      chart: { type: 'bar', height: 280, toolbar: { show: false }, fontFamily: 'inherit', stacked: false },
      colors: ['#e11d48', '#3b82f6'],
      plotOptions: { bar: { horizontal: false, columnWidth: '50%', borderRadius: 6 } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: { categories: days.map(d => d.label), labels: { style: { colors: '#9aa0ac', fontSize: '11px' } } },
      yaxis: [
        { title: { text: 'TND', style: { color: '#9aa0ac' } }, labels: { style: { colors: '#9aa0ac' } } },
        { opposite: true, title: { text: 'Cmd', style: { color: '#9aa0ac' } }, labels: { style: { colors: '#9aa0ac' } } },
      ],
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#6b7280' } },
      fill: { opacity: 1 },
      tooltip: {},
    };
  }

  private buildTopProductsChart(): void {
    const top = this.topProducts;
    this.topProductsChart = {
      series: [{ name: 'Quantité vendue', data: top.map(p => p.quantitySold) }],
      chart: { type: 'bar', height: 280, toolbar: { show: false }, fontFamily: 'inherit' },
      colors: ['#e11d48'],
      plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%', distributed: false } },
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        offsetX: 0,
        style: { fontWeight: 'bold', colors: ['#fff'] },
        formatter: (val: any) => `${val}`,
      },
      xaxis: {
        categories: top.map(p => p.title.length > 18 ? p.title.substring(0, 18) + '…' : p.title),
        labels: { style: { colors: '#9aa0ac' } },
      },
      yaxis: { labels: { style: { colors: '#374151', fontSize: '12px' } } },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      tooltip: { y: { formatter: (v: number) => `${v} unité(s)` } },
    };
  }

  private buildStatusChart(): void {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const counts = { COMPLETED: 0, PENDING: 0, CANCELLED: 0 };

    for (const order of this.orders) {
      const created = new Date(order.createdOn);
      if (created >= startOfToday && order.status in counts) {
        counts[order.status as keyof typeof counts]++;
      }
    }

    this.statusChart = {
      series: [counts.COMPLETED, counts.PENDING, counts.CANCELLED],
      chart: { type: 'donut', height: 280, fontFamily: 'inherit' },
      labels: ['Complétées', 'En attente', 'Annulées'],
      colors: ['#10b981', '#f59e0b', '#ef4444'],
      stroke: { width: 0 },
      dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: 'bold' } },
      legend: { position: 'bottom', labels: { colors: '#6b7280' } },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: { show: true, label: 'Total', fontSize: '14px', color: '#6b7280', formatter: () => `${counts.COMPLETED + counts.PENDING + counts.CANCELLED}` },
              value: { fontSize: '24px', fontWeight: 'bold', color: '#111827' },
            },
          },
        },
      },
      tooltip: { y: { formatter: (v: number) => `${v} commande(s)` } },
    };
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  goBack(): void {
    this.router.navigate(['/menu']);
  }

  refresh(): void {
    this.loadData();
  }
}
