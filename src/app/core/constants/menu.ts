import { MenuItem } from '../models/nav-menu-item.model';

export class Menu {
  public static pages: MenuItem[] = [
    {
      group: 'Pilotage',
      separator: true,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/chart-pie.svg',
          label: 'Dashboard',
          route: '/admin/dashboard',
        },
        {
          icon: 'assets/icons/heroicons/outline/cursor-click.svg',
          label: 'Caisse',
          route: '/menu',
        },
      ],
    },
    {
      group: 'Catalogue',
      separator: true,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/gift.svg',
          label: 'Articles',
          route: '/admin/items',
        },
        {
          icon: 'assets/icons/heroicons/outline/star.svg',
          label: 'Promotions',
          route: '/admin/promotions',
        },
      ],
    },
    {
      group: 'Stock',
      separator: true,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/view-grid.svg',
          label: 'Mouvements',
          route: '/admin/stock',
        },
        {
          icon: 'assets/icons/heroicons/outline/bell.svg',
          label: 'Stock à risque',
          route: '/admin/stock-alerts',
        },
        {
          icon: 'assets/icons/heroicons/outline/folder.svg',
          label: 'Lots & péremptions',
          route: '/admin/stock-lots',
        },
        {
          icon: 'assets/icons/heroicons/outline/edit.svg',
          label: 'Inventaire physique',
          route: '/admin/inventory',
        },
      ],
    },
    {
      group: 'Ventes',
      separator: true,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/download.svg',
          label: 'Commandes',
          route: '/admin/orders',
        },
        {
          icon: 'assets/icons/heroicons/outline/lock-closed.svg',
          label: 'Sessions de caisse',
          route: '/admin/cash-sessions',
        },
      ],
    },
  ];
}
