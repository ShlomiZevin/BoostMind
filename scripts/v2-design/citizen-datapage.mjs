// The citizen's ID = a real passport's data page (his note 2026-11-07: "a passport, no 'שלומיוורסית', sounds and looks real;
// a picture with places to put the text in, fitting a phone page"). The picture has NO text: the page lays the fields, the
// photo and the machine-readable lines over it (v2/site/verse/citizen.js idCard + drawId).
//   node scripts/v2-design/citizen-datapage.mjs [n]  ->  scratchpad stills/datapage-<n>.jpg (then to v2/site/verse/art/citizen-datapage.jpg)
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/stills/';
const n = process.argv[2] || '1';
const prompt = `A flat, straight-on high-resolution scan of the biographical DATA PAGE of a modern passport, landscape, filling the frame edge to edge
(no table, no background, no booklet edges - only the page). Pale cream paper with a light blue-violet and soft orange security print: fine guilloche
line patterns, wavy microprint bands, a delicate rosette, and very faintly in the centre-right a large watermark of the attached logo's ringed planet
(only its shape, as a pale tone-on-tone print, no letters). Layout areas, all EMPTY:
- along the top, a slim slightly darker band (about 11% of the height), empty;
- on the LEFT, an empty portrait photo area: a plain pale rectangle with a thin grey border, about 27% of the page width, from about 17% to 76% of the
  height;
- the rest of the upper page (right of the photo area) is plain light security pattern, empty, where the details will be printed;
- the bottom 19% is a plain off-white machine-readable band, empty.
Absolutely NO text, letters, digits, labels, field lines or signatures anywhere - everything is printed on later. Subtle holographic sheen, photorealistic.`;
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync('C:/workspace/BoostMind/public/verse/logo-512.png')], { type: 'image/png' }), 'logo.png');
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', j.error?.message); process.exit(1); }
fs.writeFileSync(S + `datapage-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', S + `datapage-${n}.jpg`);
