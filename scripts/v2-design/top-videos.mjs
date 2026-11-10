// "הכי נצפים" on the home (2026-11-10, his ask: top videos today / this week / this month / all time). GPT Image 2.5
// (OpenAI direct, MEDIUM, the design key); the live home screenshots as the reference.
//   node scripts/v2-design/top-videos.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/top-videos/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const REF = path.join(DESIGN, 'records');
const OUT = path.join(DESIGN, 'top-videos');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const NOW = (f) => [new Blob([fs.readFileSync(path.join(REF, f))], { type: f.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }), f];

const APP = `App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of recurring characters; visitors watch
their videos (vertical TikTok-style comedy sketches), chat with them and play games. KEEP the app's own visual language exactly
as in the attached current screenshot (near-black background, its orange accent, its fonts, its video cards = vertical 9:16
posters with the title under them, line icons) - this is one new section, not a new brand. No emoji. All Hebrew right-aligned
and correctly spelled.`;

const WHAT = `A NEW home section "הכי נצפים" - the most watched videos. Small segmented tabs on the title row: היום · השבוע · החודש
(the active one filled orange). Under it the top 10 as a horizontal row of the same vertical video posters, each with a big
outlined rank number (1, 2, 3...) standing beside the poster on its right side, partly behind it - the "top 10" look. Titles
under the posters like "מה אני אגיד לך?", "חני והמילון", "הבלבוסטה", "יוסף מוקיר שבת". NO view counts anywhere, no numbers but the
ranks. A "כל הסרטונים ←" link on the title row.`;

const JOBS = [
  ['T1-phone', ['now-phone-records.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${WHAT} On a phone about 2.5 posters show and the row swipes sideways. Show the section with a bit of "סרטונים אחרונים" above it.`],
  ['T2-desktop', ['now-desk-records.png'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
${WHAT} On desktop about 6 posters show, with a round arrow button on the left side of the row to move on (Hebrew: what comes
next is on the left), no grey scrollbar. Show the section with a bit of the sections above and below.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, refs, prompt]) => {
  const desk = key.includes('desktop');
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', desk ? '1536x1024' : '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const f of refs) { const [blob, name] = NOW(f); form.append('image[]', blob, name); }
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
