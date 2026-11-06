// List the image models the working OpenAI key can reach (key from aspect-agent-server/.env, see MARKETING.md).
import fs from 'node:fs';
const ENV = 'C:/workspace/BoostMind/scripts/design.env';
const KEY = fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY='))?.slice(15).trim().replace(/^["']|["']$/g, '');
const r = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${KEY}` } });
const j = await r.json();
console.log('HTTP', r.status, j.error?.message || '');
console.log((j.data || []).map((m) => m.id).filter((id) => /image|dall|sunburst|flare/i.test(id)).sort().join('\n'));
