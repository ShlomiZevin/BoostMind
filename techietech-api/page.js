// The Shlomiverse's link previews (his ask, 2026-11-03: "nice social links for WhatsApp, for any character, any page,
// any game"). Hosting sends a page address (/c/hani, /v/<video>, /play/<game>, /s/<series>, /story/<character>) here;
// this answers with the site's own page (public/wiki/index.html, the same file every address shows) with that page's
// title, line and picture in its <head> - what WhatsApp, Facebook and X read. The visitor gets the same site as
// anywhere else. Content comes from the live wiki data (no deploy for a new video / character); the CDN keeps each
// answer a few minutes. If anything fails, the page goes out with the site's default preview - never an error page.
const { onRequest } = require('firebase-functions/v2/https');

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
    return { title: `${d.result.score} · ${d.result.name} · ${NAME}`, desc: `${d.result.share} ${d.result.ask}`, img: d.img || null };
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

exports.versePage = onRequest({ region: 'europe-west1', memory: '256MiB', timeoutSeconds: 15, concurrency: 80, maxInstances: 5 }, async (req, res) => {
  const [, kind = '', raw = ''] = req.path.split('/');
  const id = decodeURIComponent(raw);
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
