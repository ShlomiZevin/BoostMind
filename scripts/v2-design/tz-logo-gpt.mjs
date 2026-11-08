// ציפציפ's mark painted by GPT Image from the approved P1 (his note 2026-11-08 on the vector redraw: "the circle goes into
// the bird's head - maybe use GPT image to have it painted right; the concept is perfect, the looks need a light fix").
// The approved picture goes in as the reference; out come clean versions on a transparent background.
//   node scripts/v2-design/tz-logo-gpt.mjs [names...]   ->  Documents/shlomiverse-v2-design/tz-logo/G-*.png
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/workspace/BoostMind';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/tz-logo';
const KEY = /OPENAI_API_KEY=(.+)/.exec(fs.readFileSync(`${ROOT}/scripts/design.env`, 'utf8'))[1].trim().replace(/^["']|["']$/g, '');
const REF = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/feed-logos/tziftzif-mark.png';

const BASE = `Redraw the logo mark in this reference picture - ONLY the mark (the round bird inside a planet ring, shaped like a speech bubble), no letters, no words.
Keep the concept and the composition exactly: a big round bird body; a short speech-bubble tail at the bottom left; one big round eye high on the right; a small open beak (two pointed jaws) on the upper right edge; a wide flat planet ring tilted HIGH on the left and LOW on the right.
Fix the drawing so it reads perfectly as a professional app logo: the ring clearly passes BEHIND the bird at the back (hidden by the body) and IN FRONT of the bird across the LOWER part of the body only - it never touches or cuts the head, the eye or the beak; where the ring passes in front there is a thin clean gap between ring and body. Perfect symmetry of the ellipse, smooth even line weights, crisp edges, centred with comfortable margins.`;
const V = {
  flat: `${BASE}\nStyle: flat vector logo, no gradients, no glow, no shadow. Bird body solid near-black #1c1c22, ring and beak solid orange #ff7a1f, eye solid white. Transparent background.`,
  neon: `${BASE}\nStyle: the reference's dark neon look but cleaner: the bird body filled near-black #0b0b0e with a bright orange #ff7a1f outline, the ring and beak solid orange, a soft even orange glow, eye white. Transparent background outside the glow.`,
  // the browser tab's icon (his note: "the logo on the tab is still not good"): the same mark simplified for 16-32px
  fav: `Make a FAVICON of the logo mark in this reference picture - the version of the mark that stays clear at 16x16 and 32x32 pixels in a browser tab. No letters, no words.
A rounded orange #ff7a1f square filling the whole picture; on it the mark in solid white, as BIG as possible: the round bird body, ONE big round eye (cut out, orange), a small bold beak on the upper right, and the planet ring as ONE thick bold band tilted high on the left and low on the right, crossing the lower part of the body with a clear orange gap between band and body. Drop every thin detail (the speech-bubble tail may stay only if it is bold and short). Very few, very bold shapes, perfectly crisp flat vector, no glow, no shadow, no gradient.`,
  white: `${BASE}\nStyle: one-colour flat vector logo, everything solid white #ffffff (body, ring, beak); the eye and the gap between ring and body are cut out (transparent). No glow, no shadow. Transparent background.`,
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(V);
await Promise.all(want.map(async (k) => {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2.6-flare');
  fd.append('image[]', new Blob([fs.readFileSync(REF)], { type: 'image/png' }), 'ref.png');
  fd.append('prompt', V[k]);
  fd.append('size', '1024x1024');
  fd.append('quality', 'high');
  fd.append('background', k === 'fav' ? 'opaque' : 'transparent');
  fd.append('output_format', 'png');
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: fd });
  const j = await r.json();
  if (!r.ok) { console.error(k, r.status, j.error?.message); return; }
  const f = path.join(OUT, `G-${k}.png`);
  fs.writeFileSync(f, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', f);
}));
