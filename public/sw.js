// The Shlomiverse's service worker (root of shlomiverse.com, scope /): push notifications only. It never touches
// fetches, so the games, the links page and every other page load exactly as without it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'השלומיוורס', {
    body: d.body || '',
    icon: d.icon || '/verse/icon-192.png',
    badge: d.badge || '/verse/badge-96.png',
    image: d.image,
    tag: d.tag,
    renotify: !!d.tag,
    dir: 'rtl',
    lang: 'he',
    data: { url: d.url || '/wiki/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || '/wiki/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => new URL(w.url).pathname.startsWith('/wiki'));
    if (open) { await open.focus(); return open.navigate(url).catch(() => open.postMessage({ go: url })); }
    return self.clients.openWindow(url);
  })());
});
