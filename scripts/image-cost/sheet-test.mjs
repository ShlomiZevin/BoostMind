// Re-runs existing plaxzy-studio sheets and textures on OpenAI direct with the same prompt, guide and size,
// so they can be judged against what Leonardo made.
//   node scripts/image-cost/sheet-test.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'sheet-test-out');
fs.mkdirSync(OUT, { recursive: true });
const STUDIO = 'C:/workspace/noam/plaxzy-studio';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const catalog = fs.readFileSync(path.join(STUDIO, 'catalog.jsonl'), 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const entry = (id) => catalog.find((e) => e.id === id);
const PRICE = { text: 5, image: 8, out: 30 }; // $ per 1M tokens

const RUNS = [
  { id: 'coins-medium', src: 'sheet/plaxzy-world/coins', quality: 'medium' },
  { id: 'man-high', src: 'sheet/blood-count/man', quality: 'high' },
  { id: 'man-medium', src: 'sheet/blood-count/man', quality: 'medium' },
  { id: 'deck-low', src: 'texture/plaxzy-world/deck', quality: 'low' },
  { id: 'deck-medium', src: 'texture/plaxzy-world/deck', quality: 'medium' },
  { id: 'concrete-low', src: 'texture/plaxzy-world/concrete-clean', quality: 'low' },
  { id: 'concrete-medium', src: 'texture/plaxzy-world/concrete-clean', quality: 'medium' },
  // a LOW-strength sheet on Leonardo: the guide gives only the style and colours
  { id: 'machines-high', src: 'sheet/arcade-hall/machines-a', quality: 'high' },
];

async function run(r) {
  const e = entry(r.src);
  const guide = e.files?.find((f) => /guide\.(png|jpe?g)$/.test(f));
  const size = e.params.size.includes('x') ? e.params.size : '1024x1024';
  const transparent = Boolean(e.params.transparent);
  const fields = { model: 'gpt-image-2.5-flare', prompt: e.prompt, size, quality: r.quality, n: 1, output_format: transparent ? 'png' : 'jpeg', ...(transparent ? { background: 'transparent' } : {}) };
  const t0 = Date.now();
  let res;
  if (guide) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    form.append('image[]', new Blob([fs.readFileSync(path.join(STUDIO, guide))], { type: /png$/.test(guide) ? 'image/png' : 'image/jpeg' }), path.basename(guide));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' }, body: JSON.stringify(fields) });
  }
  const j = await res.json();
  const secs = (Date.now() - t0) / 1000;
  if (!res.ok) return { ...r, ok: false, error: j.error?.message || `HTTP ${res.status}`, secs };
  const file = `openai-${r.id}.${transparent ? 'png' : 'jpg'}`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(j.data[0].b64_json, 'base64'));
  const u = j.usage || {};
  const usd = ((u.input_tokens_details?.text_tokens ?? 0) * PRICE.text + (u.input_tokens_details?.image_tokens ?? 0) * PRICE.image + (u.output_tokens ?? 0) * PRICE.out) / 1e6;
  // the Leonardo original and its guide, copied beside it for the comparison
  const leoFile = `leonardo-${path.basename(r.src)}${path.extname(e.file)}`;
  fs.copyFileSync(path.join(STUDIO, e.file), path.join(OUT, leoFile));
  if (guide) fs.copyFileSync(path.join(STUDIO, guide), path.join(OUT, `guide-${path.basename(r.src)}${path.extname(guide)}`));
  return { ...r, ok: true, file, leoFile, guide: guide ? `guide-${path.basename(r.src)}${path.extname(guide)}` : null, secs, usd, usage: u, leo: { model: e.model, params: e.params, usd: e.usd } };
}

// ONLY=id,id runs just those (results.json is then merged, not replaced)
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const results = await Promise.all(RUNS.filter((r) => !ONLY.length || ONLY.includes(r.id)).map((r) => run(r).catch((err) => ({ ...r, ok: false, error: err.message }))));
for (const r of results) console.log(r.id, r.ok ? `$${r.usd.toFixed(4)} ${r.secs.toFixed(0)}s  (leonardo ${r.leo.model} $${r.leo.usd})` : r.error);
const prev = ONLY.length && fs.existsSync(path.join(OUT, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8')).results.filter((r) => !ONLY.includes(r.id)) : [];
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), results: [...prev, ...results] }, null, 2));
