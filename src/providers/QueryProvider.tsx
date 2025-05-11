'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

// Function to determine if we're on a slow connection
const isSlowConnection = () => {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    // @ts-ignore - Connection API might not be fully typed
    const connection = navigator.connection;
    if (connection) {
      // @ts-ignore - Connection API might not be fully typed
      if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return true;
      }
    }
  }
  return false;
};

export default function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient instance for each session
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Enhanced caching configuration
        staleTime: 5 * 60 * 1000, // 5 minutes (increased from 1 minute)
        gcTime: 30 * 60 * 1000, // 30 minutes (garbage collection time)
        refetchOnWindowFocus: false, // Reduce unnecessary refetches
        refetchOnMount: false, // Use cached data when components mount
        refetchOnReconnect: 'always', // Always refetch when reconnecting
        retry: 2, // Increased retry attempts
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      },
    },
  }));

  // Listen for network status changes to adjust caching behavior
  useEffect(() => {
    const handleOnline = () => {
      // When coming back online, invalidate queries that might be stale
      queryClient.invalidateQueries();
    };

    // When offline, maximize cache usage
    const handleOffline = () => {
      queryClient.setDefaultOptions({
        queries: {
          staleTime: Infinity, // Don't mark data as stale when offline
          gcTime: Infinity, // Keep cache forever when offline
          retry: false, // Don't retry when offline
        },
      });
    };

    // Adjust for slow connections
    if (isSlowConnection()) {
      queryClient.setDefaultOptions({
        queries: {
          staleTime: 60 * 60 * 1000, // 1 hour for slow connections
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
      });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
