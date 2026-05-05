const CACHE_NAME = 'wm-ms-cache-v4';
const STATIC_ASSETS = ['/logo.png', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // index.html y navegación: siempre desde la red
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets con hash (JS/CSS): cache-first
  if (url.pathname.match(/\/assets\/.+\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          // Clonar ANTES de usar la respuesta
          const toCache = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, toCache));
          return res;
        });
      })
    );
    return;
  }

  // Imágenes y fuentes: cache-first
  if (url.pathname.match(/\.(png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const toCache = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, toCache));
          return res;
        });
      })
    );
    return;
  }

  // Todo lo demás (Firebase, APIs): solo red, sin caché
  event.respondWith(fetch(event.request));
});
