const CACHE_NAME = 'wm-ms-cache-v2';
const STATIC = ['/', '/index.html', '/manifest.json', '/logo.png'];

// Instalar y cachear estáticos
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activar inmediatamente sin esperar
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC)));
});

// Tomar control inmediato de todas las pestañas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: intenta red, si falla usa caché
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Para assets estáticos: cache-first
  if (event.request.url.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => 
        cached || fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Para navegación y datos: network-first
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
