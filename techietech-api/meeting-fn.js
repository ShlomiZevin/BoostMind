// ישיבת זום · טקי-טק - the live meeting (his ask 2026-11-20: the engine, meeting.js, as a real page of the app, /meeting). One HTTP
// function, verseMeeting; the page (v2/site/verse/meeting.js) reads its answer as an ndjson stream - the very events the engine
// emits (meeting.js round()).
//   {op:'peek'}            -> {ok, owner, booked}   - may this account hold a meeting now (the page asks before the picker)
//   {op:'start', room, title} -> stream: {t:'meeting', id, room}, {t:'visitor', name, title} (their name + the title they typed for
//                             this meeting - his ask 2026-11-21), then the first round (Amir opens). A title sent but empty after the
//                             visitor-line check below -> 400 {error:'title'}, before the day's meeting is taken; no title sent at
//                             all (an older page) -> the meeting starts with their name only
//   {op:'say', id, text}   -> stream: {t:'guest', text} (the visitor's line first, so the order is true), then a round answering it
//   {op:'nudge', id}       -> stream: {t:'silence'}, then a round - the floor was the visitor's and they said nothing for ~10 s (the
//                             page asks, once per silence, only while it is open and they typed nothing); the silence goes on the log
//                             and the room decides what to do with it. 409 when the meeting ended / wraps up, a round is running, or
//                             the last thing on the log is already a silence (a page that left never makes the server talk)
//   {op:'hand', id}        -> {ok} - the visitor is typing: a raised hand, the floor is theirs after the line in the air
//   {op:'share', id}       -> {url} - the owner shares THIS meeting: it becomes public (shared: true, kept a year) at /syncs/m/<id>
// GET /syncs/m/<id>          the shared meeting's own page (hosting sends it here): public/syncs/index.html with the meeting in #s-data
//                            and its WhatsApp preview in the <head> - 404 (the end of the verse) unless its owner shared it
// GET /syncs/m/<id>/og.jpg   that preview's picture (syncs-og.js: the wrap-up's title + the faces), drawn once, kept by the CDN
// Stateless across instances: the meeting lives in Firestore (meetings/<id>: uid, room, log, run, phrases, hand, ended, recap,
// cost, t, exp - 7 days, TTL) and is loaded / saved per request; the round reads the doc's `hand` before every next speaker.
// Owner only while MEETING_OPEN is false (anyone else: 404 - the page shows the end of the verse, nothing tells it exists).
// When it opens: a signed-in resident gets ONE meeting per Israel day (his call 2026-11-20; quota/meet_<uid>_<day>), the owner
// is never counted.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const meeting = require('./meeting');
const guard = require('./guard');
const ag = require('./ai-guard');   // the preview key's door, rounds per account / network / meeting, Syncs' money for the day (2026-11-22)

if (!admin.apps.length) admin.initializeApp();
const MEETING_OPEN = false;
const OPENAI = defineSecret('WIKI_OPENAI_KEY'), ANTHROPIC = defineSecret('VERSE_ANTHROPIC_KEY');
const KEEP_DAYS = 7, DAY_MEETINGS = 1;
// the preview key (his ask 2026-11-20: a Marketing session with no Google account uses the live tool while Syncs is closed): sent as the
// header x-syncs-key (the page takes it from /syncs?k=<key> into sessionStorage). Only its SHA-256 is here - the key is never in git.
// A preview meeting: the visitor is "צוות השיווק", it has its own day limit (6), everything else as the owner's meeting.
const PREVIEW_SHA = '262f279ea2099b04a6e5c725379effeaab694451ad1b9a2971638edea12b8358', PREVIEW_DAY = 6, PREVIEW_NAME = 'צוות השיווק';
// -> true (the preview key), false (none sent), 'locked' (this network - or, under attack, any new network - may not try now).
// Wrong keys are counted per network (5 a day = locked a day) and for the whole door (50 an hour) - ai-guard.js; a locked caller
// is refused before the key is compared, so guessing teaches nothing.
async function previewKey(req) {
  const k = String(req.get('x-syncs-key') || '');
  if (!k) return false;
  if (await ag.doorLocked('syncs', req)) return 'locked';
  const a = require('crypto').createHash('sha256').update(k.slice(0, 200)).digest(), b = Buffer.from(PREVIEW_SHA, 'hex');
  if (k.length <= 100 && require('crypto').timingSafeEqual(a, b)) { await ag.doorPassed('syncs', req); return true; }
  await ag.doorFailed('syncs', req, { perNet: 5, all: 50 });
  return false;
}
const dayLimit = (who) => (who.preview ? PREVIEW_DAY : DAY_MEETINGS);
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const db = () => admin.firestore();
const meetRef = (id) => db().collection('meetings').doc(id);
const dayRef = (uid) => db().collection('quota').doc(`meet_${uid}_${dayIL()}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// the one check a visitor's words go through here (their meeting lines - op 'say' - and their title at op 'start'): a string, trimmed,
// cut to its length; empty = refused. The title (his ask 2026-11-21: "you join a meeting, you must give a title") is one line in the
// prompts: no newlines, no double quotes (the Hebrew geresh ' stays - ג'וניור), at most 40 characters.
const said = (v, n) => guard.text(v, n, true);   // trimmed, no control / direction characters, cut to its length
const titleOf = (v) => said(String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/["“”„«»״`]/g, '').replace(/\s+/g, ' '), 40).trim();
// Syncs' AI spend (his ask 2026-11-20: its own line on Backstage → הוצאות and in the home's AI cost): one record per meeting, written
// with absolute values after every round (so it is counted once, whatever is retried), and kept after the meeting's own 7 days.
// costs.js reads it by the providers' day (UTC), verse.js stats by the Israel day. The meeting's day = the day it started.
const r4 = (v) => Math.round((v || 0) * 1e6) / 1e6;
async function ledger(ref, M, who) {
  const t = ((await ref.get()).data() || {}).t, at = t && t.toDate ? t.toDate() : new Date(), by = M.costBy || {};
  await db().collection('syncsCost').doc(ref.id).set({ t: Timestamp.fromDate(at), dUTC: at.toISOString().slice(0, 10), dIL: dayIL(at),
    usd: r4(M.cost), openai: r4(by.openai), anthropic: r4(by.anthropic), unsplit: r4(by.unsplit), owner: !!who.owner, preview: !!who.preview, ended: !!M.ended, at: Timestamp.now() });
}
// a visitor's meeting that just ended -> the analytics day's counter (the page itself never says it ended); his own meetings don't
// count, as his own devices don't (t.js)
const countEnded = (who) => (who.owner ? null : db().collection('analytics_days').doc(dayIL()).set({ d: dayIL(), n: { 'meeting|ended': FieldValue.increment(1) } }, { merge: true }));

// limits counted in Firestore across instances (guard.js): any request 300 an hour per network; the AI rounds (start / say / nudge)
// per account a day (a visitor 60, the preview 200, him 400), per network 300 a day, per meeting 40; and Syncs' money for the
// Israel day (DAY_USD - a meeting costs up to ~$0.5; his own meetings are not stopped by it)
const DAY_USD = 30;
const ROUNDS = (who) => (who.owner ? 400 : who.preview ? 200 : 60);
const booked = async (who) => !who.owner && (((await dayRef(who.uid).get()).data() || {}).n || 0) >= dayLimit(who);
// the day's meeting, taken in a transaction: false = already used today
const takeDay = (who) => (who.owner ? Promise.resolve(true) : db().runTransaction(async (tx) => {
  const ref = dayRef(who.uid), n = ((await tx.get(ref)).data() || {}).n || 0;
  if (n >= dayLimit(who)) return false;
  tx.set(ref, { n: n + 1, kind: 'meeting', exp: Timestamp.fromMillis(Date.now() + 3 * 864e5) }, { merge: true });
  return true;
}));
const giveBackDay = (who) => (who.owner ? null : dayRef(who.uid).delete().catch(() => {}));

// ---------- a shared meeting: its page and its picture (the link previews' pattern of page.js versePage) ----------
const SITE = 'https://shlomiverse.com';
const TEMPLATE = process.env.FUNCTIONS_EMULATOR === 'true' ? 'http://localhost:5050/syncs/index.html' : `${SITE}/syncs/index.html`;
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const one = (v, n) => { const t = String(v || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
let tpl = null;
async function template() {
  if (tpl && Date.now() - tpl.t < 60e3) return tpl.v;
  const r = await fetch(TEMPLATE, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error('template ' + r.status);
  tpl = { v: await r.text(), t: Date.now() };
  return tpl.v;
}
const NAMES = { amir: 'אמיר', ofer: 'עופר', daniel: 'דניאל', ronit: 'רונית', gilad: 'גלעד', yaniv: 'יניב' };
// what the page gets: the meeting, read-only - who was in it, the conversation, the wrap-up (never the owner's uid)
function publicOf(id, d) {
  const ended = d.ended ? meeting.ender(d.all || d.room || []) : null;
  return { id, room: d.all || d.room || [], log: (d.log || []).map((l) => (l.left ? { who: l.who, left: true } : l.silent ? { who: l.who, silent: true }
    : { who: l.who, text: l.text, cut: !!l.cut, ...(l.hand ? { hand: true } : {}) })),
    recap: d.recap || null, visitor: { name: (d.visitor || {}).name || '', title: (d.visitor || {}).title || '', photo: (d.visitor || {}).photo || '' },
    t: d.t && d.t.toDate ? d.t.toDate().toISOString() : null, ms: d.ms || (d.endedAt && d.t ? d.endedAt.toMillis() - d.t.toMillis() : 0), ender: ended };
}
async function sharedPage(req, res, id) {
  const snap = /^[A-Za-z0-9]{3,30}$/.test(id) ? await meetRef(id).get() : null;
  const d = snap && snap.exists ? snap.data() : null;
  let html = await template();
  if (d && d.shared) {
    const R = d.recap || {}, data = publicOf(id, d), url = `${SITE}/syncs/m/${id}`;
    const title = esc(one(R.title ? `${R.title} · סיכום ישיבה ב-Syncs` : 'סיכום ישיבה ב-Syncs', 90));
    const people = data.room.map((x) => NAMES[x] || x).join(', ');
    const desc = esc(one(R.summary || `ישיבה של טקי-טק עם ${people}`, 180));
    const img = `${SITE}/syncs/m/${id}/og.jpg?v=${d.sharedAt && d.sharedAt.toMillis ? d.sharedAt.toMillis() : 1}`;
    // replaced through functions: a "$'" or "$&" in the visitor's words stays text, never a replacement pattern
    const set = (re, tag) => { html = re.test(html) ? html.replace(re, () => tag) : html.replace('</head>', () => tag + '\n</head>'); };
    set(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    set(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}">`);
    set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}">`);
    set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${desc}">`);
    set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}">`);
    set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(img)}">`);
    set(/<meta property="og:image:width"[^>]*>/, '<meta property="og:image:width" content="1200">');
    set(/<meta property="og:image:height"[^>]*>/, '<meta property="og:image:height" content="630">');
    set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(img)}">`);
    html = html.replace('<script id="s-data" type="application/json">null</script>', () => `<script id="s-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
  }
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(d && d.shared ? 200 : 404).send(html);
}
async function sharedImage(req, res, id) {
  const snap = /^[A-Za-z0-9]{3,30}$/.test(id) ? await meetRef(id).get() : null;
  const d = snap && snap.exists ? snap.data() : null;
  if (!d || !d.shared) return res.status(404).send('');
  const jpg = await require('./syncs-og').drawShare(publicOf(id, d));
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=604800');
  res.set('Content-Type', 'image/jpeg');
  res.status(200).send(jpg);
}

exports.verseMeeting = onRequest({
  region: 'europe-west1',
  secrets: [OPENAI, ANTHROPIC],
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/],
  maxInstances: 3,
  concurrency: 20,
  memory: '512MiB',
  timeoutSeconds: 300,
}, async (req, res) => {
  if (req.method === 'GET') {   // a shared meeting's page / picture (public, read-only)
    const [, a, b, id, file] = req.path.split('/');
    if (a !== 'syncs' || b !== 'm' || !id) return res.status(404).send('');
    try { return file === 'og.jpg' ? await sharedImage(req, res, id) : await sharedPage(req, res, id); }
    catch (e) { console.error('verseMeeting shared', req.path, e.message); if (!res.headersSent) res.status(500).send(''); return; }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (await ag.gate([[`meet:net:${guard.ip(req)}`, 300, guard.HOUR]])) return res.status(429).json({ error: 'too_many' });
  const pk = await previewKey(req);
  if (pk === 'locked') return res.status(429).json({ error: 'too_many' });
  const who = pk === true ? { uid: 'preview', owner: false, preview: true } : await require('./wiki')._whoAsks(req);
  // closed: only the owner - anyone else gets what an address that isn't there gets
  if (!who.uid || (!MEETING_OPEN && !who.owner && !who.preview)) return res.status(404).json({});
  const b = req.body || {};

  if (b.op === 'peek') return res.json({ ok: true, owner: who.owner, preview: !!who.preview, more: who.owner || !!who.preview, booked: await booked(who), ...(who.preview ? { name: PREVIEW_NAME } : {}) });

  if (b.op === 'hand') {
    const ref = meetRef(String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30));
    const d = (await ref.get()).data();
    if (!d || d.uid !== who.uid) return res.status(404).json({});
    if (!d.ended) await ref.update({ hand: true });
    return res.json({ ok: true });
  }
  if (b.op === 'share') {   // the owner shares this meeting: public at /syncs/m/<id>, kept a year (the visitor's face goes with it)
    const ref = meetRef(String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30));
    const d = (await ref.get()).data();
    if (!d || d.uid !== who.uid) return res.status(404).json({});
    if (!d.shared) {
      const photo = await db().collection('fans').doc(who.uid).get().then((g) => String((g.data() || {}).photo || '')).catch(() => '');
      await ref.update({ shared: true, sharedAt: Timestamp.now(), exp: Timestamp.fromMillis(Date.now() + 365 * 864e5), 'visitor.photo': photo });
    }
    return res.json({ ok: true, url: `${SITE}/syncs/m/${ref.id}` });
  }
  if (b.op !== 'start' && b.op !== 'say' && b.op !== 'nudge') return res.status(400).json({ error: 'op' });
  // every one of these runs a round of AI calls
  const mid = b.op === 'start' ? '' : String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30);
  if (await ag.gate([[`meet:round:${who.uid}`, ROUNDS(who), guard.DAY], [`meet:rnet:${guard.ip(req)}`, 300, guard.DAY], ...(mid ? [[`meet:m:${mid}`, 40, guard.DAY]] : [])])) return res.status(429).json({ error: 'too_many' });
  if (!who.owner && await ag.overBudget('meet', DAY_USD)) { console.error('verseMeeting: the day\'s money ceiling reached'); return res.status(429).json({ error: 'too_many' }); }

  const cur = await require('./wiki')._canon();
  const keys = { cur, key: OPENAI.value(), akey: ANTHROPIC.value() || null };
  let ref, M, guest = null;
  if (b.op === 'nudge') {   // the visitor's silence: the guards and the round's claim in one transaction (two nudges never both run)
    ref = meetRef(String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30));
    const d = await db().runTransaction(async (tx) => {
      const x = (await tx.get(ref)).data();
      if (!x || x.uid !== who.uid) return { no: 404 };
      if (x.ended || (x.busy && Date.now() - x.busy.toMillis() < 240e3) || !(x.log || []).length || meeting.silentLast(x.log)) return { no: 409 };
      tx.update(ref, { busy: Timestamp.now() });
      return x;
    });
    if (d.no) return res.status(d.no).json({ error: d.no === 409 ? 'not_now' : undefined });
    M = meeting.fromState(d, keys);
    meeting.guestSilent(M);
    await ref.update({ hand: false, log: M.log, run: M.run });
  } else if (b.op === 'start') {
    const room = (Array.isArray(b.room) ? b.room : []).filter((id) => meeting.TEAM.includes(id));
    // a page that sends a title must send a real one; an older page sends none - that meeting starts without one (nothing invented)
    const title = titleOf(b.title);
    if (b.title != null && !title) return res.status(400).json({ error: 'title' });
    if (!(await takeDay(who))) return res.status(429).json({ error: 'booked' });
    ref = db().collection('meetings').doc();
    // the visitor's Shlomiverse name (their fans record) - the team calls them by it, with the title they gave themselves
    const nick = who.preview ? PREVIEW_NAME : await db().collection('fans').doc(who.uid).get().then((g) => String((g.data() || {}).nick || '')).catch(() => '');
    // what the residents know about this person - the chat's own note (wiki.js visitorLine), its facts part (the meeting has its own scene)
    const note = who.preview ? '' : await require('./wiki')._visitorLine(who).then((t) => (String(t || '').split('What you know about them:')[1] || '').trim()).catch(() => '');
    M = meeting.newMeeting({ ...keys, room, visitor: { name: nick, title }, visitorNote: note });
    await ref.set({ uid: who.uid, t: Timestamp.now(), exp: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5), busy: Timestamp.now(), ...meeting.stateOf(M) });
  } else {
    ref = meetRef(String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30));
    let d = (await ref.get()).data();
    if (!d || d.uid !== who.uid) return res.status(404).json({});
    // a round still running (the page waits for its stream to end; this is the guard): wait for it, up to a minute and a half
    for (let i = 0; d.busy && Date.now() - d.busy.toMillis() < 240e3 && i < 150; i++) { await wait(600); d = (await ref.get()).data(); }
    if (d.ended) return res.status(409).json({ error: 'ended' });
    guest = said(b.text, 600);
    if (!guest) return res.status(400).json({ error: 'text' });
    M = meeting.fromState(d, keys);
    meeting.guestSays(M, guest, { hand: b.hand === true });
    await ref.update({ busy: Timestamp.now(), hand: false, log: M.log, run: M.run });
  }

  res.set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  const out = (e) => { try { res.write(JSON.stringify(e) + '\n'); } catch (x) { /* the page went away - the round still finishes and is saved */ } };
  if (b.op === 'start') out({ t: 'meeting', id: ref.id, room: M.room });
  else if (b.op === 'nudge') out({ t: 'silence' });
  else out({ t: 'guest', text: guest });
  const before = M.cost, t0 = Date.now(), wasEnded = !!M.ended;
  let lines = 0;
  const emit = (e) => { if (e.t === 'line') lines++; out(e); };
  // the guest's hand: read from the doc before every next speaker (the hand op sets it from another request / instance)
  const hand = async () => ((await ref.get()).data() || {}).hand === true;
  try {
    await meeting.round(M, emit, { hand });
  } catch (e) {
    console.error('verseMeeting round failed', ref.id, e.message);
    out({ t: 'error' });
    out({ t: 'floor' });
    if (b.op === 'start' && !lines) await giveBackDay(who);   // nothing was said: the day's meeting isn't spent
  }
  await ref.update({ ...meeting.stateOf(M), busy: null, ...(M.ended ? { endedAt: Timestamp.now(), ms: Date.now() - ((await ref.get()).data()?.t?.toMillis() || Date.now()) } : {}) }).catch((e) => console.error('verseMeeting save failed', ref.id, e.message));
  ag.spend('meet', M.cost - before);
  await ledger(ref, M, who).catch((e) => console.error('verseMeeting ledger failed', ref.id, e.message));
  if (M.ended && !wasEnded) await Promise.resolve(countEnded(who)).catch((e) => console.error('verseMeeting ended count failed', e.message));
  console.log('verseMeeting round', ref.id, b.op, `${lines} lines`, `${((Date.now() - t0) / 1000).toFixed(1)}s`, `$${(M.cost - before).toFixed(4)} (meeting $${M.cost.toFixed(4)})`, M.ended ? 'ENDED' : '');
  res.end();
});
