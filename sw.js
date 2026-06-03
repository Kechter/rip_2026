const CACHE_NAME = 'rip-crew-planner-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './config.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Ignore non-GET requests (e.g. Supabase POST/PATCH)
  if (e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If it's a successful response and not a Supabase API call, cache it
        if (response.status === 200 && !e.request.url.includes('supabase.co')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
