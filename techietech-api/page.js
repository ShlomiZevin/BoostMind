// The Shlomiverse's link previews (his ask, 2026-11-03: "nice social links for WhatsApp, for any character, any page,
// any game"). Hosting sends a page address (/c/hani, /v/<video>, /play/<game>, /s/<series>, /story/<character>) here;
// this answers with the site's own page (public/wiki/index.html, the same file every address shows) with that page's
// title, line and picture in its <head> - what WhatsApp, Facebook and X read. The visitor gets the same site as
// anywhere else. Content comes from the live wiki data (no deploy for a new video / character); the CDN keeps each
// answer a few minutes. If anything fails, the page goes out with the site's default preview - never an error page.
const { onRequest } = require('firebase-functions/v2/https');
// studio-keys (only TELEGRAM_TOKEN / TELEGRAM_CHAT_ID are read: "the greeting was shown" to his Telegram) is read at the moment
// it is needed, its LATEST version - never bound to the function (secrets: [...]). A bound secret pins the version that was live at
// deploy, and the studio replaces studio-keys and destroys the old versions on every key change (zoomcut/render/cloud/keys.mjs):
// 2026-11-19 a new version destroyed the pinned one, versePage couldn't start, and every /v/ /c/ /play/ link was a 500 for ~11 h.
// (the function's service account keeps its secretAccessor role on studio-keys from the old binding)
let SK = null;
async function studioKeys() {
  if (SK && Date.now() - SK.t < 10 * 60e3) return SK.v;
  const tok = await (await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } })).json();
  const r = await fetch('https://secretmanager.googleapis.com/v1/projects/boostmind-b052c/secrets/studio-keys/versions/latest:access', { headers: { authorization: `Bearer ${tok.access_token}` } });
  if (!r.ok) throw new Error('studio-keys ' + r.status);
  const v = JSON.parse(Buffer.from((await r.json()).payload.data, 'base64').toString('utf8'));
  SK = { v, t: Date.now() };
  return v;
}

const SITE = 'https://shlomiverse.com';
const TEMPLATE = `${SITE}/wiki/index.html`;
const DATA = 'https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json';
const MEDIA = 'https://storage.googleapis.com/shlomiverse-media/wiki/';
const NAME = 'שלומיוורס';

const cache = {};
async function cached(key, url, ms, as) {
  const c = cache[key];
  if (c && Date.now() - c.t < ms) return c.v;
  try {
    const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) throw new Error(r.status);
    const v = as === 'json' ? await r.json() : await r.text();
    cache[key] = { v, t: Date.now() };
    return v;
  } catch (e) {
    if (c) return c.v;
    throw e;
  }
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const one = (s, n = 180) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const abs = (u) => (!u ? null : /^https?:/.test(u) ? u : u.startsWith('/') ? SITE + u : MEDIA + u);

// what a page of the verse looks like when shared: { title, desc, img, wide }
function preview(w, kind, id) {
  const C = Object.fromEntries((w.characters || []).map((c) => [c.id, c]));
  if (kind === 'c' && C[id]) {
    const c = C[id];
    return { title: `${c.name} · ${NAME}`, desc: c.tagline || c.role || c.bio, img: abs(c.img) };
  }
  if (kind === 'v') {
    const v = (w.videos || []).find((x) => x.id === id);
    if (v) {
      const who = (v.cast || []).map((x) => C[x]?.name).filter(Boolean).slice(0, 2).join(' · ');
      return { title: `${v.title} · ${NAME}`, desc: v.teaser || v.blurb || who, img: abs(v.poster) };
    }
  }
  if (kind === 'play') {
    const g = (w.games || []).find((x) => x.id === id);
    if (g) return { title: `${g.title} · ${NAME}`, desc: g.tagline, img: abs(g.img), wide: true };
  }
  if (kind === 's') {
    const s = (w.series || []).find((x) => x.id === id);
    if (s) {
      const first = (s.videos || []).map((x) => (w.videos || []).find((v) => v.id === x)).find((v) => v && v.poster);
      return { title: `${s.title} · ${NAME}`, desc: s.blurb, img: abs(first?.poster) };
    }
  }
  if (kind === 'story' && C[id]) return { title: `הסטורי של ${C[id].name} · ${NAME}`, desc: C[id].tagline || C[id].role, img: abs(C[id].img) };
  return null;
}

// /simulation (the simulation test, sim.js): a shared result shows its own picture and name; the test itself its question
async function simPreview(rid) {
  const base = { title: `אתם חיים בסימולציה? · ${NAME}`, desc: 'באיזו סימולציה אתם חיים?', img: null };
  if (!/^[a-z0-9]{10,24}$/.test(String(rid || ''))) return base;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const g = await admin.firestore().collection('sims').doc(rid).get();
    const d = g.exists ? g.data() : null;
    if (!d || !d.shared || !d.result) return base;
    // no score (plan cz-sim-r4: the department instead)
    return { title: `${d.result.dept ? d.result.dept + ' · ' : ''}${d.result.name} · ${NAME}`, desc: `${d.result.share} ${d.result.ask}`, img: d.img || null };
  } catch (e) { return base; }
}

function inject(html, p, url) {
  const set = (re, tag) => (re.test(html) ? (html = html.replace(re, tag)) : (html = html.replace('</head>', tag + '\n</head>')));
  const title = esc(one(p.title, 90)), desc = esc(one(p.desc));
  set(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}">`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}">`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${desc}">`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}">`);
  if (p.img) {
    set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(p.img)}">`);
    // the default 1200x630 size belongs to the site's own picture; a portrait / poster has its own
    html = html.replace(/<meta property="og:image:(width|height)"[^>]*>\n?/g, '');
    set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(p.img)}">`);
  }
  set(/<meta name="twitter:card"[^>]*>/, '<meta name="twitter:card" content="summary_large_image">');
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}">`);
  return html;
}

// ---- a personal greeting (his ask, 2026-11-19, plan greeting-send): /greeting/<id> = its own page, open only to whoever has the
// link. The video and its poster live in the PRIVATE bucket (shlomiverse-private/greetings/<id>/ - the media bucket can be listed by
// anyone) and are streamed from here, with Range for phones; the record is Firestore greetings/<id> (scripts/greetings/greet.cjs).
// A greeting is not a video of the resident's life: not in wiki.json, not in the brain, not in the chat.
const GREET_BUCKET = 'shlomiverse-private';
const greetId = (s) => /^[A-Za-z0-9]{10,32}$/.test(String(s || ''));
async function greetingRec(id) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp();
  const d = await admin.firestore().collection('greetings').doc(id).get();
  return d.exists && !d.data().off ? d.data() : null;
}
async function greetingFile(req, res, id, name) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp();
  const f = admin.storage().bucket(GREET_BUCKET).file(`greetings/${id}/${name}`);
  if (name.endsWith('.mp4')) {
    // the video goes straight from the private bucket by a short-lived signed link: a function's response is capped at 32 MB,
    // so streaming it through here broke every greeting over 32 MB (greet-lior, 47 MB, 2026-11-19). Storage serves any size + Range.
    const [url] = await f.getSignedUrl({ action: 'read', expires: Date.now() + 12 * 3600e3, responseType: 'video/mp4',
      ...(req.query.dl ? { responseDisposition: 'attachment; filename="greeting.mp4"' } : {}) });   // signBlob: the functions' account holds Token Creator on itself
    res.set('Cache-Control', 'private, max-age=600');
    return res.redirect(302, url);
  }
  const [meta] = await f.getMetadata();
  const size = +meta.size, type = name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
  res.set('Content-Type', type); res.set('Accept-Ranges', 'bytes'); res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  if (req.query.dl) res.set('Content-Disposition', `attachment; filename="greeting.mp4"`);
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') || '');
  let start = 0, end = size - 1;
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = +m[1]; end = m[2] ? Math.min(+m[2], size - 1) : size - 1; } else { start = Math.max(0, size - +m[2]); }
    if (start > end || start >= size) { res.status(416).set('Content-Range', `bytes */${size}`).end(); return; }
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
  } else res.status(200);
  res.set('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') { res.end(); return; }
  f.createReadStream({ start, end }).on('error', (e) => { console.error('greeting stream', id, e.message); res.end(); }).pipe(res);
}
// "the greeting was shown" (his ask, 2026-11-19): we can't post a greeting to our story before the person it's for has seen it, so
// the requester presses "הברכה נמסרה" on the page -> greetings/<id> shownAt (once) + a Telegram to him with the page link
async function greetingShown(req, res, id) {
  if (req.method !== 'POST') return res.status(405).send('');
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp();
  const ref = admin.firestore().collection('greetings').doc(id);
  const first = await admin.firestore().runTransaction(async (t) => {
    const d = await t.get(ref);
    if (!d.exists || d.data().off) return null;
    if (d.data().shownAt) return false;
    t.update(ref, { shownAt: admin.firestore.FieldValue.serverTimestamp() });
    return d.data();
  });
  if (first === null) return res.status(404).json({ error: 'no' });
  if (first && !first.test) {   // a test greeting (greet.cjs add --test) never messages him
    try {
      const k = await studioKeys();
      const text = `הברכה ל${first.forWho} (מ${first.charName}) נמסרה - אפשר להעלות אותה לסטורי עכשיו.
${SITE}/greeting/${id}`;
      if (k.TELEGRAM_TOKEN && k.TELEGRAM_CHAT_ID) await fetch(`https://api.telegram.org/bot${k.TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: k.TELEGRAM_CHAT_ID, text }) });
    } catch (e) { console.error('greeting shown telegram', id, e.message); }
  }
  res.set('Cache-Control', 'no-store');
  return res.json({ ok: true });
}
const FN = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePage';   // the video straight from here (Range works without the CDN in between)
// the sender's own words on the card (his ask 2026-11-19): POST {msg, name} -> the words drawn on the base card (greetcard.js) ->
// greetings/<id>/c/<hash>.jpg + Firestore greetings/<id>/cards/<hash>; the answer is a link of their own (/greeting/<id>?c=<hash>)
// whose WhatsApp preview is that card. Text only (no uploads), 40 + 18 characters, at most 60 different cards per greeting.
async function greetingCard(req, res, id) {
  if (req.method !== 'POST') return res.status(405).send('');
  const { drawCard, clean, MAX_MSG, MAX_NAME } = require('./greetcard');
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const msg = clean(b.msg, MAX_MSG), name = clean(b.name, MAX_NAME);
  if (!msg) return res.status(400).json({ error: 'empty' });
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp();
  const ref = admin.firestore().collection('greetings').doc(id), g = (await ref.get()).data();
  if (!g || g.off || !g.ogBase) return res.status(404).json({ error: 'no' });
  const c = require('crypto').createHash('sha1').update(`${id}|${msg}|${name}`).digest('hex').slice(0, 12);
  const card = ref.collection('cards').doc(c), bucket = admin.storage().bucket(GREET_BUCKET);
  if (!(await card.get()).exists) {
    if ((g.cards || 0) >= 60) return res.status(429).json({ error: 'many' });
    const [base] = await bucket.file(`greetings/${id}/og-base.jpg`).download();
    await bucket.file(`greetings/${id}/c/${c}.jpg`).save(await drawCard(base, msg, name), { contentType: 'image/jpeg' });
    await card.set({ msg, name, t: admin.firestore.FieldValue.serverTimestamp() });
    await ref.update({ cards: admin.firestore.FieldValue.increment(1) });
  }
  res.set('Cache-Control', 'no-store');
  return res.json({ ok: true, c, url: `${SITE}/greeting/${id}?c=${c}` });
}

async function greetingPage(req, res, id) {
  const g = greetId(id) ? await greetingRec(id).catch(() => null) : null;
  let html = await cached('g', `${SITE}/greeting/page.html`, 60e3, 'text');
  const url = `${SITE}/greeting/${id}`;
  // a link of their own (?c=<hash>): that card is the preview, and the page shows their words
  let card = null;
  if (g && /^[a-f0-9]{12}$/.test(String(req.query.c || ''))) { try { const d = await require('firebase-admin').firestore().collection('greetings').doc(id).collection('cards').doc(req.query.c).get(); if (d.exists) card = { c: req.query.c, msg: d.data().msg, name: d.data().name || '' }; } catch (e) {} }
  if (g) {
    const v = g.ogV ? `?v=${g.ogV}` : '';   // the card's version: a redrawn card is a new address, so the CDN / WhatsApp never show the old one
    const img = card ? `${SITE}/greeting/${id}/c/${card.c}.jpg${v}` : `${SITE}/greeting/${id}/${g.og ? 'og.jpg' + v : 'poster.jpg'}`;   // og.jpg = its own preview card (scripts/greetings/og.cjs)
    html = inject(html, { title: `ברכה ל${g.forWho} · ${NAME}`, desc: card ? `״${card.msg}״${card.name ? ' — ' + card.name : ''}` : `מאת ${g.charName}${g.event ? ' · ' + g.event : ''}`, img }, card ? `${url}?c=${card.c}` : url);
    if (g.og || card) html = html.replace('</head>', '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n</head>');
    const data = { id, forWho: g.forWho, event: g.event || '', char: g.char, charName: g.charName, charImg: g.charImg || '', world: g.world || '', techy: !!g.techy, card, og: g.og ? `${SITE}/greeting/${id}/og.jpg${g.ogV ? '?v=' + g.ogV : ''}` : null, base: g.ogBase ? `${SITE}/greeting/${id}/og-base.jpg${g.ogV ? '?v=' + g.ogV : ''}` : null, shown: !!g.shownAt, shownAt: g.shownAt?.toDate ? g.shownAt.toDate().toISOString() : null,
      video: `${FN}/greeting/${id}/video.mp4`, poster: `${SITE}/greeting/${id}/poster.jpg`, download: `${FN}/greeting/${id}/video.mp4?dl=1`, url };
    html = html.replace('<script id="g-data" type="application/json">null</script>', `<script id="g-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
    html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex">');
  }
  res.set('Cache-Control', 'public, max-age=0, s-maxage=15');   // "הברכה נמסרה" shows to everyone within seconds
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(g ? 200 : 404).send(html);
}

exports.versePage = onRequest({ region: 'europe-west1', timeoutSeconds: 300, concurrency: 80, maxInstances: 5, memory: '512MiB' }, async (req, res) => {
  const [, kind = '', raw = '', file = ''] = req.path.split('/');
  const id = decodeURIComponent(raw);
  if (kind === 'greeting') {   // timeoutSeconds 300: a video streams to a slow phone
    try {
      if (file === 'shown') { if (!greetId(id)) return res.status(404).send(''); return await greetingShown(req, res, id); }
      if (file === 'card') { if (!greetId(id)) return res.status(404).send(''); return await greetingCard(req, res, id); }
      if (file === 'c') { const h = String(req.path.split('/')[4] || ''); if (!greetId(id) || !/^[a-f0-9]{12}\.jpg$/.test(h) || !(await greetingRec(id))) return res.status(404).send(''); return await greetingFile(req, res, id, 'c/' + h); }
      if (file === 'video.mp4' || file === 'poster.jpg' || file === 'og.jpg' || file === 'og-base.jpg') { if (!greetId(id) || !(await greetingRec(id))) return res.status(404).send(''); return await greetingFile(req, res, id, file); }
      return await greetingPage(req, res, id);
    } catch (e) { console.error('versePage greeting', req.path, e.message); if (!res.headersSent) res.status(500).send(''); return; }
  }
  let html;
  try { html = await cached('t', TEMPLATE, 60e3, 'text'); } catch (e) { res.redirect(302, `/wiki/#${req.path}`); return; }
  try {
    const w = await cached('w', DATA, 120e3, 'json');
    const p = kind === 'simulation' ? await simPreview(req.query.r) : preview(w, kind, id);
    if (p) html = inject(html, p, SITE + req.path + (kind === 'simulation' && req.query.r ? `?r=${encodeURIComponent(req.query.r)}` : ''));
  } catch (e) { console.error('versePage', req.path, e.message); }
  res.set('Cache-Control', 'public, max-age=120, s-maxage=600');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});
