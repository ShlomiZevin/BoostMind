// A shared Syncs meeting's link picture (his ask round 4: "WhatsApp with a nice social link" - the wrap-up and who was on the call).
// 1200x630: Syncs' mark, "סיכום ישיבה · טקי-טק", the wrap-up's title, the faces of everyone on the call with their names.
// Drawn by meeting-fn.js (GET /syncs/m/<id>/og.jpg) with the fonts the greetings' cards use (greetcard.js); the CDN keeps it.
const path = require('path');
const SITE = 'https://shlomiverse.com';
const PIC = (id) => `https://storage.googleapis.com/shlomiverse-media/wiki/img/c/${id}.jpg`;
const NAMES = { amir: 'אמיר', ofer: 'עופר', daniel: 'דניאל', ronit: 'רונית', gilad: 'גלעד', yaniv: 'יניב' };
let canvas;
function lib() {
  if (canvas) return canvas;
  canvas = require('@napi-rs/canvas');
  const F = (f) => path.join(__dirname, 'fonts', f);
  canvas.GlobalFonts.registerFromPath(F('heebo-hebrew-800-normal.woff2'), 'GHeebo');
  canvas.GlobalFonts.registerFromPath(F('heebo-latin-800-normal.woff2'), 'GHeeboL');
  return canvas;
}
const img = async (url) => { try { const r = await fetch(url); if (!r.ok) return null; return await lib().loadImage(Buffer.from(await r.arrayBuffer())); } catch (e) { return null; } };
const rl = (t) => '‏' + t + '‏';
// a right-to-left line with English words in it ("... למערכת AI"): the canvas doesn't reorder mixed runs, so each run is placed
// here - Hebrew runs from the right edge leftwards, an English run drawn left-to-right in its place
function rtlLine(x, text, right, y) {
  const runs = String(text).split(/([A-Za-z0-9][A-Za-z0-9 .,'&+\-/]*[A-Za-z0-9]|[A-Za-z0-9])/).filter((t) => t !== '');
  let at = right;
  for (const t of runs) {
    const latin = /^[A-Za-z0-9]/.test(t);
    x.direction = latin ? 'ltr' : 'rtl'; x.textAlign = 'right';
    x.fillText(latin ? t : rl(t), at, y);
    at -= x.measureText(t).width;
  }
  x.direction = 'rtl';
}

// m = the meeting as its page gets it (meeting-fn.js publicOf): {room, recap, visitor}
async function drawShare(m) {
  const { createCanvas } = lib();
  const c = createCanvas(1200, 630), x = c.getContext('2d');
  // the dark of the app, an orange glow behind the mark
  x.fillStyle = '#0b0b0e'; x.fillRect(0, 0, 1200, 630);
  const g = x.createRadialGradient(1080, 60, 20, 1080, 60, 760);
  g.addColorStop(0, 'rgba(255,106,31,.34)'); g.addColorStop(1, 'rgba(255,106,31,0)');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
  x.strokeStyle = 'rgba(255,150,80,.55)'; x.lineWidth = 3; round(x, 14, 14, 1172, 602, 40); x.stroke();

  const people = [...(m.room || []), 'user'];
  const [icon, ...faces] = await Promise.all([img(`${SITE}/verse/art/syncs-icon.png`), ...people.map((id) => (id === 'user' ? (m.visitor && m.visitor.photo ? img(m.visitor.photo) : null) : img(PIC(id))))]);
  // the mark: the icon, "Syncs", its line
  if (icon) x.drawImage(icon, 1046, 46, 110, 110);
  x.direction = 'ltr'; x.textAlign = 'right'; x.fillStyle = '#ffffff'; x.font = '800 66px GHeeboL';
  x.fillText('Syncs', 1024, 112);
  x.font = '800 28px GHeeboL'; x.fillStyle = '#ffb27a'; x.fillText("Let's circle back", 1024, 148);
  x.textAlign = 'left'; x.fillStyle = '#8fb6ff'; x.font = '800 30px GHeeboL'; x.fillText('</>', 70, 112);
  x.fillStyle = '#ffffff'; x.fillText('Techy-Tech', 124, 112);

  // the kicker and the wrap-up's title (as big as fits, two lines at most)
  x.direction = 'rtl'; x.textAlign = 'right';
  x.fillStyle = '#ff7a2e'; x.font = '800 34px GHeebo, GHeeboL'; x.fillText(rl('סיכום ישיבה · טקי-טק'), 1130, 240);
  const title = String((m.recap && m.recap.title) || 'ישיבה עם טקי-טק').trim();
  const W = 1060;
  let size = 78, lines = [title];
  for (; size >= 52; size -= 2) { x.font = `800 ${size}px GHeebo, GHeeboL`; if (x.measureText(title).width <= W) break; }
  if (size < 52) {
    const words = title.split(' '); let best = null;
    for (let i = 1; i < words.length; i++) { x.font = '800 60px GHeebo, GHeeboL'; const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const w = Math.max(x.measureText(a).width, x.measureText(b).width); if (!best || w < best.w) best = { a, b, w }; }
    lines = best ? [best.a, best.b] : [title];
    for (size = 60; size >= 40; size -= 2) { x.font = `800 ${size}px GHeebo, GHeeboL`; if (lines.every((l) => x.measureText(l).width <= W)) break; }
  }
  x.font = `800 ${size}px GHeebo, GHeeboL`; x.fillStyle = '#ffffff';
  lines.forEach((l, i) => rtlLine(x, l, 1130, 318 + i * size * 1.12));

  // the faces, right to left like the app's row, each with its name
  const n = people.length, R = n > 6 ? 46 : 52, gap = n > 6 ? 30 : 40;
  let cx = 1130 - R, cy = 488;
  people.forEach((id, i) => {
    const f = faces[i];
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.closePath(); x.clip();
    if (f) { const s = Math.max((2 * R) / f.width, (2 * R) / f.height); const w = f.width * s, h = f.height * s; x.drawImage(f, cx - w / 2, cy - R - (h - 2 * R) * 0.18, w, h); }
    else { x.fillStyle = '#3a2618'; x.fillRect(cx - R, cy - R, 2 * R, 2 * R); x.fillStyle = '#ffb27a'; x.font = `800 ${R}px GHeebo, GHeeboL`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(String((m.visitor && m.visitor.name) || '?').trim()[0] || '?', cx, cy + R * 0.36); }
    x.restore();
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.lineWidth = 4; x.strokeStyle = id === 'user' ? '#ffb27a' : 'rgba(255,255,255,.35)'; x.stroke();
    x.textAlign = 'center'; x.direction = 'rtl'; x.fillStyle = '#e8e4ee'; x.font = '800 24px GHeebo, GHeeboL';
    x.fillText(rl(id === 'user' ? (m.visitor && (m.visitor.name || m.visitor.title)) || '' : NAMES[id] || id), cx, cy + R + 34);
    cx -= 2 * R + gap;
  });
  return c.toBuffer('image/jpeg', 88);
}
function round(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
module.exports = { drawShare };
