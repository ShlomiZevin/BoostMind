// "עכשיו בחרדות" on the verse's home, on a computer (his notes 2026-11-08: "on desktop it's terrible and nothing like the
// design ... desktop a nice view of it - maybe to the side, like the stickers ... design it nicely with image"). GPT Image
// mockups from the approved phone design (plan tz-home, opt-a) + the live desktop home as it is.
//   node scripts/v2-design/tz-home-desk.mjs <opt-a.jpg> <home-desktop.png> [names]  ->  Documents/shlomiverse-v2-design/tz-home/D*.png
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/workspace/BoostMind';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/tz-home';
fs.mkdirSync(OUT, { recursive: true });
const KEY = /OPENAI_API_KEY=(.+)/.exec(fs.readFileSync(`${ROOT}/scripts/design.env`, 'utf8'))[1].trim().replace(/^["']|["']$/g, '');
const [, , A, HOME, ...only] = process.argv;

const BASE = `Two references: (1) the APPROVED phone design of a home-page card called "עכשיו בחרדות" - a short WIDE news banner (the parody TV channel ח24's red logo, a photo, a red tag, a bold headline OVER the picture on a dark gradient, "אסונית לוי מדווחת · לפני 40 דק'"), then "מה אומרים בציפציפ" with three short posts (round face, name, time, one or two lines, like + comment counts on the left), then two links "לכל הציפציף ←" and "לח24 ←"; (2) the website's DESKTOP home page as it is today (dark, near-black, one orange accent, Hebrew right-to-left).
Design the DESKTOP version of this card on that home page, 1536x1024, as a polished product screenshot: the top of the page (the hero with the planet logo, the stories row) cropped at the top, then the card in its new place. Keep the approved card's look exactly - the same short wide banner with the headline over the picture, the same post rows - only laid out for a wide screen. Hebrew right-to-left, real-looking UI, crisp text, no lorem ipsum.`;
const V = {
  D1: `${BASE}\nLAYOUT: one row of TWO cards side by side, filling the page width: on the RIGHT (wider, ~60%) the "עכשיו בחרדות" card - the banner wide and short across its top, under it the three ציפציפ posts; on the LEFT (~40%) the existing orange-brown card "להפוך לתושבים בשלומיוורס" (its perks list with small icons and a big orange button "להפוך לתושבים"). Both cards the same height.`,
  D2: `${BASE}\nLAYOUT: the home page in two columns like a news site: the MAIN column on the right with the page's own rows (new games, today's videos as thumbnail cards), and a narrow SIDE column on the LEFT (~360px) that stays beside it, holding "עכשיו בחרדות" as a tall side card - the banner on top, the three ציפציפ posts under it, the two links at the bottom - like a sticker / trending panel on the side of the page.`,
  // his note on D1: "great - but what for citizens?" (they never see the citizenship card): the same slot becomes their right to speak
  D1c: `${BASE}
LAYOUT: exactly like a row of TWO cards side by side, filling the page width: on the RIGHT (wider, ~60%) the "עכשיו בחרדות" card - the banner wide and short across its top, under it the three ציפציפ posts; on the LEFT (~40%) a card for a visitor who IS already a citizen, titled "זכות הדיבור שלך": a small Shlomiverse passport badge with their name ("שלומי · אזרח מס' 1,204") at the top, then a quote box with ח24's latest headline and the line "מה דעתך?", then a big orange button "לצייץ על זה" with a pen icon, and under it a small line "הציוצים שלך: 3 · חותמות שקיבלת: 41". Same orange-brown warm card style as the citizenship card. Both cards the same height.`,
};

await Promise.all(Object.keys(V).filter((k) => !only.length || only.includes(k)).map(async (k) => {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2.6-flare');
  for (const f of [A, HOME]) fd.append('image[]', new Blob([fs.readFileSync(f)], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' }), path.basename(f));
  fd.append('prompt', V[k]);
  fd.append('size', '1536x1024');
  fd.append('quality', 'high');
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: fd });
  const j = await r.json();
  if (!r.ok) { console.error(k, r.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${k}.png`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', k);
}));
