// Read the analytics straight from Firestore (local Google credentials): node scripts/wiki/analytics_check.js [visitorId]
const admin = require('../../techietech-api/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const db = admin.firestore();
(async () => {
  const v = process.argv[2];
  let q = db.collection('analytics_events').orderBy('t', 'desc').limit(40);
  const snap = await q.get();
  const rows = snap.docs.map((d) => d.data()).filter((e) => !v || e.v === v);
  for (const e of rows.reverse()) console.log(e.t.toDate().toISOString().slice(11, 19), e.p.padEnd(13), e.e.padEnd(13), String(e.x).padEnd(28), e.r, e.m ? 'phone' : 'desktop', e.v);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  console.log('\nday', today, JSON.stringify((await db.collection('analytics_days').doc(today).get()).data()));
})();
