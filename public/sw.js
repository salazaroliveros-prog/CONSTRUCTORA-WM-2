const CACHE_NAME = 'wm-ms-cache-v5';
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
      // Force all open tabs to reload so they get the latest version
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept Google auth, Firebase or external requests
  if (
    url.hostname.includes('google') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('googleapis') ||
    url.origin !== self.location.origin
  ) return;

  // Navigation: network-first, fallback to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Hashed assets (JS/CSS): cache-first
  if (url.pathname.match(/\/assets\/.+\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Images/fonts: cache-first
  if (url.pathname.match(/\.(png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        });
      })
    );
  }
});
