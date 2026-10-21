#!/usr/bin/env node
// OpenAI image generation (gpt-image-2.5-flare / gpt-image-2.5-sunburst / gpt-image-2).
// Usage:
//   node oai-image.mjs --batch jobs.json --out-dir ../design [--only a,b]
//   jobs.json: [{ "key": "logo", "prompt": "...", "model": "gpt-image-2.5-flare", "size": "1536x1024", "quality": "high" }]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

function readKey() {
  const envPath = 'C:\\workspace\\aspect\\aspect-agent-server\\.env';
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find(l => l.startsWith('OPENAI_API_KEY='));
  return line.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
}

async function generate(key, job) {
  const body = {
    model: job.model || 'gpt-image-2.5-flare',
    prompt: job.prompt,
    size: job.size || '1024x1024',
    quality: job.quality || 'high',
    n: 1,
  };
  const t0 = Date.now();
  let res;
  if (job.ref) {
    // Edit endpoint with a reference image: keeps the same face across a queen's photo set.
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) form.append(k, String(v));
    for (const r of [].concat(job.ref)) form.append('image[]', new Blob([fs.readFileSync(r)], { type: 'image/png' }), path.basename(r));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json.error || json).slice(0, 400)}`);
  const d = json.data[0];
  const buf = d.b64_json ? Buffer.from(d.b64_json, 'base64') : Buffer.from(await (await fetch(d.url)).arrayBuffer());
  return { buf, secs: ((Date.now() - t0) / 1000).toFixed(0), usage: json.usage };
}

const key = readKey();
const outDir = arg('--out-dir', '.');
const only = arg('--only')?.split(',');
let jobs = JSON.parse(fs.readFileSync(arg('--batch'), 'utf8'));
if (only) jobs = jobs.filter(j => only.includes(j.key));
fs.mkdirSync(outDir, { recursive: true });

for (const job of jobs) {
  try {
    const { buf, secs, usage } = await generate(key, job);
    const out = path.join(outDir, `${job.key}.png`);
    fs.writeFileSync(out, buf);
    console.log(`OK ${job.key} -> ${out} (${(buf.length / 1024).toFixed(0)} KB, ${secs}s, ${job.model}) ${usage ? JSON.stringify(usage) : ''}`);
  } catch (e) {
    console.log(`FAIL ${job.key}: ${e.message}`);
  }
}
