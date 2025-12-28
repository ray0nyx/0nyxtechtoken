// Script to clear service workers and fix cache issues
// Run this in the browser console or as a bookmark

console.log('🧹 Clearing service workers and cache...');

// Clear all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => {
      console.log(`Found ${registrations.length} service worker(s) to unregister`);
      
      const unregisterPromises = registrations.map(registration => {
        console.log('Unregistering:', registration.scope);
        return registration.unregister();
      });
      
      return Promise.all(unregisterPromises);
    })
    .then(() => {
      console.log('✅ All service workers unregistered');
      
      // Clear all caches
      return caches.keys();
    })
    .then(cacheNames => {
      console.log(`Found ${cacheNames.length} cache(s) to clear`);
      
      const deletePromises = cacheNames.map(cacheName => {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      });
      
      return Promise.all(deletePromises);
    })
    .then(() => {
      console.log('✅ All caches cleared');
      console.log('🔄 Please refresh the page to complete the cleanup');
      
      // Optionally refresh the page
      if (confirm('Service workers and cache cleared. Refresh the page now?')) {
        window.location.reload();
      }
    })
    .catch(error => {
      console.error('❌ Error clearing service workers:', error);
    });
} else {
  console.log('❌ Service workers not supported in this browser');
}

// Also clear localStorage and sessionStorage if needed
console.log('🧹 Clearing local storage...');
localStorage.clear();
sessionStorage.clear();
console.log('✅ Local storage cleared');
