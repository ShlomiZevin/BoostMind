// ai-guard.js - the protection of the AI and key doors (2026-11-22, after the scripted probe of 22.11: "protect everything").
// Built on guard.js (limits counted in Firestore across instances); used by wiki.js, sim.js, meeting-fn.js, garden.js, piko.js,
// tz.js, mcp.js and mind.js.
//
//   net(req)                    the caller's network = guard.ip (the address Google saw - never what the caller wrote
//                               in X-Forwarded-For; IPv6 by /64)
//   gate([[key, n, ms], ...])   guard.limit for each rule in order -> null = go ahead, else the area of the first rule that refused
//   overBudget(area, usd)       has this feature spent its money for the Israel day? (a ceiling a script can't run past)
//   spend(area, usd)            count what a call really cost toward that ceiling
//   doorLocked / doorFailed / doorPassed   a door with a key: wrong keys are counted per network AND for the whole door; a
//                               locked network - or, while the whole door is under attack, any network that never got in before -
//                               is refused BEFORE the key is compared, so a guesser learns nothing even with the right key
//   same(a, b)                  constant-time comparison of two secrets (any lengths)
const crypto = require('crypto');
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const guard = require('./guard');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const { MIN, HOUR, DAY } = guard;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);

// ---------------------------------------------------------------- the caller's address ----------------------------------------------------------------
// One truth: guard.ip (the last x-forwarded-for entry that isn't Hosting's proxy hop - a written header changes nothing; IPv6 by /64)
const chain = (req) => String((req.get && req.get('x-forwarded-for')) || '').split(',').map((s) => s.trim()).filter(Boolean);
const net = (req) => guard.ip(req);
// a wider net for "has this network got in before": IPv4 /24, IPv6 /64
const wide = (req) => { const n = net(req); return /^\d+\.\d+\.\d+\.\d+$/.test(n) ? n.split('.').slice(0, 3).join('.') + '.0/24' : n; };

// ---------------------------------------------------------------- rate rules ----------------------------------------------------------------
async function gate(rules) {
  for (const [key, n, ms] of rules) if (await guard.limit(key, n, ms)) return String(key).split(':').slice(0, 2).join(':');
  return null;
}

// ---------------------------------------------------------------- a feature's money for the day ----------------------------------------------------------------
// guard/usd_<area>_<Israel day>: {usd} - what the feature's calls cost today (each call adds its real cost). Read at most every
// 20 s per instance, so a burst can pass the ceiling by a few calls, never by a bill.
const spentMem = new Map();
const usdRef = (area, d = dayIL()) => db().collection('guard').doc(`usd_${area}_${d}`);
async function spent(area) {
  const d = dayIL(), k = area + d, m = spentMem.get(k);
  if (m && Date.now() - m.at < 20e3) return m.usd;
  try {
    const usd = ((await usdRef(area, d).get()).data() || {}).usd || 0;
    spentMem.set(k, { usd: Math.max(usd, (m && m.usd) || 0), at: Date.now() });
    return usd;
  } catch (e) { console.error('ai-guard spent', area, e.message); return (m && m.usd) || 0; }
}
const overBudget = async (area, cap) => (await spent(area)) >= cap;
function spend(area, usd) {
  usd = Number(usd);
  if (!(usd > 0) || usd > 50) return Promise.resolve();
  const d = dayIL(), k = area + d, m = spentMem.get(k);
  if (m) m.usd += usd;
  return usdRef(area, d).set({ usd: FieldValue.increment(Math.round(usd * 1e6) / 1e6), area, d, exp: Timestamp.fromMillis(Date.now() + 3 * DAY) }, { merge: true })
    .catch((e) => console.error('ai-guard spend', area, e.message));
}

// ---------------------------------------------------------------- doors with a key ----------------------------------------------------------------
const lockMem = new Map();    // door|net -> until (this instance; Firestore is the truth)
const knownMem = new Map();   // door|wide -> time we last wrote it
const doorRef = (id) => db().collection('guard').doc('door_' + sha(id).slice(0, 40));
const knownRef = (id) => db().collection('guard').doc('known_' + sha(id).slice(0, 40));
// -> null (compare the key) | 'net' (this network failed too often) | 'all' (the whole door is under attack and this network never got in)
async function doorLocked(door, req) {
  const n = net(req), now = Date.now();
  if ((lockMem.get(door + '|' + n) || 0) > now) return 'net';
  try {
    const [a, all] = await Promise.all([doorRef(door + '|' + n).get(), doorRef(door + '|*').get()]);
    const until = (a.data() || {}).until || 0;
    if (until > now) { lockMem.set(door + '|' + n, until); return 'net'; }
    if (((all.data() || {}).until || 0) > now) {
      const k = await knownRef(door + '|' + wide(req)).get();
      if (!(k.exists && ms(k.data().exp) > now)) return 'all';
    }
  } catch (e) { console.error('ai-guard doorLocked (open)', door, e.message); }
  return null;
}
const ms = (t) => (t && t.toMillis ? t.toMillis() : Number(t) || 0);
// a wrong key: perNet within netMs locks that network for netLock; all within allMs locks the door for everyone new for allLock
async function doorFailed(door, req, { perNet = 10, netMs = DAY, netLock = DAY, all = 100, allMs = HOUR, allLock = HOUR } = {}) {
  const n = net(req), now = Date.now();
  const bump = (id, max, win, lock) => db().runTransaction(async (tx) => {
    const ref = doorRef(id), d = (await tx.get(ref)).data() || {};
    const t = (d.t || []).filter((x) => now - x < win);
    t.push(now);
    const until = t.length >= max ? now + lock : d.until || 0;
    tx.set(ref, { t: t.slice(-max), until, door, exp: Timestamp.fromMillis(Math.max(until, now + win) + HOUR) });
    return until > now;
  });
  try {
    const [netLocked, allLocked] = await Promise.all([bump(door + '|' + n, perNet, netMs, netLock), bump(door + '|*', all, allMs, allLock)]);
    if (netLocked) lockMem.set(door + '|' + n, now + netLock);
    if (netLocked || allLocked) console.warn('ai-guard door locked', door, netLocked ? 'net ' + n : '', allLocked ? 'ALL' : '', 'chain', chain(req).length);
  } catch (e) { console.error('ai-guard doorFailed', door, e.message); }
}
// the right key: this network is known for 30 days (it still gets in while the door is under attack)
function doorPassed(door, req) {
  const id = door + '|' + wide(req), at = knownMem.get(id) || 0;
  if (Date.now() - at < 6 * HOUR) return Promise.resolve();
  knownMem.set(id, Date.now());
  return knownRef(id).set({ door, exp: Timestamp.fromMillis(Date.now() + 30 * DAY) }).catch((e) => console.error('ai-guard doorPassed', door, e.message));
}

// two secrets, compared in constant time whatever their lengths
const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest())
  && String(a).length === String(b).length;

// a Firestore document id from a visitor: only letters, digits, - and _ (no "/" - a path - and no ".." ), at most max; '' = refuse
const docId = (v, max = 40) => { const s = String(v ?? ''); return /^[A-Za-z0-9_-]+$/.test(s) && s.length <= max ? s : ''; };

module.exports = { net, chain, gate, overBudget, spend, spent, doorLocked, doorFailed, doorPassed, same, docId, dayIL, MIN, HOUR, DAY };
