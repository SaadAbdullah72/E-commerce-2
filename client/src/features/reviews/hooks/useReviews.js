import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isUuid } from '../../checkout/services/checkoutService';
import {
  deleteMyReview,
  editReview,
  getMyReviewState,
  getReviewSummary,
  listProductReviews,
  requestReviewCleanup,
  submitReview,
} from '../services/reviewService';

/** Approved reviews of a product, optionally one star rating, newest first. */
export const useProductReviews = (productId, rating) =>
  useInfiniteQuery({
    queryKey: ['reviews', 'list', productId, rating ?? 'all'],
    queryFn: ({ pageParam }) => listProductReviews(productId, { rating, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isUuid(productId),
  });

export const useReviewSummary = (productId) =>
  useQuery({
    queryKey: ['reviews', 'summary', productId],
    queryFn: () => getReviewSummary(productId),
    enabled: isUuid(productId),
  });

/** What this customer may do with this product, and their own review. Signed-in customers only. */
export const useMyReviewState = (productId, userId) =>
  useQuery({
    queryKey: ['reviews', 'mine', productId, userId],
    queryFn: () => getMyReviewState(productId),
    enabled: isUuid(productId) && Boolean(userId),
    staleTime: 0,
  });

function useRefreshReviews() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['reviews'] });
}

export function useSubmitReview() {
  const refresh = useRefreshReviews();
  return useMutation({ mutationFn: submitReview, onSuccess: refresh });
}

/** Editing may drop files; the server queues them, so ask it to clear Cloudinary afterwards. */
export function useEditReview() {
  const refresh = useRefreshReviews();
  return useMutation({
    mutationFn: editReview,
    onSuccess: () => {
      requestReviewCleanup();
      return refresh();
    },
  });
}

export function useDeleteReview() {
  const refresh = useRefreshReviews();
  return useMutation({
    mutationFn: deleteMyReview,
    onSuccess: () => {
      requestReviewCleanup();
      return refresh();
    },
  });
}
