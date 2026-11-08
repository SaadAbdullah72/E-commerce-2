import { useQuery } from '@tanstack/react-query';

import {
  getCount,
  listAdminCategories,
  listAdminProducts,
  listLowStockProducts,
} from '../services/adminService';
import { getAdminCategory } from '../services/categoryAdminService';
import { getAdminProduct, listAdminDealTags } from '../services/productAdminService';

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

export const useAdminProduct = (id) =>
  useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => getAdminProduct(id),
    enabled: Boolean(id),
    staleTime: 0,
    gcTime: 0,
  });

export const useAdminDealTags = () =>
  useQuery({ queryKey: ['admin', 'deal-tags'], queryFn: listAdminDealTags, staleTime: STALE_MS });

export const useAdminCategory = (id) =>
  useQuery({
    queryKey: ['admin', 'category', id],
    queryFn: () => getAdminCategory(id),
    enabled: Boolean(id),
    staleTime: 0,
    gcTime: 0,
  });
