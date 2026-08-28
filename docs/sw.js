const CACHE_NAME = 'discorso-ga-v8';
const urlsToCache = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './settings.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Google Fonts: cache-first with network fallback (fonts rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // settings.json: always try network first so the latest timing is used,
  // falling back to cache only when offline.
  if (url.pathname.endsWith('/settings.json')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML shell ('/' and './index.html'): network-first so the LATEST page code
  // (and therefore the latest settings fetching) always reaches every device.
  // Prevents stale service workers / cached old pages from serving old settings.
  if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // All other requests (icons, manifest, static assets): cache-first, network fallback
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
