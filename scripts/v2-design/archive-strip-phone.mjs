// The archive strip on a PHONE (his note 2026-11-10: "mobile version is ugly - a design image for mobile, dedicated"). The current
// phone strip (side by side, cramped) is attached first; H3 (the fanned covers + planet he liked) second. GPT Image 2.5, design key.
//   node scripts/v2-design/archive-strip-phone.mjs  ->  Documents/shlomiverse-v2-design/archive/
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/archive';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const REF = (f) => [new Blob([fs.readFileSync(path.join(OUT, f))], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' }), f];
const BASE = `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. App: "שלומיוורס" (Hebrew, right-to-left),
KEEP its visual language exactly (near-black, its orange accent, Heebo, glass cards). No emoji. Hebrew right-aligned, correctly spelled.
REDESIGN FOR A PHONE the announcement strip in the first attached screenshot (it is cramped and ugly on a phone: the covers squeezed
on the side, the text in a narrow column, two stacked pills). Use the look of the second image (old video covers with their years
fanned out, the orange planet logo "שלומיוורס" over them, an orange glow). Content (exactly): small tag "חדש", title "הארכיון נפתח",
line "כל 1,315 הסרטונים, הרבה מעבר ל-280 שבשלומיוורס. מוצאים כל סרטון ומבקשים שיעלה.", the two numbers "הארכיון 1,315" and
"בשלומיוורס 280" side by side, a full-width button "לחפש בארכיון" with a round arrow pointing LEFT, a tiny "לתושבים בלבד" with a lock.
It must stay a STRIP on the home (about 40% of the screen at most), clear and inviting, with the sections above and below visible.`;
const JOBS = [
  ['P1-strip-phone-stacked', `${BASE} Layout: the fanned covers + planet as a short band across the top of the card, the words under it centered, then the numbers and the button.`],
  ['P2-strip-phone-overlay', `${BASE} Layout: the fanned covers fill the card's background on the left half, softly faded into the dark, the planet small at the bottom left corner; the words and button on top, right-aligned, full width under them the button.`],
];
await Promise.all(JOBS.map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const f of ['now-phone-strip.png', 'H3-home-phone-announce.jpg']) { const [blob, name] = REF(f); form.append('image[]', blob, name); }
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
