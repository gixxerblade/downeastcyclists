import {useRouter} from 'next/router';
import {useEffect} from 'react';

// Import global styles if needed
// import '../app/globals.css';

// Create a simple in-memory cache for page data
const pageCache = new Map();

function MyApp({Component, pageProps}) {
  const router = useRouter();

  useEffect(() => {
    // Cache current page data
    if (pageProps && Object.keys(pageProps).length > 0) {
      pageCache.set(router.asPath, pageProps);
    }

    // Add event listeners for route changes
    const handleRouteChangeStart = (url) => {
      // Check if we have the page data in cache
      if (pageCache.has(url)) {
        // We could potentially use this cached data while loading
        // This is a simple implementation - in a real app you might
        // want to use SWR or React Query for more sophisticated caching
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [pageProps, router]);

  // Add prefetching for linked pages
  useEffect(() => {
    const prefetchLinkedPages = () => {
      // Find all links on the page
      const links = document.querySelectorAll('a[href^="/"]');

      // Prefetch each internal link
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('/_next') && !href.includes('#')) {
          router.prefetch(href);
        }
      });
    };

    // Run after a short delay to not block initial page load
    const timer = setTimeout(prefetchLinkedPages, 2000);

    return () => clearTimeout(timer);
  }, [router.asPath, router]);

  return <Component {...pageProps} />;
}

export default MyApp;
