# Caching Optimization for Next.js on Netlify

This document outlines the caching strategies implemented to reduce Netlify function calls for the Next.js Server Handler.

## Problem

Next.js applications deployed on Netlify can hit function execution limits because each page request triggers a Netlify function call to the Next.js Server Handler. This can lead to:

- Exhaustion of the monthly function execution quota
- Increased costs
- Potential site downtime

## Implemented Solutions

We've implemented a multi-layered caching strategy to minimize function calls:

### 1. Next.js Configuration Enhancements

In `next.config.js`, we've optimized the caching settings:

```js
// Enhanced caching configuration
onDemandEntries: {
  // Keep the build cache for a longer time
  maxInactiveAge: 24 * 60 * 60 * 1000, // 24 hours
  // Increase number of pages to keep in memory
  pagesBufferLength: 10,
},
// Configure static generation and ISR
staticPageGenerationTimeout: 120, // Increase timeout for static generation (in seconds)
experimental: {
  // Optimize serverless function size
  serverComponentsExternalPackages: ['@google-cloud/firestore'],
},
```

### 2. Netlify CDN Caching

In `netlify.toml`, we've added cache headers for different types of content:

```toml
# Cache configuration for Next.js Server Handler
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"

[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/_next/image*"
  [headers.values]
    Cache-Control = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=31536000"

[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
```

### 3. Middleware Caching

We've enhanced the middleware to add cache headers to responses based on content type:

```typescript
// Add caching headers based on the path
if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api/trails')) {
  // Default caching strategy for most pages
  let cacheControl = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
  
  // Different caching strategies based on content type
  if (pathname.startsWith('/_next/static/')) {
    // Static assets can be cached for a very long time
    cacheControl = 'public, max-age=31536000, immutable';
  } else if (pathname.startsWith('/_next/image')) {
    // Images can be cached for a day, with a week of stale-while-revalidate
    cacheControl = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=31536000';
  } else if (pathname.startsWith('/api/')) {
    // API routes should have shorter cache times
    cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
  }
  
  // Add the Cache-Control header to the response
  response.headers.set('Cache-Control', cacheControl);
}
```

### 4. Service Worker for Client-Side Caching

We've implemented a service worker (`public/sw.js`) that provides:

- Precaching of static assets
- Cache-first strategy for static assets
- Stale-while-revalidate for HTML pages
- Network-first with fallback for API requests

### 5. React Query Optimization

We've enhanced the React Query configuration in `QueryProvider.tsx`:

```typescript
// Enhanced caching configuration
staleTime: 5 * 60 * 1000, // 5 minutes (increased from 1 minute)
gcTime: 30 * 60 * 1000, // 30 minutes
refetchOnWindowFocus: false, // Reduce unnecessary refetches
refetchOnMount: false, // Use cached data when components mount
refetchOnReconnect: 'always', // Always refetch when reconnecting
```

### 6. Custom Caching Hook

We've created a custom `useCachedFetch` hook that provides:

- In-memory caching of API responses
- Configurable cache duration
- Conditional revalidation
- Network status awareness

### 7. Progressive Web App (PWA) Support

We've added PWA capabilities with:

- Web app manifest
- Service worker registration
- Cache-control meta tags

## Cache Invalidation Strategies

To ensure users always get fresh content when needed:

1. **Time-based invalidation**: Different cache durations for different content types
2. **Stale-while-revalidate**: Serve cached content while fetching fresh data in the background
3. **Optimistic updates**: Update the cache immediately on user actions, then validate with the server
4. **Manual cache clearing**: API to clear specific cache entries when needed

## Monitoring and Maintenance

To ensure the caching strategy remains effective:

1. Monitor Netlify function usage in the Netlify dashboard
2. Check browser network tab to verify cache hits
3. Periodically review and adjust cache durations based on content update frequency
4. Consider implementing analytics to track cache hit/miss rates

## Further Optimization Opportunities

1. **Static Site Generation (SSG)**: Convert more pages to static generation where possible
2. **Incremental Static Regeneration (ISR)**: Use ISR for semi-dynamic content
3. **Edge Functions**: Consider moving some logic to Netlify Edge Functions
4. **Content Delivery Network (CDN)**: Leverage additional CDN services for global distribution

## Conclusion

These caching strategies significantly reduce the number of Netlify function calls by serving cached content whenever possible. The multi-layered approach ensures that even when one caching mechanism fails, others can provide fallback responses.
