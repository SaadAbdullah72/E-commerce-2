import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  deleteBanner,
  saveBanner,
  setBannerActive,
  swapBannerOrder,
} from '../services/bannerAdminService';
import { deleteCategory, saveCategory, setCategoryActive } from '../services/categoryAdminService';
import { deleteCoupon, saveCoupon, setCouponActive } from '../services/couponAdminService';
import { deleteProduct, saveProduct, setProductActive } from '../services/productAdminService';
import { requestAssetCleanup } from '../services/uploadService';

/** After any change, the admin lists and the public shop must not show stale data. */
function useRefreshAfterChange({ cleanup = false } = {}) {
  const queryClient = useQueryClient();
  return () => {
    // Pictures that were replaced or removed are deleted from Cloudinary in the background.
    if (cleanup) void requestAssetCleanup();
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['banners'] }),
    ]);
  };
}

export function useSaveProduct() {
  const refresh = useRefreshAfterChange({ cleanup: true });
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
  const refresh = useRefreshAfterChange({ cleanup: true });
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
  const refresh = useRefreshAfterChange({ cleanup: true });
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

export function useDeleteProduct() {
  const refresh = useRefreshAfterChange({ cleanup: true });
  return useMutation({ mutationFn: (id) => deleteProduct(id), onSuccess: refresh });
}

export function useDeleteCategory() {
  const refresh = useRefreshAfterChange({ cleanup: true });
  return useMutation({ mutationFn: (id) => deleteCategory(id), onSuccess: refresh });
}

export function useDeleteCoupon() {
  const refresh = useRefreshAfterChange();
  return useMutation({ mutationFn: (id) => deleteCoupon(id), onSuccess: refresh });
}

export function useDeleteBanner() {
  const refresh = useRefreshAfterChange({ cleanup: true });
  return useMutation({ mutationFn: (id) => deleteBanner(id), onSuccess: refresh });
}
