// מילימטרים – physiotherapy for Yaniv, the broken security guy. Bend his joint with one finger, slowly, into a green
// zone a few millimetres wide, and hold it there. A hair too far and he screams; too fast and it hurts; even a good
// stretch makes it a little worse ("פיזיותרפיה שנתיים אני עושה, רק מחמיר"). When the pain meter is full he walks out.
'use strict';
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;
const KEY = { best: 'shlomiverse:millimeters:best', day: 'shlomiverse:millimeters:day', tut: 'shlomiverse:millimeters:tut', snd: 'shlomiverse:millimeters:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ───────────────────────── the exercises ─────────────────────────
// max = how far the joint bends (degrees), c = where the green zone can sit
const EX = {
  wrist: { name: 'שורש כף היד', max: 80, c: [32, 62] },
  finger: { name: 'האצבע', max: 90, c: [38, 72] },
  elbow: { name: 'המרפק', max: 115, c: [45, 95] },
  ankle: { name: 'הקרסול', max: 55, c: [22, 42] },
  knee: { name: 'הברך', max: 105, c: [40, 85] },
};
const ORDER = ['wrist', 'finger', 'elbow', 'ankle', 'knee'];
const REPS = 3, HOLD = 3, VMAX = 85;
const zoneW = (s) => Math.max(6, 16 - 1.6 * s);          // degrees - narrower every session
const drift = (s) => Math.min(26, 9 + 2.2 * s);          // the green always wanders - a bit more every session
const pace = (s) => Math.min(2.2, 0.75 + 0.14 * s);      // ...and faster

// ───────────────────────── art ─────────────────────────
const IMG = {}; let PARTS = {};
const img = (k, src) => { const i = new Image(); i.src = src; IMG[k] = i; return i; };
img('bg', 'assets/bg.jpg');
const POSES = ['serious', 'wince', 'scream', 'talk', 'deadpan'];
for (const p of POSES) img('p-' + p, `assets/poses/${p}.webp`);
for (const n of ORDER) img(n, `assets/parts/${n}.webp`);
fetch('assets/parts.json').then((r) => r.json()).then((j) => { PARTS = j; layout(); });

// ───────────────────────── Yaniv's words ─────────────────────────
const sayEl = $('say');
let pose = 'serious', poseT = 0, sayT = 0, bump = 0;
function setPose(n, hold = 1.2) { pose = n; poseT = hold; bump = 1; }
function say(text, dur = 2.6, loud = false) { sayEl.textContent = text; sayEl.classList.add('on'); sayEl.classList.toggle('loud', loud); sayT = dur; }
const LINES = {
  over: ['מילימטרים! אמרתי לך מילימטרים!', 'איי! קיבלתי חשמל בכל הגוף!', 'זה שולח לי עד האונה השמאלית!', 'תעצור! תעצור!', 'יש לי דלקת כרונית בגידים!', 'מה אתה עושה?! זה לוחץ לי על העצב המדיאני!'],
  fast: ['לאט! לאט!', 'יש לי טווח תנועה של מילימטרים!', 'מה אתה ממהר? אני לא ממהר.', 'בעדינות! אני מקבל חשמל!'],
  rep: ['...טוב. זה לא עזר.', 'וואלה, עכשיו זה עבר לכתף.', 'עוזר לשנייה – וחוזר.', 'רק מחמיר.', 'יופי. עכשיו כואב לי במקום אחר.', 'הרגשת? גם אני לא.'],
  calm: ['...נושם. נושם.', 'רגע. תן לי רגע.', 'אל תיגע. רק רגע.'],
  sess: ['שנתיים אני עושה פיזיותרפיה. רק מחמיר.', 'למה אני ממשיך? כי אם אפסיק זה יחמיר עוד יותר!', 'מה אתה צוחק? אני רציני איתך.', 'כדורים – עוזר לשבוע, חוזר. זריקות – לא עוזר.', 'הייתי אצל כל האורתופדים בארץ. לא מוצאים כלום.'],
  start: (n) => pick([`היום: ${n}. יש לי אישור מאורתופד.`, `${n}. בעדינות, כן?`, `עכשיו ${n}. אני כבר אומר לך – זה לא יעזור.`]),
  out: ['תכף אני יוצא. אני לא יכול לשכב יותר מעשר דקות.', 'זהו. אני הולך. יש לי אישור.', 'בגלל הטיפולים האלה אני נראה ככה!'],
};
function pickNo(list, key) { const last = pickNo[key]; let l = pick(list); if (list.length > 1 && l === last) l = list[(list.indexOf(l) + 1) % list.length]; pickNo[key] = l; return l; }

// ───────────────────────── effects ─────────────────────────
const fxEl = $('fx');
function popText(x, y, text, good) { const p = document.createElement('div'); p.className = 'pop' + (good ? ' good' : ''); p.style.left = x + 'px'; p.style.top = y + 'px'; p.textContent = text; fxEl.appendChild(p); setTimeout(() => p.remove(), 1000); }
function flash() { const f = document.createElement('div'); f.className = 'flash'; fxEl.appendChild(f); setTimeout(() => f.remove(), 400); }
function banner(text, small) { const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = text + (small ? `<small>${small}</small>` : ''); fxEl.appendChild(b); setTimeout(() => b.remove(), 1900); }

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null };
const SFX = ['ouch-1', 'ouch-2', 'ouch-3', 'ouch-4', 'scream-1', 'scream-2', 'crack-1', 'crack-2', 'done-1', 'done-2', 'session', 'walkout', 'hold'];
for (const n of SFX) fetch(`assets/sfx/${n}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
// a name plays one of its variants (ouch → ouch-1..4), never the same one twice in a row
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || n.startsWith(name + '-')).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rnd(.96, 1.04); gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, L = {};
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520 && 'ontouchstart' in window);
  const cw = Math.min(W, H * 0.66), cx = W / 2;                     // the play column
  const top = 112 + safeTop(), bottom = H - 60 - safeBot();          // under the HUD + words, above the chip
  const bustH = Math.min(cw * 0.62, (bottom - top) * 0.40);
  const bedY = top + bustH;                                          // the bed's far edge = the bottom of his chest
  L = { cw, cx, top, bottom, bustH, bedY, x0: cx - cw / 2 };
  const p = PARTS[cur.ex]; if (p) fitPart(p);
}
function fitPart(p) {
  const piv = (p.b0 + p.b1) / 2, mov = p.w - piv;
  const spaceY = L.bottom - L.bedY;
  let s = (L.cw * 0.56) / mov;                                        // the moving part is half the column
  s = Math.min(s, (spaceY * 0.42) / p.h * 1.6, spaceY * 0.95 / (mov * Math.sin(Math.min(90, EX[cur.ex].max) * DEG) + p.py * 0.4 + 1));
  L.s = s; L.piv = piv;
  L.PX = L.x0 + L.cw * 0.40;
  L.PY = L.bottom - Math.max(p.h - p.py, p.py) * s * 0.55 - 6;
  L.R = mov * s * 0.80;                                              // the handle sits near the end of the moving part
}
const safeTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--st')) || 0;
const safeBot = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sb')) || 0;
addEventListener('resize', layout);

// ───────────────────────── state ─────────────────────────
let state = 'menu', paused = false, sessions = 0, reps = 0, pain = 0, floorPain = 0, tutorial = false;
const cur = { ex: 'wrist', a: 0, c: 45, w: 15, rep: 0, hold: 0, back: 0, flinch: 0, still: 0, t: 0, calmSaid: false };
const drag = { on: false, id: null, last: 0, v: 0 };

function newRep() {
  const e = EX[cur.ex];
  cur.c = rnd(e.c[0], e.c[1]); cur.w = tutorial ? 16 : zoneW(sessions); cur.hold = 0; cur.t = rnd(10);
}
function newSession() {
  cur.ex = tutorial ? 'wrist' : ORDER[sessions % ORDER.length];
  cur.rep = 0; cur.a = 0; cur.back = 0; layout(); newRep();
  $('sessTxt').textContent = tutorial ? '–' : sessions + 1;
  if (!tutorial) { play('session', .7); setPose('talk', 2.2); say(LINES.start(EX[cur.ex].name), 2.8); banner(`טיפול ${sessions + 1}`, EX[cur.ex].name); }
}
function startGame() {
  tutorial = false; state = 'play'; sessions = 0; reps = 0; pain = 0; floorPain = 0;
  showHUD(true); show(null); newSession();
  window.track && window.track('game_start', 'millimeters');
}
function zoneC() {
  const d = tutorial ? 5 : drift(sessions), t = cur.t * (tutorial ? 0.6 : pace(sessions)), e = EX[cur.ex];
  return clamp(cur.c + Math.sin(t * 0.9) * d * 0.55 + Math.sin(t * 2.1 + 1.3) * d * 0.3, cur.w / 2 + 2, e.max - cur.w / 2 - 2);
}

// ───────────────────────── input: drag the joint ─────────────────────────
function angleAt(x, y) { return -Math.atan2(y - L.PY, x - L.PX) / DEG; }   // degrees, up = positive
cv.addEventListener('pointerdown', (e) => {
  audioUnlock();
  if (paused || (state !== 'play' && state !== 'tut') || cur.back > 0 || cur.flinch > 0) return;
  drag.on = true; drag.id = e.pointerId; drag.last = angleAt(e.clientX, e.clientY); drag.v = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', (e) => {
  if (!drag.on || e.pointerId !== drag.id) return;
  let a = angleAt(e.clientX, e.clientY), d = a - drag.last;
  if (d > 180) d -= 360; if (d < -180) d += 360;
  drag.last = a; moveBy(d);
});
const endDrag = (e) => { if (e.pointerId === drag.id) drag.on = false; };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
let moved = 0;
function moveBy(d) {
  const max = EX[cur.ex].max;
  cur.a = clamp(cur.a + d, 0, max); moved += Math.abs(d); cur.still = 0;
}
// keyboard: arrows bend it a little at a time
const keys = {};
addEventListener('keydown', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') keys.up = 1; if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') keys.down = 1; });
addEventListener('keyup', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') keys.up = 0; if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') keys.down = 0; });

// ───────────────────────── the rules, every frame ─────────────────────────
function hurt(n, x, y, text) {
  pain = clamp(pain + n, 0, 100);
  if (text) popText(x, y, text);
  $('meter').classList.remove('hit'); void $('meter').offsetWidth; $('meter').classList.add('hit');
}
function step(dt) {
  if (keys.up || keys.down) moveBy((keys.up ? 1 : -1) * 40 * dt);
  cur.t += dt;
  const v = moved / dt; moved = 0; drag.v = drag.v * 0.7 + v * 0.3;
  const zc = zoneC(), lo = zc - cur.w / 2, hi = zc + cur.w / 2;
  const tip = handlePos();
  if (cur.flinch > 0) {                                   // he pulls back after a scream
    cur.flinch -= dt; cur.a = Math.max(0, cur.a - 160 * dt); return;
  }
  if (cur.back > 0) {                                     // a finished rep: the joint goes back to rest
    cur.back -= dt; cur.a = Math.max(0, cur.a - 120 * dt);
    if (cur.back <= 0) { cur.a = 0; if (cur.rep >= REPS) sessionDone(); else newRep(); }
    return;
  }
  // too far = a scream, a jump in pain, and he pulls back
  if (cur.a > hi + 7) {
    hurt(tutorial ? 0 : 13 + sessions * 0.8, tip.x, tip.y - 30, 'איי!');
    play('scream', .9); flash(); setPose('scream', 1.4); say(pickNo(LINES.over, 'over'), 2.4, true);
    cur.flinch = 0.5; cur.hold = Math.max(0, cur.hold - 0.6); drag.on = false;
    if (tutWait && tutWait.id === 'over') tutWait.done = true;
    return;
  }
  // too fast hurts too
  if (drag.v > VMAX) {
    if (!tutorial) pain = clamp(pain + (drag.v - VMAX) * 0.05 * dt, 0, 100);
    if (poseT <= 0.3 || pose === 'serious') { setPose('wince', 0.9); play('ouch', .7); say(pickNo(LINES.fast, 'fast'), 1.8); }
  }
  // in the green: hold it
  const inZone = cur.a >= lo && cur.a <= hi;
  if (inZone) {
    const before = cur.hold; cur.hold += dt;
    if (Math.floor(before * 3) !== Math.floor(cur.hold * 3)) play('hold', .35);
    if (tutWait && tutWait.id === 'zone') tutWait.done = true;
    if (cur.hold >= HOLD) repDone(tip);
  } else if (cur.hold > 0) {                              // slipped off the green: the hold drains and it hurts
    cur.hold = Math.max(0, cur.hold - dt * 1.2);
    if (!tutorial) pain = clamp(pain + (2 + sessions * 0.3) * dt, 0, 100);
    if (poseT <= 0.3 || pose === 'serious') { setPose('wince', 0.8); if (Math.random() < 0.5) say(pickNo(LINES.fast, 'fast'), 1.6); }
  }
  // keep still and breathe: the pain goes down a little - never below what the treatment already did to him
  cur.still += dt;
  if (cur.still > 1.2 && !drag.on && pain > floorPain) {
    pain = Math.max(floorPain, pain - 2.5 * dt);
    if (!cur.calmSaid && pain > 25) { cur.calmSaid = true; say(pickNo(LINES.calm, 'calm'), 1.8); }
  } else if (cur.still < 0.2) cur.calmSaid = false;
  if (!tutorial && pain >= 100) gameOver();
}
function repDone(tip) {
  cur.rep++; reps++; cur.back = 0.6; cur.hold = 0; drag.on = false;
  play('done', .6); play('crack', .5);
  popText(tip.x, tip.y - 30, `חזרה ${cur.rep}/${REPS}`, true);
  setPose('deadpan', 1.6); say(pickNo(LINES.rep, 'rep'), 2.2);
  if (!tutorial) { const worse = 3 + sessions * 0.6; pain = clamp(pain + worse, 0, 100); floorPain = Math.min(55, floorPain + 1.2); }
  if (tutWait && tutWait.id === 'rep') tutWait.done = true;
}
function sessionDone() {
  if (tutorial) { cur.rep = 0; newRep(); return; }
  sessions++;
  setPose('talk', 2.4); say(pickNo(LINES.sess, 'sess'), 3);
  setTimeout(() => { if (state === 'play') newSession(); }, 1600);
  cur.back = 99;   // frozen until the next session
}

// ───────────────────────── drawing ─────────────────────────
function handlePos(a = cur.a) { return { x: L.PX + Math.cos(-a * DEG) * L.R, y: L.PY + Math.sin(-a * DEG) * L.R }; }
// the painted room, placed so its bed starts right under his chest
function drawBg() {
  const im = IMG.bg; if (!im.complete || !im.naturalWidth) return;
  const iw = im.naturalWidth, ih = im.naturalHeight, BED = 0.53;
  const k = Math.max(W / iw, (H - L.bedY) / ((1 - BED) * ih), L.bedY / (BED * ih));
  ctx.drawImage(im, (W - iw * k) / 2, L.bedY - BED * ih * k, iw * k, ih * k);
}
function cover(im, x, y, w, h) {
  if (!im.complete || !im.naturalWidth) return;
  const k = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k;
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) * 0.75, iw, ih);
}
function drawPart() {
  const p = PARTS[cur.ex], im = IMG[cur.ex]; if (!p || !im.complete) return;
  const s = L.s, piv = L.piv, py = p.py;
  ctx.save(); ctx.shadowColor = '#0006'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
  // the moving side, turned about the joint
  ctx.save(); ctx.translate(L.PX, L.PY); ctx.rotate(-cur.a * DEG);
  ctx.beginPath(); ctx.rect(0, -p.h * s, (p.w - piv) * s + 4, p.h * s * 2); ctx.clip();
  ctx.drawImage(im, -piv * s, -py * s, p.w * s, p.h * s); ctx.restore();
  // the fixed side with the whole brace on top, hiding the seam
  ctx.save(); ctx.translate(L.PX, L.PY);
  ctx.beginPath(); ctx.rect(-piv * s - 2, -py * s - 2, p.b1 * s + 2, p.h * s + 4); ctx.clip();
  ctx.drawImage(im, -piv * s, -py * s, p.w * s, p.h * s); ctx.restore();
  ctx.restore();
}
function drawArc() {
  const max = EX[cur.ex].max, R = L.R, zc = zoneC(), w = cur.w;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffffb0'; ctx.lineWidth = 6; ctx.setLineDash([2, 12]);
  ctx.beginPath(); ctx.arc(L.PX, L.PY, R, -max * DEG, 0); ctx.stroke(); ctx.setLineDash([]);
  // the green zone - "millimetres"
  const a0 = -(zc + w / 2) * DEG, a1 = -(zc - w / 2) * DEG;
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 16; ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(L.PX, L.PY, R, a0, a1); ctx.stroke();
  // the red beyond it
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ef444466'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(L.PX, L.PY, R, -max * DEG, a0 - 0.01); ctx.stroke();
  // the handle with its hold ring
  const h = handlePos(), inZone = cur.a >= zc - w / 2 && cur.a <= zc + w / 2;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = inZone ? '#22c55e' : '#10284a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(h.x, h.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (cur.hold > 0) {
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(h.x, h.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cur.hold / HOLD)); ctx.stroke();
  }
  ctx.restore();
}
function drawYaniv(t) {
  const im = IMG['p-' + pose]; if (!im.complete) return;
  const h = L.bustH * 1.12, w = h, x = L.cx - w / 2, y = L.bedY - h + h * 0.06;
  const shake = pose === 'scream' ? Math.sin(t * 60) * 3 : pose === 'wince' ? Math.sin(t * 40) * 1.5 : 0;
  const sc = 1 + bump * 0.04;
  ctx.save(); ctx.translate(x + w / 2 + shake, y + h); ctx.scale(sc, sc);
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function draw(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#123a63'; ctx.fillRect(0, 0, W, H);
  drawBg();
  if (state === 'play' || state === 'tut' || state === 'over') { drawYaniv(t); drawPart(); if (state !== 'over') drawArc(); }
  // the pain bar
  $('bar').firstElementChild.style.width = floorPain + '%';
  $('bar').lastElementChild.style.width = pain + '%';
}

// ───────────────────────── screens ─────────────────────────
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); $('chip').classList.toggle('on', on); }
function bestNum() { return +(store.get(KEY.best) || 0); }
function showBest() {
  const b = bestNum(), d = (store.get(KEY.day) || '').split('|');
  const td = d[0] === today() ? +d[1] : 0;
  const t = b ? `השיא שלכם: <b>${b}</b> טיפולים` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה טיפולים תשרדו?';
  $('bestStart').innerHTML = t; $('bestOver').innerHTML = b ? `השיא שלכם: <b>${b}</b> טיפולים` : '';
}
function gameOver() {
  state = 'over'; drag.on = false; play('walkout', .8); setPose('talk', 9); say(pick(LINES.out), 3);
  window.track && window.track('game_over', 'millimeters');
  const b = bestNum(), rec = sessions > b;
  if (rec) store.set(KEY.best, sessions);
  const d = (store.get(KEY.day) || '').split('|');
  if (d[0] !== today() || sessions > +d[1]) store.set(KEY.day, `${today()}|${sessions}`);
  setTimeout(() => {
    fxEl.innerHTML = ''; showHUD(false);
    $('overScore').innerHTML = `${sessions}<small>${sessions === 1 ? 'טיפול' : 'טיפולים'} · ${reps} חזרות</small>`;
    $('overLine').textContent = sessions >= 6 ? '״וואלה, אתה טוב. לא עזר, אבל אתה טוב.״' : sessions >= 3 ? '״פיזיותרפיה שנתיים אני עושה – רק מחמיר.״' : '״אמרתי לך. מילימטרים.״';
    $('overRec').innerHTML = rec && sessions ? '<span class="newrec">שיא חדש!</span>' : '';
    showBest(); show('over');
  }, 1800);
}
$('playBtn').onclick = () => { audioUnlock(); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { audioUnlock(); tut.begin(); };
$('againBtn').onclick = () => { audioUnlock(); startGame(); };
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  paused = on; drag.on = false; show(on ? 'paused' : null);
  if (SND.ctx) on ? SND.ctx.suspend() : SND.ctx.resume();
}
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => pause(false);
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; tut.end(true); showHUD(false); showBest(); show('start'); };
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play') pause(true); else if (SND.ctx) SND.ctx.suspend(); } });
document.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => SND.ctx && SND.ctx.suspend()));

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotBust = () => ({ x: L.cx - L.bustH * 0.56, y: L.bedY - L.bustH * 1.06, w: L.bustH * 1.12, h: L.bustH * 1.06 });
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }; };
const spotArc = () => { const R = L.R + 34; return { x: L.PX - 34, y: L.PY - R, w: R + 34, h: R + 34 }; };
const STEPS = [
  { text: 'זה יניב, מאבטחת המידע בטקי-טק. כואב לו <b>הכל</b>. אתם הפיזיותרפיסטים שלו.', spot: spotBust },
  { text: '<b>המטרה:</b> לעשות לו את התרגילים. כל טיפול = 3 חזרות. כמה טיפולים תשרדו?', spot: spotEl('sess') },
  { text: 'זה <b>מד הכאב</b>. כשהוא מתמלא – יניב קם והולך, והמשחק נגמר.', spot: spotEl('meter') },
  { text: 'גררו את האצבע <b>לאט</b> לאורך הקשת, והמפרק יתכופף. רק ה<b style="color:#16a34a">ירוק</b> נחשב – והוא בגודל של מילימטרים.', spot: spotArc },
  { text: 'נסו עכשיו: <b>גררו לאט</b> עד שהעיגול נכנס לירוק.', try: 'zone', spot: spotArc },
  { text: 'הירוק <b>זז</b>! <b>הישארו עליו</b> עד שהטבעת מתמלאת – זו חזרה אחת. יצאתם ממנו? הטבעת מתרוקנת.', try: 'rep', spot: spotArc },
  { text: 'ועכשיו בכוונה: <b>עברו את הירוק</b>. תראו מה קורה.', try: 'over', spot: spotArc },
  { text: 'הרבה מדי – והוא צועק, והכאב קופץ. גם <b>מהר מדי</b> כואב לו. ככל שמתקדמים, הירוק קטן וזז מהר יותר.' },
  { text: 'לא נוגעים רגע? הכאב <b>יורד קצת</b>. אבל גם כשמצליחים – זה רק מחמיר. ככה זה אצל יניב. מוכנים?', spot: spotEl('meter'), last: true },
];
const tut = {
  on: false, i: 0,
  begin() {
    show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0; pain = 0; floorPain = 0; sessions = 0; reps = 0;
    newSession(); setPose('serious', 0); say('מה? עוד פיזיותרפיה? יאללה.', 2.5);
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false } : null;
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'לטיפול!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
  },
  next() {
    if (tutWait && !tutWait.done) return;
    play('hold', .5);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false;
    if (!quiet) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = STEPS[this.i], sp = s.spot && s.spot();
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card sits away from what it points at
    const up = sp && sp.y + sp.h / 2 > H * 0.5;
    tutCard.style.top = up ? `calc(env(safe-area-inset-top,0px) + 108px)` : 'auto';
    tutCard.style.bottom = up ? 'auto' : `calc(env(safe-area-inset-bottom,0px) + 64px)`;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => tut.end();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paused) return pause(false);
  if (!tut.on || paused) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── the verb chip ─────────────────────────
let chipTxt = '';
function chip() {
  let t = '';
  if (state === 'play' || state === 'tut') {
    const zc = zoneC(), inZone = cur.a >= zc - cur.w / 2 && cur.a <= zc + cur.w / 2;
    if (cur.flinch > 0) t = 'אוי. <em>חכו</em> רגע';
    else if (cur.back > 0) t = cur.rep >= REPS ? 'טיפול נגמר' : 'עוד חזרה...';
    else if (inZone) t = '<em>הישארו</em> על הירוק';
    else if (drag.v > VMAX) t = '<em>לאט!</em> מילימטרים';
    else t = '<em>גררו לאט</em> עד הירוק';
  }
  if (t !== chipTxt) { chipTxt = t; $('chip').innerHTML = t; }
}

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused && (state === 'play' || state === 'tut')) step(dt);
  if (poseT > 0) { poseT -= dt; if (poseT <= 0 && state !== 'over') pose = 'serious'; }
  bump = Math.max(0, bump - dt * 5);
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('on'); }
  draw(now / 1000); chip(); tut.frame();
  requestAnimationFrame(frame);
}
layout(); showBest(); requestAnimationFrame(frame);

// for the tests
window.MILLI = { get state() { return state; }, get pain() { return pain; }, get sessions() { return sessions; }, get reps() { return reps; }, cur, zoneC, handlePos, startGame, get tut() { return tut.on; }, get L() { return L; } };
