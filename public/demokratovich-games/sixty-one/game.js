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

// ───────────────────────── the parties (invented - never real ones) ─────────────────────────
const PARTIES = [
  { name: 'בית הימין', col: '#1d4ed8' },
  { name: 'בית השמאל', col: '#c0262d' },
  { name: 'גוש השינוי', col: '#0f8a7e' },
  { name: 'רשימת הפשרה', col: '#d49b0a' },
  { name: 'אחוז החסימה', col: '#7c3aed' },
  { name: 'חזית שלטון החוק', col: '#ea6a0c' },
  { name: 'הפרדת הרשויות', col: '#d63384' },
  { name: 'דעת המיעוט', col: '#178a3e' },
  { name: 'הרכב מורחב', col: '#0b84c6' },
  { name: 'סיעת ההימנעות', col: '#7b8190', zero: true },
];
const SEATS = [2, 3, 3, 4, 4, 4, 5, 5, 6, 7];
function makeQueue(r) {
  const q = []; let last = -1;
  for (let i = 0; i < 80; i++) {
    let k; do { k = Math.floor(r() * PARTIES.length); } while (k === last || (PARTIES[k].zero && (i < 3 || r() < 0.5)));
    last = k; q.push({ ...PARTIES[k], seats: PARTIES[k].zero ? 0 : pick(SEATS, r) });
  }
  return q;
}

// ───────────────────────── his lines (his halachic voice, from his profile) ─────────────────────────
const LINES = {
  start: ['טוב, רבותיי. תנן: שישים ואחד – רוב. פחות – בחירות.', 'איתמר: קואליציה בונים מלמטה. נתחיל.', 'ידידיי וחבריי, אזרחי הקהילה – מרכיבים.'],
  perfect: ['ללמדך שאין קואליציה בלא דיוק.', 'הרי זה מכוון כהלכה.', 'שרי! ושרי! ושרי!', 'כמו פסק דין בהרכב מורחב.', 'מכאן שהדיוק – מצווה.'],
  expand: ['הרכב מורחב! השופטים מתרחבים.', 'שלוש ברציפות – חזקה! הרכב מורחב.'],
  small: ['יש לו על מי לסמוך.', 'מנהג בעלמא. ממשיכים.', 'קצת נחתך – אבל הרוב קובע.', 'לא קשיא: הא במרכז, הא בצד.'],
  big: ['רחמנא ליצלן.', 'מיתיבי: והלא חתכת מנדטים!', 'חס ושלום, איבדנו מנדטים.', 'באימה וביראה, ברטט ובזיעה...'],
  zero: ['בהימנעות שרי, ובישיבה אסור.', 'סיעת ההימנעות: לא בעד, לא נגד – אבל במגדל.'],
  m30: ['חצי כנסת. אין אנו פוסקים כמותה עדיין.'],
  m50: ['חמישים. הימים שבין כסה לאסון...'],
  gov: ['והלכתא: קמה ממשלה! בברכת הדמוקרטיה ושלטון החוק.'],
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
const SFX = ['drop1', 'drop2', 'drop3', 'slice1', 'slice2', 'slice3', 'perfect1', 'perfect2', 'perfect3', 'fall', 'grow', 'ring', 'hangup', 'gavel61', 'collapse', 'milestone', 'click', 'newbest', 'music'];
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
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b4a2e, 1.15));
const sun = new THREE.DirectionalLight(0xffe7c2, 1.9); sun.position.set(4, 9, 6); scene.add(sun);
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
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  safeT = cssPx('var(--safe-t)'); safeB = H - cssPx('calc(100% - var(--safe-b))') || 0;
  // the tower takes about half the width on a phone; a wide screen keeps the phone's proportions
  const aspect = W / H;
  // a phone: the tower ~ half the width; a wide screen: the same height as a phone sees, the tower in a phone-wide column
  const PA = 0.462, halfH0 = 3.8 / PA;
  let halfW, halfH;
  if (aspect < 0.75) { halfW = 3.8; halfH = halfW / aspect; } else { halfH = halfH0 * 0.82; halfW = halfH * aspect; }
  viewW = halfW * 2; const shift = Math.min(viewW, halfH * 2 * 0.6) * 0.07;
  cam.left = -halfW - shift; cam.right = halfW - shift; cam.top = halfH; cam.bottom = -halfH; cam.updateProjectionMatrix();
  rabbiLayout();
  document.body.classList.toggle('turn', matchMedia('(hover:none)').matches && W > H && H < 520);
}
addEventListener('resize', layout);

// slab labels: a canvas per visible side
function labelTex(p, len, seats) {
  const pxu = 150, w = Math.max(32, Math.round(len * pxu)), h = Math.round(SH * pxu);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, shade(p.col, 0.12)); grd.addColorStop(1, shade(p.col, -0.18));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f5c54299'; g.fillRect(0, 0, w, 3); g.fillStyle = '#00000044'; g.fillRect(0, h - 4, w, 4);
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.shadowColor = '#0008'; g.shadowBlur = 4; g.shadowOffsetY = 2;
  const num = String(seats);
  let txt = `${p.name}  ${num}`, fs = 34;
  g.font = `900 ${fs}px Rubik, system-ui, sans-serif`;
  if (g.measureText(txt).width > w - 16) { txt = p.name; }
  while (fs > 18 && g.measureText(txt).width > w - 12) { fs -= 2; g.font = `900 ${fs}px Rubik, system-ui, sans-serif`; }
  if (g.measureText(txt).width > w - 8) { txt = num; fs = 34; g.font = `900 ${fs}px Rubik, system-ui, sans-serif`; }
  g.fillText(txt, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = (v) => clamp(Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}
function slabMesh(p, w, d, seats) {
  const plain = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.col).multiplyScalar(0.8), roughness: 0.55 });
  const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(shade(p.col, 0.08)), roughness: 0.45 });
  const sx = new THREE.MeshStandardMaterial({ map: labelTex(p, d, seats), roughness: 0.5 });
  const tz = labelTex(p, w, seats);
  const sz = new THREE.MeshStandardMaterial({ map: tz, roughness: 0.5 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, SH, d), [sx, plain, top, plain, sz, plain]);
  return m;
}
function disposeMesh(m) { m.geometry.dispose(); [].concat(m.material).forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); }); }

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
  m.position.y = -1.7 - SH / 2; scene.add(m);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(BASE + 0.6, 0.14, BASE + 0.6), new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.6, roughness: 0.35 }));
  trim.position.y = -SH / 2 - 0.07; scene.add(trim);
}
pedestal();

// ───────────────────────── the rabbi: the verse's 3D resident, in his own little view ─────────────────────────
const rScene = new THREE.Scene();
rScene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a3a20, 1.3));
const rKey = new THREE.DirectionalLight(0xffe2b8, 2.0); rKey.position.set(-1.5, 3, 3); rScene.add(rKey);
const rRim = new THREE.DirectionalLight(0xbcd0ff, 0.9); rRim.position.set(2, 2, -2); rScene.add(rRim);
const rCam = new THREE.PerspectiveCamera(24, 0.7, 0.05, 50);
const RB = { x: 0, y: 0, w: 1, h: 1 };          // his viewport (css px, y from the top)
let rabbi = null;
function rabbiLayout() {
  const w = Math.round(clamp(Math.min(W * 0.4, H * 0.24), 120, 260)), h = Math.round(w * 1.5);
  RB.w = w; RB.h = h; RB.x = W - w - Math.max(0, (W - Math.min(W, H * 0.75)) / 2) + 4; RB.y = H - safeB - h + 6;
  rCam.aspect = w / h; rCam.updateProjectionMatrix();
}
const anim = { mixer: null, base: null, clips: {}, masks: {}, cur: null, idleT: 6 };
new GLTFLoader().load('assets/rabbi.glb', async (g) => {
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
  $('loading').hidden = true;
}, undefined, () => { $('loading').textContent = ''; });

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
    if (anim.idleT <= 0) { act(Math.random() < 0.6 ? 'beard_stroke' : pick(['look_around', 'talmud_thumb', 'wait'])); }
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
  const right = clamp(W - (hx - RB.w * 0.16), 6, W - bw - 6);
  bubble.style.right = right + 'px'; bubble.style.left = 'auto';
  bubble.style.top = clamp(hy - bh * 0.85, safeT + 96, H - bh - 6) + 'px';
}

// ───────────────────────── the game ─────────────────────────
let state = 'menu';                 // menu | play | tut | falling | over
let paused = false, tutorial = false;
let tower = [], cur = null, falling = [], rings = [];
let seats = 0, drops = 0, streak = 0, queue = [], qi = 0, R = Math.random;
let poll = { on: false, left: 0, next: 9, t: 0 }, govDone = false, milestones = {};
let hintOn = false, idleTalk = 0, overReason = '';
function speedNow() {
  if (tutorial) return 1.5;
  return clamp(2.7 + drops * 0.1, 2.7, 7) * (poll.on ? 1.45 : 1);
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
  clearScene();
  tower = [{ x: 0, z: 0, w: BASE, d: BASE, y: -SH, mesh: null }];
  seats = 0; drops = 0; streak = 0; qi = 0; govDone = false; milestones = {};
  R = rng(seed); queue = makeQueue(R);
  poll = { on: false, left: 0, next: 7 + Math.floor(R() * 4), t: 0 };
  camY = camYGoal = SH - camLift(); stopRing();
  spawn(); hud();
}
function camLift() { const halfH = (cam.top - cam.bottom) / 2; return 0.12 * 2 * halfH / 0.866; }
function spawn() {
  const t = topSlab(), p = queue[qi % queue.length];
  const axis = tower.length % 2 ? 'x' : 'z';
  const mesh = slabMesh(p, t.w, t.d, p.seats);
  const range = BASE * 1.25 + 0.6;
  cur = { p, axis, w: t.w, d: t.d, x: t.x, z: t.z, y: t.y + SH, pos: -range, dir: 1, range, mesh };
  cur[axis] = (axis === 'x' ? t.x : t.z) - range;
  mesh.position.set(cur.x, cur.y, cur.z); scene.add(mesh);
  camYGoal = cur.y - camLift();
  nextChip();
}
function nextChip() {
  const p = queue[(qi + 1) % queue.length];
  $('nextChip').innerHTML = `הבא: <i style="background:${p.col}"></i>${p.name} · <b>${p.seats}</b>`;
}
function drop() {
  if (!cur || paused) return;
  if (state !== 'play' && !(state === 'tut' && tutCanDrop())) return;
  const t = topSlab(), a = cur.axis, size = a === 'x' ? cur.w : cur.d, delta = cur[a] - t[a];
  hint(false); idleTalk = 0;
  const over = Math.abs(delta), keep = size - over;
  if (keep <= 0.02) return miss();
  let newSize = keep, center = t[a] + delta / 2, perfect = false;
  if (over < 0.08) { perfect = true; newSize = size; center = t[a]; }
  // the cut piece falls
  if (!perfect) {
    const cutW = a === 'x' ? over : cur.w, cutD = a === 'z' ? over : cur.d;
    const cm = slabMesh(cur.p, cutW, cutD, cur.p.seats);
    const cpos = { x: cur.x, z: cur.z }; cpos[a] = center + Math.sign(delta) * (newSize / 2 + over / 2);
    cm.position.set(cpos.x, cur.y, cpos.z); scene.add(cm);
    falling.push({ mesh: cm, vy: 0, vx: a === 'x' ? Math.sign(delta) * 1.2 : 0, vz: a === 'z' ? Math.sign(delta) * 1.2 : 0, rx: (Math.random() - .5) * 3, rz: (Math.random() - .5) * 3 });
  }
  streak = perfect ? streak + 1 : 0;
  let grew = false;
  if (perfect && streak >= 3 && newSize < BASE - 0.01) { newSize = Math.min(BASE, newSize + 0.25); grew = true; }
  const frac = clamp(keep / size, 0, 1);
  const gained = perfect ? cur.p.seats : Math.round(cur.p.seats * frac);
  // the placed slab
  scene.remove(cur.mesh); disposeMesh(cur.mesh);
  const nw = a === 'x' ? newSize : cur.w, nd = a === 'z' ? newSize : cur.d;
  const s = { x: cur.x, z: cur.z, w: nw, d: nd, y: cur.y, p: cur.p, seats: gained };
  s[a] = center;
  s.mesh = slabMesh(cur.p, nw, nd, gained); s.mesh.position.set(s.x, s.y, s.z); scene.add(s.mesh);
  s.bounce = 1; tower.push(s);
  const before = seats;
  if (!tutorial) seats = Math.min(120, seats + gained);
  drops++; qi++;
  // feedback
  const sp = toScreen(s.x, s.y + SH, s.z);
  if (perfect) {
    play('perfect', 0.7, 1 + Math.min(streak - 1, 6) * 0.06); play('drop', 0.5);
    ringFx(s); popAt(sp, `מדויק! +${gained}`, 'gold');
    if (grew) { play('grow', 0.7); banner('הרכב מורחב!<small>הסיעה גדלה בחזרה</small>'); say(pickNo(LINES.expand, 'ex'), 2.4, 'gold'); act('clap'); }
    else if (cur.p.zero) { say(pickNo(LINES.zero, 'z'), 2.6); act('lilmodcha'); }
    else if (Math.random() < 0.55 || streak === 2) { say(pickNo(LINES.perfect, 'pf'), 2.2, 'gold'); act(Math.random() < 0.7 ? 'lilmodcha' : 'agree'); }
  } else {
    play('drop', 0.75); play('slice', 0.6);
    const lost = cur.p.seats - gained;
    popAt(sp, cur.p.zero ? '0 – נמנעים' : `+${gained}` + (lost ? `  (−${lost} בחיתוך)` : ''), lost >= 2 ? 'bad' : '');
    if (cur.p.zero && Math.random() < 0.7) { say(pickNo(LINES.zero, 'z'), 2.6); }
    else if (frac < 0.6) { say(pickNo(LINES.big, 'bg'), 2.4, 'loud'); act('rachmana'); }
    else if (Math.random() < 0.3) { say(pickNo(LINES.small, 'sm'), 2.2); if (Math.random() < 0.5) act('talmud_thumb'); }
  }
  if (!tutorial) milestonesCheck(before);
  if (!tutorial) pollStep();
  if (tutorial) tutDid('drop', { perfect });
  cur = null;
  if (state === 'over') return;
  if (seats >= 120 && !tutorial) return finish('full');
  spawn(); hud();
}
function milestonesCheck(before) {
  const hit = (n) => before < n && seats >= n && !milestones[n] && (milestones[n] = true);
  if (hit(61)) {
    govDone = true; play('gavel61', 0.9); flash(); banner('והלכתא: קמה ממשלה!<small>61 מנדטים – ממשיכים עד 120</small>');
    say(LINES.gov[0], 3.2, 'gold'); act('cheer'); return;
  }
  if (hit(30)) { play('milestone', 0.8); say(LINES.m30[0], 2.6); act('beard_stroke'); }
  if (hit(50)) { play('milestone', 0.8); say(LINES.m50[0], 2.6); }
  if (hit(90)) { play('milestone', 0.8); banner('90 מנדטים!'); say(LINES.m90[0], 3); act('lilmodcha'); }
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
  setTimeout(() => { if (poll.on && state !== 'over') { stopRing(); say(pickNo(LINES.call, 'cl'), 2.6); } }, 1600);
  $('pollChip').hidden = false;
}
function miss() {
  const c = cur; cur = null;
  falling.push({ mesh: c.mesh, vy: 0, vx: c.axis === 'x' ? Math.sign(c[c.axis] - topSlab()[c.axis]) * 1.5 : 0, vz: c.axis === 'z' ? Math.sign(c[c.axis] - topSlab()[c.axis]) * 1.5 : 0, rx: (Math.random() - .5) * 4, rz: (Math.random() - .5) * 4 });
  play('fall', 0.8); streak = 0;
  if (tutorial) { say(LINES.tutMiss[0], 2.4); setTimeout(() => { if (state === 'tut' && !cur) spawn(); }, 700); return; }
  state = 'falling'; stopRing(); $('pollChip').hidden = true; poll.on = false;
  flash(true); play('collapse', 0.7);
  if (seats < 61) { say(pickNo(LINES.lose, 'ls'), 3.2, 'loud'); act('frustrated_01'); }
  else { say(pickNo(LINES.fell, 'fl'), 3.2, 'loud'); act('rachmana'); }
  setTimeout(() => finish(seats >= 61 ? 'fell' : 'lose'), 1700);
}

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
function hint(on) { hintOn = on; $('hint').classList.toggle('on', on); }

// ───────────────────────── HUD + screens ─────────────────────────
function best() { return +store.get(KEY.best) || 0; }
function dayBest() { const v = (store.get(KEY.day) || '').split('|'); return v[0] === today() ? +v[1] || 0 : 0; }
function hud() {
  const goal = seats >= 61 ? 120 : 61;
  $('seatNum').textContent = `${tutorial ? 0 : seats} / ${goal}`;
  $('seatBar').style.width = (clamp(seats / 120, 0, 1) * 100) + '%';
  $('seatGoal').style.right = (61 / 120 * 100) + '%';
  $('bestNum').textContent = dayBest();
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('hud').classList.toggle('on', on); $('nextRow').classList.toggle('on', on); }
function showBest() {
  const b = dayBest(), all = best();
  $('bestStart').innerHTML = `<span><small>השיא שלכם היום</small><b>${b} מנדטים</b></span>`;
  if (!all) $('bestStart').innerHTML = `<span><small>היעד</small><b>61 מנדטים</b></span>`;
  fitWords();
}
function startGame() {
  tutorial = false; paused = false; show(null); showHUD(true); bubble.className = '';
  reset(`${SLUG}|${today()}`);
  state = 'play'; hint(true);
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
  const heads = { lose: 'הולכים לבחירות!', fell: 'הממשלה נפלה', full: 'כנסת שלמה!' };
  $('overH').textContent = heads[reason];
  $('overLine').textContent = reason === 'full' ? LINES.full[0] : reason === 'fell' ? `${seats} מנדטים – והייתה ממשלה. ללמדך שגם ממשלה צריכה מגדל ישר.` : `${seats} מנדטים. חסרו ${61 - seats} לרוב. הימים שבין כסה לאסון...`;
  $('overScore').innerHTML = `${seats}<small>מנדטים</small>`;
  $('overRec').innerHTML = seats > prevDay && seats > 0 ? '<span class="newrec">שיא יומי חדש!</span>' : '';
  $('bestOver').innerHTML = `השיא שלכם היום: <b>${Math.max(seats, prevDay)}</b> מנדטים`;
  if (reason === 'full') { play('gavel61', 0.9); act('cheer'); }
  if (seats > prevDay && seats > 0) setTimeout(() => play('newbest', 0.6), 500);
  setTimeout(() => { showHUD(false); show('over'); hud(); }, reason === 'full' ? 1600 : 200);
}
function toMenu() {
  state = 'menu'; paused = false; tutorial = false; tut.on = false; $('tutCard').classList.remove('on'); $('tutDim').classList.remove('on');
  showHUD(false); hint(false); bubble.className = ''; stopRing(); $('pollChip').hidden = true;
  clearScene(); tower = [{ x: 0, z: 0, w: BASE, d: BASE, y: -SH }]; camY = camYGoal = SH - camLift();
  loop('music', 0); show('start'); showBest();
}
function pause(on) {
  if (on && state !== 'play') return;
  paused = on; show(on ? 'paused' : null);
  if (SND.master) SND.master.gain.value = on ? 0 : (SND.on ? 1 : 0);
  if (!on) lastT = performance.now();
}
$('playBtn').onclick = () => { play('click', 0.6); if (store.get(KEY.tut)) startGame(); else tut.begin(); };
$('howBtn').onclick = () => { play('click', 0.6); tut.begin(); };
$('againBtn').onclick = () => { play('click', 0.6); startGame(); };
$('menuBtn').onclick = () => { play('click', 0.6); toMenu(); };
$('pauseBtn').onclick = (e) => { e.stopPropagation(); pause(true); };
$('resumeBtn').onclick = () => pause(false);
$('quitBtn').onclick = () => { finishQuiet(); toMenu(); };
function finishQuiet() { stopRing(); }
// a tap anywhere drops (not on the HUD / the cards)
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
$('hall').addEventListener('pointerdown', () => drop());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paused) return pause(false);
  if (tut.on) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (tutWait && !tutWait.done) drop(); else tut.next(); }
    if (e.key === 'Escape') tut.end();
    return;
  }
  if (e.key === 'Escape' && state === 'play') return pause(true);
  if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') && state === 'play') { e.preventDefault(); drop(); }
});

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return r.width ? { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } : null; };
const spotRabbi = () => ({ x: RB.x + RB.w * 0.15, y: RB.y + RB.h * 0.05, w: RB.w * 0.75, h: RB.h * 0.95 });
const spotTop = () => { const t = topSlab(); const p = toScreen(t.x, t.y, t.z); return { x: p.x - W * 0.3, y: p.y - H * 0.12, w: W * 0.6, h: H * 0.2 }; };
const STEPS = [
  { text: 'זה <b>הרב דמוקרטוביץ</b>, רב קהילת ״שערי בג״ץ״. הוא מרכיב קואליציה – ואתם בונים לו אותה.', spot: spotRabbi, say: 'טוב, רבותיי. תנן: שישים ואחד – רוב.' },
  { text: '<b>המטרה: 61 מנדטים.</b> כל סיעה שמונחת על המגדל מוסיפה את המנדטים שלה. אחרי 61 – ממשיכים עד 120.', spot: spotEl('seatBox') },
  { text: 'סיעה זזה מעל המגדל. <b>הקישו בכל מקום</b> כדי להפיל אותה. <b>נסו עכשיו!</b>', try: 'drop' },
  { text: 'מה שבולט מחוץ למגדל – <b>נחתך ונופל</b>, ואיתו גם חלק מהמנדטים. המגדל נהיה צר יותר.', spot: spotTop },
  { text: '<b>הנחה מדויקת</b> = בלי חיתוך, כל המנדטים. 3 מדויקות ברצף = <b>הרכב מורחב</b>: הסיעה גדלה בחזרה. <b>הפילו עוד אחת!</b>', try: 'drop' },
  { text: 'כאן כתוב <b>מי הסיעה הבאה</b> וכמה מנדטים היא מביאה. <b>סיעת ההימנעות</b> מביאה 0 – ״בהימנעות שרי״.', spot: spotEl('nextChip') },
  { text: 'לפעמים <b>הרבנית מתקשרת עם סקר.</b> הרב עונה – והסיעות זזות <b>מהר יותר</b> לכמה הנחות.', setup: 'poll', spot: spotEl('pollChip') },
  { text: '<b>סיעה שמפספסת את המגדל</b> – הקואליציה נופלת. מתחת ל-61 הולכים לבחירות. מוכנים?', last: true },
];
function tutCanDrop() { return !!(tutWait && !tutWait.done); }
function tutDid(id) { if (tutWait && tutWait.id === id && !tutWait.done) tutWait.done = true; }
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
    hint(!!s.try);
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
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; hint(false); }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = (e) => { e.stopPropagation(); tut.next(); };
$('tutSkip').onclick = (e) => { e.stopPropagation(); tut.end(); };

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function step(dt) {
  if (cur && (state === 'play' || state === 'tut')) {
    const sp = speedNow();
    let p = cur[cur.axis] - topSlab()[cur.axis];
    p += cur.dir * sp * dt;
    if (p > cur.range) { p = cur.range; cur.dir = -1; } else if (p < -cur.range) { p = -cur.range; cur.dir = 1; }
    cur[cur.axis] = topSlab()[cur.axis] + p;
    cur.mesh.position.set(cur.x, cur.y, cur.z);
  }
  for (const f of falling) {
    f.vy -= 22 * dt; f.mesh.position.y += f.vy * dt; f.mesh.position.x += f.vx * dt; f.mesh.position.z += f.vz * dt;
    f.mesh.rotation.x += f.rx * dt; f.mesh.rotation.z += f.rz * dt;
  }
  falling = falling.filter((f) => { if (f.mesh.position.y < camY - 16) { scene.remove(f.mesh); disposeMesh(f.mesh); return false; } return true; });
  for (const r of rings) { r.t += dt; const k = (r.k / 1.15) * (1 + r.t * 0.9); r.mesh.scale.set(k, 1, k); r.mesh.material.opacity = Math.max(0, 0.9 - r.t * 1.6); }
  rings = rings.filter((r) => { if (r.t > 0.6) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); return false; } return true; });
  for (const s of tower) if (s.bounce) { s.bounce = Math.max(0, s.bounce - dt * 5); s.mesh.position.y = s.y - Math.sin(s.bounce * Math.PI) * 0.06; }
  camY = lerp(camY, camYGoal, 1 - Math.exp(-dt * 4));
  if (state === 'play' && !paused) { idleTalk += dt; if (idleTalk > 9) { idleTalk = -6; say(pickNo(LINES.idle, 'id'), 2.4); } }
  animStep(dt);
}
function render() {
  const t = new THREE.Vector3(0, camY, 0);
  cam.position.copy(t).addScaledVector(CAMDIR, 30); cam.lookAt(t);
  // the hall's picture rises with the tower (floor -> ceiling)
  const prog = clamp((camY + camLift()) / 22, 0, 1);
  $('hall').style.backgroundPositionY = (100 - prog * 100) + '%';
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
  if (!paused) step(dt);
  if (bubbleT > 0) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) bubble.classList.remove('on'); }
  tut.frame(); render();
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
  get cur() { return cur && { axis: cur.axis, off: cur[cur.axis] - topSlab()[cur.axis], size: cur.axis === 'x' ? cur.w : cur.d, name: cur.p.name, seats: cur.p.seats }; },
  get tut() { return tut.on; }, get tutStep() { return tut.i; }, get tutTry() { return (STEPS[tut.i] || {}).try; }, get tutDone() { return !!(tutWait && tutWait.done); },
  get rabbi() { return !!rabbi; }, get anim() { return anim.cur ? 'busy' : 'idle'; }, get clips() { return Object.keys(anim.clips); }, get paused() { return paused; },
  get dbg() { if (!rabbi) return null; const out = []; rabbi.root.traverse((o) => { if (o.isMesh) out.push([o.name, o.isSkinnedMesh, o.visible]); }); const b = new THREE.Box3().setFromObject(rabbi.root); return { out, min: b.min.toArray(), max: b.max.toArray(), scale: rabbi.root.scale.x, pos: rabbi.root.position.toArray() }; },
  botDrop(want = 0.05) { for (let i = 0; i < 4000 && cur; i++) { if (Math.abs(cur[cur.axis] - topSlab()[cur.axis]) < want && i > 3) break; step(1 / 240); } drop(); },
  missDrop() { for (let i = 0; i < 4000 && cur; i++) { if (Math.abs(cur[cur.axis] - topSlab()[cur.axis]) > (cur.axis === 'x' ? cur.w : cur.d) + 0.2) break; step(1 / 240); } drop(); },
  tick(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); }, drop, startGame, act, RB,
};
