import { useQuery } from '@tanstack/react-query';

import {
  getCount,
  listAdminCategories,
  listAdminProducts,
  listLowStockProducts,
} from '../services/adminService';

const STALE_MS = 30_000;

export const useAdminCount = (name) =>
  useQuery({
    queryKey: ['admin', 'count', name],
    queryFn: () => getCount(name),
    staleTime: STALE_MS,
  });

export const useLowStockProducts = () =>
  useQuery({
    queryKey: ['admin', 'low-stock'],
    queryFn: () => listLowStockProducts(),
    staleTime: STALE_MS,
  });

export const useAdminProducts = () =>
  useQuery({ queryKey: ['admin', 'products'], queryFn: listAdminProducts, staleTime: STALE_MS });

export const useAdminCategories = () =>
  useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: listAdminCategories,
    staleTime: STALE_MS,
  });
