// 61 – רוב קואליציוני: Stack in Rabbi Demokratovich's court-synagogue. A party slab slides over the tower; tap to drop
// it. What hangs over is cut off (and its seats with it), the tower narrows. A perfect drop keeps everything; 3 in a row
// = "הרכב מורחב" (the slab grows back). 61 seats = a government, then on to 120 (כנסת שלמה). A miss = the coalition
// falls. The Rabbanit calls with a poll now and then: the slabs slide faster for a few drops. The rabbi is the real 3D
// figure from the verse's residents (assets/rabbi.glb), reacting with his own gestures.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SLUG = 'sixty-one';
const KEY = { best: `shlomiverse:${SLUG}:best`, day: `shlomiverse:${SLUG}:day`, tut: `shlomiverse:${SLUG}:tut`, snd: `shlomiverse:${SLUG}:snd` };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
function pickNo(list, key) { const last = pickNo[key]; let l = pick(list); if (list.length > 1 && l === last) l = list[(list.indexOf(l) + 1) % list.length]; pickNo[key] = l; return l; }

// ───────────────────────── the parties - the real Knesset after the 27 Oct 2026 election ─────────────────────────
// You build Eisenkot's coalition (the change bloc, the rabbi's side: "מה עשיתי למען גוש השינוי?"). Real seats; the
// other bloc must be disqualified (פסול!); the Arab parties support from outside but Liberman walks out over them (and
// over the Haredim); the Haredim are the open question - their slab switches sides while it slides.
const P = {
  yashar: { name: 'ישר!', who: 'איזנקוט', seats: 21, col: '#1e88c9', bloc: 'us' },
  yachad: { name: 'ביחד', who: 'בנט', seats: 12, col: '#3b4fd8', bloc: 'us' },
  dem: { name: 'הדמוקרטים', who: 'גולן', seats: 8, col: '#e0245e', bloc: 'us' },
  ib: { name: 'ישראל ביתנו', who: 'ליברמן', seats: 7, col: '#0aa5b8', bloc: 'us', liberman: true },
  raam: { name: 'רע״ם', who: 'עבאס', seats: 8, col: '#1f9d55', bloc: 'arab' },
  joint: { name: 'הרשימה המשותפת', who: 'ג׳בארין', seats: 11, col: '#c62828', bloc: 'arab' },
  utj: { name: 'יהדות התורה', who: 'אשר', seats: 7, col: '#3d3d47', bloc: 'haredi', ours: 0.66 },
  shas: { name: 'ש״ס', who: 'דרעי', seats: 6, col: '#1d6f8a', bloc: 'haredi', ours: 0.45 },
  likud: { name: 'הליכוד', who: 'נתניהו', seats: 27, col: '#1b3a8f', bloc: 'them' },
  otzma: { name: 'עוצמה יהודית', who: 'בן גביר', seats: 7, col: '#e07b12', bloc: 'them' },
  rz: { name: 'הציונות הדתית', who: 'סמוטריץ׳', seats: 6, col: '#2f6b3a', bloc: 'them' },
};
for (const [id, v] of Object.entries(P)) v.id = id;
const THEM_LOOK = { name: 'גוש נתניהו', col: '#1b3a8f' };
const MAXSEATS = 73;                       // 48 + 19 + 13 - Liberman's 7 (he can't sit with them)
function split(n, r) { const out = []; while (n > 0) { let k = Math.min(n, 2 + Math.floor(r() * 4)); if (n - k === 1) k = n - k === 1 && k > 2 ? k - 1 : k + 1; k = Math.min(k, n); out.push(k); n -= k; } return out; }
function makeQueue(r) {
  const own = [], arab = [], them = [];
  for (const id of ['yashar', 'yachad', 'dem', 'ib']) for (const k of split(P[id].seats, r)) own.push({ p: P[id], seats: k });
  for (const id of ['raam', 'joint']) for (const k of split(P[id].seats, r)) arab.push({ p: P[id], seats: k });
  const likudChunks = [6, 7, 7, 7], th = [...likudChunks.map((k) => ({ p: P.likud, seats: k })), { p: P.otzma, seats: 4 }, { p: P.otzma, seats: 3 }, { p: P.rz, seats: 3 }, { p: P.rz, seats: 3 }];
  const sh = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  sh(own); sh(arab); sh(th);
  // the opening: three of ours (Yashar first), then everything mixed; the Haredim and the Arabs from the middle on
  const yi = own.findIndex((x) => x.p.id === 'yashar'); const first = own.splice(yi, 1)[0];
  const head = [first, own.shift(), own.shift()];
  const rest = sh([...own, ...arab, ...th, { p: P.utj, seats: 7 }, { p: P.shas, seats: 6 }]);
  // no two of theirs in a row, and the Haredim not before slab 6
  for (let i = 1; i < rest.length; i++) if (rest[i].p.bloc === 'them' && rest[i - 1].p.bloc === 'them') { const j = rest.findIndex((x, k) => k > i && x.p.bloc !== 'them'); if (j > 0) [rest[i], rest[j]] = [rest[j], rest[i]]; }
  for (let i = 0; i < 3 && i < rest.length; i++) if (rest[i].p.bloc === 'haredi') { const j = rest.length - 1 - i; [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...head, ...rest];
}
const TUT_QUEUE = [{ p: P.yashar, seats: 4 }, { p: P.yachad, seats: 3 }, { p: P.likud, seats: 7 }, { p: P.utj, seats: 7 }, { p: P.dem, seats: 3 }, { p: P.raam, seats: 4 }, { p: P.yashar, seats: 5 }, { p: P.yachad, seats: 4 }, { p: P.dem, seats: 3 }, { p: P.yashar, seats: 4 }];

// ───────────────────────── his lines (his halachic voice, from his profile) ─────────────────────────
const LINES = {
  start: ['טוב, רבותיי. תנן: שישים ואחד – רוב. פחות – בחירות.', 'איתמר: קואליציה בונים מלמטה. נתחיל.', 'ידידיי וחבריי, אזרחי הקהילה – מרכיבים.'],
  perfect: ['ללמדך שאין קואליציה בלא דיוק.', 'הרי זה מכוון כהלכה.', 'שרי! ושרי! ושרי!', 'כמו פסק דין בהרכב מורחב.', 'מכאן שהדיוק – מצווה.'],
  expand: ['הרכב מורחב! השופטים מתרחבים.', 'שלוש ברציפות – חזקה! הרכב מורחב.'],
  small: ['יש לו על מי לסמוך.', 'מנהג בעלמא. ממשיכים.', 'קצת נחתך – אבל הרוב קובע.', 'לא קשיא: הא במרכז, הא בצד.'],
  big: ['רחמנא ליצלן.', 'מיתיבי: והלא חתכת מנדטים!', 'חס ושלום, איבדנו מנדטים.', 'באימה וביראה, ברטט ובזיעה...'],
  veto: ['פסול! כשמועה טמאה.', 'לא מכניסים הביתה את הגוש השני.', 'פסול לעדות – ופסול לקואליציה.', 'שב ואל תעשה – עדיף.'],
  vetoOurs: ['פסלת את שלנו?! מיתיבי: והלא מגוש השינוי הוא!', 'חס ושלום, פסלת מנדטים שלנו.'],
  stunt: ['רחמנא ליצלן! תרגיל מסריח!', 'הגוש השני נכנס – והמגדל יוצא.', 'מיתיבי: והלא אמרתי פסול!'],
  arab: ['תמיכה מבחוץ – שרי. ישיבה בפנים – יש מחלוקת.', 'רע״ם ממליצה מבחוץ. יש לו על מי לסמוך.'],
  libOut: ['ליברמן קם והלך. נחלקו בית ליברמן ובית רע״ם.', 'ליברמן יצא. ״אני לא יושב איתם״ – ואין אנו פוסקים כמותו.'],
  libOutHaredi: ['ליברמן יצא! חוק הגיוס, רבותיי, חוק הגיוס.'],
  libRefuse: ['ליברמן לא נכנס – יש פה מי שהוא לא יושב איתו.'],
  joinUtj: ['יהדות התורה איתנו! בתמורה ל... נו, אתם יודעים.', 'הצטרפו! ייאוש שלא מדעת – הפך לייאוש מדעת.'],
  joinShas: ['ש״ס איתנו?! דרעי חתם – הפעם.', 'ש״ס הצטרפה. מנהג בעלמא – עד הבחירות הבאות.'],
  haredBack: ['חזרו לגוש של נתניהו. הימים שבין כסה לאסון...', 'עם נתניהו! תרגיל! הכל היה פלפול.'],
  haredQ: ['{n} – איתנו או איתם? נחלקו בדבר.', '{n} – שאלה הלכתית פתוחה. תפילו כשהם בצבע שלהם.'],
  impossible: ['אין רוב בלי לשבור הבטחה. הולכים לבחירות.'],
  m30: ['חצי כנסת. אין אנו פוסקים כמותה עדיין.'],
  m50: ['חמישים. הימים שבין כסה לאסון...'],
  gov: ['והלכתא: קמה ממשלה! בברכת הדמוקרטיה ושלטון החוק.'],
  govDone: ['קמה ממשלה! ״כולם שווים בפני החוק״ – ומי שלא, יש בג״ץ.'],
  m90: ['תשעים! ״כולם שווים בפני החוק״ – ומי שלא, יש בג״ץ.'],
  full: ['כנסת שלמה! מאה ועשרים! שתפו לזיכוי הרבים.'],
  ring: ['רגע אחד, זו הרבנית דמוקרטוביץ.'],
  call: ['נו? סקר?! אני לא יכול עכשיו, אני מרכיב קואליציה.', 'נו? מה הסקר אומר? לא, אל תגידי!'],
  hang: ['לא מכניסים הביתה סקרים. ביי ביי ביי ביי ביי.', 'סקר – שמועה טמאה. ביי ביי ביי.'],
  idle: ['ומפני מה אתה מהסס?', 'מנא הני מילי? דכתיב: הקישו.', 'הרבה בציבור לא בקיאים בהלכות הנחה.'],
  lose: ['הולכים לבחירות. הימים שבין כסה לאסון.', 'אין רוב – אין ממשלה. מנהג ישראל – משפט הוא.'],
  fell: ['הממשלה נפלה. אבל הרוב היה – וזה העיקר.', 'נפלה הממשלה. ללמדך שאין דמוקרטיה מתקיימת בלא שופטים.'],
  tutMiss: ['לא נורא – בתרגול לא הולכים לבחירות.'],
};

// ───────────────────────── sound ─────────────────────────
const SFX = ['stamp1', 'stamp2', 'walkout', 'stunt', 'join', 'drop1', 'drop2', 'drop3', 'slice1', 'slice2', 'slice3', 'perfect1', 'perfect2', 'perfect3', 'fall', 'grow', 'ring', 'hangup', 'gavel61', 'collapse', 'milestone', 'click', 'newbest', 'music'];
const SND = { on: store.get(KEY.snd) !== '0', ctx: null, buf: {}, last: {}, loops: {}, master: null };
function decode(n) {
  fetch(`assets/snd/${n}.mp3`).then((r) => r.arrayBuffer()).then((b) => SND.ctx.decodeAudioData(b)).then((d) => { SND.buf[n] = d; if (wantLoops[n]) loop(n, wantLoops[n]); }).catch(() => {});
}
function audioBuild() {
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  SND.buf = {}; SND.loops = {};
  for (const n of SFX) decode(n);
}
function audioUnlock() {             // every tap: iPhone may suspend / interrupt the context
  if (!SND.ctx) audioBuild();
  if (!SND.ctx) return;
  if (SND.ctx.state !== 'running') {
    SND.ctx.resume().catch(() => {});
    try { const b = SND.ctx.createBuffer(1, 1, 22050), s = SND.ctx.createBufferSource(); s.buffer = b; s.connect(SND.ctx.destination); s.start(); } catch (e) {}
    setTimeout(() => { if (SND.ctx && SND.ctx.state !== 'running' && document.visibilityState === 'visible') { try { SND.ctx.close(); } catch (e) {} SND.ctx = null; audioBuild(); } }, 400);
  }
}
addEventListener('pointerdown', audioUnlock, true);
addEventListener('keydown', audioUnlock, true);
function play(name, vol = 1, rate = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || (n.startsWith(name) && /\d$/.test(n) && n.length === name.length + 1)).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rate * (0.97 + Math.random() * 0.06); gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
  return src;
}
const wantLoops = {};
function loop(n, vol) {
  wantLoops[n] = vol;
  const L = SND.loops[n];
  if (!vol) { if (L) { try { L.src.stop(); } catch (e) {} delete SND.loops[n]; } return; }
  if (L) { L.g.gain.value = vol; return; }
  if (!SND.ctx || !SND.buf[n]) return;
  const g = SND.ctx.createGain(); g.gain.value = vol; g.connect(SND.master);
  const src = SND.ctx.createBufferSource(); src.buffer = SND.buf[n]; src.loop = true; src.connect(g); src.start();
  SND.loops[n] = { src, g };
}
let ringSrc = null;
function stopRing() { if (ringSrc) { try { ringSrc.stop(); } catch (e) {} ringSrc = null; } }
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => b.classList.toggle('off', !SND.on)); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = (e) => { e.stopPropagation(); audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (SND.ctx) SND.ctx.suspend(); if (state === 'play') pause(true); } });

// ───────────────────────── three: the tower scene ─────────────────────────
const cv = $('cv');
const PHONE = matchMedia('(hover:none)').matches;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !PHONE, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b4a2e, 1.15));
const sun = new THREE.DirectionalLight(0xffe7c2, 1.9); sun.position.set(4, 9, 6); scene.add(sun); scene.add(sun.target);
// real shadows: the slabs throw them onto each other and onto the room's floor
// no real-time shadows (too heavy for phones): a soft baked shadow sits under the tower instead
sun.castShadow = false; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 40 });
const DIORAMA = { rot: +(new URLSearchParams(location.search).get('rot') ?? 0), width: 10, dx: 0, dz: 0 };
const fill = new THREE.DirectionalLight(0xc9d8ff, 0.5); fill.position.set(-6, 3, -2); scene.add(fill);
const cam = new THREE.OrthographicCamera(-4, 4, 6, -6, 0.1, 200);
const CAMDIR = new THREE.Vector3(1, 0.82, 1).normalize();
const SH = 0.5;                     // slab height
const BASE = 3;                     // the full slab side
let W = innerWidth, H = innerHeight, DPR = 1;
let camY = 0, camYGoal = 0, viewW = 8.6;

function cssPx(v) { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; }
let safeT = 0, safeB = 0;
function layout() {
  W = innerWidth; H = innerHeight; DPR = Math.min(PHONE ? 1.5 : 2, devicePixelRatio || 1);
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  safeT = cssPx('var(--safe-t)'); safeB = H - cssPx('calc(100% - var(--safe-b))') || 0;
  // the tower takes about half the width on a phone; a wide screen keeps the phone's proportions
  const aspect = W / H;
  // a phone: the tower ~ half the width; a wide screen: the same height as a phone sees, the tower in a phone-wide column
  const PA = 0.462, halfH0 = 3.8 / PA;
  let halfW, halfH;
  if (aspect < 0.75) { halfW = 6.7; halfH = halfW / aspect; } else { halfH = halfH0 * 1.15; halfW = halfH * aspect; }
  viewW = halfW * 2; const shift = Math.min(viewW, halfH * 2 * 0.6) * 0.09;   // the tower sits left of centre: the rabbi has the right corner
  cam.left = -halfW + shift; cam.right = halfW + shift; cam.top = halfH; cam.bottom = -halfH; cam.updateProjectionMatrix();
  rabbiLayout(); if (typeof roomCamera === 'function' && DIORAMA.box) roomCamera();
  document.body.classList.toggle('turn', matchMedia('(hover:none)').matches && W > H && H < 520);
}
addEventListener('resize', layout);

// slab labels: a canvas per visible side
// a slab's look: its name, colour, a small tag and whether it carries the other bloc's warning stripes
function lookOf(e, side) {
  const p = e.p;
  if (p.bloc === 'them') return { name: p.name, col: p.col, tag: 'גוש נתניהו', hazard: true };
  if (p.bloc === 'haredi') return side === 'them' ? { name: p.name, col: THEM_LOOK.col, tag: 'עם נתניהו', hazard: true, q: true } : { name: p.name, col: p.col, tag: 'איתנו?', q: true, ours: true };
  if (p.bloc === 'arab') return { name: p.name, col: p.col, tag: 'מבחוץ' };
  return { name: p.name, col: p.col, tag: '' };
}
function labelTex(L, len, seats) {
  const pxu = 150, w = Math.max(32, Math.round(len * pxu)), h = Math.round(SH * pxu);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, shade(L.col, 0.12)); grd.addColorStop(1, shade(L.col, -0.18));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  if (L.hazard) {                       // the other bloc: black-and-amber warning stripes along the bottom edge
    g.save(); g.beginPath(); g.rect(0, h - 13, w, 13); g.clip(); g.fillStyle = '#111'; g.fillRect(0, h - 13, w, 13); g.fillStyle = '#f5b301';
    for (let x = -20; x < w + 20; x += 22) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 11, h); g.lineTo(x + 24, h - 13); g.lineTo(x + 13, h - 13); g.fill(); }
    g.restore();
  }
  g.fillStyle = '#f5c54299'; g.fillRect(0, 0, w, 3); if (!L.hazard) { g.fillStyle = '#00000044'; g.fillRect(0, h - 4, w, 4); }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.shadowColor = '#0009'; g.shadowBlur = 4; g.shadowOffsetY = 2;
  const num = String(seats), cy = L.hazard ? h / 2 - 4 : h / 2 + 2;
  const tries = [L.tag ? `${L.name} ${num} · ${L.tag}` : `${L.name}  ${num}`, `${L.name}  ${num}`, L.name, num];
  let txt = tries[0], fs = 32, i = 0;
  const fit = () => { g.font = `900 ${fs}px Rubik, system-ui, sans-serif`; return g.measureText(txt).width <= w - 14; };
  while (!fit()) { if (fs > 22) fs -= 2; else if (i < tries.length - 1) { txt = tries[++i]; fs = 32; } else { fs = Math.max(14, fs - 2); if (fs === 14) break; } }
  g.fillText(txt, w / 2, cy);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const topCache = {};
function topTex(L) {                    // the top face: a plain colour, warning stripes for the other bloc, a "?" for the Haredim
  const key = L.col + (L.hazard ? 'h' : '') + (L.q ? 'q' : '');
  if (topCache[key]) return topCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = shade(L.col, 0.08); g.fillRect(0, 0, 256, 256);
  if (L.hazard) { g.fillStyle = '#0000002e'; for (let x = -256; x < 512; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22, 0); g.lineTo(x + 22 + 256, 256); g.lineTo(x + 256, 256); g.fill(); } }
  if (L.q) { g.fillStyle = '#ffffffd0'; g.font = '900 150px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 128, 136); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; topCache[key] = t; return t;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = (v) => clamp(Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}
function slabMats(L, w, d, seats) {
  const plain = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.col).multiplyScalar(0.8), roughness: 0.55 });
  const top = new THREE.MeshStandardMaterial({ map: topTex(L), roughness: 0.45 }); top.userData.shared = true;
  const sx = new THREE.MeshStandardMaterial({ map: labelTex(L, d, seats), roughness: 0.5 });
  const sz = new THREE.MeshStandardMaterial({ map: labelTex(L, w, seats), roughness: 0.5 });
  return [sx, plain, top, plain, sz, plain];
}
function slabMesh(L, w, d, seats) { return new THREE.Mesh(new THREE.BoxGeometry(w, SH, d), slabMats(L, w, d, seats)); }
function disposeMats(ms) { [].concat(ms).forEach((x) => { if (x.map && !x.userData.shared) x.map.dispose(); x.dispose(); }); }
function disposeMesh(m) { m.geometry.dispose(); disposeMats(m.material); if (m.userData.alt) disposeMats(m.userData.alt); }

// the pedestal: a wooden lectern block with the court's name
function pedestal() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#8a4b1f'); grd.addColorStop(1, '#4d260d'); g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,18,4,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 512; g.moveTo(0, y); g.bezierCurveTo(170, y + 8, 340, y - 8, 512, y + 3); g.stroke(); }
  g.strokeStyle = '#e0b04a'; g.lineWidth = 8; g.strokeRect(22, 22, 468, 468);
  g.fillStyle = '#f5c542'; g.direction = 'rtl'; g.textAlign = 'center'; g.font = '900 54px Rubik, system-ui, sans-serif'; g.fillText('שערי בג״ץ', 256, 120);
  g.font = '700 40px Rubik, system-ui, sans-serif'; g.fillText('בית המשפט', 256, 190);
  g.strokeStyle = '#e0b04a88'; g.lineWidth = 4; g.strokeRect(70, 250, 372, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  const topm = new THREE.MeshStandardMaterial({ color: 0x6b3a17, roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(BASE + 0.4, 3.4, BASE + 0.4), [side, side, topm, topm, side, side]);
  m.position.y = -1.7 - SH / 2 - 0.02; scene.add(m);          // its top 2 cm under the first slab (no shared plane = no flicker)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(BASE + 0.6, 0.14, BASE + 0.6), new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.6, roughness: 0.35 }));
  trim.position.y = -SH / 2 - 0.12; scene.add(trim);
  // it stands on the hall's floor: a painted rug under it and a soft contact shadow at its foot
  const floorY = m.position.y - 1.7;
  const rugTex = new THREE.TextureLoader().load('assets/rug.webp'); rugTex.colorSpace = THREE.SRGBColorSpace; rugTex.anisotropy = 4;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), new THREE.MeshStandardMaterial({ map: rugTex, transparent: true, roughness: 0.95, depthWrite: false }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = floorY + 0.004; rug.renderOrder = -2; scene.add(rug);
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(128, 128, 40, 128, 128, 128); rg.addColorStop(0, 'rgba(20,8,0,.7)'); rg.addColorStop(0.55, 'rgba(20,8,0,.35)'); rg.addColorStop(1, 'rgba(20,8,0,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 256, 256);
  const shT = new THREE.CanvasTexture(sc);
  const shd = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), new THREE.MeshBasicMaterial({ map: shT, transparent: true, depthWrite: false }));
  shd.rotation.x = -Math.PI / 2; shd.position.set(-0.35, floorY + 0.01, 0.35); shd.renderOrder = -1; scene.add(shd);          // the gold band sits below the table's top, never level with it
}
// the room: his court-synagogue as a 3D diorama (assets/diorama.glb); the tower stands on its bimah. The old wooden
// pedestal stays only as a fallback while the model loads / if it fails.
const ped = []; { const before = new Set(scene.children); pedestal(); for (const o of scene.children) if (!before.has(o)) ped.push(o); }
let diorama = null;
// loading: both models report their download; the start screen shows one bar and "שחקו" waits for it
const LOAD = { room: 0, rabbi: 0, roomDone: false, rabbiDone: false, ready: false, t0: performance.now() };
const SIZE = { room: 1.25e6, rabbi: 2.35e6 };
function loadProgress() {
  if (LOAD.ready) return;
  const bytes = LOAD.room * 0.4 + LOAD.rabbi * 0.6, creep = 0.9 * (1 - Math.exp(-(performance.now() - LOAD.t0) / 6000));
  const p = LOAD.roomDone && LOAD.rabbiDone ? 1 : Math.max(bytes, creep * (LOAD.roomDone ? 1 : 0.85));
  $('loadBar').firstElementChild.style.width = Math.round(p * 100) + '%';
  $('loadPct').textContent = Math.round(p * 100) + '%';
  // the room is enough to play - the rabbi steps in when he arrives
  if (LOAD.roomDone && !LOAD.ready) {
    LOAD.ready = true;
    try { renderer.compile(scene, cam); } catch (e) {}
    warm = 3;
    setTimeout(() => { $('loadBar').classList.add('done'); $('playBtn').classList.remove('wait'); }, 200);
  }
}
const loadTick = setInterval(() => { if (LOAD.ready) clearInterval(loadTick); else loadProgress(); }, 120);
const prog = (k) => (e) => { if (e && e.loaded) { LOAD[k] = Math.min(0.97, e.loaded / (e.total || SIZE[k] * 0.8)); loadProgress(); } };
let warm = 0;
new GLTFLoader().load('assets/diorama.glb', (g) => {
  LOAD.room = 1; LOAD.roomDone = true;
  const root = g.scene; root.rotation.y = DIORAMA.rot;
  root.traverse((o) => { if (o.isMesh) { [].concat(o.material).forEach((m) => { if (m.map) m.map.anisotropy = 2; }); } });
  const holder = new THREE.Group(); holder.add(root); scene.add(holder);
  let box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3());
  const k = DIORAMA.width / Math.max(size.x, size.z); holder.scale.setScalar(k);
  box = new THREE.Box3().setFromObject(holder); const c = box.getCenter(new THREE.Vector3());
  holder.position.x -= c.x + DIORAMA.dx; holder.position.z -= c.z + DIORAMA.dz;
  holder.updateMatrixWorld(true);
  // find the bimah: sample the room's surface from above; the floor = the most common low height, the bimah = the flat
  // raised patch near the middle. Centre the tower on it and put its top right under the first slab.
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), pts = [];
  for (let x = -4.5; x <= 4.5; x += 0.15) for (let z = -4.5; z <= 4.5; z += 0.15) {
    ray.set(new THREE.Vector3(x, 60, z), down); const h = ray.intersectObject(holder, true)[0]; if (h) pts.push([x, z, h.point.y]);
  }
  const hist = (arr) => { const m = {}; for (const v of arr) { const k = Math.round(v * 20); m[k] = (m[k] || 0) + 1; } return +Object.entries(m).sort((p, q) => q[1] - p[1])[0][0] / 20; };
  const floorY = hist(pts.map((p) => p[2]));
  const raised = pts.filter((p) => p[2] > floorY + 0.12 && p[2] < floorY + 1.2 && Math.hypot(p[0], p[1]) < 3.6);
  let bx = 0, bz = 0, topY = floorY;
  if (raised.length > 20) {
    topY = hist(raised.map((p) => p[2]));
    const flat = raised.filter((p) => Math.abs(p[2] - topY) < 0.06);
    for (const p of flat) { bx += p[0]; bz += p[1]; } bx /= flat.length; bz /= flat.length;
    const xs = flat.map((p) => p[0]), zs = flat.map((p) => p[1]);
    DIORAMA.bimah = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  }
  holder.position.x -= bx; holder.position.z -= bz; holder.position.y += (-SH / 2 - 0.005) - topY;
  DIORAMA.floor = floorY - topY - SH / 2;
  diorama = holder; for (const o of ped) o.visible = false;
  { // the tower's soft shadow on the bimah
    const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const g2 = c2.getContext('2d');
    const r2 = g2.createRadialGradient(64, 64, 18, 64, 64, 64); r2.addColorStop(0, 'rgba(30,10,0,.55)'); r2.addColorStop(1, 'rgba(30,10,0,0)'); g2.fillStyle = r2; g2.fillRect(0, 0, 128, 128);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(BASE * 1.9, BASE * 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, depthWrite: false }));
    bs.rotation.x = -Math.PI / 2; bs.position.set(-0.25, -SH / 2 + 0.004, 0.25); scene.add(bs);
  }
  buildPlinth(holder);
  roomCamera();
  loadProgress();
}, prog('room'), () => { LOAD.room = 1; LOAD.roomDone = true; loadProgress(); });
// the room stands on a tall wooden plinth that runs down out of the picture, with the community's name on its two front faces
function buildPlinth(holder) {
  const box = new THREE.Box3().setFromObject(holder); DIORAMA.box = box;
  // synagogues have very high walls: the room's two back walls carry on far up (painted upper walls, windows, cornice, ceiling edge)
  {
    const ray = new THREE.Raycaster(), mid = (box.min.y + box.max.y) / 2;
    const hitAt = (dir) => { ray.set(new THREE.Vector3(0, mid + 0.6, 0), dir); const h = ray.intersectObject(holder, true).filter((x) => x.distance > 1.5); return h.length ? h[h.length - 1].point : null; };
    const hl = hitAt(new THREE.Vector3(-1, 0, 0)), hr = hitAt(new THREE.Vector3(0, 0, -1));
    const lx = hl ? hl.x : box.min.x + 0.15, rz = hr ? hr.z : box.min.z + 0.15, T = 0.18;
    // the real top of each model wall: a ray straight down just inside it
    const topAt = (x, z) => { ray.set(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObject(holder, true)[0]; return h ? h.point.y : box.max.y; };
    const lTop = topAt(lx - 0.06, (rz + box.max.z) / 2 + 1.2), rTop = topAt((lx + box.max.x) / 2 + 1.2, rz - 0.06);
    const wallTop = Math.min(lTop, rTop) - 0.02;
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a4a1c, roughness: 0.7 });
    // each wall runs from the corner (the other wall's inner face) to the room's front edge - no overlap, no cut windows
    const lw = box.max.z - rz, rw = box.max.x - lx, Hw = Math.max(lw, rw) * 1.45;
    const wallMat = (f, sign) => {                     // the painted upper wall, with an optional carved name board on it
      const c = document.createElement('canvas'); c.width = 768; c.height = 1152; const g = c.getContext('2d');
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
      const img = new Image(); img.onload = () => {
        g.drawImage(img, 0, 0, 768, 1152);
        if (sign) {
          const y = 860, h = 120; g.fillStyle = '#4a230b'; g.fillRect(70, y - 8, 628, h + 16);
          const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#9a5524'); gr.addColorStop(1, '#6a3412'); g.fillStyle = gr; g.fillRect(78, y, 612, h);
          g.strokeStyle = '#e0b04a'; g.lineWidth = 5; g.strokeRect(90, y + 10, 588, h - 20);
          g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
          let fs = 58; g.font = `900 ${fs}px Rubik, system-ui, sans-serif`; while (g.measureText(sign[0]).width > 540) { fs -= 3; g.font = `900 ${fs}px Rubik, system-ui, sans-serif`; }
          g.fillStyle = '#2a1205'; g.fillText(sign[0], 384, y + 44 + 2); g.fillStyle = '#f5cf6a'; g.fillText(sign[0], 384, y + 44);
          g.font = '700 26px Rubik, system-ui, sans-serif'; g.fillStyle = '#f3dfae'; g.fillText(sign[1], 384, y + 92);
        }
        t.needsUpdate = true;
      };
      img.src = f; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
    };
    const L = new THREE.Mesh(new THREE.BoxGeometry(T, Hw, lw), [wallMat('assets/wall-l.webp', ['בית המשפט ״שערי בג״ץ״', 'רב הקהילה: הגאון הרב דמוקרטוביץ שליט״א']), wood, wood, wood, wood, wood]);
    L.position.set(lx - T / 2, wallTop + Hw / 2, (rz + box.max.z) / 2); scene.add(L);
    const Rw = new THREE.Mesh(new THREE.BoxGeometry(rw, Hw, T), [wood, wood, wood, wood, wallMat('assets/wall-r.webp', ['קהילת ״שערי בג״ץ״', 'עמותת ״קופת הקולות״ · שיעור במסכת שלטון ומשפט']), wood]);
    Rw.position.set((lx + box.max.x) / 2, wallTop + Hw / 2, rz - T / 2); scene.add(Rw);
    // a wooden post hides the corner seam
    const post = new THREE.Mesh(new THREE.BoxGeometry(T * 2.2, Hw, T * 2.2), wood); post.position.set(lx - T * 0.6, wallTop + Hw / 2, rz - T * 0.6); scene.add(post);
    DIORAMA.wallTop = wallTop + Hw;
  }
  const wx = box.max.x - box.min.x, wz = box.max.z - box.min.z, Hh = 9;
  const face = (len, lines) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * Hh / len); const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#a85d27'); gr.addColorStop(0.25, '#8a4718'); gr.addColorStop(1, '#4a230b'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(50,20,4,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const y = Math.random() * c.height; g.moveTo(0, y); g.bezierCurveTo(340, y + 10, 680, y - 10, 1024, y + 4); g.stroke(); }
    g.fillStyle = '#d9a23e'; g.fillRect(0, 0, 1024, 14);
    // an engraved brass plaque near the top
    const ph = 250, py = 70; g.fillStyle = '#5a2c0e'; g.fillRect(60, py - 6, 904, ph + 12);
    const pg = g.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#f6d27a'); pg.addColorStop(0.5, '#d7a640'); pg.addColorStop(1, '#a8761f'); g.fillStyle = pg; g.fillRect(66, py, 892, ph);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, fs, y]) => { g.font = `900 ${fs}px Rubik, system-ui, sans-serif`; let f = fs; while (g.measureText(t).width > 840 && f > 30) { f -= 4; g.font = `900 ${f}px Rubik, system-ui, sans-serif`; } g.fillStyle = '#fff3c4'; g.fillText(t, 512, py + y + 2); g.fillStyle = '#4a2208'; g.fillText(t, 512, py + y); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  };
  const plain = new THREE.MeshStandardMaterial({ color: 0x5a2c0e, roughness: 0.8 });
  const left = face(wz, [['בית המשפט ״שערי בג״ץ״', 96, 95], ['רב הקהילה: הגאון הרב דמוקרטוביץ שליט״א', 46, 185]]);
  const right = face(wx, [['קהילת ״שערי בג״ץ״', 96, 95], ['עמותת ״קופת הקולות״ · שיעור במסכת שלטון ומשפט', 42, 185]]);
  const m = new THREE.Mesh(new THREE.BoxGeometry(wx * 0.985, Hh, wz * 0.985), [right, plain, plain, plain, left, plain]);
  m.position.set((box.min.x + box.max.x) / 2, box.min.y - Hh / 2 + 0.02, (box.min.z + box.max.z) / 2); scene.add(m);
}
// where the camera starts: the room's front corner sits low on the screen, near the rabbi's feet; it rises only once the
// tower top would pass ~38% from the top
let camStart = SH - 3;
function roomCamera() {
  if (!DIORAMA.box) return;
  const P = new THREE.Vector3(DIORAMA.box.max.x, DIORAMA.floor, DIORAMA.box.max.z);
  const at = (c) => { cam.position.set(0, c, 0).addScaledVector(CAMDIR, 30); cam.lookAt(0, c, 0); cam.updateMatrixWorld(); const v = P.clone().project(cam); return (1 - v.y) / 2 * H; };
  const y0 = at(0), y1 = at(1), target = H - safeB - RB.h * 0.06;
  camStart = (target - y0) / (y1 - y0);
  if (state === 'menu' || !cur) { camY = camYGoal = Math.max(camStart, camYGoal); }
}
const camFor = (y) => Math.max(camStart, y - camLift());

// ───────────────────────── the rabbi: the verse's 3D resident, in his own little view ─────────────────────────
const rScene = new THREE.Scene();
rScene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a3a20, 1.3));
const rKey = new THREE.DirectionalLight(0xffe2b8, 2.0); rKey.position.set(-1.5, 3, 3); rScene.add(rKey);
const rRim = new THREE.DirectionalLight(0xbcd0ff, 0.9); rRim.position.set(2, 2, -2); rScene.add(rRim);
const rCam = new THREE.PerspectiveCamera(24, 0.7, 0.05, 50);
const RB = { x: 0, y: 0, w: 1, h: 1 };          // his viewport (css px, y from the top)
let rabbi = null;
function rabbiLayout() {
  const w = Math.round(clamp(Math.min(W * 0.34, H * 0.22), 110, 240)), h = Math.round(w * 1.5);
  RB.w = w; RB.h = h; RB.x = W - w - Math.max(0, (W - Math.min(W, H * 0.75)) / 2) + 4; RB.y = H - safeB - h + 6;
  rCam.aspect = w / h; rCam.updateProjectionMatrix();
}
const anim = { mixer: null, base: null, clips: {}, masks: {}, cur: null, idleT: 6 };
new GLTFLoader().load('assets/rabbi.glb', async (g) => {
  LOAD.rabbi = 1;
  const root = g.scene;
  root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; [].concat(o.material).forEach((m) => { m.side = THREE.DoubleSide; }); } });
  // the shared figure has a test sphere in some builds - hide anything that is not skinned
  root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });   // props show only in their gesture
  anim.props = {}; root.traverse((o) => { const m = /^prop_(\w+)/.exec(o.name); if (m) anim.props[m[1]] = o; });
  // size him from his own bones (a skinned mesh's bind box is in another unit): head bone -> about 1.45 high
  root.updateMatrixWorld(true);
  const bone = (re) => { let b = null; root.traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  const hb = bone(/Head$/), fb = bone(/LeftToeBase$/) || bone(/LeftFoot$/), hip = bone(/Hips$/);
  const hp = hb.getWorldPosition(new THREE.Vector3()), fp = fb.getWorldPosition(new THREE.Vector3()), pp = hip.getWorldPosition(new THREE.Vector3());
  const s = 1.45 / Math.max(0.01, hp.y - fp.y + 0.03); root.scale.setScalar(s);
  root.position.set(-pp.x * s, -(fp.y - 0.03) * s, -pp.z * s);
  const holder = new THREE.Group(); holder.add(root); holder.rotation.y = -0.45; rScene.add(holder);
  // a soft shadow under his shoes
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 4, 64, 64, 62); rg.addColorStop(0, 'rgba(0,0,0,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.005; rScene.add(sh);
  { // his little round wooden stand (the same wood as the room)
    const wc = document.createElement('canvas'); wc.width = 512; wc.height = 128; const wg = wc.getContext('2d');
    const gr = wg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#b4652a'); gr.addColorStop(1, '#6e3712'); wg.fillStyle = gr; wg.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 60; i++) { wg.strokeStyle = `rgba(60,25,5,${0.1 + Math.random() * 0.15})`; wg.lineWidth = 1 + Math.random() * 2; wg.beginPath(); const y = Math.random() * 128; wg.moveTo(0, y); wg.bezierCurveTo(170, y + 4, 340, y - 4, 512, y + 2); wg.stroke(); }
    wg.fillStyle = '#e0a83a'; wg.fillRect(0, 0, 512, 10); wg.fillRect(0, 118, 512, 10);
    const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = THREE.RepeatWrapping; wt.repeat.x = 3;
    const topm = new THREE.MeshStandardMaterial({ color: 0xa65a24, roughness: 0.6 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.22, 48), [new THREE.MeshStandardMaterial({ map: wt, roughness: 0.6 }), topm, topm]);
    stand.position.y = -0.11; rScene.add(stand);
    const sc2 = document.createElement('canvas'); sc2.width = sc2.height = 128; const sg2 = sc2.getContext('2d');
    const rg2 = sg2.createRadialGradient(64, 64, 20, 64, 64, 64); rg2.addColorStop(0, 'rgba(40,15,0,.55)'); rg2.addColorStop(1, 'rgba(40,15,0,0)'); sg2.fillStyle = rg2; sg2.fillRect(0, 0, 128, 128);
    const gsh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc2), transparent: true, depthWrite: false }));
    gsh.rotation.x = -Math.PI / 2; gsh.position.y = -0.215; rScene.add(gsh);
  }
  rCam.position.set(0.15, 1.05, 5.4); rCam.lookAt(0.05, 0.86, 0);
  rabbi = { root, holder, head: null };
  root.traverse((o) => { if (o.isBone && /Head$/.test(o.name) && !rabbi.head) rabbi.head = o; });
  anim.mixer = new THREE.AnimationMixer(root);
  for (const c of g.animations) {
    anim.clips[c.name] = c;
    for (const t of c.tracks) if (/Hips\.position$/.test(t.name)) {
      const v = t.values, x0 = hip.position.x, z0 = hip.position.z;
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  }
  let meta = {}; anim.meta = meta;
  try { meta = await (await fetch('assets/rabbi.meta.json')).json(); anim.meta = meta; } catch (e) {}
  const san = (n) => THREE.PropertyBinding.sanitizeNodeName(n);
  const baseClip = anim.clips.idle || g.animations[0];
  for (const [gname, gm] of Object.entries(meta.gestures || {})) {
    if (!anim.clips[gname] || !gm.bones) continue;
    const bones = new Set(gm.bones.map(san));
    const own = (t) => bones.has(t.name.split('.')[0]);
    anim.masks[gname] = {
      clip: new THREE.AnimationClip(gname + '-m', anim.clips[gname].duration, anim.clips[gname].tracks.filter(own)),
      base: new THREE.AnimationClip('base-' + gname, baseClip.duration, baseClip.tracks.filter((t) => !own(t))),
    };
  }
  anim.base = anim.mixer.clipAction(baseClip); anim.base.play();
  LOAD.rabbiDone = true; try { renderer.compile(rScene, rCam); } catch (e) {} loadProgress();
}, prog('rabbi'), () => { LOAD.rabbi = 1; LOAD.rabbiDone = true; loadProgress(); });

// play a gesture (masked over the idle) or a whole-body motion, with a smooth in / out
function act(name) {
  if (!anim.mixer || !anim.clips[name]) return;
  if (anim.cur) endAct(true);
  const m = anim.masks[name];
  const a = anim.mixer.clipAction(m ? m.clip : anim.clips[name]);
  a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(0); a.play();
  let mb = null;
  if (m) { mb = anim.mixer.clipAction(m.base); mb.reset(); mb.play(); mb.time = anim.base.time; mb.setEffectiveWeight(0); }
  const prop = anim.meta && anim.meta.gestures && anim.meta.gestures[name] && anim.meta.gestures[name].prop;
  if (prop && anim.props[prop]) anim.props[prop].visible = true;
  anim.cur = { a, mb, t: 0, dur: (m ? m.clip : anim.clips[name]).duration, prop };
  anim.idleT = 7 + Math.random() * 4;
}
function endAct() { const c = anim.cur; if (!c) return; if (c.prop && anim.props[c.prop]) anim.props[c.prop].visible = false; c.a.stop(); if (c.mb) c.mb.stop(); anim.base.setEffectiveWeight(1); anim.cur = null; }
function animStep(dt) {
  if (!anim.mixer) return;
  const c = anim.cur;
  if (c) {
    c.t += dt;
    const e = clamp(Math.min(c.t / 0.25, (c.dur - c.t) / 0.3), 0, 1);
    c.a.setEffectiveWeight(e); if (c.mb) { c.mb.setEffectiveWeight(e); c.mb.time = anim.base.time; }
    anim.base.setEffectiveWeight(1 - e);
    if (c.t >= c.dur) endAct();
  } else if (state === 'play' && !paused) {
    anim.idleT -= dt;
    if (anim.idleT <= 0) { act(Math.random() < 0.6 ? 'beard_stroke' : pick(['talmud_thumb', 'agree'])); }
  }
  anim.mixer.update(dt);
}

// his bubble, beside his head
const bubble = $('bubble');
let bubbleT = 0;
function say(text, dur = 2.6, cls = '') { bubble.textContent = text; bubble.className = 'on' + (cls ? ' ' + cls : ''); bubbleT = dur; placeBubble(); }
const tmpV = new THREE.Vector3();
function placeBubble() {
  let hx = RB.x + RB.w * 0.45, hy = RB.y + RB.h * 0.2;
  if (rabbi && rabbi.head) {
    rabbi.head.getWorldPosition(tmpV); tmpV.project(rCam);
    hx = RB.x + (tmpV.x + 1) / 2 * RB.w; hy = RB.y + (1 - tmpV.y) / 2 * RB.h;
  }
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  // above his head (the bimah is right beside him - never cover the play), its tail pointing down at him
  const right = clamp(W - (hx + RB.w * 0.3), 6, W - bw - 6);
  bubble.style.right = right + 'px'; bubble.style.left = 'auto';
  bubble.style.top = clamp(hy - RB.h * 0.08 - bh, safeT + 96, H - bh - 6) + 'px';
}

// ───────────────────────── the game ─────────────────────────
let state = 'menu';                 // menu | play | tut | falling | over
let paused = false, tutorial = false;
let tower = [], cur = null, falling = [], rings = [];
let seats = 0, drops = 0, streak = 0, queue = [], qi = 0, R = Math.random;
let poll = { on: false, left: 0, next: 9, t: 0 }, govDone = false, milestones = {};
let hintOn = false, idleTalk = 0, overReason = '', busy = 0;
let timers = [];                    // game-time delays (pause-safe, and the tests can fast-forward them)
function later(sec, fn) { timers.push({ t: sec, fn }); }
function speedNow() {
  if (tutorial) return 1.5;
  return clamp(2.6 + drops * 0.1, 2.6, 6.6) * (poll.on ? 1.45 : 1);
}
function topSlab() { return tower[tower.length - 1]; }
function clearScene() {
  for (const s of tower) if (s.mesh) { scene.remove(s.mesh); disposeMesh(s.mesh); }
  for (const f of falling) { scene.remove(f.mesh); disposeMesh(f.mesh); }
  for (const r of rings) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
  if (cur) { scene.remove(cur.mesh); disposeMesh(cur.mesh); }
  tower = []; falling = []; rings = []; cur = null;
}
function reset(seed) {
  clearScene(); timers = [];
  tower = [{ x: 0, z: 0, w: BASE, d: BASE, y: -SH, mesh: null }];
  seats = 0; drops = 0; streak = 0; qi = 0; govDone = false; milestones = {}; busy = 0;
  R = rng(seed); queue = seed === 'tutorial' ? TUT_QUEUE.map((e) => ({ ...e })) : makeQueue(R);
  poll = { on: false, left: 0, next: 7 + Math.floor(R() * 4), t: 0 };
  camY = camYGoal = camFor(SH); stopRing();
  spawn(); hud();
}
function camLift() { const halfH = (cam.top - cam.bottom) / 2; return 0.12 * 2 * halfH / 0.866; }
const inTower = (f) => tower.filter((s) => s.e && f(s));
const hasLib = () => inTower((s) => s.e.p.liberman).length > 0;
const hasLibFoe = () => inTower((s) => s.e.p.bloc === 'arab' || s.e.p.bloc === 'haredi').length > 0;
function spawn() {
  if (qi >= queue.length) { if (tutorial) qi = 0; else return finish(seats >= 61 ? 'gov' : 'lose'); }
  const t = topSlab(), e = queue[qi];
  const axis = tower.length % 2 ? 'x' : 'z';
  const mesh = slabMesh(lookOf(e, 'us'), t.w, t.d, e.seats);
  const range = BASE * 1.25 + 0.6;
  cur = { e, axis, w: t.w, d: t.d, x: t.x, z: t.z, y: t.y + SH, dir: 1, range, mesh, side: 'us' };
  if (e.p.bloc === 'haredi') {           // the open question: it switches sides while it slides
    mesh.userData.alt = slabMats(lookOf(e, 'them'), t.w, t.d, e.seats);
    cur.mats = [mesh.material, mesh.userData.alt]; cur.flick = R() * 2; cur.ours = e.p.ours;
    say(pickNo(LINES.haredQ, 'hq').replace('{n}', e.p.name), 2.6);
  }
  cur[axis] = (axis === 'x' ? t.x : t.z) - range;
  mesh.position.set(cur.x, cur.y, cur.z); scene.add(mesh);
  camYGoal = camFor(cur.y);
  nextChip(); vetoGlow();
}
function nextChip() {
  const e = queue[qi + 1];
  if (!e) { $('nextChip').innerHTML = '<span>הסיעה האחרונה!</span>'; return; }
  const tag = { them: '<em class="bad">לפסול!</em>', haredi: '<em class="q">?</em>', arab: '<em>מבחוץ</em>', us: '' }[e.p.bloc];
  $('nextChip').innerHTML = `<small>הבא:</small><i style="background:${e.p.col}"></i><span>${e.p.name}</span><b>${e.seats}</b>${tag}`;
}
function vetoGlow() { $('vetoBtn').classList.toggle('glow', !!cur && (cur.e.p.bloc === 'them' || (cur.e.p.bloc === 'haredi' && cur.side === 'them'))); }
// what a landing means, before the cut: 'stunt' (the other bloc got in), 'refuse' (Liberman won't sit) or 'join'
function verdict(c) {
  const b = c.e.p.bloc;
  if (b === 'them' || (b === 'haredi' && c.side === 'them')) return 'stunt';
  if (c.e.p.liberman && hasLibFoe()) return 'refuse';
  return 'join';
}
function drop() {
  if (!cur || paused || busy > 0) return;
  if (state !== 'play' && !(state === 'tut' && tutCanDrop('drop'))) return;
  const t = topSlab(), a = cur.axis, size = a === 'x' ? cur.w : cur.d, delta = cur[a] - t[a];
  hint(false); idleTalk = 0;
  const over = Math.abs(delta), keep = size - over;
  const v = verdict(cur);
  if (keep <= 0.02) { if (v === 'stunt') return dismiss(); return miss(); }   // the other bloc beside the tower = harmless
  if (v === 'stunt') return stunt();
  if (v === 'refuse') return refuse();
  let newSize = keep, center = t[a] + delta / 2, perfect = false;
  if (over < 0.08) { perfect = true; newSize = size; center = t[a]; }
  const L = lookOf(cur.e, 'us');
  if (!perfect) {                                               // the cut piece falls: MKs who defected
    const cutW = a === 'x' ? over : cur.w, cutD = a === 'z' ? over : cur.d;
    const cm = slabMesh(L, cutW, cutD, cur.e.seats);
    const cpos = { x: cur.x, z: cur.z }; cpos[a] = center + Math.sign(delta) * (newSize / 2 + over / 2);
    cm.position.set(cpos.x, cur.y, cpos.z); scene.add(cm);
    falling.push({ mesh: cm, vy: 0, vx: a === 'x' ? Math.sign(delta) * 1.2 : 0, vz: a === 'z' ? Math.sign(delta) * 1.2 : 0, rx: (Math.random() - .5) * 3, rz: (Math.random() - .5) * 3 });
  }
  streak = perfect ? streak + 1 : 0;
  let grew = false;
  if (perfect && streak >= 3 && newSize < BASE - 0.01) { newSize = Math.min(BASE, newSize + 0.25); grew = true; }
  const frac = clamp(keep / size, 0, 1);
  // seats defect only on a real cut: a near miss keeps them all, a cut past a quarter costs one, past half - the cut share
  const gained = perfect || frac >= 0.75 ? cur.e.seats : frac >= 0.5 ? Math.max(1, cur.e.seats - 1) : Math.max(1, Math.round(cur.e.seats * frac));
  scene.remove(cur.mesh); disposeMesh(cur.mesh);
  const nw = a === 'x' ? newSize : cur.w, nd = a === 'z' ? newSize : cur.d;
  const s = { x: cur.x, z: cur.z, w: nw, d: nd, y: cur.y, e: cur.e, seats: gained };
  s[a] = center;
  s.mesh = slabMesh(L, nw, nd, gained); s.mesh.position.set(s.x, s.y, s.z); scene.add(s.mesh);
  s.bounce = 1; tower.push(s);
  const before = seats;
  if (!tutorial) seats += gained;
  drops++; qi++;
  const e = cur.e, sp = toScreen(s.x, s.y + SH, s.z);
  cur = null;
  let talked = false;
  if (e.p.bloc === 'haredi') { play('join', 0.8); banner(`${e.p.name} הצטרפה!<small>החרדים בקואליציה</small>`); say(pickNo(e.p.id === 'utj' ? LINES.joinUtj : LINES.joinShas, 'jh'), 3, 'gold'); act('clap'); talked = true; }
  if (e.p.bloc === 'arab') { say(pickNo(LINES.arab, 'ar'), 2.8); act('talmud_thumb'); talked = true; }
  if (perfect) {
    play('perfect', 0.7, 1 + Math.min(streak - 1, 6) * 0.06); play('drop', 0.5);
    ringFx(s); popAt(sp, `${e.p.name} +${gained}`, 'gold');
    if (grew) { play('grow', 0.7); if (!talked) { banner('הרכב מורחב!<small>הסיעה גדלה בחזרה</small>'); say(pickNo(LINES.expand, 'ex'), 2.4, 'gold'); act('clap'); } }
    else if (!talked && (Math.random() < 0.5 || streak === 2)) { say(pickNo(LINES.perfect, 'pf'), 2.2, 'gold'); act(Math.random() < 0.7 ? 'lilmodcha' : 'agree'); }
  } else {
    play('drop', 0.75); play('slice', 0.6);
    const lost = e.seats - gained;
    popAt(sp, `${e.p.name} +${gained}` + (lost ? `  (−${lost} ערקו)` : ''), lost >= 2 ? 'bad' : '');
    if (!talked && frac < 0.6) { say(pickNo(LINES.big, 'bg'), 2.4, 'loud'); act('rachmana'); }
    else if (!talked && Math.random() < 0.3) { say(pickNo(LINES.small, 'sm'), 2.2); if (Math.random() < 0.5) act('talmud_thumb'); }
  }
  // Liberman can't sit with the Arab parties or the Haredim: he walks out (his slabs fly off the tower)
  if ((e.p.bloc === 'arab' || e.p.bloc === 'haredi') && hasLib()) { busy++; later(0.8, () => { busy--; libWalkout(e.p.bloc); }); }
  if (!tutorial) milestonesCheck(before);
  pollStepMaybe();
  if (tutorial) tutDid('drop');
  if (state === 'over') return;
  next();
}
function next() {
  hud();
  if (!tutorial && checkHopeless()) return;
  if (busy > 0) { later(0.12, next); return; }
  if (!cur && (state === 'play' || state === 'tut')) spawn();
}
function remainingPossible() {
  let n = seats; const foeIn = hasLibFoe();
  for (let i = qi; i < queue.length; i++) { const p = queue[i].p; if (p.bloc === 'them') continue; if (p.liberman && foeIn) continue; n += queue[i].seats; }
  return n;
}
function checkHopeless() {
  if (seats >= 61 || state !== 'play') return false;
  if (remainingPossible() < 61) {
    state = 'falling'; if (cur) { scene.remove(cur.mesh); disposeMesh(cur.mesh); cur = null; }
    say(LINES.impossible[0], 3.2, 'loud'); act('frustrated_01'); play('collapse', 0.5);
    later(1.9, () => finish('lose', 'hopeless')); return true;
  }
  return false;
}
// the other bloc landed (or the Haredim landed on Netanyahu's colour): a stunt - it and the two slabs under it blow off
function stunt() {
  const c = cur; cur = null; busy++;
  const e = c.e; streak = 0; drops++; qi++;
  play('stunt', 0.8); flash(true);
  if (e.p.bloc === 'haredi') { banner(`${e.p.name} חזרה לנתניהו!<small>תרגיל!</small>`); say(pickNo(LINES.haredBack, 'hb'), 3, 'loud'); }
  else { banner(`תרגיל מסריח!<small>${e.p.name} נכנסה – והפילה סיעה</small>`); say(pickNo(LINES.stunt, 'stn'), 2.8, 'loud'); }
  act('rachmana');
  c.mesh.position.y = c.y;
  later(0.45, () => {
    falling.push({ mesh: c.mesh, vy: 4, vx: (Math.random() - .5) * 4, vz: (Math.random() - .5) * 4, rx: 5, rz: 4 });
    const victims = tower.slice(1).slice(-1);
    let lost = 0; for (const v of victims) lost += v.seats;
    removeSlabs(victims);
    if (!tutorial) seats = Math.max(0, seats - lost);
    if (lost) popAt(toScreen(topSlab().x, topSlab().y + SH, topSlab().z), `−${lost} מנדטים`, 'bad');
    if (tutorial) tutDid('stunt');
    busy--; next();
  });
  pollStepMaybe();
}
function refuse() {                      // Liberman won't sit with them: his slab hops off
  const c = cur; cur = null; drops++; qi++; streak = 0;
  falling.push({ mesh: c.mesh, vy: 6, vx: c.axis === 'x' ? 2 : 0, vz: c.axis === 'z' ? 2 : 0, rx: 2, rz: 3 });
  play('walkout', 0.7); banner('ליברמן לא נכנס!<small>הוא לא יושב עם הערבים והחרדים</small>');
  say(pickNo(LINES.libRefuse, 'lr'), 2.6, 'loud'); act('complain_01');
  pollStepMaybe(); next();
}
function libWalkout(why) {
  const libs = inTower((s) => s.e.p.liberman);
  if (!libs.length || state === 'over') return;
  let lost = 0; for (const v of libs) lost += v.seats;
  play('walkout', 0.8); flash(true);
  banner(`ליברמן קם והלך!<small>−${lost} מנדטים</small>`);
  say(pickNo(why === 'haredi' ? LINES.libOutHaredi : LINES.libOut, 'lo'), 3, 'loud'); act('complain_01');
  removeSlabs(libs);
  if (!tutorial) seats = Math.max(0, seats - lost);
  hud();
}
// pull slabs out of the tower; everything above them settles down
function removeSlabs(list) {
  for (const v of list) {
    const i = tower.indexOf(v); if (i <= 0) continue;
    tower.splice(i, 1);
    falling.push({ mesh: v.mesh, vy: 3, vx: (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 2), vz: (Math.random() - .5) * 3, rx: (Math.random() - .5) * 6, rz: (Math.random() - .5) * 6 });
  }
  for (let i = 1; i < tower.length; i++) { const s = tower[i]; const y = tower[i - 1].y + SH; if (Math.abs(s.y - y) > 1e-4) { s.settleFrom = s.mesh.position.y; s.y = y; s.settle = 0; } }
  if (cur) { cur.y = topSlab().y + SH; cur.mesh.position.y = cur.y; }
  camYGoal = camFor(topSlab().y + SH);
}
// the פסול! button: throw the sliding slab out
function veto(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  if (!cur || paused || busy > 0) return;
  if (state !== 'play' && !(state === 'tut' && tutCanDrop('veto'))) return;
  const c = cur, b = c.e.p.bloc, theirs = b === 'them' || (b === 'haredi' && c.side === 'them');
  cur = null; qi++; hint(false); idleTalk = 0;
  play('stamp', 0.9); stampFx();
  falling.push({ mesh: c.mesh, vy: 9, vx: (Math.random() - .5) * 3, vz: -3, rx: 4, rz: -3 });
  if (theirs) { say(pickNo(LINES.veto, 'vt'), 2.4, 'gold'); act(Math.random() < .6 ? 'lilmodcha' : 'point'); popAt({ x: W / 2, y: H * 0.35 }, `${c.e.p.name} – פסול!`, 'gold'); }
  else { say(pickNo(LINES.vetoOurs, 'vo'), 2.6, 'loud'); act('rachmana'); popAt({ x: W / 2, y: H * 0.35 }, `פסלתם ${c.e.seats} מנדטים שלנו`, 'bad'); }
  if (tutorial) tutDid('veto');
  pollStepMaybe(); next();
}
function pollStepMaybe() { if (!tutorial) pollStep(); }
function milestonesCheck(before) {
  const hit = (n) => before < n && seats >= n && !milestones[n] && (milestones[n] = true);
  if (hit(61)) {
    govDone = true; play('gavel61', 0.9); flash(); banner('והלכתא: קמה ממשלה!<small>61 מנדטים – עכשיו להגדיל את הרוב</small>');
    say(LINES.gov[0], 3.2, 'gold'); act('cheer'); return;
  }
  if (hit(30)) { play('milestone', 0.8); say(LINES.m30[0], 2.6); act('beard_stroke'); }
  if (hit(50)) { play('milestone', 0.8); say(LINES.m50[0], 2.6); }
}
function pollStep() {
  if (poll.on) {
    poll.left--;
    if (poll.left <= 0) { poll.on = false; play('hangup', 0.8); say(pickNo(LINES.hang, 'hg'), 2.8); $('pollChip').hidden = true; poll.next = drops + 8 + Math.floor(R() * 4); }
    return;
  }
  if (drops >= poll.next) startPoll();
}
function startPoll() {
  poll.on = true; poll.left = 4;
  stopRing(); ringSrc = play('ring', 0.55);
  say(LINES.ring[0], 1.8); act('phone_call');
  later(1.6, () => { if (poll.on && state !== 'over') { stopRing(); say(pickNo(LINES.call, 'cl'), 2.6); } });
  $('pollChip').hidden = false;
}
function dismiss() {                     // the other bloc dropped beside the tower: gone, no harm
  const c = cur; cur = null; qi++;
  falling.push({ mesh: c.mesh, vy: 0, vx: c.axis === 'x' ? 1.5 : 0, vz: c.axis === 'z' ? 1.5 : 0, rx: 3, rz: 2 });
  play('fall', 0.6); say('נפלו מחוץ למגדל. גם זו דרך לפסול.', 2.2);
  if (tutorial) tutDid('veto');
  pollStepMaybe(); next();
}
function miss() {
  const c = cur; cur = null;
  falling.push({ mesh: c.mesh, vy: 0, vx: c.axis === 'x' ? Math.sign(c[c.axis] - topSlab()[c.axis]) * 1.5 : 0, vz: c.axis === 'z' ? Math.sign(c[c.axis] - topSlab()[c.axis]) * 1.5 : 0, rx: (Math.random() - .5) * 4, rz: (Math.random() - .5) * 4 });
  play('fall', 0.8); streak = 0;
  if (tutorial) { say(LINES.tutMiss[0], 2.4); later(0.7, () => { if (state === 'tut' && !cur) spawn(); }); return; }
  state = 'falling'; stopRing(); $('pollChip').hidden = true; poll.on = false;
  flash(true); play('collapse', 0.7);
  if (seats < 61) { say(pickNo(LINES.lose, 'ls'), 3.2, 'loud'); act('frustrated_01'); }
  else { say(pickNo(LINES.fell, 'fl'), 3.2, 'loud'); act('rachmana'); }
  later(1.7, () => finish(seats >= 61 ? 'fell' : 'lose'));
}
function stampFx() { const d = document.createElement('div'); d.className = 'stampfx'; d.textContent = 'פסול!'; fxEl.appendChild(d); setTimeout(() => d.remove(), 900); }

// ───────────────────────── fx ─────────────────────────
const fxEl = $('fx');
function toScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }
function popAt(p, text, cls) { const d = document.createElement('div'); d.className = 'pop' + (cls ? ' ' + cls : ''); d.textContent = text; d.style.top = clamp(p.y - 30, safeT + 90, H - 120) + 'px'; fxEl.appendChild(d); const w = d.offsetWidth; d.style.left = clamp(p.x, w / 2 + 6, W - w / 2 - 6) + 'px'; setTimeout(() => d.remove(), 1100); }
function banner(html) { fxEl.querySelectorAll('.banner').forEach((b) => b.remove()); const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = html; fxEl.appendChild(b); setTimeout(() => b.remove(), 1800); }
function flash(red) { const f = document.createElement('div'); f.className = 'flash' + (red ? ' red' : ''); fxEl.appendChild(f); setTimeout(() => f.remove(), 400); }
function ringFx(s) {
  const g = new THREE.RingGeometry(0.5, 0.62, 48); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(s.x, s.y + SH / 2 + 0.01, s.z); scene.add(m); rings.push({ mesh: m, t: 0, k: Math.max(s.w, s.d) });
}
function hint(on, text) { hintOn = on; if (text) $('hint').textContent = text; $('hint').classList.toggle('on', on); }

// ───────────────────────── HUD + screens ─────────────────────────
function best() { return +store.get(KEY.best) || 0; }
function dayBest() { const v = (store.get(KEY.day) || '').split('|'); return v[0] === today() ? +v[1] || 0 : 0; }
function hud() {
  $('seatNum').textContent = `${tutorial ? 0 : seats} / 61`;
  $('seatBar').style.width = (clamp(seats / MAXSEATS, 0, 1) * 100) + '%';
  $('seatGoal').style.right = (5.5 + 89 * 61 / MAXSEATS) + '%';
  $('seatBox').classList.toggle('gov', seats >= 61);
  $('bestNum').textContent = dayBest();
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('hud').classList.toggle('on', on); $('nextRow').classList.toggle('on', on); $('vetoBtn').classList.toggle('on', on); }
function showBest() {
  const b = dayBest(), all = best();
  $('bestStart').innerHTML = `<span><small>השיא שלכם היום</small><b>${b} מנדטים</b></span>`;
  if (!all) $('bestStart').innerHTML = `<span><small>היעד</small><b>61 מנדטים</b></span>`;
  fitWords();
}
function startGame() {
  tutorial = false; paused = false; show(null); showHUD(true); bubble.className = '';
  reset(`${SLUG}|${today()}`);
  state = 'play'; hint(true, 'הקישו כדי להפיל');
  window.track && window.track('game_start', SLUG);
  loop('music', 0.32);
  setTimeout(() => { if (state === 'play') { say(pickNo(LINES.start, 'st'), 3); act('greet_01'); } }, 300);
}
function finish(reason) {
  if (state === 'over') return;
  state = 'over'; overReason = reason; cur && (scene.remove(cur.mesh), disposeMesh(cur.mesh), cur = null);
  hint(false); stopRing(); $('pollChip').hidden = true; fxEl.querySelectorAll('.banner,.pop').forEach((b) => b.remove());
  const prevBest = best(), prevDay = dayBest();
  if (seats > prevBest) store.set(KEY.best, seats);
  if (seats > prevDay) store.set(KEY.day, `${today()}|${seats}`);
  window.track && window.track('game_over', SLUG);
  if (seats > 0) window.VerseFrame && window.VerseFrame.score(seats);
  const heads = { lose: 'הולכים לבחירות!', fell: 'הממשלה נפלה', gov: 'קמה ממשלה!' };
  $('overH').textContent = heads[reason];
  $('overLine').textContent = reason === 'gov' ? LINES.govDone[0] : reason === 'fell' ? `${seats} מנדטים – והייתה ממשלה. ללמדך שגם ממשלה צריכה מגדל ישר.` : `${seats} מנדטים. חסרו ${61 - seats} לרוב. הימים שבין כסה לאסון...`;
  $('overScore').innerHTML = `${seats}<small>מנדטים</small>`;
  // the coalition you built, party by party
  const by = {}; for (const t of tower) if (t.e && t.seats) by[t.e.p.id] = (by[t.e.p.id] || 0) + t.seats;
  $('overCoal').innerHTML = Object.keys(by).length ? Object.entries(by).sort((x, y) => y[1] - x[1]).map(([id, n]) => `<span><i style="background:${P[id].col}"></i>${P[id].name} <b>${n}</b></span>`).join('') : '';
  $('overRec').innerHTML = seats > prevDay && seats > 0 ? '<span class="newrec">שיא יומי חדש!</span>' : '';
  $('bestOver').innerHTML = `השיא שלכם היום: <b>${Math.max(seats, prevDay)}</b> מנדטים`;
  if (reason === 'gov') { play('gavel61', 0.9); act('cheer'); }
  if (seats > prevDay && seats > 0) setTimeout(() => play('newbest', 0.6), 500);
  setTimeout(() => { showHUD(false); show('over'); hud(); }, reason === 'gov' ? 1600 : 200);
}
function toMenu() {
  state = 'menu'; paused = false; tutorial = false; tut.on = false; $('tutCard').classList.remove('on'); $('tutDim').classList.remove('on');
  showHUD(false); hint(false); bubble.className = ''; stopRing(); $('pollChip').hidden = true;
  clearScene(); tower = [{ x: 0, z: 0, w: BASE, d: BASE, y: -SH }]; camY = camYGoal = camFor(SH);
  loop('music', 0); show('start'); showBest();
}
function pause(on) {
  if (on && state !== 'play') return;
  paused = on; show(on ? 'paused' : null);
  if (SND.master) SND.master.gain.value = on ? 0 : (SND.on ? 1 : 0);
  if (!on) lastT = performance.now();
}
$('playBtn').onclick = () => { if (!LOAD.ready) return; play('click', 0.6); if (store.get(KEY.tut)) startGame(); else tut.begin(); };
$('howBtn').onclick = () => { if (!LOAD.ready) return; play('click', 0.6); tut.begin(); };
$('againBtn').onclick = () => { play('click', 0.6); startGame(); };
$('menuBtn').onclick = () => { play('click', 0.6); toMenu(); };
$('pauseBtn').onclick = (e) => { e.stopPropagation(); pause(true); };
$('resumeBtn').onclick = () => pause(false);
$('quitBtn').onclick = () => { finishQuiet(); toMenu(); };
function finishQuiet() { stopRing(); }
// a tap anywhere drops (not on the HUD / the cards)
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
$('vetoBtn').addEventListener('pointerdown', veto);
$('hall').addEventListener('pointerdown', () => drop());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paused) return pause(false);
  if (tut.on) {
    if (e.key === 'x' || e.key === 'X' || e.key === 'ArrowUp' || e.key === 'Backspace') { e.preventDefault(); return veto(); }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (tutWait && !tutWait.done) drop(); else tut.next(); }
    if (e.key === 'Escape') tut.end();
    return;
  }
  if (e.key === 'Escape' && state === 'play') return pause(true);
  if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') && state === 'play') { e.preventDefault(); drop(); }
  if ((e.key === 'x' || e.key === 'X' || e.key === 'ArrowUp' || e.key === 'Backspace') && state === 'play') { e.preventDefault(); veto(); }
});

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return r.width ? { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } : null; };
const spotRabbi = () => ({ x: RB.x + RB.w * 0.15, y: RB.y + RB.h * 0.05, w: RB.w * 0.75, h: RB.h * 0.95 });
const spotTop = () => { const t = topSlab(); const p = toScreen(t.x, t.y, t.z); return { x: p.x - W * 0.3, y: p.y - H * 0.12, w: W * 0.6, h: H * 0.2 }; };
const STEPS = [
  { text: 'זה <b>הרב דמוקרטוביץ</b>, רב קהילת ״שערי בג״ץ״. הוא מרכיב את הקואליציה של <b>גוש השינוי</b> – ואתם בונים לו אותה.', spot: spotRabbi, say: 'טוב, רבותיי. תנן: שישים ואחד – רוב.' },
  { text: '<b>המטרה: 61 מנדטים.</b> כל סיעה שנכנסת למגדל מוסיפה את המנדטים האמיתיים שלה מהבחירות.', spot: spotEl('seatBox') },
  { text: '<b>ישר!</b> זזה מעל המגדל. <b>הקישו בכל מקום</b> כדי להפיל אותה. <b>נסו עכשיו!</b>', try: 'drop', hint: 'הקישו כדי להפיל' },
  { text: 'מה שבולט מחוץ למגדל – <b>נחתך ונופל</b>: חברי כנסת שערקו. המנדטים האלה הולכים לאיבוד.', spot: spotTop },
  { text: '<b>הנחה מדויקת</b> = כל המנדטים. 3 מדויקות ברצף = <b>הרכב מורחב</b>. <b>הפילו את ביחד!</b>', try: 'drop', hint: 'הקישו כדי להפיל' },
  { text: '<b>הליכוד – מהגוש השני</b> (פסים שחורים-צהובים). אל תפילו אותו! לחצו <b>פסול!</b> והוא עף.', try: 'veto', hint: 'לחצו פסול!', spotBtn: true },
  { text: '<b>החרדים – השאלה הגדולה.</b> הסיעה מחליפה צבע: בצבע שלה – <b>מצטרפת</b>. בכחול-פסים של נתניהו – <b>תרגיל</b>. הפילו בזמן, או פסלו.', try: 'any', hint: 'הפילו בצבע שלה' },
  { text: '<b>רע״ם והמשותפת</b> – תמיכה מבחוץ. אבל <b>ליברמן</b> לא יושב איתן, וגם לא עם החרדים: הן נכנסות – הוא קם והולך.', spot: spotEl('nextChip') },
  { text: 'לפעמים <b>הרבנית מתקשרת עם סקר.</b> הרב עונה – והסיעות זזות <b>מהר יותר</b> לכמה הנחות.', setup: 'poll', spot: spotEl('pollChip') },
  { text: '<b>סיעה שלנו שמפספסת את המגדל</b> – הקואליציה נופלת. נגמרו הסיעות מתחת ל-61 – בחירות. מוכנים?', last: true },
];
function tutCanDrop(kind) { return !!(tutWait && !tutWait.done && (tutWait.id === kind || tutWait.id === 'any')); }
function tutDid(id) { if (tutWait && (tutWait.id === id || tutWait.id === 'any') && !tutWait.done) tutWait.done = true; }
const tut = {
  on: false, i: 0,
  begin() {
    show(null); showHUD(true); tutorial = true; this.on = true; this.i = 0; paused = false;
    reset('tutorial'); state = 'tut'; hint(false); bubble.className = '';
    loop('music', 0.25);
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false } : null;
    $('pollChip').hidden = s.setup !== 'poll';
    if (s.setup === 'poll') { stopRing(); ringSrc = play('ring', 0.45); act('phone_call'); say(LINES.ring[0], 2.2); setTimeout(stopRing, 1500); }
    if (s.say) { say(s.say, 3); act('greet_01'); }
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').querySelector('span').textContent = s.last ? 'שחקו!' : 'הבא';
    hint(!!s.try, s.hint);
  },
  next() {
    if (tutWait && !tutWait.done) return;
    play('click', 0.5);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end() {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on'); $('pollChip').hidden = true; stopRing();
    store.set(KEY.tut, '1'); tutorial = false; startGame();
  },
  frame() {
    if (!this.on) return;
    const s = STEPS[this.i], sp = s.spot && s.spot();
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card never covers its spotlight: right under a high spot, at the top for a low spot (the rabbi), at the bottom
    // for the middle (the tower)
    if (sp && sp.y < H * 0.3) { tutCard.style.top = Math.round(sp.y + sp.h + 14) + 'px'; tutCard.style.bottom = 'auto'; }
    else if (sp && sp.y > H * 0.5) { tutCard.style.top = `calc(var(--safe-t) + 96px)`; tutCard.style.bottom = 'auto'; }
    else if (sp) { tutCard.style.top = 'auto'; tutCard.style.bottom = `calc(var(--safe-b) + 10px)`; }
    else { tutCard.style.top = `calc(var(--safe-t) + 96px)`; tutCard.style.bottom = 'auto'; }
    if (H < 520) { tutCard.style.top = 'auto'; tutCard.style.bottom = `calc(var(--safe-b) + 6px)`; }
    if (tutWait && !tutWait.done && H >= 520) { tutCard.style.top = `calc(var(--safe-t) + 4px)`; tutCard.style.bottom = 'auto'; }   // trying: over the HUD, the slab stays in sight
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; hint(false); }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = (e) => { e.stopPropagation(); tut.next(); };
$('tutSkip').onclick = (e) => { e.stopPropagation(); tut.end(); };

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function step(dt) {
  if (timers.length) { const due = []; timers = timers.filter((x) => { x.t -= dt; if (x.t <= 0) { due.push(x); return false; } return true; }); for (const x of due) x.fn(); }
  if (cur && (state === 'play' || state === 'tut')) {
    const sp = speedNow();
    let p = cur[cur.axis] - topSlab()[cur.axis];
    p += cur.dir * sp * dt;
    if (p > cur.range) { p = cur.range; cur.dir = -1; } else if (p < -cur.range) { p = -cur.range; cur.dir = 1; }
    cur[cur.axis] = topSlab()[cur.axis] + p;
    cur.mesh.position.set(cur.x, cur.y, cur.z);
    if (cur.mats) {                      // the Haredim: our colour part of each 1.7 s, Netanyahu's the rest
      cur.flick += dt; const ph = (cur.flick % 2.2) / 2.2, side = ph < cur.ours ? 'us' : 'them';
      if (side !== cur.side) { cur.side = side; cur.mesh.material = cur.mats[side === 'us' ? 0 : 1]; vetoGlow(); play('click', 0.25, side === 'us' ? 1.2 : 0.8); }
    }
  }
  for (const f of falling) {
    f.vy -= 22 * dt; f.mesh.position.y += f.vy * dt; f.mesh.position.x += f.vx * dt; f.mesh.position.z += f.vz * dt;
    f.mesh.rotation.x += f.rx * dt; f.mesh.rotation.z += f.rz * dt;
  }
  falling = falling.filter((f) => { if (f.mesh.position.y < camY - 16) { scene.remove(f.mesh); disposeMesh(f.mesh); return false; } return true; });
  for (const r of rings) { r.t += dt; const k = (r.k / 1.15) * (1 + r.t * 0.9); r.mesh.scale.set(k, 1, k); r.mesh.material.opacity = Math.max(0, 0.9 - r.t * 1.6); }
  rings = rings.filter((r) => { if (r.t > 0.6) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); return false; } return true; });
  for (const s of tower) {
    if (!s.mesh) continue;
    if (s.settle !== undefined && s.settle < 1) { s.settle = Math.min(1, s.settle + dt * 5); const k = 1 - Math.pow(1 - s.settle, 3); s.mesh.position.y = lerp(s.settleFrom, s.y, k); continue; }
    if (s.bounce) { s.bounce = Math.max(0, s.bounce - dt * 5); s.mesh.position.y = s.y - Math.sin(s.bounce * Math.PI) * 0.06; }
  }
  camY = lerp(camY, camYGoal, 1 - Math.exp(-dt * 4));
  if (state === 'play' && !paused) { idleTalk += dt; if (idleTalk > 9) { idleTalk = -6; say(pickNo(LINES.idle, 'id'), 2.4); } }
  animStep(dt);
}
function render() {
  const t = new THREE.Vector3(0, camY, 0);
  cam.position.copy(t).addScaledVector(CAMDIR, 30); cam.lookAt(t);
  // the hall's picture rises with the tower (floor -> ceiling)
  const rise = clamp((camY - camStart) / 22, 0, 1);
  $('hall').style.setProperty('--rise', rise.toFixed(3));
  sun.position.set(4, camY + 9, 6); sun.target.position.set(0, camY, 0);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear(); renderer.render(scene, cam);
  if (rabbi) {
    renderer.clearDepth(); renderer.setScissorTest(true);
    const y = H - RB.y - RB.h;
    renderer.setViewport(RB.x, y, RB.w, RB.h); renderer.setScissor(RB.x, y, RB.w, RB.h);
    renderer.render(rScene, rCam); renderer.setScissorTest(false);
  }
}
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused && (state !== 'menu' || warm > 0)) step(dt);
  if (bubbleT > 0) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) bubble.classList.remove('on'); }
  tut.frame();
  if (state !== 'menu') render(); else if (warm > 0) { warm--; render(); }   // nothing 3D is drawn behind the menu
  requestAnimationFrame(frame);
}
renderer.autoClear = false;
function fitWords() {
  document.querySelectorAll('.rec span, .sign span').forEach((el) => {
    el.style.fontSize = '';
    for (let k = 0; k < 12 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1); k++) el.style.fontSize = parseFloat(getComputedStyle(el).fontSize) * 0.92 + 'px';
  });
}
addEventListener('resize', fitWords);
layout(); toMenu(); fitWords(); document.fonts && document.fonts.ready.then(() => { fitWords(); }); requestAnimationFrame(frame);

// for the tests
window.SIXTYONE = {
  get state() { return state; }, get seats() { return seats; }, get drops() { return drops; }, get streak() { return streak; },
  get tower() { return tower.map((s) => ({ x: s.x, z: s.z, w: s.w, d: s.d })); }, get poll() { return { ...poll }; },
  get cur() { return cur && { axis: cur.axis, off: cur[cur.axis] - topSlab()[cur.axis], size: cur.axis === 'x' ? cur.w : cur.d, name: cur.e.p.name, seats: cur.e.seats, bloc: cur.e.p.bloc, side: cur.side }; },
  get room() { return !!diorama; }, get ready() { return LOAD.ready; }, roomRot(r) { if (diorama) diorama.children[0].rotation.y = r; },
  get busy() { return busy; }, veto, get queue() { return queue; },
  // a player bot: disqualify the other bloc (and Liberman when he can't sit), wait for the Haredim's colour, drop within `want`
  bot(want = 0.05, opts = {}) {
    for (let i = 0; i < 400 && busy > 0; i++) step(1 / 60);
    if (!cur) return;
    const b = cur.e.p.bloc;
    if (b === 'them' || (cur.e.p.liberman && hasLibFoe()) || (opts.noArab && b === 'arab')) return veto();
    if (b === 'arab' && hasLib() && opts.keepLib) return veto();
    for (let i = 0; i < 6000 && cur; i++) {
      const ok = Math.abs(cur[cur.axis] - topSlab()[cur.axis]) < want && (b !== 'haredi' || cur.side === 'us');
      if (ok && i > 3) break; step(1 / 240);
    }
    drop();
  },
  get tut() { return tut.on; }, get tutStep() { return tut.i; }, get tutTry() { return (STEPS[tut.i] || {}).try; }, get tutDone() { return !!(tutWait && tutWait.done); },
  get rabbi() { return !!rabbi; }, get anim() { return anim.cur ? 'busy' : 'idle'; }, get clips() { return Object.keys(anim.clips); }, get paused() { return paused; },
  get dbg() { if (!rabbi) return null; const out = []; rabbi.root.traverse((o) => { if (o.isMesh) out.push([o.name, o.isSkinnedMesh, o.visible]); }); const b = new THREE.Box3().setFromObject(rabbi.root); return { out, min: b.min.toArray(), max: b.max.toArray(), scale: rabbi.root.scale.x, pos: rabbi.root.position.toArray() }; },
  botDrop(want = 0.05) { for (let i = 0; i < 4000 && cur; i++) { if (Math.abs(cur[cur.axis] - topSlab()[cur.axis]) < want && i > 3) break; step(1 / 240); } drop(); },
  missDrop() { for (let i = 0; i < 4000 && cur; i++) { if (Math.abs(cur[cur.axis] - topSlab()[cur.axis]) > (cur.axis === 'x' ? cur.w : cur.d) + 0.2) break; step(1 / 240); } drop(); },
  tick(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); }, drop, startGame, act, RB,
};
