// רופא הגינה - the page's art (2026-11-14): the garden header photo + the home-screen icon. GPT Image 2.5, design key.
//   node scripts/garden/art.mjs [header|icon]  ->  Documents/shlomiverse-v2-design/garden/art-*.jpg|png
import fs from 'node:fs';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/garden';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const JOBS = {
  header: ['gpt-image-2.5-flare', '1536x1024', 'jpeg', `A warm, real photograph of a lush Israeli home garden in soft early-morning light: a lemon tree heavy with
lemons, an olive tree, a pomegranate, roses and clay pots along a stone path, an old stone house wall at the edge. Light
hazy sky in the UPPER THIRD (calm, pale, almost empty - text will sit there). Natural colours, gentle depth of field,
inviting and peaceful. No people, no text, no letters.`],
  icon: ['gpt-image-2.5-sunburst', '1024x1024', 'png', `A home-screen app icon for "רופא הגינה" (the garden doctor - an app that looks at a photo of a plant and
says what it has). One bold simple symbol centered: a fresh green leaf with a small white medical cross / heart on it,
soft 3D clay style, on a flat solid deep green background (#1f5e3b) filling the whole square edge to edge. No text, no
letters, no border, no rounded corners drawn, no shadow frame. Readable at 48px.`],
};
const only = process.argv.slice(2);
await Promise.all(Object.entries(JOBS).filter(([k]) => !only.length || only.includes(k)).map(async ([k, [model, size, fmt, prompt]]) => {
  const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, quality: 'medium', n: 1, output_format: fmt }) });
  const j = await r.json();
  if (!r.ok) return console.log('FAILED', k, j.error?.message);
  fs.writeFileSync(`${OUT}/art-${k}.${fmt === 'png' ? 'png' : 'jpg'}`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', k);
}));
