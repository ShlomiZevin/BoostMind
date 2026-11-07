// "ספרו לנו עליכם" - one profile per person (his ask, 2026-11-07: "it's like filling a form once - the user's own profile -
// this is what we aim for"; plan cz-sim-r2 part 4, approved with his notes). Miriam (check-in), Demokratovich (the booth) and
// Yotam (the simulation test) are the form in costume: each field is saved once, each of them asks only what is still missing,
// a skipped field stays empty and is never asked again, and a tourist's simulation answers move in when they become residents.
// The record: about/<uid> = { <field>: { v, by, t, raw? } }; a skip = { v: null, by, t }. Written only here (the server).
// The person sees and changes it on their "אני" page ("מה סיפרתם לנו" - his yes, 2026-11-07); he sees it in Backstage.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

// the fields, why each one is there (the plan's goals), and its answers (values stay fixed so they can be counted)
const FIELDS = {
  fav: { goal: 'mine', label: 'הדמויות שבאתם לבקר', kind: 'chars', max: 3 },
  source: { goal: 'invest', label: 'מאיפה הגעתם', kind: 'pick', opts: { tiktok: 'טיקטוק', instagram: 'אינסטגרם', youtube: 'יוטיוב', friend: 'חבר שלח לי', other: 'משהו אחר' } },
  first: { goal: 'invest', label: 'מה עושים פה קודם', kind: 'pick', opts: { videos: 'סרטונים', chat: 'לדבר עם דמות', games: 'משחקים', stickers: 'סטיקרים' } },
  wish: { goal: 'invest', label: 'מה הייתם רוצים לעשות כאן', kind: 'text', max: 200 },
  bday: { goal: 'return', label: 'יום הולדת', kind: 'date' },
  push: { goal: 'return', label: 'התראות', kind: 'pick', opts: { yes: 'מסכימים', no: 'לא עכשיו' } },
  stage: { goal: 'audience', label: 'שלב בחיים', kind: 'pick', opts: { school: 'בית ספר', army: 'צבא או שירות', student: 'לימודים', work: 'עבודה', parent: 'הורים', retired: 'פנסיה' } },
  world: { goal: 'mine', label: 'העולם שמצחיק אתכם', kind: 'series' },
  channel: { goal: 'return', label: 'איך לספר לכם על משהו חדש', kind: 'pick', opts: { push: 'התראה', mail: 'מייל', friend: 'שחבר יספר', none: 'לא לספר' } },
};
const BY = ['miriam', 'demokratovich', 'yotam', 'me', 'sim'];
const clip = (s, n) => String(s ?? '').slice(0, n);

// a value as the field allows it, or undefined when it isn't one (null = skipped on purpose)
function clean(k, v, ids = null) {
  const f = FIELDS[k];
  if (!f) return undefined;
  if (v === null) return null;
  if (f.kind === 'pick') return Object.prototype.hasOwnProperty.call(f.opts, v) ? v : undefined;
  if (f.kind === 'text') { const s = clip(String(v || '').trim(), f.max); return s || undefined; }
  if (f.kind === 'chars' || f.kind === 'series') {
    const list = (Array.isArray(v) ? v : [v]).map((x) => String(x || '')).filter((x) => /^[\w-]{1,40}$/.test(x) && (!ids || ids.has(x)));
    const u = [...new Set(list)].slice(0, f.kind === 'chars' ? f.max : 1);
    return u.length ? (f.kind === 'series' ? u[0] : u) : undefined;
  }
  if (f.kind === 'date') {
    const d = Number(v && v.d), m = Number(v && v.m), y = v && v.y ? Number(v.y) : null;
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return undefined;
    return { d, m, ...(y && y >= 1900 && y <= new Date().getFullYear() ? { y } : {}) };
  }
  return undefined;
}

const ref = (uid) => db().collection('about').doc(uid);
async function get(uid) { if (!uid) return {}; const g = await ref(uid).get(); return g.exists ? g.data() : {}; }
// which of these fields this person was never asked (answered or skipped both count as asked)
const missing = (about, keys) => keys.filter((k) => !about || !about[k]);

// save answers: { field: value }. `force` (the person editing their own page) overwrites; anyone else only fills what is empty
async function save(uid, patch, by, { force = false, raw = {}, ids = null } = {}) {
  if (!uid || !BY.includes(by)) return {};
  const now = Date.now();
  return db().runTransaction(async (tx) => {
    const g = await tx.get(ref(uid)), cur = g.exists ? g.data() : {}, out = {};
    for (const [k, v] of Object.entries(patch || {})) {
      const c = clean(k, v, ids);
      if (c === undefined || (!force && cur[k])) continue;
      out[k] = { v: c, by, t: now, ...(raw[k] ? { raw: clip(raw[k], 200) } : {}) };
    }
    if (Object.keys(out).length) tx.set(ref(uid), { ...out, updated: FieldValue.serverTimestamp() }, { merge: true });
    return out;
  });
}

// what the page shows: the fields with their labels and the person's answers (never the raw text of someone else)
const view = (about) => Object.fromEntries(Object.keys(FIELDS).map((k) => [k, about && about[k] ? { v: about[k].v, by: about[k].by, t: about[k].t } : null]));

// Backstage "מה למדנו" (verseOwner op aboutStats): counts per field and value, birthdays this week, everyone's answers
async function stats() {
  const snap = await db().collection('about').get();
  const count = {}, people = [], week = [];
  const today = new Date(Date.now() + 2 * 3600e3);
  const soon = new Set([...Array(7)].map((_, i) => { const d = new Date(today.getTime() + i * 864e5); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; }));
  for (const x of snap.docs) {
    const a = x.data();
    for (const k of Object.keys(FIELDS)) {
      if (!a[k]) continue;
      count[k] = count[k] || { asked: 0, skipped: 0, v: {} };
      count[k].asked++;
      if (a[k].v === null) { count[k].skipped++; continue; }
      const vals = FIELDS[k].kind === 'chars' ? a[k].v : FIELDS[k].kind === 'text' || FIELDS[k].kind === 'date' ? [] : [a[k].v];
      for (const v of vals) count[k].v[v] = (count[k].v[v] || 0) + 1;
    }
    if (a.bday && a.bday.v && soon.has(`${a.bday.v.d}/${a.bday.v.m}`)) week.push({ uid: x.id, bday: a.bday.v });
    people.push({ uid: x.id, t: a.updated?.toMillis?.() || 0, ...view(a), wish: a.wish ? a.wish.v : null });
  }
  people.sort((p, q) => q.t - p.t);
  const fans = people.length ? await db().getAll(...people.slice(0, 300).map((p) => db().collection('fans').doc(p.uid))) : [];
  fans.forEach((f, i) => { people[i].nick = (f.exists && f.data().nick) || ''; });
  const nick = Object.fromEntries(people.map((p) => [p.uid, p.nick]));
  return { fields: FIELDS, people: snap.size, count, week: week.map((w) => ({ ...w, nick: nick[w.uid] || '' })), recent: people.slice(0, 300) };
}

module.exports = { FIELDS, clean, get, save, missing, view, stats };
