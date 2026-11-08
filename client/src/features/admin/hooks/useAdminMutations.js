import { useMutation, useQueryClient } from '@tanstack/react-query';

import { saveBanner, setBannerActive, swapBannerOrder } from '../services/bannerAdminService';
import { saveCategory, setCategoryActive } from '../services/categoryAdminService';
import { saveCoupon, setCouponActive } from '../services/couponAdminService';
import { saveProduct, setProductActive } from '../services/productAdminService';

/** After any change, the admin lists and the public shop must not show stale data. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['banners'] }),
    ]);
}

export function useSaveProduct() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ id, payload }) => saveProduct(id, payload),
    onSuccess: refresh,
  });
}

export function useSetProductActive() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ id, isActive }) => setProductActive(id, isActive),
    onSuccess: refresh,
  });
}

export function useSaveCategory() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ id, row }) => saveCategory(id, row),
    onSuccess: refresh,
  });
}

export function useSetCategoryActive() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ id, isActive }) => setCategoryActive(id, isActive),
    onSuccess: refresh,
  });
}

export function useSaveCoupon() {
  const refresh = useRefreshAfterChange();
  return useMutation({ mutationFn: ({ id, row }) => saveCoupon(id, row), onSuccess: refresh });
}

export function useSetCouponActive() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ id, isActive }) => setCouponActive(id, isActive),
    onSuccess: refresh,
  });
}

export function useSaveBanner() {
  const refresh = useRefreshAfterChange();
  return useMutation({ mutationFn: ({ id, row }) => saveBanner(id, row), onSuccess: refresh });
}

export function useSetBannerActive() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ id, isActive }) => setBannerActive(id, isActive),
    onSuccess: refresh,
  });
}

export function useSwapBannerOrder() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ first, second }) => swapBannerOrder(first, second),
    onSuccess: refresh,
  });
}
