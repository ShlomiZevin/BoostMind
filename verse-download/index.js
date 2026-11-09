// Downloading a Shlomiverse video (his call, 2026-11-09): a signed-in visitor can take any video home, and the file always
// carries the Shlomiverse's mark - the logo with shlomiverse.com under it, top right - so every copy that travels on
// WhatsApp / TikTok / Reels brings people back. The clean file stays the site's own (the player hides its download).
//   verseDownload       (callable, from the player's "הורדה")  {id} -> {url, name}: a link (1 h) to the marked copy;
//                        a copy not made yet is made right then (about a minute). Counted: videoStats/<id>.downloads + downloads/.
//   verseDownloadSweep  every 10 minutes: makes the marked copy of every video that has none (or whose video changed),
//                        newest first - so a download is instant. Nothing to call by hand after a video is published.
// The marked copies: gs://shlomiverse-private/downloads/<id>.mp4 (metadata srcMd5 = the video they were made from, mark = MARK_V).
// Its own codebase ("download"), because ffmpeg is heavy - the other functions don't carry it.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FFMPEG = require('ffmpeg-static');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const REGION = 'europe-west1';
const MEDIA = 'shlomiverse-media', PRIVATE = 'shlomiverse-private';
const SRC = (id) => `wiki/v/${id}.mp4`, OUT = (id) => `downloads/${id}.mp4`;
const MARK = path.join(__dirname, 'watermark.png');   // a faint logo, shlomiverse.com in white on a dark see-through pill (889x480, from v2/site/verse/logo-512.png)
const MARK_V = '3';   // change the picture or its place -> raise this, and every copy is made again by the sweep
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
const ID = /^[a-z0-9][a-z0-9_-]{1,80}$/i;

const run = (args) => new Promise((ok, no) => {
  const p = spawn(FFMPEG, args);
  let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-6000); });
  p.on('close', (code) => ok({ code, err }));
  p.on('error', no);
});

// the picture's size as it plays (a rotated phone file swaps it)
async function size(file) {
  const { err } = await run(['-hide_banner', '-i', file]);
  const m = err.match(/Video:.*?\s(\d{2,5})x(\d{2,5})[\s,]/);
  if (!m) throw new Error('no video stream');
  let w = +m[1], h = +m[2];
  if (/rotation of -?90|rotate\s*:\s*(90|270)/.test(err)) [w, h] = [h, w];
  return { w, h };
}

// the mark: small and see-through, the address readable on any picture (his words, 2026-11-09) - about a quarter of the width (of a 9:16
// frame), top right, clear of the POV text band (checked on haredit-5 and adam-1)
async function render(id, md5) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-')), src = path.join(dir, 'in.mp4'), out = path.join(dir, 'out.mp4');
  try {
    await admin.storage().bucket(MEDIA).file(SRC(id)).download({ destination: src });
    const { w, h } = await size(src);
    const base = Math.min(w, (h * 9) / 16);
    const mw = Math.max(2, Math.floor((base * 0.26) / 2) * 2), x = Math.round(w - mw - base * 0.035), y = Math.round(h * 0.03);
    const enc = (audio) => ['-hide_banner', '-v', 'error', '-y', '-i', src, '-i', MARK,
      '-filter_complex', `[1:v]scale=${mw}:-1[wm];[0:v][wm]overlay=${x}:${y},format=yuv420p[v]`,
      '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', ...audio, '-movflags', '+faststart', out];
    let r = await run(enc(['-c:a', 'copy']));
    if (r.code) r = await run(enc(['-c:a', 'aac', '-b:a', '160k']));   // a sound the mp4 can't carry as it is
    if (r.code) throw new Error('ffmpeg: ' + r.err.slice(-400));
    await admin.storage().bucket(PRIVATE).upload(out, { destination: OUT(id), metadata: { contentType: 'video/mp4', metadata: { srcMd5: md5 || '', mark: MARK_V } } });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// the marked copy, made when missing or older than the video; one at a time per video in this instance
const making = new Map();
async function ensure(id) {
  const [[sm], [om]] = await Promise.all([admin.storage().bucket(MEDIA).file(SRC(id)).getMetadata(),
    admin.storage().bucket(PRIVATE).file(OUT(id)).getMetadata().catch(() => [null])]);
  if (om && om.metadata?.srcMd5 === sm.md5Hash && om.metadata?.mark === MARK_V) return;
  if (!making.has(id)) making.set(id, render(id, sm.md5Hash).finally(() => making.delete(id)));
  return making.get(id);
}

const burst = new Map();   // a visitor: 40 downloads an hour
const tooMany = (uid) => { const now = Date.now(), t = (burst.get(uid) || []).filter((x) => now - x < 3600e3); t.push(now); burst.set(uid, t); return t.length > 40; };

exports.verseDownload = onCall({ region: REGION, cors: CORS, memory: '4GiB', cpu: 2, concurrency: 2, maxInstances: 8, timeoutSeconds: 300 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'sign_in');
  const id = String(req.data?.id || '');
  if (!ID.test(id)) throw new HttpsError('invalid-argument', 'id');
  if (tooMany(req.auth.uid)) throw new HttpsError('resource-exhausted', 'slow_down');
  const v = (await db.collection('catalogVideos').doc(id).get()).data();
  if (!v || v.hidden || v.url || !v.src) throw new HttpsError('not-found', 'no_video');
  await ensure(id);
  const name = `shlomiverse-${id}.mp4`;
  const [url] = await admin.storage().bucket(PRIVATE).file(OUT(id)).getSignedUrl({ action: 'read', expires: Date.now() + 3600e3,
    responseDisposition: `attachment; filename="${name}"`, responseType: 'video/mp4' });
  await Promise.all([db.collection('videoStats').doc(id).set({ downloads: FieldValue.increment(1) }, { merge: true }),
    db.collection('downloads').add({ uid: req.auth.uid, videoId: id, at: FieldValue.serverTimestamp() })]).catch((e) => console.error('count', id, e.message));
  return { url, name };
});

exports.verseDownloadSweep = onSchedule({ schedule: 'every 10 minutes', region: REGION, memory: '4GiB', cpu: 2, timeoutSeconds: 540, maxInstances: 1, retryCount: 0 }, async () => {
  const t0 = Date.now();
  const [vs, [srcs], [outs]] = await Promise.all([db.collection('catalogVideos').get(),
    admin.storage().bucket(MEDIA).getFiles({ prefix: 'wiki/v/' }), admin.storage().bucket(PRIVATE).getFiles({ prefix: 'downloads/' })]);
  const md5 = Object.fromEntries(srcs.map((f) => [f.name, f.metadata.md5Hash]));
  const made = Object.fromEntries(outs.map((f) => [f.name, f.metadata.metadata?.mark === MARK_V && f.metadata.metadata?.srcMd5]));
  const todo = vs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => !v.hidden && !v.url && v.src && md5[SRC(v.id)] && made[OUT(v.id)] !== md5[SRC(v.id)])
    .sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')));
  let n = 0;
  for (const v of todo) {
    if (Date.now() - t0 > 6.5 * 60e3) break;   // the next run goes on
    try { await render(v.id, md5[SRC(v.id)]); n++; } catch (e) { console.error('mark', v.id, e.message); }
  }
  console.log(`marked ${n}, ${todo.length - n} to go`);
});
