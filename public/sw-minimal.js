// Minimal Service Worker for WagYu - Less likely to interfere with auth flows
const CACHE_NAME = 'wagyu-minimal-cache-v1';

// Only cache essential assets that we know exist
const ESSENTIAL_ASSETS = [
  '/',
  '/manifest.json'
];

// Installation event - minimal caching
self.addEventListener('install', event => {
  console.log('[Service Worker] Minimal install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching essential assets only');
        // Only cache assets that we're sure exist
        return Promise.allSettled(
          ESSENTIAL_ASSETS.map(asset => 
            cache.add(asset).catch(err => {
              console.warn(`[Service Worker] Failed to cache ${asset}:`, err);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('[Service Worker] Essential assets cached');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] Installation failed:', err);
        return self.skipWaiting();
      })
  );
});

// Activation event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Minimal activate');
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

// Fetch event - minimal interference
self.addEventListener('fetch', event => {
  // Skip all auth-related requests to avoid interference
  if (event.request.url.includes('/reset-password') || 
      event.request.url.includes('/auth/callback') ||
      event.request.url.includes('supabase.co/auth/') ||
      event.request.url.includes('/signin') ||
      event.request.url.includes('/signup') ||
      event.request.url.includes('/login') ||
      event.request.url.includes('/register')) {
    return; // Let the browser handle these requests normally
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Only handle navigation requests for offline support
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other requests, just let them pass through normally
  // This minimizes interference with the app's normal operation
});
