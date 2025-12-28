// Minimal Service Worker - No Caching to Avoid Auth Issues
const CACHE_NAME = 'wagyu-minimal-v1';

// Installation event - minimal setup
self.addEventListener('install', event => {
  console.log('[Service Worker] Minimal install');
  event.waitUntil(
    Promise.resolve().then(() => {
      console.log('[Service Worker] Minimal installation completed');
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

// Fetch event - minimal handling, no caching
self.addEventListener('fetch', event => {
  // Skip all cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip ALL auth-related requests to avoid interference
  if (event.request.url.includes('/reset-password') || 
      event.request.url.includes('/auth/callback') ||
      event.request.url.includes('/auth/reset') ||
      event.request.url.includes('supabase.co/auth/') ||
      event.request.url.includes('supabase.co/rest/') ||
      event.request.url.includes('supabase.co/storage/')) {
    return;
  }

  // For all other requests, just pass through to network
  // No caching to avoid any potential issues
  return;
});
