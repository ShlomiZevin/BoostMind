// The passport's art, round 2 (his notes 2026-11-07 in Backstage plan open-cz-sim): "it's Hebrew - the book opens right to left";
// "show inner pages with a stamp like a real passport, the logo flattened onto the page like a watermark".
//   node scripts/v2-design/cz-pages.mjs <which> [n]   which = cover | visa | data   ->  scratchpad stills/cz-<which>-<n>.jpg
// cover = the current cover with its spine moved to the right; visa = an inner visa page; data = the data page with the full logo
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/stills/';
const ART = 'C:/workspace/BoostMind/v2/site/verse/art/';
const LOGO = 'C:/workspace/BoostMind/public/verse/logo-512.png';
const [which = 'cover', n = '1'] = process.argv.slice(2);
const JOB = {
  cover: { size: '1024x1536', refs: [ART + 'citizen-passport.jpg', LOGO], prompt: `The first attached image is a photograph of a closed passport booklet. Make the same photograph again, identical in every
detail (the navy grained leatherette, the gold-foil logo exactly as it is with its Hebrew word "שלומיוורס" on the ring, the gold word "דרכון" above it,
"PASSPORT" below it, the chip symbol at the bottom, the warm light, the near-black background) - with ONE change: this is a HEBREW passport, which
opens from right to left, so its SPINE (the bound edge, with the hinge crease running down the cover close to the edge) is along the RIGHT edge of the
cover, and the LEFT edge is the free edge with the rounded worn corners. The gold letters must stay readable and unmirrored. Photorealistic, sharp.` },
  visa: { size: '1024x1536', refs: [LOGO], prompt: `A flat, straight-on scan of ONE inner VISA page of a real national passport, filling the whole frame edge to edge
(portrait). Cream security paper with very fine guilloche line patterns in pale blue, peach and lilac, like real passport pages. In the middle of the
page, LARGE and FAINT, the attached logo (a ringed planet with the Hebrew word "שלומיוורס" on its ring) printed into the paper as a pale watermark-like
security print, flattened into the guilloche - low contrast, part of the paper, never a sticker, the Hebrew word on the ring spelled exactly as in the logo.
A thin decorative guilloche band along the top edge. A small page number "7" printed at the bottom-left corner. The page is otherwise EMPTY: no stamps,
no other text, no people - entry stamps are added on it later. The binding edge (a faint shadow of the gutter) on the RIGHT side, because the passport
opens right to left. Photorealistic print texture.` },
  data: { size: '1536x1024', refs: [ART + 'citizen-datapage.jpg', LOGO], prompt: `The first attached image is the blank data page of a passport. Make the same page again, identical in layout and
colours (the guilloche patterns, the empty photo frame on the left, the top band, the empty machine-readable zone at the bottom) - with ONE change: the
faint ringed planet in the middle is replaced by the second attached logo - the ringed planet WITH the Hebrew word "שלומיוורס" on its ring - printed the same
way, faint, flattened into the guilloche as a watermark-like security print, the Hebrew word spelled exactly as in the logo and unmirrored. No other text
anywhere, no fields, no letters - the details are printed on it later. Photorealistic print texture.` },
};
const job = JOB[which];
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', job.prompt); form.append('size', job.size); form.append('quality', 'high'); form.append('output_format', 'jpeg');
for (const p of job.refs) form.append('image[]', new Blob([fs.readFileSync(p)], { type: /png$/.test(p) ? 'image/png' : 'image/jpeg' }), p.split('/').pop());
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', which, j.error?.message); process.exit(1); }
fs.mkdirSync(S, { recursive: true });
fs.writeFileSync(S + `cz-${which}-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', S + `cz-${which}-${n}.jpg`);
