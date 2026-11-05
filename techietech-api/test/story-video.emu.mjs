// A video story end to end, on the local emulators (project demo-shlomiverse - nothing live):
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions,storage "node ../techietech-api/test/story-video.emu.mjs"
// Makes a stand-in clip like an iPhone's (HEVC .mov, tall, with sound, a black fade-in), prepares it
// (scripts/stories/video.mjs), posts it with its cover through the owner op, gives it a new cover alone (storyEdit),
// then opens the real viewer (v2/dev.mjs --site on :5050) and checks: the clip plays with its cover and the blurred cover
// around it, the sound button is there and turns the sound on, holding a finger pauses it, the progress bar follows it.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { prepare } from '../../scripts/stories/video.mjs';

const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const FN = 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/verseOwner';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-shlomiverse/databases/(default)/documents';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vstory-'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
// the emulators' test owner key: techietech-api/.env.local (VERSE_LOCAL_OWNER_KEY) - read, never printed
const KEY = fs.readFileSync(path.join(ROOT, 'techietech-api/.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('VERSE_LOCAL_OWNER_KEY='))?.slice(22).trim().replace(/^["']|["']$/g, '');
assert.ok(KEY, 'VERSE_LOCAL_OWNER_KEY in techietech-api/.env.local');

// 1. the clip, prepared
const mov = path.join(dir, 'teaser.mov');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=8', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
  '-vf', 'fade=t=in:st=0:d=1', '-c:v', 'libx265', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', mov]);
const clip = prepare(mov);
assert.equal(clip.w, 1080); assert.equal(clip.h, 1920); assert.ok(clip.audio); assert.ok(clip.mb < 25);
assert.match(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', clip.file]).toString(), /h264/);
assert.ok(fs.statSync(clip.poster).size > 5000, 'a cover picture');
console.log(`ok  prepared: ${clip.duration}s ${clip.w}x${clip.h} ${clip.mb} MB h264 + sound, and a cover`);

// 2. posted with its cover, then a new cover alone
const send = async (op, fields, files) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const [k, f, type] of files) fd.append(k, new Blob([fs.readFileSync(f)], { type }), path.basename(f));
  const r = await fetch(`${FN}?op=${op}`, { method: 'POST', headers: { authorization: 'Key ' + KEY }, body: fd });
  const j = await r.json(); assert.ok(r.ok, op + ': ' + JSON.stringify(j)); return j;
};
const posted = await send('story', { char: 'hani', text: 'בקרוב', notify: 'no', boxes: JSON.stringify([{ t: 'בקרוב', x: 50, y: 84, w: 60, s: 7, st: 'tag' }]) },
  [['file', clip.file, 'video/mp4'], ['poster', clip.poster, 'image/jpeg']]);
const doc = async () => (await (await fetch(`${FS}/stories/${posted.id}`, { headers: { authorization: 'Bearer owner' } })).json()).fields.media.mapValue.fields;
let m = await doc();
assert.equal(m.kind.stringValue, 'video'); assert.match(m.poster?.stringValue || '', /-poster\.jpg/, 'the cover is saved with the clip');
const firstPoster = m.poster.stringValue;
await send('storyEdit', { id: posted.id }, [['poster', clip.poster, 'image/jpeg']]);
m = await doc();
assert.notEqual(m.poster.stringValue, firstPoster, 'a new cover alone replaces it'); assert.equal(m.url.stringValue.length > 0, true);
console.log('ok  posted with its cover; a new cover alone replaced it, the clip stayed');

// 3. the real viewer
const site = spawn('node', [path.join(ROOT, 'v2/dev.mjs'), '--site'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await puppeteer.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const logs = [];
  p.on('console', (c) => logs.push(c.type() + ': ' + c.text().slice(0, 200)));
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message.slice(0, 200)));
  p.on('requestfailed', (r) => logs.push('failed: ' + r.url().slice(0, 120)));
  await p.goto('http://localhost:5050/story/hani', { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForSelector('.sv video.sa-media', { timeout: 20000 }).catch(async (e) => {
    await p.screenshot({ path: path.join(dir, 'no-viewer.png') });
    console.log('no viewer - ' + path.join(dir, 'no-viewer.png'));
    logs.slice(-25).forEach((l) => console.log('  ' + l));
    throw e;
  });
  const s = await p.evaluate(() => { const v = document.querySelector('.sv video.sa-media'), f = document.querySelector('.sv .sa-fill'), b = document.querySelector('.sv [data-sound]');
    return { poster: v.getAttribute('poster'), fill: f.tagName === 'IMG' ? f.getAttribute('src') : null, sound: b && !b.hidden }; });
  assert.match(s.poster || '', /-poster\.jpg/, 'the clip shows its cover while it loads'); assert.equal(s.fill, s.poster, 'the blurred cover around it');
  assert.ok(s.sound, 'the sound button is there');
  await p.waitForFunction(() => document.querySelector('.sv video.sa-media').currentTime > 0.6, { timeout: 15000 });
  // the sound: whatever the phone allowed, one tap turns it on
  await p.evaluate(() => { const v = document.querySelector('.sv video.sa-media'); if (!v.muted) document.querySelector('.sv [data-sound]').click(); });
  await p.click('.sv [data-sound]');
  assert.equal(await p.evaluate(() => document.querySelector('.sv video.sa-media').muted), false, 'a tap turns the sound on');
  const bar = await p.evaluate(() => parseFloat(document.querySelectorAll('.sv-bars i')[0].style.width));
  assert.ok(bar > 3 && bar < 100, 'the progress bar follows the clip (' + bar + '%)');
  // holding a finger: paused, only the picture
  await p.evaluate(() => { const t = document.querySelector('.sv-tap.next'), r = t.getBoundingClientRect(); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 })); });
  await new Promise((r) => setTimeout(r, 500));
  const held = await p.evaluate(() => ({ paused: document.querySelector('.sv video.sa-media').paused, peek: document.querySelector('.sv').classList.contains('peek'), t: document.querySelector('.sv video.sa-media').currentTime }));
  assert.ok(held.paused && held.peek, 'holding pauses it and shows only the picture');
  await p.screenshot({ path: path.join(dir, 'held.png') });
  await p.evaluate(() => document.querySelector('.sv').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(await p.evaluate(() => document.querySelector('.sv video.sa-media').paused), false, 'letting go plays it again');
  await p.screenshot({ path: path.join(dir, 'playing.png') });
  console.log('ok  the viewer: cover + blurred cover, sound button turns sound on, the bar follows, holding pauses, letting go plays');
  console.log('screens: ' + dir);
} finally { await b.close(); site.kill(); }
console.log('story-video: all good');
process.exit(0);
