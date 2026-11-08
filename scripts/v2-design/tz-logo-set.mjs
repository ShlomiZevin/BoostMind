// ציפציפ's final logo (renamed from ציפציף 2026-11-08 - his note: the regular פ at the end is nicer) in its layouts (his ask 2026-11-08: "give me the final ציפציף logo in different styles") - all from the
// mark he picked (feed-logos/P1-tziftzif-final.jpg: the planet-bird speech bubble), no tagline. GPT Image 2.5 sunburst, MEDIUM.
//   node scripts/v2-design/tz-logo-set.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/tz-logo/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'tz-logo');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const REF = [new Blob([fs.readFileSync(`${DESIGN}/feed-logos/P1-tziftzif-final.jpg`)], { type: 'image/jpeg' }), 'tziftzif.jpg'];

const BASE = `The attached image is the APPROVED logo of "ציפציף" (a social network): the mark is a round speech bubble shaped like a small
bird (dot eye, short open beak on the right, the bubble's tail at the bottom left) with a glowing orange orbit ring around it, like a
planet; the wordmark is "ציפציפ" in heavy rounded Hebrew letters - the first half "ציפ" (on the right) white, the second half "ציף"
(on the left) orange #ff7a1f. Keep the mark and the letter style EXACTLY as in the attached logo. THE NAME CHANGED: it is now
"ציפציפ" - letters צ-י-פ-צ-י-פ - it ENDS WITH A REGULAR פ (the same open פ as the third letter), NOT the final ף: the last
letter does NOT descend below the line. The second half reads "ציפ", identical to the first half, only orange. No tagline, no other text. Clean vector, crisp edges.`;

const JOBS = [
  ['T1-stacked', `${BASE}
A logo sheet, 2 panels side by side: STACKED lockup (the mark above, the wordmark centred below) - left panel on near-black #0b0b0e
with the soft orange glow, right panel on warm white #faf7f2 where the bird is dark charcoal with the orange ring and the first "ציפ" is
charcoal, the second "ציפ" orange, no glow. CHECK: the word is two identical halves ציפ+ציפ - the last letter is the same
open פ as the third letter, sitting on the baseline (no long tail down).`],
  ['T2-horizontal', `${BASE}
A logo sheet, 3 rows: the HORIZONTAL lockup (the mark on the right, the wordmark to its left, one line, vertically centred) -
row 1 on near-black with glow, row 2 on warm white (charcoal + orange, no glow), row 3 on brand orange #ff6a1f with everything
in white (one colour).`],
  ['T3-icons', `${BASE}
An app icon sheet: the MARK ONLY (no letters) in 4 versions in a 2x2 grid: (1) app icon - rounded square, near-black with the
glowing orange mark; (2) app icon - rounded square, solid orange background with the mark in white; (3) a round profile
avatar - dark circle with the orange mark; (4) a tiny favicon at 32px size and 16px size, simplified (thicker ring, no glow).`],
  ['T4-mono', `${BASE}
A sheet of ONE-COLOUR versions of the horizontal lockup, 4 rows: all white on black; all black on white; all orange on black;
an outline-only version (thin lines, for stamping/engraving) white on black. No gradients, no glow.`],
];

const only = process.argv.slice(2);
const VER = process.env.VER || '';
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', key === 'T2-horizontal' || key === 'T4-mono' ? '1024x1536' : key === 'T1-stacked' ? '1536x1024' : '1024x1024');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'png');
  form.append('image[]', ...REF);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) return console.log('FAILED', key, res.status, j.error?.message);
  fs.writeFileSync(path.join(OUT, `${key}${VER}.png`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
