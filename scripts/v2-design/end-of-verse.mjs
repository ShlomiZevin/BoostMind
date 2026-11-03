// The "end of the verse" picture for the page-not-found screen (his ask, 2026-11-03: "you reached the end of the
// verse, go back to the home page"). GPT Image 2.5 (OpenAI direct, MEDIUM) with the planet logo as the reference;
// no text in the picture - the page sets the Hebrew.
//   node scripts/v2-design/end-of-verse.mjs  ->  public/verse/end-of-verse.jpg (+ v2/site/verse/)
import fs from 'node:fs';

const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const LOGO = 'C:/workspace/BoostMind/public/verse/logo-512.png';

const prompt = `A cinematic wide illustration for a website's "page not found" screen, 3:2, no text, no letters, no logo
wordmark. The attached image is the brand's planet: a glowing orange ringed planet on black. Scene: the very EDGE of a
small comedy universe - deep near-black space with a few faint stars, the glowing orange ringed planet (exactly the
attached planet's shape and colours, but WITHOUT any words on it) small and far away in the upper part of the frame, and
in the foreground the ground simply ends: a narrow rocky ledge that stops at a clean cliff edge into empty darkness, with
a small, slightly crooked wooden road sign post at the edge (the sign board blank, facing the viewer) and a single
abandoned orange traffic cone. Warm orange rim light from the planet, everything else dark and calm, a gentle, funny,
lonely mood. Premium, painterly-cinematic, matte, lots of empty dark space in the lower middle for text.`;

const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1536x1024');
form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync(LOGO)], { type: 'image/png' }), 'planet.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
const buf = Buffer.from(j.data[0].b64_json, 'base64');
for (const p of ['C:/workspace/BoostMind/public/verse/end-of-verse.jpg', 'C:/workspace/BoostMind/v2/site/verse/end-of-verse.jpg']) fs.writeFileSync(p, buf);
console.log('ok', buf.length);
