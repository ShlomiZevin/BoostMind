// ישיבת זום · טקי-טק - the live meeting (his ask 2026-11-20: the engine, meeting.js, as a real page of the app, /meeting). One HTTP
// function, verseMeeting; the page (v2/site/verse/meeting.js) reads its answer as an ndjson stream - the very events the engine
// emits (meeting.js round()).
//   {op:'peek'}            -> {ok, owner, booked}   - may this account hold a meeting now (the page asks before the picker)
//   {op:'start', room}     -> stream: {t:'meeting', id, room}, {t:'visitor', name, title} (their name + the title the meeting gives them),
//                             then the first round (Amir opens)
//   {op:'say', id, text}   -> stream: {t:'guest', text} (the visitor's line first, so the order is true), then a round answering it
//   {op:'hand', id}        -> {ok} - the guest is typing: a raised hand, the floor is theirs after the line in the air
// Stateless across instances: the meeting lives in Firestore (meetings/<id>: uid, room, log, run, phrases, hand, ended, recap,
// cost, t, exp - 7 days, TTL) and is loaded / saved per request; the round reads the doc's `hand` before every next speaker.
// Owner only while MEETING_OPEN is false (anyone else: 404 - the page shows the end of the verse, nothing tells it exists).
// When it opens: a signed-in resident gets ONE meeting per Israel day (his call 2026-11-20; quota/meet_<uid>_<day>), the owner
// is never counted.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const meeting = require('./meeting');

if (!admin.apps.length) admin.initializeApp();
const MEETING_OPEN = false;
const OPENAI = defineSecret('WIKI_OPENAI_KEY'), ANTHROPIC = defineSecret('VERSE_ANTHROPIC_KEY');
const KEEP_DAYS = 7, DAY_MEETINGS = 1;
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const db = () => admin.firestore();
const meetRef = (id) => db().collection('meetings').doc(id);
const dayRef = (uid) => db().collection('quota').doc(`meet_${uid}_${dayIL()}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// a few dozen requests per address per hour, per instance
const recent = new Map();
const tooMany = (ip) => {
  const now = Date.now(), list = (recent.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now); recent.set(ip, list);
  return list.length > 120;
};
const booked = async (who) => !who.owner && (((await dayRef(who.uid).get()).data() || {}).n || 0) >= DAY_MEETINGS;
// the day's meeting, taken in a transaction: false = already used today
const takeDay = (who) => (who.owner ? Promise.resolve(true) : db().runTransaction(async (tx) => {
  const ref = dayRef(who.uid), n = ((await tx.get(ref)).data() || {}).n || 0;
  if (n >= DAY_MEETINGS) return false;
  tx.set(ref, { n: n + 1, kind: 'meeting', exp: Timestamp.fromMillis(Date.now() + 3 * 864e5) }, { merge: true });
  return true;
}));
const giveBackDay = (who) => (who.owner ? null : dayRef(who.uid).delete().catch(() => {}));

exports.verseMeeting = onRequest({
  region: 'europe-west1',
  secrets: [OPENAI, ANTHROPIC],
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/],
  maxInstances: 3,
  concurrency: 20,
  memory: '512MiB',
  timeoutSeconds: 300,
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (tooMany(req.ip)) return res.status(429).json({ error: 'too_many' });
  const who = await require('./wiki')._whoAsks(req);
  // closed: only the owner - anyone else gets what an address that isn't there gets
  if (!who.uid || (!MEETING_OPEN && !who.owner)) return res.status(404).json({});
  const b = req.body || {};

  if (b.op === 'peek') return res.json({ ok: true, owner: who.owner, booked: await booked(who) });

  if (b.op === 'hand') {
    const ref = meetRef(String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30));
    const d = (await ref.get()).data();
    if (!d || d.uid !== who.uid) return res.status(404).json({});
    if (!d.ended) await ref.update({ hand: true });
    return res.json({ ok: true });
  }
  if (b.op !== 'start' && b.op !== 'say') return res.status(400).json({ error: 'op' });

  const cur = await require('./wiki')._canon();
  const keys = { cur, key: OPENAI.value(), akey: ANTHROPIC.value() || null };
  let ref, M, guest = null;
  if (b.op === 'start') {
    const room = (Array.isArray(b.room) ? b.room : []).filter((id) => meeting.TEAM.includes(id));
    if (!(await takeDay(who))) return res.status(429).json({ error: 'booked' });
    ref = db().collection('meetings').doc();
    // the visitor's Shlomiverse name (their fans record) - the team calls them by it, with the title the meeting gives them
    const nick = await db().collection('fans').doc(who.uid).get().then((g) => String((g.data() || {}).nick || '')).catch(() => '');
    M = meeting.newMeeting({ ...keys, room, visitor: { name: nick } });
    await ref.set({ uid: who.uid, t: Timestamp.now(), exp: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5), busy: Timestamp.now(), ...meeting.stateOf(M) });
  } else {
    ref = meetRef(String(b.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30));
    let d = (await ref.get()).data();
    if (!d || d.uid !== who.uid) return res.status(404).json({});
    // a round still running (the page waits for its stream to end; this is the guard): wait for it, up to a minute and a half
    for (let i = 0; d.busy && Date.now() - d.busy.toMillis() < 240e3 && i < 150; i++) { await wait(600); d = (await ref.get()).data(); }
    if (d.ended) return res.status(409).json({ error: 'ended' });
    guest = String(b.text || '').trim().slice(0, 600);
    if (!guest) return res.status(400).json({ error: 'text' });
    M = meeting.fromState(d, keys);
    meeting.guestSays(M, guest);
    await ref.update({ busy: Timestamp.now(), hand: false, log: M.log, run: M.run });
  }

  res.set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  const out = (e) => { try { res.write(JSON.stringify(e) + '\n'); } catch (x) { /* the page went away - the round still finishes and is saved */ } };
  if (b.op === 'start') out({ t: 'meeting', id: ref.id, room: M.room });
  else out({ t: 'guest', text: guest });
  const before = M.cost, t0 = Date.now();
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
  await ref.update({ ...meeting.stateOf(M), busy: null, ...(M.ended ? { endedAt: Timestamp.now() } : {}) }).catch((e) => console.error('verseMeeting save failed', ref.id, e.message));
  console.log('verseMeeting round', ref.id, b.op, `${lines} lines`, `${((Date.now() - t0) / 1000).toFixed(1)}s`, `$${(M.cost - before).toFixed(4)} (meeting $${M.cost.toFixed(4)})`, M.ended ? 'ENDED' : '');
  res.end();
});
