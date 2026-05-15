/**
 * Service Worker — Offline-first PWA
 * Estrategia: Network-first para navegación, Stale-While-Revalidate para assets.
 * IMPORTANTE: Cambiar CACHE_VERSION invalida TODO el caché anterior.
 */
const CACHE_VERSION = 'v13';
const CACHE_NAME = `wm-erp-${CACHE_VERSION}`;
const STATIC_CACHE = `wm-static-${CACHE_VERSION}`;

// NO pre-cachear index.html aquí — se sirve siempre network-first
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.webp',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for skipWaiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (Firebase APIs, fonts, etc.) — don't intercept them
  if (url.origin !== location.origin) return;

  // API requests — network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithFallback(event.request));
    return;
  }

  // HTML navigation — always network first (SPA fallback)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstOrFallback(event.request));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — Stale-While-Revalidate
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Default — network first
  event.respondWith(networkFirst(event.request));
});

/** Network-first: try network, fallback to cache */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Network-first with graceful fallback (no console spam on failure) */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
      return response;
    }
    // If server returns error (4xx, 5xx), try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    return response; // return the error response as-is
  } catch (error) {
    // Network failure — try cache, otherwise return offline response
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sin conexión a internet' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Network-first with fallback to cached index.html for SPA routing */
async function networkFirstOrFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
      return response;
    }
  } catch (error) {
    // Network failed — fall through to cache
  }
  // Fallback: cached index.html for SPA routes (e.g., /dashboard, /projects)
  const cached = await caches.match('/index.html');
  return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

/** Stale-While-Revalidate: serve from cache immediately, update in background */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Fire-and-forget network update
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => cached);

  // Return cached version immediately if available
  if (cached) return cached;

  // Otherwise wait for network
  return fetchPromise;
}

/** Check if URL is a static asset (JS, CSS, images, fonts) */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|json|map)$/i.test(pathname);
}

// Handle background sync for data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Syncing offline data...');
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || 'Nueva notificación de Constructora WM',
    icon: '/logo.webp',
    badge: '/logo.webp',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Constructora WM', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

console.log('[SW] Service Worker loaded');