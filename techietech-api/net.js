// Shlomiverse Online - the cleaner. The games' moves never pass through any function (the phones talk to the Realtime
// Database directly, locked by database.rules.json); this one small scheduled job only deletes what was left behind:
// rooms waiting > 15 min, playing > 2 h, finished > 10 min, closed > 2 min; codes / hosting marks pointing to no room;
// quick-match slots nobody beats any more. Separate from `verse`, so the regular server sees nothing new.
// Deploy: firebase deploy --only functions:verseNetSweep (from techietech-api/). Kill switch: /net/open (false = no new rooms).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const URL = 'https://boostmind-b052c-default-rtdb.europe-west1.firebasedatabase.app';
const MIN = 60e3;
const AGE = { wait: 15 * MIN, play: 120 * MIN, done: 10 * MIN, closed: 2 * MIN };

async function sweep(db, now = Date.now()) {
  const out = { rooms: 0, codes: 0, hosting: 0, queue: 0 };
  const rooms = (await db.ref('rooms').once('value')).val() || {};
  const del = {};
  for (const [id, r] of Object.entries(rooms)) {
    const max = AGE[r && r.status] || 15 * MIN;
    const last = Math.max(Number(r && r.at) || 0, Number(r && r.turnAt) || 0);
    if (!r || now - last > max) { del[`rooms/${id}`] = null; out.rooms++; }
  }
  const alive = (id) => rooms[id] && !(`rooms/${id}` in del);
  const codes = (await db.ref('codes').once('value')).val() || {};
  for (const [c, x] of Object.entries(codes)) if (!x || !alive(x.room)) { del[`codes/${c}`] = null; out.codes++; }
  const hosting = (await db.ref('hosting').once('value')).val() || {};
  for (const [u, id] of Object.entries(hosting)) if (!alive(id)) { del[`hosting/${u}`] = null; out.hosting++; }
  const queue = (await db.ref('queue').once('value')).val() || {};
  for (const [g, q] of Object.entries(queue)) if (!q || now - (q.t || 0) > 2 * MIN || !alive(q.room)) { del[`queue/${g}`] = null; out.queue++; }
  if (Object.keys(del).length) await db.ref().update(del);
  return out;
}

exports.verseNetSweep = onSchedule({ schedule: 'every 15 minutes', region: 'europe-west1', timeoutSeconds: 120, memory: '256MiB', maxInstances: 1 }, async () => {
  const out = await sweep(admin.app().database(URL));
  if (out.rooms || out.codes || out.queue) console.log('net sweep', JSON.stringify(out));
});
exports._sweep = sweep;   // for tests (scripts/techytech-games/meetings/tools/t4-online.js)
