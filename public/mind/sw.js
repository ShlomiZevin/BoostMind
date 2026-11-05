// Mind's service worker (scope /mind/): notifications only - it never touches fetches, so the page loads exactly as
// without it. The server (techietech-api/mind.js, pushMe) sends { title, body, url, tag }; a tap opens that url.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'המוח השני', {
    body: d.body || '',
    icon: '/mind/icon-192.png',
    tag: d.tag,
    renotify: !!d.tag,
    dir: 'rtl',
    lang: 'he',
    data: { url: d.url || '/mind/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/mind/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => new URL(w.url).pathname.startsWith('/mind'));
    if (open) { await open.focus(); return open.navigate(url).catch(() => open.postMessage({ go: url })); }
    return self.clients.openWindow(url);
  })());
});
