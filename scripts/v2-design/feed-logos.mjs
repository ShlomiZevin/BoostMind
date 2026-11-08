// The residents' X - its name and logo, thought together (his note 2026-11-08: "שכונה is not bad but it has to be also about
// tweeting, so people understand the parody - let's think with the logo itself"). Four name + mark pairs that read as a
// Twitter / X parody and still belong to the planet. GPT Image 2.5 sunburst, OpenAI direct (design key), MEDIUM.
//   node scripts/v2-design/feed-logos.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/feed-logos/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'feed-logos');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const LOGO = [new Blob([fs.readFileSync('C:/workspace/BoostMind/v2/site/verse/logo-512.png')], { type: 'image/png' }), 'logo.png'];

const SHEET = (mark, word, extra = '') => `A logo design sheet on a near-black background. The attached glowing orange planet with "שלומיוורס" on its ring is
the PARENT brand; this is its sub-brand: the residents' own social network - a parody of Twitter / X inside a comedy universe,
so the Twitter idea must be recognisable at first glance, but it is NOT Twitter's logo and NOT X's logo.
THE MARK: ${mark}
THE WORDMARK: "${word}" in bold modern Hebrew letters, white with the last part in the parent's orange (like "שלומיוורס").
${extra}
Show: the mark + wordmark large in the centre; below it small, side by side: the mark alone as an app icon (rounded square)
and a slim one-line horizontal version. Clean vector look with the parent's glow. Spell the Hebrew exactly. No other text.`;

const JOBS = [
  ['N1-tziyutzverse', SHEET('a small round bird whose body IS the glowing orange planet, its orbit ring swept back as the bird\'s wing, a tiny beak, mid-chirp.', 'ציוצוורס', 'Letters: צ-י-ו-צ-ו-ו-ר-ס, with "וורס" in orange.')],
  ['N2-shchuna-pigeon', SHEET('a plump Israeli street pigeon (not a slim bluebird) standing on the planet\'s orbit ring like on a wire, head turned, beak open - the neighbourhood\'s pigeon tweeting.', 'שכונה', 'Under the wordmark a small line in dim white: "מה מצייצים בשכונה". Letters: ש-כ-ו-נ-ה, with "נה" in orange.')],
  ['N3-shchuna-shin', SHEET('the Hebrew letter ש drawn as a sharp, minimal monogram from crossing diagonal strokes - the way the X logo is built - in white inside a black rounded square, with a thin orange orbit ring cutting through it.', 'שכונה', 'Letters: ש-כ-ו-נ-ה, with "נה" in orange.')],
  ['N4-tziftzuf', SHEET('a speech bubble shaped like a bird - the bubble\'s tail is the bird\'s tail, a small dot eye, a beak - with the orange orbit ring around it.', 'ציפציף', 'Letters: צ-י-פ-צ-י-ף, with "ציף" (the second half) in orange.')],
  // round 2 (his pick 2026-11-08: the name ציפציף + the line "מה מצייצים בשכונה" - "both are good")
  ['P1-tziftzif-final', SHEET('a speech bubble shaped like a small bird - the bubble’s tail is the bird’s tail, a dot eye, a short beak open mid-chirp - with the glowing orange orbit ring around it, like the parent planet. Flat, bold, readable at 32px.', 'ציפציף', 'Letters: צ-י-פ-צ-י-ף (the last letter is a final ף), "ציף" (the second half, on the left) in orange. Under the wordmark a smaller line in dim white: "מה מצייצים בשכונה".')],
  ['P2-tziftzif-pigeon', SHEET('a plump Israeli street pigeon drawn FLAT and simple (two-three shapes, no feathers detail, not realistic), its body shaped as a speech bubble with the bubble tail at the bottom, beak open mid-chirp, standing on the parent planet’s glowing orange orbit ring. Readable at 32px.', 'ציפציף', 'Letters: צ-י-פ-צ-י-ף (the last letter is a final ף), "ציף" (the second half, on the left) in orange. Under the wordmark a smaller line in dim white: "מה מצייצים בשכונה".')],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1024');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', ...LOGO);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) return console.log('FAILED', key, res.status, j.error?.message);
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
