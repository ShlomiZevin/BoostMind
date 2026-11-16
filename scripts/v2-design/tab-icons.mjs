// The app's bottom-tab icons (Shlomi, 2026-11-16: "make the bottom tabs with emojis in the same look and feel as the whole app -
// a concept, nice emojis for every tab, make it look like an app"). Not unicode emoji (they differ per phone and clash with the
// brand - his rule: matched generated icons): ONE set drawn by the image model in one concept from the logo, on a transparent
// background, cut into one PNG per tab. gpt-image-2.6-sunburst.
//   node scripts/v2-design/tab-icons.mjs  ->  Documents/shlomiverse-v2-design/app-shell/tab-icons-sheet.png (+ cut files later)
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const LOGO = [new Blob([fs.readFileSync('C:/workspace/BoostMind/v2/site/verse/logo-512.png')], { type: 'image/png' }), 'logo.png'];

const prompt = `A SET OF FIVE APP TAB-BAR ICONS for a phone app, drawn as one cohesive family, like premium "emoji-style" 3D icons of a
top consumer app. The app is "שלומיוורס", a comedy universe; its logo (attached) is a glowing orange planet with a ring.
CONCEPT: every icon is a small glossy 3D object with a soft orange glow and a hint of the logo's planet ring orbiting it, the same
light from the top-left, the same materials (warm orange #ff6a1f, deep charcoal, cream white), the same size and visual weight, so
they read as one set on a near-black tab bar. Friendly and playful, simple silhouettes that stay readable when shown at 28px.
THE FIVE ICONS, left to right, evenly spaced in ONE horizontal row, each centred in its own equal fifth of the image, with clear empty
space between them, nothing touching:
1. HOME - a tiny cosy house sitting on top of the small orange planet.
2. VIDEOS - a vertical phone-video screen / clapperboard with a play triangle.
3. GAMES - a game controller.
4. CHAT - two speech bubbles, one orange and one cream.
5. CHARACTERS - two little comedy character faces side by side (one with round glasses, one with a big beard), cartoon, friendly.
No text, no letters, no labels, no background, no shadows on the ground, no frames around the icons. Transparent background.`;

const res = await fetch('https://api.openai.com/v1/images/edits', {
  method: 'POST', headers: { authorization: `Bearer ${OAI}` },
  body: (() => { const f = new FormData(); f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1536x1024');
    f.append('quality', 'high'); f.append('background', 'transparent'); f.append('output_format', 'png'); f.append('image[]', LOGO[0], LOGO[1]); return f; })(),
});
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, 'tab-icons-sheet.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok sheet');
