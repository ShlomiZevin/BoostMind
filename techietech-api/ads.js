// The Shlomiverse's sponsored banners ("ממומן") - his note 2026-11-09: Hani's video ends "בחסות עיגוליות" with a discount
// for Shlomiverse users, so the verse carries the ad too (part of the world). One general slot (verse/ads.js on the site);
// each sponsor is one record in Firestore `ads/<id>` (scripts/verse/ads.mjs puts it - no code change for the next sponsor),
// its pictures in the media bucket under ads/<id>/. The coupon code is never in the list: only a citizen (a passport) gets it,
// through op=coupon - everyone else is sent to get a passport (his rule: the verse's perks are for citizens).
//   GET  ?op=list                         -> { ads: [{ id, sponsor, href, wide, card, alt, places, coupon: {title, line, fine, logo} }] }
//   GET  ?op=coupon&id=<id>  (Bearer)     -> { code } | { error: 'sign_in' | 'citizen' | 'gone' }
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = () => admin.firestore();
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
const OWNER = 'shlomi@boostart.io';

// what a visitor may see of a record - everything but the code
function pub(id, a) {
  const c = a.coupon || null;
  return { id, sponsor: a.sponsor || '', href: a.href || '', wide: a.wide || '', card: a.card || a.wide || '', alt: a.alt || '', places: a.places || ['home'],
    order: a.order || 0, coupon: c ? { title: c.title || '', line: c.line || '', fine: c.fine || '', logo: c.logo || '', pic: c.pic || '' } : null };
}

let cache = null, cacheAt = 0;   // one read a minute per instance is plenty - a new sponsor shows within a minute
async function list() {
  if (cache && Date.now() - cacheAt < 60e3) return cache;
  const s = await db().collection('ads').where('live', '==', true).get();
  cache = { ads: s.docs.map((d) => pub(d.id, d.data())).sort((a, b) => a.order - b.order) };
  cacheAt = Date.now();
  return cache;
}

async function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { return null; }
}

async function coupon(req, id) {
  const user = await who(req);
  if (!user) return { error: 'sign_in' };
  const ref = db().collection('ads').doc(String(id || '').slice(0, 60));
  const a = (await ref.get()).data();
  if (!a || !a.live || !a.coupon || !a.coupon.code) return { error: 'gone' };
  const him = user.email === OWNER && user.email_verified;
  const f = him ? null : (await db().collection('fans').doc(user.uid).get()).data() || {};
  if (!him && !(f.citizen && f.citizen.n)) return { error: 'citizen' };
  // how many citizens took the code (for him; one count per account)
  const took = ref.collection('took').doc(user.uid);
  if (!(await took.get()).exists) await db().batch().set(took, { t: FieldValue.serverTimestamp() }).update(ref, { took: FieldValue.increment(1) }).commit();
  return { code: a.coupon.code };
}

exports.verseAds = onRequest({ region: 'europe-west1', cors: CORS, memory: '256MiB', timeoutSeconds: 15, maxInstances: 5, concurrency: 80 }, async (req, res) => {
  try {
    const op = req.query.op || 'list';
    if (op === 'list') { res.set('cache-control', 'public, max-age=60'); res.json(await list()); return; }
    if (op === 'coupon') { res.set('cache-control', 'private, no-store'); res.json(await coupon(req, req.query.id)); return; }
    res.status(400).json({ error: 'op' });
  } catch (e) { console.error('ads', e); res.status(500).json({ error: 'server' }); }
});
