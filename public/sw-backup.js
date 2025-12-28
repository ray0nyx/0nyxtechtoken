// WagYu Trading Journal Service Worker
const CACHE_NAME = 'wagyu-cache-v1';

// Assets to cache initially
const STATIC_ASSETS = [
  '/',
  '/index.html', 
  '/manifest.json',
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-167x167.png',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/og-image.png'
];

// Installation event - cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        // Cache assets individually to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(err => {
              console.warn(`[Service Worker] Failed to cache ${asset}:`, err);
              return null; // Continue with other assets even if one fails
            })
          )
        );
      })
      .then(() => {
        console.log('[Service Worker] Static assets caching completed');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] Installation failed:', err);
        // Don't fail the installation if caching fails
        return self.skipWaiting();
      })
  );
});

// Activation event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('[Service Worker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - respond with cached assets or fetch from network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests like those for Google Analytics
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip password reset and auth-related requests to avoid interference
  if (event.request.url.includes('/reset-password') || 
      event.request.url.includes('/auth/callback') ||
      event.request.url.includes('supabase.co/auth/')) {
    return;
  }

  // For navigation requests, try the network first, then the cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For asset requests, try the cache first, then the network
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        // Don't cache responses that aren't successful
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response because it's a stream that can only be consumed once
        const responseToCache = response.clone();
        
        // Only cache static assets and images, and do it safely
        if (
          event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
        ) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache).catch(err => {
              console.warn('[Service Worker] Failed to cache response:', err);
            });
          }).catch(err => {
            console.warn('[Service Worker] Failed to open cache:', err);
          });
        }
        
        return response;
      }).catch(err => {
        console.warn('[Service Worker] Fetch failed:', err);
        // Return a basic response or let the browser handle it
        return new Response('Network error', { status: 408, statusText: 'Request Timeout' });
      });
    }).catch(err => {
      console.warn('[Service Worker] Cache match failed:', err);
      // Fallback to network fetch
      return fetch(event.request).catch(() => {
        return new Response('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
}); 