import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {TrailData} from '@/src/utils/trails';

import {useCachedFetch, updateCache} from './useCachedFetch';

// Query key for trails
export const TRAILS_QUERY_KEY = ['trails'];

/**
 * Hook to fetch all trails with enhanced caching
 */
export function useTrails() {
  // Use both React Query and our custom cache for maximum caching efficiency
  const queryClient = useQueryClient();

  // First, try to get data from our custom cache
  const {data: cachedData, isLoading: isCacheLoading} = useCachedFetch<TrailData[]>('/api/trails', {
    cacheKey: 'trails-data',
    cacheDuration: 10 * 60 * 1000, // 10 minutes
    revalidateOnFocus: false,
  });

  // Then use React Query with a longer stale time
  const queryResult = useQuery({
    queryKey: TRAILS_QUERY_KEY,
    queryFn: async (): Promise<TrailData[]> => {
      // Use relative URL in the browser, absolute URL in SSR
      const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_BASE_URL || '';

      // Add cache-busting parameter for server requests to avoid Netlify function cache
      const cacheBuster = typeof window === 'undefined' ? `?_cb=${Date.now()}` : '';

      // Add cache headers to the request
      const response = await fetch(`${baseUrl}/api/trails${cacheBuster}`, {
        headers: {
          'Cache-Control': 'max-age=300, stale-while-revalidate=3600',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trails: ${response.status}`);
      }

      const data = await response.json();

      // Update our custom cache
      updateCache('trails-data', () => data);

      return data;
    },
    // Enhanced caching settings
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    // Use cached data if available
    initialData: cachedData || undefined,
    // Skip query if we already have cached data and it's not stale
    enabled:
      !cachedData ||
      Date.now() - (queryClient.getQueryState(TRAILS_QUERY_KEY)?.dataUpdatedAt || 0) >
        5 * 60 * 1000,
  });

  // Return the query result, but with isLoading considering both caches
  return {
    ...queryResult,
    isLoading: isCacheLoading && queryResult.isLoading,
    // Prioritize React Query data over our custom cache
    data: queryResult.data || cachedData || [],
  };
}

/**
 * Hook to update a trail with optimistic updates
 */
export function useUpdateTrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({id, data}: {id: string; data: Partial<Omit<TrailData, 'id'>>}) => {
      // Use relative URL in the browser, absolute URL in SSR
      const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/trails/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // Prevent caching of mutation requests
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to update trail: ${response.status}`);
      }

      return response.json();
    },
    // Optimistic update to reduce perceived latency
    onMutate: async ({id, data}) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({queryKey: TRAILS_QUERY_KEY});

      // Snapshot the previous value
      const previousTrails = queryClient.getQueryData<TrailData[]>(TRAILS_QUERY_KEY);

      // Optimistically update to the new value
      if (previousTrails) {
        queryClient.setQueryData<TrailData[]>(
          TRAILS_QUERY_KEY,
          previousTrails.map((trail) => (trail.id === id ? {...trail, ...data} : trail)),
        );

        // Also update our custom cache
        updateCache<TrailData[]>('trails-data', (oldData) => {
          if (!oldData) return previousTrails;
          return oldData.map((trail) => (trail.id === id ? {...trail, ...data} : trail));
        });
      }

      return {previousTrails};
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, variables, context) => {
      if (context?.previousTrails) {
        queryClient.setQueryData(TRAILS_QUERY_KEY, context.previousTrails);
        // Also roll back our custom cache
        updateCache('trails-data', () => context.previousTrails);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: TRAILS_QUERY_KEY});
    },
  });
}
