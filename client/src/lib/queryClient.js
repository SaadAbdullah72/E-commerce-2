import { QueryClient } from '@tanstack/react-query';

/** One shared cache for server data. Catalog data changes rarely, so keep it a minute. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
