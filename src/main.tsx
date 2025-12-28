import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary';
import { SolanaWalletContextProvider } from './contexts/SolanaWalletContext';

// Render immediately with error boundary
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

// Initialize auth in background (non-blocking)
import('./lib/authInit').then(({ initAuth }) => {
  return initAuth().catch(() => {});
}).catch(() => {});

// Unregister all service workers in development immediately
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister().catch(() => {});
    });
  });
}

// Render with error boundary
console.log('Rendering app...');
root.render(
  <ErrorBoundary fallback={
    <div style={{ padding: '20px', fontFamily: 'system-ui', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Application Error</h1>
        <p style={{ marginBottom: '16px' }}>Failed to load the application. Please check the browser console for details.</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Refresh Page
        </button>
      </div>
    </div>
  }>
    <SolanaWalletContextProvider>
      <App />
    </SolanaWalletContextProvider>
  </ErrorBoundary>
);
console.log('App rendered');

// Log any unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
