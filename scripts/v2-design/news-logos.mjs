// The verse's news channel - name + logo (his brief 2026-11-08: a satire of what the news really does - engineering minds,
// pouring poison, storms, clickbait, rage bait, a reality show of disasters made to keep people on edge). It posts on
// ציפציף, the residents' X. A real-looking TV news ident at first glance, the satire at the second; never a copy of a real
// channel's logo. GPT Image 2.5 sunburst, OpenAI direct (design key), MEDIUM.
//   node scripts/v2-design/news-logos.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/news-logos/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'news-logos');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');

const SHEET = (word, letters, mark) => `A logo design sheet on a dark studio-blue background: the logo of a TV NEWS CHANNEL in a parallel universe. It must look
like a real, slick, dramatic Israeli/international 24-hour news channel brand at first glance (broadcast graphics: bold, glossy,
red alert accents, a "breaking" energy), and be a satire of the news at the second glance. NOT a copy of any real channel's
logo (no Channel 12 eye, no 13, no CNN/BBC/Fox shapes).
THE NAME: "${word}" (Hebrew letters exactly: ${letters}) in heavy condensed Hebrew broadcast type.
THE MARK: ${mark}
Show: the full logo large in the centre; below it small, side by side: a square social-media avatar version (for its account on
a social network) and an on-screen corner bug (small, semi-transparent, with a tiny red "שידור חי" dot). Spell the Hebrew
exactly. No other text.`;

const JOBS = [
  ['C1-charadot', SHEET('חרדות', 'ח-ר-ד-ו-ת', 'the word is set so that at a glance it reads like "חדשות" (news): a red siren light / alert triangle sits where the eye expects a news emblem, with radiating alarm lines; a thin ticker line under it.')],
  ['C2-konenut', SHEET('ערוץ הכוננות', 'ע-ר-ו-ץ ה-כ-ו-נ-נ-ו-ת', 'a pulsing heart-monitor (ECG) line that spikes sharply in the middle and never goes flat, in red, running through a glossy broadcast badge.')],
  ['C3-hasaara', SHEET('ערוץ הסערה', 'ע-ר-ו-ץ ה-ס-ע-ר-ה', 'a dramatic storm swirl (like a weather-radar cyclone) made of broadcast red and white stripes, with a tiny studio desk lamp at its eye - the storm is made in the studio.')],
  // his pick 2026-11-08: "חרדות, like a logo of חדשות" - all five letters readable (in C1 the siren replaced the ו)
  ['C1b-charadot-full', SHEET('חרדות', 'ח-ר-ד-ו-ת - ALL FIVE LETTERS clearly drawn, none replaced by a symbol', 'built exactly like a classic Israeli evening-news wordmark for the word "חדשות" (heavy silver-white letters on a glossy red-and-blue broadcast bar), so the eye reads "חדשות" first; a small red siren light sits ON TOP of the word, above the ר, glowing, with alarm lines.')],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2.5-sunburst', prompt, size: '1024x1024', quality: 'medium', n: 1, output_format: 'jpeg' }),
  });
  const j = await res.json();
  if (!res.ok) return console.log('FAILED', key, res.status, j.error?.message);
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
