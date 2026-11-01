// Same voice / sound-effect / music jobs on ElevenLabs directly and on Leonardo - real cost, time and the files.
//   node scripts/audio-cost/compare.mjs <outDir>
// Keys: ELEVENLABS_API_KEY and LEONARDO_API_KEY from zoomcut/.env; OPENAI_API_KEY (to transcribe the voices) from aspect-agent-server/.env.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = path.resolve(process.argv[2] || 'audio-cost-out');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const ZENV = new URL('../../zoomcut/.env', import.meta.url);
const EL = envKey(ZENV, 'ELEVENLABS_API_KEY');
const LEO = envKey(ZENV, 'LEONARDO_API_KEY');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Creator plan: $22 a month for 121,000 credits (elevenlabs.io/pricing, 30 Oct 2026)
const USD_PER_CREDIT = 22 / 121000;

const JOBS = [
  { id: 'v-announcer', kind: 'voice', label: 'Announcer, shouted (audio tags)', voice: 'TX3LPaxmHKxFdv7VOQHJ', lang: 'en',
    text: '[screaming] HERE IT COMES! THE FINISHER!!! ... ... [yelling] IT IS ALL OVER!!! ... ... [shouting] WHAT A REVERSAL!!!' },
  { id: 'v-calm', kind: 'voice', label: 'Calm narrator', voice: 'JBFqnCBsd6RMkjVDRZzb', lang: 'en',
    text: 'Welcome back, traveller. The gate opens at dawn, and the road to the mountain is long. Rest while you can.' },
  { id: 'v-hebrew', kind: 'voice', label: 'Hebrew line', voice: 'JBFqnCBsd6RMkjVDRZzb', lang: 'he',
    text: 'שלום, וברוכים הבאים למשחק! מוכנים? שלוש, שתיים, אחת... יאללה, מתחילים!' },
  { id: 's-chew', kind: 'sfx', label: 'Cartoon chew, 1 s', secs: 1, loop: false,
    text: 'Quick happy cartoon chewing, three crunchy little munches, close. Game sound effect. No voice, no speech, no music.' },
  { id: 's-screech', kind: 'sfx', label: 'Beetle queen screech, 2 s', secs: 2, loop: false,
    text: "A giant beetle queen's angry chittering screech, clicking mandibles, big and cartoonish. Game sound effect. No voice, no speech, no music." },
  { id: 's-crowd', kind: 'sfx', label: 'Arena crowd loop, 16 s', secs: 16, loop: true,
    text: 'Fifteen thousand fans in an arena: steady loud crowd ambience with excited shouts, no sudden peaks, loopable. No voice, no speech, no music.' },
  { id: 'm-theme', kind: 'music', label: 'Wrestling game theme, 60 s', secs: 60,
    text: "High-energy 90s arcade pro wrestling video game theme: crunchy distorted electric guitars with a heavy riff, driving rock drums, punchy slap bass, big brass stabs and a hype rock anthem feel like a wrestler's entrance, 140 bpm. Instrumental. About one minute long." },
];

// ---------- ElevenLabs direct ----------
const elCredits = async () => (await (await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': EL } })).json()).character_count;
async function eleven(job) {
  const h = { 'xi-api-key': EL, 'content-type': 'application/json', accept: 'audio/mpeg' };
  let url, body;
  if (job.kind === 'voice') {
    url = `https://api.elevenlabs.io/v1/text-to-speech/${job.voice}?output_format=mp3_44100_128`;
    body = { text: job.text, model_id: 'eleven_v3', language_code: job.lang };
  } else if (job.kind === 'sfx') {
    url = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
    body = { text: job.text, model_id: 'eleven_text_to_sound_v2', duration_seconds: job.secs, prompt_influence: 0.7, loop: job.loop };
  } else {
    url = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128';
    body = { prompt: job.text, music_length_ms: job.secs * 1000, model_id: 'music_v1', force_instrumental: true };
  }
  const before = await elCredits();
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const secs = (Date.now() - t0) / 1000;
  if (!res.ok) return { ok: false, error: (await res.text()).slice(0, 400), secs };
  const file = `eleven-${job.id}.mp3`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(await res.arrayBuffer()));
  const header = res.headers.get('character-cost') || res.headers.get('x-character-count');
  // the balance can lag a moment behind the call
  let after = before;
  for (let i = 0; i < 6 && after === before; i++) { await sleep(1500); after = await elCredits(); }
  const credits = after - before;
  return { ok: true, file, secs, credits, header, usd: credits * USD_PER_CREDIT };
}

// ---------- Leonardo (the same calls plaxzy-studio's gen.js makes) ----------
const API = 'https://cloud.leonardo.ai/api/rest';
const lh = { authorization: `Bearer ${LEO}`, accept: 'application/json', 'content-type': 'application/json' };
function findAudioUrl(o, d = 0) {
  if (!o || d > 6) return null;
  if (typeof o === 'string') return /^https?:\/\/\S+\.(mp3|wav|ogg|m4a)(\?\S*)?$/i.test(o) ? o : null;
  if (typeof o !== 'object') return null;
  for (const k of Object.keys(o)) { const u = findAudioUrl(o[k], d + 1); if (u) return u; }
  return null;
}
async function leonardo(job) {
  let model, parameters;
  if (job.kind === 'voice') { model = 'dialogue-v3'; parameters = { prompt: job.text, voice_id: job.voice, language_code: job.lang, prompt_influence: 0.5, quantity: 1 }; }
  else if (job.kind === 'sfx') { model = 'sound-effects-v2'; parameters = { prompt: job.text, duration: job.secs, prompt_influence: 0.7, loop: job.loop, quantity: 1 }; }
  else { model = 'music-v1'; parameters = { prompt: job.text, force_instrumental: true, quantity: 1 }; }
  const t0 = Date.now();
  const res = await fetch(`${API}/v2/generations`, { method: 'POST', headers: lh, body: JSON.stringify({ model, public: false, parameters }) });
  const json = await res.json().catch(() => null);
  const id = json?.generate?.generationId || json?.generationId;
  if (!id) return { ok: false, error: JSON.stringify(json).slice(0, 400), secs: (Date.now() - t0) / 1000 };
  const usd = parseFloat(json.generate?.cost?.amount ?? '0') || 0;
  for (let i = 0; i < 240; i++) {
    await sleep(2000);
    const j = await (await fetch(`${API}/v1/generations/${id}`, { headers: lh })).json().catch(() => null);
    const gen = j && (j.generations_by_pk || j.generation || j);
    if (gen?.status === 'FAILED') return { ok: false, error: 'FAILED', usd, secs: (Date.now() - t0) / 1000 };
    const url = findAudioUrl(gen);
    if (!url) continue;
    const a = await fetch(encodeURI(url), { headers: { 'user-agent': 'Mozilla/5.0' } });
    const file = `leonardo-${job.id}.mp3`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(await a.arrayBuffer()));
    return { ok: true, file, usd, secs: (Date.now() - t0) / 1000 };
  }
  return { ok: false, error: 'timeout', usd, secs: (Date.now() - t0) / 1000 };
}

// ---------- what can be measured without ears ----------
const FFMPEG = 'C:/Users/shazbak/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
function stats(file) {
  const f = path.join(OUT, file);
  const r = (() => { try { return execFileSync(FFMPEG, ['-hide_banner', '-i', f, '-af', 'ebur128=peak=true,silencedetect=noise=-45dB:d=0.4', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String(e.stderr || e.stdout || ''); } })();
  return r;
}
async function transcribe(file, lang) {
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('language', lang);
  form.append('file', new Blob([fs.readFileSync(path.join(OUT, file))], { type: 'audio/mpeg' }), file);
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await r.json();
  return j.text || j.error?.message || '';
}

// Leonardo jobs all at once; ElevenLabs one by one, so each call's credits can be read off the balance
const leoP = Promise.all(JOBS.map((j) => leonardo(j).catch((e) => ({ ok: false, error: e.message }))));
const el = [];
for (const j of JOBS) { el.push(await eleven(j).catch((e) => ({ ok: false, error: e.message }))); console.log('eleven', j.id, el.at(-1).ok ? `${el.at(-1).credits} credits ${el.at(-1).secs.toFixed(0)}s` : el.at(-1).error); }
const leo = await leoP;
JOBS.forEach((j, i) => console.log('leonardo', j.id, leo[i].ok ? `$${leo[i].usd} ${leo[i].secs.toFixed(0)}s` : leo[i].error));

const results = [];
for (let i = 0; i < JOBS.length; i++) {
  const j = JOBS[i], r = { ...j, eleven: el[i], leonardo: leo[i] };
  for (const side of ['eleven', 'leonardo']) {
    if (!r[side].ok) continue;
    const log = stats(r[side].file);
    const dur = (log.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).map(Number);
    r[side].duration = dur.length ? dur[0] * 3600 + dur[1] * 60 + dur[2] : null;
    r[side].lufs = Number((log.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]);
    r[side].peak = Number((log.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1]);
    r[side].silences = (log.match(/silence_duration: [\d.]+/g) || []).map((s) => Number(s.split(': ')[1]));
    if (j.kind === 'voice') r[side].heard = await transcribe(r[side].file, j.lang);
  }
  results.push(r);
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), usdPerCredit: USD_PER_CREDIT, results }, null, 2));
console.log('done');
