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
const PER_RUN = 120;              // a run never sends more than this (Gmail's daily limit is ~500)
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


// ---------- bounces (2026-11-06, his ask: "for some emails I receive a failure in sending - if it repeats, remove it from
// the list, or at least mark it as failed"). Gmail accepts every mail at sending time; the failure comes back later as a
// mail to the sending account. Every run reads the new ones (IMAP, the same app password), takes the address and the
// reason; a permanent failure (no such address, account gone) stops the news to that address at once, a temporary one
// (mailbox full, server refused for a while) after the 2nd time. mailBounces/<address> keeps them; Backstage shows them
// ("לא מגיע") and can put an address back.
const BOUNCE_SOFT_MAX = 2;
const bounceDoc = (email) => db.collection('mailBounces').doc(encodeURIComponent(String(email).toLowerCase()).slice(0, 1400));
async function recordBounce(email, { hard, code = '', reason = '', via = 'notice', when = Date.now() }) {
  email = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const ref = bounceDoc(email);
  const stop = await db.runTransaction(async (tx) => {
    const x = (await tx.get(ref)).data() || {};
    const h = (x.hard || 0) + (hard ? 1 : 0), sft = (x.soft || 0) + (hard ? 0 : 1);
    const st = h > 0 || sft >= BOUNCE_SOFT_MAX;
    tx.set(ref, { email, hard: h, soft: sft, stop: st, last: Timestamp.fromMillis(when), code: String(code).slice(0, 20), reason: String(reason).slice(0, 300), via,
      ...(st && !x.stop ? { stopped: Timestamp.fromMillis(Date.now()) } : {}) }, { merge: true });
    return st;
  });
  if (stop) {   // the account(s) with this address get no more news; the reason stays on them
    const us = await db.collection('mailUsers').where('email', '==', email).get();
    await Promise.all(us.docs.map((d) => d.ref.set({ bounced: { at: Timestamp.fromMillis(Date.now()), reason: String(reason).slice(0, 300), hard: !!hard } }, { merge: true })));
  }
  return stop;
}
// a failure notice -> {email, hard, code, reason}; delay warnings ("will retry") are not failures
function parseBounce(raw, subject) {
  const head = raw.slice(0, 120000);
  if (/delay|delayed|will (keep|continue) trying|retry/i.test(subject) && !/fail/i.test(subject)) return null;
  const pick = (re) => { const m = head.match(re); return m ? m[1].trim() : ''; };
  const email = (pick(/^X-Failed-Recipients:\s*([^\s,;]+)/im) || pick(/^Final-Recipient:\s*rfc822;\s*<?([^\s>]+)/im) || pick(/^Original-Recipient:\s*rfc822;\s*<?([^\s>]+)/im)
    || pick(/wasn't delivered to\s+<?([^\s<>]+@[^\s<>]+?)>?[\s.]/i) || pick(/delivery to the following recipient[s]? failed[^\n]*\n\s*<?([^\s<>]+@[^\s<>]+)/i)).toLowerCase();
  if (!email || !email.includes('@')) return null;
  const status = pick(/^Status:\s*([245]\.\d{1,3}\.\d{1,3})/im) || pick(/\b([45]\.\d\.\d{1,3})\b/);
  const diag = pick(/^Diagnostic-Code:\s*(?:smtp;)?\s*([^\r\n]+)/im) || pick(/\b(5\d\d[ -][^\r\n]{10,200})/) || pick(/\b(4\d\d[ -][^\r\n]{10,200})/);
  // permanent: a 5.x.x status, except a full mailbox (5.2.2) which can empty again
  const hard = /^5\./.test(status) ? status !== '5.2.2' && !/quota|mailbox (is )?full|over (the )?quota/i.test(diag) : /does not exist|no such user|user unknown|address not found|account (is )?disabled|NoSuchUser/i.test(head) && !/quota|mailbox full/i.test(head);
  return { email, hard, code: status, reason: (diag || subject).replace(/\s+/g, ' ').slice(0, 300) };
}
async function scanBounces() {
  if (LOCAL) return { found: 0, local: true };
  const { ImapFlow } = require('imapflow');
  const meta = db.collection('verseMeta').doc('mailBounces'), st = (await meta.get()).data() || {};
  const c = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() }, logger: false });
  await c.connect();
  let found = 0, stopped = 0, last = 0, validity = '', box = 'INBOX';
  try {
    // "All Mail" (by its special use, whatever the language), so a notice he archived or read still counts
    box = ((await c.list()).find((b) => b.specialUse === '\\All') || {}).path || 'INBOX';
    const lock = await c.getMailboxLock(box);
    try {
      validity = String(c.mailbox.uidValidity);
      last = st.box === box && st.validity === validity ? st.lastUid || 0 : 0;
      const uids = (await c.search({ since: new Date(Date.now() - 21 * 864e5), or: [{ from: 'mailer-daemon' }, { from: 'postmaster' }] }, { uid: true })) || [];
      for (const uid of uids.filter((u) => u > last).sort((a, b) => a - b).slice(0, 150)) {
        const m = await c.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        const r = m && m.source ? parseBounce(m.source.toString('utf8'), (m.envelope && m.envelope.subject) || '') : null;
        if (r) { found++; if (await recordBounce(r.email, { ...r, when: m.envelope && m.envelope.date ? +new Date(m.envelope.date) : Date.now() })) stopped++; }
        last = Math.max(last, uid);
      }
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
  await meta.set({ box, validity, lastUid: last, at: Timestamp.fromMillis(Date.now()) }, { merge: true });
  if (found) console.log('bounces', JSON.stringify({ found, stopped }));
  return { found, stopped };
}

// ---------- sending + the log ----------
let transport;
// one pooled connection: logging in for every mail made Gmail answer "too many login attempts" (launch night)
const gmail = () => (transport ||= nodemailer.createTransport({ service: 'gmail', pool: true, maxConnections: 1, maxMessages: 200,
  auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } }));
// one mail out, and its line in mailLog (the backstage's "what we sent"), the HTML kept so it can be opened there
async function deliver({ to, uid = null, kind, m, fromName = 'השלומיוורס', replyTo = OWNER, meta = {} }) {   // answers to any mail reach Shlomi
  const log = { to, uid, kind, subject: m.subject, fromName, meta, t: FieldValue.serverTimestamp(), ok: false };
  try {
    if (LOCAL) console.log('[local] mail not sent:', kind, to, m.subject);
    else await gmail().sendMail({ from: `${fromName} <${GMAIL_USER.value()}>`, to, subject: m.subject, html: m.html, text: m.text, headers: m.headers, ...(replyTo ? { replyTo } : {}) });
    log.ok = true;
  } catch (e) {
    log.error = String(e.message).slice(0, 300); console.error('mail failed', kind, to, e.message);
    // the address itself refused at sending time (not a login / server hiccup): a permanent failure for that address
    if (e.code === 'EENVELOPE' || (e.responseCode >= 550 && e.responseCode < 560)) await recordBounce(to, { hard: true, code: String(e.responseCode || ''), reason: String(e.message).slice(0, 240), via: 'smtp' }).catch(() => {});
  }
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
  // the first run starts 3 days back: stories, videos and games from the days before the launch still count as news
  const START = now - 3 * 864e5;
  if (!meta) {
    const old = (w.games || []).filter((g) => !g.date || Date.parse(g.date) < START - 864e5).map((g) => g.id);
    await metaRef.set({ since: Timestamp.fromMillis(START), games: old });
    return sweepEvents(now);
  }
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

// ---------- the citizenship journey's invitation, to a resident who hasn't started it (stage 4) ----------
// His own words (2026-11-06), a letter from the Shlomiverse's embassy, addressed by the name the resident registered with (fans.nick).
// the residents' mail, round 2 (his notes 2026-11-07, plan mail-cz-sim): the simulation test in the same letter (Terra's paragraph +
// its own button, the text he called perfect), and his pick for the picture - C, the passport on a mountain of paperwork with Miriam
// and Demokratovich behind it (the book turned into a Hebrew one, his note: "it opens left to right - a recurring problem")
const CZ_HERO = `${MEDIA}/mail/residents-hero.jpg`;
const citizenData = (name) => ({ from: 'שגרירות השלומיוורס', subject: name ? `${name}, נפתחו הליכי סיווג מציאות ואזרחות` : 'נפתחו הליכי סיווג מציאות ואזרחות', hero: CZ_HERO,   // a subject: no full stop, their name first
  preheader: 'שבע שאלות ליותם, בקשת אזרחות אחת, ואפס זכויות לאזרחים מייסדים',
  to: name ? `לכבוד ${name},` : '', title: 'נפתחה שגרירות השלומיוורס.',
  paras: ['לאחר שנים של ניסיונות כושלים לתקן את המציאות, החלטנו לפתוח אחת נוספת.', 'החל מהיום ניתן להגיש בקשה לאזרחות ביקום מקביל.',
    'כדי לעזוב את המציאות הנוכחית, תידרשו תחילה להוכיח שאתם קיימים. לשם כך הוקם מערך בירוקרטי שלם.',
    'מרים תקבל את פניכם בדלפק הצ\'ק־אין, תשאל שאלות שאין לה סמכות לשאול, לא תבין את התשובות ותסווג אתכם בהתאם.',
    'בתום ההליך יונפק לכם דרכון רשמי, מספר אזרח וכרטיס כניסה לשלומיוורס.'],
  sim: { at: 3, cta: 'לבדיקת הסימולציה', para: 'טרם עזיבת המציאות הנוכחית, מומלץ לברר באיזו סימולציה אתם חיים בכלל. לצורך כך נפתח מבחן בן שבע שאלות, שבו יותם, ארכיטקט המערכת של החיים, יגיב לכל תשובה ויסווג אתכם. בתום המבחן יימסרו שם הסימולציה והדמויות החיות בה עמכם.' },
  bold: 'לאלף הראשונים יוענק מעמד "אזרח מייסד".', fine: 'המעמד אינו מקנה זכויות או הטבות כלשהן. השגרירות שומרת לעצמה את הזכות לשלול אותן בכל עת.',
  cta: 'להגשת בקשת אזרחות', sign: 'שגרירות השלומיוורס', signRole: 'אגף הגירה, רישום וסיווג שרירותי',
  note: 'קיבלתם את המייל כי יש לכם חשבון בשלומיוורס.' });

// ---------- an idea's step, to its writer (his ask, 2026-11-05) ----------
// Personal, not marketing: it goes whatever the switch says and beside the day's one mail - but never to someone who
// stopped mail, and on Shabbat / at night it waits in mailQueue for the first run in decent hours. (Terra wrote the words.)
const IDEA_MAIL = {
  liked: { subject: 'השלומיוורס אהב את הרעיון שלכם', preheader: 'הוא סומן בקיר הרעיונות', chip: 'השלומיוורס אהב', title: '{nick}, יש מצב לרעיון הזה',
    body: 'השלומיוורס אהב את הרעיון שלכם והוא עכשיו מסומן בקיר הרעיונות. זה עדיין לא מבטיח פרק, אבל נעדכן אתכם אם הוא יתקדם. בינתיים אפשר לשתף אותו ולגייס עוד +1ים.', cta: 'לראות את הרעיון' },
  making: { subject: 'הרעיון שלכם כבר בעבודה', preheader: 'השלומיוורס התחיל לעבוד עליו', chip: 'בעבודה', title: 'הרעיון שלכם זז',
    body: 'השלומיוורס התחיל לעבוד על הרעיון שלכם, בכתיבה או בצילומים. יש עוד דרך למסך, אבל זה קורה. נעדכן אתכם כשהוא יצא לאוויר.', cta: 'לראות את הרעיון' },
  live: { subject: 'הסרטון מהרעיון שלכם עלה', preheader: 'ויש לכם עליו קרדיט', chip: 'עלה לאוויר', title: '{nick}, זה עלה למסך',
    body: 'סרטון שנולד מהרעיון שלכם יצא לאוויר, ויש לכם עליו קרדיט. לכו לראות מה יצא מזה, ואז תשתפו עם מי שחייבים לראות.', cta: 'לצפייה בסרטון' },
};
function ideaRender(x, name, links = {}) {
  const c = IDEA_MAIL[x.status], nick = first(name || '');
  const title = nick ? c.title.replace('{nick}', nick) : c.title.replace('{nick}, ', '');
  const href = x.status === 'live' && x.videoId ? `/v/${x.videoId}` : `/community?idea=${x.ideaId}`;
  return mail.render('idea', { subject: c.subject, preheader: c.preheader, chip: c.chip, title, idea: x.text, body: c.body, cta: c.cta, href,
    note: 'קיבלתם את המייל כי הצעתם רעיון בשלומיוורס' }, links);
}
async function ideaMail(x, { now = Date.now(), queued = null } = {}) {
  const c = IDEA_MAIL[x.status];
  if (!c || !x.uid) return 'no';
  if (!queued && !sendingHours(now)) { await db.collection('mailQueue').add({ kind: 'idea', x, sent: false, t: FieldValue.serverTimestamp() }); return 'queued'; }
  const st = (await db.collection('mailUsers').doc(x.uid).get()).data() || {};
  if (st.off) return 'off';
  const u = await admin.auth().getUser(x.uid).catch(() => null);
  if (!u?.email) return 'no-email';
  const m = ideaRender(x, x.nick || u.displayName, { unsub: prefsLink(x.uid), unsubPost: prefsLink(x.uid) + '&one=1' });
  return (await deliver({ to: u.email, uid: x.uid, kind: 'idea', m, meta: { ideaId: x.ideaId, status: x.status } })) ? 'sent' : 'failed';
}
// the idea mails that waited for Shabbat / the night to end
async function drainQueue(now) {
  const q = await db.collection('mailQueue').where('sent', '==', false).limit(50).get();
  let n = 0;
  for (const d of q.docs) {
    const r = d.data().kind === 'idea' ? await ideaMail(d.data().x, { now, queued: true }).catch((e) => 'failed: ' + e.message) : 'unknown';
    await d.ref.update({ sent: true, result: r, at: FieldValue.serverTimestamp() });
    if (r === 'sent') n++;
  }
  return n;
}

// one run: write down what happened, then mail whoever is due (at most PER_RUN). dry = only say who would get what.
async function run({ now = Date.now(), dry = false, force = false, budget = 420e3 } = {}) {
  if (!force && !sendingHours(now)) return { skipped: 'hours' };
  const queued = dry ? 0 : await drainQueue(now).catch((e) => { console.error('mail queue', e.message); return 0; });
  if (queued) console.log('idea mails from the queue', queued);
  const swept = await sweepEvents(now);
  if (!dry) await scanBounces().catch((e) => console.error('bounces', e.message));   // failures first, so no mail goes to them now
  const cfg = (await db.collection('verseMeta').doc('mail').get()).data() || { on: false, only: [OWNER] };
  const users = [];
  let next;
  // addresses that can't receive mail (test accounts: @x.invalid, @example.com) are skipped - a bounce costs the sender's name at Gmail
  const realMail = (e) => !/\.(invalid|test|example|localhost)$|@example\.(com|org|net)$/i.test(e);
  do { const r = await admin.auth().listUsers(1000, next); users.push(...r.users.filter((u) => u.email && !u.disabled && realMail(u.email)).map((u) => ({ uid: u.uid, email: u.email, name: u.displayName || '' }))); next = r.pageToken; } while (next);
  const [st, fans, evs] = await Promise.all([db.collection('mailUsers').get(), db.collection('fans').select('follows').get(),
    db.collection('mailEvents').where('t', '>', Timestamp.fromMillis(now - MAX_AGE)).get()]);
  const state = Object.fromEntries(st.docs.map((d) => [d.id, d.data()]));
  const follows = Object.fromEntries(fans.docs.map((d) => [d.id, d.data().follows || []]));
  const events = evs.docs.map((d) => ({ id: d.id, ...d.data() }));
  const due = plan({ users: users.filter((u) => !(state[u.uid] || {}).bounced), state, follows, events, now, cfg });   // failing addresses get nothing
  if (dry) return { swept, cfg, due: due.map((p) => ({ email: p.email, kind: p.kind, events: p.events.map((e) => e.id) })) };
  // one run at a time (launch night, 2026-11-04: a manual run next to the scheduled one mailed 6 people twice)
  if (!(await lock(now))) return { swept, due: due.length, sent: 0, skipped: 'busy' };
  try {
    const w = await wiki();
    let sent = 0;
    for (const p of due.slice(0, PER_RUN)) {
      if (Date.now() - now > budget) break;                       // the rest go next run, never cut off mid-send
      const ref = db.collection('mailUsers').doc(p.uid);
      const fresh = (await ref.get()).data() || {};               // still due? (nothing else mailed them meanwhile)
      if (fresh.off || (ms(fresh.last) && il(ms(fresh.last)).day === il(now).day)) continue;
      const x = await mailFor(p, w, now);
    // after the welcome the news starts 3 days back: what happened just before someone joined still reaches them (tomorrow)
    const cursor = Timestamp.fromMillis(p.kind === 'welcome' ? now - 3 * 864e5 : Math.max(now, ...p.events.map((e) => ms(e.t))));
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
  } finally { await unlock(); }
}
const lockRef = () => db.collection('verseMeta').doc('mailLock');
const lock = (now) => db.runTransaction(async (tx) => {
  const l = (await tx.get(lockRef())).data();
  if (l && l.until > Date.now()) return false;
  tx.set(lockRef(), { until: now + 9 * 60e3 });
  return true;
});
const unlock = () => lockRef().set({ until: 0 }).catch(() => {});
exports.verseMailer = onSchedule({ schedule: 'every 30 minutes', timeZone: 'Asia/Jerusalem', region: REGION, secrets: SECRETS, timeoutSeconds: 540, memory: '512MiB' },
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
  { const d = citizenData(P.name); out.push({ key: 'אזרחות', label: 'הזמנה למסע האזרחות (שגרירות)', kind: 'citizen', from: d.from, ...mail.render('citizen', d) }); }
  if (games[0]) await add('משחק חדש', { ...P, kind: 'game', events: [ev('game', games[0].id)] });
  if (videos[0]) await add('סרטון חדש', { ...P, kind: 'video', events: [ev('video', videos[0].id)] });
  if (stories[0]) await add('סטורי חדש', { ...P, kind: 'story', events: [ev('story', stories[0].id)] });
  await add('כמה דברים באותו יום', { ...P, kind: 'digest', events: [games[0] && ev('game', games[0].id), games[1] && ev('game', games[1].id), ...videos.slice(0, 3).map((v) => ev('video', v.id)),
    ...stories.map((d) => ev('story', d.id))].filter(Boolean) });
  const sampleIdea = { ideaId: 'sample', text: 'מה עם דמות נוספת - הדתי מחמד, זה שמנדבים אותו להדליק נרות חנוכה ושואלים אותו על ההכשרים?', videoId: videos[0]?.id };
  for (const [status, label] of [['liked', 'רעיון: השלומיוורס אהב'], ['making', 'רעיון: בעבודה'], ['live', 'רעיון: עלה לאוויר']]) {
    out.push({ key: 'idea:' + status, label, kind: 'idea', ...ideaRender({ ...sampleIdea, status }, 'ישראל') });
  }
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
  if (op === 'mailBounces') {
    const q = await db.collection('mailBounces').orderBy('last', 'desc').limit(200).get();
    const meta = (await db.collection('verseMeta').doc('mailBounces').get()).data() || {};
    return { at: ms(meta.at), bounces: q.docs.map((d) => { const x = d.data(); return { email: x.email, hard: x.hard || 0, soft: x.soft || 0, stop: !!x.stop, code: x.code || '', reason: x.reason || '', via: x.via || '', last: ms(x.last), stopped: ms(x.stopped) }; }) };
  }
  if (op === 'mailBounceScan') return scanBounces();
  if (op === 'mailUnbounce') {   // he puts an address back: the count starts again, the news resumes
    const email = String(b.email || '').toLowerCase().trim();
    if (!email) return { error: 'email' };
    await bounceDoc(email).set({ stop: false, hard: 0, soft: 0, back: FieldValue.serverTimestamp() }, { merge: true });
    const us = await db.collection('mailUsers').where('email', '==', email).get();
    await Promise.all(us.docs.map((d) => d.ref.update({ bounced: FieldValue.delete() })));
    return { ok: true };
  }
  if (op === 'mailConfig') {
    const cfg = { on: !!b.on, only: (Array.isArray(b.only) ? b.only : [OWNER]).map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 50) };
    await db.collection('verseMeta').doc('mail').set({ ...cfg, changed: FieldValue.serverTimestamp() });
    return { cfg };
  }
  if (op === 'mailRunNow') return run({ force: !!b.force, budget: 90e3 });   // verseOwner has 120s
  if (op === 'mailTest') {
    // every sample to one address (his own), straight away - nothing counted, nothing marked
    const to = String(b.to || OWNER);
    let n = 0;
    for (const s of await samples()) if (!b.key || b.key === s.key) n += (await deliver({ to, kind: 'test:' + s.kind, m: s, fromName: s.from || 'השלומיוורס', meta: { sample: s.key } })) ? 1 : 0;
    return { sent: n, to };
  }
  return null;
}

module.exports = { ...exports, citizenData, reply, replyMail, ideaMail, owner, plan, il, sendingHours, deliver, MAIL_SECRETS: SECRETS, _parseBounce: parseBounce };
