/* Sicily trip guide — offline service worker
 *
 * ⚠️ שים לב: אחרי כל שינוי ב-index.html צריך להעלות את CACHE כאן.
 * הגרסה הקודמת הייתה cache-first על הכל, כולל ה-HTML — אז עדכון לאתר
 * פשוט לא הגיע למכשיר: הדפדפן הגיש את הדף מהמטמון ולא פנה לשרת בכלל.
 * ריענון לא עזר, כי גם הריענון נענה מהמטמון.
 *
 * עכשיו: HTML נטען מהרשת קודם (network-first) ונופל למטמון רק כשאין רשת,
 * ואילו הספריות החיצוניות והפונט נשארים cache-first כי הם לא משתנים.
 * ככה עדכון תמיד מגיע, והאפליקציה עדיין עובדת לגמרי אופליין.
 */
const CACHE = 'sicilia-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(u =>
        c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* HTML: network-first, cache as fallback. Everything else: cache-first. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isHTML = e.request.mode === 'navigate' ||
    (url.origin === self.location.origin && url.pathname.endsWith('/')) ||
    url.pathname.endsWith('index.html');

  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => undefined);
    })
  );
});
