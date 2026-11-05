// The video catalog and its door, end to end on the local emulators (project demo-shlomiverse - nothing live):
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions,storage "node ../techietech-api/test/publish.emu.mjs"
// A base (characters, series) and one video already in the catalog; then a new video published the studio's way
// (uploadUrl -> PUT -> op=video), its title kept on a second call that sends none, a call with no title (Terra writes it -
// needs WIKI_OPENAI_KEY in the environment, else skipped), hide / show, and the composed wiki.json + chat brain each time.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FN = 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/versePublish';
const ST = 'http://127.0.0.1:9199';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-shlomiverse/databases/(default)/documents';
const KEY = process.env.VERSE_PUBLISH_KEY || 'local-publish';
const H = { 'content-type': 'application/json', authorization: 'Bearer owner' };
const MEDIA = 'shlomiverse-media', PRIV = 'shlomiverse-private';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));

const step = (m) => console.log('  .. ' + m);
const call = async (body) => { step('call ' + body.op + ' ' + (body.id || '')); const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Key ' + KEY }, body: JSON.stringify(body) }); return { status: r.status, j: await r.json() }; };
// the storage emulator through the admin SDK (emulators:exec sets FIREBASE_STORAGE_EMULATOR_HOST for this script)
import { createRequire } from 'node:module';
const admin = createRequire(import.meta.url)('../node_modules/firebase-admin');
admin.initializeApp({ projectId: 'demo-shlomiverse' });
const putObj = (bucket, name, data, type) => admin.storage().bucket(bucket).file(name).save(Buffer.from(data), { resumable: false, metadata: { contentType: type } });
const getObj = async (bucket, name) => JSON.parse((await admin.storage().bucket(bucket).file(name).download())[0].toString('utf8'));
const str = (v) => ({ stringValue: v });

// the base the catalog is composed on, and one video that is already live
const base = { series: [{ id: 'techytech', title: 'טקי-טק', blurb: '', site: null, characters: ['hani'], videos: [] }], characters: [{ id: 'hani', name: 'חני פרידמן', series: 'techytech', videos: [] }], sites: {}, site_list: [], games: [] };
const baseBrain = { worlds: [], characters: [{ id: 'hani', name: 'חני פרידמן', videos: [] }], sites: [], games: [] };
step('seed base'); await putObj(MEDIA, 'wiki/data/base.json', JSON.stringify(base), 'application/json');
await putObj(PRIV, 'wiki-base-brain.json', JSON.stringify(baseBrain), 'application/json');
await fetch(`${FS}/catalogVideos/old-one`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { title: str('ישן'), teaser: str('ישן'), series: str('techytech'), cast: { arrayValue: { values: [str('hani')] } },
  date: str('2026-10-01'), t: str('2026-10-01T10:00:00'), src: str('https://x/v/old-one.mp4'), poster: str('https://x/v/old-one.jpg'), hidden: { booleanValue: false } } }) });

// a new video, the studio's way
const mp4 = path.join(dir, 'clip.mp4'), jpg = path.join(dir, 'clip.jpg');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-frames:v', '1', jpg]);
assert.equal((await call({ op: 'video', id: 'new-one', title: 'x' })).j.error, 'no_file', 'no file = refused');
for (const [kind, file, type] of [['video', mp4, 'video/mp4'], ['poster', jpg, 'image/jpeg']]) {
  const u = await call({ op: 'uploadUrl', id: 'new-one', kind, contentType: type });
  assert.ok(u.j.uri, 'an upload address: ' + JSON.stringify(u.j));
  const put = await fetch(u.j.uri, { method: 'PUT', headers: { 'content-type': type }, body: fs.readFileSync(file) });
  assert.ok(put.ok, 'upload ' + kind + ' ' + put.status);
}
const dry = await call({ op: 'video', id: 'new-one', title: 'חני והקאש', teaser: 'מה קרה לקאש', cast: ['hani'], date: '2026-11-05', transcript: 'הקאש נפל', dryRun: true });
assert.ok(dry.j.dryRun && dry.j.video.src.includes('v/new-one.mp4?v='), 'dryRun shows the record: ' + JSON.stringify(dry.j));
assert.equal((await getObj(MEDIA, 'wiki/data/base.json')).series[0].id, 'techytech');
let r = await call({ op: 'video', id: 'new-one', title: 'חני והקאש', teaser: 'מה קרה לקאש', cast: ['hani'], date: '2026-11-05', transcript: 'הקאש נפל' });
assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.videos, 2);
let wiki = await getObj(MEDIA, 'wiki/data/wiki.json'), brain = await getObj(PRIV, 'wiki-brain.json');
assert.deepEqual(wiki.videos.map((v) => v.id), ['new-one', 'old-one'], 'newest first');
assert.equal(wiki.videos[0].series, 'techytech', 'the series from its cast');
assert.deepEqual(wiki.characters[0].videos, ['new-one', 'old-one']); assert.deepEqual(wiki.series[0].videos, ['new-one', 'old-one']);
assert.equal(brain.videos[0].transcript, 'הקאש נפל');
console.log('ok  published the studio way: upload -> op=video -> on the site and in the chat, newest first');

r = await call({ op: 'video', id: 'new-one', cast: ['hani'] });
assert.equal(r.j.video.title, 'חני והקאש', 'a second call without a title keeps it'); assert.equal(r.j.video.teaser, 'מה קרה לקאש');
brain = await getObj(PRIV, 'wiki-brain.json');
assert.equal(brain.videos.find((v) => v.id === 'new-one').transcript, 'הקאש נפל', 'the words are kept too');
console.log('ok  idempotent: a second call keeps every field it did not send');

r = await call({ op: 'video', id: 'new-one', onScreen: 'אף אחד: חני ב-2026' });
brain = await getObj(PRIV, 'wiki-brain.json');
assert.equal(brain.videos.find((v) => v.id === 'new-one').transcript, 'טקסט על המסך: אף אחד: חני ב-2026\nהקאש נפל', 'the words on screen reach the chat, the speech is kept');
console.log('ok  onScreen: the burned-in words reach the chat (before the speech)');

r = await call({ op: 'hide', id: 'new-one', hidden: true });
wiki = await getObj(MEDIA, 'wiki/data/wiki.json');
assert.deepEqual(wiki.videos.map((v) => v.id), ['old-one'], 'hidden = off the site');
assert.equal((await call({ op: 'get', id: 'new-one' })).j.live, false);
await call({ op: 'hide', id: 'new-one', hidden: false });
assert.equal((await getObj(MEDIA, 'wiki/data/wiki.json')).videos.length, 2, 'shown again');
console.log('ok  hide takes it off the site, show brings it back; get says so');

if (process.env.WIKI_OPENAI_KEY || process.env.VERSE_OPENAI_KEY) {
  for (const [kind, file, type] of [['video', mp4, 'video/mp4'], ['poster', jpg, 'image/jpeg']]) {
    const u = await call({ op: 'uploadUrl', id: 'terra-one', kind, contentType: type });
    await fetch(u.j.uri, { method: 'PUT', headers: { 'content-type': type }, body: fs.readFileSync(file) });
  }
  r = await call({ op: 'video', id: 'terra-one', cast: ['hani'], transcript: 'אוי, ה-Cache נפל שוב. עשיתי ולידציה, ניקיתי את המפתח, ובעזרת השם הכול עלה.', dryRun: true });
  assert.ok(r.j.video?.title && r.j.video.teaser && r.j.card, 'Terra wrote title, teaser and card: ' + JSON.stringify(r.j));
  console.log('ok  no title sent: Terra wrote it (' + r.j.video.title + ')');
  r = await call({ op: 'video', id: 'terra-one', transcript: 'שלום, אני חני פרידמן מה-Backend. אוי, ה-Cache נפל שוב, עשיתי ולידציה ובעזרת השם הכול עלה.', dryRun: true });
  assert.equal(r.j.castBy, 'ai', 'no cast sent = the AI picks: ' + JSON.stringify(r.j));
  assert.ok(r.j.video.cast.includes('hani'), 'it found Hani: ' + JSON.stringify(r.j.video.cast));
  console.log('ok  no cast sent: the AI picked the characters (' + r.j.video.cast.join(', ') + ')');
} else console.log('(no OpenAI key - the Terra step was not checked)');
assert.equal((await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Key wrong' }, body: '{}' })).status, 401, 'a wrong key is refused');
console.log('publish: all good');
