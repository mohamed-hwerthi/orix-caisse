export interface DailySales {
  day: string;
  ordersCount: number;
  revenue: number;
}

export interface SalesStats {
  from: string;
  to: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
  averageTicket: number;
  daily: DailySales[];
}

export interface TopProduct {
  menuItemId: number;
  title: string;
  quantitySold: number;
  revenue: number;
}
