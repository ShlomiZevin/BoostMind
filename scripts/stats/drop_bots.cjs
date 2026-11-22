// Take scripted / bot browsers out of one day's analytics - exactly what track (techietech-api/analytics.js) added for them:
// the day's counters (n, h, site, visitors, new visitors, src, dev, the time-on-site buckets and totals) go down by their part,
// and their raw events move from analytics_events to analytics_bots (kept, same 90-day exp - nothing is lost, it can be put back).
//   node scripts/stats/drop_bots.cjs --day 2026-11-22 --v id1,id2,...          shows what would change
//   node scripts/stats/drop_bots.cjs --day 2026-11-22 --v id1,id2,... --apply  does it
// The browser ids (v) come from looking at the day's raw events (a burst of fresh browsers doing the same thing, one browser
// opening every route in new tabs...). Since 2026-11-22 t.js never sends from a scripted browser (navigator.webdriver), so this
// is for what slips past that. First case: 2026-11-22, the sessions' phone checks (23 browsers).
const admin = require('../../techietech-api/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : ''; };
const day = arg('--day'), V = new Set(arg('--v').split(',').map((s) => s.trim()).filter(Boolean)), apply = argv.includes('--apply');
if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !V.size) { console.error('usage: --day YYYY-MM-DD --v id1,id2 [--apply]'); process.exit(1); }

// the same helpers as analytics.js
const clean = (v, n) => String(v ?? '').replace(/[^\p{L}\p{N} _\-./:]/gu, '').trim().slice(0, n);
const key = (v) => clean(v, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '_';
const hourIL = (d) => String(+new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(d));
const TIME_EDGES = [5, 10, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2700, 3600];
const timeBucket = (s) => { const i = TIME_EDGES.findIndex((e) => s <= e); return i < 0 ? TIME_EDGES.length : i; };

(async () => {
  const docs = (await db.collection('analytics_events').where('d', '==', day).get()).docs.filter((d) => V.has(d.data().v));
  if (!docs.length) { console.log('no events of these browsers on', day); return; }
  const dayDoc = (await db.collection('analytics_days').doc(day).get()).data() || {};
  // a browser seen before this day was not a new visitor today
  const before = new Set(), ids = [...V];
  for (let i = 0; i < ids.length; i += 10) (await db.collection('analytics_events').where('v', 'in', ids.slice(i, i + 10)).get()).docs.forEach((d) => { if (d.data().d < day) before.add(d.data().v); });

  const dec = {};   // path (a.b.c) -> how much to take off
  const take = (path, n = 1) => { dec[path] = (dec[path] || 0) + n; };
  const byV = {};
  for (const d of docs) (byV[d.data().v] ||= []).push(d.data());
  for (const [v, evs] of Object.entries(byV)) {
    evs.sort((a, b) => a.t.toMillis() - b.t.toMillis());
    const first = evs[0], hr0 = hourIL(first.t.toDate());
    take('visitors'); take(`src.${first.r}`); take(`dev.${first.m ? 'phone' : 'desktop'}`); take(`h.visitors.${hr0}`);
    if (!before.has(v)) { take('new_visitors'); take(`h.new_visitors.${hr0}`); }
    for (const e of evs) {
      const hr = hourIL(e.t.toDate());
      if (e.e === 'time') {
        const [tot, prev] = String(e.x || '').split(':').map((s) => Math.max(0, Math.min(4 * 3600, parseInt(s, 10) || 0)));
        if (!tot || tot <= prev) continue;   // track dropped it too
        take('n.time'); take('time_s', tot - prev);
        const bi = timeBucket(tot), bp = prev ? timeBucket(prev) : -1;
        if (bi !== bp) { take(`n.tb|${bi}`); if (bp >= 0) take(`n.tb|${bp}`, -1); else take('time_n'); }
        continue;
      }
      take(`n.${e.e}`); take(`h.${e.e}.${hr}`);
      if (e.e !== 'search') { const k = `${e.e}|${key(e.x)}`; take(`n.${(dayDoc.n || {})[k] !== undefined ? k : `${e.e}|_other`}`); }
      if (e.e === 'view') take(`site.${e.p}`);
    }
  }
  // never below zero
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dayDoc);
  const bad = Object.entries(dec).filter(([p, n]) => n > 0 && (get(p) || 0) < n);
  console.log(`${day}: ${Object.keys(byV).length} browsers, ${docs.length} events (${before.size} seen before this day)`);
  console.log(`visitors ${dayDoc.visitors} -> ${dayDoc.visitors - (dec.visitors || 0)} · new ${dayDoc.new_visitors} -> ${dayDoc.new_visitors - (dec.new_visitors || 0)} · timed visits ${dayDoc.time_n} -> ${dayDoc.time_n - (dec.time_n || 0)} · time_s ${dayDoc.time_s} -> ${dayDoc.time_s - (dec.time_s || 0)}`);
  if (bad.length) { console.error('would go below zero - stopped:', bad.map(([p, n]) => `${p} ${get(p)}-${n}`).join(', ')); process.exit(1); }
  if (!apply) { console.log('(dry run - add --apply)'); return; }

  // nested maps, not dotted paths: set + merge adds to what is there (as track writes)
  const upd = {};
  for (const [p, n] of Object.entries(dec)) { if (!n) continue; const ks = p.split('.'); let o = upd; ks.slice(0, -1).forEach((k) => (o = o[k] ||= {})); o[ks.at(-1)] = FieldValue.increment(-n); }
  await db.collection('analytics_days').doc(day).set(upd, { merge: true });
  for (let i = 0; i < docs.length; i += 200) {
    const b = db.batch();
    for (const d of docs.slice(i, i + 200)) { b.set(db.collection('analytics_bots').doc(d.id), { ...d.data(), movedAt: new Date(), why: 'scripted browser (drop_bots.cjs)' }); b.delete(d.ref); }
    await b.commit();
  }
  console.log('done: counters lowered, events moved to analytics_bots');
})();
