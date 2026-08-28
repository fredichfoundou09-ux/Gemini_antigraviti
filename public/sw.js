const CACHE_NAME = 'sentinelles-cache-v2';
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Ne pas intercepter les requêtes API ou Supabase
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase.co')) return;

  // Pour la navigation HTML principale, on tente le réseau, sinon cache index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Pour les scripts et feuilles de style, réseau avec mise en cache ou cache immédiat
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        }
        return response;
      }).catch(() => {
        // En cas d'échec sur un asset, ne JAMAIS renvoyer index.html (pour éviter les erreurs de type MIME)
        return new Response('', { status: 408, statusText: 'Request timed out' });
      });
    })
  );
});
