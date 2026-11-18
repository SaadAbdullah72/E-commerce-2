import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isUuid } from '../../checkout/services/checkoutService';
import { requestReviewCleanup } from '../../reviews/services/reviewService';
import {
  countPendingReviews,
  deleteReview,
  getAdminReview,
  listAdminReviews,
  listReviewAudit,
  moderateReview,
  removeReviewMedia,
} from '../services/reviewAdminService';

export const useAdminReviews = (filters) =>
  useInfiniteQuery({
    queryKey: ['admin', 'reviews', 'list', filters],
    queryFn: ({ pageParam }) => listAdminReviews({ ...filters, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 0,
  });

export const useAdminReview = (reviewId) =>
  useQuery({
    queryKey: ['admin', 'reviews', 'detail', reviewId],
    queryFn: () => getAdminReview(reviewId),
    enabled: isUuid(reviewId),
    staleTime: 0,
  });

export const useReviewAudit = (reviewId) =>
  useQuery({
    queryKey: ['admin', 'reviews', 'audit', reviewId],
    queryFn: () => listReviewAudit(reviewId),
    enabled: isUuid(reviewId),
    staleTime: 0,
  });

/** Reviews waiting for a decision (sidebar badge). Cached for 30 seconds. */
export const usePendingReviewCount = () =>
  useQuery({
    queryKey: ['admin', 'reviews', 'pending-count'],
    queryFn: countPendingReviews,
    staleTime: 30_000,
  });

/** After any moderation change: admin lists, counts and log, and what customers see. */
function useRefreshAfterModeration() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
    ]);
}

export function useModerateReview() {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: ({ id, status }) => moderateReview(id, status),
    onSuccess: refresh,
  });
}

export function useDeleteReviewAsAdmin() {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: ({ id }) => deleteReview(id),
    onSuccess: () => {
      requestReviewCleanup();
      return refresh();
    },
  });
}

export function useRemoveReviewMedia() {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: ({ mediaId }) => removeReviewMedia(mediaId),
    onSuccess: () => {
      requestReviewCleanup();
      return refresh();
    },
  });
}
