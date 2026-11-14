// דלת של שבת – Red Light, Green Light (the Squid-Game kind) in the hospital, at the Shabbat doors.
// Friday night: one roll, no lechem mishneh. Hani walks to Reb Shmulik in the other building and back, before the meal.
// GREEN: the Shabbat door is open - walk (hold "הולכים"). RED: the door's sensor is watching the corridor - FREEZE.
// Moving on red = "חס וחלילה!" and back to the start of the corridor. Every door shows when its colour changes.
// The other visitors play too, and sometimes one of them is caught. No hurrying - no פסיעה גסה.
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
// a seeded generator: the same lights for everyone each day
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
let R = Math.random; const rnd = (a, b) => a + R() * (b - a);
const pickR = (a) => a[Math.floor(Math.random() * a.length)];

// ───────────────────────── the route ─────────────────────────
// g / r = the range of a green / red phase in seconds (each phase picks its own length); people = other visitors
const SCENES = [
  { name: 'אורתופדית', bg: 'ward', g: [3.2, 4.2], r: [2.2, 3.2], people: 1, line: 'שבת שלום! רק לחמנייה אחת... אין לחם משנה! הולכים לרב שמוליק.' },
  { name: 'יוצאים מהבניין', bg: 'er', g: [2.6, 3.8], r: [2.2, 3.4], people: 2, line: 'ירוק – הולכים. אדום – עומדים כמו פסל!' },
  { name: 'המעבר לבניין השני', bg: 'out', g: [2.4, 3.4], r: [2.2, 3.6], people: 2, line: 'אברהם משה בירר עם הרב – העירוב כולל את המעבר. הכול מסודר!' },
  { name: 'פנימית – רב שמוליק', bg: 'er', g: [2.0, 3.2], r: [2.4, 3.6], people: 3, line: 'פנימית! רב שמוליק כבר מחכה עם הלחמנייה.', roll: true },
  { name: 'חוזרים – המעבר', bg: 'out', g: [1.8, 3.0], r: [2.2, 3.6], people: 2, line: 'עכשיו חוזרים לאבא – בלי פסיעה גסה!' },
  { name: 'יוצאים מפנימית', bg: 'er', g: [1.6, 2.8], r: [2.4, 3.8], people: 3, line: 'עוד דלת ועוד דלת... ישועת השם כהרף עין!' },
  { name: 'אורתופדית – אבא מחכה', bg: 'ward', g: [1.4, 2.6], r: [2.2, 3.8], people: 3, line: 'אבא מחכה להמוציא! עוד דלת אחת!' },
];
const LIMIT = 150;                                   // seconds until the meal - the whole route
const DOORZ = 1.0, PAST = 1.06, DONEZ = 1.22;        // depth: 0 = near, 1 = the door's line
const WALK = 0.2;                                    // depth per second (one pace - no hurrying)
const SLIDE = 0.5, WARN = 1.0, GRACE = 0.28;         // glass slide; yellow before red; a moment to stop after red

// ───────────────────────── Hani's lines ─────────────────────────
const LINES = {
  caught: ['חס וחלילה! זזתי באדום!', 'השם ירחם! החיישן ראה אותי!', 'אוי, אברהם משה יגיד שזה פסיק רישא!', 'חס ושלום! באדום עומדים כמו פסל!'],
  npc: ['אוי, הוא זז באדום! חס וחלילה!', 'השם ירחם, חוזר להתחלה...', 'נו, רב יענקל, באדום עומדים!', 'אוי, הבקבוק של המיץ ענבים זז!'],
  green: ['ירוק! הולכים – לאט, בלי פסיעה גסה.', 'ירוק! קדימה, לצורך ביקור חולים.', 'נפתח! הולכים.'],
  red: ['אדום! עומדים!', 'קופאים! לא זזים!', 'אדום – פסל!'],
  pass: ['ברוך השם!', 'יופי, עוד דלת!', 'תראי איך הקדוש ברוך הוא מסדר!', 'עברנו! בעזרת השם!'],
  late: ['מהר – עוד מעט המוציא!', 'השעה רצה, אבא מחכה!'],
  over: ['תראי איך הקדוש ברוך הוא מסדר את הדברים!', 'בשורות טובות, ישועות ונחמות!', 'ישועת השם כהרף עין!', 'ניסי ניסים! עוד פעם?'],
  fail: ['אוי, התחילו את הסעודה בלי לחם משנה...', 'נו, בפעם הבאה בעזרת השם!', 'גם זו לטובה. עוד פעם?'],
};

// ───────────────────────── pictures ─────────────────────────
const IMG = {};
const PICS = { bgward: 'bg-ward.jpg', bger: 'bg-er.jpg', bgout: 'bg-out.jpg', frame: 'door-frame.png', left: 'door-left.png', right: 'door-right.png', walk1: 'hani-walk1.png', walk2: 'hani-walk2.png', stand: 'hani-stand.png', oops: 'hani-oops.png', joy: 'hani-joy.png', v1: 'visitor-1.png', v2: 'visitor-2.png', v3: 'visitor-3.png', roll: 'roll.png' };
for (const [k, f] of Object.entries(PICS)) { const i = new Image(); i.src = 'assets/' + f; IMG[k] = i; }
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
const OWN = ['music', 'door-open-1', 'door-open-2', 'door-open-3', 'door-close-1', 'door-close-2', 'bump', 'oops-1', 'oops-2', 'step-loop', 'ambience', 'win-1', 'win-2', 'roll', 'blink', 'green-1', 'green-2', 'red-1', 'red-2', 'scan', 'caught-npc'];
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const HS = ['niggun-freilach'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  SND.ctx.decodeAudioData(SND.raw[n].slice(0)).then((x) => { SND.buf[n] = x; if (n === 'music' && state === 'play') loop('music', true, 0.3); }).catch(() => {});
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
  const vars = SFX.filter((n) => n === name || (n.startsWith(name + '-') && /-\d$/.test(n))).filter((n) => SND.buf[n]);
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
// background music: full on green, softer on red (the tension), off between rounds
function musicLevel() { const L = SND.loops.music; if (L) L.gn.gain.setTargetAtTime(green && introT <= 0 ? 0.42 : 0.24, SND.ctx.currentTime, 0.25); }
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
  const wb = Math.round(clamp(H * 0.17, 80, 120)); document.documentElement.style.setProperty('--wb', wb + 'px');
  TOP = (window.VerseFrame && VerseFrame.top || 0) + 52;
  document.body.classList.toggle('small', iw < 350 || ih < 600);
}
addEventListener('resize', layout);
addEventListener('verseframe', layout);
const doorW = () => Math.min(W * 0.7, (H - TOP) * 0.5);
const timerR = () => clamp(doorW() * 0.085, 15, 28);
const yNear = () => H * 0.76;
// the door line: low enough that the door's timer (above the frame) never hides under the HUD
const yDoor = () => { const w = doorW(); return Math.max(TOP + (H - TOP) * 0.38, TOP + w * DOOR.h / DOOR.w + 2 * timerR() + 30); };
const feetY = (z) => lerp(yNear(), yDoor(), z);
const scl = (z) => Math.max(0.05, 1 - 0.58 * z);

// ───────────────────────── game state ─────────────────────────
let state = 'menu', paused = false;
let si = 0, sc = null, z = 0, held = false, walkT = 0, moving = false;
let green = true, phaseT = 0, phaseLen = 3, redFor = 0, doorOpen = 1, oops = 0, passed = false, fade = 0;
let clock = 0, mistakes = 0, rolls = 1, lastLine = 0, flash = 0, winT = 0, people = [], callT = 0, lateSaid = false, failed = false;
let tutReds = 0, introT = 0, lastPassed = 0;
const INTRO = 3.4;   // seconds of the card between corridors; the door's timer counts it down to green
const tutScene = { name: 'איך משחקים', bg: 'ward', g: [3.2, 3.6], r: [2.6, 3.0], people: 1 };
function newPhase(toGreen) {
  green = toGreen; phaseT = 0; phaseLen = toGreen ? rnd(sc.g[0], sc.g[1]) : rnd(sc.r[0], sc.r[1]); callT = 1;
  if (toGreen) { play('green', 0.55); play('door-open', 0.4); }
  else { play('red', 0.6); play('door-close', 0.35); redFor = 0; }
}
function enterScene(i, s) {
  si = i; sc = s || SCENES[i];
  z = 0; passed = false; fade = 1; oops = 0; walkT = 0;
  // a fresh press is needed in every corridor (never carry a held button into a red light)
  setHeld(false);
  green = false; phaseT = 0; redFor = 0; doorOpen = 0;
  if (state === 'tut') { phaseLen = rnd(1.6, 2.4); introT = 0; }
  else { introT = phaseLen = INTRO; showCard(i); }
  const kinds = ['v1', 'v2', 'v3'].sort(() => R() - 0.5);
  people = [];
  for (let k = 0; k < sc.people; k++) people.push({ img: kinds[k % 3], lane: k % 2 ? 1 : -1, side: 0.34 + 0.06 * (k >> 1), z: rnd(0.04, 0.4), speed: rnd(0.12, 0.18), react: 0, stopIn: 0, out: 0, back: 0, done: false, walkT: rnd(0, 3) });
  dots();
  $('whereTxt').textContent = sc.name;
  if (sc.line) say(sc.line, 3.6);
}
// the card between corridors: what you just passed, where you are now, and 3-2-1 to green
function showCard(i) {
  const c = $('lvl');
  $('lvlDone').innerHTML = i === 0 ? 'שבת בבית החולים – הולכים לרב שמוליק!' : `✓ עברתם את דלת ${i}!` + (SCENES[i - 1].roll ? ' <b>רב שמוליק נתן לחמנייה – 2/2!</b>' : '');
  $('lvlNum').textContent = `דלת ${i + 1} מתוך ${SCENES.length}`;
  $('lvlName').textContent = SCENES[i].name;
  $('lvlGoalTxt').innerHTML = GOALS(i); $('lvlRoll2').classList.toggle('empty', rolls < 2);
  $('lvlCount').textContent = 'מוכנים...';
  c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
}
// the two rolls of lechem mishneh: one from the start, the second from Reb Shmulik
function setRolls() { $('roll2').classList.toggle('empty', rolls < 2); $('rolls').classList.toggle('got', rolls >= 2); }
const GOALS = (i) => i === 0 ? 'יש רק לחמנייה <b>אחת</b> – וצריך <b>לחם משנה</b>! הולכים לרב שמוליק בפנימית.'
  : i <= 3 ? 'יעד: <b>רב שמוליק בפנימית</b> – עוד לחמנייה ללחם משנה.'
  : i === 4 ? 'יש <b>לחם משנה</b>! עכשיו חוזרים לאבא באורתופדית.'
  : 'יעד: <b>אבא באורתופדית</b> – לפני המוציא!';
function hideCard() { $('lvl').classList.remove('on'); }
const timeLeft = () => Math.max(0, phaseLen - phaseT);
const doorIsOpen = () => green;
function step(dt) {
  if (!sc) return;
  fade = Math.max(0, fade - dt * 2.5);
  callT = Math.max(0, callT - dt * 1.2);
  const sim = state === 'play' || (state === 'tut' && tutRunning());
  if (!sim) { draw(); return; }
  if (introT > 0) {   // the card: everything waits, the door's timer counts down to green
    introT -= dt; phaseT += dt;
    const n = Math.ceil(introT); $('lvlCount').textContent = introT > 1.8 ? 'מוכנים...' : n > 0 ? String(n) : '';
    if (introT <= 0) { hideCard(); newPhase(true); say('ירוק! החזיקו "הולכים"!', 1.8); }
    draw(); return;
  }
  if (state === 'play') {
    clock += dt;
    if (!lateSaid && LIMIT - clock < 25) { lateSaid = true; say(pickR(LINES.late), 2.4); }
    if (clock >= LIMIT) { fail(); return; }
  }
  // the light's own timer
  phaseT += dt;
  if (green && phaseT > phaseLen - WARN) { const b = Math.floor((phaseLen - phaseT) * 4); if (b !== step.lastB) { step.lastB = b; if (b % 2 === 0) play('blink', 0.22); } }
  if (phaseT >= phaseLen) {
    newPhase(!green);
    if (state === 'tut' && green && tutWait && tutWait.id === 'freeze' && tutWait.redClean) tutWait.done = true;
    if (state === 'tut' && !green && tutWait && tutWait.id === 'freeze') tutWait.redClean = true;
    if (state === 'play' && sayT <= 0 && Math.random() < 0.35) say(pickR(green ? LINES.green : LINES.red), 1.6);
  }
  if (!green) redFor += dt;
  loop('scan', !green, 0.35);
  musicLevel();
  // the glass stays open while someone stands in the doorway
  const inDoorway = (q) => q > DOORZ - 0.08 && q < PAST + 0.02;
  const keepOpen = inDoorway(z) || people.some((p) => !p.done && inDoorway(p.z));
  doorOpen = clamp(doorOpen + (green || keepOpen ? 1 : -1) * dt / SLIDE, 0, 1);
  // Hani
  if (oops > 0) { oops -= dt; if (oops <= 0) { z = 0; fade = 1; } }
  moving = oops <= 0 && !passed && held;
  if (moving) { z += WALK * dt; walkT += dt * 1.3; }
  loop('step-loop', moving, 0.45);
  // the rule: moving while the sensor watches (after a moment to stop)
  if (moving && !green && redFor > GRACE) caught();
  if (!passed && z >= PAST) { passed = true; doorPassed(); }
  if (passed) { z += dt * 0.35; walkT += dt * 1.3; if (z >= DONEZ) nextScene(); }
  stepPeople(dt);
  flash = Math.max(0, flash - dt * 2);
  draw();
}
// the other visitors play the same game - and now and then one of them is caught
function stepPeople(dt) {
  for (const p of people) {
    if (p.done) continue;
    if (p.out > 0) { p.out -= dt; if (p.out <= 0) { p.z = rnd(0, 0.15); p.back = 1; } continue; }
    p.back = Math.max(0, p.back - dt * 2);
    if (green) { p.stopIn = 0; p.react = p.react > 0 ? p.react - dt : 0; }
    let go = green && p.react <= 0;
    if (!green) {
      if (!p.stopIn) { p.stopIn = R() < 0.14 ? 0.65 : rnd(0.05, 0.2); p.react = rnd(0.1, 0.45); }
      p.stopIn -= dt; go = p.stopIn > 0;
      if (go && redFor > GRACE + 0.15 && p.z > 0.05) {   // caught
        p.out = 1.1; play('caught-npc', 0.5); if (sayT <= 0.4 || state === 'tut') say(pickR(LINES.npc), 2); continue;
      }
    }
    if (go) { p.z += p.speed * dt; p.walkT += dt * 1.3; }
    if (p.z > DONEZ + 0.1) p.done = true;
  }
}
// a clear "passed" moment - green, never mistaken for the red "caught"
function passFx() { play('win', 0.45); const d = doorRect(), r = cv.getBoundingClientRect(); sparks(r.left + W / 2, r.top + d.y + d.h * 0.5, 18, '#7dffb5'); }
function caught() {
  oops = 1.3; flash = 1; held = false; $('walkBtn').classList.remove('held');
  play('oops', 0.7); setPose('surprised', 1.6); say(pickR(LINES.caught), 2.4);
  if (state === 'play') mistakes++;
  banner('חס וחלילה!', 'זזתם באדום – חוזרים להתחלה', true);
  if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {}
}
function doorPassed() {
  if (state === 'tut') { if (tutWait && tutWait.id === 'pass') tutWait.done = true; say('ברוך השם! ככה עוברים.', 2.4); return; }
  if (sc.roll) {
    rolls = 2; setRolls(); play('roll', 0.8); play('win', 0.6);
    setPose('surprised', 2.2);
    say('רב שמוליק! תודה! נהיה לנו לחם משנה – עכשיו חוזרים לאבא!', 3.4);
    const r = $('rolls').getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2, 18, '#ffe27a');
  } else if (si < SCENES.length - 1) { say(pickR(LINES.pass), 1.8); }
  if (si < SCENES.length - 1) passFx();
}
function nextScene() {
  if (state === 'tut') { z = 0; passed = false; fade = 1; return; }
  if (si + 1 >= SCENES.length) { win(); return; }
  enterScene(si + 1);
}
function win() {
  state = 'won'; stopLoops(); held = false;
  play('win', 0.9); setTimeout(() => play('win', 0.7), 700);
  banner('לחם משנה!', 'נס בתוך נס!'); setPose('surprised', 3); say('תראי איך הקדוש ברוך הוא מסדר את הדברים! נס בתוך נס!', 3.5);
  sparks(innerWidth / 2, innerHeight * 0.4, 30, '#ffe27a');
  setTimeout(gameOver, 2600);
}
function fail() {
  state = 'won'; failed = true; stopLoops(); held = false;
  play('red', 0.7); banner('המוציא!', 'הסעודה התחילה...', true); setPose('surprised', 2.5); say('אוי! התחילו את הסעודה... ואין לחם משנה!', 3);
  setTimeout(gameOver, 2400);
}

// ───────────────────────── drawing ─────────────────────────
function cover(img, x, y, w, h) {
  if (!img.naturalWidth) { cx.fillStyle = '#2a3550'; cx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  cx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * 0.55, dw, dh);
}
function drawImgFeet(img, x, fy, h, alpha = 1, shake = 0) {
  if (!img || !img.naturalWidth) return;
  const w = img.naturalWidth * h / img.naturalHeight;
  cx.globalAlpha = alpha; cx.drawImage(img, x - w / 2 + shake, fy - h, w, h); cx.globalAlpha = 1;
}
const haniH = () => (H - TOP) * 0.36;
const shadow = (x, fy, h) => { cx.fillStyle = '#0005'; cx.beginPath(); cx.ellipse(x, fy, h * 0.2, h * 0.04, 0, 0, Math.PI * 2); cx.fill(); };
function drawHani() {
  const fy = feetY(z), h = haniH() * scl(z);
  shadow(W / 2, fy, h);
  let img = IMG.stand;
  if (oops > 0) img = IMG.oops;
  else if (moving || passed) img = Math.floor(walkT * 3) % 2 ? IMG.walk1 : IMG.walk2;
  const bob = img === IMG.walk1 || img === IMG.walk2 ? Math.abs(Math.sin(walkT * 9.4)) * h * 0.012 : 0;
  const a = passed ? clamp(1 - (z - PAST) / (DONEZ - PAST), 0, 1) : 1;
  drawImgFeet(img, W / 2, fy - bob, h, a);
}
function drawPerson(p) {
  const s = scl(p.z), fy = feetY(p.z), h = haniH() * 1.02 * s, x = W / 2 + p.lane * W * p.side * s / scl(0) * (p.z < DOORZ ? 1 : 0.6);
  let a = clamp((DONEZ + 0.1 - p.z) * 6, 0, 1) * (1 - p.back);
  const shake = p.out > 0 ? Math.sin(p.out * 60) * 4 : 0;
  shadow(x, fy, h);
  const walking = green && p.react <= 0 && p.out <= 0;
  drawImgFeet(IMG[p.img], x, fy - (walking ? Math.abs(Math.sin(p.walkT * 9)) * h * 0.012 : 0), h, a, shake);
  if (p.out > 0) { cx.save(); cx.globalAlpha = Math.min(1, p.out * 1.5); cx.fillStyle = '#ff4d4f'; cx.font = `900 ${Math.round(h * 0.16)}px Rubik, sans-serif`; cx.textAlign = 'center'; cx.shadowColor = '#000'; cx.shadowBlur = 4; cx.fillText('חס וחלילה!', x, fy - h - 6); cx.restore(); }
}
function doorRect() { const w = doorW(), h = w * DOOR.h / DOOR.w, by = feetY(DOORZ) + h * 0.015; return { x: W / 2 - w / 2, y: by - h, w, h, k: w / DOOR.w }; }
// the sensor's red beam sweeping the corridor while the light is red
function drawScan(t) {
  if (green || introT > 0) return;
  const d = doorRect(), sx = d.x + DOOR.lx * d.k, sy = d.y + DOOR.ly * d.k;
  const sweep = Math.sin(t * 2.2) * W * 0.32, tx = W / 2 + sweep, ty = yNear() + 10, spread = W * 0.2;
  const in_ = clamp(redFor / 0.3, 0, 1);
  cx.save(); cx.globalAlpha = 0.28 * in_;
  const g = cx.createLinearGradient(sx, sy, tx, ty); g.addColorStop(0, '#ff3b3b'); g.addColorStop(1, 'rgba(255,59,59,0)');
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(tx - spread, ty); cx.lineTo(tx + spread, ty); cx.closePath(); cx.fill();
  cx.restore();
  // a soft red edge on the screen
  cx.save(); const v = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(255,40,40,0)'); v.addColorStop(1, `rgba(255,40,40,${0.28 * in_})`); cx.fillStyle = v; cx.fillRect(0, 0, W, H); cx.restore();
}
function drawDoor() {
  const d = doorRect(), k = d.k;
  const ox0 = d.x + DOOR.ox0 * k, ox1 = d.x + DOOR.ox1 * k, oy0 = d.y + DOOR.oy0 * k, oy1 = d.y + DOOR.oy1 * k, half = (ox1 - ox0) / 2;
  const e = doorOpen < 0.5 ? 2 * doorOpen * doorOpen : 1 - Math.pow(-2 * doorOpen + 2, 2) / 2, slide = e * half * 0.96;
  cx.save(); cx.beginPath(); cx.rect(ox0, oy0, ox1 - ox0, oy1 - oy0); cx.clip();
  if (IMG.left.naturalWidth) { cx.drawImage(IMG.left, ox0 - slide, oy0, half, oy1 - oy0); cx.drawImage(IMG.right, ox0 + half + slide, oy0, half, oy1 - oy0); }
  cx.restore();
  if (IMG.frame.naturalWidth) cx.drawImage(IMG.frame, d.x, d.y, d.w, d.h);
  // the little light on the motor box shows the same colour
  const col = !green ? '#ff4d4f' : timeLeft() < WARN ? '#ffc23d' : '#3ee08a';
  cx.save(); cx.fillStyle = col; cx.shadowColor = col; cx.shadowBlur = 10; cx.beginPath(); cx.arc(d.x + DOOR.lx * k, d.y + (DOOR.ly + 6) * k, 11 * k, 0, Math.PI * 2); cx.fill(); cx.restore();
}
// the door's timer: the colour now, and the seconds until it changes
function drawTimer() {
  const d = doorRect(), r = timerR(), cxp = d.x + DOOR.lx * d.k, cy = d.y - r - 8;
  const warn = green && timeLeft() < WARN, blinkOff = warn && Math.floor(timeLeft() * 4) % 2 === 1;
  const col = !green ? '#ff4d4f' : warn ? '#ffc23d' : '#3ee08a';
  const pw = r * 5.2, ph = r * 2 + 10, px = cxp - pw / 2, py = cy - ph / 2;
  cx.save();
  cx.fillStyle = '#0b1530e8'; cx.strokeStyle = col; cx.lineWidth = 3;
  rr(px, py, pw, ph, ph / 2); cx.fill(); cx.stroke();
  // the light (right side - read first in Hebrew) with its ring
  const lx = px + pw - r - 5;
  cx.lineWidth = 4; cx.strokeStyle = '#ffffff25'; cx.beginPath(); cx.arc(lx, cy, r - 1, 0, Math.PI * 2); cx.stroke();
  cx.strokeStyle = col; cx.beginPath(); cx.arc(lx, cy, r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (timeLeft() / phaseLen)); cx.stroke();
  cx.fillStyle = blinkOff ? '#4a3c14' : col; cx.shadowColor = col; cx.shadowBlur = blinkOff ? 0 : 14;
  cx.beginPath(); cx.arc(lx, cy, r - 6, 0, Math.PI * 2); cx.fill();
  // the seconds, as a clock
  cx.shadowBlur = 0; cx.fillStyle = '#fff'; cx.font = `900 ${Math.round(r * 1.25)}px Rubik, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(`0:0${Math.min(9, Math.ceil(timeLeft()))}`, px + (pw - 2 * r - 5) / 2 + 2, cy + 1);
  cx.restore();
  // a big call when the colour changes
  if (callT > 0 && introT <= 0) {
    cx.save(); cx.globalAlpha = Math.min(1, callT * 1.6); cx.font = `900 ${Math.round(clamp(W * 0.085, 24, 40))}px Rubik, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = green ? '#5cf0a0' : '#ff5a5c'; cx.shadowColor = '#000'; cx.shadowBlur = 8;
    cx.fillText(green ? 'ירוק – הולכים!' : 'אדום – קופאים!', W / 2, d.y + d.h * 0.45);
    cx.restore();
  }
}
function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function draw() {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.clearRect(0, 0, W, H);
  if (!sc) return;
  cover(IMG['bg' + sc.bg], 0, 0, W, H);
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,18,40,.45)'); g.addColorStop(0.3, 'rgba(10,18,40,.08)'); g.addColorStop(1, 'rgba(10,18,40,.1)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // far to near: whatever is past the door is behind its glass
  const items = people.filter((p) => !p.done).map((p) => ({ z: p.z, f: () => drawPerson(p) }));
  items.push({ z, f: drawHani });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) if (it.z >= DOORZ) it.f();
  drawDoor();
  drawScan(performance.now() / 1000);
  for (const it of items) if (it.z < DOORZ) it.f();
  drawTimer();
  if (flash > 0) { cx.fillStyle = `rgba(229,72,77,${flash * 0.35})`; cx.fillRect(0, 0, W, H); }
  if (fade > 0) { cx.fillStyle = `rgba(14,26,51,${fade})`; cx.fillRect(0, 0, W, H); }
  const left = Math.max(0, LIMIT - clock); $('clock').textContent = fmtT(state === 'tut' ? LIMIT : left); $('clock').classList.toggle('low', state === 'play' && left < 25);
  $('walkBtn').classList.toggle('red', !green);
}

// ───────────────────────── controls ─────────────────────────
function setHeld(v) {
  if (v && oops > 0) return;
  held = v; $('walkBtn').classList.toggle('held', v);
  if (v && state === 'tut' && tutWait && tutWait.id === 'walk') tutWait.pressed = true;
}
{
  const el = $('walkBtn');
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} setHeld(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => setHeld(false));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
const WALKKEYS = new Set([' ', 'ArrowUp', 'w', 'W']);
addEventListener('keydown', (e) => {
  const live = state === 'play' || (state === 'tut' && tutRunning());
  if (live && !paused && WALKKEYS.has(e.key)) { e.preventDefault(); if (!e.repeat) setHeld(true); return; }
  if (tut.on) return;
  if (e.key === 'Escape' && state === 'play') pause(!paused);
  if ((e.key === ' ' || e.key === 'Enter') && paused) { e.preventDefault(); pause(false); return; }
  if ((e.key === ' ' || e.key === 'Enter') && state === 'menu' && $('start').classList.contains('on')) { e.preventDefault(); $('playBtn').click(); }
  else if ((e.key === ' ' || e.key === 'Enter') && state === 'over') { e.preventDefault(); startGame(); }
});
addEventListener('keyup', (e) => { if (WALKKEYS.has(e.key)) setHeld(false); });

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
  clock = 0; mistakes = 0; rolls = 1; held = false; lastLine = 0; lateSaid = false; failed = false; setRolls();
}
function startGame() {
  tut.end(true);
  resetRun(); state = 'play'; show(null); playing(true); enterScene(0);
  window.track && track('game_start', SLUG);
  loop('ambience', true, 0.35); loop('music', true, 0.3);
}
function gameOver() {
  hideCard(); introT = 0;
  state = 'over'; stopLoops(); fxEl.innerHTML = '';
  window.track && track('game_over', SLUG);
  playing(false);
  if (failed) {
    $('overH').textContent = 'הסעודה התחילה...'; $('overHani').src = 'assets/hani-oops.png';
    $('overScore').textContent = `${si} / ${SCENES.length}`; $('overScore').dataset.kind = 'doors';
    $('overLine').textContent = '״' + pickR(LINES.fail) + '״'; $('overRec').innerHTML = '';
    $('bestOver').innerHTML = `עברתם <b>${si}</b> דלתות מתוך ${SCENES.length} עד המוציא.<br>${best() ? `השיא שלך: <b>${fmtT(best())}</b>` : 'נסו שוב – בלי לזוז באדום!'}`;
  } else {
    const time = Math.max(1, Math.round(clock));
    window.VerseFrame && VerseFrame.score(time);   // the verse's daily records (lower is better)
    const prev = best(), rec = !prev || time < prev, dPrev = dayBest(), dRec = !dPrev || time < dPrev;
    if (rec) store.set(KEY.best, time);
    if (dRec) store.set(KEY.day, today() + '|' + time);
    $('overH').textContent = 'לחם משנה! נס בתוך נס!'; $('overHani').src = 'assets/hani-joy.png';
    $('overScore').textContent = fmtT(time);
    $('overLine').textContent = '״' + pickR(LINES.over) + '״';
    $('overRec').innerHTML = rec ? '<span class="newrec">שיא חדש!</span>' : dRec ? '<span class="newrec">שיא של היום!</span>' : '';
    $('bestOver').innerHTML = `${mistakes ? `זזתם באדום: <b>${mistakes}</b> פעמים<br>` : 'בלי לזוז באדום אפילו פעם אחת!<br>'}השיא שלך: <b>${fmtT(rec ? time : prev)}</b> · השיא של היום: <b>${fmtT(dRec ? time : dPrev)}</b>`;
  }
  show('over');
  if (SND.buf['niggun-freilach']) loop('niggun-freilach', true, 0.22);
}
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  if (on === paused) return;
  paused = on; setHeld(false);
  if (on) { show('paused'); SND.ctx && SND.ctx.suspend(); }
  else { show(null); SND.ctx && SND.ctx.resume(); }
}
function toMenu() { hideCard(); introT = 0; paused = false; SND.ctx && SND.ctx.resume(); stopLoops(); state = 'menu'; playing(false); tut.end(true); showBest(); show('start'); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); hush(); } });
function hush() { held = false; try { SND.ctx && SND.ctx.suspend(); } catch (e) {} }
addEventListener('pagehide', hush);
addEventListener('blur', () => setHeld(false));
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
const timerSpot = cvSpot(() => { const d = doorRect(), r = timerR(), cxp = d.x + DOOR.lx * d.k, cy = d.y - r - 8, pw = r * 5.2; return { x: cxp - pw / 2 - 10, y: cy - r - 15, w: pw + 20, h: 2 * r + 30 }; });
const doorSpot = cvSpot(() => { const d = doorRect(), r = timerR(); return { x: d.x - 8, y: d.y - 2 * r - 26, w: d.w + 16, h: d.h + 2 * r + 34 }; });
const STEPS = [
  { text: 'זאת <b>חני</b>. שבת בבית החולים, אבא מאושפז. להמוציא צריך <b>לחם משנה – שתי לחמניות</b>, ויש רק אחת!', spot: elSpot('#rolls') },
  { text: '<b>המטרה:</b> מאורתופדית לפנימית – לרב שמוליק, שיש לו עוד לחמנייה – ובחזרה לאבא. <b>7 דלתות</b>.', spot: elSpot('#where') },
  { text: 'וזה השעון <b>עד המוציא</b>. נגמר – והסעודה מתחילה בלי לחם משנה!', spot: elSpot('#clock') },
  { text: '<b style="color:#1e9a5a">ירוק</b> = הדלת פתוחה – <b>הולכים</b>.<br><b style="color:#d23">אדום</b> = החיישן של הדלת מסתכל על כל המסדרון – <b>קופאים!</b>', spot: doorSpot },
  { text: 'הטיימר מראה <b>עוד כמה שניות הצבע מתחלף</b>. צהוב מהבהב = עוד רגע אדום!', spot: timerSpot },
  { text: 'זזתם באדום? <b>חס וחלילה!</b> חוזרים לתחילת המסדרון. גם האנשים מסביב משחקים – לפעמים הם נתפסים.' },
  { text: '<b>החזיקו "הולכים"</b> כדי ללכת, ועזבו כדי לעמוד. נסו: לכו קצת – ועצרו. <span class="keyhint">(במחשב: רווח)</span>', try: 'walk', spot: elSpot('#walkBtn') },
  { text: 'עכשיו: <b>כשיהיה אדום – אל תזוזו</b> עד שיחזור הירוק.', try: 'freeze' },
  { text: '<b>לכו בירוק, עמדו באדום – ועברו בדלת!</b>', try: 'pass' },
  { text: 'בלי לרוץ – <b>בלי פסיעה גסה</b>. רק להחזיק בזמן ולעזוב בזמן. <b>בהצלחה!</b>', last: true },
];
function tutRunning() { return tut.on && tutWait && !tutWait.done; }
const tut = {
  on: false, i: 0,
  step() { return STEPS[this.i] || {}; },
  begin() {
    resetRun(); state = 'tut'; this.on = true; this.i = 0;
    show(null); playing(true); enterScene(0, tutScene); dots();
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = this.step();
    tutWait = null;
    if (s.try === 'walk') tutWait = { id: 'walk', done: false };
    if (s.try === 'freeze') { tutWait = { id: 'freeze', done: false, redClean: false }; if (!green) { green = true; phaseT = 0; phaseLen = 1.5; } }
    if (s.try === 'pass') { tutWait = { id: 'pass', done: false }; if (z > 0.7) z = 0.6; }
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
    store.set(KEY.tut, '1'); setHeld(false); stopLoops();
    if (!silent) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = this.step();
    // "walk" = she walked a bit and stopped (without being caught)
    if (tutWait && tutWait.id === 'walk' && !tutWait.done && tutWait.pressed && !held && z > 0.1 && oops <= 0) tutWait.done = true;
    // "freeze": being caught during red spoils this red - wait for the next one
    if (tutWait && tutWait.id === 'freeze' && oops > 0) tutWait.redClean = false;
    if (tutWait && tutWait.id === 'freeze' && !green && oops > 0.9) tutWait.redClean = false;
    const sp = s.spot ? s.spot() : null;
    const slim = !!(tutWait && !tutWait.done), dim = sp && !slim;
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    const low = sp ? sp.y + sp.h / 2 > innerHeight * 0.5 : true;
    tutCard.classList.toggle('slim', slim);
    tutCard.style.top = slim ? `calc(var(--safe-t) + 4px)` : low ? `calc(var(--safe-t) + 54px)` : 'auto';
    tutCard.style.bottom = (low || slim) ? 'auto' : `calc(var(--safe-b) + var(--strip) + 10px)`;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; setHeld(false); $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
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
  get green() { return green; }, get timeLeft() { return timeLeft(); }, get redFor() { return redFor; }, get oops() { return oops; }, get rolls() { return rolls; },
  get failed() { return failed; }, get intro() { return introT; }, get pastZ() { return PAST; }, get scene() { return sc; }, get people() { return people; }, LIMIT,
  hold(v) { held = v; }, tick(dt) { step(dt); }, tut, startGame,
};
