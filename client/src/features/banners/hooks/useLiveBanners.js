import { useQuery } from '@tanstack/react-query';

import { listLiveBanners } from '../services/bannerService';

/** @param {'hero' | 'announcement'} kind */
export const useLiveBanners = (kind) =>
  useQuery({
    queryKey: ['banners', 'live', kind],
    queryFn: () => listLiveBanners(kind),
    staleTime: 30_000,
  });
