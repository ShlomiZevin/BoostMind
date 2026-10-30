// pictures straight from OpenAI (gpt-image-2.5 flare / sunburst) - Shlomi's rule from 30 Oct 2026, no Leonardo.
//   . ~/.plaxzy/openai-env.sh; node tools/oai-image.js --prompt-file p.txt --out art/x.png [--model flare|sunburst] [--size 1536x1024] [--quality medium] [--ref a.jpg --ref b.png] [--transparent]
// with --ref the pictures go to /v1/images/edits as references (style, the same character); without - /v1/images/generations.
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const refs = args.flatMap((a, i) => a === '--ref' ? [args[i + 1]] : []);
const MODELS = { flare: 'gpt-image-2.5-flare', sunburst: 'gpt-image-2.5-sunburst' };
const model = MODELS[arg('model', 'flare')] || arg('model'), size = arg('size', '1536x1024'), quality = arg('quality', 'medium');
const prompt = arg('prompt-file') ? fs.readFileSync(arg('prompt-file'), 'utf8') : arg('prompt');
const transparent = args.includes('--transparent'), out = arg('out'), KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('no OPENAI_API_KEY - run . ~/.plaxzy/openai-env.sh'); process.exit(1); }
if (!prompt || !out) { console.error('need --prompt/--prompt-file and --out'); process.exit(1); }
(async () => {
  let r;
  const H = { authorization: 'Bearer ' + KEY };
  if (refs.length) {
    const f = new FormData();
    f.append('model', model); f.append('prompt', prompt); f.append('size', size); f.append('quality', quality); if (transparent) { f.append('background', 'transparent'); f.append('output_format', 'png'); }
    for (const p of refs) f.append('image[]', new Blob([fs.readFileSync(p)], { type: p.endsWith('.png') ? 'image/png' : p.endsWith('.webp') ? 'image/webp' : 'image/jpeg' }), path.basename(p));
    r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: H, body: f });
  } else {
    r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ model, prompt, size, quality, ...(transparent ? { background: 'transparent', output_format: 'png' } : {}) }) });
  }
  const j = await r.json();
  if (!r.ok) { console.error('FAILED', r.status, JSON.stringify(j.error || j).slice(0, 400)); process.exit(1); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('saved', out, model, size, quality, j.usage ? JSON.stringify(j.usage) : '');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
