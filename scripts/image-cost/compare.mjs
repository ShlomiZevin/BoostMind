// Same image jobs on OpenAI direct and on Leonardo (GPT Image 2.5 flare/sunburst) - real cost, time and output per job.
//   node scripts/image-cost/compare.mjs <outDir>
// OpenAI key: aspect-agent-server/.env (the working one, see MARKETING.md). Leonardo key: zoomcut/.env (the official one).
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'image-cost-out');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const LEO = envKey(new URL('../../zoomcut/.env', import.meta.url), 'LEONARDO_API_KEY');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REF1 = 'C:/Users/shazbak/Downloads/shlomiverse-channel/shlomi.jpg';
const REF2 = path.resolve('zoomcut/episodes/_assets/haredit/frame.jpg');
const SCENE = 'A cozy small Tel Aviv coffee shop at golden hour, a barista pouring latte art, warm window light, film photography look, shallow depth of field.';
const PORTRAIT = 'Turn the man in the first reference photo into a 1970s vintage film-photo portrait: same face and beard, wearing a brown corduroy jacket, sitting in a retro living room, warm grain, natural light.';
const TWO_REF = 'The man from the first reference photo standing inside the room shown in the second reference photo, natural light, same face, photographic, candid.';

const JOBS = [
  { id: 'A', label: 'Text to image, square', model: 'flare', q: 'MEDIUM', w: 1024, h: 1024, prompt: SCENE },
  { id: 'B', label: 'Same, Sunburst', model: 'sunburst', q: 'MEDIUM', w: 1024, h: 1024, prompt: SCENE },
  { id: 'C', label: 'Portrait 2:3', model: 'flare', q: 'MEDIUM', w: 1024, h: 1536, prompt: SCENE },
  { id: 'D', label: 'LOW quality', model: 'flare', q: 'LOW', w: 1024, h: 1024, prompt: SCENE },
  { id: 'E', label: 'HIGH quality', model: 'flare', q: 'HIGH', w: 1024, h: 1024, prompt: SCENE },
  { id: 'F', label: 'Custom 16:9 (1536x864)', model: 'flare', q: 'MEDIUM', w: 1536, h: 864, prompt: SCENE },
  { id: 'G', label: '1 reference photo (face)', model: 'flare', q: 'MEDIUM', w: 1024, h: 1536, prompt: PORTRAIT, refs: [REF1] },
  { id: 'H', label: '2 reference photos, Sunburst', model: 'sunburst', q: 'MEDIUM', w: 1024, h: 1536, prompt: TWO_REF, refs: [REF1, REF2] },
];

// ---------- OpenAI direct ----------
const PRICE = { text: 5, image: 8, out: 30 }; // $ per 1M tokens, developers.openai.com/api/docs/pricing (2026-10-30)
async function openai(job) {
  const model = `gpt-image-2.5-${job.model}`;
  const common = { model, prompt: job.prompt, size: `${job.w}x${job.h}`, quality: job.q.toLowerCase(), n: 1, output_format: 'jpeg', output_compression: 90 };
  let res;
  const t0 = Date.now();
  if (job.refs) {
    const form = new FormData();
    for (const [k, v] of Object.entries(common)) form.append(k, String(v));
    for (const r of job.refs) form.append('image[]', new Blob([fs.readFileSync(r)], { type: 'image/jpeg' }), path.basename(r));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' }, body: JSON.stringify(common) });
  }
  const j = await res.json();
  const secs = (Date.now() - t0) / 1000;
  if (!res.ok) return { ok: false, error: j.error?.message || `HTTP ${res.status}`, secs };
  const file = `openai-${job.id}.jpg`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(j.data[0].b64_json, 'base64'));
  const u = j.usage || {};
  const textIn = u.input_tokens_details?.text_tokens ?? u.input_tokens ?? 0;
  const imageIn = u.input_tokens_details?.image_tokens ?? 0;
  const out = u.output_tokens ?? 0;
  const usd = (textIn * PRICE.text + imageIn * PRICE.image + out * PRICE.out) / 1e6;
  return { ok: true, file, secs, usd, usage: u };
}

// ---------- Leonardo (same calls as zoomcut/tools/leonardo.mjs) ----------
const API = 'https://cloud.leonardo.ai/api/rest';
const lh = () => ({ authorization: `Bearer ${LEO}`, accept: 'application/json', 'content-type': 'application/json' });
async function upload(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const { uploadInitImage } = await (await fetch(`${API}/v1/init-image`, { method: 'POST', headers: lh(), body: JSON.stringify({ extension: ext }) })).json();
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(uploadInitImage.fields))) form.append(k, v);
  form.append('file', new Blob([fs.readFileSync(file)]), `ref.${ext}`);
  const put = await fetch(uploadInitImage.url, { method: 'POST', body: form });
  if (!put.ok) throw new Error(`upload ${put.status}`);
  return uploadInitImage.id;
}
async function leonardo(job) {
  const t0 = Date.now();
  try {
    const parameters = { prompt: job.prompt, quantity: 1, width: job.w, height: job.h, quality: job.q, prompt_enhance: 'OFF' };
    if (job.refs) parameters.guidances = { image_reference: await Promise.all(job.refs.map(async (r) => ({ image: { id: await upload(r), type: 'UPLOADED' }, strength: 'HIGH' }))) };
    const res = await fetch(`${API}/v2/generations`, { method: 'POST', headers: lh(), body: JSON.stringify({ public: false, model: `openai/gpt-image-2.5-${job.model}`, parameters }) });
    const j = await res.json().catch(() => null);
    const id = j?.generate?.generationId;
    if (!res.ok || !id) return { ok: false, error: JSON.stringify(j).slice(0, 300), secs: (Date.now() - t0) / 1000 };
    const usd = parseFloat(j.generate.cost?.amount ?? 'NaN');
    for (let i = 0; i < 100; i++) {
      await sleep(2500);
      const g = await (await fetch(`${API}/v1/generations/${id}`, { headers: lh() })).json();
      const gen = g.generations_by_pk || g;
      if (gen.status === 'FAILED') return { ok: false, error: 'FAILED', secs: (Date.now() - t0) / 1000, usd };
      const url = gen.status === 'COMPLETE' && gen.generated_images?.[0]?.url;
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const file = `leonardo-${job.id}.jpg`;
      fs.writeFileSync(path.join(OUT, file), buf);
      return { ok: true, file, secs: (Date.now() - t0) / 1000, usd, cost: j.generate.cost };
    }
    return { ok: false, error: 'timeout', secs: (Date.now() - t0) / 1000, usd };
  } catch (e) { return { ok: false, error: e.message, secs: (Date.now() - t0) / 1000 }; }
}

const balance = async () => (await (await fetch(`${API}/v1/me`, { headers: lh() })).json()).user_details?.[0]?.apiPaidTokens;
const before = await balance();
const results = await Promise.all(JOBS.map(async (job) => {
  const [o, l] = await Promise.all([openai(job).catch((e) => ({ ok: false, error: e.message })), leonardo(job)]);
  console.log(job.id, job.label, '| openai', o.ok ? `$${o.usd.toFixed(4)} ${o.secs.toFixed(0)}s` : o.error, '| leonardo', l.ok ? `$${l.usd} ${l.secs.toFixed(0)}s` : l.error);
  return { ...job, refs: job.refs?.map((r) => path.basename(r)), openai: o, leonardo: l };
}));
await sleep(5000);
const after = await balance();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), leonardoTokens: { before, after }, results }, null, 2));
for (const r of [REF1, REF2]) fs.copyFileSync(r, path.join(OUT, 'ref-' + path.basename(r)));
console.log('leonardo paid tokens', before, '->', after);
