// Trip app "From" share card, round 2 (his ask 2026-11-24): the bottle tree becomes a CHRISTMAS bottle tree, disturbing
// in the same way as the town. Edits the round-1 picture; the result is shrunk at once to phone size (600 px, JPEG 80%)
// and only that small copy is kept - no full-size pictures (his rule).
// node scripts/v2-design/trip-share-from-tree.mjs <round-1 picture> <out jpg>
import fs from 'node:fs'
import { createRequire } from 'node:module'
const sharp = createRequire('c:/workspace/trip-planner/package.json')('sharp')
const [SRC, OUT] = process.argv.slice(2)
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY')

const PROMPT = `Keep this picture exactly as it is - the same abandoned foggy Christmas market at night, the cathedral, the
distant lighthouse beam, the stones on the window sills, the far still figure, the same cold palette and mood - and change
ONLY the bare tree in the foreground on the left: make it a Christmas tree. A tall fir Christmas tree, but wrong and
disturbing in the same way as the town: half of its needles dead and grey, branches sagging, hung everywhere with empty
glass bottles instead of ornaments - bottles of different sizes and colours swinging on old strings, catching a cold light;
a few broken Christmas light bulbs flickering sick yellow among them; a crooked dark star on top; tinsel torn and hanging
like cobwebs; a little snow on it. Eerie, quiet dread, not gory, no monsters. No text, no letters anywhere.`

const f = new FormData()
f.append('model', 'gpt-image-2.6-flare'); f.append('prompt', PROMPT); f.append('size', '1536x1024')
f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg')
f.append('image[]', new Blob([await sharp(SRC).resize({ width: 1024 }).jpeg({ quality: 85 }).toBuffer()], { type: 'image/jpeg' }), 'town.jpg')
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f })
const j = await res.json()
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1) }
const small = await sharp(Buffer.from(j.data[0].b64_json, 'base64')).resize({ width: 600 }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
fs.writeFileSync(OUT, small)
console.log('ok', Math.round(small.length / 1024) + ' KB', j.usage?.output_tokens)
