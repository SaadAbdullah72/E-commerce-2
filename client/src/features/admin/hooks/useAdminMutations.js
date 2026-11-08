import { useMutation, useQueryClient } from '@tanstack/react-query';

import { saveCategory, setCategoryActive } from '../services/categoryAdminService';
import { saveProduct, setProductActive } from '../services/productAdminService';

/** After any change, the admin lists and the public shop must not show stale data. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
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
