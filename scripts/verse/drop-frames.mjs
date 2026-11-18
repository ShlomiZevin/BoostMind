// The home's live strip (verse/livestrip.js, his OK 2026-11-18, mockup live-strip/3-drop-strip-r2): behind its words, frames of
// the drop video slowly change - not the video itself (a home page shouldn't pull megabytes). This makes them: 4 frames from
// BEFORE the drop (no spoiler), each 480x300 (1.6:1 - the whole head; the strip shows it on its left side), stacked into one JPEG ~60 KB at
// gs://shlomiverse-media/wiki/v/<id>.frames.jpg. No file = the strip drifts over the poster instead.
//   node scripts/verse/drop-frames.mjs <video id> [--video <local mp4>] [--at <seconds of the drop>] [--dry]
// Without --video it downloads wiki/v/<id>.mp4 from the bucket; without --at it reads drop.at from the live wiki.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const id = args[0];
const opt = (k) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : null; };
if (!id || !/^[\w-]+$/.test(id)) { console.log('usage: node scripts/verse/drop-frames.mjs <video id> [--video file.mp4] [--at seconds]'); process.exit(1); }
const BUCKET = 'gs://shlomiverse-media/wiki/v/';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drop-frames-'));

let at = +opt('--at') || 0;
if (!at) {
  const w = await (await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json', { cache: 'no-store' })).json();
  const v = (w.videos || []).find((x) => x.id === id);
  at = v && v.drop ? +v.drop.at : 0;
  if (!at) { console.log(`${id}: no drop on the live site - give --at <seconds>`); process.exit(1); }
}
let video = opt('--video');
if (!video) { video = path.join(tmp, 'v.mp4'); execFileSync('gcloud', ['storage', 'cp', BUCKET + id + '.mp4', video], { stdio: 'ignore', shell: true }); }

// 4 moments between 12% and 88% of the way to the drop; each frame: the full width, a 1.6:1 band around 36% of the height
// (a vertical video's main face sits there - a Zoom call's big tile, a monologue's head)
const shots = [0.12, 0.37, 0.62, 0.88].map((f) => (at * f).toFixed(2));
const vf = "crop=iw*0.92:iw*0.92/1.6:iw*0.04:max(0\\,min(ih-iw*0.92/1.6\\,ih*0.36-iw*0.92/3.2)),scale=480:300";   // 4% off each side: a Zoom tile's green edge
shots.forEach((t, i) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', t, '-i', video, '-frames:v', '1', '-vf', vf, path.join(tmp, `f${i}.png`)]));
const out = path.join(tmp, `${id}.frames.jpg`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...shots.flatMap((_, i) => ['-i', path.join(tmp, `f${i}.png`)]), '-filter_complex', 'vstack=4', '-q:v', '5', out]);
if (args.includes('--dry')) { console.log('dry: ' + out); process.exit(0); }
execFileSync('gcloud', ['storage', 'cp', out, BUCKET + id + '.frames.jpg', '--cache-control=public, max-age=86400'], { stdio: 'ignore', shell: true });
console.log(`${id}: frames at ${shots.join(', ')} s (drop at ${at}) -> ${BUCKET}${id}.frames.jpg (${Math.round(fs.statSync(out).size / 1024)} KB)`);
if (args.includes('--keep')) console.log('kept: ' + out);
