// A greeting's link card WITH the sender's own words (his ask, 2026-11-19: "enable them to add a message to the link - it will be on
// the card - limit it so it fits; like a personal branded card, the message must not make it taller"). The base card (same size and
// look, an empty band under a thin rule - scripts/greetings/og.cjs base) is drawn by greet.cjs; here the server writes the words into
// the band: the message in a handwritten face (Amatic SC), the signature in Heebo. Text only, drawn by us - nobody uploads a picture.
// Used by page.js (POST /greeting/<id>/card).
const path = require('path');
const MAX_MSG = 40, MAX_NAME = 18;
let canvas;
function lib() {
  if (canvas) return canvas;
  canvas = require('@napi-rs/canvas');
  const F = (f) => path.join(__dirname, 'fonts', f);
  // a family per file + fallback lists: the Hebrew files have no digits / Latin / punctuation
  canvas.GlobalFonts.registerFromPath(F('amatic-sc-hebrew-700-normal.woff2'), 'GAmatic');
  canvas.GlobalFonts.registerFromPath(F('amatic-sc-latin-700-normal.woff2'), 'GAmaticL');
  canvas.GlobalFonts.registerFromPath(F('heebo-hebrew-800-normal.woff2'), 'GHeebo');
  canvas.GlobalFonts.registerFromPath(F('heebo-latin-800-normal.woff2'), 'GHeeboL');
  return canvas;
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// base = the base card (JPEG buffer, 1200x630); returns a JPEG buffer
async function drawCard(base, msg, name) {
  const { createCanvas, loadImage } = lib();
  msg = clean(msg, MAX_MSG); name = clean(name, MAX_NAME);
  const img = await loadImage(base);
  const c = createCanvas(1200, 630), x = c.getContext('2d');
  x.drawImage(img, 0, 0, 1200, 630);
  const R = 1144, W = 650, MSG = (s) => `700 ${s}px GAmatic, GAmaticL, GHeeboL`;
  x.direction = 'rtl'; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  // one line as big as fits (76 -> 50); still too long -> two lines
  let size = 76, lines = [msg];
  for (; size >= 50; size -= 2) { x.font = MSG(size); if (x.measureText(msg).width <= W) break; }
  if (size < 50) {
    const words = msg.split(' '); let best = null;
    for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const m = Math.max((x.font = MSG(58), x.measureText(a).width), x.measureText(b).width); if (!best || m < best.m) best = { a, b, m }; }
    lines = best ? [best.a, best.b] : [msg];
    for (size = 58; size >= 40; size -= 2) { x.font = MSG(size); if (lines.every((l) => x.measureText(l).width <= W)) break; }
  }
  x.font = MSG(size); x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(255,140,60,.35)'; x.shadowBlur = 16;
  const top = lines.length === 1 ? 462 : 432;
  const rl = (t) => '‏' + t + '‏';   // right-to-left marks anchor a leading / trailing "!" or "—" to the RTL ends
  lines.forEach((l, i) => x.fillText(rl(l), R, top + i * size * 1.02));
  if (name) {
    x.shadowBlur = 0; x.font = '800 30px GHeebo, GHeeboL'; x.fillStyle = '#ffb074';
    x.fillText(rl('— ' + name), R, top + (lines.length - 1) * size * 1.02 + 50);
  }
  return c.toBuffer('image/jpeg', 90);
}
module.exports = { drawCard, clean, MAX_MSG, MAX_NAME };
