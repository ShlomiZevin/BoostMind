// Trip app "From" share card, round 3 (his ask 2026-11-24): the round-1 town EXACTLY, only the bare bottle tree becomes a
// disturbing Christmas bottle tree in the same place and size. Masked edit, then the new tree is feathered back onto the
// original so every other pixel stays the same. Output 600 px JPEG 80% only (his rule).
// node scripts/v2-design/trip-share-from-xmas-tree.mjs <round-1 picture 600x400> <out jpg>
import fs from 'node:fs'
import { createRequire } from 'node:module'
const sharp = createRequire('c:/workspace/trip-planner/package.json')('sharp')
const [SRC, OUT] = process.argv.slice(2)
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY')

const W = 1536, H = 1024
// The bare tree: the top-left of the picture, down to the stall roofs (fractions of the picture).
const R = { x: 0, y: 0, w: 0.42, h: 0.56 }

const PROMPT = `Edit only the transparent area of the mask. Everything else must stay exactly as it is.
In that area there is a bare dead tree hung with empty glass bottles. Replace it with a CHRISTMAS tree in the same place
and at the same large size, prominent in the foreground: a tall fir Christmas tree that is wrong and disturbing in the same
way as the town - half of its needles dead and grey, branches sagging, hung densely with empty glass bottles (clear, green,
brown, of different sizes, on old strings) instead of ornaments, catching a cold light; a few broken Christmas bulbs
flickering a sick yellow; torn tinsel hanging like cobwebs; a crooked dark star on top; a little snow. Same night, fog,
cold blue-grey palette and lighting as the rest of the picture. Eerie, not gory, no monsters. No text, no letters.`

const base = await sharp(SRC).resize(W, H).png().toBuffer()
const hole = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>` +
  `<rect x="${R.x * W}" y="${R.y * H}" width="${R.w * W}" height="${R.h * H}" fill="#000"/></svg>`
// Mask: opaque everywhere, transparent where the tree goes.
const alpha = await sharp(Buffer.from(hole)).flatten({ background: '#fff' }).extractChannel(0).raw().toBuffer()
const mask = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
  .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer()

const f = new FormData()
f.append('model', 'gpt-image-2.6-flare'); f.append('prompt', PROMPT); f.append('size', `${W}x${H}`)
f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'png')
f.append('image[]', new Blob([base], { type: 'image/png' }), 'town.png')
f.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png')
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f })
const j = await res.json()
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1) }

// Back to 600x400 and feathered onto the original: outside the tree area the picture is the original, pixel for pixel.
const w = 600, h = 400
const gen = await sharp(Buffer.from(j.data[0].b64_json, 'base64')).resize(w, h).png().toBuffer()
const feather = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><filter id="b"><feGaussianBlur stdDeviation="8"/></filter></defs>` +
  `<rect width="${w}" height="${h}" fill="#000"/><rect x="-20" y="-20" width="${R.w * w + 10}" height="${R.h * h + 10}" fill="#fff" filter="url(#b)"/></svg>`
const fa = await sharp(Buffer.from(feather)).flatten({ background: '#000' }).extractChannel(0).raw().toBuffer()
// Plain per-pixel blend: new tree where the feather is white, the original everywhere else.
const g = await sharp(gen).removeAlpha().raw().toBuffer()
const o = await sharp(SRC).resize(w, h).removeAlpha().raw().toBuffer()
const mix = Buffer.alloc(w * h * 3)
for (let i = 0; i < w * h; i++) {
  const a = fa[i] / 255
  for (let c = 0; c < 3; c++) mix[i * 3 + c] = Math.round(g[i * 3 + c] * a + o[i * 3 + c] * (1 - a))
}
const out = await sharp(mix, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
if (process.env.KEEP_GEN) fs.writeFileSync(process.env.KEEP_GEN, await sharp(gen).jpeg({ quality: 80 }).toBuffer())
fs.writeFileSync(OUT, out)
console.log('ok', Math.round(out.length / 1024) + ' KB', j.usage?.output_tokens)
