import {
  ChartColumn,
  Image,
  LayoutDashboard,
  Package,
  ScrollText,
  ShoppingBag,
  Star,
  Tags,
  Ticket,
} from 'lucide-react';

/** The sidebar's groups, in order. Each lists the section paths (see ADMIN_SECTIONS) it holds. */
export const NAV_GROUPS = [
  { label: 'Store', paths: [''] },
  { label: 'Catalog', paths: ['products', 'categories'] },
  { label: 'Sales', paths: ['orders', 'reviews', 'coupons'] },
  { label: 'Marketing', paths: ['banners'] },
  { label: 'Insights', paths: ['analytics', 'logs'] },
];

/** One icon per section path, all from lucide-react so the stroke and style match. */
export const NAV_ICONS = {
  '': LayoutDashboard,
  products: Package,
  categories: Tags,
  orders: ShoppingBag,
  reviews: Star,
  coupons: Ticket,
  banners: Image,
  analytics: ChartColumn,
  logs: ScrollText,
};
