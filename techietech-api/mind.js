// "המוח השני" - Shlomi's second brain (shlomiverse.com/mind/, his ask 2026-11-04): everything running through his head
// (ideas, to-dos, notes, reminders - types he controls). HIS notebook (his rule, 2026-11-12: the sessions writing there
// "doing a mess"; Claude already tells him when a session waits for him): what he writes himself, and what a Claude
// session puts there ONLY when he tells it to. No session tracking, no session reports. Doors:
//   /mind/api   - his page. `Key <owner key>` (the same private code as /backstage/ and /all/) or the mind key.
//   /mind/mcp   - an MCP server (streamable HTTP, stateless JSON): a session reads, and writes when he asks. `Bearer <mind key>`.
//   /mind/hook  - closed (old hooks on a computer that wasn't set up again still call it; it answers ok and keeps nothing).
// Site forms (business inquiry, personal video, archive request - verse.js) still open a waiting task: his ask, 2026-11-10.
// The mind key is made on first use and kept in mind_meta/secret (clients can't read mind_* - no rule matches); his
// page shows it in "חיבור מחשב" for the setup line of another computer.
// Deploy from this folder: firebase deploy --only functions:mind
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const webpush = require('web-push');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const OWNER_KEY_SHA256 = require('./owner.json').ownerKeySha256;
const ITEMS = db.collection('mind_items');
const SESSIONS = db.collection('mind_sessions');
const META = db.collection('mind_meta');
const wrongKey = new Map();
const OPENAI = defineSecret('MIND_OPENAI_KEY');   // its own key (2026-11-06) - Mind isn't the Shlomiverse's spend   // the voice notes on his page -> text
// notifications to his phone (the home-screen app): the same VAPID keys as the verse's push (verse.js)
const VAPID_PRIVATE = defineSecret('VERSE_VAPID_PRIVATE');
const VAPID_PUBLIC = 'BApNz6a4ZuFrPgaIEHGY9rvyKkwIvrJPsRjH0k01QYruVT2yz5ce-0fVuuIsk9vyprZ8Gq1nGxXajBL-EMD0hP0';
const PUSH = db.collection('mind_push');
// what buzzes his phone - he turns each on / off in the page's settings (config.push)
// ask = a site form opened a task waiting for him; remind = 9 am reminders. (Session pings are gone, 2026-11-12.)
// session = a session asks him for something (type 'session' - his ask 2026-11-17: "if you need anything from me, tell me on Mind")
// meet = his meetings: the day's digests (07:30 / 11:00 / 15:00) and a heads-up before each one (the PA, 2026-11-20)
// nag = "did you already...?" about the things he asked to be chased about (item.nag), every 2 hours 10:00-20:30
const PUSH_KINDS = { ask: true, remind: true, session: true, meet: true, nag: true };

const STATUSES = ['open', 'active', 'waiting', 'done', 'parked'];
const STATUS_HE = { open: 'פתוח', active: 'בטיפול', waiting: 'מחכה לך', done: 'בוצע', parked: 'בהקפאה' };
const DEFAULT_TYPES = [
  { id: 'idea', name: 'רעיון', color: '#f5a524', icon: 'bulb' },
  { id: 'task', name: 'משימה', color: '#3b82f6', icon: 'check' },
  { id: 'reminder', name: 'תזכורת', color: '#ec4899', icon: 'bell' },
  { id: 'job', name: "ג'וב רץ", color: '#10b981', icon: 'gear' },
  { id: 'thought', name: 'מחשבה', color: '#8b5cf6', icon: 'brain' },
  { id: 'wait', name: 'מחכה למישהו', color: '#f97316', icon: 'hourglass' },
  { id: 'session', name: 'בקשה מסשן', color: '#06b6d4', icon: 'bot' },   // a session needs something from him (2026-11-17)
];
// "for today" (his ask 2026-11-17): an item marked for today keeps the day it was marked - tomorrow it is just an item again
const ilDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todayVal = (v) => (v === true || v === 'yes' ? ilDay() : /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const LOG_MAX = 80;
// "ask me from time to time if I bought it" (his ask 2026-11-20): item.nag = the question his phone asks until it's done
// ('' = off). 'on' / true from the page's switch = a plain question from the title; the AI writes a real one ("קנית כבר אקמול?").
const nagVal = (v, text) => (v === true || v === 'on' ? 'כבר עשית? ' + oneLine(text, 90) : oneLine(v, 120));

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const oneLine = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// a prompt without the blocks tools add to it (<ide_selection>, <browser_instruction>...; cut off at the end = dropped)
const untag = (t) => String(t ?? '').replace(/<([a-zA-Z_-]+)[^>]*>[\s\S]*?(<\/\1>|$)/g, ' ').trim();
const newId = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, '').slice(0, 6).toLowerCase() || newId();

// ---------- access ----------
let secretCache = { key: null, at: 0 };
async function mindKey(create) {
  if (secretCache.key && Date.now() - secretCache.at < 60e3) return secretCache.key;
  const ref = META.doc('secret');
  let key = ((await ref.get()).data() || {}).key;
  if (!key && create) { key = 'mind_' + crypto.randomBytes(24).toString('base64url'); await ref.set({ key, c: Date.now() }); }
  secretCache = { key: key || null, at: Date.now() };
  return key;
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// -> 'owner' | 'session' | null
async function who(req) {
  const now = Date.now(), fails = (wrongKey.get(req.ip) || []).filter((t) => now - t < 3600e3);
  if (fails.length >= 20) return 'blocked';
  const auth = req.get('authorization') || '';
  let ok = null;
  if (auth.startsWith('Key ')) {
    const got = crypto.createHash('sha256').update(auth.slice(4)).digest();
    if (crypto.timingSafeEqual(got, Buffer.from(OWNER_KEY_SHA256, 'hex'))) ok = 'owner';
  } else if (auth.startsWith('Bearer ')) {
    const key = await mindKey(false);
    if (key && same(auth.slice(7).trim(), key)) ok = 'session';
  }
  if (!ok) { fails.push(now); wrongKey.set(req.ip, fails); }
  return ok;
}

// ---------- config: his types, project names, computer names ----------
async function config() {
  const c = (await META.doc('config').get()).data() || {};
  return { types: c.types?.length ? c.types : DEFAULT_TYPES, projects: c.projects || {}, machines: c.machines || {}, push: { ...PUSH_KINDS, ...(c.push || {}) } };
}
const typeIds = async () => new Set((await config()).types.map((t) => t.id));

// ---------- items ----------
const shapeItem = (d) => ({ id: d.id, ...d.data() });
function logEntry(by, text, extra = {}) { return { t: Date.now(), by: oneLine(by, 80) || 'שלומי', text: clip(text, 2000), ...extra }; }

async function addItem(f, by) {
  const types = await typeIds();
  const id = newId();
  const now = Date.now();
  const item = {
    text: oneLine(f.text, 300), body: clip(f.body, 8000),
    type: types.has(f.type) ? f.type : 'idea',
    status: STATUSES.includes(f.status) ? f.status : 'open',
    project: oneLine(f.project, 60), pin: !!f.pin, due: /^\d{4}-\d{2}-\d{2}$/.test(f.due || '') ? f.due : '', today: todayVal(f.today),
    nag: nagVal(f.nag, f.text), nagAt: 0,
    tags: Array.isArray(f.tags) ? f.tags.map((t) => oneLine(t, 30)).filter(Boolean).slice(0, 10) : [],
    sessions: f.session ? [oneLine(f.session, 80)] : [], by: oneLine(by, 80) || 'שלומי', c: now, u: now,
    log: [logEntry(by, f.note || 'נוצר', { st: STATUSES.includes(f.status) ? f.status : 'open', ...(f.session ? { s: oneLine(f.session, 80) } : {}) })],
  };
  if (!item.text) throw new Error('text is empty');
  await ITEMS.doc(id).set(item);
  if (f.session) await linkSession(f.session, id);
  if (item.type === 'session' && by !== 'שלומי') await pushMe('session', { title: 'סשן צריך אותך: ' + item.text, body: f.note || item.body, url: '/mind/#' + id, tag: 'i:' + id });
  return { id, ...item };
}

async function updateItem(id, f, by, quiet) {
  const ref = ITEMS.doc(oneLine(id, 20).replace(/^#/, ''));
  const types = await typeIds();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('no item ' + id);
    const it = snap.data(), ch = {}, said = [];
    if (f.text != null && oneLine(f.text, 300)) ch.text = oneLine(f.text, 300);
    if (f.body != null) ch.body = clip(f.body, 8000);
    if (f.type != null && types.has(f.type) && f.type !== it.type) ch.type = f.type;
    if (f.project != null) ch.project = oneLine(f.project, 60);
    if (f.pin != null) ch.pin = !!f.pin;
    if (f.due != null) ch.due = /^\d{4}-\d{2}-\d{2}$/.test(f.due) ? f.due : '';
    if (f.today != null) ch.today = todayVal(f.today);
    if (f.nag != null && nagVal(f.nag, ch.text || it.text) !== (it.nag || '')) { ch.nag = nagVal(f.nag, ch.text || it.text); ch.nagAt = Date.now(); }
    if (Array.isArray(f.tags)) ch.tags = f.tags.map((t) => oneLine(t, 30)).filter(Boolean).slice(0, 10);
    if (f.status != null && STATUSES.includes(f.status) && f.status !== it.status) { ch.status = f.status; said.push(STATUS_HE[f.status]); }
    if (f.session) { const s = oneLine(f.session, 80); if (!(it.sessions || []).includes(s)) ch.sessions = [...(it.sessions || []), s].slice(-10); }
    if (!Object.keys(ch).length && !f.note) return { id: ref.id, ...it };
    ch.u = Date.now();
    if (f.note || ch.status || ch.sessions) {
      ch.log = [...(it.log || []), logEntry(by, f.note || (ch.status ? 'סטטוס: ' + said.join(', ') : 'לקח את זה'), {
        ...(ch.status ? { st: ch.status } : {}), ...(f.session ? { s: oneLine(f.session, 80) } : {}) })].slice(-LOG_MAX);
    }
    tx.update(ref, ch);
    return { id: ref.id, ...it, ...ch, _linked: f.session && ch.sessions ? oneLine(f.session, 80) : null, _st: ch.status || null };
  }).then(async (r) => {
    if (r._linked) await linkSession(r._linked, r.id); delete r._linked;
    if (!quiet && by !== 'שלומי' && r._st === 'waiting') await pushMe('ask', { title: 'מחכה לך: ' + r.text, body: f.note || '', url: '/mind/#' + r.id, tag: 'i:' + r.id });
    delete r._st; return r;
  });
}

async function linkSession(sid, itemId) {
  await SESSIONS.doc(sessionDocId(sid)).set({ items: admin.firestore.FieldValue.arrayUnion(itemId), u: Date.now() }, { merge: true });
}
const sessionDocId = (sid) => oneLine(sid, 80).replace(/[\/\s]/g, '_') || 'unknown';

async function listItems({ status, type, project, query, limit = 200, includeDone } = {}) {
  const snap = await ITEMS.orderBy('u', 'desc').limit(1500).get();
  let items = snap.docs.map(shapeItem);
  if (status) { const s = [].concat(status); items = items.filter((i) => s.includes(i.status)); }
  else if (!includeDone) items = items.filter((i) => i.status !== 'done' && i.status !== 'parked');
  if (type) items = items.filter((i) => i.type === type);
  if (project) { const p = project.toLowerCase(); items = items.filter((i) => (i.project || '').toLowerCase().includes(p)); }
  if (query) { const q = query.toLowerCase(); items = items.filter((i) => (i.text + ' ' + i.body + ' ' + (i.tags || []).join(' ')).toLowerCase().includes(q)); }
  return items.slice(0, Math.min(+limit || 200, 1500));
}

// ---------- notifications ----------
// one notification to every device he turned them on (dead ones are dropped). kind = one of PUSH_KINDS.
async function pushMe(kind, { title, body, url, tag }, why, opt = {}) {
  try {
    const on = { ...PUSH_KINDS, ...((await config()).push || {}) };
    if (!on[kind]) { if (why) why.push('kind off: ' + kind); return 0; }
    const subs = await PUSH.get();
    if (subs.empty) { if (why) why.push('no devices'); return 0; }
    webpush.setVapidDetails('https://shlomiverse.com/mind/', VAPID_PUBLIC, VAPID_PRIVATE.value());
    const text = opt.lines ? String(body ?? '').split('\n').map((l) => oneLine(l, 90)).filter(Boolean).join('\n').slice(0, 600) : oneLine(body, 240);
    const payload = JSON.stringify({ title: oneLine(title, 120), body: text, url: url || '/mind/', tag: tag || kind });
    let sent = 0;
    await Promise.all(subs.docs.map(async (d) => {
      try { await webpush.sendNotification(d.data().sub, payload, { TTL: opt.ttl || 86400, urgency: opt.urgency || (kind === 'ask' ? 'high' : 'normal') }); sent++; }
      catch (e) { if (why) why.push(`${e.statusCode || ''} ${e.body || e.message}`.slice(0, 300)); if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete(); else console.error('mind push', e.statusCode, e.body || e.message); }
    }));
    return sent;
  } catch (e) { if (why) why.push(e.message); console.error('mind push', e.message); return 0; }
}
// ---------- his calendars: the PA (his ask 2026-11-20: "most most most important job of you and the app is remind me
// about meetings" - his two Google accounts, work + Lybi) ----------
// mind_meta/google = { client_id, client_secret, accounts: { email: { refresh, scopes, c, err } } } - written by
// scripts/mind/google-connect.mjs (one browser sign-in per account). Each account's primary calendar, merged; the same
// meeting on both calendars shows once (iCalUID).
const GOOGLE = META.doc('google');
const ACC_SHORT = (a) => (a.split('@')[1] || a).split('.')[0];   // boostart / lybi
const tokCache = new Map();
async function gAccess(email, g) {
  const c = tokCache.get(email);
  if (c && c.exp > Date.now() + 60e3) return c.tok;
  const r = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.client_id, client_secret: g.client_secret, refresh_token: g.accounts[email].refresh, grant_type: 'refresh_token' }) })).json();
  if (!r.access_token) { const e = new Error(r.error_description || r.error || 'token'); e.gone = r.error === 'invalid_grant'; throw e; }
  tokCache.set(email, { tok: r.access_token, exp: Date.now() + (r.expires_in || 3000) * 1000 });
  return r.access_token;
}
// Israel's offset for a given moment ("+02:00" / "+03:00")
const ilOffset = (d) => (new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || 'GMT+02:00').replace('GMT', '') || '+00:00';
const ilStart = (day) => new Date(`${day}T00:00:00${ilOffset(new Date(day + 'T12:00:00Z'))}`);   // 00:00 of that Israeli day
const ilDayOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const ilHM = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const VIDEO = /https:\/\/(?:[\w-]+\.)?(?:zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join\/|teams\.live\.com\/meet\/)[^\s"<>)]+/i;
function meeting(e, acc) {
  const allDay = !e.start?.dateTime;
  const self = (e.attendees || []).find((a) => a.self);
  const link = e.hangoutLink || (e.conferenceData?.entryPoints || []).find((p) => p.entryPointType === 'video')?.uri
    || (String(e.location || '').match(VIDEO) || String(e.description || '').match(VIDEO) || [])[0] || '';
  return {
    id: e.id, uid: e.iCalUID || e.id, acc, title: oneLine(e.summary, 200) || '(בלי כותרת)', allDay,
    start: allDay ? e.start.date : new Date(e.start.dateTime).toISOString(), end: allDay ? e.end?.date : new Date(e.end?.dateTime || e.start.dateTime).toISOString(),
    where: oneLine(e.location, 200), link, html: e.htmlLink || '', notes: clip(String(e.description || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '), 1200),
    people: (e.attendees || []).filter((a) => !a.self && !a.resource).slice(0, 30).map((a) => ({ name: oneLine(a.displayName, 60), email: oneLine(a.email, 120), rsvp: a.responseStatus })),
    organizer: e.organizer?.self ? '' : oneLine(e.organizer?.displayName || e.organizer?.email, 120), rsvp: self?.responseStatus || '',
  };
}
let agendaCache = { key: '', at: 0, data: null };
// meetings from `from` to `to` (Dates) on all his connected calendars. -> { meetings, accounts: [{ email, ok, err }] }
async function agenda(from, to, fresh) {
  const key = from.toISOString() + to.toISOString();
  if (!fresh && agendaCache.key === key && Date.now() - agendaCache.at < 90e3) return agendaCache.data;
  const g = (await GOOGLE.get()).data();
  const accs = Object.keys(g?.accounts || {});
  const out = [], status = [];
  await Promise.all(accs.map(async (email) => {
    try {
      const tok = await gAccess(email, g);
      const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: 'Asia/Jerusalem' });
      const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + q, { headers: { authorization: 'Bearer ' + tok } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'calendar ' + r.status);
      for (const e of j.items || []) {
        if (e.status === 'cancelled' || ['workingLocation', 'birthday', 'fromGmail'].includes(e.eventType)) continue;
        const m = meeting(e, email);
        if (m.rsvp === 'declined') continue;
        out.push(m);
      }
      status.push({ email, ok: true });
      if (g.accounts[email].err) await GOOGLE.set({ accounts: { [email]: { err: admin.firestore.FieldValue.delete() } } }, { merge: true });
    } catch (e) {
      status.push({ email, ok: false, err: e.message, gone: !!e.gone });
      if (!g.accounts[email].err) {   // tell him once that a calendar dropped (a re-connect line fixes it)
        await GOOGLE.set({ accounts: { [email]: { err: e.message, errAt: Date.now() } } }, { merge: true });
        await pushMe('meet', { title: 'היומן של ' + email + ' התנתק', body: 'הפגישות שלו לא יגיעו עד שיחובר שוב (scripts/mind/google-connect.mjs ' + email + ')', url: '/mind/#meet', tag: 'cal-err' });
      }
    }
  }));
  // the same meeting on both calendars = one (keep the copy that has a link / where he said yes)
  const by = new Map();
  for (const m of out) {
    const k = m.uid + '|' + m.start, had = by.get(k);
    if (!had) by.set(k, { ...m, accs: [m.acc] });
    else { had.accs.push(m.acc); if (!had.link && m.link) Object.assign(had, { ...m, accs: had.accs }); }
  }
  const meetings = [...by.values()].sort((a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || a.start.localeCompare(b.start));
  const data = { meetings, accounts: status.sort((a, b) => a.email.localeCompare(b.email)), connected: accs.length > 0 };
  agendaCache = { key, at: Date.now(), data };
  return data;
}
// times inside an LTR isolate - in a Hebrew notification "09:00–10:00" would flip to "10:00–09:00"
const ltr = (s) => '⁦' + s + '⁩';
const hm = (m) => (m.allDay ? 'כל היום' : ltr(ilHM(new Date(m.start))));
// the line a digest shows for one meeting: "09:30 שיחה עם דני"
const meetLine = (m) => `${hm(m)} ${m.title}`;

// The PA's rhythm (his ask 2026-11-20: "a reminder in the morning - I'm up at 6:30, around 7:30; another around 11:00 and so
// on - for all the day's upcoming, not only the next one"): digests at 07:30 / 11:00 / 15:00 with every meeting still ahead
// today (the morning one always comes - "nothing today" too, so a silent phone means a broken push, not a free day), and
// a heads-up MEET_LEAD minutes before each meeting. What was sent is kept per day in mind_meta/agenda_<day>.
const DIGESTS = ['07:30', '11:00', '15:00'];
const MEET_LEAD = 10;
const NAG_FROM = '10:00', NAG_TO = '20:30', NAG_EVERY = 2 * 3600e3;
async function agendaTick(now = new Date()) {
  const day = ilDayOf(now), t = ilHM(now);
  const sentRef = META.doc('agenda_' + day), sent = (await sentRef.get()).data() || {};
  const g = (await GOOGLE.get()).data();
  const { meetings } = Object.keys(g?.accounts || {}).length ? await agenda(ilStart(day), new Date(ilStart(day).getTime() + 36 * 3600e3), true) : { meetings: [] };
  const today = meetings.filter((m) => (m.allDay ? m.start === day : ilDayOf(new Date(m.start)) === day));
  const mark = {}, did = [];
  // the things he asked to be chased about (item.nag): awake hours only, every NAG_EVERY, never in the middle of a meeting
  const inMeeting = today.some((m) => !m.allDay && new Date(m.start) <= now && new Date(m.end) > now);
  if (t >= NAG_FROM && t <= NAG_TO && !inMeeting) {
    for (const d of (await ITEMS.where('nag', '>', '').get()).docs) {
      const it = d.data();
      if (!['open', 'active', 'waiting'].includes(it.status) || now - (it.nagAt || it.c) < NAG_EVERY) continue;
      await d.ref.update({ nagAt: now.getTime(), nagN: (it.nagN || 0) + 1 });
      await pushMe('nag', { title: it.nag, body: 'לחץ כדי לענות', url: '/mind/#nag=' + d.id, tag: 'nag:' + d.id }, null, { ttl: 3600 });
      did.push('nag ' + it.text);
    }
  }
  // digest: the latest slot that came (within the hour after it), not sent yet
  const slot = DIGESTS.filter((s) => s <= t && minutes(t) - minutes(s) < 60).pop();
  if (slot && !sent['d' + slot]) {
    mark['d' + slot] = Date.now();
    const ahead = today.filter((m) => !m.allDay && new Date(m.end) > now), allDay = today.filter((m) => m.allDay);
    const morning = slot === DIGESTS[0];
    if (morning || ahead.length) {
      const list = (morning ? [...allDay, ...ahead] : ahead);
      const title = !ahead.length ? 'אין פגישות היום' : morning ? `היום ${ahead.length === 1 ? 'פגישה אחת' : ahead.length + ' פגישות'}` : `עוד ${ahead.length === 1 ? 'פגישה אחת' : ahead.length + ' פגישות'} היום`;
      const body = list.length ? list.map(meetLine).join('\n') : 'היומן פנוי. יום טוב.';
      await pushMe('meet', { title, body, url: '/mind/#meet', tag: 'agenda' }, null, { lines: true, ttl: 3 * 3600 });
      did.push('digest ' + slot);
    }
  }
  // heads-up before each meeting (also catches one added at the last minute: anything starting in the next MEET_LEAD min)
  for (const m of today.filter((x) => !x.allDay)) {
    const mins = (new Date(m.start) - now) / 60e3, k = 'm' + crypto.createHash('sha1').update(m.uid + m.start).digest('hex').slice(0, 12);
    if (mins > MEET_LEAD || mins < -2 || sent[k]) continue;
    mark[k] = Date.now();
    const inMin = Math.max(0, Math.round(mins));
    await pushMe('meet', { title: (inMin ? `בעוד ${inMin} דק׳: ` : 'מתחיל עכשיו: ') + m.title, body: [m.allDay ? 'כל היום' : ltr(ilHM(new Date(m.start)) + '–' + ilHM(new Date(m.end))), m.link ? 'יש קישור לשיחה - לחץ' : m.where].filter(Boolean).join(' · '),
      url: '/mind/#m=' + encodeURIComponent(m.uid + '|' + m.start), tag: k }, null, { urgency: 'high', ttl: 900 });
    did.push('pre ' + m.title);
  }
  if (Object.keys(mark).length) await sentRef.set(mark, { merge: true });
  return { day, t, today: today.length, did };
}
const minutes = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

// ---------- pictures on an item (his ask 2026-11-17: "sessions send me images to approve") ----------
// item.images = [{ path, name, caption, by, t }] - the files in the private bucket shlomiverse-studio/mind/<item>/, shown
// to his page through signed links (made once, kept for 5 hours - the page polls)
const IMG_BUCKET = 'shlomiverse-studio';
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const signed = new Map();
async function imgUrl(path) {
  const c = signed.get(path);
  if (c && c.exp > Date.now() + 3600e3) return c.url;
  const exp = Date.now() + 6 * 3600e3;
  const [url] = await admin.storage().bucket(IMG_BUCKET).file(path).getSignedUrl({ action: 'read', expires: exp });   // signBlob: the functions' account holds Token Creator on itself
  signed.set(path, { url, exp });
  return url;
}
async function withUrls(items) {
  await Promise.all(items.filter((i) => i.images?.length).map(async (i) => {
    i.images = await Promise.all(i.images.map(async (m) => ({ ...m, url: await imgUrl(m.path).catch(() => null) })));
  }));
  return items;
}
async function attachImage(id, f, by) {
  const ref = ITEMS.doc(oneLine(id, 20).replace(/^#/, ''));
  const snap = await ref.get();
  if (!snap.exists) throw new Error('no item ' + id);
  const b64 = String(f.image_base64 || f.b64 || '').replace(/^data:[^,]*,/, '');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 100) throw new Error('image_base64 is empty');
  if (buf.length > 7 * 1024 * 1024) throw new Error('image over 7 MB - send a smaller copy (jpg, ~2000 px)');
  const sig = buf.subarray(0, 12).toString('hex');
  const type = sig.startsWith('89504e47') ? 'image/png' : sig.startsWith('ffd8') ? 'image/jpeg' : sig.startsWith('47494638') ? 'image/gif' : sig.slice(16, 24) === '57454250' ? 'image/webp' : '';
  if (!type) throw new Error('not an image (jpg / png / webp / gif)');
  const it = snap.data();
  if ((it.images || []).length >= 20) throw new Error('20 pictures is the most on one item');
  const name = (oneLine(f.name, 60).replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-') || 'image') + '.' + IMG_TYPES[type];
  const path = `mind/${ref.id}/${Date.now()}-${name}`;
  await admin.storage().bucket(IMG_BUCKET).file(path).save(buf, { contentType: type, resumable: false, metadata: { cacheControl: 'private, max-age=3600' } });
  const img = { path, name, caption: clip(f.caption, 300), by: oneLine(by, 80) || 'שלומי', t: Date.now() };
  const ch = { images: [...(it.images || []), img], u: Date.now(), log: [...(it.log || []), logEntry(by, 'צירף תמונה' + (img.caption ? ': ' + img.caption : ''))].slice(-LOG_MAX) };
  await ref.update(ch);
  if (by !== 'שלומי' && (it.type === 'session' || it.status === 'waiting')) await pushMe(it.type === 'session' ? 'session' : 'ask', { title: 'תמונה בשבילך: ' + it.text, body: img.caption, url: '/mind/#' + ref.id, tag: 'i:' + ref.id });
  return { id: ref.id, ...it, ...ch };
}

// ---------- the MCP door ----------
// A session writes here ONLY when Shlomi tells it to ("למוח", "רשום במוח", "add to mind", "send this to mind").
const ASKED = ' Only when Shlomi explicitly asks you to put something in Mind - never on your own initiative, never to report your work.'
  + " The one other use: when he told this session to tell him in Mind what it needs from him, write each need as type 'session' (status 'waiting') - a decision, an answer, an approval, something only he can do - a clear title, and in body what you need, why, and which session / project / path; mark it done once he answered.";
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const itemLine = (i, types) => `#${i.id} [${types[i.type] || i.type}] [${i.status}]${i.pin ? ' [pinned]' : ''}${i.today === ilDay() ? ' [for today]' : ''}${i.project ? ' {' + i.project + '}' : ''} ${i.text}${i.due ? ' (due ' + i.due + ')' : ''}  - by ${i.by || '?'}, updated ${ago(i.u)}`;

const TOOLS = [
  { name: 'mind_overview', description: "Shlomi's notebook in one read: what waits for him, reminders, open ideas / tasks / notes by project. Read it when he asks what's open / what's in Mind / what's on his plate.",
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'only this project (optional)' } } } },
  { name: 'mind_list_items', description: 'List his items (ideas, tasks, notes, reminders...). Default: not done and not parked. Use when he asks about something in Mind, and before adding (no duplicates).',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: STATUSES }, type: { type: 'string' }, project: { type: 'string' }, query: { type: 'string', description: 'words to search in title/body/tags' }, include_done: { type: 'boolean' }, limit: { type: 'number' } } } },
  { name: 'mind_agenda', description: "Shlomi's meetings from his two Google calendars (work + Lybi, merged): today and the next days. Read it when he asks what's on his day / calendar / when a meeting is.",
    inputSchema: { type: 'object', properties: { days: { type: 'number', description: 'how many days from today (default 1 = today only)' } } } },
  { name: 'mind_get_item', description: 'One item with its body and full timeline (his notes on it included).', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'mind_add_item', description: "Put something in Shlomi's notebook: an idea, a to-do, a note, a reminder, or something from this session he wants to keep." + ASKED + ' Title short, in his words (Hebrew if he wrote Hebrew); details, paths and links in body.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'short title' }, body: { type: 'string', description: 'details: what, where (paths/urls), why' }, type: { type: 'string', description: 'type id: idea | task | reminder | thought | wait | session (a session needs something from him), or one of his own (see mind_overview)' }, status: { type: 'string', enum: STATUSES }, project: { type: 'string' }, pin: { type: 'boolean' }, due: { type: 'string', description: 'YYYY-MM-DD' }, today: { type: 'boolean', description: 'mark it for today (highlighted on his page today)' }, tags: { type: 'array', items: { type: 'string' } }, note: { type: 'string', description: 'first timeline line' } }, required: ['text'] } },
  { name: 'mind_attach_image', description: 'Attach a picture to one of his items (a mockup / design / screenshot for him to approve or look at). Use it on an item you were told to write - typically a session request: add the item first, then attach. He answers on the item\'s timeline (read it with mind_get_item). From a file on disk the CLI is easier: node ~/.mind/mind.mjs attach id=<id> file=<path> caption=<text>.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, image_base64: { type: 'string', description: 'the picture, base64 (jpg / png / webp / gif, up to 7 MB)' }, name: { type: 'string', description: 'file name' }, caption: { type: 'string', description: 'what it is / what to approve (Hebrew if he writes Hebrew)' } }, required: ['id', 'image_base64'] } },
  { name: 'mind_update_item', description: 'Change one of his items or add a note to its timeline (mark it done, add what you found).' + ASKED,
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: STATUSES }, note: { type: 'string' }, text: { type: 'string' }, body: { type: 'string' }, type: { type: 'string' }, project: { type: 'string' }, pin: { type: 'boolean' }, due: { type: 'string' }, today: { type: 'boolean', description: 'true = for today, false = not' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['id'] } },
];

async function callTool(name, a = {}) {
  const cfg = await config();
  const types = Object.fromEntries(cfg.types.map((t) => [t.id, t.name]));
  const by = 'Claude';
  switch (name) {
    case 'mind_overview': {
      const items = await listItems({ project: a.project, limit: 600 });
      const forMe = (i) => i.status === 'waiting' || ((i.type === 'task' || i.type === 'reminder') && i.status === 'open');
      const waiting = items.filter(forMe);
      const byProject = {};
      for (const i of items.filter((x) => !forMe(x))) (byProject[i.project || '(no project)'] ||= []).push(i);
      return [
        `Types: ${cfg.types.map((t) => t.id + '=' + t.name).join(', ')}`, '',
        ...(() => { const t = items.filter((i) => i.today === ilDay()); return t.length ? [`## For today (${t.length})`, ...t.map((i) => itemLine(i, types)), ''] : []; })(),
        `## Waiting for Shlomi / his to-dos (${waiting.length})`, ...waiting.map((i) => itemLine(i, types)), '',
        '## Open items by project', ...Object.entries(byProject).flatMap(([p, l]) => [`### ${p} (${l.length})`, ...l.slice(0, 40).map((i) => itemLine(i, types))]),
      ].join('\n');
    }
    case 'mind_list_items': {
      const items = await listItems({ status: a.status, type: a.type, project: a.project, query: a.query, includeDone: a.include_done, limit: a.limit || 100 });
      return items.length ? items.map((i) => itemLine(i, types)).join('\n') : 'No items match.';
    }
    case 'mind_agenda': {
      const day = ilDay(), from = ilStart(day), r = await agenda(from, new Date(from.getTime() + Math.min(Math.max(+a.days || 1, 1), 31) * 86400e3));
      const lines = r.meetings.map((m) => `${m.allDay ? m.start + ' all day' : ilDayOf(new Date(m.start)) + ' ' + ilHM(new Date(m.start)) + '-' + ilHM(new Date(m.end))} · ${m.title} [${m.accs.map(ACC_SHORT).join('+')}]${m.where ? ' · ' + m.where : ''}${m.link ? ' · ' + m.link : ''}${m.people.length ? ' · with ' + m.people.map((x) => x.name || x.email).slice(0, 6).join(', ') : ''}`);
      return (r.connected ? lines.join('\n') || 'No meetings.' : 'No calendar connected yet (scripts/mind/google-connect.mjs).') + r.accounts.filter((x) => !x.ok).map((x) => `\n(calendar ${x.email} not reachable: ${x.err})`).join('');
    }
    case 'mind_get_item': {
      const d = await ITEMS.doc(oneLine(a.id, 20).replace(/^#/, '')).get();
      if (!d.exists) throw new Error('no item ' + a.id);
      const i = shapeItem(d);
      return [itemLine(i, types), i.body ? '\n' + i.body : '', i.tags?.length ? 'tags: ' + i.tags.join(', ') : '',
        ...(i.images?.length ? ['\nPictures:', ...i.images.map((m, n) => `${n + 1}. ${m.name}${m.caption ? ' - ' + m.caption : ''} (by ${m.by})`)] : []), '\nTimeline:',
        ...(i.log || []).map((l) => `- ${new Date(l.t).toISOString().slice(0, 16).replace('T', ' ')} ${l.by}${l.st ? ' [' + l.st + ']' : ''}: ${l.text}`)].filter(Boolean).join('\n');
    }
    case 'mind_add_item': {
      const it = await addItem({ ...a, session: '' }, by);
      return `Added #${it.id}: ${it.text} [${it.type}/${it.status}]. Shlomi sees it at https://shlomiverse.com/mind/#${it.id}`;
    }
    case 'mind_attach_image': {
      const it = await attachImage(a.id, a, by);
      return `Attached to #${it.id} (${it.images.length} picture${it.images.length > 1 ? 's' : ''}): ${it.text}`;
    }
    case 'mind_update_item': {
      const it = await updateItem(a.id, { ...a, session: '' }, by, true);
      return `Updated #${it.id}: ${it.text} [${it.status}]`;
    }
  }
  throw new Error('unknown tool ' + name);
}

async function mcp(msg) {
  const { id, method, params = {} } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  if (id === undefined || id === null) return null;                    // a notification - nothing to answer
  if (method === 'initialize') {
    const v = ['2025-06-18', '2025-03-26', '2024-11-05'].includes(params.protocolVersion) ? params.protocolVersion : '2025-06-18';
    return reply({ protocolVersion: v, capabilities: { tools: {} }, serverInfo: { name: 'mind', title: "Shlomi's second brain", version: '1.0.0' },
      instructions: "Shlomi's own notebook: his ideas, to-dos, notes and reminders, across all his projects. Write here ONLY when he explicitly tells you to (למוח / רשום במוח / add to mind / send this to mind) - never on your own initiative, never to report a session's work. Reading is fine whenever he asks about it. Page: https://shlomiverse.com/mind/" });
  }
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: TOOLS });
  if (method === 'tools/call') {
    try { return reply({ content: [{ type: 'text', text: await callTool(params.name, params.arguments || {}) }] }); }
    catch (e) { return reply({ content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }); }
  }
  if (method === 'resources/list') return reply({ resources: [] });
  if (method === 'prompts/list') return reply({ prompts: [] });
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found: ' + method } };
}

// ---------- his page ----------
async function pageOp(b) {
  switch (b.op) {
    case 'all': {
      const [items, cfg] = await Promise.all([listItems({ includeDone: true, limit: 1500 }), config()]);
      return { items: await withUrls(items), sessions: [], config: cfg, now: Date.now() };
    }
    case 'agenda': {   // the meetings view: today + the next days (his calendars)
      const day = ilDay(), from = ilStart(day), n = Math.min(Math.max(+b.days || 8, 1), 31);
      return { ...(await agenda(from, new Date(from.getTime() + n * 86400e3), !!b.fresh)), day, now: Date.now() };
    }
    case 'add': return { item: await addItem(b.item || {}, 'שלומי') };
    case 'update': return { item: (await withUrls([await updateItem(b.id, b.item || {}, 'שלומי')]))[0] };
    case 'attach': return { item: (await withUrls([await attachImage(b.id, b, 'שלומי')]))[0] };
    case 'unattach': {   // he takes a picture off an item (the file goes too)
      const ref = ITEMS.doc(oneLine(b.id, 20)), it = (await ref.get()).data();
      if (!it) throw new Error('no item');
      const keep = (it.images || []).filter((m) => m.path !== b.path);
      if (keep.length !== (it.images || []).length) { await admin.storage().bucket(IMG_BUCKET).file(String(b.path)).delete().catch(() => {}); await ref.update({ images: keep, u: Date.now() }); }
      return { item: (await withUrls([{ id: ref.id, ...it, images: keep }]))[0] };
    }
    case 'delete': await ITEMS.doc(oneLine(b.id, 20)).delete(); return { ok: true };
    case 'config': {
      const c = {};
      if (Array.isArray(b.types)) c.types = b.types.map((t) => ({ id: oneLine(t.id, 24).replace(/[^\w-]/g, '') || newId(), name: oneLine(t.name, 30), color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#64748b', icon: oneLine(t.icon, 20) || 'dot' })).filter((t) => t.name).slice(0, 20);
      if (b.machines && typeof b.machines === 'object') c.machines = Object.fromEntries(Object.entries(b.machines).slice(0, 20).map(([k, v]) => [oneLine(k, 60), oneLine(v, 30)]));
      if (b.projects && typeof b.projects === 'object') c.projects = Object.fromEntries(Object.entries(b.projects).slice(0, 60).map(([k, v]) => [oneLine(k, 60), { color: /^#[0-9a-f]{6}$/i.test(v?.color) ? v.color : '#64748b', name: oneLine(v?.name, 40) }]));
      if (b.push && typeof b.push === 'object') c.push = Object.fromEntries(Object.keys(PUSH_KINDS).filter((k) => typeof b.push[k] === 'boolean').map((k) => [k, b.push[k]]));
      await META.doc('config').set(c, { merge: true });
      return { config: await config() };
    }
    case 'seen': {   // he opened / cleared these - they stop counting as new (until something new happens on them)
      const now = Date.now(), batch = db.batch();
      for (const id of (b.items || []).slice(0, 200)) batch.set(ITEMS.doc(oneLine(id, 20)), { seen: now }, { merge: true });
      await batch.commit();
      return { ok: true, seen: now };
    }
    case 'connect': return { key: await mindKey(true) };
    case 'push_on': {   // this phone / computer gets notifications
      const sub = b.sub || {};
      if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('subscription');
      await PUSH.doc(crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 32)).set({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, ua: oneLine(b.ua, 200), c: Date.now() });
      return { ok: true, devices: (await PUSH.count().get()).data().count };
    }
    case 'push_off': if (b.endpoint) await PUSH.doc(crypto.createHash('sha256').update(String(b.endpoint)).digest('hex').slice(0, 32)).delete(); return { ok: true };
    case 'push_test': {
      const on = { ...(await config()).push }, why = [];
      const sent = await pushMe(Object.keys(on).find((x) => on[x]) || 'ask', { title: 'PA', body: 'ככה תיראה התראה. לחיצה פותחת את האפליקציה.', url: '/mind/', tag: 'test' }, why);
      return { sent, why };
    }
    case 'organize': {   // what he said / typed -> anything on his table: new items, and changes to the ones he has
      // (done, update, a note, type, date, project, star, off the table). The AI sees his items and picks the actions.
      const said = clip(b.text, 6000);
      if (!said) throw new Error('text is empty');
      const cfg = await config();
      const all = (await ITEMS.orderBy('u', 'desc').limit(400).get()).docs.map(shapeItem);
      const known = [...new Set(all.map((i) => i.project).filter(Boolean))];
      const live = all.filter((i) => i.status !== 'done' && i.status !== 'parked').slice(0, 150);
      const gone = all.filter((i) => i.status === 'done' || i.status === 'parked').slice(0, 30);
      const focus = b.focus ? all.find((i) => i.id === oneLine(b.focus, 20)) : null;
      const line = (i) => `#${i.id} [${i.type}, ${i.status}${i.pin ? ', starred' : ''}${i.due ? ', due ' + i.due : ''}${i.project ? ', project ' + i.project : ''}] ${oneLine(i.text, 100)}${i.body ? ' - ' + oneLine(i.body, 120) : ''}`;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const schema = { type: 'object', additionalProperties: false, required: ['reply', 'actions'], properties: { reply: { type: 'string' }, actions: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['do', 'id', 'text', 'body', 'note', 'type', 'project', 'status', 'pin', 'due', 'today', 'nag'], properties: {
          today: { type: 'string', enum: ['', 'yes', 'no'] }, nag: { type: 'string' },
          do: { type: 'string', enum: ['add', 'update'] }, id: { type: 'string' },
          text: { type: 'string' }, body: { type: 'string' }, note: { type: 'string' },
          type: { type: 'string', enum: ['', ...cfg.types.map((t) => t.id)] }, project: { type: 'string' },
          status: { type: 'string', enum: ['', ...STATUSES] }, pin: { type: 'string', enum: ['', 'yes', 'no'] }, due: { type: 'string' } } } } } };
      const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: 'Bearer ' + OPENAI.value(), 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-6.1-terra', reasoning: { effort: 'none' }, max_output_tokens: 4000, store: false,
          text: { format: { type: 'json_schema', name: 'mind_actions', schema, strict: true } },
          instructions: `You run Shlomi's personal second brain from what he said or typed (often a voice note, Hebrew, maybe messy). He is a CTO of two companies and makes comedy videos; he works with many AI coding sessions.
He can tell you anything: new things to remember, or changes to things already on his table ("סיימתי את X", "תעביר את Y למחר", "תוסיף ל-Z ש...", "תמחק את", "זה כבר לא רלוונטי", "תסמן בכוכב", "תהפוך את זה לתזכורת"). Return the actions that do what he asked.
When what he says is about something already on his table (more details, a thought on it, news about it, "לגבי X", "עוד משהו על Y") - that is an UPDATE of that item (its new details go in body), never a new item next to it.
- do "add": a new item. One item per separate thing (split only when clearly unrelated). id "".
  text: a short clear title in his language, max ~70 chars, no "צריך ל" padding. body: everything else he said about it, cleaned up, nothing lost (names, numbers, links, why); "" if the title says it all.
  type: one of ${cfg.types.map((t) => `${t.id} (${t.name})`).join(', ')}. An idea = idea; something he must do = task; something he wants to be reminded of at a time ("תזכיר לי", "שלא אשכח") = reminder, with its due date; something running in the background = job; a reflection = thought; waiting for someone else = wait.
  project: one of his projects (${known.join(', ') || 'none yet'}) when it clearly belongs there, a new short name only if he names one, else "". status: "open"; "active" if he says it's being done now; "waiting" only if it waits for HIM to decide. pin "yes" only if he says it's important / urgent, else "".
- do "update": a change to an item below - id = its id without "#". Only when you are sure which item he means (by its title / project / what he describes); if unsure, add a new item instead and say so in reply. Fill ONLY what changes, "" = unchanged:
  text = a new title only if he renames it; body = new details he dictates for it (they are ADDED under the existing details); type; project ("-" = remove the project); status: done when he finished it / it happened, parked when he wants it off the table / deleted / not relevant any more (never delete), open to bring it back, active / waiting; pin yes / no; due YYYY-MM-DD ("none" = remove the date).
  note: always - one short line in his language saying what happened, e.g. "סיים - נשלח ללקוח", "נדחה למחר", "עודכן: דיברתי עם דני".
- due on add: YYYY-MM-DD if he gives a time ("מחר", "ביום ראשון", "עד סוף החודש"), else "". Today is ${today} (Israel).
- today (add and update): "yes" when he says it's for today ("היום אני צריך...", "להיום"), "no" when he takes it off today, else "".
- nag (add and update): you are also his PA - when he wants to be chased about something until it's done ("תזכיר לי", "תשאל אותי", "תציק לי", "תוודא שאני...") or it is a concrete errand he must get done today (buy something, call someone, send something), write the short friendly question his phone will ask him from time to time until he marks it done - in his language, about the thing itself: "קנית כבר אקמול?", "התקשרת לדני?", "שלחת את ההצעה ליוסי?". "off" when he says to stop asking about it. Else "".
- note on add: "".
- reply: one short line in his language. If he asked a question about his table ("מה פתוח לי?", "מה עם X?") answer it here from the list, briefly (a list = one thing per line, no numbers), and return no actions. Otherwise "" - the screen already shows what changed.${focus ? `\nHe is looking at item #${focus.id} right now - "this" / "זה" / "את זה" means it.` : ''}

His table now:
${live.map(line).join('\n') || '(empty)'}

Recently done / off the table:
${gone.map(line).join('\n') || '(none)'}`,
          input: [{ role: 'user', content: said }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || 'organize ' + r.status);
      const out = JSON.parse((j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('') || '{"actions":[]}');
      const acts = (out.actions || []).slice(0, 20), adds = acts.filter((a) => a.do === 'add'), items = [], changed = [];
      for (const a of acts) {
        if (a.do === 'add') {
          if (!oneLine(a.text, 300)) continue;
          items.push(await addItem({ text: a.text, body: a.body, type: a.type || 'idea', project: a.project === '-' ? '' : a.project, status: a.status || 'open',
            pin: a.pin === 'yes', due: a.due, today: a.today === 'yes', nag: a.nag === 'off' ? '' : a.nag, note: (adds.length > 1 ? 'מתוך: ' : 'נאמר: ') + said }, 'שלומי'));
          continue;
        }
        const cur = all.find((i) => i.id === oneLine(a.id, 20).replace(/^#/, ''));
        if (!cur) continue;
        const f = {}, before = {};
        if (oneLine(a.text, 300) && a.text !== cur.text) { f.text = a.text; before.text = cur.text; }
        if (clip(a.body, 8000)) { f.body = (cur.body ? cur.body.replace(/\s+$/, '') + '\n\n' : '') + a.body; before.body = cur.body || ''; }
        if (a.type && a.type !== cur.type) { f.type = a.type; before.type = cur.type; }
        if (a.project) { f.project = a.project === '-' ? '' : a.project; before.project = cur.project || ''; }
        if (a.status && a.status !== cur.status) { f.status = a.status; before.status = cur.status; }
        if (a.pin) { f.pin = a.pin === 'yes'; before.pin = !!cur.pin; }
        if (a.due) { f.due = a.due === 'none' ? '' : a.due; before.due = cur.due || ''; }
        if (a.today) { f.today = a.today === 'yes' ? ilDay() : ''; before.today = cur.today || ''; }
        if (a.nag) { f.nag = a.nag === 'off' ? '' : a.nag; before.nag = cur.nag || ''; }
        f.note = oneLine(a.note, 300) || 'עודכן';
        changed.push({ item: await updateItem(cur.id, f, 'שלומי'), before, note: f.note });
      }
      return { items, changed, reply: clip(out.reply, 1500) };
    }
    case 'transcribe': {   // the mic on his page: a recording -> Hebrew text (gpt-4o-transcribe)
      const buf = Buffer.from(String(b.audio || ''), 'base64');
      if (!buf.length || buf.length > 9e6) throw new Error('audio');
      const mime = oneLine(b.mime, 60) || 'audio/webm';
      const ext = /mp4|m4a|aac/.test(mime) ? 'mp4' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
      const form = new FormData();
      form.append('file', new Blob([buf], { type: mime.split(';')[0] }), 'voice.' + ext);
      form.append('model', 'gpt-4o-transcribe');
      form.append('language', 'he');
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: 'Bearer ' + OPENAI.value() }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || 'transcribe ' + r.status);
      // a silent recording can come back as a made-up line - the page also checks the level before it sends
      return { text: String(j.text || '').trim() };
    }
  }
  throw new Error('unknown op');
}

// for verse.js (the archive's requests reach him as Mind tasks, 2026-11-10)
exports._mind = { addItem, updateItem };
exports.mind = onRequest({ region: 'europe-west1', maxInstances: 3, memory: '256MiB', timeoutSeconds: 60, secrets: [OPENAI, VAPID_PRIVATE],
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/] }, async (req, res) => {
  res.set('cache-control', 'no-store');
  const door = req.path.replace(/\/+$/, '').split('/').pop();     // api | hook | mcp (through hosting: /mind/<door>)
  if (door === 'mcp' && req.method === 'GET') return res.status(405).set('allow', 'POST').end();
  if (req.method !== 'POST') return res.status(405).end();
  const role = await who(req);
  if (role === 'blocked') return res.status(429).json({ error: 'too_many' });
  if (!role) return res.status(401).json({ error: 'key' });
  try {
    if (door === 'hook') return res.json({ ok: true, off: 'session tracking is off since 2026-11-12' });
    if (door === 'mcp') {
      const body = req.body;
      if (Array.isArray(body)) { const out = (await Promise.all(body.map(mcp))).filter(Boolean); return out.length ? res.json(out) : res.status(202).end(); }
      const out = await mcp(body || {});
      return out ? res.json(out) : res.status(202).end();
    }
    if (door === 'api') {
      if (['connect', 'transcribe', 'organize', 'push_on', 'push_off', 'push_test'].includes(req.body?.op) && role !== 'owner') return res.status(403).json({ error: 'owner only' });
      return res.json(await pageOp(req.body || {}));
    }
    res.status(404).json({ error: 'door' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// the PA's clock: every 5 minutes - the day's meeting digests and the heads-up before each meeting (agendaTick)
exports.mindAgenda = onSchedule({ schedule: '*/5 * * * *', timeZone: 'Asia/Jerusalem', region: 'europe-west1', secrets: [VAPID_PRIVATE], memory: '256MiB', timeoutSeconds: 60 }, async () => {
  const r = await agendaTick();
  if (r.did?.length) console.log('mind agenda', JSON.stringify(r));
});
exports._agenda = { agenda, agendaTick, ilStart };   // for a local dry run

// every morning at 9: reminders and tasks whose day came (still open) -> one notification each (a few = one summary)
exports.mindDaily = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Jerusalem', region: 'europe-west1', secrets: [VAPID_PRIVATE], memory: '256MiB', timeoutSeconds: 60 }, async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const due = (await listItems({ limit: 1500 })).filter((i) => i.due && i.due <= today && ['reminder', 'task'].includes(i.type) && ['open', 'active', 'waiting'].includes(i.status));
  if (!due.length) return;
  if (due.length <= 3) for (const i of due) await pushMe('remind', { title: (i.type === 'reminder' ? 'תזכורת: ' : 'להיום: ') + i.text, body: i.body || (i.due < today ? 'היה ל-' + i.due : ''), url: '/mind/#' + i.id, tag: 'i:' + i.id });
  else await pushMe('remind', { title: `${due.length} דברים להיום`, body: due.slice(0, 5).map((i) => i.text).join(' · '), url: '/mind/', tag: 'daily' });
});
