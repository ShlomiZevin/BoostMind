// Extend a picture outward (outpainting) with OpenAI's image edit: the input is a PNG whose transparent areas are
// filled to match the rest - e.g. a Zoom background shown smaller needs a wider field of view of the same room.
//   node scripts/outpaint-image.mjs <in.png with transparent margins> <out.png> "<prompt>" [quality: low|medium|high]
// Key: OPENAI_API_KEY from aspect-agent-server/.env (this repo's own key is revoked - see MARKETING.md).
import fs from 'node:fs';
import path from 'node:path';

const ENV = 'C:/workspace/aspect/aspect-agent-server/.env';
const key = fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY='))?.slice(15).trim().replace(/^["']|["']$/g, '');
if (!key) { console.error('no OPENAI_API_KEY in ' + ENV); process.exit(1); }
const [inp, out, prompt, quality = 'medium'] = process.argv.slice(2);
if (!inp || !out || !prompt) { console.error('usage: outpaint-image.mjs in.png out.png "prompt" [quality]'); process.exit(1); }

for (const model of ['gpt-image-1.5', 'gpt-image-1']) {
  const form = new FormData();
  form.append('model', model);
  form.append('image', new Blob([fs.readFileSync(inp)], { type: 'image/png' }), path.basename(inp));
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', quality);
  form.append('n', '1');
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
  const j = await r.json().catch(() => null);
  if (!r.ok) { console.error(model, 'refused:', r.status, JSON.stringify(j?.error || j).slice(0, 300)); continue; }
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) { console.error(model, 'no image in the answer'); continue; }
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('OK', model, out, j.usage ? JSON.stringify(j.usage) : '');
  process.exit(0);
}
process.exit(1);
