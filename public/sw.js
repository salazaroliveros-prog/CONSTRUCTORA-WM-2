const CACHE_NAME = 'wm-cache-v6';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache JS/CSS assets — let browser handle them directly
  // This prevents the "wrong MIME type" and "body already used" errors
  if (url.pathname.startsWith('/assets/')) return;

  // Navigation: network first, fallback to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static files (logo, manifest): cache-first, clone correctly
  if (url.pathname.match(/\.(png|jpg|svg|ico|json|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (!res.ok) return res;
          const clone = res.clone(); // clone BEFORE using
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
  }
});
