import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enhanced Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
        
        // Check for updates automatically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // When the new service worker is ready, reload to activate it
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New content available, will refresh...');
                // Auto-refresh after a short delay to let user finish their task
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
  
  // Handle online/offline events
  window.addEventListener('online', () => {
    console.log('App is online');
    document.body.classList.remove('offline-mode');
  });
  
  window.addEventListener('offline', () => {
    console.log('App is offline');
    document.body.classList.add('offline-mode');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
