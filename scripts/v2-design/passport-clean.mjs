// The passport art cut clean (Shlomi, 2026-11-17: "make sure the passport is cut right - the corners aren't right and it has some
// black background; improve the PNG"). The old chip had hard un-smoothed corners and a beige edge; the icon had holes inside its
// stamp ring and a light edge. Redrawn from them as flat front covers on a TRUE transparent background, then sized.
//   node scripts/v2-design/passport-clean.mjs  ->  Documents/shlomiverse-v2-design/passport/
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/passport';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const ART = 'C:/workspace/BoostMind/v2/site/verse/art/';
const img = (f) => [new Blob([fs.readFileSync(ART + f)], { type: 'image/png' }), f];
const JOBS = [
  ['chip', 'passport-chip.png', 'Keep it exactly as the attached passport (no stamp on it). NO border line or frame around the edge of the cover - the navy leather runs to the rounded edge, like a real passport.'],
  ['icon', 'passport-icon.png', 'Keep it exactly as the attached passport INCLUDING its round orange stamp ring at the lower left - the ring drawn solid and whole, the passport cover visible inside it (no holes).'],
];
const only = process.argv.slice(2);
for (const [key, file, extra] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const prompt = `The attached image is a passport cover used as an app icon. Redraw it as a clean, crisp, FLAT front view of the same
passport: the same navy leather cover, the same gold Hebrew "דרכון", the same gold planet logo with "שלומיוורס" on its ring, "PASSPORT",
the same small gold chip mark at the bottom. ${extra} Straight-on, no perspective, no tilt, no shadow, no glow around it. Softly rounded
corners, smooth anti-aliased edges. The cover fills the whole frame edge to edge (only a hair of margin). TRUE transparent background
outside the cover - no black, no beige, no paper edge, no frame.`;
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1024x1536');
  f.append('quality', 'high'); f.append('background', 'transparent'); f.append('output_format', 'png'); f.append('image[]', ...img(file));
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.png`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
