// Every video on the Shlomiverse carries its words (his rule 2026-11-22: "super critical" - the chat's memory, the comments,
// the titles and the editor all read catalogTranscripts). This finds every video without its spoken words and gets them:
//   1. a Studio project on this computer -> its subtitle layers (zoomcut/render/verse.mjs wordsOf - the same code the
//      Studio sends with every publish since 2026-11-22) + its text layers as the on-screen words
//   2. no subtitles -> the sound heard (gpt-4o-mini-transcribe on a small mp3 ffmpeg cuts from the web copy)
//   3. no words on the screen either -> frames read by Terra (the words baked into the picture)
//   node scripts/verse/video-words.mjs --check                 which videos have no words (nothing paid, nothing written)
//   node scripts/verse/video-words.mjs --out w.json [ids...]   get them - a dry run saved to w.json (read it, fix it)
//   node scripts/verse/video-words.mjs --post w.json           send exactly those words (versePublish op video)
// A video with no speech at all gets transcript "(בלי דיבור)" by hand in w.json, so it counts as checked, not missing.
// Keys: OpenAI from scripts/design.env, the publish key from zoomcut/.env (never printed). ~0.3c a minute heard, ~1c a video read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(ROOT, 'techietech-api', 'index.js'));
const admin = req('firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const db = admin.firestore();
const { wordsOf, onScreenOf } = await import(pathToFileURL(path.join(ROOT, 'zoomcut/render/verse.mjs')).href);
const envOf = (f) => (fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })) : {});
const argv = process.argv.slice(2), arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const OPENAI = envOf(path.join(ROOT, 'scripts/design.env')).OPENAI_API_KEY;
const has = (s) => !!String(s || '').trim();

if (arg('--post')) {
  const key = envOf(path.join(ROOT, 'zoomcut/.env')).VERSE_PUBLISH_KEY;
  if (!key) { console.log('no VERSE_PUBLISH_KEY in zoomcut/.env'); process.exit(1); }
  for (const x of JSON.parse(fs.readFileSync(arg('--post'), 'utf8')).filter((x) => has(x.transcript))) {
    const r = await fetch('https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish', { method: 'POST',
      headers: { authorization: 'Key ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ by: 'video-words.mjs', op: 'video', id: x.id, transcript: x.transcript, ...(has(x.onScreen) ? { onScreen: x.onScreen } : {}) }) });
    const j = await r.json().catch(() => ({}));
    console.log(r.ok && !j.error ? 'kept' : `FAILED ${j.error || r.status} ${j.detail || ''}`, x.id);
  }
  process.exit(0);
}

const [vs, ts, cs] = await Promise.all(['catalogVideos', 'catalogTranscripts', 'catalogCharacters'].map((c) => db.collection(c).get()));
const tr = Object.fromEntries(ts.docs.map((d) => [d.id, d.data()]));
const names = Object.fromEntries(cs.docs.map((d) => [d.id, d.data().name || d.id]));
const ids = argv.filter((a) => !a.startsWith('--') && a !== arg('--out'));
const todo = vs.docs.map((d) => ({ id: d.id, ...d.data() }))
  .filter((v) => (ids.length ? ids.includes(v.id) : !v.hidden && !has(tr[v.id]?.text)));
if (argv.includes('--check')) {
  console.log(todo.length ? `${todo.length} videos without their words:\n${todo.map((v) => `  ${v.id}  (${v.source || '?'}) ${v.title || ''}`).join('\n')}` : 'every video has its words');
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vwords-'));
async function hear(v) {
  const a = path.join(tmp, v.id + '.mp3');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', String(v.src).split('?')[0], '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', a], { timeout: 300000 });
  const fd = new FormData();
  fd.append('model', 'gpt-4o-mini-transcribe'); fd.append('language', 'he');
  fd.append('file', new Blob([fs.readFileSync(a)], { type: 'audio/mpeg' }), 'a.mp3');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${OPENAI}` }, body: fd });
  return r.ok ? String((await r.json()).text || '').trim() : '';
}
async function read(v) {   // one contact sheet of frames, every 2 s
  const sheet = path.join(tmp, v.id + '.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', String(v.src).split('?')[0], '-vf', 'fps=1/2,scale=360:-2,tile=5x4', '-frames:v', '1', '-q:v', '4', sheet], { timeout: 300000 });
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${OPENAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-6.1-terra', reasoning: { effort: 'low' }, max_output_tokens: 2000, store: false, input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Frames of one vertical video, in order (left to right, top to bottom). Write out every word written on the screen, in order, once each (a line that stays on screen - once). Only the words, Hebrew as written, one line per text; nothing else. If there are none, answer NONE.' },
      { type: 'input_image', image_url: `data:image/jpeg;base64,${fs.readFileSync(sheet).toString('base64')}` }] }] }) });
  if (!r.ok) return '';
  const out = ((await r.json()).output || []).flatMap((o) => o.content || []).map((x) => x.text || '').join('').trim();
  return out === 'NONE' ? '' : out;
}

const saved = [];
for (const v of todo) {
  const dir = path.join(ROOT, 'zoomcut/episodes', v.id), x = { id: v.id, title: v.title, how: [] };
  if (fs.existsSync(path.join(dir, 'project.json'))) {
    x.transcript = wordsOf(dir, names); if (x.transcript) x.how.push('subtitles');
    const os2 = onScreenOf(dir); if (os2 && !has(tr[v.id]?.onScreen)) { x.onScreen = os2; x.how.push('text layers'); }
  }
  if (!has(x.transcript) && v.src) { x.transcript = await hear(v).catch((e) => (console.error(v.id, e.message), '')); if (x.transcript) x.how.push('heard'); }
  if (!has(x.onScreen) && !has(tr[v.id]?.onScreen) && v.src) { x.onScreen = await read(v).catch((e) => (console.error(v.id, e.message), '')); if (x.onScreen) x.how.push('frames read'); }
  console.log(`${v.id}: ${x.how.join(' + ') || 'NOTHING'} (${(x.transcript || '').length} chars)`);
  saved.push(x);
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(arg('--out') || 'video-words.json', JSON.stringify(saved, null, 1));
process.exit(0);
