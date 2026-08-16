const CACHE_NAME = 'sentinelles-cache-v1';
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
  if (new URL(request.url).pathname.includes('/api/') || request.url.includes('supabase.co')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match('/index.html')))
  );
});
