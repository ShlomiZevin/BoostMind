// לא זו השאלה - a Helix Jump game in a Techy-Tech management meeting.
// Daniel (a video-call avatar coin) bounces down a tower of rings. Every ring is a question from Amir or Ofer; its
// answer panels open when Daniel lands on them - the vague buzzword answer lets him down into the details, the clear
// correct answer gets "זאת לא השאלה" (a strike). Red slices = interruptions (a strike). 3 strikes = removed from the meeting.
import * as THREE from 'three';

const SLUG = 'not-the-question';
const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const qs = new URLSearchParams(location.search);

// ---------------------------------------------------------------- content (from the script + their profiles)
const STAGES = [
  { name: 'ה-POC', note: 'תשובה ברורה אחת בכל טבעת. אל תענו אותה.', qs: [
    { who: 'amir', q: 'דיברנו על קריאה של תמונות. זה אפשרי?', clear: ['כן, אפשרי', 'כן, צריך רק מודל'], vague: ['איך אנחנו מסתכלים על זה'] },
    { who: 'amir', q: 'מבחינת התהליך, אנחנו יודעים להכיל את זה?', clear: ['כן, מוסיפים שלב', 'כן, שלב אחד'], vague: ['צריך לצאת מהשטאנץ'] },
    { who: 'ofer', q: 'אז איך אנחנו קוראים תמונה?', clear: ['עם OCR', 'מודל ראייה'], vague: ['איך מסתכלים על הקריאה'] },
    { who: 'amir', q: 'כמה זמן זה ייקח?', clear: ['שבועיים', 'עשרה ימים'], vague: ['זה עניין של Mindset'] },
    { who: 'amir', q: 'יש סיבה שלא נספיק עד יום ראשון?', clear: ['כן, אין דאטה', 'אין גישה לשרת'], vague: ['יש לנו מומנטום'] },
    { who: 'ofer', q: 'צריך עוד אנשים בצוות?', clear: ['כן, עוד מפתח', 'עוד מפתח אחד'], vague: ['צריך Ownership'] },
    { who: 'amir', q: 'ה-POC יוכיח Scalability?', clear: ['לא, זה רק POC', 'רק בגרסה הבאה'], vague: ['ה-POC יגדיר את הצורך'] },
    { who: 'ofer', q: 'צריך לשים פה RAG?', clear: ['לא, אין צורך', 'לא לתמונות'], vague: ['RAG זה Enabler'] },
  ]},
  { name: 'החשבונית', note: 'עכשיו יש שתי תשובות נכונות על כל טבעת.', qs: [
    { who: 'amir', q: 'תמונה של חשבונית - המערכת מזהה את הסכום?', clear: ['כן', 'כן, את הסכום'], vague: ['אז איזה סכום אתם רוצים?'] },
    { who: 'amir', q: 'הסכום בחשבונית הוא הסכום שאנחנו רוצים?', clear: ['כן, זה הסכום', 'הסכום הסופי'], vague: ['זה המקום שלי כאיש מקצוע'] },
    { who: 'ofer', q: 'היא מזהה גם את התאריך?', clear: ['כן, גם תאריך', 'כן, את התאריך'], vague: ['בוא נרד לפרטים'] },
    { who: 'amir', q: 'ומה עם חשבונית מקומטת?', clear: ['מיישרים וקוראים', 'עדיין קוראים'], vague: ['צריך מבט הוליסטי'] },
    { who: 'ofer', q: 'זה עובד גם באנגלית?', clear: ['כן, גם באנגלית', 'כן, כל שפה'], vague: ['זה Value Proposition'] },
    { who: 'amir', q: 'אפשר לקרוא כמה חשבוניות ביחד?', clear: ['כן, בבת אחת', 'כן, בבאץ׳'], vague: ['זאת שאלה של סקייל'] },
    { who: 'amir', q: 'מה קורה כשהסכום לא ברור?', clear: ['מסמנים לבדיקה', 'שולחים לאדם'], vague: ['נגדיר את זה בהמשך'] },
    { who: 'ofer', q: 'זה יהיה מוכן לרבעון הבא?', clear: ['כן, ברבעון הבא', 'כן, בספטמבר'], vague: ['זה על ה-Roadmap'] },
  ]},
  { name: 'היועץ החיצוני', note: 'יותר אדום. פחות זמן לחשוב.', qs: [
    { who: 'daniel', q: 'דניאל: אוקיי, אם תרצו אני יכול—', clear: ['אני יכול לעשות את זה', 'אני אבנה את זה'], vague: ['נביא יועץ חיצוני'] },
    { who: 'amir', q: 'מה נשאל את היועץ?', clear: ['איזה סכום צריך', 'מה ההגדרה'], vague: ['את השאלות שאנחנו לא שואלים'] },
    { who: 'ofer', q: 'אנחנו מגיעים אליו עם פתרון?', clear: ['כן, יש פתרון', 'כבר יש פתרון'], vague: ['בגלל זה מביאים אותו'] },
    { who: 'amir', q: 'מתי נשב איתו?', clear: ['מחר ב-10', 'ביום ראשון'], vague: ['נשלח לך זימון'] },
    { who: 'ofer', q: 'מי מחזיק את ה-Ownership?', clear: ['אני', 'דניאל'], vague: ['ההנהלה מובילה'] },
    { who: 'amir', q: 'ומה עם רונית? היא בתמונה?', clear: ['לא, עוד לא', 'צריך לספר לה'], vague: ['שזה יגיע ממנה'] },
    { who: 'amir', q: 'אנחנו מסונכרנים?', clear: ['לא ממש', 'לא, אין החלטה'], vague: ['חד משמעית'] },
    { who: 'ofer', q: 'מה ה-Next Step?', clear: ['להתחיל לפתח', 'לבנות את הדמו'], vague: ['עוד פגישת יישור קו'] },
  ]},
];
const STAGE_NAMES_MORE = ['פגישת המשך', 'עוד פגישת המשך', 'פגישת יישור קו', 'פגישת סנכרון'];
const RING_PER_STAGE = 10;
const TUT_Q = { who: 'amir', q: 'דיברנו על קריאה של תמונות. זה אפשרי?', clear: ['כן, אפשרי'], vague: ['איך אנחנו מסתכלים על זה'] };
const NAMES = { amir: 'אמיר', ofer: 'עופר', daniel: 'דניאל' };

// ---------------------------------------------------------------- seeded random (same tower for everyone each day)
const dayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- storage
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const KEY_BEST = `shlomiverse:${SLUG}:best`, KEY_DAY = `shlomiverse:${SLUG}:day`, KEY_TUT = `shlomiverse:${SLUG}:tut`, KEY_SND = `shlomiverse:${SLUG}:snd`;
const best = () => Number(LS.get(KEY_BEST, 0)) || 0;
function dayBest() { const [d, v] = String(LS.get(KEY_DAY, '')).split('|'); return d === dayKey() ? Number(v) || 0 : 0; }

// ---------------------------------------------------------------- sound
const SND = {
  bounce: ['bounce-1', 'bounce-2', 'bounce-3'], pass: ['pass-1', 'pass-2', 'pass-3'], reject: ['reject-1', 'reject-2'],
  red: ['red-1', 'red-2'], momentum: ['momentum-1'], smash: ['smash-1'], removed: ['removed-1', 'removed-2'],
  level: ['level-1', 'level-2'], tap: ['tap-1', 'tap-2'], over: ['over-1'], win: ['win-1'],
};
const VO = {
  no: ['no-1', 'no-2', 'no-3', 'no-4', 'no-5', 'no-6'], yes: ['yes-1', 'yes-2', 'yes-3'], chad: ['chad-1', 'chad-2', 'chad-3'],
  start: ['start-1'], deep: ['deep-1', 'deep-2', 'deep-3'], end: ['end-1'], dan: ['dan-1', 'dan-2', 'dan-3'],
};
const VO_TEXT = {
  'no-1': 'זאת לא השאלה.', 'no-2': 'דניאל, שזה אפשרי זה ברור. זאת לא השאלה.', 'no-3': 'גם זאת לא השאלה.', 'no-4': 'דניאל, אתה שוב עונה לי על משהו שלא שאלתי.',
  'no-5': 'דניאל, דניאל... זאת לא השאלה.', 'no-6': 'תנסה רגע לצאת מהשטאנץ שאתה תקוע בו.', 'yes-1': 'בדיוק!', 'yes-2': 'זאת בדיוק התשובה שאנחנו מצפים ממך.', 'yes-3': 'מעולה. ממש מעולה.',
  'chad-1': 'חד משמעית.', 'chad-2': 'חד משמעית!', 'chad-3': 'נכון. חד משמעית.', 'start-1': 'טוב חברים, היום אנחנו דווקא יורדים קצת לפרטים.',
  'deep-1': 'אמיר, אני חושב שאנחנו עדיין לא מספיק עמוק בפרטים.', 'deep-2': 'אני חושב שכדאי שנביא יועץ חיצוני.', 'deep-3': 'את השאלות שאנחנו אפילו לא יודעים שאנחנו עדיין לא שואלים.',
  'end-1': 'טוב דניאל, אנחנו נשלח לך זימון.', 'dan-1': 'רגע, רק רציתי—', 'dan-2': 'כן, אפשר—', 'dan-3': 'אז קודם כול—',
};
const Q_VO = {"דיברנו על קריאה של תמונות. זה אפשרי?": "q-1", "מבחינת התהליך, אנחנו יודעים להכיל את זה?": "q-2", "אז איך אנחנו קוראים תמונה?": "q-3", "כמה זמן זה ייקח?": "q-4", "יש סיבה שלא נספיק עד יום ראשון?": "q-5", "צריך עוד אנשים בצוות?": "q-6", "ה-POC יוכיח Scalability?": "q-7", "צריך לשים פה RAG?": "q-8", "תמונה של חשבונית - המערכת מזהה את הסכום?": "q-9", "הסכום בחשבונית הוא הסכום שאנחנו רוצים?": "q-10", "היא מזהה גם את התאריך?": "q-11", "ומה עם חשבונית מקומטת?": "q-12", "זה עובד גם באנגלית?": "q-13", "אפשר לקרוא כמה חשבוניות ביחד?": "q-14", "מה קורה כשהסכום לא ברור?": "q-15", "זה יהיה מוכן לרבעון הבא?": "q-16", "מה נשאל את היועץ?": "q-17", "אנחנו מגיעים אליו עם פתרון?": "q-18", "מתי נשב איתו?": "q-19", "מי מחזיק את ה-Ownership?": "q-20", "ומה עם רונית? היא בתמונה?": "q-21", "אנחנו מסונכרנים?": "q-22", "מה ה-Next Step?": "q-23", "אז מה אתה מציע?": "q-ask"};
const VO_WHO = (id) => (/^(yes-3|chad|deep-1|deep-3)/.test(id) ? 'ofer' : /^dan/.test(id) ? 'daniel' : 'amir');

const A = { ctx: null, buf: {}, last: {}, on: LS.get(KEY_SND, '1') === '1', music: null, musicGain: null, voice: null, master: null };
function audioCtx() {
  if (!A.ctx) {
    A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.master = A.ctx.createGain(); A.master.gain.value = A.on ? 1 : 0; A.master.connect(A.ctx.destination);
    loadAll();
  }
  return A.ctx;
}
function wake() {
  const c = audioCtx();
  if (c.state !== 'running') {
    c.resume().catch(() => {});
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch {}
    setTimeout(() => {
      if (A.ctx && A.ctx.state !== 'running' && !document.hidden) { try { A.ctx.close(); } catch {} A.ctx = null; A.buf = {}; A.music = null; audioCtx(); if (G.running) startMusic(); }
    }, 400);
  }
}
async function loadOne(name, dir) {
  try { const r = await fetch(`assets/${dir}/${name}.mp3`); const ab = await r.arrayBuffer(); A.buf[name] = await A.ctx.decodeAudioData(ab); } catch {}
  if (name === 'music-loop' && G.running && !G.paused && !G.over) startMusic();
}
function loadAll() {
  Object.values(SND).flat().concat(['music-loop']).forEach((n) => loadOne(n, 'sfx'));
  Object.values(VO).flat().concat(Object.values(Q_VO)).forEach((n) => loadOne(n, 'vo'));
}
function pick(list, group) { let i = Math.floor(Math.random() * list.length); if (list.length > 1 && list[i] === A.last[group]) i = (i + 1) % list.length; A.last[group] = list[i]; return list[i]; }
function play(name, vol = 1, rate = 1) {
  if (!A.ctx || !A.buf[name]) return null;
  const s = A.ctx.createBufferSource(), g = A.ctx.createGain(); s.buffer = A.buf[name]; s.playbackRate.value = rate; g.gain.value = vol;
  s.connect(g); g.connect(A.master); s.start(); return s;
}
function sfx(group, vol = 1, rate = 1) { return play(pick(SND[group], group), vol, rate); }
function startMusic() {
  if (!A.ctx || A.music || !A.buf['music-loop']) return;
  const s = A.ctx.createBufferSource(), g = A.ctx.createGain(); s.buffer = A.buf['music-loop']; s.loop = true; s.loopStart = 0.03; s.loopEnd = A.buf['music-loop'].duration - 0.03; g.gain.value = 0.3;
  s.connect(g); g.connect(A.master); s.start(); A.music = s; A.musicGain = g;
}
function stopMusic() { if (A.music) { try { A.music.stop(); } catch {} A.music = null; } }
// one voice at a time; the strip shows who talks
let voiceTimer = 0;
function readQuestion(id, who) { if (A.voice) { try { A.voice.stop(); } catch {} } A.voice = play(id, 1.0); talk(who, (A.buf[id] ? A.buf[id].duration : 1.5) * 1000); }
function voice(group, opts = {}) {
  const id = typeof group === 'string' && VO_TEXT[group] ? group : pick(VO[group], 'vo-' + group);
  const who = VO_WHO(id);
  if (A.voice) { try { A.voice.stop(); } catch {} A.voice = null; }
  A.voice = play(id, 1.0);
  if (!opts.silentText) say(who, VO_TEXT[id], opts.cls || '');
  talk(who, (A.buf[id] ? A.buf[id].duration : 1.2) * 1000, /^no-/.test(id) ? 'no' : '');
  return id;
}
function setSound(on) {
  A.on = on; LS.set(KEY_SND, on ? '1' : '0'); if (A.master) A.master.gain.value = on ? 1 : 0;
  ['#sndB', '#sndB2'].forEach((s) => { $(s).textContent = on ? '🔊 צליל' : '🔇 צליל'; });
}

// ---------------------------------------------------------------- strip + HUD
let reactT = 0;
function say(who, text, cls = '') { // a reaction (Daniel's answer, Amir, Ofer) - its own line under the strip, the question stays
  const el = $('#react'); el.className = 'on ' + cls;
  el.innerHTML = (who === 'daniel' ? '<img class="av" src="assets/daniel.webp" alt="">' : '') + `<b>${NAMES[who] || ''}:</b> ${text.replace(/</g, '&lt;')}`;
  if (who === 'daniel') talk('', 0); // Daniel talks - no manager tile lights up
  $('#stage').classList.add('off'); clearTimeout(reactT);
  reactT = setTimeout(() => { el.className = ''; $('#stage').classList.remove('off'); }, 2600);
}
function ask(who, text) { // the question of the ring Daniel is on - always on screen
  $('#say').innerHTML = `<b>${NAMES[who] || ''} שואל:</b> ${text.replace(/</g, '&lt;')}`;
}
function talk(who, ms, pose) {
  clearTimeout(voiceTimer);
  $('#tAmir').classList.toggle('talk', who === 'amir'); $('#tOfer').classList.toggle('talk', who === 'ofer');
  $('#tAmir img').src = who === 'amir' ? (pose === 'no' ? 'assets/amir-no.webp' : 'assets/amir-talk.webp') : 'assets/amir.webp';
  $('#tOfer img').src = who === 'ofer' ? 'assets/ofer-talk.webp' : 'assets/ofer.webp';
  voiceTimer = setTimeout(() => talk('', 0), Math.max(500, ms));
}
let popT = 0;
function pop(text, cls) { const p = $('#pop'); p.textContent = text; p.className = 'on ' + cls; clearTimeout(popT); popT = setTimeout(() => { p.className = ''; }, 900); }
function chip(text, ms = 2600) { const c = $('#chip'); c.textContent = text; c.classList.remove('off'); clearTimeout(c._t); if (ms) c._t = setTimeout(() => c.classList.add('off'), ms); }
function hud() {
  $('#depthN').textContent = G.score;
  document.querySelectorAll('#strikes i').forEach((el, i) => el.classList.toggle('x', i < G.strikes));
}

// ---------------------------------------------------------------- three.js scene
const canvas = $('#cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-7, 9, 2.5); scene.add(sun);
// a room reflection so the ball and the rings shine
import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const mat = ball.userData.body.material; mat.envMap = env; mat.envMapIntensity = 0.7; mat.needsUpdate = true;
}).catch(() => {});

const SLICES = 12, SA = TAU / SLICES;
const R_IN = 0.78, R_OUT = 2.95, THICK = 0.36, GAP = 3.3, BALL_R = 0.56, BALL_Z = 1.9;
const tower = new THREE.Group(); scene.add(tower);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 400, 32), new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 0.35, metalness: 0.05 }));
tower.add(pole);

const PALETTES = [
  [0x2d6cf0, 0xffc531], [0x16a873, 0x2d6cf0], [0x7a4ce0, 0xffc531], [0x13a3b5, 0xffc531],
];
const MAT = {
  red: new THREE.MeshStandardMaterial({ color: 0xe5383b, roughness: 0.3, emissive: 0x550000, emissiveIntensity: 0.4 }),
  panel: new THREE.MeshStandardMaterial({ color: 0xf7f8ff, roughness: 0.35 }),
};
const plainMats = {};
function plainMat(c) { return plainMats[c] || (plainMats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.05 })); }

// a slice of the ring between local angles a0..a1 (a = 0 is the front, where Daniel is, when the tower is unturned)
function sliceGeo(a0, a1) {
  const s = new THREE.Shape(), p0 = Math.PI / 2 - a1, p1 = Math.PI / 2 - a0;
  s.absarc(0, 0, R_OUT, p0, p1, false); s.absarc(0, 0, R_IN, p1, p0, true); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: THICK, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(Math.PI / 2); // top face at y = 0, the body below
  g.translate(0, 0.05, 0);
  return g;
}
// the top face carrying the answer's words (u along the arc, v from outer to inner)
function labelGeo(a0, a1) {
  const g = new THREE.BufferGeometry(), N = 16, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + (a1 - a0) * t;
    for (let j = 0; j <= 1; j++) { const r = j ? R_IN + 0.08 : R_OUT - 0.06; pos.push(r * Math.sin(a), 0.105, r * Math.cos(a)); uv.push(t, j); }
  }
  for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// one canvas connected to the page with dir=rtl, so mixed Hebrew + English words come out in the right order
const LABC = Object.assign(document.createElement('canvas'), { width: 512, height: 300 });
LABC.setAttribute('dir', 'rtl'); LABC.style.cssText = 'position:fixed;left:-9999px;top:0;width:4px;height:4px;pointer-events:none';
document.body.appendChild(LABC);
function labelTex(text, kind) {
  const x = LABC.getContext('2d');
  x.clearRect(0, 0, 512, 300);
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = text.split(' '); let lines = [text], size = 92;
  const fits = (ls, s) => { x.font = `900 ${s}px Rubik, sans-serif`; return ls.every((l) => x.measureText(l).width < 480); };
  while (!fits(lines, size) && size > 66) size -= 2;
  if (!fits(lines, size)) { // two lines
    let bestSplit = 1, bestW = 1e9;
    for (let i = 1; i < words.length; i++) { x.font = `900 72px Rubik`; const w = Math.max(x.measureText(words.slice(0, i).join(' ')).width, x.measureText(words.slice(i).join(' ')).width); if (w < bestW) { bestW = w; bestSplit = i; } }
    lines = [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')]; size = 80;
    while (!fits(lines, size) && size > 36) size -= 2;
  }
  x.font = `900 ${size}px Rubik, sans-serif`;
  x.fillStyle = kind === 'no' ? '#ffffff' : '#16213e';
  lines.forEach((l, i) => x.fillText(l, 256, 150 + (i - (lines.length - 1) / 2) * size * 1.08));
  const c = document.createElement('canvas'); c.width = 512; c.height = 300; c.getContext('2d').drawImage(LABC, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---- answer cards: the painted card (assets/card.png) lying flat on the panel, its words straight, always turned to
// the player. The camera looks down at the rings (~35 deg), which squashes what lies flat to ~0.58 of its height -
// the card's plane and its words are drawn that much taller, so on screen they look like a normal card.
const FLAT = 1 / 0.58;
const CARD_IMG = new Image(); CARD_IMG.src = 'assets/card.png';
const STOP_TEX = new THREE.TextureLoader().load('assets/stop.png'); STOP_TEX.colorSpace = THREE.SRGBColorSpace;
const RED_TEX = STOP_TEX;
const CARD_W = 1.8, CARD_H = 1.8 / 2.1 * FLAT; // plane size in the world
const CARD_FONT = 'Fredoka, Rubik, sans-serif';
function signTex(text, kind) {
  const W = 1024, H = Math.round(1024 * CARD_H / CARD_W), c = document.createElement('canvas'); c.width = W; c.height = H;
  LABC.width = W; LABC.height = H; const x = LABC.getContext('2d'); x.clearRect(0, 0, W, H);
  const red = kind === 'no';
  if (CARD_IMG.complete && CARD_IMG.naturalWidth) x.drawImage(CARD_IMG, 0, 0, W, H);
  else { x.fillStyle = '#fff'; x.strokeStyle = '#1b46b0'; x.lineWidth = 30; x.beginPath(); x.roundRect(20, 20, W - 40, H - 40, 90); x.fill(); x.stroke(); }
  if (red) { x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(229,56,59,0.88)'; x.fillRect(0, 0, W, H); x.restore(); }
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = text.split(' '), maxW = W * 0.8, maxH = (H * 0.62) / FLAT; // the card's white inside, in unsquashed px
  const fits = (ls, sz) => { x.font = `700 ${sz}px ${CARD_FONT}`; return ls.every((l) => x.measureText(l).width <= maxW) && ls.length * sz * 1.05 <= maxH; };
  let lines = [text], size = 170;
  while (!fits(lines, size) && size > 120) size -= 4;
  if (!fits(lines, size) && words.length > 1) {
    let best = 1, bw = 1e9; x.font = `700 100px ${CARD_FONT}`;
    for (let i = 1; i < words.length; i++) { const w = Math.max(x.measureText(words.slice(0, i).join(' ')).width, x.measureText(words.slice(i).join(' ')).width); if (w < bw) { bw = w; best = i; } }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]; size = 140;
  }
  while (!fits(lines, size) && size > 50) size -= 4;
  x.save(); x.translate(W / 2, H / 2 + H * 0.01); x.scale(1, FLAT);
  x.font = `700 ${size}px ${CARD_FONT}`;
  lines.forEach((l, i) => {
    const y = (i - (lines.length - 1) / 2) * size * 1.05;
    x.fillStyle = red ? '#7a0b0d55' : '#1b46b022'; x.fillText(l, 0, y + size * 0.05); // a soft shadow under the words
    x.fillStyle = red ? '#ffffff' : '#16213e'; x.fillText(l, 0, y);
  });
  x.restore();
  c.getContext('2d').drawImage(LABC, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function sign(group, a, w, h, tex) {
  const pivot = new THREE.Object3D(); pivot.position.set(1.9 * Math.sin(a), 0.112, 1.9 * Math.cos(a)); group.add(pivot); pivot.userData.a = a;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; pivot.add(m); return m;
}

// Daniel - a real glossy ball, his painted face in a round video-call window on its front
const ball = new THREE.Group(); scene.add(ball);
const ballCanvas = Object.assign(document.createElement('canvas'), { width: 1024, height: 512 });
const ballTex = new THREE.CanvasTexture(ballCanvas); ballTex.colorSpace = THREE.SRGBColorSpace; ballTex.anisotropy = 8;
function paintBall(img) {
  const x = ballCanvas.getContext('2d'), W = 1024, H = 512, cx = 256, cy = 256; // u = .25 is the ball's front (+z)
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5b9bff'); g.addColorStop(0.5, '#2d6cf0'); g.addColorStop(1, '#1b46b0');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // a light band around the ball, like a call app's stripe
  x.fillStyle = '#ffffff22'; x.fillRect(0, cy + 150, W, 14); x.fillRect(0, cy - 164, W, 14);
  // the face window: drawn row by row, each row widened by 1/cos(latitude) so it is round on the sphere
  const R = 118, ring = 16, sx = 76, sy = 20, ss = 360; // the face's square in daniel.webp (512x512)
  for (let y = -R - ring; y <= R + ring; y++) {
    const lat = (y / H) * Math.PI, k = 1 / Math.cos(lat), r = Math.sqrt(Math.max(0, (R + ring) ** 2 - y * y));
    x.fillStyle = '#ffffff'; x.fillRect(cx - r * k, cy + y, 2 * r * k, 1.5); // the white window frame
    const rf = Math.sqrt(Math.max(0, R * R - y * y)); if (!rf || !img) continue;
    const srcY = sy + ((y + R) / (2 * R)) * ss, srcX0 = sx + (1 - rf / R) / 2 * ss, srcW = (rf / R) * ss;
    x.drawImage(img, srcX0, srcY, srcW, ss / (2 * R) + 0.5, cx - rf * k, cy + y, 2 * rf * k, 1.5);
  }
  // the green "live" dot of a call
  x.fillStyle = '#16a873'; x.beginPath(); x.ellipse(cx + 92 * 1.3, cy + 88, 18 * 1.3, 18, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke();
  ballTex.needsUpdate = true;
}
paintBall(null);
{ const im = new Image(); im.onload = () => paintBall(im); im.src = 'assets/daniel.webp'; }
{
  const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), new THREE.MeshPhysicalMaterial({ map: ballTex, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.3, emissive: 0xffc531, emissiveIntensity: 0 }));
  ball.add(m);
  // a soft aura that shows only in momentum
  const aura = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 1.32, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffc531, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  ball.add(aura);
  ball.userData.body = m; ball.userData.aura = aura;
}
function setGlow(on) { ball.userData.aura.material.opacity = on ? 0.55 : 0; ball.userData.body.material.emissiveIntensity = on ? 0.25 : 0; }
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

// ---------------------------------------------------------------- the tower: rings
// ring i top is at y = -i * GAP. ring.slots[k] = { kind: 'plain'|'red'|'clear'|'vague', panel: id } ; panels = [{ kind, text, s0, n, mesh, label }]
const G = {
  running: false, paused: false, over: false, tut: false, frozen: false,
  rings: [], rot: 0, y: 2, vy: 0, score: 0, strikes: 0, invuln: 0, combo: 0, momentum: false,
  ringAt: 0, rand: null, qOrder: [], stage: 0, nextStageAt: RING_PER_STAGE, lastAsked: -1, tutRing: false,
  rotTotal: 0, pieces: [], squash: 0, flash: [],
};
function stageOf(i) { return Math.floor(i / RING_PER_STAGE); }
function stageName(s) { return s < STAGES.length ? STAGES[s].name : STAGE_NAMES_MORE[(s - STAGES.length) % STAGE_NAMES_MORE.length]; }
function questionFor(i) {
  const s = Math.min(stageOf(i), STAGES.length - 1);
  if (stageOf(i) >= STAGES.length) { // after the last stage: all questions, mixed
    const all = STAGES.flatMap((st) => st.qs); return all[Math.floor(G.rand() * all.length)];
  }
  const pool = STAGES[s].qs; const k = i % RING_PER_STAGE;
  if (!G.qOrder[s]) { G.qOrder[s] = pool.map((_, n) => n).sort(() => G.rand() - 0.5); }
  return pool[G.qOrder[s][k % pool.length]];
}

function layout(i, arrive) {
  // arrive = the local slice index where Daniel lands when he falls from the ring above (kept plain + its neighbours)
  const st = stageOf(i), r = G.rand;
  const q = G.tutRing && i === 0 ? TUT_Q : questionFor(i);
  const nClear = G.tutRing && i === 0 ? 1 : st === 0 ? 1 : 2;
  const nRed = G.tutRing && i === 0 ? 1 : i < 3 ? 0 : st === 0 ? 1 : st === 1 ? 1 + (r() < 0.5 ? 1 : 0) : st === 2 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
  const slots = new Array(SLICES).fill(null).map(() => ({ kind: 'plain', panel: -1 }));
  const reserved = new Set([arrive, (arrive + 1) % SLICES, (arrive + SLICES - 1) % SLICES]);
  const free = (k, n) => { for (let j = 0; j < n; j++) { const s = (k + j) % SLICES; if (reserved.has(s) || slots[s].kind !== 'plain') return false; } return true; };
  const panels = [];
  const kinds = ['vague'].concat(new Array(nClear).fill('clear'));
  const texts = { vague: q.vague.slice().sort(() => r() - 0.5), clear: q.clear.slice().sort(() => r() - 0.5) };
  for (const kind of kinds) {
    for (let tries = 0; tries < 60; tries++) {
      const k = Math.floor(r() * SLICES);
      if (free(k, 2)) { const id = panels.length; panels.push({ kind, text: texts[kind].shift() || q[kind][0], s0: k, n: 2 }); for (let j = 0; j < 2; j++) slots[(k + j) % SLICES] = { kind, panel: id }; break; }
    }
  }
  for (let n = 0; n < nRed; n++) {
    for (let tries = 0; tries < 40; tries++) { const k = Math.floor(r() * SLICES); if (free(k, 1)) { slots[k] = { kind: 'red', panel: -1 }; break; } }
  }
  return { q, slots, panels };
}

function buildRing(i, arrive) {
  const L = layout(i, arrive);
  const group = new THREE.Group(); group.position.y = -i * GAP; tower.add(group);
  const pal = PALETTES[stageOf(i) % PALETTES.length];
  const ring = { i, group, q: L.q, slots: L.slots, panels: L.panels, meshes: new Array(SLICES).fill(null), signs: [], passed: false, asked: false };
  for (let k = 0; k < SLICES; k++) {
    const sl = L.slots[k];
    if (sl.panel >= 0) continue;
    const mat = sl.kind === 'red' ? MAT.red : plainMat(pal[k % 2]);
    const m = new THREE.Mesh(sliceGeo(k * SA + 0.004, (k + 1) * SA - 0.004), mat); group.add(m); ring.meshes[k] = m;
    if (sl.kind === 'red') ring.signs.push(sign(group, (k + 0.5) * SA, 0.82, 0.82 * FLAT, STOP_TEX).parent);
  }
  L.panels.forEach((p) => {
    const a0 = p.s0 * SA + 0.006, a1 = (p.s0 + p.n) * SA - 0.006;
    const m = new THREE.Mesh(sliceGeo(a0, a1), MAT.panel.clone()); group.add(m);
    const lab = sign(group, (p.s0 + p.n / 2) * SA, CARD_W, CARD_H, signTex(p.text, '')); ring.signs.push(lab.parent);
    p.mesh = m; p.label = lab;
    for (let j = 0; j < p.n; j++) ring.meshes[(p.s0 + j) % SLICES] = m;
  });
  G.rings[i] = ring;
  return ring;
}
function arriveSlot() { return localSlot(); }
function localAngle() { return ((-G.rot % TAU) + TAU) % TAU; }
function localSlot() { return Math.floor(localAngle() / SA) % SLICES; }
function ensureRings() {
  const need = G.ringAt + 7;
  for (let i = 0; i <= need; i++) {
    if (G.rings[i]) continue;
    // where Daniel will land on ring i = where the vague panel of ring i-1 is (he falls through it)
    let arrive = localSlot();
    const prev = G.rings[i - 1];
    if (prev) { const v = prev.panels.find((p) => p.kind === 'vague'); if (v) arrive = (v.s0 + (v.n > 1 ? (G.rand() < 0.5 ? 0 : 1) : 0)) % SLICES; }
    buildRing(i, arrive);
  }
  // drop rings far above
  G.rings.forEach((r, i) => { if (r && i < G.ringAt - 2) { tower.remove(r.group); disposeGroup(r.group); G.rings[i] = null; } });
}
function disposeGroup(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== RED_TEX) o.material.map.dispose(); }); }

// ---------------------------------------------------------------- the round
function resetWorld(tutorial) {
  G.rings.forEach((r) => { if (r) { tower.remove(r.group); disposeGroup(r.group); } });
  G.pieces.forEach((p) => scene.remove(p.m)); G.pieces = [];
  G.rings = []; G.qOrder = []; G.rot = 0; tower.rotation.y = 0; G.y = 1.6; G.vy = 0; G.score = 0; G.strikes = 0; G.invuln = 0;
  G.camY = null; G.combo = 0; G.momentum = false; G.ringAt = 0; G.over = false; G.paused = false; G.lastAsked = -1; G.rotTotal = 0;
  G.tut = !!tutorial; G.tutRing = !!tutorial;
  G.rand = rng(`${SLUG}|${dayKey()}`);
  ensureRings();
  // turn the tower so Daniel starts on a plain slice of ring 0
  const r0 = G.rings[0];
  for (let k = 0; k < SLICES; k++) { if (r0.slots[k].kind === 'plain' && r0.slots[(k + 1) % SLICES].kind === 'plain') { G.rot = -(k + 1) * SA; break; } }
  tower.rotation.y = G.rot;
  setGlow(false);
  hud(); askRing(0);
}
function askRing(i) {
  const r = G.rings[i]; if (!r || r.asked) return; r.asked = true; G.lastAsked = i;
  if (r.q.who === 'daniel') ask('amir', 'אז מה אתה מציע?'); else ask(r.q.who, r.q.q);
  // the question is read aloud (Amir / Ofer)
  const qid = Q_VO[r.q.who === 'daniel' ? 'אז מה אתה מציע?' : r.q.q];
  if (qid && (G.running || G.tut)) setTimeout(() => { if (G.ringAt === i && !G.over && !G.frozen) readQuestion(qid, r.q.who === 'daniel' ? 'amir' : r.q.who); }, r.q.who === 'daniel' ? 1400 : 250);
  if (r.q.who === 'daniel') say('daniel', r.q.q.replace(/^דניאל: /, ''), '');
  talk(r.q.who === 'daniel' ? '' : r.q.who, 1800);
  if (!G.tut && !G.redWarned && r.slots.some((x) => x.kind === 'red')) { G.redWarned = true; chip('✋ אדום = קוטעים אותך. אל תנחתו עליו!', 3800); }
  const st = stageOf(i);
  $('#stageT').textContent = `שלב ${st + 1}: ${stageName(st)} · שאלה ${(i % RING_PER_STAGE) + 1}/${RING_PER_STAGE}`;
}
function startGame(tutorial) {
  wake();
  ['#start', '#over', '#card', '#pause'].forEach((s) => ($(s).hidden = true));
  ['#strip', '#hud', '#stage'].forEach((s) => ($(s).hidden = false));
  resetWorld(tutorial);
  G.running = true; G.frozen = false;
  startMusic();
  if (!tutorial) {
    window.track && window.track('game_start', SLUG);
    setTimeout(() => { if (G.running && !G.over) voice('start-1', { silentText: true }); }, 300);
    chip('גררו ימינה ושמאלה לסיבוב', 3200);
  }
}

function strike(kind, ring, panel) {
  if (G.tut) { // the tutorial never spends strikes
    sfx(kind === 'red' ? 'red' : 'reject', 0.8);
    if (kind === 'clear') { voice('no-1', { cls: 'no' }); pop('זאת לא השאלה', 'red'); }
    G.invuln = 0.6; return;
  }
  G.strikes++; G.invuln = 1.3; G.combo = 0; hud();
  if (navigator.vibrate) try { navigator.vibrate(60); } catch {}
  if (kind === 'red') {
    sfx('red', 0.9); pop('קטעו אותך!', 'red');
    const dId = voice('dan', { silentText: true }); say('daniel', 'כן, אפשר—', 'no');
    // Ofer cuts in only after Daniel's words end, so it is clear who talks
    setTimeout(() => { if (!G.over && G.running) voice('chad', { cls: 'no' }); }, (A.buf[dId] ? A.buf[dId].duration * 1000 : 700) + 150);
  } else {
    sfx('reject', 0.9); pop('זאת לא השאלה', 'red');
    voice('no', { cls: 'no' });
    if (Math.random() < 0.3) setTimeout(() => { if (!G.over && G.running && !A.voiceBusy) voice('chad', { cls: 'no' }); }, 1700);
  }
  if (panel) flashPanel(panel);
  if (G.strikes >= 3) setTimeout(gameOver, 900);
}
function flashPanel(p) { p.mesh.material.color.set(0xe5383b); p.label.material.map.dispose(); p.label.material.map = signTex(p.text, 'no'); p.label.material.needsUpdate = true; G.flash.push({ p, t: 0.5 }); }

function passRing(ring, how) {
  ring.passed = true;
  // break it: every slice flies out
  ring.signs = [];
  ring.group.children.slice().forEach((m) => {
    if (!m.geometry) { ring.group.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== RED_TEX) o.material.map.dispose(); }); return; } // a card holder: just gone
    const wp = new THREE.Vector3(); m.getWorldPosition(wp);
    tower.remove(m); ring.group.remove(m); m.position.copy(wp); m.rotation.y = G.rot; scene.add(m);
    if (m.material && m.material.transparent === false) { m.material = m.material.clone(); m.material.transparent = true; }
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const c = m.geometry.boundingSphere.center, ang = Math.atan2(c.x, c.z) + G.rot;
    const out = Math.cos(ang) > 0.3 ? 0.6 : 1; // pieces in front of Daniel go sideways, never at the camera
    G.pieces.push({ m, vx: Math.sin(ang) * 6 * out + (Math.cos(ang) > 0.3 ? Math.sign(Math.sin(ang) || 1) * 4 : 0), vy: 1.5, vz: Math.min(0, Math.cos(ang) * 6), spin: (Math.random() - 0.5) * 4, t: 0.45 });
  });
  G.score = ring.i + 1; hud();
  sfx('pass', 0.75, 0.95 + Math.random() * 0.1);
  if (G.tut) return;
  G.combo++;
  if (G.combo >= 3 && !G.momentum) { G.momentum = true; sfx('momentum', 0.8); pop('מומנטום!', 'gold'); setGlow(true); }
  else if (how === 'vague' && Math.random() < 0.3) say(Math.random() < 0.5 ? 'amir' : 'ofer', Math.random() < 0.5 ? 'בדיוק!' : 'מעולה.', 'yes');
  // a new stage?
  if (G.score > 0 && G.score % RING_PER_STAGE === 0) setTimeout(() => stageCard(stageOf(G.score)), 350);
}

function land(ring) {
  const k = localSlot(), sl = ring.slots[k];
  if (G.tut && G.score === 0 && (!TSTEP || TSTEP.try !== 'pass') && (sl.kind === 'vague' || sl.kind === 'clear')) { G.combo = 0; return 'bounce'; }
  if (G.momentum && !G.tut) { // momentum smashes through anything
    G.momentum = false; setGlow(false); sfx('smash', 0.9); pop('פרצתם דרך!', 'gold');
    passRing(ring, 'smash'); return 'fall';
  }
  if (sl.kind === 'vague') {
    const p = ring.panels[sl.panel];
    say('daniel', p.text, 'yes');
    passRing(ring, 'vague'); return 'fall';
  }
  if (G.invuln > 0) return 'bounce';
  if (sl.kind === 'clear') { const p = ring.panels[sl.panel]; say('daniel', p.text, ''); setTimeout(() => {}, 0); strike('clear', ring, p); G.combo = 0; return 'big'; }
  if (sl.kind === 'red') { flashSlice(ring, k); strike('red', ring); return 'big'; }
  G.combo = 0;
  return 'bounce';
}
function flashSlice(ring, k) { const m = ring.meshes[k]; if (m) G.flash.push({ m, t: 0.4 }); }

const GRAV = -30, BOUNCE = 10.2;
function step(dt) {
  if (!G.running || G.paused || G.frozen) return;
  G.invuln = Math.max(0, G.invuln - dt);
  // keys
  if (keys.left) rotate(-dt * 3.2); if (keys.right) rotate(dt * 3.2);
  G.vy += GRAV * dt;
  const ny = G.y + G.vy * dt;
  const ring = G.rings[G.ringAt];
  if (ring && !ring.passed) {
    const top = -ring.i * GAP + 0.1;
    if (G.vy < 0 && G.y - BALL_R >= top - 0.02 && ny - BALL_R < top) {
      const res = land(ring);
      if (res === 'fall') { G.y = ny; G.ringAt++; ensureRings(); askRing(G.ringAt); }
      else {
        G.y = top + BALL_R; G.vy = res === 'big' ? BOUNCE * 1.25 : BOUNCE; G.squash = 1;
        if (res === 'bounce') sfx('bounce', 0.55, 0.95 + Math.random() * 0.1);
        splat(ring);
      }
    } else G.y = ny;
  } else { G.y = ny; if (ring && ring.passed && G.y < -ring.i * GAP - 0.5) { G.ringAt = Math.max(G.ringAt, ring.i + 1); ensureRings(); askRing(G.ringAt); } }
  if (G.tut) tutTick();
}

function splat(ring) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.26 + Math.random() * 0.08, 18), new THREE.MeshBasicMaterial({ color: 0x45a86a, transparent: true, opacity: 0.55, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; const a = localAngle();
  m.position.set(BALL_Z * Math.sin(a), 0.11, BALL_Z * Math.cos(a)); ring.group.add(m);
}
function rotate(d) { if (!G.running || G.paused || G.over) return; if (G.frozen && !(G.tut && TSTEP && TSTEP.try)) return; G.rot += d; G.rotTotal += Math.abs(d); }

// ---------------------------------------------------------------- render loop
let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (t - lastT) / 1000); lastT = t;
  step(dt);
  tower.rotation.y += (G.rot - tower.rotation.y) * Math.min(1, dt * 22);
  // Daniel
  ball.position.set(0, G.y, BALL_Z);
  G.squash = Math.max(0, G.squash - dt * 6);
  const sq = G.squash; ball.scale.set(1 + sq * 0.18, 1 - sq * 0.22, 1);
  ball.rotation.x = -0.55 + Math.max(-0.25, Math.min(0.25, G.vy * 0.012)); // the face looks up at the camera, nods with the bounce
  ball.rotation.y = Math.max(-0.6, Math.min(0.6, (G.rot - tower.rotation.y) * -3)); // rolls a little as the tower turns
  ball.rotation.z = Math.sin(t / 260) * 0.06;
  if (G.momentum) ball.userData.aura.material.opacity = 0.4 + Math.sin(t / 70) * 0.2;
  ball.visible = !(G.invuln > 0 && !G.tut && Math.floor(t / 90) % 2 === 0);
  const ring = G.rings[G.ringAt];
  const floorY = ring ? -ring.i * GAP + 0.16 : G.y - 3;
  shadow.position.set(0, floorY, BALL_Z); const h = Math.max(0, G.y - floorY); shadow.scale.setScalar(Math.max(0.4, 1 - h * 0.15)); shadow.material.opacity = Math.max(0.05, 0.25 - h * 0.03);
  // camera follows down, never up
  const camTarget = Math.min(G.camY ?? 2, G.y);
  G.camY = G.camY == null ? camTarget : G.camY + (camTarget - G.camY) * Math.min(1, dt * 6);
  const aspect = camera.aspect; const back = aspect < 0.62 ? 11.2 : 10;
  camera.position.set(0, G.camY + 6.6, back); camera.lookAt(0, G.camY - 2.0, 0);
  // flying pieces
  G.pieces = G.pieces.filter((p) => { p.t -= dt; p.vy += GRAV * 0.6 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.rotation.z += p.spin * dt;
    if (p.m.material && p.m.material.opacity !== undefined) { p.m.material.transparent = true; p.m.material.opacity = Math.max(0, p.t / 0.45); }
    p.m.scale.multiplyScalar(1 - dt * 1.5);
    if (p.t <= 0) { scene.remove(p.m); if (p.m.geometry) p.m.geometry.dispose(); return false; } return true; });
  G.flash = G.flash.filter((f) => { f.t -= dt; if (f.m) f.m.material.emissiveIntensity = f.t > 0 ? 0.4 + Math.sin(t / 40) * 0.6 + 0.6 : 0.4; return f.t > 0; });
  pole.position.y = (G.camY || 0) - 100;
  G.rings.forEach((r) => { if (r) r.signs.forEach((sg) => { sg.rotation.y = -tower.rotation.y; const f = Math.cos(sg.userData.a + tower.rotation.y); sg.children[0].material.opacity = Math.max(0, Math.min(1, (f + 0.45) * 2.2)); }); });
  MAT.red.emissiveIntensity = 0.45 + Math.sin(t / 160) * 0.35;
  if (!$('#tut').hidden && TSTEP) placeSpot();
  renderer.render(scene, camera);
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 0.5 ? 50 : 44; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- input: drag anywhere turns the tower
let drag = null;
canvas.addEventListener('pointerdown', (e) => { wake(); drag = { x: e.clientX, id: e.pointerId }; canvas.setPointerCapture?.(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x; drag.x = e.clientX; rotate(dx * (TAU / (canvas.clientWidth * 1.15))); });
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
const keys = { left: false, right: false };
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (!$('#tut').hidden && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (TSTEP && !TSTEP.try) tutNext(); }
  if (!$('#tut').hidden && e.key === 'Escape') tutEnd(true);
  if ($('#tut').hidden && e.key === 'Escape' && G.running && !G.over) pauseGame();
});
addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false; });
document.addEventListener('pointerdown', wake, true);

// ---------------------------------------------------------------- stage card, pause, game over
function stageCard(s) {
  if (!G.running || G.over) return;
  G.frozen = true; sfx('level', 0.8);
  $('#cL1').textContent = `עברתם ${G.score} שאלות`;
  $('#cL2').textContent = `שלב ${s + 1}: ${stageName(s)}`;
  $('#cL3').textContent = s < STAGES.length ? STAGES[s].note : 'יותר אדום, יותר תשובות ברורות. יורדים עוד.';
  $('#card').hidden = false;
  voice(VO.deep[(s - 1) % VO.deep.length], { silentText: true });
}
$('#cGo').onclick = () => { $('#card').hidden = true; sfx('tap', 0.6); G.frozen = false; };
function pauseGame() { if (!G.running || G.over) return; G.paused = true; $('#pause').hidden = false; if (A.ctx) A.ctx.suspend().catch(() => {}); }
function resumeGame() { $('#pause').hidden = true; G.paused = false; wake(); }
$('#pauseB').onclick = () => { sfx('tap', 0.6); pauseGame(); };
$('#resB').onclick = resumeGame;
$('#restB').onclick = () => { $('#pause').hidden = true; if (A.ctx) A.ctx.resume(); startGame(false); };
$('#homeB').onclick = () => { $('#pause').hidden = true; if (A.ctx) A.ctx.resume(); showStart(); };

function gameOver() {
  if (G.over) return;
  G.over = true; G.running = false; stopMusic();
  voice('end-1', { cls: 'no' });
  setTimeout(() => { voice('dan-1', { silentText: true }); }, 1900);
  setTimeout(() => sfx('removed', 0.9), 2900);
  window.track && window.track('game_over', SLUG);
  const prev = best(), isNew = G.score > prev;
  if (isNew) LS.set(KEY_BEST, String(G.score));
  if (G.score > dayBest()) LS.set(KEY_DAY, `${dayKey()}|${G.score}`);
  if (G.score > 0 && window.VerseFrame && VerseFrame.score) VerseFrame.score(G.score);
  setTimeout(() => {
    ['#strip', '#hud', '#stage'].forEach((s) => ($(s).hidden = true)); $('#pop').className = ''; $('#chip').classList.add('off');
    $('#oScore').textContent = G.score; $('#newRec').hidden = !(isNew && G.score > 0);
    $('#oBest').textContent = `השיא שלכם: ${Math.max(prev, G.score)}`;
    $('#over').hidden = false; sfx(isNew && G.score > 0 ? 'win' : 'over', 0.8);
  }, 3300);
}
$('#againB').onclick = () => { sfx('tap', 0.6); startGame(false); };
$('#menuB').onclick = () => { sfx('tap', 0.6); $('#homeB').click(); };   // the game-over screen's way to the menu

function showStart() {
  G.running = false; G.over = false; stopMusic();
  ['#strip', '#hud', '#stage', '#over', '#card', '#pause', '#tut'].forEach((s) => ($(s).hidden = true));
  $('#start').hidden = false;
  const b = best(), d = dayBest();
  $('#best').textContent = b ? `השיא שלכם: עומק ${b}${d ? ` · היום: ${d}` : ''}` : '';
}
$('#playB').onclick = () => { wake(); sfx('tap', 0.6); if (LS.get(KEY_TUT, '') !== '1') tutStart(); else startGame(false); };
$('#howB').onclick = () => { wake(); sfx('tap', 0.6); tutStart(); };
$('#sndB').onclick = () => { wake(); setSound(!A.on); };
$('#sndB2').onclick = () => { wake(); setSound(!A.on); };

// sound off when the page goes away, back on return (from a tap)
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (A.ctx) A.ctx.suspend().catch(() => {}); if (G.running && !G.over && $('#tut').hidden) pauseGame(); } });
addEventListener('pagehide', () => { if (A.ctx) A.ctx.suspend().catch(() => {}); });

// ---------------------------------------------------------------- tutorial
let TSTEP = null, TI = 0;
const STEPS = [
  { t: 'אתם <b>דניאל</b>, האיש הטכנולוגי. העלו אתכם לפגישת הנהלה כדי לתת חוות דעת מקצועית.', spot: 'ball' },
  { t: 'המטרה: <b>לרדת כמה שיותר עמוק לפרטים</b>. כל טבעת היא עוד שאלה של אמיר ועופר.', spot: '#depth' },
  { t: 'השאלה של הטבעת שעליה אתם עומדים מופיעה כאן.', spot: '#strip' },
  { t: '<b>גררו</b> ימינה ושמאלה כדי לסובב את המגדל.', spot: null, try: 'rotate' },
  { t: 'על הטבעת יש תשובות. התשובה <b>הברורה והנכונה</b>? «זאת לא השאלה» - פסילה.', spot: 'clear' },
  { t: '✋ <b>אדום = קוטעים אותך. אסור לנחות עליו!</b> נחיתה על אדום = פסילה.', spot: 'red' },
  { t: 'סובבו את התשובה <b>המעורפלת</b> אל מתחת לדניאל - והוא ירד לשאלה הבאה.', spot: 'vague', try: 'pass' },
  { t: 'כאן הפסילות: תשובה ברורה או אדום. <b>3 פסילות</b> ומורידים אתכם מהפגישה.', spot: '#strikes' },
  { t: 'שלוש תשובות מעורפלות ברצף = <b>מומנטום</b>: פורצים דרך הטבעת הבאה, מה שלא יהיה עליה.', spot: null },
  { t: 'מוכנים? הפגישה מתחילה.', spot: null, last: true },
];
function tutStart() {
  startGame(true); TI = 0; $('#tut').hidden = false; G.frozen = true; showStep();
}
function showStep() {
  TSTEP = STEPS[TI];
  $('#tn').textContent = `${TI + 1}/${STEPS.length}`;
  $('#tt').innerHTML = TSTEP.t;
  $('#tcard').classList.toggle('try', !!TSTEP.try);
  $('#tnext').textContent = TSTEP.last ? 'מתחילים!' : 'הבא';
  G.frozen = !TSTEP.try;
  if (TSTEP.try === 'rotate') { G.rotTotal = 0; chip('גררו ימינה ושמאלה', 0); }
  if (TSTEP.try === 'pass') chip('«איך אנחנו מסתכלים על זה» ← מתחת לדניאל', 0);
  placeSpot();
}
function spotRect() {
  const s = TSTEP && TSTEP.spot; if (!s) return null;
  if (s === 'ball' || s === 'clear' || s === 'vague' || s === 'red') {
    let p;
    if (s === 'ball') p = ball.position.clone();
    else if (s === 'red') {
      const r = G.rings[0], k = r ? r.slots.findIndex((x) => x.kind === 'red') : -1; if (k < 0) return null;
      const a = (k + 0.5) * SA + tower.rotation.y; p = new THREE.Vector3(BALL_Z * Math.sin(a), -r.i * GAP, BALL_Z * Math.cos(a));
    }
    else {
      const r = G.rings[0]; const pn = r && r.panels.find((x) => x.kind === s); if (!pn) return null;
      const a = (pn.s0 + 1) * SA + tower.rotation.y; p = new THREE.Vector3(BALL_Z * Math.sin(a), -r.i * GAP, BALL_Z * Math.cos(a));
    }
    p.project(camera); const w = canvas.clientWidth, h = canvas.clientHeight; const x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    const sz = s === 'ball' ? 90 : 130; return { left: x - sz / 2, top: y - sz / 2.6, width: sz, height: sz / 1.3 };
  }
  const el = $(s); const r = el.getBoundingClientRect(), b = document.body.getBoundingClientRect();
  return { left: r.left - b.left - 6, top: r.top - b.top - 6, width: r.width + 12, height: r.height + 12 };
}
function placeSpot() {
  const sp = $('#spot'), card = $('#tcard'), H = document.body.clientHeight;
  const r = spotRect();
  $('#tut').classList.toggle('free', !r);
  if (r) { Object.assign(sp.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', display: 'block' }); }
  else sp.style.display = 'none';
  // the card away from the spotlight
  const cy = r ? r.top + r.height / 2 : H * 0.3;
  if (cy > H * 0.5) { card.style.top = `calc(var(--safe-t) + ${TSTEP.spot === '#strip' ? 90 : 84}px)`; card.style.bottom = 'auto'; }
  else { card.style.top = 'auto'; card.style.bottom = 'calc(var(--safe-b) + 70px)'; }
  if (TSTEP.try === 'rotate' || TSTEP.try === 'pass') { card.style.top = `calc(var(--safe-t) + var(--stripH) + 70px)`; card.style.bottom = 'auto'; }
}
function tutTick() {
  if (!TSTEP) return;
  if (TSTEP.try === 'rotate' && G.rotTotal > 1.6) tutDone();
  if (TSTEP.try === 'pass' && G.score >= 1) tutDone();
}
function tutDone() {
  const st = TSTEP; TSTEP = { ...st, try: null, done: true };
  $('#tt').innerHTML = '<span class="ok">יפה!</span> ' + st.t; $('#chip').classList.add('off'); sfx('level', 0.6);
  setTimeout(() => { if (TSTEP && TSTEP.done) tutNext(); }, 900);
}
function tutNext() {
  sfx('tap', 0.5);
  if (TI >= STEPS.length - 1) return tutEnd(false);
  TI++;
  // after the pass step Daniel stays on ring 1 frozen
  showStep();
}
function tutEnd() { LS.set(KEY_TUT, '1'); $('#tut').hidden = true; TSTEP = null; $('#chip').classList.add('off'); startGame(false); }
$('#tnext').onclick = () => { if (TSTEP && !TSTEP.try) tutNext(); };
$('#tskip').onclick = () => tutEnd(true);

// ---------------------------------------------------------------- test hook
window.NTQ = {
  G, get state() { return { running: G.running, over: G.over, score: G.score, strikes: G.strikes, ring: G.ringAt, slot: localSlot(), y: G.y, tut: !$('#tut').hidden, step: TI, frozen: G.frozen, paused: G.paused }; },
  ring(i) { const r = G.rings[i ?? G.ringAt]; return r && { q: r.q.q, slots: r.slots.map((s) => s.kind), panels: r.panels.map((p) => ({ kind: p.kind, text: p.text, s0: p.s0 })) }; },
  // turn so Daniel is over slot k of the current ring (for bots)
  aim(k) { G.rot = -((k + 0.5) * SA); tower.rotation.y = G.rot; },
  tick(sec) { const n = Math.round(sec / 0.016); for (let i = 0; i < n; i++) step(0.016); },
  start: startGame, tutStart, tutNext,
};

setSound(A.on);
resize();
document.fonts && Promise.all([document.fonts.load('900 40px Rubik', 'אב'), document.fonts.load('700 40px Fredoka', 'אבג')]).catch(() => {});
showStart();
requestAnimationFrame(frame);
