// חרדות, the verse's news channel - round 2 in the spirit of the Israeli evening news brand (his note 2026-11-08: "make it
// more like N12, have mine Yonit near it in one version, and a short version like N12 has"). Flat broadcast red, white
// geometric letters, the striped bar - the STYLE of an Israeli news brand, never its actual mark. Short form ח24 with
// "החרדות" under the bar. The anchor = the verse's own news anchor (news-anchor.jpg). GPT Image 2.5 sunburst, MEDIUM.
//   node scripts/v2-design/news-logos2.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/news-logos/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'news-logos');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const ANCHOR = [new Blob([fs.readFileSync('C:/workspace/BoostMind/zoomcut/characters/news-anchor/portrait.jpg')], { type: 'image/jpeg' }), 'anchor.jpg'];

const STYLE = `Flat broadcast design in the style of an Israeli prime-time news brand: a deep red background with a soft red-to-dark-red
gradient, bold WHITE geometric letters, no glow, no 3D, no globe. Numbers drawn with a clean inline double stroke (a thin white
line running inside each stroke), like a TV channel number. A small emblem of three short horizontal white bars stacked (the
"news" stripes) beside the word under the number. Do NOT copy any real channel's logo or number (no 12, no N12, no 13).
Spell all Hebrew exactly. No other text.
ORDER (his note): Hebrew reads right-to-left, so the letter ח stands on the RIGHT and the number 24 to its LEFT - it reads "ח24" (חרדות 24, like 24/7), never "24ח".`;

const JOBS = [
  ['D1-ch24-square', null, `A square app/avatar logo. ${STYLE}
Big in the centre: "ח24" - the Hebrew letter ח in a heavy white geometric sans, then the number 24 with the inline double stroke.
Under it, the three-bar stripes emblem and the word "החרדות" (exactly ה-ח-ר-ד-ו-ת) in white bold Hebrew.`],
  ['D2-charadot-wide', null, `A wide horizontal logo sheet (show it three times stacked with space between: on red, on white, and on black). ${STYLE}
The full name: the three-bar stripes emblem, then "חרדות" (exactly ח-ר-ד-ו-ת) in heavy white geometric Hebrew; to its side a
small square badge "ח24" (the short form). On white, the letters are red.`],
  ['D3-promo-anchor', [ANCHOR], `A TV channel promo photo, wide 3:2, like a prime-time news campaign. ${STYLE}
Left side: the short logo big - "ח24" with the inline double-stroke number and under it a white rounded bar with the three
stripes and "החרדות" (exactly ה-ח-ר-ד-ו-ת) in red letters. Right side: the attached person - the channel's star anchor, a WOMAN, clean-shaven smooth
face, keep the face, the long red curly hair and the look exactly - standing in a sharp dark suit, arms crossed, serious, confident studio
lighting, cut out against the red background, waist up.`],
];

const only = process.argv.slice(2);
const VER = process.env.VER || '';
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, images, prompt]) => {
  const size = key === 'D3-promo-anchor' ? '1536x1024' : key === 'D2-charadot-wide' ? '1024x1536' : '1024x1024';
  let res;
  if (images) {
    const form = new FormData();
    form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', size);
    form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
    for (const im of images) form.append('image[]', ...im);
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2.5-sunburst', prompt, size, quality: 'medium', n: 1, output_format: 'jpeg' }),
    });
  }
  const j = await res.json();
  if (!res.ok) return console.log('FAILED', key, res.status, j.error?.message);
  fs.writeFileSync(path.join(OUT, `${key}${VER}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
