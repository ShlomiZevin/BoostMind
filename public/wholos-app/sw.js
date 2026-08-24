// Bumped again when the app path moved from /workout-app/ to /wholos-app/
// (the brand-rename cleanup). Any older SW registered under the /workout-app/
// scope is stranded — the browser will pick up this file at the new scope on
// first visit to /wholos-app/, and Firebase 301-redirects the old path so
// installed PWAs open the new URL and re-register cleanly.
const CACHE_NAME = 'wholos-v2';
const PRECACHE_URLS = [
  '/wholos-app/',
  '/wholos-app/index.html',
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
  const req = event.request;

  // Only GETs are cacheable — cache.put() throws on a POST, and every AI call
  // is a POST. Let anything else go straight to the network untouched.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Third-party and API traffic handles its own errors and must not be
  // wrapped: intercepting a cross-origin API call turned a CORS failure into
  // an opaque "Failed to convert value to 'Response'" and hid the real cause.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Opaque/partial responses are not safely cacheable.
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(async () => {
        // A cache miss resolves to undefined, and respondWith(undefined) throws.
        // Always hand back a real Response.
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const shell = await caches.match('/wholos-app/index.html');
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      })
  );
});
