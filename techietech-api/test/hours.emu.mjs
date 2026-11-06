// The per-hour counters (analytics.js track -> analytics_days.h) and the forecast on them, on the local emulators:
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only firestore "node ../techietech-api/test/hours.emu.mjs"
// (the track handler runs in this process: the functions emulator's admin has no firestore.Timestamp - live it does)
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../node_modules/firebase-admin');
admin.initializeApp({ projectId: 'demo-shlomiverse' });
const db = admin.firestore();
const { track } = require('../analytics');
const HDR = { origin: 'https://shlomiverse.com', 'user-agent': 'Mozilla/5.0 Chrome/130' };
const send = (b) => new Promise((done) => {
  const body = JSON.stringify({ p: 'wiki', r: 'direct', v: 'abc', s: 's1', ...b });
  const res = { set() {}, status() { return res; }, send: done };
  track({ method: 'POST', ip: '1.2.3.4', body, rawBody: Buffer.from(body), get: (h) => HDR[h.toLowerCase()], headers: HDR }, res);
});
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const hr = String(+new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
await send({ e: 'view', x: '/', first: true, fresh: true });
await send({ e: 'video', x: 'v1' });
await send({ e: 'video', x: 'v2' });
await send({ e: 'time', x: '30:0' });   // no hour counter for time - and it must not wipe the others
const d = (await db.collection('analytics_days').doc(day).get()).data();
assert.equal(d.h.visitors[hr], 1); assert.equal(d.h.new_visitors[hr], 1); assert.equal(d.h.view[hr], 1); assert.equal(d.h.video[hr], 2);
assert.equal(d.n.video, 2); assert.equal(d.visitors, 1); assert.ok(!d.h.time, 'time has no hours');
console.log('ok  track counts each event in its Israel hour; a time event keeps them');
const { forecast } = require('../forecast');
const f = forecast({ days: [d], joined: [] });
assert.equal(f.metrics.video.sofar, 2); assert.ok(f.metrics.video.proj >= 2); assert.equal(f.metrics.video.today, null, 'under 3 events a day has no shape yet');
console.log('ok  the forecast reads the day (with no past days it still answers)');
console.log('hours: all good');
process.exit(0);
