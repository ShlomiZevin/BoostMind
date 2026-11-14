// רופא הגינה (shlomiverse.com/garden/) - mockups, 2026-11-14. His ask: a dead-simple Hebrew site for a man over 70, not
// technical, with a smartphone and a garden full of trees and plants: take a photo, optionally say a question, get what
// the plant is, what it sees, how to care for it, whether there is a problem. GPT Image 2.5 (OpenAI direct, MEDIUM,
// design key). Brief = WHAT we build, never the look, so every call is a different concept.
//   node scripts/garden/design.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/garden/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/garden';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');

const WHAT = `Design a mobile web app in Hebrew (right-to-left), shown as TWO flat full-screen phone screenshots side by side
(no device frame, no hands), each 9:16.
Who uses it: one man over 70 who is not technical. He has a smartphone and a big home garden full of fruit trees, bushes,
flowers and pots. His eyesight is not perfect and small buttons scare him. It must be the simplest app he ever used:
huge readable Hebrew text, very few things on each screen, one obvious action, nothing that looks like settings.
App name: "רופא הגינה". What it does: he photographs a plant (or picks a photo), may say a question out loud (optional -
he can also send without asking anything), and gets back: what plant this is, what the app sees in the photo, whether
there is a problem (pests, disease, thirst, sunburn...) and exactly what to do, in plain words. A button reads the answer
out loud. The app remembers his plants so later photos of the same tree continue the story.
Screen 1 (start): the app name, a giant primary action "צלם צמח" (take a photo), a smaller "בחר תמונה מהגלריה", and below
a short row "הצמחים שלי" with 3 of his plants (photo + name: "עץ לימון", "ורד אדום", "זית").
Screen 2 (the answer, after he sent a photo of a lemon tree leaf with yellow patches): his photo at the top, the plant name
"עץ לימון", a clear status "יש בעיה קטנה" , a short "מה אני רואה" paragraph, "מה לעשות" as 3 numbered simple steps, a big
"הקרא לי" (read to me) button, and at the bottom "שאלה נוספת על הצמח" and "צמח חדש".
All Hebrew right-aligned, correctly spelled, large. No emoji. Real typography, real interface - not an illustration.`;

const JOBS = [
  ['A', 'gpt-image-2.5-flare', ''],
  ['B', 'gpt-image-2.5-sunburst', ''],
  ['C', 'gpt-image-2.5-flare', '\nMake this concept very different from a typical app: think of what would feel warm and trustworthy to him.'],
  ['D', 'gpt-image-2.5-sunburst', '\nMake this concept very different from a typical app: think of what would feel warm and trustworthy to him.'],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, model, extra]) => {
  const res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST',
    headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: WHAT + extra, size: '1536x1024', quality: 'medium', n: 1, output_format: 'jpeg' }) });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key, JSON.stringify(j.usage || {}));
}));
