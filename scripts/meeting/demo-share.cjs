// The demo's shared meeting (his ask round 4: "for the demo, share a fixed demo meeting link"): meetings/demo, built from the recorded
// demo (v2/site/syncs/demo.json) - the conversation, the wrap-up, who was on the call - shared, never expiring. Its page is
// shlomiverse.com/syncs/m/demo (verseMeeting renders it, with its WhatsApp preview).
//   node scripts/meeting/demo-share.cjs            -> the live project (boostmind-b052c, the machine's gcloud login)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/meeting/demo-share.cjs   -> the local emulators (demo-shlomiverse)
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const admin = require(path.join(ROOT, 'techietech-api', 'node_modules', 'firebase-admin'));
const { Timestamp } = admin.firestore;
const d = require(path.join(ROOT, 'v2', 'site', 'syncs', 'demo.json'));
admin.initializeApp({ projectId: process.env.FIRESTORE_EMULATOR_HOST ? 'demo-shlomiverse' : 'boostmind-b052c' });

const log = [];
let visitor = { name: (d.visitor || {}).name || '', title: '', photo: '' }, recap = null, ender = null;
for (const { e } of d.events) {
  if (e.t === 'visitor') visitor = { ...visitor, name: e.name || visitor.name, title: e.title || '' };
  else if (e.t === 'guest') log.push({ who: 'user', text: e.text });
  else if (e.t === 'line') log.push({ who: e.who, text: e.text, cut: !!e.cut });
  else if (e.t === 'left' || e.t === 'away') log.push({ who: e.who, left: true });
  else if (e.t === 'end') ender = e.who;
  else if (e.t === 'recap') recap = e.recap;
}
(async () => {
  const now = Timestamp.now();
  await admin.firestore().collection('meetings').doc('demo').set({
    uid: 'demo', demo: true, room: d.room.filter((x) => !log.some((l) => l.left && l.who === x)), all: d.room, left: log.filter((l) => l.left).map((l) => l.who),
    log, run: 0, phrases: {}, hand: false, ended: true, cost: 0, recap, visitor, visitorNote: '', t: now, endedAt: now, ms: d.ms || 0,
    shared: true, sharedAt: now, ender,
  });
  console.log('meetings/demo written:', log.length, 'lines,', recap ? 'with' : 'NO', 'wrap-up');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
