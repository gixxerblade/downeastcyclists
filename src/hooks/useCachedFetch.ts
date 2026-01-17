import {useState, useEffect} from 'react';

interface CachedFetchOptions {
  cacheKey?: string;
  cacheDuration?: number; // in milliseconds
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  dedupingInterval?: number; // in milliseconds
}

interface CachedData<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
}

// Simple in-memory cache
const cache = new Map<string, {data: any; timestamp: number}>();

/**
 * A custom hook for fetching data with caching capabilities
 * This helps reduce the number of API calls by caching responses
 */
export function useCachedFetch<T = any>(
  url: string | null,
  options: CachedFetchOptions = {},
): CachedData<T> {
  const {
    cacheKey = url,
    cacheDuration = 5 * 60 * 1000, // 5 minutes default
    revalidateOnFocus = false,
    revalidateOnReconnect = true,
    dedupingInterval = 2000, // 2 seconds
  } = options;

  const [state, setState] = useState<CachedData<T>>({
    data: null,
    error: null,
    isLoading: true,
    isValidating: false,
  });

  // Function to fetch data
  const fetchData = async (shouldRevalidate = false) => {
    // If no URL or cacheKey, or if we're already validating and within the deduping interval, skip
    if (!url || !cacheKey || (state.isValidating && shouldRevalidate)) {
      return;
    }

    // Check cache first
    const cachedItem = cache.get(cacheKey);
    const now = Date.now();

    // If we have a valid cached item and we're not revalidating, use it
    if (cachedItem && now - cachedItem.timestamp < cacheDuration && !shouldRevalidate) {
      setState({
        data: cachedItem.data,
        error: null,
        isLoading: false,
        isValidating: false,
      });
      return;
    }

    // If we have a cached item but need to revalidate, show it while fetching
    if (cachedItem && shouldRevalidate) {
      setState({
        data: cachedItem.data,
        error: null,
        isLoading: false,
        isValidating: true,
      });
    } else {
      setState((prev) => ({...prev, isLoading: true, isValidating: true}));
    }

    try {
      // We've already checked that url is not null above
      const response = await fetch(url as string);

      // Handle non-OK responses
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Update cache
      cache.set(cacheKey as string, {data, timestamp: Date.now()});

      setState({
        data,
        error: null,
        isLoading: false,
        isValidating: false,
      });
    } catch (error) {
      setState({
        data: cachedItem?.data || null, // Keep old data if available
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
        isValidating: false,
      });
    }
  };

  useEffect(() => {
    // Skip if no URL is provided
    if (!url || !cacheKey) {
      setState({
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
      });
      return;
    }

    // Initial fetch
    fetchData();

    // Set up revalidation on focus if enabled
    const onFocus = () => {
      if (revalidateOnFocus) {
        fetchData(true);
      }
    };

    // Set up revalidation on reconnect if enabled
    const onReconnect = () => {
      if (revalidateOnReconnect) {
        fetchData(true);
      }
    };

    // Add event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      window.addEventListener('online', onReconnect);
    }

    // Clean up
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('online', onReconnect);
      }
    };
  }, [url, cacheKey, cacheDuration, revalidateOnFocus, revalidateOnReconnect]);

  return state;
}

// Helper function to manually clear the cache
export function clearCache(cacheKey?: string) {
  if (cacheKey) {
    cache.delete(cacheKey);
  } else {
    cache.clear();
  }
}

// Helper function to manually update the cache
export function updateCache<T>(cacheKey: string, updater: (oldData: T | null) => T) {
  const cachedItem = cache.get(cacheKey);
  const oldData = (cachedItem?.data as T) || null;
  const newData = updater(oldData);

  cache.set(cacheKey, {
    data: newData,
    timestamp: Date.now(),
  });

  return newData;
}
