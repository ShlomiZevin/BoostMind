// Sketch assets from Leonardo's v2 API (GPT Image 2.5 only): backgrounds, portraits from a reference photo, sound effects.
//   node tools/leonardo.mjs balance
//   node tools/leonardo.mjs portrait <ref.png> <prompt.txt> <out.jpg> [flare|sunburst] [HIGH|MEDIUM] [refStrength] [WxH]
//   node tools/leonardo.mjs image <prompt.txt> <out.jpg> [flare|sunburst] [HIGH|MEDIUM] [WxH]
//   node tools/leonardo.mjs loop <prompt.txt> <out.mp3> <seconds>
//   node tools/leonardo.mjs sfx  <prompt.txt> <out.mp3> <seconds>     one-shot effect (phone ring, a voice off-screen)
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://cloud.leonardo.ai/api/rest';
// the studio's own key only (zoomcut/.env - his official Leonardo account, 2026-10-26). Never aspect's: the two
// projects run on separate Leonardo keys (his ask, 2026-10-27) - a missing key stops here instead of borrowing one
const ENV = new URL('../.env', import.meta.url);
const KEY = (() => { try { return fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('LEONARDO_API_KEY='))?.slice(17).trim(); } catch { return null; } })();
if (!KEY) { console.error('LEONARDO_API_KEY missing in zoomcut/.env - the editor uses its own key only'); process.exit(1); }
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

const IMG = /^https?:\/\/\S+\.(png|jpe?g|webp)(\?\S*)?$/i;
const AUD = /^https?:\/\/\S+\.(mp3|wav|ogg|m4a)(\?\S*)?$/i;
const [cmd, ...a] = process.argv.slice(2);

if (cmd === 'balance') {
  const me = (await (await fetch(`${API}/v1/me`, { headers: headers() })).json()).user_details?.[0] || {};
  console.log(`paid tokens: ${me.apiPaidTokens ?? '?'}  subscription tokens: ${me.apiSubscriptionTokens ?? '?'}`);
} else if (cmd === 'portrait' || cmd === 'image') {
  const ref = cmd === 'portrait' ? a.shift() : null;
  const [promptFile, out, model = 'flare', quality = 'HIGH'] = a;
  const strength = ref ? (a[4] || 'HIGH') : null;
  const dims = ((ref ? a[5] : a[4]) || '1024x1536').split('x').map(Number);
  const parameters = { prompt: fs.readFileSync(promptFile, 'utf8').trim(), quantity: 1, width: dims[0], height: dims[1], quality, prompt_enhance: 'OFF' };
  // several references: comma-separated paths
  if (ref) parameters.guidances = { image_reference: await Promise.all(ref.split(',').map(async (r) => ({ image: { id: await upload(r), type: 'UPLOADED' }, strength }))) };
  const q = await queue({ public: false, model: MODEL[model] || model, parameters });
  console.log(`queued ${q.id}  quoted $${q.usd}`);
  const r = await collect(q.id, IMG, out);
  console.log(`OK -> ${out}  ${(r.bytes / 1024).toFixed(0)} kB  $${q.usd}`);
} else if (cmd === 'loop' || cmd === 'sfx') {
  const [promptFile, out, secs = '20'] = a;
  const q = await queue({ model: 'sound-effects-v2', public: false, parameters: { prompt: fs.readFileSync(promptFile, 'utf8').trim(), duration: Number(secs), prompt_influence: 0.7, loop: cmd === 'loop', quantity: 1 } });
  console.log(`queued ${q.id}  quoted $${q.usd}`);
  const r = await collect(q.id, AUD, out);
  console.log(`OK -> ${out}  ${(r.bytes / 1024).toFixed(0)} kB  $${q.usd}`);
} else if (cmd === 'video') {
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
