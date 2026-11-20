// Syncs - the Shlomiverse's Zoom (his name 2026-11-20: "the Zoom app is called Syncs, with its own logo - and it must be clear that
// it's still a Zoom meeting app"). Logo concepts: GPT Image 2.6 (sunburst / flare), MEDIUM, 1024x1024, the design key.
// Concept prompts = WHAT the logo is for (never how it looks); the emphasis varies between calls.
//   node scripts/v2-design/syncs-logo.mjs [only-prefix] [--force]
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/syncs';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
if (!OAI) { console.error('no OPENAI_API_KEY in scripts/design.env (node scripts/design-env.mjs)'); process.exit(1); }
const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null, force = process.argv.includes('--force');
const PRICE = { text: 5, image: 8, out: 30 };   // $ per 1M tokens (as in scripts/image-cost)

const BASE = `Design a logo: the app icon plus the wordmark "Syncs", on one square canvas, nothing else around it.

What it is for: Syncs is the video-meeting app of the Shlomiverse - a parallel comedy universe whose residents are played as real people. In that world, Syncs is what Zoom is in ours: you open it to join a video call, several people on camera talking together. Anyone who sees the icon must understand at once that it is a video call / online meeting app. The people who live on it are a tech company's management team who never "meet" - they "sync" ("let's do a quick sync"), and the name is that corporate habit.
It must be its own brand, not a copy or a twist of Zoom's logo or any real app's logo. The wordmark is exactly "Syncs" (Latin letters, spelled exactly so). No other text. No emoji. The wordmark must be clearly readable at a glance. At a glance nobody may mistake it for Zoom or any real app.`;

const JOBS = [
  { name: 'a-call.jpg', model: 'gpt-image-2.6-sunburst', prompt: `${BASE}\n\nThis concept puts first: a phone home-screen icon that says "video call" in a glance - the moment of joining a call with several people.` },
  { name: 'b-sync.jpg', model: 'gpt-image-2.6-flare', prompt: `${BASE}\n\nThis concept puts first: the word "sync" itself - people coming into sync with each other on a call - a mark you would remember after one look.` },
  { name: 'c-team.jpg', model: 'gpt-image-2.6-sunburst', prompt: `${BASE}\n\nThis concept puts first: a group meeting - several people on camera at once, one of them talking - as the heart of the app.` },
  { name: 'd-corporate.jpg', model: 'gpt-image-2.6-flare', prompt: `${BASE}\n\nThis concept puts first: the self-important corporate world it belongs to - the app a C-level team would proudly open - while still clearly a video meeting app.` },
  { name: 'e-verse.jpg', model: 'gpt-image-2.6-sunburst', prompt: `${BASE}

This concept puts first: that it belongs to the Shlomiverse - an app of that parallel universe, like its own social network and its own news - an app the residents of that world use every day.` },
  { name: 'f-sync.jpg', model: 'gpt-image-2.6-flare', prompt: `${BASE}

This concept puts first: people falling into sync on a video call - a simple, bold mark that works small on a phone screen.` },
  { name: 'g-call.jpg', model: 'gpt-image-2.6-sunburst', prompt: `${BASE}

This concept puts first: the camera of a video call and the word \"sync\" - one memorable symbol for joining a call.` },
];

let total = 0;
for (const j of JOBS) {
  if (only && !j.name.startsWith(only)) continue;
  const file = path.join(OUT, j.name);
  if (fs.existsSync(file) && !force) { console.log('have', j.name); continue; }
  const res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: j.model, prompt: j.prompt, size: '1024x1024', quality: 'medium', n: 1 }) });
  const r = await res.json();
  if (!res.ok) { console.error(j.name, res.status, JSON.stringify(r).slice(0, 300)); continue; }
  const u = r.usage || {}, d = u.input_tokens_details || {};
  const usd = ((d.text_tokens || 0) * PRICE.text + (d.image_tokens || 0) * PRICE.image + (u.output_tokens || 0) * PRICE.out) / 1e6;
  total += usd;
  fs.writeFileSync(file, Buffer.from(r.data[0].b64_json, 'base64'));
  console.log('made', j.name, '$' + usd.toFixed(3));
}
console.log('total $' + total.toFixed(3));
