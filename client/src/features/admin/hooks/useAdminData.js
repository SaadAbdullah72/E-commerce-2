import { useQuery } from '@tanstack/react-query';

import {
  getCount,
  listAdminCategories,
  listAdminProducts,
  listLowStockProducts,
} from '../services/adminService';
import { getAdminBanner, listAdminBanners } from '../services/bannerAdminService';
import { getAdminCategory } from '../services/categoryAdminService';
import { getAdminCoupon, listAdminCoupons } from '../services/couponAdminService';
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

export const useAdminCoupons = () =>
  useQuery({ queryKey: ['admin', 'coupons'], queryFn: listAdminCoupons, staleTime: STALE_MS });

export const useAdminCoupon = (id) =>
  useQuery({
    queryKey: ['admin', 'coupon', id],
    queryFn: () => getAdminCoupon(id),
    enabled: Boolean(id),
    staleTime: 0,
    gcTime: 0,
  });

/** @param {'hero' | 'announcement'} kind */
export const useAdminBanners = (kind) =>
  useQuery({
    queryKey: ['admin', 'banners', kind],
    queryFn: () => listAdminBanners(kind),
    staleTime: STALE_MS,
  });

export const useAdminBanner = (id) =>
  useQuery({
    queryKey: ['admin', 'banner', id],
    queryFn: () => getAdminBanner(id),
    enabled: Boolean(id),
    staleTime: 0,
    gcTime: 0,
  });
