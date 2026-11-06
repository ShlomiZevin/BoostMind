// The app icon of "המוח השני" (shlomiverse.com/mind/) - home screen / tab. GPT Image 2.5 on OpenAI direct, MEDIUM.
//   node scripts/mind/icon.mjs  ->  public/mind/icon-1024.png (scripts/mind/icon_sizes.py makes the small ones)
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `An app icon for a personal "second brain" productivity app (captures every idea, task and running job, and
tracks AI agents working for its owner). A single bold, simple symbol centered on a full-bleed square background: a
stylised brain made of a few smooth rounded shapes, with small glowing nodes connected by thin lines (like a tiny
network) inside it. Background: deep royal blue (#1d4ed8) to indigo gradient. Symbol: white with a soft warm amber
(#f5a524) glow on one node. Clean, premium, flat-with-depth iOS app icon style, no text, no letters, no border, no
rounded corners drawn (the OS rounds it), fills the frame edge to edge.`;
const res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST',
  headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-image-2.5-sunburst', prompt, size: '1024x1024', quality: 'medium', n: 1, output_format: 'png' }) });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync('C:/workspace/BoostMind/public/mind/icon-1024.png', Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
