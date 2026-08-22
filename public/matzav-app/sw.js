// Bumped again when the app path moved from /workout-app/ to /matzav-app/
// (the brand-rename cleanup). Any older SW registered under the /workout-app/
// scope is stranded — the browser will pick up this file at the new scope on
// first visit to /matzav-app/, and Firebase 301-redirects the old path so
// installed PWAs open the new URL and re-register cleanly.
const CACHE_NAME = 'matzav-v2';
const PRECACHE_URLS = [
  '/matzav-app/',
  '/matzav-app/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for API calls, cache-first for assets
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return; // Let Firebase handle its own requests
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
