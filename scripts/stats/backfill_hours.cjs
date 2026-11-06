// One time (2026-11-06): the per-hour counters (analytics_days.h, which analytics.js keeps since this day) rebuilt for the
// days before them from the raw events (analytics_events, kept 90 days) - so the forecast (techietech-api/forecast.js)
// has every day since tracking began to learn from.
//   node scripts/stats/backfill_hours.cjs --before <ISO time the new track went live> [--dry]
// Days before that time's day get their hours set; that day gets the events before the time ADDED (the live track counts
// the rest). Visitors: a browser's first event of the day; new visitors: a browser's first event ever.
const admin = require('../../techietech-api/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const argv = process.argv.slice(2), dry = argv.includes('--dry');
const before = Date.parse(argv[argv.indexOf('--before') + 1] || '');
if (!before) { console.error('--before <ISO time> is required'); process.exit(1); }
const dayIL = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const hourIL = (d) => String(+new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(d));

(async () => {
  const snap = await db.collection('analytics_events').where('t', '<', admin.firestore.Timestamp.fromMillis(before)).orderBy('t').select('t', 'e', 'v').get();
  const H = {}, seenDay = new Set(), seenEver = new Set();
  const bump = (d, k, h) => { ((H[d] ||= {})[k] ||= {})[h] = (H[d][k][h] || 0) + 1; };
  for (const doc of snap.docs) {
    const { t, e, v } = doc.data(), at = t.toDate(), d = dayIL(at), h = hourIL(at);
    if (e !== 'time') bump(d, e, h);
    if (v && !seenDay.has(d + v)) { seenDay.add(d + v); bump(d, 'visitors', h); }
    if (v && !seenEver.has(v)) { seenEver.add(v); bump(d, 'new_visitors', h); }
  }
  const cut = dayIL(new Date(before));
  const days = Object.fromEntries((await db.collection('analytics_days').get()).docs.map((x) => [x.id, x.data()]));
  console.log(`${snap.size} events, ${Object.keys(H).length} days; the day of the switch (${cut}) gets its early hours added`);
  for (const [d, m] of Object.entries(H).sort()) {
    const sum = (k) => Object.values(m[k] || {}).reduce((a, b) => a + b, 0);
    console.log(`  ${d}  visitors ${sum('visitors')} (counted ${days[d]?.visitors || 0})  views ${sum('view')} (counted ${days[d]?.n?.view || 0})  chat ${sum('chat_message')} (${days[d]?.n?.chat_message || 0})`);
    if (dry) continue;
    const h = d === cut
      ? Object.fromEntries(Object.entries(m).map(([k, hs]) => [k, Object.fromEntries(Object.entries(hs).map(([hr, n]) => [hr, FieldValue.increment(n)]))]))
      : m;
    await db.collection('analytics_days').doc(d).set({ d, h }, { merge: true });
  }
  console.log(dry ? 'DRY - nothing written' : 'done');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
