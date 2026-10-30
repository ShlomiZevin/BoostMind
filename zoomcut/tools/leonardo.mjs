// Sketch pictures and sounds: backgrounds, portraits from a reference photo, sound effects, looping beds, AI video.
// Pictures go to OpenAI and sounds to ElevenLabs DIRECTLY - the same models Leonardo resells (GPT Image 2.5 flare /
// sunburst; ElevenLabs sound effects), 30-67% cheaper for pictures and ~4x for sound (measured 2026-10-30, his ask:
// "move Sketch Studio off Leonardo"). Leonardo only when the direct call refuses or fails, or its key is missing, and
// for `video` (seedance - neither OpenAI nor ElevenLabs makes video). The file keeps its name so every command still works.
//   node tools/leonardo.mjs balance                                     (Leonardo's tokens)
//   node tools/leonardo.mjs portrait <ref.png> <prompt.txt> <out.jpg> [flare|sunburst] [HIGH|MEDIUM] [refStrength] [WxH]
//   node tools/leonardo.mjs image <prompt.txt> <out.jpg> [flare|sunburst] [HIGH|MEDIUM] [WxH]
//   node tools/leonardo.mjs loop <prompt.txt> <out.mp3> <seconds>
//   node tools/leonardo.mjs sfx  <prompt.txt> <out.mp3> <seconds>     one-shot effect (phone ring, a voice off-screen)
//   --leonardo (anywhere) = skip the direct call, straight to Leonardo
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://cloud.leonardo.ai/api/rest';
// the studio's own keys only (zoomcut/.env). Never another project's: each project runs on its own keys (his ask,
// 2026-10-27) - a missing key falls back or stops here instead of borrowing one
const ENV = new URL('../.env', import.meta.url);
const envKey = (name) => { try { return fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') || null; } catch { return null; } };
const KEY = envKey('LEONARDO_API_KEY'), OPENAI = envKey('OPENAI_API_KEY'), ELEVEN = envKey('ELEVENLABS_API_KEY');
const needLeonardo = () => { if (!KEY) { console.error('LEONARDO_API_KEY missing in zoomcut/.env - the editor uses its own key only'); process.exit(1); } };
const MODEL = { flare: 'openai/gpt-image-2.5-flare', sunburst: 'openai/gpt-image-2.5-sunburst' };
const headers = () => ({ authorization: `Bearer ${KEY}`, accept: 'application/json', 'content-type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upload(file) {
  const extension = path.extname(file).slice(1).toLowerCase() || 'png';
  const init = await fetch(`${API}/v1/init-image`, { method: 'POST', headers: headers(), body: JSON.stringify({ extension }) });
  const { uploadInitImage } = await init.json();
  if (!uploadInitImage) throw new Error('reference upload refused');
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(uploadInitImage.fields))) form.append(k, v);
  form.append('file', new Blob([fs.readFileSync(file)]), `reference.${extension}`);
  const put = await fetch(uploadInitImage.url, { method: 'POST', body: form });
  if (!put.ok) throw new Error(`reference upload failed (${put.status})`);
  return uploadInitImage.id;
}

async function queue(body) {
  const res = await fetch(`${API}/v2/generations`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  const id = json?.generate?.generationId;
  if (!res.ok || !id) throw new Error(`rejected (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 900)}`);
  return { id, usd: parseFloat(json.generate.cost?.amount ?? '0') || 0 };
}

function findUrl(o, re, depth = 0) {
  if (!o || depth > 6) return null;
  if (typeof o === 'string') return re.test(o) ? o : null;
  if (typeof o !== 'object') return null;
  for (const k of Object.keys(o)) { const u = findUrl(o[k], re, depth + 1); if (u) return u; }
  return null;
}

async function collect(id, re, out) {
  for (let i = 0; i < 120; i++) {
    await sleep(3000);
    const p = await fetch(`${API}/v1/generations/${id}`, { headers: headers() });
    const j = await p.json().catch(() => null);
    const gen = j && (j.generations_by_pk || j.generation || j);
    if (gen?.status === 'FAILED') throw new Error(`failed: ${JSON.stringify(gen).slice(0, 600)}`);
    const url = gen?.status === 'COMPLETE' || re.source.includes('mp3') ? findUrl(gen, re) : null;
    if (!url) continue;
    const a = await fetch(encodeURI(decodeURI(url)), { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!a.ok) throw new Error(`download failed (${a.status})`);
    const buf = Buffer.from(await a.arrayBuffer());
    if (buf.length < 2000) throw new Error('download was empty');
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, buf);
    return { bytes: buf.length, url };
  }
  throw new Error(`timed out (generation ${id})`);
}


// ---- direct: OpenAI pictures, ElevenLabs sounds -------------------------------------------------------------------
// OpenAI's list price for GPT Image 2.5 (flare and sunburst alike), $ per 1M tokens
const OPENAI_PRICE = { text: 5, image: 8, out: 30 };
// OpenAI has no reference-strength dial - the prompt carries it (tested 2026-10-30: faces held at every level)
const HOLD = (st) => {
  const v = { HIGH: 0.85, MID: 0.6, LOW: 0.4 }[String(st).toUpperCase()] ?? (parseFloat(st) || 0.6);
  return v >= 0.75 ? 'Keep exactly the face, pose and position of the person in the reference image; change only what the description asks.'
    : v >= 0.55 ? 'Keep the face, hair and features of the person in the reference image exactly - the same person, unmistakably - in the new scene described.'
    : 'The same person as in the reference image (keep the face recognisable); the scene, clothes and framing follow the description freely.';
};
async function openaiImage({ prompt, model, w, h, quality, refs, out }) {
  const r16 = (x) => Math.max(16, Math.round(x / 16) * 16);
  const fields = { model: 'gpt-image-2.5-' + model, prompt, size: `${r16(w)}x${r16(h)}`, quality: String(quality).toLowerCase(), n: 1 };
  const png = /\.png$/i.test(out);
  fields.output_format = png ? 'png' : 'jpeg';
  if (!png) fields.output_compression = 92;
  const auth = { authorization: `Bearer ${OPENAI}` };
  let res;
  if (refs.length) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    for (const r of refs) form.append('image[]', new Blob([fs.readFileSync(r)], { type: /\.png$/i.test(r) ? 'image/png' : /\.webp$/i.test(r) ? 'image/webp' : 'image/jpeg' }), path.basename(r));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(fields) });
  }
  const j = await res.json().catch(() => null);
  const b64 = j?.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  const u = j.usage || {}, d = u.input_tokens_details || {};
  const usd = ((d.text_tokens || 0) * OPENAI_PRICE.text + (d.image_tokens || 0) * OPENAI_PRICE.image + (u.output_tokens || 0) * OPENAI_PRICE.out) / 1e6;
  const buf = Buffer.from(b64, 'base64');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, buf);
  return { bytes: buf.length, usd };
}
// ElevenLabs bills plan credits (the character-cost header; 10 a second for sound effects) - $ at the Creator plan, $22 / 121,000
async function elevenSfx({ prompt, secs, loop, out }) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { method: 'POST',
    headers: { 'xi-api-key': ELEVEN, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: prompt, model_id: 'eleven_text_to_sound_v2', duration_seconds: Math.max(0.5, Math.min(30, secs)), prompt_influence: 0.7, loop }) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error('empty sound');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, buf);
  const credits = Number(res.headers.get('character-cost')) || 0;
  return { bytes: buf.length, credits, usd: credits * 22 / 121000 };
}
// the direct call first; on a refusal / error / missing key: say why, then Leonardo
async function direct(label, have, fn) {
  if (process.argv.includes('--leonardo')) return null;
  if (!have) { console.log(`(no ${label} key in zoomcut/.env - Leonardo)`); return null; }
  try { return await fn(); } catch (e) { console.log(`${label} refused or failed: ${String(e.message).slice(0, 300)} - trying Leonardo`); return null; }
}

const IMG = /^https?:\/\/\S+\.(png|jpe?g|webp)(\?\S*)?$/i;
const AUD = /^https?:\/\/\S+\.(mp3|wav|ogg|m4a)(\?\S*)?$/i;
const [cmd, ...a] = process.argv.slice(2).filter((x) => x !== '--leonardo');

if (cmd === 'balance') {
  needLeonardo();
  const me = (await (await fetch(`${API}/v1/me`, { headers: headers() })).json()).user_details?.[0] || {};
  console.log(`paid tokens: ${me.apiPaidTokens ?? '?'}  subscription tokens: ${me.apiSubscriptionTokens ?? '?'}`);
} else if (cmd === 'portrait' || cmd === 'image') {
  const ref = cmd === 'portrait' ? a.shift() : null;
  const [promptFile, out, model = 'flare', quality = 'HIGH'] = a;
  const strength = ref ? (a[4] || 'HIGH') : null;
  const dims = ((ref ? a[5] : a[4]) || '1024x1536').split('x').map(Number);
  const prompt = fs.readFileSync(promptFile, 'utf8').trim();
  const refs = ref ? ref.split(',') : [];
  const d = await direct('OpenAI', OPENAI, () => openaiImage({ prompt: refs.length ? `${prompt}\n\n${HOLD(strength)}` : prompt,
    model: MODEL[model] ? model : String(model).replace(/^.*gpt-image-2\.5-/, ''), w: dims[0], h: dims[1], quality, refs, out }));
  if (d) { console.log(`OK -> ${out}  ${(d.bytes / 1024).toFixed(0)} kB  $${d.usd.toFixed(4)}  (OpenAI direct)`); process.exit(0); }
  needLeonardo();
  const parameters = { prompt, quantity: 1, width: dims[0], height: dims[1], quality, prompt_enhance: 'OFF' };
  // several references: comma-separated paths
  if (ref) parameters.guidances = { image_reference: await Promise.all(ref.split(',').map(async (r) => ({ image: { id: await upload(r), type: 'UPLOADED' }, strength }))) };
  const q = await queue({ public: false, model: MODEL[model] || model, parameters });
  console.log(`queued ${q.id}  quoted $${q.usd}`);
  const r = await collect(q.id, IMG, out);
  console.log(`OK -> ${out}  ${(r.bytes / 1024).toFixed(0)} kB  $${q.usd}`);
} else if (cmd === 'loop' || cmd === 'sfx') {
  const [promptFile, out, secs = '20'] = a;
  const d = await direct('ElevenLabs', ELEVEN, () => elevenSfx({ prompt: fs.readFileSync(promptFile, 'utf8').trim(), secs: Number(secs), loop: cmd === 'loop', out }));
  if (d) { console.log(`OK -> ${out}  ${(d.bytes / 1024).toFixed(0)} kB  ${d.credits} credits = $${d.usd.toFixed(4)}  (ElevenLabs direct)`); process.exit(0); }
  needLeonardo();
  const q = await queue({ model: 'sound-effects-v2', public: false, parameters: { prompt: fs.readFileSync(promptFile, 'utf8').trim(), duration: Number(secs), prompt_influence: 0.7, loop: cmd === 'loop', quantity: 1 } });
  console.log(`queued ${q.id}  quoted $${q.usd}`);
  const r = await collect(q.id, AUD, out);
  console.log(`OK -> ${out}  ${(r.bytes / 1024).toFixed(0)} kB  $${q.usd}`);
} else if (cmd === 'video') {
  needLeonardo();
  // node tools/leonardo.mjs video <prompt.txt> <out.mp4> [model] [seconds] [WxH] [start.jpg|-] [end.jpg|-] [ref.jpg|-]
  // cheapest: seedance-2.0-mini, low resolution, no audio
  const [promptFile, out, model = 'seedance-2.0-mini', secs = '5', size = '480x864', start = '-', end = '-'] = a;
  const [w, h] = size.split('x').map(Number);
  const parameters = { prompt: fs.readFileSync(promptFile, 'utf8').trim(), quantity: 1, duration: Number(secs), width: w, height: h, motion_has_audio: false };
  const g = {};
  if (start !== '-') g.start_frame = [{ image: { id: await upload(start), type: 'UPLOADED' } }];
  if (end !== '-') g.end_frame = [{ image: { id: await upload(end), type: 'UPLOADED' } }];
  const ref = a[7];  // a look to follow (Mini takes no end frame): image_reference
  if (ref && ref !== '-') g.image_reference = [{ image: { id: await upload(ref), type: 'UPLOADED' }, strength: 'MID' }];
  if (Object.keys(g).length) parameters.guidances = g;
  const q = await queue({ public: false, model, parameters });
  console.log(`queued ${q.id}  quoted $${q.usd}`);
  const r = await collect(q.id, /^https?:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i, out);
  console.log(`OK -> ${out}  ${(r.bytes / 1024).toFixed(0)} kB  $${q.usd}`);
} else {
  console.log('balance | portrait | image | loop | sfx | video');
}
