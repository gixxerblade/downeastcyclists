import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrailData } from '@/src/utils/trails';

// Query key for trails
export const TRAILS_QUERY_KEY = ['trails'];

/**
 * Hook to fetch all trails
 */
export function useTrails() {
  return useQuery({
    queryKey: TRAILS_QUERY_KEY,
    queryFn: async (): Promise<TrailData[]> => {
      // Use relative URL in the browser, absolute URL in SSR
      const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/trails`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trails: ${response.status}`);
      }
      
      return response.json();
    },
  });
}

/**
 * Hook to update a trail
 */
export function useUpdateTrail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<Omit<TrailData, 'id'>> 
    }) => {
      // Use relative URL in the browser, absolute URL in SSR
      const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/trails/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update trail: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch trails query when a trail is updated
      queryClient.invalidateQueries({ queryKey: TRAILS_QUERY_KEY });
    },
  });
}
