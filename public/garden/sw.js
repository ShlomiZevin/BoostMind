// רופא הגינה's service worker (scope /garden/): there so the phone installs it as an app - it never touches fetches, so the
// page always loads fresh from the site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
