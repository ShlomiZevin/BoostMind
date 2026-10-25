// Remove visitors from the analytics (tests, or someone who asked) and rebuild the days they touched from the events
// that are left.   node scripts/wiki/analytics_forget.js <visitorId> [visitorId...]
// The rebuilt day: visitors = distinct ids that day; source / device from each one's first event that day;
// new visitors = ids whose first event in the kept log (90 days) is that day.
const admin = require('../../techietech-api/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const db = admin.firestore();
const key = (v) => String(v ?? '').slice(0, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '_';

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) return console.log('usage: node scripts/wiki/analytics_forget.js <visitorId>...');
  const days = new Set();
  for (const v of ids) {
    const snap = await db.collection('analytics_events').where('v', '==', v).get();
    for (const d of snap.docs) { days.add(d.data().d); await d.ref.delete(); }
    console.log(`forgot ${v}: ${snap.size} events`);
  }
  for (const day of days) {
    const evs = (await db.collection('analytics_events').where('d', '==', day).get()).docs.map((d) => d.data()).sort((a, b) => a.t.toMillis() - b.t.toMillis());
    const doc = { d: day, n: {}, site: {}, src: {}, dev: {}, visitors: 0, new_visitors: 0 };
    const seen = new Set();
    for (const e of evs) {
      doc.n[e.e] = (doc.n[e.e] || 0) + 1;
      if (e.e !== 'search') doc.n[`${e.e}|${key(e.x)}`] = (doc.n[`${e.e}|${key(e.x)}`] || 0) + 1;
      if (e.e === 'view') doc.site[e.p] = (doc.site[e.p] || 0) + 1;
      if (!seen.has(e.v)) {
        seen.add(e.v);
        doc.visitors++;
        doc.src[e.r] = (doc.src[e.r] || 0) + 1;
        doc.dev[e.m ? 'phone' : 'desktop'] = (doc.dev[e.m ? 'phone' : 'desktop'] || 0) + 1;
        const theirs = await db.collection('analytics_events').where('v', '==', e.v).get();   // one field: no composite index
        if (!theirs.docs.some((d) => d.data().d < day)) doc.new_visitors++;
      }
    }
    if (evs.length) await db.collection('analytics_days').doc(day).set(doc);
    else await db.collection('analytics_days').doc(day).delete();
    console.log(`rebuilt ${day}: ${evs.length} events, ${doc.visitors} visitors`);
  }
})();
