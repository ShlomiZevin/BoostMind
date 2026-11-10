// "מה הלאה בשלומיוורס?" + the ideas + a REAL business strip (his note 2026-11-10: on a computer the tiles sit randomly, pictures in
// random places, and "לעסקים" is tiny - "I want businesses to reach out to me, to offer them advertising on the site"). Desktop + phone.
// GPT Image 2.5, the design key.  node scripts/v2-design/band.mjs [only ...]  ->  Documents/shlomiverse-v2-design/band/
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/band';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const REF = (f) => [new Blob([fs.readFileSync(path.join(OUT, f))], { type: 'image/png' }), f];

const APP = `App: "שלומיוורס" (Hebrew, right-to-left) - a comedy universe of recurring characters (vertical comedy videos, chats with
the characters, stickers, games, the characters' own sites). KEEP its visual language exactly as in the attached screenshot (near-black,
the orange accent, Heebo, rounded dark cards, line icons, the characters' cartoon stickers and photos). No emoji. Hebrew right-aligned,
correctly spelled.`;
const WHAT = `REDESIGN this part of the home (the attached screenshot is today: tiles of different sizes and structures, pictures stuck
in random corners, a tiny "לעסקים" line at the bottom). It has three parts:
1) "מה הלאה בשלומיוורס?" / "פה עושים יותר מלצפות" - 7 things a visitor can do, each one ONE consistent card (the same structure
for all: a picture or character on the card in the same place, an icon, a title, one line): סטיקר מהרגע (עצרו פריים, כתבו מה שבא
לכם ושלחו בוואטסאפ - a character's cut-out sticker), הסטיקרים של כולם (stickers other visitors made - 3 small stickers), דברו
איתם (כל דמות עונה בקול שלה - a character's round face), עקבו אחריהם (מה שחדש אצלם מגיע אליכם - a face), סטוריז (היום שלהם
בסטורי - faces in story rings), משחקים (קצר, חינם, בנגיעה אחת - a game cover), האתרים שלהם (חנויות ושירותים - a site's picture).
The sticker one may be the big featured card. Calm, aligned, a clear grid.
2) "יש לכם רעיון לפרק הבא?" (אתם מצביעים, והאהובים עולים לשלומיוורס) with an orange "הציעו רעיון" button, and the top idea of the
week as one card (a resident's idea text, their name, votes, "השלומיוורס אהב").
3) A CLEAR, PROUD BUSINESS STRIP - the Shlomiverse sells advertising: "לעסקים ולמותגים" / title "פרסום בשלומיוורס" / "באנר באתר,
סרטון עם הדמויות, תוכן ממותג ואירועים - הקהל כבר מכיר אותן ומחכה לפרק הבא." with an orange "לפרסם אצלנו" button and a few
small proof points as chips: "1,315 סרטונים", "84 דמויות", "באנר ממומן באתר". It must look like a real invitation for brands, not
a footnote - a full-width strip with a little visual (characters holding a product box, or a sponsored banner mock).`;

const JOBS = [
  ['B1-desktop', ['now-desk-band.png'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
${WHAT} On desktop: the 7 cards in a tidy grid (the featured sticker card wide + the rest equal), then the idea row, then the business strip.`],
  ['B2-desktop-b', ['now-desk-band.png'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
${WHAT} On desktop a DIFFERENT grid: all 7 as equal cards with the picture as the TOP half of each card (like app tiles), in one or two
rows; then the idea row; then the business strip.`],
  ['B3-phone', ['now-phone-band.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${WHAT} On a phone: the featured sticker card full width, the other 6 as a tidy 2-column grid of equal cards (picture on top, title, one
line); show the top of the section through the start of the idea row.`],
  ['B4-phone-biz', ['now-phone-band.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${WHAT} On a phone, scrolled to the END of this part: the idea row with the top idea card, then the business strip full width (title,
line, proof chips, the orange "לפרסם אצלנו" button, the small visual), then the next section starting.`],
];
const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([k]) => !only.length || only.includes(k)).map(async ([key, refs, prompt]) => {
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
