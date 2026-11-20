// Syncs product page on the Techy-Tech site (his ask 2026-11-20: "maybe techietech/syncs, a product page for Syncs, brought to you
// by Techy-Tech"). Phone-view mockups before the build: GPT Image 2.6, MEDIUM, 1024x1536, the design key. The brief says WHAT the
// page is and its sections (never how it looks); references = the Techy-Tech site on a phone + the Syncs lockup.
// Output A/B/C + one labelled sheet (page-mockups.jpg, made by syncs-page-sheet.py) in .../shlomiverse-v2-design/syncs/.
//   node scripts/v2-design/syncs-page.mjs <tt-site-phone.png> [A B C]
import fs from 'node:fs';
import path from 'node:path';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/syncs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const PRICE = { text: 5, image: 8, out: 30 };
const [, , SITE, ...only] = process.argv;
const LOCKUP = path.join(DIR, 'i-orange.jpg');

const PAGE = `Reference 1 is the corporate website of Techy-Tech (טקי-טק), an established Israeli enterprise software company, as it looks on a phone. Reference 2 is the logo of its new product, Syncs - a video-meeting app (tagline "Let's circle back").
Design the PRODUCT PAGE for Syncs on Techy-Tech's website, as a phone screenshot (390px wide), the whole page from top to bottom. It is a serious enterprise SaaS product page, Hebrew right-to-left, with English product terms. Its sections, in order:
1. The Techy-Tech site header (its logo).
2. Hero: "Syncs by Techy-Tech" with the Syncs logo, the headline "פגישות ממוקדות עם הצוות של טקי-טק", one line under it, the main button "להצטרף לסינק", a small line "ללא עלות לתושבי השלומיוורס".
3. What Syncs does - six features: "ניהול דיון באמצעות AI", "התערבות הנהלה מובנית", "Wrap-up ו-Action items", "ניהול נוכחות", "Raise hand ותור דוברים", "סינק אחד ביום".
4. How it works - 3 steps: "בוחרים משתתפים", "מנהלים את הדיון", "מקבלים סיכום".
5. Who is on the call - six Techy-Tech people with portraits, name and title (אמיר - CSO, עופר - VP BD, רונית - COO, דניאל - AI, גלעד - CEO, יניב - אבטחת מידע).
6. "Syncs בפעולה" - screenshots of the app inside phone frames.
7. Plans: "Personal" (free for Shlomiverse residents) and "Enterprise" (contact sales).
8. A quote from the CSO, אמיר לביא.
9. FAQ.
10. Footer: © Techy-Tech.
Crisp, correct Hebrew letters.`;
const JOBS = {
  A: { model: 'gpt-image-2.6-sunburst', prompt: PAGE },
  B: { model: 'gpt-image-2.6-flare', prompt: PAGE },
  C: { model: 'gpt-image-2.6-flare', prompt: PAGE + '\nThe product is the hero of the page: the app itself (the live meeting screen) is shown in the hero, next to the headline.' },
};
let total = 0;
await Promise.all(Object.entries(JOBS).filter(([k]) => !only.length || only.includes(k)).map(async ([k, j]) => {
  const f = new FormData();
  f.append('model', j.model); f.append('prompt', j.prompt); f.append('size', '1024x1536'); f.append('quality', 'medium');
  for (const file of [SITE, LOCKUP]) f.append('image[]', new Blob([fs.readFileSync(file)], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' }), path.basename(file));
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const r = await res.json();
  if (!res.ok) { console.error(k, res.status, JSON.stringify(r).slice(0, 300)); return; }
  const u = r.usage || {}, d = u.input_tokens_details || {};
  const usd = ((d.text_tokens || 0) * PRICE.text + (d.image_tokens || 0) * PRICE.image + (u.output_tokens || 0) * PRICE.out) / 1e6;
  total += usd;
  fs.writeFileSync(path.join(DIR, `page-${k}.png`), Buffer.from(r.data[0].b64_json, 'base64'));
  console.log('made', k, j.model, '$' + usd.toFixed(3));
}));
console.log('total $' + total.toFixed(3));
