// Shlomi's own analytics for /links/, /wiki/ and the characters' sites (public/t.js sends the events).
//   track  - one small event per action: what, when, where from, which character / video. No IP, no cookies, no text
//            people type to the characters. Raw events carry `exp` (90 days; Firestore TTL deletes them), and each
//            event also bumps that day's counters in analytics_days, which stay.
//   stats  - the /stats/ dashboard: verifies the Google sign-in is shlomi@boostart.io, returns days + latest events.
// Deploy from this folder: firebase deploy --only functions:track,functions:stats
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;
const OWNER = 'shlomi@boostart.io';
const KEEP_DAYS = 90;

// what a visitor can do; anything else is dropped
const EVENTS = new Set([
  'view',          // a page or a wiki screen was opened          x = page / route
  'character',     // a character's page or card was opened        x = character id
  'chat_open',     // a chat window opened                         x = character id or 'guide'
  'chat_message',  // a message was sent to a character            x = character id or 'guide'
  'chat_switch',   // "bring into the chat" / the strip of faces   x = character id
  'ask',           // the question box on /links/ or the wiki hero x = who answers
  'video',         // a video started playing                      x = video id
  'site',          // a character's site was opened                x = site id
  'contact',       // WhatsApp / email for collaborations          x = whatsapp | mail
  'social',        // TikTok / Instagram / YouTube / Facebook / X            x = network
  'search',        // the wiki search box                          x = the search words (40 chars)
  'click',         // any other link out                           x = where
]);
const SITES = new Set(['links', 'wiki', 'ayelet', 'demokratovich', 'hindsight', 'dorit', 'ofnat-hani', 'shefa-ad', 'birkat-hashefa', 'friedman', 'hani-games', 'homo-useless', 'techytech', 'yotamverse', 'other']);
const SOURCES = new Set(['tiktok', 'instagram', 'facebook', 'youtube', 'x', 'google', 'whatsapp', 'internal', 'direct', 'other']);
const ORIGINS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/, /^https:\/\/techytech(--[\w-]+)?\.web\.app$/];

const clean = (v, n) => String(v ?? '').replace(/[^\p{L}\p{N} _\-./:]/gu, '').trim().slice(0, n);
const key = (v) => clean(v, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '_';   // a safe field name for counters
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);  // YYYY-MM-DD

// a few hundred events per address per hour, per instance - enough to stop a script filling the database
const recent = new Map();
const tooMany = (ip) => {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 300;
};

exports.track = onRequest({ region: 'europe-west1', maxInstances: 2, concurrency: 80, memory: '256MiB', timeoutSeconds: 10 }, async (req, res) => {
  // sendBeacon posts text/plain, so there is no CORS preflight; the origin check keeps other sites out
  const origin = req.get('origin') || '';
  if (origin && ORIGINS.some((r) => r.test(origin))) res.set('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST' || !ORIGINS.some((r) => r.test(origin))) return res.status(204).send('');
  if (/bot|crawl|spider|headless|preview|lighthouse/i.test(req.get('user-agent') || '')) return res.status(204).send('');
  if (tooMany(req.ip)) return res.status(204).send('');
  let b;
  try { b = JSON.parse(typeof req.body === 'string' ? req.body : req.rawBody.toString('utf8')); } catch { return res.status(204).send(''); }
  if (!b || !EVENTS.has(b.e)) return res.status(204).send('');

  const site = SITES.has(b.p) ? b.p : 'other';
  const src = SOURCES.has(b.r) ? b.r : 'other';
  const x = clean(b.x, b.e === 'search' ? 40 : 60);
  const now = new Date(), day = dayIL(now);
  const event = { t: Timestamp.fromDate(now), d: day, e: b.e, p: site, x, r: src, m: !!b.m, v: clean(b.v, 10), s: clean(b.s, 10),
    exp: Timestamp.fromMillis(now.getTime() + KEEP_DAYS * 864e5) };
  // one merged write per day doc; nested maps (not dotted paths) so set+merge adds to what is there
  const inc = FieldValue.increment(1);
  const day_ = { d: day, n: { [b.e]: inc } };
  if (b.e !== 'search') day_.n[`${b.e}|${key(x)}`] = inc;           // search words go to the event log only
  if (b.e === 'view') day_.site = { [site]: inc };
  if (b.first) Object.assign(day_, { visitors: inc, src: { [src]: inc }, dev: { [b.m ? 'phone' : 'desktop']: inc } });  // the visitor's first event today
  if (b.fresh) day_.new_visitors = inc;                                 // a browser never seen before
  try {
    await Promise.all([db.collection('analytics_events').add(event), db.collection('analytics_days').doc(day).set(day_, { merge: true })]);
  } catch (e) { console.error('track failed', e.message); }
  res.status(204).send('');
});

exports.stats = onRequest({ region: 'europe-west1', maxInstances: 1, memory: '256MiB', timeoutSeconds: 30,
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^http:\/\/localhost(:\d+)?$/] }, async (req, res) => {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '');
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (user.email !== OWNER || !user.email_verified) return res.status(403).json({ error: 'not_owner' });
  } catch { return res.status(401).json({ error: 'sign_in' }); }
  // /all/ - his private list of everything he runs (scripts/all/catalog.py writes it), plus what he archived there
  const shelf = db.collection('owner').doc('all');
  if (req.query.archive && req.method === 'POST') {   // { url, on: true | false }
    const { url, on } = req.body || {};
    if (typeof url !== 'string' || !url) return res.status(400).json({ error: 'url' });
    await shelf.set({ archived: on ? FieldValue.arrayUnion(url) : FieldValue.arrayRemove(url) }, { merge: true });
    return res.json({ ok: true });
  }
  if (req.query.catalog) return res.json({ ...require('./catalog.json'), archived: ((await shelf.get()).data() || {}).archived || [] });
  const daysBack = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const from = dayIL(new Date(Date.now() - (daysBack - 1) * 864e5));
  // the conversations with the characters (wiki.js keeps them), newest first
  if (req.query.chats) {
    const since = Date.now() - daysBack * 864e5;
    const snap = await db.collection('chat_logs').orderBy('t', 'desc').limit(600).get();
    return res.json({ chats: snap.docs.map((d) => { const c = d.data(); return { ...c, t: c.t.toMillis(), exp: undefined }; }).filter((c) => c.t >= since) });
  }
  const [days, events] = await Promise.all([
    db.collection('analytics_days').where('d', '>=', from).orderBy('d').get(),
    db.collection('analytics_events').orderBy('t', 'desc').limit(Math.min(parseInt(req.query.limit, 10) || 300, 1000)).get(),
  ]);
  res.json({
    from,
    days: days.docs.map((d) => d.data()),
    events: events.docs.map((d) => { const e = d.data(); return { ...e, t: e.t.toMillis(), exp: undefined }; }),
  });
});
