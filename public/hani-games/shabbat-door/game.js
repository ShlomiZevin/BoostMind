// דלת של שבת – Red Light, Green Light at the hospital's Shabbat doors.
// Friday night at the hospital: one roll, no lechem mishneh. Hani walks to Reb Shmulik in the other building and back.
// Every Shabbat door opens and closes BY ITSELF on a timer. Hold "הולכים" to walk, let go to stop.
// Never step on the sensor mat while the door is closed (it would open because of you) - wait for it to open by itself.
'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SLUG = 'shabbat-door';
const KEY = { best: `hani-games:${SLUG}:best`, day: `hani-games:${SLUG}:day`, tut: `hani-games:${SLUG}:tut`, snd: `hani-games:${SLUG}:snd` };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// a seeded generator: the same doors for everyone each day
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
let R = Math.random; const rnd = (a, b) => a + R() * (b - a);
const pickR = (a) => a[Math.floor(Math.random() * a.length)];

// ───────────────────────── the route ─────────────────────────
// open / closed = seconds of the door's own timer; staff = a staff member comes through and opens it on the way
const SCENES = [
  { name: 'אורתופדית', bg: 'ward', open: 3.4, closed: 3.6, staff: false, line: 'שבת שלום! רק לחמנייה אחת... אין לחם משנה! הולכים לרב שמוליק.' },
  { name: 'יוצאים מהבניין', bg: 'er', open: 2.8, closed: 4.2, staff: true, line: 'לאט לאט, זה שבת. מחכים שהדלת תיפתח לבד.' },
  { name: 'המעבר לבניין השני', bg: 'out', open: 2.5, closed: 4.4, staff: false, line: 'אברהם משה בירר עם הרב – העירוב כולל את המעבר. הכול מסודר!' },
  { name: 'פנימית – רב שמוליק', bg: 'er', open: 2.2, closed: 4.6, staff: true, line: 'פנימית! רב שמוליק כבר מחכה עם הלחמנייה.', roll: true },
  { name: 'חוזרים – המעבר', bg: 'out', open: 2.0, closed: 4.2, staff: false, line: 'עכשיו חוזרים לאבא. מהר – אבל בלי פסיעה גסה!' },
  { name: 'יוצאים מפנימית', bg: 'er', open: 1.8, closed: 4.6, staff: true, line: 'עוד דלת ועוד דלת... ישועת השם כהרף עין!' },
  { name: 'אורתופדית – אבא מחכה', bg: 'ward', open: 1.6, closed: 4.2, staff: true, line: 'אבא מחכה להמוציא! עוד דלת אחת!' },
];
const PENALTY = 5;
const MAT0 = 0.76, DOORZ = 1.0, PAST = 1.06, DONEZ = 1.2;   // depth: 0 = near, 1 = the door's line
const WALK = 0.2, FAST = 0.42, FAST_MAX = 2.2;               // depth per second; seconds of hurrying per door
const SLIDE = 0.55;                                          // seconds for the glass to slide
const WARN = 1.3;                                            // the light blinks this long before it closes

// ───────────────────────── Hani's lines ─────────────────────────
const LINES = {
  sensor: ['חס וחלילה! הדלת נפתחה בגללי!', 'השם ירחם! דרכתי על החיישן!', 'אוי, אברהם משה יגיד שזה פסיק רישא!', 'חס ושלום! צריך לחכות שהיא תיפתח לבד!'],
  held: ['אוי! הדלת נשארה פתוחה בגללי!', 'השם ירחם, עמדתי בחיישן כשהיא נסגרה!', 'חס וחלילה! הייתי צריכה לעבור מהר יותר!'],
  fast: ['אני מזדרזת בשינוי – לצורך ביקור חולים!', 'בשינוי! יש בזה צד להיתר!', 'זה לצורך מצווה – בשינוי!'],
  fastEmpty: ['נגמר הבשינוי לדלת הזאת – הולכים רגיל.', 'מספיק להזדרז, לאט לאט עכשיו.'],
  staff: ['תראי איזה חסדי השם – הוא פתח לנו!', 'שליח נאמן! עוברים אחריו!', 'איזה צוות, ממש מסירות נפש!'],
  pass: ['ברוך השם!', 'יופי, עוד דלת!', 'תראי איך הקדוש ברוך הוא מסדר!', 'עברנו! בעזרת השם!'],
  wait: ['מחכים בסבלנות... זה שבת.', 'עוד רגע היא נפתחת לבד.', 'לא נוגעים בחיישן, חס וחלילה.'],
  over: ['תראי איך הקדוש ברוך הוא מסדר את הדברים!', 'בשורות טובות, ישועות ונחמות!', 'ישועת השם כהרף עין!', 'ניסי ניסים! עוד פעם?'],
};

// ───────────────────────── pictures ─────────────────────────
const IMG = {};
const PICS = { bgward: 'bg-ward.jpg', bger: 'bg-er.jpg', bgout: 'bg-out.jpg', frame: 'door-frame.png', left: 'door-left.png', right: 'door-right.png', walk1: 'hani-walk1.png', walk2: 'hani-walk2.png', stand: 'hani-stand.png', oops: 'hani-oops.png', joy: 'hani-joy.png', staff: 'orderly.png', roll: 'roll.png' };
let loaded = 0; const NPICS = Object.keys(PICS).length;
for (const [k, f] of Object.entries(PICS)) { const i = new Image(); i.onload = () => { loaded++; }; i.src = 'assets/' + f; IMG[k] = i; }
// the door picture's own geometry (door-frame.png px): the glass opening and the light
const DOOR = { w: 666, h: 439, ox0: 49, ox1: 617, oy0: 61, oy1: 426, lx: 333, ly: 18 };

// ───────────────────────── Hani's strip ─────────────────────────
const haniEl = $('hani'), sayEl = $('say');
const poseSrc = {}; for (const p of ['calm', 'talk', 'surprised']) { const i = new Image(); i.src = poseSrc[p] = `assets/pose-${p}.png`; }
let haniPose = 'calm', faceT = 0, sayT = 0;
function setPose(n, hold = 0) { if (hold) faceT = hold; if (haniPose !== n) { haniPose = n; haniEl.src = poseSrc[n]; } }
function say(text, dur = 3) { sayEl.textContent = text; sayEl.classList.add('on'); sayT = dur; if (faceT <= 0) setPose('talk'); }
const fxEl = $('fx');
function banner(text, small, red) {
  const b = document.createElement('div'); b.className = 'nin' + (red ? ' red' : ''); b.innerHTML = text + (small ? `<small>${small}</small>` : '');
  fxEl.appendChild(b); setTimeout(() => b.remove(), 2200);
}
function sparks(x, y, n = 16, color) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.left = x + 'px'; s.style.top = y + 'px'; if (color) s.style.background = color; fxEl.appendChild(s);
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 90;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: 450 + Math.random() * 400, easing: 'ease-out' }).onfinish = () => s.remove();
  }
}

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, loops: {} };
const OWN = ['door-open-1', 'door-open-2', 'door-open-3', 'door-close-1', 'door-close-2', 'bump', 'oops-1', 'oops-2', 'step-loop', 'fast-loop', 'ambience', 'win-1', 'win-2', 'roll', 'blink'];
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const HS = ['niggun-freilach'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n].slice(0);
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; }).catch(() => {});
}
function newCtx() {
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SND.ctx = null; return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  SND.buf = {}; SND.loops = {}; for (const n of SFX) decode(n);
}
// wake the sound on EVERY tap (iPhone stops it when the page goes away)
function audioUnlock() {
  if (!SND.ctx) { newCtx(); if (!SND.ctx) return; }
  if (SND.ctx.state !== 'running' && !paused) {
    SND.ctx.resume().catch(() => {});
    try { const b = SND.ctx.createBuffer(1, 1, 22050), s = SND.ctx.createBufferSource(); s.buffer = b; s.connect(SND.ctx.destination); s.start(); } catch (e) {}
    setTimeout(() => { if (SND.ctx && SND.ctx.state !== 'running' && !paused && !document.hidden) { try { SND.ctx.close(); } catch (e) {} newCtx(); } }, 400);
  }
}
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || (n.startsWith(name + '-') && /\d$/.test(n))).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = vars[Math.floor(Math.random() * vars.length)];
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = 0.96 + Math.random() * 0.08; gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
// a loop that runs while its cause lasts
function loop(name, on, vol = 1) {
  if (!SND.ctx) return;
  const L = SND.loops[name];
  if (on && !L && SND.buf[name]) {
    const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
    src.buffer = SND.buf[name]; src.loop = true; gn.gain.value = vol; src.connect(gn).connect(SND.master); src.start();
    SND.loops[name] = { src, gn };
  } else if (!on && L) { try { L.src.stop(); } catch (e) {} delete SND.loops[name]; }
}
function stopLoops() { for (const n of Object.keys(SND.loops)) loop(n, false); }
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
function drawSnd() { document.querySelectorAll('.sndBtn').forEach((b) => b.innerHTML = SND.on ? ICON_ON : ICON_OFF); }
document.querySelectorAll('.sndBtn').forEach((b) => b.addEventListener('click', () => {
  SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); audioUnlock();
  if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; drawSnd();
}));
drawSnd();
addEventListener('pointerdown', audioUnlock, { capture: true });
addEventListener('keydown', audioUnlock, { capture: true });

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), cx = cv.getContext('2d');
let W = 360, H = 640, DPR = 1, TOP = 52;
function layout() {
  const iw = innerWidth, ih = innerHeight;
  document.body.classList.toggle('turn', iw > ih * 1.15 && ih < 500);
  const strip = Math.round(clamp(ih * 0.1, 64, 88)); document.documentElement.style.setProperty('--strip', strip + 'px');
  const r = cv.getBoundingClientRect(); W = Math.max(200, r.width); H = Math.max(200, r.height);
  DPR = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const wb = Math.round(clamp(H * 0.16, 76, 112)); document.documentElement.style.setProperty('--wb', wb + 'px'); document.documentElement.style.setProperty('--fb', Math.round(wb * 0.7) + 'px');
  TOP = (window.VerseFrame && VerseFrame.top || 0) + 52;
  document.body.classList.toggle('small', iw < 350 || ih < 600);
}
addEventListener('resize', layout);
addEventListener('verseframe', layout);
// depth -> screen: feet line and scale
const yNear = () => H * 0.76;
// the door line: low enough that the door's light (above the frame) never hides under the HUD
const yDoor = () => { const w = Math.min(W * 0.7, (H - TOP) * 0.5), r = clamp(w * 0.075, 13, 26); return Math.max(TOP + (H - TOP) * 0.36, TOP + w * DOOR.h / DOOR.w + 2 * r + 26); };
const feetY = (z) => lerp(yNear(), yDoor(), z);
const scl = (z) => Math.max(0.05, 1 - 0.58 * z);
const doorW = () => Math.min(W * 0.7, (H - TOP) * 0.5);
let SMALL = false;

// ───────────────────────── game state ─────────────────────────
let state = 'menu', paused = false;
let si = 0, sc = null, z = 0, held = false, fastHeld = false, fastLeft = FAST_MAX, walkT = 0;
let doorT = 0, doorOpen = 0, cycleOpen = false, staffOpen = 0, staff = null, oops = 0, passed = false, fade = 0;
let clock = 0, mistakes = 0, rolls = 1, lastLine = 0, flash = 0, sensorOpen = 0, winT = 0;
const tutScene = { name: 'אורתופדית', bg: 'ward', open: 4.0, closed: 3.5, staff: false };
function enterScene(i, s) {
  si = i; sc = s || SCENES[i];
  z = 0; passed = false; fade = 1; oops = 0; fastLeft = FAST_MAX; staffOpen = 0; sensorOpen = 0;
  // the door starts somewhere in its closed time, so the first walk always meets a closed door
  doorT = sc.open + rnd(0, sc.closed * 0.35); cycleOpen = false; doorOpen = 0;
  staff = sc.staff ? { z: 1.9, t: rnd(2.5, 6), on: false, gone: false } : null;
  dots();
  $('whereTxt').textContent = sc.name;
  if (sc.line) say(sc.line, 3.6);
}
function cycle() { const p = sc.open + sc.closed; return ((doorT % p) + p) % p; }
// the door's own timer: open for [0, open), closed for [open, open+closed)
function timerOpen() { return cycle() < sc.open; }
function timeLeft() { const c = cycle(); return c < sc.open ? sc.open - c : sc.open + sc.closed - c; }
const doorIsOpen = () => cycleOpen || staffOpen > 0;
function step(dt) {
  if (!sc) return;
  fade = Math.max(0, fade - dt * 2.5);
  const sim = state === 'play' || (state === 'tut' && tutRunning());
  if (!sim) { draw(); return; }
  if (state === 'play') clock += dt;
  doorT += dt;
  const wasOpen = doorIsOpen();
  const nowTimer = timerOpen();
  if (nowTimer !== cycleOpen) cycleOpen = nowTimer;
  // a staff member walks through toward us; the door opens for him
  if (staff && !staff.gone) {
    staff.t -= dt;
    if (staff.t <= 0) {
      staff.on = true; staff.z -= dt * 0.28;
      if (staff.z < 1.3 && staff.z > 0.7) staffOpen = 0.9;
      if (staff.z < 1.25 && !staff.said && z < MAT0 + 0.15) { staff.said = true; say(pickR(LINES.staff), 2.6); }
      if (staff.z < -0.6) staff.gone = true;
    }
  }
  if (staffOpen > 0) staffOpen -= dt;
  if (sensorOpen > 0) sensorOpen -= dt;
  const isOpen = doorIsOpen();
  if (isOpen && !wasOpen) play('door-open', 0.55);
  if (!isOpen && wasOpen) play('door-close', 0.5);
  doorOpen = clamp(doorOpen + (isOpen || sensorOpen > 0 ? 1 : -1) * dt / SLIDE, 0, 1);
  // the light blinks before it closes
  if (cycleOpen && staffOpen <= 0 && timeLeft() < WARN) { const b = Math.floor(timeLeft() * 4); if (b !== step.lastB) { step.lastB = b; if (b % 2 === 0) play('blink', 0.25); } }
  // Hani walks
  if (oops > 0) { oops -= dt; if (oops <= 0) { z = 0; fade = 1; } }
  const fastOn = fastHeld && fastLeft > 0 && held !== null;
  const moving = oops <= 0 && !passed && (held || fastOn);
  if (moving) {
    const v = fastOn ? FAST : WALK; z += v * dt; walkT += dt * (fastOn ? 2.1 : 1.3);
    if (fastOn) { fastLeft = Math.max(0, fastLeft - dt); if (fastLeft === 0) say(pickR(LINES.fastEmpty), 2); }
  }
  loop('step-loop', moving && !fastOn, 0.5); loop('fast-loop', moving && fastOn, 0.5);
  // the rule: on the mat or in the doorway while the door is not open by itself = it opens because of you
  if (oops <= 0 && !passed && z >= MAT0 && z < PAST && !isOpen) {
    const inDoor = z > DOORZ - 0.06;
    caught(wasOpen ? 'held' : 'sensor', inDoor);
  }
  if (!passed && z >= PAST) { passed = true; doorPassed(); }
  if (passed) { z += dt * 0.35; if (z >= DONEZ) nextScene(); }
  // a little nudge while she stands and waits in front of a closed door
  if (!moving && !isOpen && z > 0.45 && z < MAT0 && clock - lastLine > 7 && sayT <= 0 && state === 'play') { lastLine = clock; say(pickR(LINES.wait), 2.2); }
  flash = Math.max(0, flash - dt * 2);
  draw();
}
function caught(kind, inDoor) {
  oops = 1.3; flash = 1; sensorOpen = 1.1; held = held && false; fastHeld = false;
  $('walkBtn').classList.remove('held'); $('fastBtn').classList.remove('held');
  play('oops', 0.7); if (inDoor) play('bump', 0.6);
  setPose('surprised', 1.6); say(pickR(LINES[kind]), 2.6);
  if (state === 'play') { mistakes++; clock += PENALTY; banner('חס וחלילה!', `+${PENALTY} שניות`, true); }
  else banner('חס וחלילה!', 'נסו שוב', true);
  if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {}
}
function doorPassed() {
  if (state === 'tut') { if (tutWait && tutWait.id === 'pass') tutWait.done = true; say('ברוך השם! ככה עוברים.', 2.4); return; }
  if (sc.roll) {
    rolls = 2; $('rollTxt').textContent = '2/2'; play('roll', 0.8); play('win', 0.6);
    banner('רב שמוליק!', 'לחמנייה שנייה – לחם משנה!'); setPose('surprised', 2.2);
    say('רב שמוליק! תודה! נהיה לנו לחם משנה – עכשיו חוזרים לאבא!', 3.4);
    const r = $('rolls').getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2, 18, '#ffe27a');
  } else if (si < SCENES.length - 1) { say(pickR(LINES.pass), 1.8); }
}
function nextScene() {
  if (state === 'tut') { z = 0; passed = false; fade = 1; doorT = sc.open + 0.5; return; }
  if (si + 1 >= SCENES.length) { win(); return; }
  enterScene(si + 1);
}
function win() {
  state = 'won'; winT = 0; stopLoops(); held = false; fastHeld = false;
  play('win', 0.9); setTimeout(() => play('win', 0.7), 700);
  banner('לחם משנה!', 'נס בתוך נס!'); setPose('surprised', 3); say('תראי איך הקדוש ברוך הוא מסדר את הדברים! נס בתוך נס!', 3.5);
  sparks(innerWidth / 2, innerHeight * 0.4, 30, '#ffe27a');
  setTimeout(gameOver, 2600);
}

// ───────────────────────── drawing ─────────────────────────
function cover(img, x, y, w, h) {
  if (!img.naturalWidth) { cx.fillStyle = '#2a3550'; cx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  cx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * 0.55, dw, dh);
}
function drawImgFeet(img, x, fy, h, alpha = 1) {
  if (!img || !img.naturalWidth) return;
  const w = img.naturalWidth * h / img.naturalHeight;
  cx.globalAlpha = alpha; cx.drawImage(img, x - w / 2, fy - h, w, h); cx.globalAlpha = 1;
}
function haniH() { return (H - TOP) * 0.36; }
function drawHani() {
  const fy = feetY(z), h = haniH() * scl(z);
  // her shadow
  cx.fillStyle = '#0005'; cx.beginPath(); cx.ellipse(W / 2, fy, h * 0.2, h * 0.04, 0, 0, Math.PI * 2); cx.fill();
  let img = IMG.stand;
  if (oops > 0) img = IMG.oops;
  else if ((held || (fastHeld && fastLeft > 0)) && !passed || passed) img = Math.floor(walkT * 3) % 2 ? IMG.walk1 : IMG.walk2;
  if (passed) walkT += 0.03;
  const bob = img === IMG.stand || img === IMG.oops ? 0 : Math.abs(Math.sin(walkT * 9.4)) * h * 0.012;
  const a = passed ? clamp(1 - (z - PAST) / (DONEZ - PAST), 0, 1) : 1;
  drawImgFeet(img, W / 2, fy - bob, h, a);
}
function drawStaff() {
  if (!staff || !staff.on || staff.gone) return;
  const fy = feetY(staff.z), h = haniH() * 1.05 * scl(staff.z), x = W / 2 + W * 0.2 * scl(staff.z) * (staff.z < 1 ? 1 : 0.7);
  const a = clamp((1.9 - staff.z) * 3, 0, 1) * clamp((staff.z + 0.6) * 2, 0, 1);
  cx.fillStyle = '#0004'; cx.beginPath(); cx.ellipse(x, fy, h * 0.2, h * 0.04, 0, 0, Math.PI * 2); cx.fill();
  drawImgFeet(IMG.staff, x, fy, h, a);
}
function doorRect() { const w = doorW(), h = w * DOOR.h / DOOR.w, by = feetY(DOORZ) + h * 0.015; return { x: W / 2 - w / 2, y: by - h, w, h, k: w / DOOR.w }; }
function drawMat() {
  const d = doorRect(), k = d.k, wOpen = (DOOR.ox1 - DOOR.ox0) * k;
  const y0 = feetY(MAT0), y1 = feetY(DOORZ - 0.01), w0 = wOpen * scl(MAT0) / scl(DOORZ), w1 = wOpen;
  const isOpen = doorIsOpen(), danger = !isOpen;
  cx.save();
  cx.beginPath(); cx.moveTo(W / 2 - w0 / 2, y0); cx.lineTo(W / 2 + w0 / 2, y0); cx.lineTo(W / 2 + w1 / 2, y1); cx.lineTo(W / 2 - w1 / 2, y1); cx.closePath();
  cx.fillStyle = danger ? 'rgba(229,72,77,.32)' : 'rgba(43,182,115,.28)'; cx.fill();
  cx.setLineDash([10, 7]); cx.lineWidth = 3; cx.strokeStyle = danger ? '#ffd23f' : '#9ff0c4'; cx.stroke();
  cx.restore();
  // its label on the floor, on both sides of where Hani walks (RTL: the right half is read first)
  cx.save(); cx.font = `900 ${Math.round(clamp(W * 0.036, 11, 17))}px Rubik, sans-serif`; cx.textBaseline = 'middle';
  cx.fillStyle = danger ? '#ffe27a' : '#c9ffe0'; cx.shadowColor = '#000'; cx.shadowBlur = 5;
  const ly = (y0 + y1) / 2 + 2, gap = haniH() * scl(MAT0) * 0.2 + 6;
  cx.textAlign = 'left'; cx.fillText(danger ? 'חיישן' : 'פתוח', W / 2 + gap, ly);
  cx.textAlign = 'right'; cx.fillText(danger ? 'לא דורכים!' : 'עוברים!', W / 2 - gap, ly);
  cx.restore();
}
function drawDoor() {
  const d = doorRect(), k = d.k;
  const ox0 = d.x + DOOR.ox0 * k, ox1 = d.x + DOOR.ox1 * k, oy0 = d.y + DOOR.oy0 * k, oy1 = d.y + DOOR.oy1 * k, half = (ox1 - ox0) / 2;
  const e = doorOpen < 0.5 ? 2 * doorOpen * doorOpen : 1 - Math.pow(-2 * doorOpen + 2, 2) / 2, slide = e * half * 0.96;
  cx.save(); cx.beginPath(); cx.rect(ox0, oy0, ox1 - ox0, oy1 - oy0); cx.clip();
  if (IMG.left.naturalWidth) { cx.drawImage(IMG.left, ox0 - slide, oy0, half, oy1 - oy0); cx.drawImage(IMG.right, ox0 + half + slide, oy0, half, oy1 - oy0); }
  cx.restore();
  if (IMG.frame.naturalWidth) cx.drawImage(IMG.frame, d.x, d.y, d.w, d.h);
  // the status light, big enough to read, with the time left as a ring
  const open = doorIsOpen(), lx = d.x + DOOR.lx * k, r = clamp(d.w * 0.075, 13, 26), ly = d.y - r - 6;
  const warn = open && staffOpen <= 0 && timeLeft() < WARN, blinkOff = warn && Math.floor(timeLeft() * 4) % 2 === 1;
  const col = !open ? '#ff4d4f' : warn ? '#ffc23d' : '#3ee08a';
  cx.save();
  cx.fillStyle = '#0e1a33d9'; cx.beginPath(); cx.arc(lx, ly, r + 7, 0, Math.PI * 2); cx.fill();
  cx.lineWidth = 5; cx.strokeStyle = '#ffffff30'; cx.beginPath(); cx.arc(lx, ly, r + 3, 0, Math.PI * 2); cx.stroke();
  const frac = staffOpen > 0 ? 1 : timeLeft() / (cycleOpen ? sc.open : sc.closed);
  cx.strokeStyle = col; cx.beginPath(); cx.arc(lx, ly, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); cx.stroke();
  cx.fillStyle = blinkOff ? '#5a4a1c' : col; cx.shadowColor = col; cx.shadowBlur = blinkOff ? 0 : 16;
  cx.beginPath(); cx.arc(lx, ly, r - 2, 0, Math.PI * 2); cx.fill();
  cx.shadowBlur = 0; cx.fillStyle = '#fff'; cx.font = `900 ${Math.round(r * 0.95)}px Rubik, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  if (staffOpen <= 0) cx.fillText(Math.ceil(timeLeft()), lx, ly + 1);
  cx.restore();
}
function draw() {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.clearRect(0, 0, W, H);
  if (!sc) return;
  cover(IMG['bg' + sc.bg], 0, 0, W, H);
  // night tint behind the door line so the door stands out
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,18,40,.45)'); g.addColorStop(0.3, 'rgba(10,18,40,.08)'); g.addColorStop(1, 'rgba(10,18,40,.1)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  drawMat();
  // draw far to near: whatever is past the door is behind its glass
  if (staff && staff.on && staff.z >= DOORZ) drawStaff();
  if (z >= DOORZ) drawHani();
  drawDoor();
  if (staff && staff.on && staff.z < DOORZ && staff.z > z) drawStaff();
  if (z < DOORZ) drawHani();
  if (staff && staff.on && staff.z < DOORZ && staff.z <= z) drawStaff();
  if (flash > 0) { cx.fillStyle = `rgba(229,72,77,${flash * 0.35})`; cx.fillRect(0, 0, W, H); }
  if (fade > 0) { cx.fillStyle = `rgba(14,26,51,${fade})`; cx.fillRect(0, 0, W, H); }
  const fa = $('fastArc'); if (fa) fa.style.strokeDashoffset = String(289 * (1 - fastLeft / FAST_MAX));
  $('fastBtn').classList.toggle('empty', fastLeft <= 0);
  $('clock').textContent = fmtT(clock);
}

// ───────────────────────── controls ─────────────────────────
function holdBtn(el, set) {
  const on = (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} set(true); el.classList.add('held'); };
  const off = () => { set(false); el.classList.remove('held'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
holdBtn($('walkBtn'), (v) => { if (oops > 0 && v) return; held = v; if (v && state === 'tut' && tutWait && tutWait.id === 'walk') tutWait.pressed = true; });
holdBtn($('fastBtn'), (v) => {
  if (oops > 0 && v) return;
  if (v && fastLeft <= 0) { say(pickR(LINES.fastEmpty), 2); return; }
  fastHeld = v; if (v && fastLeft > 0) { if (state === 'tut' && tutWait && tutWait.id === 'fast') tutWait.done = true; if (sayT <= 0.5) say(pickR(LINES.fast), 2.2); }
});
const KEYS = { walk: new Set([' ', 'ArrowUp', 'w', 'W']), fast: new Set(['Shift', 'ArrowRight', 'ArrowLeft']) };
addEventListener('keydown', (e) => {
  const live = state === 'play' || (state === 'tut' && tutRunning());
  if (live && !paused && !e.repeat) {
    if (KEYS.walk.has(e.key) && oops <= 0) { e.preventDefault(); held = true; $('walkBtn').classList.add('held'); if (state === 'tut' && tutWait && tutWait.id === 'walk') tutWait.pressed = true; return; }
    if (KEYS.fast.has(e.key) && oops <= 0 && fastLeft > 0) { fastHeld = true; $('fastBtn').classList.add('held'); if (state === 'tut' && tutWait && tutWait.id === 'fast') tutWait.done = true; return; }
  }
  if (live && KEYS.walk.has(e.key)) { e.preventDefault(); return; }
  if (tut.on) return;
  if (e.key === 'Escape' && state === 'play') pause(!paused);
  if ((e.key === ' ' || e.key === 'Enter') && paused) { e.preventDefault(); pause(false); return; }
  if ((e.key === ' ' || e.key === 'Enter') && state === 'menu' && $('start').classList.contains('on')) { e.preventDefault(); $('playBtn').click(); }
  else if ((e.key === ' ' || e.key === 'Enter') && state === 'over') { e.preventDefault(); startGame(); }
});
addEventListener('keyup', (e) => {
  if (KEYS.walk.has(e.key)) { held = false; $('walkBtn').classList.remove('held'); }
  if (KEYS.fast.has(e.key)) { fastHeld = false; $('fastBtn').classList.remove('held'); }
});

// ───────────────────────── HUD / screens ─────────────────────────
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function dots() {
  const d = $('dots'); if (state === 'tut') { d.innerHTML = ''; return; }
  d.innerHTML = SCENES.map((_, k) => `<i class="${k < si ? 'on' : k === si ? 'now' : ''}"></i>`).join('');
}
const best = () => +store.get(KEY.best) || 0;   // seconds, lower is better; the hub reads it as a plain number
const dayBest = () => { const [d, v] = (store.get(KEY.day) || '').split('|'); return d === today() ? +v || 0 : 0; };
function showBest() {
  const b = best(), d = dayBest();
  $('bestStart').innerHTML = b ? `השיא שלך: <b>${fmtT(b)}</b>${d ? ` · השיא של היום: <b>${fmtT(d)}</b>` : ''}` : '';
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function playing(on) { for (const id of ['hud', 'strip', 'stage', 'ctl']) $(id).classList.toggle('on', on); if (on) layout(); }
function resetRun() {
  R = seeded(`${SLUG}|${today()}`);
  clock = 0; mistakes = 0; rolls = 1; held = false; fastHeld = false; lastLine = 0; $('rollTxt').textContent = '1/2';
}
function startGame() {
  tut.end(true);
  resetRun(); state = 'play'; show(null); playing(true); enterScene(0);
  window.track && track('game_start', SLUG);
  loop('ambience', true, 0.5);
}
function gameOver() {
  state = 'over'; stopLoops(); fxEl.innerHTML = '';
  const time = Math.round(clock);
  window.track && track('game_over', SLUG); window.VerseFrame && VerseFrame.score(Math.max(1, time));
  const prev = best(), rec = !prev || time < prev, dPrev = dayBest(), dRec = !dPrev || time < dPrev;
  if (rec) store.set(KEY.best, time);
  if (dRec) store.set(KEY.day, today() + '|' + time);
  playing(false);
  $('overScore').textContent = fmtT(time);
  $('overLine').textContent = '״' + pickR(LINES.over) + '״';
  $('overRec').innerHTML = rec ? '<span class="newrec">שיא חדש!</span>' : dRec ? '<span class="newrec">שיא של היום!</span>' : '';
  $('bestOver').innerHTML = `${mistakes ? `חס וחלילה: <b>${mistakes}</b> (+${mistakes * PENALTY} שנ׳)<br>` : 'בלי אף חיישן – כל הכבוד!<br>'}השיא שלך: <b>${fmtT(rec ? time : prev)}</b> · השיא של היום: <b>${fmtT(dRec ? time : dPrev)}</b>`;
  show('over');
  if (SND.buf['niggun-freilach']) loop('niggun-freilach', true, 0.22);
}
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  if (on === paused) return;
  paused = on; held = false; fastHeld = false; $('walkBtn').classList.remove('held'); $('fastBtn').classList.remove('held');
  if (on) { show('paused'); SND.ctx && SND.ctx.suspend(); }
  else { show(null); SND.ctx && SND.ctx.resume(); }
}
function toMenu() { paused = false; SND.ctx && SND.ctx.resume(); stopLoops(); state = 'menu'; playing(false); tut.end(true); showBest(); show('start'); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); hush(); } });
function hush() { held = false; fastHeld = false; try { SND.ctx && SND.ctx.suspend(); } catch (e) {} }
addEventListener('pagehide', hush);
addEventListener('blur', () => { held = false; fastHeld = false; });
document.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', hush));
addEventListener('pageshow', (e) => { if (e.persisted && (state === 'play' || state === 'tut')) pause(true); });
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => pause(false);
$('restartBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); stopLoops(); startGame(); };
$('quitBtn').onclick = toMenu;
$('playBtn').onclick = () => { loop('niggun-freilach', false); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { loop('niggun-freilach', false); tut.begin(); };
$('againBtn').onclick = () => { loop('niggun-freilach', false); startGame(); };

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const elSpot = (sel) => () => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 }; };
const cvSpot = (f) => () => { const r = cv.getBoundingClientRect(), s = f(); return s && { x: r.left + s.x, y: r.top + s.y, w: s.w, h: s.h }; };
const lightSpot = cvSpot(() => { const d = doorRect(), r = clamp(d.w * 0.075, 13, 26), lx = d.x + DOOR.lx * d.k, ly = d.y - r - 6; return { x: lx - r - 14, y: ly - r - 14, w: 2 * r + 28, h: 2 * r + 28 }; });
const doorSpot = cvSpot(() => { const d = doorRect(); return { x: d.x - 8, y: d.y - 60, w: d.w + 16, h: d.h + 70 }; });
const matSpot = cvSpot(() => { const d = doorRect(), y0 = feetY(MAT0), y1 = feetY(DOORZ); return { x: d.x - 6, y: y1 - 10, w: d.w + 12, h: y0 - y1 + 20 }; });
const STEPS = [
  { text: 'זאת <b>חני</b>. שבת בבית החולים, אבא מאושפז – ויש <b>רק לחמנייה אחת</b>. אין לחם משנה!', spot: elSpot('#rolls') },
  { text: '<b>המטרה:</b> להגיע לרב שמוליק בבניין השני, לקבל לחמנייה – ולחזור לאבא. 7 דלתות, כמה שיותר מהר.', spot: elSpot('#where') },
  { text: 'זאת <b>דלת שבת</b>: היא נפתחת ונסגרת <b>לבד</b>, לפי שעון.', spot: doorSpot },
  { text: 'הנורה: <b style="color:#1e9a5a">ירוק = פתוח</b>, <b style="color:#d23">אדום = סגור</b>, <b style="color:#c80">צהוב מהבהב = עוד רגע נסגרת</b>. המספר – כמה שניות נשארו.', spot: lightSpot },
  { text: 'זה <b>החיישן</b>. דורכים עליו כשהדלת סגורה – היא נפתחת <b>בגללכם</b>. חס וחלילה! <b>+5 שניות</b> וחוזרים אחורה.', spot: matSpot },
  { text: '<b>החזיקו "הולכים"</b> כדי ללכת – ועזבו כדי לעצור. נסו: לכו קצת ועצרו <b>לפני</b> החיישן. <span class="keyhint">(במחשב: רווח)</span>', try: 'walk', spot: elSpot('#walkBtn') },
  { text: '<b>"בשינוי"</b> – הליכה מהירה, לצורך ביקור חולים. יש מעט לכל דלת (הטבעת הצהובה). <b>החזיקו אותו רגע.</b> <span class="keyhint">(Shift)</span>', try: 'fast', spot: elSpot('#fastBtn') },
  { text: 'עכשיו: <b>חכו שהנורה תהיה ירוקה – ועברו בדלת!</b>', try: 'pass' },
  { text: 'לפעמים מישהו מהצוות עובר ופותח את הדלת – אפשר לעבור אחריו. <b>בהצלחה!</b>', last: true },
];
function tutRunning() { return tut.on && tutWait && !tutWait.done; }
const tut = {
  on: false, i: 0,
  step() { return STEPS[this.i] || {}; },
  begin() {
    resetRun(); state = 'tut'; this.on = true; this.i = 0;
    show(null); playing(true); enterScene(0, tutScene); $('whereTxt').textContent = 'איך משחקים'; dots();
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = this.step();
    tutWait = null;
    if (s.try === 'walk') tutWait = { id: 'walk', done: false };
    if (s.try === 'fast') tutWait = { id: 'fast', done: false };
    if (s.try === 'pass') { tutWait = { id: 'pass', done: false }; fastLeft = FAST_MAX; z = Math.min(z, 0.55); if (z >= MAT0) z = 0.5; }
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(Enter)</span>';
  },
  next() {
    const s = this.step();
    if (tutWait && !tutWait.done) return;
    if (s.last) { this.end(); return; }
    this.i++; this.enter();
  },
  end(silent) {
    if (!this.on) return;
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); held = false; fastHeld = false;
    if (!silent) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = this.step();
    // "walk" is done once she walked a bit and stopped, before the mat
    if (tutWait && tutWait.id === 'walk' && !tutWait.done && tutWait.pressed && !held && z > 0.12 && oops <= 0) tutWait.done = true;
    if (tutWait && tutWait.id === 'fast' && tutWait.done && fastHeld) {}
    const sp = s.spot ? s.spot() : null;
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    const low = sp ? sp.y + sp.h / 2 > innerHeight * 0.5 : true, slim = !!(tutWait && !tutWait.done);
    tutCard.classList.toggle('slim', slim);
    tutCard.style.top = slim ? `calc(var(--safe-t) + 4px)` : low ? `calc(var(--safe-t) + 54px)` : 'auto';
    tutCard.style.bottom = (low || slim) ? 'auto' : `calc(var(--safe-b) + var(--strip) + 10px)`;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; held = false; fastHeld = false; $('walkBtn').classList.remove('held'); $('fastBtn').classList.remove('held'); $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => tut.end();
addEventListener('keydown', (e) => {
  if (!tut.on || paused) return;
  if (e.key === 'Enter' || (e.key === ' ' && !tutRunning())) { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (!paused) {
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('on'); }
    if (faceT > 0) faceT -= dt; else if (sayT <= 0 && haniPose !== 'calm') setPose('calm');
    if (state === 'play' || state === 'tut' || state === 'won') step(state === 'won' ? 0 : dt);
    tut.frame();
  }
  requestAnimationFrame(frame);
}
layout(); showBest(); requestAnimationFrame(frame);

// for the tests: read the game, and fast-forward it
window.SHABBAT_DOOR = {
  get state() { return state; }, get z() { return z; }, get si() { return si; }, get clock() { return clock; }, get mistakes() { return mistakes; },
  get open() { return doorIsOpen(); }, get timeLeft() { return timeLeft(); }, get oops() { return oops; }, get rolls() { return rolls; }, get fastLeft() { return fastLeft; },
  get matZ() { return MAT0; }, get pastZ() { return PAST; }, get scene() { return sc; },
  hold(v) { held = v; }, fast(v) { fastHeld = v; }, tick(dt) { step(dt); }, tut, startGame,
};
