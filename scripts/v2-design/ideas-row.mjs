// The ideas row on the home, round 2 (his note 2026-11-10: "still way too much space - redesign this section"). The current row is
// attached. GPT Image 2.5, design key.  node scripts/v2-design/ideas-row.mjs  ->  Documents/shlomiverse-v2-design/band/
import fs from 'node:fs';
import path from 'node:path';
const D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/band';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const WHAT = `App "שלומיוורס" (Hebrew, right-to-left), keep its look exactly (near-black, orange accent, Heebo, rounded dark cards, line icons).
No emoji. Hebrew right-aligned and correctly spelled. REDESIGN the ideas row in the attached screenshot - it wastes space (a big empty box
with a small title on one side and a tall idea card on the other). Make it ONE compact, lively strip: "יש לכם רעיון לפרק הבא?" with
"אתם מצביעים, והאהובים עולים לשלומיוורס" and an orange "הציעו רעיון" button, together with the top idea of the week shown compactly as a
quote: a small round avatar letter "ח", the name "חסדי השם", the idea "מה עם דמות נוספת - הדתי מחמד, זה שמנדבים אותו להדליק נרות חנוכה,
לברך בהרמת כוסית..." cut to two lines, a small orange "השלומיוורס אהב" badge, a votes pill with the planet icon and "1", and a small
"לכל הרעיונות ←" link. Nothing tall, no empty areas.`;
const JOBS = [
  ['I1-desktop', `A desktop web page mockup, flat browser viewport crop, 1536x1024, showing this one strip across the content width (about 130px tall) with a bit of the cards above and the business strip below. ${WHAT}`],
  ['I2-phone', `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16, showing this strip with a bit above and below. ${WHAT} On a phone the button may sit under the words.`],
];
await Promise.all(JOBS.map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', key.includes('desktop') ? '1536x1024' : '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(path.join(D, 'now-ideas.png'))], { type: 'image/png' }), 'now-ideas.png');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(D, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
