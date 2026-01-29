// Service Worker for DownEast Cyclists
const CACHE_NAME = 'downeast-cyclists-cache-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = ['/', '/favicon.ico', '/bicycle.svg', '/dec.svg'];

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            return caches.delete(cacheToDelete);
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Helper function to determine if a request is for an API
const isApiRequest = (url) => {
  return url.pathname.startsWith('/api/');
};

// Helper function to determine if a request is for a static asset
const isStaticAsset = (url) => {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp')
  );
};

// Helper function to determine if a request is for an HTML page
const isHtmlPage = (request) => {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept').includes('text/html'))
  );
};

// Fetch event - network first for API, cache first for static assets, stale-while-revalidate for pages
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip Netlify function requests
  if (url.pathname.startsWith('/.netlify/')) {
    return;
  }

  // Handle API requests - network first with timeout fallback to cache
  if (isApiRequest(url)) {
    // For API requests that should be cached (like trails)
    if (url.pathname === '/api/trails') {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
          return fetch(event.request)
            .then((response) => {
              // Cache the updated response
              cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => {
              // If network fails, try to return from cache
              return cache.match(event.request);
            });
        }),
      );
    }
    // For other API requests, don't cache
    return;
  }

  // Handle static assets - cache first, then network
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response immediately
          // Fetch from network in the background to update cache
          fetch(event.request).then((networkResponse) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
          });
          return cachedResponse;
        }

        // If not in cache, fetch from network and cache
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      }),
    );
    return;
  }

  // Handle HTML pages - stale-while-revalidate
  if (isHtmlPage(event.request)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Update the cache with the new response
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
          })
          .catch(() => {
            // If fetch fails and we don't have a cached response, show offline page
            if (!cachedResponse) {
              return caches.match('/');
            }
            return cachedResponse;
          });

        // Return the cached response immediately if available, otherwise wait for the network
        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }
});

// Handle push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/dec.svg',
      badge: '/dec.svg',
    };

    event.waitUntil(self.registration.showNotification('DownEast Cyclists', options));
  }
});
