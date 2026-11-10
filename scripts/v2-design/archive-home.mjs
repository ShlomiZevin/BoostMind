// The archive's announcement on the home (his note 2026-11-10 on H1/H2): "like an announcement" (H2's idea) but smaller; clear
// that the archive is ALL his videos - much more than the verse - "now you can find anything", find yourself / things not in the
// verse, and ask to bring them in; residents only. GPT Image 2.5, the design key. -> Documents/shlomiverse-v2-design/archive/
//   node scripts/v2-design/archive-home.mjs [only-key ...]
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/archive';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const REF = (f) => [new Blob([fs.readFileSync(path.join(OUT, f))], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' }), f];

const APP = `App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of recurring characters. KEEP the app's own visual
language exactly as in the attached home screenshot (near-black background, its orange accent, Heebo, glass cards, line icons).
No emoji. Every Hebrew word right-aligned and correctly spelled.`;
const WHAT = `A NEW announcement card on the home: "הארכיון נפתח" - the archive is open. What it must make obvious in 3 seconds:
the Shlomiverse has 279 videos with the characters; the ARCHIVE is everything - all 1,315 of Shlomi's Instagram videos since 2023,
much more than the verse; now you can find ANY video (by date, a word, a hashtag - even the one you are in, or one you
remember); and you can ask for one to be brought into the Shlomiverse. Only for residents (signed in). Copy to use (exactly):
title "הארכיון נפתח", line "כל 1,315 הסרטונים של שלומי, הרבה מעבר ל-279 שבשלומיוורס. מצאו כל סרטון, ובקשו שיעלה לשלומיוורס.",
a small comparison "שלומיוורס · 279" vs "הארכיון · 1,315", button "לחפש בארכיון", a tiny "לתושבים בלבד" with a lock.
The card uses H2's idea (the second attached image: old video covers fanned like a time machine) but SMALLER - about a third of a
phone screen, not a whole screen - and it reads as an announcement (a small "חדש" tag).`;

const JOBS = [
  ['H3-home-phone-announce', ['now-phone-home.png', 'H2-home-phone-card.jpg'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${WHAT} Show the card on the home with a bit of the sections above and below it.`],
  ['H4-home-phone-announce-b', ['now-phone-home.png', 'H2-home-phone-card.jpg'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${WHAT} A DIFFERENT layout from a centered card: a wide horizontal card - the fanned covers on the left side, the words and the
button on the right - only about a quarter of the screen tall. Show it on the home with a bit of the sections above and below.`],
  ['H5-home-desktop-announce', ['now-desk-home.png', 'H2-home-phone-card.jpg'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
${WHAT} On desktop a wide banner-card across the content width: the words, comparison and button on the right, the fanned covers on
the left. Show it on the home with a bit of the sections above and below.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, refs, prompt]) => {
  const desk = key.includes('desktop');
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', desk ? '1536x1024' : '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const f of refs) { const [blob, name] = REF(f); form.append('image[]', blob, name); }
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
