const CACHE_NAME = 'wm-cache-v7';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cuando se navega a la app (ej: clic en URL de Vercel),
// si ya hay una ventana abierta → enfocarla y navegar ahí en lugar de abrir nueva
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        // Si hay una ventana ya abierta con esta app, enfocarla
        const existing = clients.find(c => c.url.startsWith(self.location.origin));
        if (existing && 'focus' in existing) {
          existing.focus();
          existing.navigate(url.href);
        }
        // Siempre responder con la página (network-first, fallback index.html)
        return fetch(event.request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // Static files: cache-first
  if (url.pathname.match(/\.(png|jpg|svg|ico|json|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (!res.ok) return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
  }
});
