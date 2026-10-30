// 4:20 רצים לגן – Hani leaves the hi-tech office at 4:20 and has to pick Malki up from the gan in Bnei Brak.
// Two ways there: the light rail (a long walk to the station, but no traffic jams) or two buses (the stop is close,
// but there's a transfer and the buses get stuck in traffic). Cross the streets without getting honked back.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const KEY = { best: 'hani-games:gan-run:best', tut: 'hani-games:gan-run:tut', snd: 'hani-games:gan-run:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ───────────────────────── time ─────────────────────────
// game clock in seconds after 4:20:00; the gan closes at 4:45
const DEADLINE = 25 * 60;
const WALK_RATE = 15;           // game seconds per real second while walking
function fmt(t) { const m = Math.floor(t / 60) + 20, h = 4 + Math.floor(m / 60); return `${h}:${String(m % 60).padStart(2, '0')}`; }
const mins = t => Math.max(0, Math.round(t / 60));

// ───────────────────────── renderer / camera ─────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f2);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
let W = innerWidth, H = innerHeight;
const TOP_PAD = 150, BOT_PAD = 72;
const COLS = 4; // columns -4..4
let viewRows = 12, viewZ0 = 0, camTilt = 1.35, viewHalfW = 4.7;
function fitCamera() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  const dir = V(0, camTilt, 1).normalize();
  const target = V(0, 0, viewZ0 + viewRows / 2);
  camera.position.copy(target).addScaledVector(dir, 60);
  camera.lookAt(target); camera.updateMatrixWorld();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const x of [-viewHalfW, viewHalfW]) for (const z of [viewZ0 - .9, viewZ0 + viewRows + .3]) for (const y of (camTilt < 1 ? [0, 2.9] : [0, 1.2])) {
    const p = V(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const s = Math.max((x1 - x0) / (W - 8), (y1 - y0) / (H - TOP_PAD - BOT_PAD));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + (TOP_PAD - BOT_PAD) / 2 * s;
  camera.left = cx - W / 2 * s; camera.right = cx + W / 2 * s; camera.top = cy + H / 2 * s; camera.bottom = cy - H / 2 * s;
  camera.updateProjectionMatrix();
}
addEventListener('resize', fitCamera);
const _p = new THREE.Vector3();
function toScreen(v) { _p.copy(v).project(camera); return { x: (_p.x + 1) / 2 * W, y: (1 - _p.y) / 2 * H }; }

// ───────────────────────── light ─────────────────────────
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a7a9a, 1.3));
const sun = new THREE.DirectionalLight(0xffe6c0, 2.0);
sun.position.set(-8, 16, 6); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: 1, far: 60 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

// ───────────────────────── helpers ─────────────────────────
const mats = {};
function mat(c, o = {}) { const k = c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o })); }
function mesh(geo, m, x = 0, y = 0, z = 0, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
function box(w, h, d, c, x, y, z, parent, o) { return mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c, o) : c, x, y, z, parent); }
function cyl(r, h, c, x, y, z, parent, seg = 14) { return mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof c === 'number' ? mat(c) : c, x, y, z, parent); }
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function plane(w, d, m, x, y, z, parent) { const o = mesh(new THREE.PlaneGeometry(w, d), m, x, y, z, parent); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o; }
function signTex(text, bg, fg = '#fff', w = 256, h = 96, size = 54) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `900 ${size}px Rubik, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(text, w / 2, h / 2 + 3); });
}

// ───────────────────────── models (kids and men from ניסי ניסים, packed in assets/models.json) ─────────────────────────
const models = {};
function loadModels() {
  const L = new GLTFLoader();
  return fetch('assets/models.json').then(r => r.json()).then(pack => Promise.all(Object.keys(pack).map(k => new Promise(res => {
    const bin = Uint8Array.from(atob(pack[k]), c => c.charCodeAt(0)).buffer;
    L.parse(bin, '', g => { g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); models[k] = g.scene; res(); }, () => res());
  })))).catch(() => {});
}
function M3(k, parent, s = 1) { const o = models[k] ? models[k].clone(true) : new THREE.Group(); o.scale.setScalar(s); parent.add(o); return o; }
function tint(o, name, color) {
  const ms = []; o.traverse(m => { if (m.isMesh && m.material && m.material.name === name) ms.push(m); });
  if (!ms.length) return; const mt = ms[0].material.clone(); mt.color.set(color); ms.forEach(m => m.material = mt);
}
// a person: the kids' body with a grown-up head (like Yotam and Erez in the office)
function person(o, parent) {
  const g = new THREE.Group(), s = o.s || 1;
  const body = M3(o.girl ? 'kid_girl' : 'kid_boy', g);
  if (o.shirt !== undefined) tint(body, 'shirt', o.shirt);
  if (o.bottom !== undefined) tint(body, 'pants', o.bottom);
  if (o.dress !== undefined) tint(body, 'dress', o.dress);
  const arms = [];
  for (const sx of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(sx * (o.girl ? .17 : .2), .9, 0); g.add(pv);
    const a = M3('kid_arm', pv); tint(a, 'shirt', o.girl ? (o.dress ?? 0x22306b) : (o.shirt ?? 0xfbfbfb)); pv.rotation.z = sx * .12; arms.push(pv);
  }
  const head = new THREE.Group(); head.position.y = .93; g.add(head);
  const h = M3(o.head || (o.girl ? 'kid_head_girl' : 'man_head'), head);
  if (o.hair !== undefined) tint(h, 'hair', o.hair);
  if (o.bow !== undefined) tint(h, 'bow', o.bow);
  if (o.hat) { cyl(.25, .03, 0x111111, 0, .42, 0, head, 20); cyl(.15, .2, 0x111111, 0, .52, 0, head, 16); }
  g.scale.setScalar(s); g.userData = { arms }; parent.add(g); return g;
}

// ───────────────────────── Hani (her painted full-body poses) ─────────────────────────
const tl = new THREE.TextureLoader();
const POSE = { walk: 0, oops: 1, joy: 2, sit: 3 };
const poseTex = ['walk', 'oops', 'joy', 'sit'].map(n => { const t = tl.load(`assets/hani-${n}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
const HANI_H = 2.0;
const hani = new THREE.Group(); scene.add(hani);
const haniFig = new THREE.Sprite(new THREE.SpriteMaterial({ map: poseTex[0], transparent: true, alphaTest: .05 }));
haniFig.center.set(.5, 0); haniFig.scale.set(HANI_H * 460 / 600, HANI_H, 1); hani.add(haniFig);
const haniShadow = new THREE.Mesh(new THREE.CircleGeometry(.32, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false }));
haniShadow.rotation.x = -Math.PI / 2; haniShadow.position.y = .02; hani.add(haniShadow);
let poseNow = 0;
function setPose(n) { const i = POSE[n]; if (i !== poseNow) { poseNow = i; haniFig.material.map = poseTex[i]; haniFig.material.needsUpdate = true; } }

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, music: null, amb: null };
const OWN = ['honk-1', 'honk-2', 'honk-3', 'bell-1', 'step-1', 'step-2', 'step-3', 'door', 'chime', 'tram', 'bus', 'oops', 'tick', 'arrive', 'late', 'pop', 'traffic'];
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const HS = ['niggun-freilach', 'phone-ring', 'brachi-12', 'kids-ima-1', 'kids-ima-2'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then(x => { SND.buf[n] = x; if (n === 'niggun-freilach' || n === 'traffic') startMusic(); }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
function play(name, vol = 1, rate = 1, exact = false) {
  if (!SND.ctx) return null;
  const vars = exact ? (SND.buf[name] ? [name] : []) : SFX.filter(n => n === name || n.startsWith(name + '-')).filter(n => SND.buf[n]);
  if (!vars.length) return null;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = exact ? 1 : rate * rnd(.94, 1.06); g.gain.value = vol;
  src.connect(g).connect(SND.master); src.start();
  return { stop() { try { src.stop(); } catch (e) {} } };
}
function loopSnd(n, vol) { const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); src.buffer = SND.buf[n]; src.loop = true; g.gain.value = vol; src.connect(g).connect(SND.master); src.start(); return { src, g }; }
function startMusic() {
  if (!SND.music && SND.buf['niggun-freilach']) SND.music = loopSnd('niggun-freilach', .26);
  if (!SND.amb && SND.buf.traffic) SND.amb = loopSnd('traffic', .22);
}
function setMusicRate(r) { if (SND.music) SND.music.src.playbackRate.setTargetAtTime(r, SND.ctx.currentTime, .4); }
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
function drawSnd() { document.querySelectorAll('.sndBtn').forEach(b => b.innerHTML = SND.on ? ICON_ON : ICON_OFF); }
document.querySelectorAll('.sndBtn').forEach(b => b.addEventListener('click', () => {
  SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); audioUnlock();
  if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; drawSnd();
}));
drawSnd();
addEventListener('pointerdown', audioUnlock, { capture: true });
addEventListener('keydown', audioUnlock, { capture: true });
// leaving the page: silence right away
function hush() { SND.ctx && SND.ctx.suspend(); }
addEventListener('pagehide', hush);
document.addEventListener('click', e => { if (e.target.closest('a[href]')) hush(); }, true);

// ───────────────────────── Hani speaks (bottom strip) ─────────────────────────
const sayEl = $('say');
let sayT = 0, sayPri = 0;
function say(text, dur = 2.6, pri = 1, call = false) {
  if (!text || (sayT > 0 && pri < sayPri)) return;
  sayEl.textContent = text; sayEl.classList.add('on'); sayEl.classList.toggle('call', call); sayT = dur; sayPri = pri;
}
const fxEl = $('fx');
function floatText(v, txt, bad) {
  const s = toScreen(v), f = document.createElement('div'); f.className = 'float' + (bad ? ' bad' : ''); f.textContent = txt;
  f.style.left = s.x + 'px'; f.style.top = s.y + 'px'; fxEl.appendChild(f); setTimeout(() => f.remove(), 1100);
}
function ninBanner(pts) {
  const b = document.createElement('div'); b.className = 'nin'; b.innerHTML = `נס בתוך נס!<small>+${pts}</small>`;
  fxEl.appendChild(b); setTimeout(() => b.remove(), 1900);
}

// ───────────────────────── icons ─────────────────────────
const SVG = {
  bus: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="15" rx="3" fill="#2f9e5b"/><rect x="5" y="6" width="14" height="6" rx="1" fill="#cfefff"/><circle cx="7.5" cy="19.5" r="2" fill="#333"/><circle cx="16.5" cy="19.5" r="2" fill="#333"/></svg>',
  rail: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="16" rx="4" fill="#d6283a"/><rect x="7" y="5" width="10" height="6" rx="1" fill="#fff"/><circle cx="9" cy="14.5" r="1.4" fill="#fff"/><circle cx="15" cy="14.5" r="1.4" fill="#fff"/><path d="M7 22l2-4h6l2 4" stroke="#555" stroke-width="2" fill="none"/></svg>',
  jam: '<svg viewBox="0 0 24 24"><rect x="2" y="9" width="9" height="6" rx="2" fill="#e5484d"/><rect x="13" y="9" width="9" height="6" rx="2" fill="#ffb020"/><circle cx="5" cy="16" r="1.6" fill="#333"/><circle cx="9" cy="16" r="1.6" fill="#333"/><circle cx="16" cy="16" r="1.6" fill="#333"/><circle cx="20" cy="16" r="1.6" fill="#333"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#1d2a4a" stroke-width="2"/><path d="M12 6v6l4 2" stroke="#1d2a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
  walk: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4" r="2.2" fill="#1d2a4a"/><path d="M12 8l-3 5 3 2-1 6M12 8l3 4 3 1M9 13l-3 1" stroke="#1d2a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
};

// ───────────────────────── the streets (boards) ─────────────────────────
// Rows run from the top of the screen (z = 0) towards the camera. Hani walks down, towards you.
// row kinds: plaza / walk (safe), median (safe), road, bike, crowd, stop (bus stop at x0..x1), rail (station at x0..x1), gan
const R = (kind, o = {}) => ({ kind, ...o });
const BOARDS = {
  office: { name: 'יציאה מהמשרד · דרך אבא הלל', top: 'tower', rows: [
    R('plaza'), R('walk'), R('road', { dir: 1, kinds: ['car', 'car', 'taxi'] }), R('road', { dir: -1, kinds: ['car', 'van'] }), R('median'),
    R('road', { dir: 1, kinds: ['car', 'van', 'bus'] }), R('road', { dir: -1, kinds: ['car', 'car', 'taxi'] }),
    R('exit', { exits: [{ x0: -4, x1: -3, to: 'toBus', label: 'לאוטובוס', icon: 'bus' }, { x0: 3, x1: 4, to: 'rail1', label: 'לרכבת הקלה', icon: 'rail' }] }),
  ] },
  toBus: { name: 'לתחנה של קו 1 · ז׳בוטינסקי', top: 'shops', rows: [
    R('walk'), R('bike'), R('road', { dir: -1, kinds: ['car', 'car', 'van'] }), R('road', { dir: 1, kinds: ['bus', 'car', 'taxi'] }), R('stop', { x0: -1, x1: 1, line: 1 }),
  ] },
  rail1: { name: 'רחוב ביאליק', top: 'shops', rows: [
    R('walk'), R('road', { dir: 1, kinds: ['car', 'taxi', 'car'] }), R('road', { dir: -1, kinds: ['van', 'car'] }), R('crowd', { dir: 1 }),
    R('road', { dir: -1, kinds: ['car', 'car', 'bus'] }), R('exit', { exits: [{ x0: -4, x1: 4, to: 'rail2', label: 'ממשיכים לרכבת', icon: 'rail' }] }),
  ] },
  rail2: { name: 'לתחנת הרכבת הקלה', top: 'tower2', rows: [
    R('walk'), R('bike'), R('road', { dir: 1, kinds: ['car', 'van', 'car'] }), R('road', { dir: -1, kinds: ['car', 'taxi'] }), R('median'),
    R('road', { dir: 1, kinds: ['car', 'car', 'bus'] }), R('rail', { x0: 2, x1: 4 }),
  ] },
  transfer: { name: 'החלפה בצומת · לקו 2', top: 'shops', rows: [
    R('walk'), R('road', { dir: -1, kinds: ['car', 'bus', 'car'] }), R('road', { dir: 1, kinds: ['car', 'taxi'] }), R('median'),
    R('road', { dir: -1, kinds: ['car', 'van'] }), R('road', { dir: 1, kinds: ['bus', 'car', 'car'] }), R('bike'), R('stop', { x0: 2, x1: 4, line: 2 }),
  ] },
  bbRail1: { name: 'בני ברק · רחוב רבי עקיבא', top: 'homes', rows: [
    R('walk'), R('crowd', { dir: 1 }), R('road', { dir: -1, kinds: ['car', 'van', 'car'] }), R('road', { dir: 1, kinds: ['car', 'bus', 'taxi'] }), R('crowd', { dir: -1 }),
    R('exit', { exits: [{ x0: -4, x1: 4, to: 'bbRail2', label: 'ממשיכים לגן', icon: 'walk' }] }),
  ] },
  bbRail2: { name: 'רחוב חזון איש · הגן', top: 'homes', rows: [
    R('walk'), R('road', { dir: 1, kinds: ['car', 'van'] }), R('road', { dir: -1, kinds: ['car', 'car'] }), R('crowd', { dir: 1 }), R('bike'),
    R('road', { dir: -1, kinds: ['car', 'car', 'van'] }), R('gan', { x0: -1, x1: 1 }),
  ] },
  bbBus: { name: 'רחוב חזון איש · הגן', top: 'homes', rows: [
    R('walk'), R('crowd', { dir: -1 }), R('road', { dir: 1, kinds: ['car', 'van', 'car'] }), R('road', { dir: -1, kinds: ['car', 'car'] }), R('crowd', { dir: 1 }), R('gan', { x0: -1, x1: 1 }),
  ] },
};
const SAFE = { plaza: 1, walk: 1, median: 1, stop: 1, rail: 1, gan: 1, exit: 1 };

let world = null;      // the current board: { def, group, lanes[], rows }
const LEN = { car: 2.3, taxi: 2.4, van: 2.5, bus: 4.6, scooter: 1.2, ped: .8, stroller: 1.6 };
const VEH = { car1: 300 / 639, car2: 277 / 640, car3: 267 / 640, taxi: 269 / 640, van: 290 / 640, bus: 197 / 640 };
// painted people: height in world units (Hani is 2.0) and width / height of the picture
const PEOPLE = { ped1: { h: 2.05, ar: 273 / 420 }, ped2: { h: 1.98, ar: 221 / 420 }, stroller: { h: 2.0, ar: 392 / 420 }, scooter: { h: 2.15, ar: 294 / 420 } };
const pTex = {};
function peopleTex(n) { if (!pTex[n]) { pTex[n] = tl.load(n.startsWith('v-') ? `assets/${n}.png` : `assets/p-${n}.png`); pTex[n].colorSpace = THREE.SRGBColorSpace; pTex[n].anisotropy = 4; } return pTex[n]; }
const CAR_COL = [0xe5484d, 0x2f6fd1, 0xf2f2f2, 0x9aa3ad, 0x2bb673, 0x1f1f24, 0xffb020];

function vehicle(kind, parent, dir) {
  const g = new THREE.Group(); parent.add(g); const L = LEN[kind];
  if (kind === 'bus' || kind === 'car' || kind === 'taxi' || kind === 'van') {
    // painted side views (facing right), mirrored for the other direction
    const n = kind === 'car' ? pick(['car1', 'car2', 'car3']) : kind, v = VEH[n];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: peopleTex('v-' + n), transparent: true, alphaTest: .05 }));
    sp.center.set(.5, 0); sp.scale.set(dir * L, L * v, 1); sp.position.z = -.1; g.add(sp);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(L * .95, .7), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = .02; g.add(sh);
  } else if (kind === 'scooter' || kind === 'ped' || kind === 'stroller') {
    // the people of the street: painted side views (facing right), the same scale as Hani
    const n = kind === 'ped' ? pick(['ped1', 'ped2']) : kind, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: peopleTex(n), transparent: true, alphaTest: .05 }));
    const h = PEOPLE[n].h; sp.center.set(.5, 0); sp.scale.set(dir * h * PEOPLE[n].ar, h, 1); g.add(sp);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(.3, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = .02; sh.scale.x = PEOPLE[n].ar * 1.6; g.add(sh);
  }
  return g;
}

const texCache = {};
function groundTex(kind) {
  if (texCache[kind]) return texCache[kind];
  let t;
  if (kind === 'road') t = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#4a4e57'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < .5 ? '#52565f' : '#43474f'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  else if (kind === 'bike') t = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#b8574a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffffaa'; for (let x = 10; x < w; x += 64) { g.beginPath(); g.arc(x + 14, h / 2, 9, 0, 7); g.lineWidth = 3; g.strokeStyle = '#fff9'; g.stroke(); g.beginPath(); g.arc(x + 40, h / 2, 9, 0, 7); g.stroke(); } });
  else if (kind === 'median') t = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#7cb85a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { g.fillStyle = Math.random() < .5 ? '#88c466' : '#6fa94f'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } });
  else t = canvasTex(64, 64, (g, w, h) => { g.fillStyle = kind === 'plaza' ? '#d9d3c7' : '#cfc9bd'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8b1a3'; g.lineWidth = 2; g.strokeRect(1, 1, 31, 31); g.strokeRect(33, 1, 30, 31); g.strokeRect(1, 33, 31, 30); g.strokeRect(33, 33, 30, 30); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache[kind] = t; return t;
}
function windowsTex(base, win, cols = 4, rows = 6, balcony = false) {
  return canvasTex(256, 384, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      g.fillStyle = win; g.fillRect(c * cw + cw * .2, r * rh + rh * .2, cw * .6, rh * .55);
      if (balcony && c % 2 === 0) { g.fillStyle = '#ffffffcc'; g.fillRect(c * cw + cw * .1, r * rh + rh * .72, cw * .8, rh * .12); }
    }
  });
}
function buildTop(kind, g) {
  if (kind === 'tower') {
    // the hi-tech tower Hani works in, and its neighbours
    box(4.2, 7, 2, mat(0xffffff, { map: windowsTex('#7fb3d9', '#cfe9ff', 6, 10), roughness: .25, metalness: .2 }), 0, 3.5, -2.3, g);
    box(2.6, 4.5, 2, mat(0xffffff, { map: windowsTex('#9ab0c4', '#e2eef8', 4, 7), roughness: .35 }), -4.2, 2.25, -2.3, g);
    box(2.6, 5.2, 2, mat(0xffffff, { map: windowsTex('#6f9fc4', '#d6ecff', 4, 8), roughness: .3 }), 4.2, 2.6, -2.3, g);
    box(1.4, 1, .1, 0x1d2a4a, 0, .5, -1.27, g); // the door
  } else if (kind === 'tower2') {
    for (let i = -2; i <= 2; i++) box(2.1, rnd(3.5, 5.5), 1.8, mat(0xffffff, { map: windowsTex(pick(['#8fb6d6', '#a7bfd3', '#7aa7cc']), '#dff0ff', 4, 8), roughness: .3 }), i * 2.15, 2.2, -2.2, g);
  } else if (kind === 'shops') {
    for (let i = -2; i <= 2; i++) {
      box(2.1, 3, 1.6, mat(0xffffff, { map: windowsTex(pick(['#e8d9bf', '#ddd0b8', '#efe3cc']), '#7aa6c9', 4, 4, true) }), i * 2.15, 1.5, -2.1, g);
      const aw = box(1.8, .08, .5, pick([0xe5484d, 0x2f6fd1, 0x2bb673, 0xffb020]), i * 2.15, .95, -1.1, g); aw.rotation.x = .3;
    }
  } else {
    // Bnei Brak: stone buildings with balconies
    for (let i = -2; i <= 2; i++) box(2.1, rnd(3, 4.2), 1.8, mat(0xffffff, { map: windowsTex(pick(['#efe3cc', '#e6d8bd', '#f2e8d6']), '#6f8fae', 4, 6, true) }), i * 2.15, 1.8, -2.2, g);
  }
}

function buildBoard(id) {
  if (world) scene.remove(world.group);
  const def = BOARDS[id], g = new THREE.Group(); scene.add(g);
  const rows = def.rows, n = rows.length;
  world = { id, def, group: g, rows, lanes: [], zones: [] };
  viewRows = Math.max(n, 9); viewZ0 = -(viewRows - n) / 2;
  buildTop(def.top, g);
  // grass edges beyond the streets
  plane(30, n + 30, mat(0x8fbf6a), 0, -.02, n / 2 + 4, g);
  rows.forEach((r, z) => {
    const kind = r.kind === 'stop' || r.kind === 'rail' || r.kind === 'gan' || r.kind === 'exit' ? 'walk' : r.kind === 'crowd' ? 'walk' : r.kind;
    const t = groundTex(kind).clone(); t.needsUpdate = true; t.repeat.set(kind === 'road' || kind === 'bike' ? 4 : 14, 1);
    const p = plane(30, 1.001, new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), 0, 0, z + .5, g); p.receiveShadow = true;
    if (r.kind === 'road') {
      const next = rows[z + 1];
      if (next && next.kind === 'road') for (let x = -14; x < 14; x += 1.4) box(.7, .01, .07, 0xf2f2f2, x, .01, z + 1, g).castShadow = false;
      if (r.kind === 'road' && rows[z - 1] && rows[z - 1].kind !== 'road') box(30, .12, .1, 0xbdb6a8, 0, .06, z, g);
      if (next && next.kind !== 'road') box(30, .12, .1, 0xbdb6a8, 0, .06, z + 1, g);
    }
    if (r.kind === 'stop') {
      const cx = (r.x0 + r.x1) / 2, w = r.x1 - r.x0 + 1;
      plane(w, .96, mat(0xffe08a), cx, .012, z + .5, g);
      box(w - .2, .06, .7, 0x9aa3ad, cx, 1.55, z + .55, g);
      for (const x of [r.x0 - .4, r.x1 + .4]) box(.06, 1.55, .06, 0x6b7280, x, .78, z + .85, g);
      box(w - .4, .9, .04, 0xcfefff, cx, .9, z + .88, g, { transparent: true, opacity: .45 });
      box(w - .6, .08, .3, 0x6b4a2a, cx, .42, z + .7, g);
      const t = signTex('קו ' + r.line, '#2f9e5b', '#fff', 192, 96, 52);
      const s = mesh(new THREE.PlaneGeometry(.75, .38), new THREE.MeshBasicMaterial({ map: t }), r.x1 + .4, 1.95, z + .5, g); s.castShadow = false;
      box(.05, .5, .05, 0x6b7280, r.x1 + .4, 1.6, z + .5, g);
      world.zones.push({ z, x0: r.x0, x1: r.x1, kind: 'bus' + r.line });
    }
    if (r.kind === 'rail') {
      const cx = (r.x0 + r.x1) / 2, w = r.x1 - r.x0 + 1;
      plane(w, .96, mat(0xffd2d6), cx, .012, z + .5, g);
      box(w, .08, 1, 0xd6283a, cx, 1.6, z + .5, g);
      for (const x of [r.x0 - .45, r.x1 + .45]) box(.08, 1.6, .08, 0x9aa3ad, x, .8, z + .9, g);
      box(w - .4, .1, .8, 0x2a2e36, cx, .06, z + .5, g); // the stairs going down
      for (let i = 0; i < 4; i++) box(w - .5, .02, .12, 0x9aa3ad, cx, .12, z + .2 + i * .2, g);
      const t = canvasTex(256, 96, (q, w2, h2) => { q.fillStyle = '#d6283a'; q.fillRect(0, 0, w2, h2); q.fillStyle = '#fff'; q.font = '900 46px Rubik, Arial'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('רכבת קלה', w2 / 2, h2 / 2 + 3); });
      const s = mesh(new THREE.PlaneGeometry(1.5, .56), new THREE.MeshBasicMaterial({ map: t }), cx, 2.0, z + .95, g); s.castShadow = false;
      world.zones.push({ z, x0: r.x0, x1: r.x1, kind: 'rail' });
    }
    if (r.kind === 'exit') for (const e of r.exits) {
      const cx = (e.x0 + e.x1) / 2, w = e.x1 - e.x0 + 1;
      plane(w, .96, mat(e.icon === 'bus' ? 0xc8efd6 : e.icon === 'rail' ? 0xffd2d6 : 0xfff0b8), cx, .012, z + .5, g);
      const ar = canvasTex(128, 128, (q) => { q.fillStyle = '#ffffffcc'; q.beginPath(); q.moveTo(64, 112); q.lineTo(16, 56); q.lineTo(44, 56); q.lineTo(44, 14); q.lineTo(84, 14); q.lineTo(84, 56); q.lineTo(112, 56); q.closePath(); q.fill(); });
      for (let x = e.x0; x <= e.x1; x++) plane(.7, .7, new THREE.MeshBasicMaterial({ map: ar, transparent: true, depthWrite: false }), x, .02, z + .5, g);
      const t = signTex(e.label, e.icon === 'bus' ? '#2f9e5b' : e.icon === 'rail' ? '#d6283a' : '#ff8a1f', '#fff', 420, 110, 58);
      const sx = clamp(cx, -2.9, 2.9), sg = mesh(new THREE.PlaneGeometry(2.5, .66), new THREE.MeshBasicMaterial({ map: t }), sx, .55, z + .55, g); sg.castShadow = false; sg.rotation.x = -.6;
      world.zones.push({ z, x0: e.x0, x1: e.x1, kind: 'next', to: e.to });
    }
    if (r.kind === 'gan') {
      // the gan: a colourful fence, a gate, and Malki waiting
      for (let x = -4.5; x <= 4.5; x += .5) if (x < -1.4 || x > 1.4) box(.08, .7, .08, pick([0xe5484d, 0x2f6fd1, 0xffb020, 0x2bb673]), x, .35, z + .9, g);
      box(2.6, .08, .06, 0xffffff, -2.95, .62, z + .9, g); box(2.6, .08, .06, 0xffffff, 2.95, .62, z + .9, g);
      box(.12, 1.5, .12, 0xffb020, -1.45, .75, z + .9, g); box(.12, 1.5, .12, 0xffb020, 1.45, .75, z + .9, g);
      const t = signTex('גן פרחי השמחה', '#ffd34a', '#7a2a5a', 384, 96, 46);
      const s = mesh(new THREE.PlaneGeometry(2.6, .62), new THREE.MeshBasicMaterial({ map: t }), 0, 1.65, z + .92, g); s.castShadow = false;
      plane(3, .96, mat(0xc7f0d3), 0, .012, z + .5, g);
      world.malki = person({ girl: true, s: .72, dress: 0xd0457a, hair: 0x6b4426, bow: 0xffd34a }, g);
      world.malki.position.set(0, 0, z + 1.5);
      world.zones.push({ z, x0: r.x0, x1: r.x1, kind: 'gan' });
    }
    // traffic on this row
    if (r.kind === 'road' || r.kind === 'bike' || r.kind === 'crowd') {
      const dir = r.dir || (z % 2 ? 1 : -1);
      const lane = { z, dir, kind: r.kind, cars: [], speed: 0 };
      const spd = r.kind === 'bike' ? rnd(3.2, 4) : r.kind === 'crowd' ? rnd(.55, .8) : rnd(1.5, 2.6);
      lane.speed = spd * (1 + (day - 1) * .07);
      const kinds = r.kind === 'bike' ? ['scooter'] : r.kind === 'crowd' ? ['ped', 'ped', 'stroller'] : r.kinds;
      // fill the lane with vehicles and gaps; the gaps shrink a little each day
      let x = -12 + rnd(0, 2);
      while (x < 12) {
        const k = pick(kinds), o = vehicle(k, g, dir);
        o.position.set(x + LEN[k] / 2, 0, z + .5);
        if (dir < 0 && (k === 'scooter' || k === 'ped' || k === 'stroller')) { /* people turn themselves */ }
        lane.cars.push({ o, k, len: LEN[k] });
        const gap = r.kind === 'crowd' ? rnd(2.6, 4.4) : r.kind === 'bike' ? rnd(3.5, 7) : rnd(2.4, 5) * Math.max(.62, 1 - (day - 1) * .06);
        x += LEN[k] + gap;
      }
      lane.span = x + 12;
      world.lanes[z] = lane;
    }
  });
  fitCamera();
}
// people and scooters were built facing their way; cars use a 180° turn so their lights point forwards
function updLanes(dt) {
  if (!world) return;
  for (const lane of world.lanes) {
    if (!lane) continue;
    for (const c of lane.cars) {
      c.o.position.x += lane.dir * lane.speed * dt * (c.k === 'bus' ? .85 : 1);
      if (lane.dir > 0 && c.o.position.x - c.len / 2 > 12) c.o.position.x -= lane.span;
      if (lane.dir < 0 && c.o.position.x + c.len / 2 < -12) c.o.position.x += lane.span;
      if (c.k === 'ped' || c.k === 'stroller') c.o.children[0].position.y = Math.abs(Math.sin(now * 7 + c.o.position.x)) * .03;
    }
  }
}

// ───────────────────────── game state ─────────────────────────
let state = 'menu', paused = false, now = 0, clock = 0, day = 1, score = 0;
let route = '', info = null, hx = 0, hz = 0, hop = null, stunT = 0, lastSafe = 0, ffTo = null, bus2At = 0;
const hud = () => {
  const c = $('clock'); c.textContent = fmt(clock); c.classList.toggle('late', clock > DEADLINE - 120); c.classList.toggle('ff', !!ffTo);
  $('day').textContent = 'יום ' + day; $('score').textContent = score;
};
function chips() {
  const el = $('chips'); if (!world || !(state === 'board' || state === 'wait')) { el.innerHTML = ''; return; }
  const left = t => { const s = Math.max(0, Math.round(t - clock)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  if (world.id === 'office') {
    el.innerHTML = `<div class="chip">${SVG.walk}<b>${world.def.name}</b></div>`
      + `<div class="chip">${SVG.bus}קו 1 בעוד <b>${mins(nextBus1() - clock)} דק׳</b></div>`
      + `<div class="chip ${info.traffic === 2 ? 'bad' : info.traffic === 0 ? 'good' : ''}">${SVG.jam}עומס: <b>${['קל', 'בינוני', 'כבד'][info.traffic]}</b></div>`
      + `<div class="chip ${info.railDelay ? 'bad' : ''}">${SVG.rail}${info.railDelay ? `רכבת: <b>עיכוב ${info.railDelay} דק׳</b>` : 'רכבת קלה כל <b>6 דק׳</b>'}</div>`;
  } else if (world.id === 'transfer') {
    el.innerHTML = `<div class="chip ${bus2At - clock < 60 ? 'bad' : ''}">${SVG.bus}קו 2 יוצא בעוד <b>${left(bus2At)}</b></div>`;
  } else if (world.id === 'toBus') {
    el.innerHTML = `<div class="chip">${SVG.walk}<b>${world.def.name}</b></div><div class="chip">${SVG.bus}קו 1 בעוד <b>${mins(nextBus1() - clock)} דק׳</b></div>`;
  } else if (world.id === 'rail2' || world.id === 'rail1') {
    el.innerHTML = `<div class="chip">${SVG.walk}<b>${world.def.name}</b></div><div class="chip">${SVG.rail}רכבת בעוד <b>${mins(nextTrain() - clock)} דק׳</b></div>`;
  } else el.innerHTML = `<div class="chip">${SVG.walk}<b>${world.def.name}</b></div>`;
}
// the timetable of the day
function newDay() {
  const heavy = Math.min(.55, .15 + day * .07);
  const r = Math.random();
  info = {
    bus1: rnd(60, 420),                                    // first bus 1 after 4:20 (game seconds)
    traffic: r < heavy ? 2 : r < heavy + .35 ? 1 : 0,
    railPhase: rnd(0, 360),
    railDelay: day >= 3 && Math.random() < .22 ? pick([4, 5, 6]) : 0,
  };
}
const nextBus1 = () => { let t = info.bus1; while (t < clock - 5) t += 12 * 60; return t; };
const nextTrain = () => { let t = info.railPhase + info.railDelay * 60; while (t < clock) t += 6 * 60; return t; };
const jam = () => [rnd(0, 50), rnd(110, 230), rnd(300, 520)][info.traffic];

function placeHani(x, z) { hx = x; hz = z; hani.position.set(x, 0, z + .5); hani.visible = true; haniFig.material.opacity = 1; }
function startBoard(id, x = 0) {
  endRide(); buildBoard(id); placeHani(x, 0); lastSafe = 0; hop = null; stunT = 0; state = 'board'; setPose('walk'); chips();
}
function zoneAt(x, z) { return world.zones.find(q => q.z === z && x >= q.x0 && x <= q.x1); }

// ───────────────────────── moving ─────────────────────────
function tryMove(dx, dz) {
  if (state !== 'board' || hop || stunT > 0 || paused) return;
  if (tut.on && !tut.step().move) return;
  const nx = clamp(hx + dx, -COLS, COLS), nz = clamp(hz + dz, 0, world.rows.length - 1);
  if (nx === hx && nz === hz) return;
  hop = { fx: hx, fz: hz, tx: nx, tz: nz, t: 0 };
  hx = nx; hz = nz; play('step', .35);
  if (tut.on && tut.wait) tut.wait.done = true;
}
function updHani(dt) {
  if (hop) {
    hop.t += dt / .14;
    const k = Math.min(1, hop.t);
    hani.position.set(hop.fx + (hop.tx - hop.fx) * k, Math.sin(k * Math.PI) * .18, hop.fz + .5 + (hop.tz - hop.fz) * k);
    if (k >= 1) { hop = null; arrived(); }
  } else if (state === 'board') {
    hani.position.y = 0; haniFig.position.x = 0;
  }
  if (stunT > 0) { stunT -= dt; if (stunT <= 0) setPose('walk'); }
  haniFig.position.y = hop ? Math.abs(Math.sin(now * 16)) * .03 : 0;
}
function arrived() {
  if (SAFE[world.rows[hz].kind]) lastSafe = hz;
  const zn = zoneAt(hx, hz);
  if (!zn || tut.on) return;
  if (zn.kind === 'bus1') boardBus(1);
  else if (zn.kind === 'bus2') boardBus(2);
  else if (zn.kind === 'rail') goRail();
  else if (zn.kind === 'gan') reachGan();
  else if (zn.kind === 'next') nextStage(zn.to);
}
// the next street: a quick slide, Hani comes in at the top at the same spot
function nextStage(id) {
  state = 'wait'; ffTo = null; play('pop', .4);
  const x = hx;
  tween(.25, k => { haniFig.material.opacity = 1 - k; }, () => {
    startBoard(id, x); haniFig.material.opacity = 1;
    say(pick(['עוד רחוב, בעזרת השם.', 'ממשיכים. מלכי מחכה.', 'עוד כביש אחד.']), 1.8, 1);
  });
}
function checkHit() {
  if (state !== 'board' || stunT > 0 || hop) return;
  const lane = world.lanes[hz]; if (!lane) return;
  for (const c of lane.cars) {
    if (Math.abs(c.o.position.x - hx) < c.len / 2 + .28) { bump(c); return; }
  }
}
const HIT_LINES = ['אוי! ברוך השם, רק הבהלה.', 'סליחה, סליחה. בנועם.', 'ברוך השם, הנהג עצר בזמן.', 'נחכה שיעבור. סבלנות.'];
function bump(c) {
  const person = c.k === 'ped' || c.k === 'stroller';
  play(person ? 'oops' : c.k === 'bus' ? 'honk-3' : c.k === 'scooter' ? 'bell' : 'honk', .7);
  if (!person) play('oops', .4);
  floatText(V(hx, 2.1, hz + .5), person ? 'סליחה!' : c.k === 'scooter' ? 'טרררינג!' : 'טוווט!', true);
  setPose('oops'); stunT = .75;
  say(person ? 'סליחה! לא ראיתי את העגלה.' : pick(HIT_LINES), 2, 1);
  // back to the last sidewalk she stood on
  hop = { fx: hx, fz: hz, tx: hx, tz: lastSafe, t: 0 }; hz = lastSafe;
  if (tut.on && tut.step().hitOk) tut.wait = { done: true };
}

// ───────────────────────── waiting, riding ─────────────────────────
// a bus pulls up next to the stop, Hani gets on
function boardBus(line) {
  state = 'wait'; setPose('walk');
  const at = line === 1 ? nextBus1() : (clock <= bus2At ? bus2At : bus2At + Math.ceil((clock - bus2At) / 600) * 600);
  const close = line === 2 && at === bus2At && bus2At - clock < 15;
  if (at - clock > 20) say(line === 1 ? 'קו 1 יגיע, בעזרת השם. מחכים בסבלנות.' : 'פספסנו את קו 2... הבא בעוד עשר דקות.', 2.6, 2);
  ffTo = at;
  waitThen = () => {
    const zn = zoneAt(hx, hz), z = zn.z, dir = -1;
    const bus = vehicle('bus', world.group, dir); bus.position.set(9, 0, z - .45);
    play('bus', .5);
    tween(1.4, k => { bus.position.x = 9 - (9 - hx) * (1 - Math.pow(1 - k, 3)); }, () => {
      play('door', .6);
      if (close) { ninBanner(150); score += 150; say('נס בתוך נס! עליתי ברגע האחרון.', 2.4, 3); }
      tween(.4, k => { hani.position.z = z + .5 - k * .7; haniFig.material.opacity = 1 - k; }, () => {
        hani.visible = false;
        setTimeout(() => tween(1.2, k => { bus.position.x = hx - k * k * 12; }, () => ride(line === 1 ? 'bus1' : 'bus2')), 300);
      });
    });
  };
}
function goRail() {
  state = 'wait'; ffTo = null; play('step', .4);
  tween(.6, k => { hani.position.y = -k * .9; haniFig.material.opacity = 1 - k * .8; }, () => { hani.visible = false; ride('rail'); });
}
let waitThen = null;
const rideEl = $('ride');
function ride(kind) {
  state = 'ride'; chips(); ffTo = null;
  buildRide(kind);
  let wait = 0, dur, sub = '', bad = false;
  if (kind === 'rail') {
    wait = Math.max(0, nextTrain() - clock); dur = 8 * 60;
    sub = info.railDelay ? `עיכוב ברכבת: ${info.railDelay} דקות` : 'בלי פקקים, ברוך השם';
    bad = !!info.railDelay; play('chime', .6); setTimeout(() => play('tram', .6), 600);
    say(pick(['ברכבת הקלה, ישר לבני ברק. בינתיים – פרק תהילים.', 'יושבת, ואומרת תהילים עד בני ברק.']), 2.8, 1);
  } else {
    const j = jam() * (kind === 'bus2' ? .6 : 1);
    dur = (kind === 'bus1' ? 5 * 60 : 4 * 60) + j;
    sub = j > 150 ? `פקק! עוד ${mins(j)} דקות` : j > 60 ? 'קצת עומס בדרך' : 'הכביש פנוי, ברוך השם';
    bad = j > 150; play('bus', .6);
    say(j > 150 ? 'פקק בז׳בוטינסקי. נאמר עוד פרק תהילים בינתיים.' : pick(['יושבת באוטובוס, ואומרת תהילים.', 'כל נסיעה – עוד פרק תהילים, ברוך השם.']), 2.8, 1);
    // Brachi calls on the way home
    if (kind === 'bus1' && Math.random() < .5) setTimeout(() => { if (state === 'ride') { play('phone-ring', .5, 1, true); setTimeout(() => { play('brachi-12', 1, 1, true); say('ברכי בטלפון: ״טוב, אמא, מתי את חוזרת?״', 2.2, 3, true); setTimeout(() => say('בעזרת השם, עם מלכי מהגן. בקרוב.', 2.4, 3), 2300); }, 1200); } }, 300);
  }
  $('rideH').textContent = kind === 'rail' ? 'ברכבת הקלה' : kind === 'bus1' ? 'בקו 1' : 'בקו 2';
  $('rideS').textContent = (wait > 30 ? `מחכים לרכבת ${mins(wait)} דק׳ · ` : '') + sub; $('rideS').classList.toggle('bad', bad);
  rideEl.classList.add('on');
  const from = clock, to = clock + wait + dur, real = 3.4;
  tween(real, k => { clock = from + (to - from) * k; rideT = k; }, () => {
    rideEl.classList.remove('on');
    if (clock >= DEADLINE) { late(); return; }
    if (kind === 'bus1') { bus2At = clock + 150; startBoard('transfer', -2); say('יורדים, ועכשיו מהר לקו 2!', 2.2, 2); }
    else startBoard(kind === 'rail' ? 'bbRail1' : 'bbBus', kind === 'rail' ? 0 : 1);
    if (kind === 'rail') say('בני ברק. עכשיו ברגל לגן.', 2.2, 1);
  });
}
let rideT = 0, rideObjs = null;
function buildRide(kind) {
  if (world) { scene.remove(world.group); world = null; }
  if (rideObjs) scene.remove(rideObjs.g);
  const g = new THREE.Group(); scene.add(g); rideObjs = { g, kind, back: [], cars: [] };
  viewZ0 = -1.2; viewRows = 1.0; camTilt = .4; viewHalfW = 1.55;
  const rail = kind === 'rail';
  scene.background.set(rail ? 0x141822 : 0x9fd3f2);
  // outside the windows: the city going by, or the tunnel lights
  if (rail) {
    box(40, 4, .3, 0x262b36, 0, 1.5, -3.2, g);
    for (let i = 0; i < 14; i++) rideObjs.back.push(box(1.4, .12, .05, mat(0xfff2c0, { emissive: 0xffe7a0, emissiveIntensity: 1.3 }), -20 + i * 3, 1.6, -3.0, g));
  } else {
    plane(40, 3, mat(0x4a4e57), 0, 0, -3.4, g);
    for (let i = 0; i < 9; i++) rideObjs.back.push(box(2.1, rnd(2.5, 4), 1.2, mat(0xffffff, { map: windowsTex(pick(['#efe3cc', '#e6d8bd', '#dfe9f2']), '#6f8fae', 4, 6, true) }), -18 + i * 4.4, 1.6, -5.2, g));
    for (let i = 0; i < 5; i++) { const c = vehicle(pick(['car', 'car', 'van']), g, 1); c.position.set(-14 + i * 6, 0, -3.4); rideObjs.cars.push(c); }
  }
  // the inside: floor, the wall with big windows, a row of seats
  const wallC = rail ? 0xf2f2f2 : 0xe9efe9, seatC = rail ? 0xc9303f : 0x2f6fd1;
  plane(12, 3.4, mat(rail ? 0x8d939c : 0x6f7b74), 0, .01, .3, g);
  box(12, .9, .12, wallC, 0, .45, -1.3, g); box(12, .5, .12, wallC, 0, 2.45, -1.3, g);
  for (let x = -6; x <= 6; x += 2.4) box(.22, 1.6, .14, wallC, x, 1.7, -1.3, g);
  box(12, .06, .06, 0xb8bec7, 0, 2.1, -.2, g); // the hand rail
  for (let x = -4.8; x <= 4.8; x += 1.2) {
    box(.95, .14, .7, seatC, x, .62, -.85, g); box(.95, .8, .14, seatC, x, 1.05, -1.18, g);
    box(.08, .55, .08, 0x9aa3ad, x, .3, -.75, g);
  }
  if (rail) box(12, .14, 1.3, 0xd6283a, 0, 2.7, -1.3, g);
  // hand straps along the rail
  for (let x = -5.85; x <= 5.85; x += .9) { box(.02, .25, .02, 0x9aa3ad, x, 1.96, -.2, g); mesh(new THREE.TorusGeometry(.07, .015, 6, 14), mat(0xf2f2f2), x, 1.78, -.2, g); }
  // Hani in the middle seat, saying tehilim
  hani.visible = true; setPose('sit'); haniFig.material.opacity = 1; haniShadow.visible = false;
  haniFig.material.depthTest = false; haniFig.renderOrder = 10; // she sits in front of her seat, never cut by it
  hani.position.set(0, .14, -.4); haniFig.scale.set(HANI_H * .82 * 460 / 600, HANI_H * .82, 1);
  fitCamera();
}
function updRide(dt) {
  if (!rideObjs || state !== 'ride') return;
  const slow = rideObjs.kind !== 'rail' && $('rideS').classList.contains('bad');
  const v = (rideObjs.kind === 'rail' ? 16 : 7) * (slow ? .2 + .3 * Math.max(0, Math.sin(now * 2)) : 1);
  for (const b of rideObjs.back) { b.position.x -= v * dt; if (b.position.x < -20) b.position.x += rideObjs.kind === 'rail' ? 42 : 39.6; }
  for (const c of rideObjs.cars) { c.position.x -= v * dt * .4; if (c.position.x < -16) c.position.x += 30; }
  rideObjs.g.position.y = Math.sin(now * 13) * .012; // the gentle rocking
}
function endRide() { if (rideObjs) { scene.remove(rideObjs.g); rideObjs = null; } scene.background.set(0x9fd3f2); camTilt = 1.35; viewHalfW = 4.7; haniShadow.visible = true; haniFig.material.depthTest = true; haniFig.renderOrder = 0; haniFig.scale.set(HANI_H * 460 / 600, HANI_H, 1); }

// ───────────────────────── the gan ─────────────────────────
function reachGan() {
  state = 'arrive'; setPose('joy');
  const m = world.malki, z = hz;
  play('kids-ima-1', .8, 1, true); play('arrive', .7);
  tween(.7, k => { m.position.z = z + 1.5 - k * .9; m.position.y = Math.abs(Math.sin(k * 9)) * .1; m.userData.arms.forEach(a => a.rotation.x = -2.4 * k); });
  const early = DEADLINE - clock;
  let pts = 100 + Math.round(early / 60 * 20);
  const close = early < 40;
  if (close) { pts += 150; ninBanner(150); }
  score += pts;
  say(close ? 'נס בתוך נס! ממש ברגע האחרון.' : 'מלכי׳לה! אמא כאן. ברוך השם.', 3, 3);
  setTimeout(() => {
    $('arrH').textContent = `הגענו ב־${fmt(clock)}!`;
    $('arrLine').textContent = early > 300 ? `עוד ${mins(early)} דקות עד שהגן נסגר. מלכי שמחה, ברוך השם.` : early > 60 ? `${mins(early)} דקות לפני שהגן נסגר. ברוך השם.` : 'ממש ברגע האחרון. הגננת חייכה, ברוך השם.';
    $('arrPts').textContent = '+' + pts; hud(); show('arrived'); state = 'between';
  }, 1900);
}
function late() {
  state = 'over'; window.track && track('game_over', 'gan-run'); setMusicRate(1); play('late', .7);
  const prev = best(), rec = score > prev;
  if (rec) store.set(KEY.best, score);
  $('overLine').textContent = `השעה ${fmt(Math.max(clock, DEADLINE))}. הגננת חיכתה עם מלכי – תודה לה, ברוך השם. מחר נצא מוקדם יותר, בלי נדר.`;
  $('overScore').textContent = score;
  $('overRec').innerHTML = rec && score > 0 ? '<span class="newrec">שיא חדש!</span>' : '';
  $('bestOver').innerHTML = `השיא שלך: <b>${Math.max(prev, score)}</b> · ימים שהצלחת: <b>${day - 1}</b>`;
  show('over'); playing(false);
}
const best = () => +(store.get(KEY.best) || 0);

// ───────────────────────── tweens ─────────────────────────
const tweens = [];
function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); }
function updTweens(dt) { for (const t of tweens.slice()) { t.t += dt; const k = Math.min(1, t.t / t.dur); t.fn(k); if (k >= 1) { tweens.splice(tweens.indexOf(t), 1); t.done && t.done(); } } }

// ───────────────────────── input: swipe, tap beside Hani, keys ─────────────────────────
let sw = null;
canvas.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, t: performance.now() }; });
addEventListener('pointerup', e => {
  if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
  if (Math.hypot(dx, dy) > 22) { if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0); else tryMove(0, dy > 0 ? 1 : -1); return; }
  // a tap: step towards the tap, seen from Hani
  const s = toScreen(V(hani.position.x, .8, hani.position.z)), tx = e.clientX - s.x, ty = e.clientY - s.y;
  if (Math.abs(tx) > Math.abs(ty) * 1.2) tryMove(tx > 0 ? 1 : -1, 0); else tryMove(0, ty > 0 ? 1 : -1);
});
addEventListener('keydown', e => {
  const k = e.key;
  if (tut.on && (k === ' ' || k === 'Enter')) { e.preventDefault(); if (!$('tutNext').disabled) tut.next(); return; }
  if (tut.on && k === 'Escape') { tut.end(); return; }
  if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'ד') tryMove(0, 1);
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === '׳') tryMove(0, -1);
  else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ש') tryMove(-1, 0);
  else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'ג') tryMove(1, 0);
  else if ((k === 'p' || k === 'Escape') && (state === 'board' || state === 'wait' || state === 'ride')) setPaused(true);
});

// ───────────────────────── screens / flow ─────────────────────────
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function playing(on) { $('hud').style.display = on ? 'flex' : 'none'; if (!on) $('chips').innerHTML = ''; }
function showBest() { const b = best(); $('bestStart').innerHTML = b ? `השיא שלך: <b>${b}</b>` : ''; }
function dayCard() {
  newDay(); clock = 0; state = 'daycard'; endRide();
  buildBoard('office'); placeHani(0, 0); setPose('walk');
  $('dayH').textContent = 'יום ' + day;
  $('dayLine').innerHTML = day === 1 ? 'השעה 4:20. מלכי מחכה בגן בבני ברק, והגן נסגר ב־4:45. איך נוסעים היום?' : 'שוב 4:20. מה אומר השלט היום?';
  $('dayChips').innerHTML =
    `<div class="chip">${SVG.bus}<span>קו 1 מגיע בעוד <b>${mins(info.bus1)} דק׳</b>, ואחריו החלפה לקו 2. התחנה קרובה.</span></div>`
    + `<div class="chip ${info.traffic === 2 ? 'bad' : info.traffic === 0 ? 'good' : ''}">${SVG.jam}<span>עומס בכבישים: <b>${['קל', 'בינוני', 'כבד'][info.traffic]}</b></span></div>`
    + `<div class="chip ${info.railDelay ? 'bad' : ''}">${SVG.rail}<span>${info.railDelay ? `ברכבת הקלה <b>עיכוב של ${info.railDelay} דק׳</b>.` : 'רכבת קלה כל <b>6 דקות</b>, בלי פקקים.'} התחנה רחוקה יותר.</span></div>`;
  show('dayCard'); playing(true); hud();
}
function go() { if (day === 1) window.track && track('game_start', 'gan-run'); show(null); startBoard('office'); say(day === 1 ? 'השעה 4:20. בעזרת השם, מגיעים למלכי בזמן.' : pick(['יוצאים! מלכי מחכה.', '4:20. סוגרת את המחשב ויוצאת.', 'בעזרת השם, היום בלי פקקים.']), 2.6, 1); }
$('playBtn').addEventListener('click', () => { if (!store.get(KEY.tut)) tut.begin(); else { day = 1; score = 0; dayCard(); } });
$('howBtn').addEventListener('click', () => tut.begin());
$('goBtn').addEventListener('click', go);
$('nextBtn').addEventListener('click', () => { day++; dayCard(); });
$('againBtn').addEventListener('click', () => { day = 1; score = 0; dayCard(); });
function setPaused(on) {
  if (state === 'menu' || state === 'over' || state === 'daycard' || state === 'between') return;
  paused = on; show(on ? 'paused' : null);
  if (SND.ctx) on ? SND.ctx.suspend() : SND.ctx.resume();
}
$('pauseBtn').addEventListener('click', () => setPaused(true));
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('quitBtn').addEventListener('click', () => { paused = false; if (SND.ctx) SND.ctx.resume(); toMenu(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { hush(); if (state === 'board' || state === 'wait' || state === 'ride') setPaused(true); } else if (!paused && SND.ctx) SND.ctx.resume(); });
addEventListener('pageshow', e => { if (e.persisted && (state === 'board' || state === 'wait' || state === 'ride')) setPaused(true); });
function toMenu() {
  tut.on = false; $('tutCard').classList.remove('on'); $('tutDim').classList.remove('on');
  state = 'menu'; endRide(); tweens.length = 0; buildBoard('office'); placeHani(0, 0);
  playing(false); show('start'); showBest(); sayEl.classList.remove('on');
}

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
const worldSpot = (fn, r = 60) => () => { const s = toScreen(fn()); return { x: s.x, y: s.y, r }; };
const rectSpot = el => () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + 8 }; };
const zoneSpot = to => worldSpot(() => { const q = world.zones.find(z => z.to === to); return V((q.x0 + q.x1) / 2, .6, q.z + .5); }, 70);
const STEPS = [
  { text: 'זו <b>חני</b>. השעה <b>4:20</b>, והיא יוצאת עכשיו מחברת ההייטק.', spot: worldSpot(() => V(hani.position.x, 1, hani.position.z), 70) },
  { text: '<b>המטרה:</b> להגיע לגן של <b>מלכי</b> בבני ברק לפני שהגן נסגר ב־<b>4:45</b>. השעון כאן למעלה רץ כל הזמן.', spot: rectSpot($('clock')) },
  { text: '<b>הולכים:</b> החליקו עם האצבע למטה, או הקישו מתחת לחני. נסו עכשיו – צעד אחד למטה.', move: true, wait: true, spot: worldSpot(() => V(hani.position.x, .6, hani.position.z + 1), 60) },
  { text: 'גם <b>ימינה ושמאלה</b> – מחליקים או מקישים לצד שלה. אפשר גם לחזור אחורה למעלה.', move: true },
  { text: '<b>מכוניות, אוטובוסים וקורקינטים!</b> מי שנתקלת בהם חוזרת למדרכה האחרונה – וזה עולה זמן. מדרכה ואי תנועה ירוק = בטוח.', spot: worldSpot(() => V(0, .3, 3), 90) },
  { text: 'הדרך בנויה מ<b>רחובות</b>: בסוף כל רחוב יש חץ שמוביל לרחוב הבא. כאן בוחרים: <b>לאוטובוס</b> משמאל, או <b>לרכבת הקלה</b> מימין.', spot: worldSpot(() => V(0, .4, 7.5), 120) },
  { text: '<b>דרך 1 – שני אוטובוסים:</b> התחנה של <b>קו 1</b> רק רחוב אחד מכאן. אחר כך יורדים, חוצים צומת, ותופסים את <b>קו 2</b> לפני שהוא יוצא. בפקקים האוטובוס נתקע.', spot: zoneSpot('toBus') },
  { text: '<b>דרך 2 – הרכבת הקלה:</b> התחנה רחוקה יותר – עוד שני רחובות לחצות – אבל ברכבת אין פקקים. מבני ברק – עוד שני רחובות עד הגן.', spot: zoneSpot('rail1') },
  { text: 'בדרך, ברכבת או באוטובוס, חני יושבת ואומרת <b>תהילים</b>.' },
  { text: 'השלטים למעלה אומרים <b>מתי מגיע קו 1</b>, כמה <b>עומס</b> יש, ואם יש <b>עיכוב ברכבת</b>. מחליטים לפי זה!', spot: rectSpot($('chips')) },
  { text: 'מגיעים לגן לפני 4:45 = יום מוצלח, וכל דקה שנשארה = נקודות. ממש ברגע האחרון? זה <b>נס בתוך נס!</b>' },
  { text: 'כל יום התנועה קצת יותר עמוסה. <b>בהצלחה, ובשורות טובות!</b>', last: true },
];
const tut = {
  on: false, i: 0, wait: null,
  step() { return STEPS[this.i] || {}; },
  begin() {
    day = 1; score = 0; newDay(); clock = 0; endRide();
    show(null); startBoard('office'); playing(true); hud();
    this.on = true; this.i = 0; tutCard.classList.add('on'); $('tutDim').classList.add('on'); this.enter();
  },
  enter() {
    const s = this.step();
    this.wait = s.wait ? { done: false } : null;
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').firstChild.nodeValue = s.last ? 'יוצאים! ' : 'הבא ';
    $('tutDim').classList.toggle('on', !s.move);
  },
  next() { if (this.step().last) { this.end(); return; } this.i++; this.enter(); },
  end() {
    this.on = false; store.set(KEY.tut, '1'); tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    day = 1; score = 0; dayCard();
  },
};
$('tutNext').addEventListener('click', () => tut.next());
$('tutSkip').addEventListener('click', () => tut.end());
function updTut() {
  if (!tut.on) return;
  const s = tut.step();
  $('tutNext').disabled = !!(tut.wait && !tut.wait.done);
  const sp = s.spot && s.spot();
  if (sp && !s.move) { tutHole.style.display = 'block'; Object.assign(tutHole.style, { left: sp.x - sp.r + 'px', top: sp.y - sp.r + 'px', width: sp.r * 2 + 'px', height: sp.r * 2 + 'px' }); }
  else tutHole.style.display = 'none';
}

// ───────────────────────── main loop ─────────────────────────
let last = performance.now(), realDt = 0;
const TEST_SPEED = +(new URLSearchParams(location.search).get('speed')) || 1; // tests only
function frame(t) {
  requestAnimationFrame(frame);
  realDt = Math.min(.05, (t - last) / 1000) * TEST_SPEED; last = t;
  const dt = paused ? 0 : realDt;
  now += dt;
  if (!paused) {
    updTweens(dt);
    if (state !== 'ride') updLanes(tut.on ? dt * .6 : dt);
    updRide(dt);
    updHani(dt);
    if (state === 'board' && !tut.on) {
      clock += dt * WALK_RATE;
      checkHit();
      if (clock >= DEADLINE) late();
      if (world.id === 'transfer' && clock > bus2At + 1 && !world.missed) { world.missed = true; say('קו 2 יצא בלעדיי... הבא בעוד עשר דקות.', 2.8, 2); }
    } else if (state === 'board') checkHit();
    if (state === 'wait' && ffTo !== null) {
      // waiting at the stop: the clock runs fast
      clock = Math.min(ffTo, clock + dt * 160);
      if (clock >= DEADLINE) { ffTo = null; late(); }
      else if (clock >= ffTo) { ffTo = null; const f = waitThen; waitThen = null; f && f(); }
    }
    if (world && world.malki && state !== 'arrive') world.malki.rotation.y = Math.sin(now * 2) * .3;
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) { sayEl.classList.remove('on'); sayPri = 0; } }
    setMusicRate(state === 'board' && clock > DEADLINE - 300 ? 1.12 : 1);
    if (Math.floor(now * 4) !== Math.floor((now - dt) * 4)) { hud(); chips(); }
  }
  updTut();
  renderer.render(scene, camera);
}

// ───────────────────────── boot ─────────────────────────
loadModels().then(() => {
  buildBoard('office'); placeHani(0, 0);
  $('loading').style.display = 'none'; showBest();
  requestAnimationFrame(frame);
});
window.__game = { get state() { return state; }, get clock() { return clock; }, get world() { return world; }, get hx() { return hx; }, get hz() { return hz; }, get day() { return day; }, get score() { return score; }, tryMove, tut, go, dayCard, ride, SND, setClock: v => { clock = v; } };
