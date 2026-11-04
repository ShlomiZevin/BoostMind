// The Shlomiverse's mail engine (his rules, 2026-11-04):
//   - marketing mail only when something HAPPENED (a new story, video or game), never "just because";
//   - never more than ONE mail a day to anyone - things that happen on the same day go out together, in one mail;
//   - every account gets the welcome first; whoever stops it never gets the next one;
//   - everyone chooses what to hear about (stories / videos / games) or stops everything, from a link in every mail;
//   - a form sent on a character's site gets an automatic reply FROM that character (Osnat for a Techy-Tech CV...);
//   - everything sent is logged (mailLog) for /backstage/.
// The switch is verseMeta/mail: { on: false, only: ['<email>'] } - off, marketing goes only to the addresses in `only`
// (a missing doc = off, Shlomi only). Replies to forms always go out (the person just asked for something).
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const mail = require('./mail');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const LOCAL = !!process.env.FUNCTIONS_EMULATOR;
const REGION = 'europe-west1';
const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const VAPID_PRIVATE = defineSecret('VERSE_VAPID_PRIVATE');   // only as the key that signs the choices links
const SECRETS = LOCAL ? [] : [GMAIL_USER, GMAIL_APP_PASSWORD, VAPID_PRIVATE];
const OWNER = 'shlomi@boostart.io';
const PREFS_URL = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseMail';
const WIKI_DATA = 'https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json';
const SITE = 'https://shlomiverse.com';
const MEDIA = 'https://storage.googleapis.com/shlomiverse-media/wiki';

const DAY_GAP = 20 * 3600e3;      // and never twice on the same Israeli date
const MAX_AGE = 7 * 864e5;        // news older than a week is not news
const PER_RUN = 60;               // a run never sends more than this (Gmail's daily limit is ~500)
const TOPICS = [['story', 'סטוריז חדשים של הדמויות'], ['video', 'סרטונים חדשים'], ['game', 'משחקים חדשים']];

const signKey = () => 'mail|' + (LOCAL ? process.env.VERSE_VAPID_PRIVATE || 'local' : VAPID_PRIVATE.value());
const prefsLink = (uid) => mail.unsubUrl(PREFS_URL, uid, signKey());
const okToken = (uid, t) => { const a = Buffer.from(mail.unsubToken(uid, signKey())), b = Buffer.from(String(t || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const ms = (t) => (t?.toMillis ? t.toMillis() : t instanceof Date ? +t : typeof t === 'number' ? t : t ? Date.parse(t) : 0);
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// ---------- time: Israel, no mail on Shabbat, only in decent hours ----------
function il(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, wd: p.weekday };
}
function sendingHours(t) {
  const x = il(t);
  if (x.wd === 'Fri' && x.hour >= 14) return false;   // Shabbat comes in
  if (x.wd === 'Sat' && x.hour < 20) return false;    // until it goes out
  return x.hour >= 10 && x.hour < 21;
}
const heDate = (t) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' }).format(new Date(t));

// ---------- sending + the log ----------
let transport;
const gmail = () => (transport ||= nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } }));
// one mail out, and its line in mailLog (the backstage's "what we sent"), the HTML kept so it can be opened there
async function deliver({ to, uid = null, kind, m, fromName = 'השלומיוורס', replyTo = OWNER, meta = {} }) {   // answers to any mail reach Shlomi
  const log = { to, uid, kind, subject: m.subject, fromName, meta, t: FieldValue.serverTimestamp(), ok: false };
  try {
    if (LOCAL) console.log('[local] mail not sent:', kind, to, m.subject);
    else await gmail().sendMail({ from: `${fromName} <${GMAIL_USER.value()}>`, to, subject: m.subject, html: m.html, text: m.text, headers: m.headers, ...(replyTo ? { replyTo } : {}) });
    log.ok = true;
  } catch (e) { log.error = String(e.message).slice(0, 300); console.error('mail failed', kind, to, e.message); }
  await db.collection('mailLog').add({ ...log, html: m.html.length < 300000 ? m.html : null }).catch((e) => console.error('mail log failed', e.message));
  return log.ok;
}

// ---------- what the verse knows: characters, videos, games (the wiki's data) ----------
let wikiCache;
async function wiki() {
  if (wikiCache && Date.now() - wikiCache.t < 300e3) return wikiCache.w;
  const w = LOCAL ? JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../public/wiki/data/wiki.json'), 'utf8'))
    : await (await fetch(WIKI_DATA, { cache: 'no-store' })).json();
  wikiCache = { t: Date.now(), w };
  return w;
}
const absMedia = (u) => (!u ? null : /^https?:/.test(u) ? u : `${MEDIA}/${u.replace(/^\/?(wiki\/)?/, '')}`);
const charOf = (w, id) => (w.characters || []).find((c) => c.id === id) || { id, name: id };
const faceOf = (w, id) => absMedia(charOf(w, id).img) || `${MEDIA}/img/c/${id}.jpg`;
const who = (w, id) => ({ name: charOf(w, id).name, img: faceOf(w, id), href: `/c/${id}` });

// ---------- events: what happened, written down once ----------
// stories that really went out (not tests: those never notify and are hidden), videos the verse announced, games
// that appeared in the wiki. The first run only writes down what already exists - launch day mails nothing old.
async function sweepEvents(now = Date.now()) {
  const metaRef = db.collection('verseMeta').doc('mailEvents');
  const meta = (await metaRef.get()).data();
  const w = await wiki();
  const games = (w.games || []).map((g) => g.id);
  if (!meta) { await metaRef.set({ since: Timestamp.fromMillis(now), games }); return { baseline: true }; }
  const since = meta.since;
  const add = async (id, ev) => { try { await db.collection('mailEvents').doc(id).create({ ...ev, seen: FieldValue.serverTimestamp() }); return 1; } catch { return 0; } };
  let n = 0;
  // a story waits 10 minutes, so a story removed right after posting never mails
  const stories = await db.collection('stories').where('t', '>', since).get();
  for (const d of stories.docs) {
    const x = d.data();
    if (x.hidden || x.reach == null || now - ms(x.t) < 600e3) continue;
    n += await add('story_' + d.id, { kind: 'story', ref: d.id, char: x.char, everyone: !!x.everyone, t: x.t });
  }
  const ann = await db.collection('announced').where('t', '>', since).get();
  for (const d of ann.docs) if (!d.data().baseline) n += await add('video_' + d.id, { kind: 'video', ref: d.id, t: d.data().t });
  const fresh = games.filter((g) => !(meta.games || []).includes(g));
  for (const g of fresh) n += await add('game_' + g, { kind: 'game', ref: g, t: Timestamp.fromMillis(now) });
  if (fresh.length) await metaRef.update({ games: FieldValue.arrayUnion(...fresh) });
  return { added: n };
}

// ---------- who gets what (pure: the tests run it without Firestore) ----------
// users: [{ uid, email, name }], state: { uid: mailUsers doc }, follows: { uid: [char] }, events: [{ id, kind, char, everyone, t }]
function plan({ users, state, follows, events, now, cfg }) {
  const today = il(now).day;
  const out = [];
  for (const u of users) {
    if (!u.email) continue;
    if (!cfg.on && !(cfg.only || [OWNER]).includes(u.email.toLowerCase())) continue;
    const s = state[u.uid] || {};
    if (s.off) continue;
    const last = ms(s.last);
    if (last && (now - last < DAY_GAP || il(last).day === today)) continue;   // one a day, at most
    if (!s.welcomed) { out.push({ ...u, kind: 'welcome', events: [] }); continue; }
    const from = Math.max(ms(s.cursor) || ms(s.welcomed), now - MAX_AGE);
    const p = s.prefs || {};
    const mine = events.filter((e) => ms(e.t) > from && p[e.kind] !== false
      && (e.kind !== 'story' || e.everyone || (follows[u.uid] || []).includes(e.char)));
    if (mine.length) out.push({ ...u, kind: mine.length === 1 ? mine[0].kind : 'digest', events: mine });
  }
  return out;
}

// ---------- the mail for one person ----------
async function storyData(id) { const d = await db.collection('stories').doc(id).get(); return d.exists && !d.data().hidden ? d.data() : null; }
async function mailFor(p, w, now) {
  const evs = [];
  for (const e of p.events) {
    if (e.kind === 'story') { const s = await storyData(e.ref); if (s) evs.push({ ...e, s }); }
    else if (e.kind === 'video') { const v = (w.videos || []).find((x) => x.id === e.ref); if (v) evs.push({ ...e, v }); }
    else if (e.kind === 'game') { const g = (w.games || []).find((x) => x.id === e.ref); if (g) evs.push({ ...e, g }); }
  }
  const games = evs.filter((e) => e.g), videos = evs.filter((e) => e.v), stories = evs.filter((e) => e.s);
  const gameCard = (g) => ({ tag: 'משחק חדש', title: g.title, text: g.tagline, img: absMedia(g.img), href: new URL(g.url).pathname });
  const videoCard = (v) => ({ tag: 'סרטון', title: v.title, img: absMedia(v.poster), href: `/v/${v.id}` });
  const latestGames = (except) => (w.games || []).filter((g) => g.id !== except).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 2).map(gameCard);
  const latestVideos = (except) => (w.videos || []).filter((v) => v.id !== except && v.date && !v.archive).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(videoCard);
  if (p.kind === 'welcome') return { kind: 'welcome', d: { subject: 'ברוכים הבאים לשלומיוורס 🪐', preheader: 'כל הדמויות. כל הסרטונים. ואפשר לדבר עם כולן.',
    name: first(p.name), hero: `${SITE}/verse/og.jpg`, cast: ['hani', 'tzvika', 'rosenblum', 'ayelet', 'yaniv'].map((id) => who(w, id)) } };
  if (!evs.length) return null;
  if (evs.length === 1 && games.length) {
    const g = games[0].g;
    return { kind: 'game', d: { subject: `משחק חדש: ${g.title}`, preheader: g.tagline, title: g.title, url: new URL(g.url).pathname, hero: absMedia(g.img),
      tagline: g.tagline, cast: (g.chars || []).slice(0, 5).map((id) => who(w, id)), more: latestGames(g.id) } };
  }
  if (evs.length === 1 && videos.length) {
    const v = videos[0].v;
    return { kind: 'video', d: { subject: `סרטון חדש: ${v.title}`, preheader: v.teaser || '', title: v.title, href: `/v/${v.id}`, poster: absMedia(v.poster),
      teaser: v.teaser || '', more: latestVideos(v.id) } };
  }
  if (evs.length === 1 && stories.length) {
    const s = stories[0].s, c = charOf(w, s.char);
    const name = s.char === 'verse' ? 'השלומיוורס' : c.name;
    return { kind: 'story', d: { subject: `סטורי חדש מ${name}`, preheader: String(s.text || '').slice(0, 90), name, face: faceOf(w, s.char),
      img: s.media?.kind === 'image' ? s.media.url : faceOf(w, s.char), text: s.text || '', href: `/story/${s.char}`, page: `/c/${s.char}`,
      link: s.link?.url && s.link.url.startsWith('/') ? s.link.url : null, cta: s.link?.label || 'לצפות בסטורי' } };
  }
  // several things happened: one mail with all of them, the biggest first
  const lead = games[0] ? { ...gameCard(games[0].g), cta: 'לשחק עכשיו' } : videos[0] ? { ...videoCard(videos[0].v), text: videos[0].v.teaser, cta: 'לצפות עכשיו' }
    : { title: 'סטורי חדש', text: stories[0].s.text, img: stories[0].s.media?.kind === 'image' ? stories[0].s.media.url : null, href: `/story/${stories[0].s.char}`, cta: 'לצפות בסטורי' };
  const restGames = games.slice(games[0] ? 1 : 0).map((e) => gameCard(e.g));
  const restVideos = videos.slice(!games[0] && videos[0] ? 1 : 0).map((e) => videoCard(e.v));
  const chars = [...new Set(stories.map((e) => e.s.char))];
  const bits = [games.length && `${games.length === 1 ? 'משחק חדש' : games.length + ' משחקים חדשים'}`, videos.length && `${videos.length === 1 ? 'סרטון חדש' : videos.length + ' סרטונים חדשים'}`,
    stories.length && `${stories.length === 1 ? 'סטורי חדש' : stories.length + ' סטוריז חדשים'}`].filter(Boolean);
  return { kind: 'digest', d: { subject: `מה חדש בשלומיוורס: ${bits.join(', ')}`, preheader: lead.title, week: `השלומיוורס · ${heDate(now)}`, title: 'מה חדש ביקום',
    intro: `מאז המייל הקודם: ${bits.join(', ')}.`, lead, games: restGames, videos: restVideos,
    faces: chars.map((id) => ({ ...who(w, id), href: `/story/${id}` })), facesTitle: 'העלו סטורי' } };
}

// one run: write down what happened, then mail whoever is due (at most PER_RUN). dry = only say who would get what.
async function run({ now = Date.now(), dry = false, force = false } = {}) {
  if (!force && !sendingHours(now)) return { skipped: 'hours' };
  const swept = await sweepEvents(now);
  const cfg = (await db.collection('verseMeta').doc('mail').get()).data() || { on: false, only: [OWNER] };
  const users = [];
  let next;
  do { const r = await admin.auth().listUsers(1000, next); users.push(...r.users.filter((u) => u.email && !u.disabled).map((u) => ({ uid: u.uid, email: u.email, name: u.displayName || '' }))); next = r.pageToken; } while (next);
  const [st, fans, evs] = await Promise.all([db.collection('mailUsers').get(), db.collection('fans').select('follows').get(),
    db.collection('mailEvents').where('t', '>', Timestamp.fromMillis(now - MAX_AGE)).get()]);
  const state = Object.fromEntries(st.docs.map((d) => [d.id, d.data()]));
  const follows = Object.fromEntries(fans.docs.map((d) => [d.id, d.data().follows || []]));
  const events = evs.docs.map((d) => ({ id: d.id, ...d.data() }));
  const due = plan({ users, state, follows, events, now, cfg });
  if (dry) return { swept, cfg, due: due.map((p) => ({ email: p.email, kind: p.kind, events: p.events.map((e) => e.id) })) };
  const w = await wiki();
  let sent = 0;
  for (const p of due.slice(0, PER_RUN)) {
    const x = await mailFor(p, w, now);
    const ref = db.collection('mailUsers').doc(p.uid);
    const cursor = Timestamp.fromMillis(Math.max(now, ...p.events.map((e) => ms(e.t))));
    if (!x) { await ref.set({ email: p.email, cursor }, { merge: true }); continue; }
    const m = mail.render(x.kind, x.d, { unsub: prefsLink(p.uid), unsubPost: prefsLink(p.uid) + '&one=1' });
    const ok = await deliver({ to: p.email, uid: p.uid, kind: x.kind, m, meta: { events: p.events.map((e) => e.id) } });
    if (!ok) continue;
    sent++;
    await ref.set({ email: p.email, last: Timestamp.fromMillis(now), cursor, ...(x.kind === 'welcome' ? { welcomed: Timestamp.fromMillis(now) } : {}), sent: FieldValue.increment(1) }, { merge: true });
  }
  const out = { swept, due: due.length, sent };
  if (sent || due.length) console.log('mail run', JSON.stringify(out));
  return out;
}
exports.verseMailer = onSchedule({ schedule: 'every 30 minutes', timeZone: 'Asia/Jerusalem', region: REGION, secrets: SECRETS, timeoutSeconds: 300, memory: '512MiB' },
  async () => { await run(); });

// ---------- replies from the characters, for every form on their sites ----------
let repliesCache;
const replies = () => (repliesCache ||= require('./replies.json'));
const fill = (s, v) => String(s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] || '').replace(/,\s*(?=[.!?:]|$)/g, '').replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
// key: a site (techietech, ayelet, ...) or verse-<kind>. who: { email, name, uid, choice, when }
function replyMail(key, who, w) {
  const r = replies()[key];
  if (!r) return null;
  const v = { first: first(who.name), choice: who.choice || '', when: who.when || '', order: who.order || '' };
  const face = r.char && r.char !== 'verse' ? faceOf(w, r.char) : `${SITE}/verse/logo-512.png`;
  const d = { subject: fill(r.subject, v), preheader: fill(r.preheader, v), chip: fill(r.chip, v), title: fill(r.title, v), paras: (r.paras || []).map((x) => fill(x, v)),
    sign: r.sign, signRole: r.signRole, face, site: r.site, cta: r.cta?.label ? { label: r.cta.label, href: r.cta.href } : null };
  return { r, d };
}
async function reply(key, who) {
  try {
    if (!who?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who.email)) return false;
    const x = replyMail(key, who, await wiki());
    if (!x) return false;
    const m = mail.render('reply', x.d, { unsub: who.uid ? prefsLink(who.uid) : undefined });
    const ok = await deliver({ to: who.email, uid: who.uid || null, kind: 'reply', m, fromName: x.r.fromName, replyTo: OWNER, meta: { site: key } });
    // a reply counts as the day's mail: no marketing mail on top of it the same day
    if (ok && who.uid) await db.collection('mailUsers').doc(who.uid).set({ email: who.email, last: FieldValue.serverTimestamp() }, { merge: true });
    return ok;
  } catch (e) { console.error('reply failed', key, e.message); return false; }
}

// Yotamverse's orders are written straight to Firestore by its page - the reply follows the new order
exports.verseOrderReply = onDocumentCreated({ document: 'gp-orders/{id}', region: 'europe-west1', secrets: SECRETS, memory: '256MiB', timeoutSeconds: 60 }, async (event) => {
  const o = event.data?.data() || {};
  const email = o.email || o.customerEmail || o.contact?.email;
  await reply('yotamverse', { email, name: o.name || '', uid: o.uid || null, order: o.orderNum ? String(o.orderNum) : '',
    choice: (o.items || []).map((i) => i.name).filter(Boolean).slice(0, 4).join(', ') });
});

// ---------- the choices page (the link in every mail) ----------
const page = (title, inner) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;800&display=swap" rel="stylesheet"><style>
body{margin:0;background:#0b0b0f;color:#f4f4f6;font-family:Heebo,Arial,sans-serif;display:flex;justify-content:center;padding:28px 16px}
.c{max-width:460px;width:100%;background:#15151b;border:1px solid #2a2a33;border-radius:28px;padding:28px 24px;text-align:center}
img{width:110px}h1{font-size:26px;margin:14px 0 6px}p{color:#b9b9c4;line-height:1.6;margin:0 0 18px}
label{display:flex;align-items:center;gap:12px;background:#1d1d25;border-radius:16px;padding:16px;margin:0 0 10px;text-align:start;font-size:17px;cursor:pointer}
input[type=checkbox]{width:24px;height:24px;accent-color:#ff6a1f}button{width:100%;border:0;border-radius:999px;padding:16px;font:800 18px Heebo,Arial;cursor:pointer;margin-top:8px}
.go{background:#ff6a1f;color:#fff}.off{background:transparent;color:#b9b9c4;text-decoration:underline;font-weight:600;font-size:15px}a{color:#ff8a3d}</style></head>
<body><div class="c"><a href="${SITE}"><img src="${SITE}/verse/logo-512.png" alt="השלומיוורס"></a>${inner}</div></body></html>`;
exports.verseMail = onRequest({ region: REGION, secrets: SECRETS, maxInstances: 2, memory: '256MiB', timeoutSeconds: 30 }, async (req, res) => {
  const uid = String(req.query.u || req.body?.u || ''), t = String(req.query.t || req.body?.t || '');
  if (!uid || !okToken(uid, t)) return res.status(400).send(page('קישור לא תקין', '<h1>הקישור לא תקין</h1><p>נסו את הקישור מהמייל האחרון.</p>'));
  const ref = db.collection('mailUsers').doc(uid);
  // the mail app's own "unsubscribe" button (List-Unsubscribe-Post): one click, everything off
  if (req.method === 'POST' && (req.query.one || String(req.body?.['List-Unsubscribe'] || '') === 'One-Click')) {
    await ref.set({ off: true, offAt: FieldValue.serverTimestamp() }, { merge: true });
    return res.send('ok');
  }
  if (req.method === 'POST') {
    const b = req.body || {};
    const off = b.all === 'off';
    const prefs = Object.fromEntries(TOPICS.map(([k]) => [k, !off && b[k] === 'on']));
    await ref.set({ prefs, off: off || !Object.values(prefs).some(Boolean), changed: FieldValue.serverTimestamp() }, { merge: true });
    const done = off || !Object.values(prefs).some(Boolean);
    return res.send(page('נשמר', `<h1>${done ? 'לא נשלח יותר מיילים' : 'נשמר!'}</h1><p>${done ? 'הפסקנו לשלוח לך מיילים. אפשר לחזור לכאן מתי שרוצים ולבחור מחדש.'
      : 'נשלח רק על מה שבחרת – ולא יותר ממייל אחד ביום.'}</p><p><a href="${PREFS_URL}?u=${encodeURIComponent(uid)}&t=${encodeURIComponent(t)}">חזרה לבחירה</a> · <a href="${SITE}">לשלומיוורס</a></p>`));
  }
  const s = (await ref.get()).data() || {};
  const p = s.prefs || {};
  const box = ([k, l]) => `<label><input type="checkbox" name="${k}" ${!s.off && p[k] !== false ? 'checked' : ''}> ${l}</label>`;
  res.send(page('על מה לשלוח לך מיילים', `<h1>על מה לשלוח לך מיילים?</h1><p>אנחנו שולחים רק כשקורה משהו חדש, ולא יותר ממייל אחד ביום.</p>
<form method="post"><input type="hidden" name="u" value="${uid.replace(/"/g, '')}"><input type="hidden" name="t" value="${t.replace(/"/g, '')}">
${TOPICS.map(box).join('')}<button class="go" type="submit">לשמור</button><button class="off" type="submit" name="all" value="off">להפסיק את כל המיילים</button></form>`));
});

// ---------- for /backstage/ (through verseOwner, with his key) ----------
// every kind of mail we send, rendered with real data, so he sees them all in one place
async function samples() {
  const w = await wiki();
  const now = Date.now();
  const games = (w.games || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const videos = (w.videos || []).filter((v) => v.date && !v.archive).sort((a, b) => b.date.localeCompare(a.date));
  const st = await db.collection('stories').orderBy('t', 'desc').limit(30).get();
  const stories = st.docs.filter((d) => !d.data().hidden && d.data().everyone).slice(0, 3);
  const P = { uid: 'sample', email: OWNER, name: 'שלומי' };
  const ev = (kind, ref, extra = {}) => ({ id: `${kind}_${ref}`, kind, ref, t: now, ...extra });
  const out = [];
  const add = async (label, p) => { const x = await mailFor(p, w, now); if (x) out.push({ key: label, label, kind: x.kind, ...mail.render(x.kind, x.d) }); };
  await add('ברוכים הבאים', { ...P, kind: 'welcome', events: [] });
  if (games[0]) await add('משחק חדש', { ...P, kind: 'game', events: [ev('game', games[0].id)] });
  if (videos[0]) await add('סרטון חדש', { ...P, kind: 'video', events: [ev('video', videos[0].id)] });
  if (stories[0]) await add('סטורי חדש', { ...P, kind: 'story', events: [ev('story', stories[0].id)] });
  await add('כמה דברים באותו יום', { ...P, kind: 'digest', events: [games[0] && ev('game', games[0].id), games[1] && ev('game', games[1].id), ...videos.slice(0, 3).map((v) => ev('video', v.id)),
    ...stories.map((d) => ev('story', d.id))].filter(Boolean) });
  for (const key of Object.keys(replies())) {
    const x = replyMail(key, { name: 'ישראל ישראלי', choice: '', when: '' }, w);
    if (x) out.push({ key: 'reply:' + key, label: `תשובה: ${x.r.site || key} (${x.r.fromName})`, kind: 'reply', from: x.r.fromName, ...mail.render('reply', x.d) });
  }
  return out;
}
async function owner(op, b = {}) {
  if (op === 'mailLog') {
    const q = await db.collection('mailLog').orderBy('t', 'desc').limit(Math.min(+b.limit || 200, 500)).get();
    return { log: q.docs.map((d) => { const x = d.data(); return { id: d.id, to: x.to, kind: x.kind, subject: x.subject, fromName: x.fromName, ok: x.ok, error: x.error || null, meta: x.meta || {}, t: ms(x.t) }; }) };
  }
  if (op === 'mailView') { const d = await db.collection('mailLog').doc(String(b.id)).get(); return { html: d.data()?.html || '' }; }
  if (op === 'mailSamples') return { samples: (await samples()).map((s) => ({ key: s.key, label: s.label, kind: s.kind, from: s.from || 'השלומיוורס', subject: s.subject, html: s.html })) };
  if (op === 'mailState') {
    const [cfg, users, events, offs] = await Promise.all([db.collection('verseMeta').doc('mail').get(), db.collection('mailUsers').count().get(),
      db.collection('mailEvents').orderBy('t', 'desc').limit(50).get(), db.collection('mailUsers').where('off', '==', true).count().get()]);
    return { cfg: cfg.data() || { on: false, only: [OWNER] }, users: users.data().count, off: offs.data().count, events: events.docs.map((d) => ({ id: d.id, ...d.data(), t: ms(d.data().t), seen: undefined })),
      plan: await run({ dry: true, force: true }) };
  }
  if (op === 'mailConfig') {
    const cfg = { on: !!b.on, only: (Array.isArray(b.only) ? b.only : [OWNER]).map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 50) };
    await db.collection('verseMeta').doc('mail').set({ ...cfg, changed: FieldValue.serverTimestamp() });
    return { cfg };
  }
  if (op === 'mailRunNow') return run({ force: !!b.force });
  if (op === 'mailTest') {
    // every sample to one address (his own), straight away - nothing counted, nothing marked
    const to = String(b.to || OWNER);
    let n = 0;
    for (const s of await samples()) if (!b.key || b.key === s.key) n += (await deliver({ to, kind: 'test:' + s.kind, m: s, fromName: s.from || 'השלומיוורס', meta: { sample: s.key } })) ? 1 : 0;
    return { sent: n, to };
  }
  return null;
}

module.exports = { ...exports, reply, replyMail, owner, plan, il, sendingHours, MAIL_SECRETS: SECRETS };
