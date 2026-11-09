// The Shlomiverse's sponsored banner ("ממומן") - his note 2026-11-09: Hani's video ends "בחסות עיגוליות" with a discount
// for Shlomiverse users, so the site carries the ad too (part of the immersive world): a general ad slot, first sponsor
// עיגוליות of מאפיית ברכת השפע (/birkat-hashefa/). GPT Image mockups for his OK.
//   node scripts/v2-design/ad-slot.mjs <out-dir> <home-phone.png> <home-desk.png> [names]   (B1 first: the others use it)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/workspace/BoostMind';
const KEY = /OPENAI_API_KEY=(.+)/.exec(fs.readFileSync(`${ROOT}/scripts/design.env`, 'utf8'))[1].trim().replace(/^["']|["']$/g, '');
const [, , OUT, PHONE, DESK, ...only] = process.argv;
const BOX = `${ROOT}/public/birkat-hashefa/img/igulyot.jpg`;
const B1 = path.join(OUT, 'B1.png');

const AD = `THE AD: a sponsored banner for "עיגוליות" - chocolate-cream filled cookies by the bakery "מאפיית ברכת השפע" (the box in the reference: cream paper, deep red band, brown and gold, Haredi-kosher packaging look). It is a real-looking supermarket-brand ad (a parody, but it must look exactly like a real paid ad): the box and a few cookies, one broken open with chocolate; the big line "זה בכלל פרווה!"; a red price-tag sticker "הנחה לאזרחי השלומיוורס"; a small line "נמכר בכל סניפי שפע עד"; a button "לקופון ←". Hebrew right-to-left, crisp correct Hebrew letters.
THE SLOT around it (this part is the website's, the same for every sponsor): a rounded card on the dark site, and above the creative a clear small label row: a grey pill "ממומן" with a tiny ⓘ on the right side, and "בחסות ברכת השפע" next to it - so nobody can miss that this is an advertisement.`;
const V = {
  B1: { refs: [BOX], size: '1536x1024', prompt: `${AD}
Show a clean design sheet on a near-black background (#0b0b0e) with the ad at its two sizes, stacked: on top the WIDE computer banner (about 4:1 - the box on the left, the words and the button on the right side), under it the PHONE card (about 2:1, the same content tighter). Each inside the slot with its "ממומן" label row. Nothing else on the sheet.` },
  B2: { refs: [BOX], size: '1536x1024', prompt: `The Shlomiverse website has ONE general sponsored-ad slot that any sponsor can fill. Show it as a design sheet on a near-black background (#0b0b0e), three cards stacked, all the SAME slot (rounded card, thin border, on top a label row: a grey pill "ממומן" with a tiny ⓘ, then "בחסות <sponsor>"; under it the sponsor's own creative as a wide 4:1 picture; a small "×" to hide it in the corner):
1) sponsor "ברכת השפע": עיגוליות - chocolate-cream filled cookies, the box like the reference, "זה בכלל פרווה!", a red sticker "הנחה לאזרחי השלומיוורס", button "לקופון ←".
2) sponsor "שפע עד": a Haredi supermarket chain's weekly flyer look - yellow and red, "מבצעי השבוע", button "לחוברת ←".
3) the EMPTY slot as a designer's template: a dashed placeholder area "כאן הפרסומת שלך", the label row the same.
Hebrew right-to-left, crisp correct Hebrew letters, real product UI.` },
  P1: { refs: [PHONE, B1], size: '1024x1536', prompt: `Two references: (1) the website's PHONE home page as it is (dark, a planet logo hero, the ask box, a purple promo, "מי עונה?" faces); (2) the sponsored banner design (the PHONE card version with its "ממומן" label row).
Design the phone home page (390px wide phone screenshot, tall) with the sponsored card placed RIGHT UNDER the hero card (after "מי עונה?" faces, before the page's next rows), full width with the page's side margins, the same rounded corners as the other cards. Keep the page exactly as it is otherwise; show the top of the next row under the ad. The "ממומן" label must be clearly visible. Crisp Hebrew right-to-left, real phone UI with the bottom tab bar.` },
  D1: { refs: [DESK, B1], size: '1536x1024', prompt: `Two references: (1) the website's DESKTOP home page as it is (dark, faces wall behind, planet logo hero, ask box, a purple promo, "מי עונה?" faces); (2) the sponsored banner design (the WIDE computer version with its "ממומן" label row).
Design the desktop home page scrolled a little down: the bottom of the hero at the top, and RIGHT UNDER it the WIDE sponsored banner, the width of the page's content column, rounded like the other cards; under it the top of the next row (a card "עכשיו בחרדות 24" beside a card). The "ממומן" label must be clearly visible. Keep everything else as it is. Crisp Hebrew right-to-left, a real website screenshot.` },
  W1: { refs: [B1, BOX], size: '1024x1536', prompt: `References: the sponsored banner and the product box. Design the PHONE window that opens when someone taps the ad's button "לקופון": a bottom sheet over the dimmed dark site. On top the small label "ממומן · בחסות ברכת השפע", the עיגוליות box, title "הקופון של אזרחי השלומיוורס", a dashed coupon ticket with the code "פרווה" in big letters and "15% הנחה על עיגוליות בכל סניפי שפע עד", a button "להעתיק את הקוד", and a small line under it "*הקופון לאזרחים עם דרכון שלומיוורס בלבד. לא כולל פרווה." Next to it (as a second phone on the same picture, side by side) the same sheet for a visitor WITHOUT a passport: the ticket is blurred/locked with a small passport icon, and the button "להוציא דרכון ולקבל את הקופון". Dark site UI, the ad's own red/cream colours only inside the sheet. Crisp Hebrew right-to-left.` },
};

async function one(k) {
  const v = V[k], fd = new FormData();
  fd.append('model', 'gpt-image-2.6-flare');
  for (const f of v.refs) fd.append('image[]', new Blob([fs.readFileSync(f)], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' }), path.basename(f));
  fd.append('prompt', v.prompt); fd.append('size', v.size); fd.append('quality', 'high');
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: fd });
  const j = await r.json();
  if (!r.ok) { console.error(k, r.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${k}.png`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', k);
}
const want = only.length ? only : Object.keys(V);
if (want.includes('B1')) await one('B1');
await Promise.all(want.filter((k) => k !== 'B1').map(one));
