// ניסי ניסים! – Hani Friedman keeps a Bnei Brak home and a hi-tech office from falling apart.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const KEY = { best: 'hani-games:nisei-nissim:best', tut: 'hani-games:nisei-nissim:tut', snd: 'hani-games:nisei-nissim:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// ───────────────────────── renderer / camera ─────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1640);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
let W = innerWidth, H = innerHeight, sayBand = 0;
const TOP_PAD = 62, BOT_PAD = 70;
let SAY_H = 0; // portrait: a strip above the meter where Hani talks, never over the game

function fitCamera() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  const portrait = H > W * 1.1;
  SAY_H = portrait ? 84 : 0;
  const dir = (portrait ? V(0, 1.12, 1) : V(0.25, 1.0, 1.05)).normalize();
  const target = V(0, 0, -1.2);
  camera.position.copy(target).addScaledVector(dir, 50);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const x of [-4.4, 4.4]) for (const z of [-8.2, 7.4]) for (const y of [0, 2.6]) {
    const p = V(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const s = Math.max((x1 - x0) / (W - 12), (y1 - y0) / (H - TOP_PAD - BOT_PAD - SAY_H));
  const cx = (x0 + x1) / 2;
  // the diorama hangs from the top; the free band at the bottom is where Hani talks
  camera.left = cx - W / 2 * s; camera.right = cx + W / 2 * s;
  camera.top = y1 + (TOP_PAD + 6) * s; camera.bottom = camera.top - H * s;
  sayBand = (H - BOT_PAD) - ((camera.top - y0) / s);
  camera.updateProjectionMatrix();
}
addEventListener('resize', fitCamera);

const _p = new THREE.Vector3();
function toScreen(v) { _p.copy(v).project(camera); return { x: (_p.x + 1) / 2 * W, y: (1 - _p.y) / 2 * H }; }

// ───────────────────────── light ─────────────────────────
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a8a, 1.25));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -10, near: 1, far: 40 });
sun.shadow.bias = -0.0008;
sun.target.position.set(0, 0, -1);
scene.add(sun, sun.target);

// ───────────────────────── helpers ─────────────────────────
const mats = {};
function mat(c, o = {}) {
  const k = c + JSON.stringify(o);
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .75, ...o }));
}
function mesh(geo, m, x = 0, y = 0, z = 0, parent = scene) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
function box(w, h, d, c, x, y, z, parent = scene, o) { return mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c, o) : c, x, y, z, parent); }
function cyl(rt, rb, h, c, x, y, z, parent = scene, seg = 16) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? mat(c) : c, x, y, z, parent); }
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ───────────────────────── the world (Blender models: assets/models/*.glb) ─────────────────────────
const P = { // where things are
  counterTop: 1.1, stove: V(-3.45, 1.1, -7.45), sink: V(-2.2, 1.1, -7.45), dairySink: V(-0.95, 1.1, -7.45), diapers: V(3.25, .55, -1.05), malkiCounter: V(-0.95, 1.1, -7.45),
  cupboard: V(1.45, 0, -7.55), sruliClimb: V(1.45, 1.35, -6.9), couch: V(2.6, .5, -1.0),
  rug: V(0.2, 0, -3.5), stairsFoot: V(3.4, 0, -4.9), washer: V(-3.85, 0, -5.4), table: V(-2.0, 0, -3.7),
  desk: V(0, 0, 6.35), hani: V(0, 0, 5.75), phone: V(-1.05, .93, 6.6), tzedaka: V(1.1, .93, 6.45),
  tehilim: V(.55, .93, 6.75), cookies: V(-.35, .93, 6.8), server: V(-3.7, 0, 1.2),
  yotam: V(3.3, 0, 3.6), printer: V(3.6, 0, 5.2), yotamAsk: V(2.05, 0, 5.3), erez: V(2.6, 0, 1.45), erezDesk: V(2.6, 0, 2.05),
};
const MODEL_KEYS = ['counter', 'counter_sink', 'counter_stove', 'fridge', 'wardrobe', 'washer', 'dining_table', 'chair', 'sofa',
  'tall_plant', 'plant', 'bookshelf', 'desk', 'desk_chair', 'filing_cabinet', 'whiteboard', 'side_table',
  'kid_boy', 'kid_cast', 'kid_girl', 'kid_arm', 'kid_head_boy', 'kid_head_girl', 'man_head',
  'man_head_glasses', 'baby', 'server_rack', 'keypad_phone', 'tzedaka_box', 'laptop_base', 'laptop_lid', 'pot', 'stairs',
  'cookie_plate', 'cookie', 'tehilim', 'hani_desk'];
const models = {};
function loadModels(onP) {
  // every model of the game comes in one file: assets/models.json = { key: base64 .glb } (built by tools/pack-models.py)
  const L = new GLTFLoader(); let n = 0;
  return fetch('assets/models.json').then(r => r.json()).then(pack => Promise.all(MODEL_KEYS.map(k => new Promise(res => {
    if (!pack[k]) { console.warn('model missing', k); res(); return; }
    const bin = Uint8Array.from(atob(pack[k]), c => c.charCodeAt(0)).buffer;
    L.parse(bin, '', g => {
      g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      models[k] = g.scene; onP && onP(++n / MODEL_KEYS.length); res();
    }, () => res());
  }))));
}
// a copy of a model, placed; materials are shared unless tinted
function M3(k, x = 0, y = 0, z = 0, ry = 0, s = 1, parent = scene) {
  const src = models[k]; const o = src ? src.clone(true) : new THREE.Group();
  o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); parent.add(o); return o;
}
function matsOf(o, name) { const out = []; o.traverse(m => { if (m.isMesh && m.material && m.material.name === name) out.push(m); }); return out; }
function tint(o, name, color, emissive) {
  const ms = matsOf(o, name);
  if (!ms.length) return null;
  const mt = ms[0].material.clone(); mt.color.set(color); if (emissive !== undefined) mt.emissive.set(emissive);
  ms.forEach(m => m.material = mt); return mt;
}

function buildWorld() {
  // floors
  const wood = canvasTex(512, 512, (g, w) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = ['#d9a66b', '#d29b5f', '#dcaa72', '#cf9858'][i % 4]; g.fillRect(0, i * 64, w, 64);
      g.fillStyle = '#00000018'; g.fillRect(0, i * 64, w, 3);
      g.fillRect(((i * 197) % 400) + 40, i * 64, 3, 64);
    }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
  const fh = mesh(new THREE.PlaneGeometry(8.7, 8.2), new THREE.MeshStandardMaterial({ map: wood, roughness: .8 }), 0, .005, -3.95);
  fh.rotation.x = -Math.PI / 2; fh.castShadow = false;
  const carpet = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8391bd'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < .5 ? '#8b98c3' : '#7988b3'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = '#6d7aa3'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(4, 3);
  const fo = mesh(new THREE.PlaneGeometry(8.7, 7.3), new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }), 0, .005, 3.7);
  fo.rotation.x = -Math.PI / 2; fo.castShadow = false;
  box(8.9, .35, 15.8, 0xf3e6d6, 0, -.18, -.35).castShadow = false;

  // walls (cut-away: back + left), not casting sun shadows
  const walls = [
    box(8.7, 2.6, .15, 0xf6ead7, 0, 1.3, -8.1), box(.15, 2.6, 8.2, 0xf1e2cb, -4.38, 1.3, -3.95),
    box(8.7, .55, .2, 0xffffff, 0, .27, 0), box(.15, 2.2, 7.3, 0xdfe6f2, -4.38, 1.1, 3.7),
  ];
  walls.forEach(w => w.castShadow = false);
  for (let i = 0; i < 4; i++) box(.04, 1.1, 1.3, 0x9fd3ff, -4.29, 1.25, 1.0 + i * 1.8, scene, { emissive: 0x5aa8ff, emissiveIntensity: .35, roughness: .2 }).castShadow = false;
  box(1.5, .95, .05, 0xbfe4ff, -2.6, 1.95, -8.0, scene, { emissive: 0x8fc9ff, emissiveIntensity: .4 }).castShadow = false;
  box(1.2, .8, .04, 0xffffff, 2.9, 1.9, -8.0).castShadow = false;                 // a framed picture
  box(1.05, .65, .05, 0x7aa6c9, 2.9, 1.9, -7.97, scene, { emissive: 0x3a5a7a, emissiveIntensity: .2 }).castShadow = false;

  const F = 1.25; // library furniture is in real metres; the cast is cartoon-sized
  M3('counter_stove', P.stove.x, 0, -7.55, 0, F); const meatC = M3('counter_sink', P.sink.x, 0, -7.55, 0, F); M3('counter_sink', P.dairySink.x, 0, -7.55, 0, F);
  {
    // a red towel and a sign at the meat sink, a blue one at the dairy sink
    const b = new THREE.Box3().setFromObject(meatC), front = b.max.z + .02;
    for (const [x, c, he] of [[P.sink.x, '#d23b45', 'בשרי'], [P.dairySink.x, '#2f6fd1', 'חלבי']]) {
      box(.26, .34, .025, c === '#d23b45' ? 0xd23b45 : 0x2f6fd1, x + .3, .82, front).castShadow = false;
      const t = canvasTex(160, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(4, 4, w - 8, h - 8); g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(he, w / 2, h / 2 + 2); });
      const sign = mesh(new THREE.PlaneGeometry(.5, .2), new THREE.MeshBasicMaterial({ map: t }), x, 1.36, -8.01); sign.castShadow = false;
    }
    // the oven door of the stove counter, glowing when someone left it on
    ovenGlow = box(.62, .3, .02, mat(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 1.2 }).clone(), P.stove.x, .42, front - .005);
    ovenGlow.castShadow = false; ovenGlow.visible = false; ovenFront = V(P.stove.x, .45, front + .1);
  }
  const fridge = M3('fridge', 0.15, 0, -7.6, 0, F);
  {
    // the fridge door that swings open, with the cold light inside
    const b = new THREE.Box3().setFromObject(fridge), w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    fridgeDoor = new THREE.Group(); fridgeDoor.position.set(b.max.x, 0, b.max.z + .02); scene.add(fridgeDoor);
    box(w, h - .06, .07, 0xeef0f2, -w / 2, h / 2, .035, fridgeDoor);
    box(.05, h * .35, .06, 0x9aa3ad, -w + .1, h * .62, .1, fridgeDoor);
    fridgeLight = box(w * .86, h * .86, .02, mat(0xe6f6ff, { emissive: 0xcfeeff, emissiveIntensity: .9 }), (b.min.x + b.max.x) / 2, h / 2, b.max.z + .015);
    fridgeDoor.visible = fridgeLight.visible = false; fridgeTop = V((b.min.x + b.max.x) / 2, h + .35, b.max.z + .2);
  }
  M3('wardrobe', P.cupboard.x, 0, P.cupboard.z, 0, 1.15);
  M3('stairs', 3.65, 0, -6.6, Math.PI, 1);
  M3('washer', P.washer.x, 0, P.washer.z, Math.PI / 2, F);
  M3('dining_table', P.table.x, 0, P.table.z, 0, 1.0);
  for (const dx of [-.55, .55]) M3('chair', P.table.x + dx, 0, P.table.z - 1.0, 0, F);
  M3('sofa', P.couch.x, 0, -1.1, 0, .95);
  diaperPack = new THREE.Group(); diaperPack.position.copy(P.diapers); scene.add(diaperPack);
  box(.42, .3, .26, 0xffffff, 0, .15, 0, diaperPack); box(.43, .08, .27, 0x7ac8ff, 0, .2, 0, diaperPack); box(.12, .12, .27, 0xffd34a, .1, .1, .005, diaperPack);
  M3('bookshelf', -4.05, 0, -1.9, Math.PI / 2, F);
  M3('tall_plant', 4.0, 0, -1.2, 0, F);
  // rug, blocks and a half-built golden altar
  const rugT = canvasTex(256, 256, (g, w) => {
    const cs = ['#e85d75', '#ffcf5a', '#4fb3d9', '#7ccf6b', '#f7f1e3'];
    for (let r = 6; r >= 0; r--) { g.fillStyle = cs[r % cs.length]; g.beginPath(); g.arc(w / 2, w / 2, (r + 1) * 18, 0, 7); g.fill(); }
  });
  const rug = mesh(new THREE.CircleGeometry(1.35, 40), new THREE.MeshStandardMaterial({ map: rugT, roughness: 1 }), P.rug.x, .015, P.rug.z);
  rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
  const gold = mat(0xf2c037, { metalness: .6, roughness: .3 });
  for (let i = 0; i < 12; i++) box(.16, .1, .16, gold, .7 + (i % 3) * .17, .05 + Math.floor(i / 9) * .1, -3.0 + Math.floor((i % 9) / 3) * .17);
  for (const c of [0xe5484d, 0x3b82f6, 0xffc94a, 0x2bb673]) box(.18, .1, .12, c, rnd(-.7, .1), .05, rnd(-4.1, -3.0)).rotation.y = rnd(3);

  // office
  M3('hani_desk', P.desk.x, 0, P.desk.z, 0, 1);
  M3('laptop_base', -.55, .935, 6.25, .35, .9);
  laptopLid = M3('laptop_lid', -.62, .955, 6.06, Math.PI + .35, .9); laptopLid.rotation.x = .2;
  laptopLidMat = tint(laptopLid, 'lidback', 0xc5cbd3, 0x000000);
  phoneObj = M3('keypad_phone', P.phone.x, P.phone.y, P.phone.z, -.3, 1.2);
  M3('tzedaka_box', P.tzedaka.x, P.tzedaka.y, P.tzedaka.z, .2, 1.2);
  M3('tehilim', P.tehilim.x, P.tehilim.y, P.tehilim.z, -.4, 1.2);
  M3('cookie_plate', P.cookies.x, P.cookies.y, P.cookies.z, 0, 1.25);
  const rack = M3('server_rack', P.server.x, 0, P.server.z, Math.PI / 2, 1);
  serverLed = tint(rack, 'led', 0x2bff88, 0x2bff88);
  M3('desk', P.erezDesk.x, 0, P.erezDesk.z, 0, F);
  erezScreen = box(.7, .45, .05, mat(0x1b2030, { emissive: 0x2a4a8a, emissiveIntensity: .6 }).clone(), P.erezDesk.x - .35, 1.32, P.erezDesk.z + .05);
  const wb = M3('whiteboard', -4.15, 0, 3.6, Math.PI / 2, F);
  {
    // marker boxes and arrows on the board, to be wiped before the meeting
    const b = new THREE.Box3().setFromObject(wb), dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
    const ink = canvasTex(256, 160, (g, w, h) => {
      g.lineWidth = 5; g.lineCap = 'round';
      const cs = ['#2f6fd1', '#e5484d', '#2bb673', '#222'];
      for (let i = 0; i < 6; i++) { g.strokeStyle = cs[i % 4]; g.strokeRect(14 + (i % 3) * 82, 18 + Math.floor(i / 3) * 74, 56, 38); }
      g.strokeStyle = '#222'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(70 + (i % 2) * 82, 37 + Math.floor(i / 2) * 74); g.lineTo(96 + (i % 2) * 82, 37 + Math.floor(i / 2) * 74); g.stroke(); }
      g.strokeStyle = '#e5484d'; g.beginPath(); g.moveTo(42, 56); g.quadraticCurveTo(60, 90, 42, 92); g.stroke();
    });
    boardInk = mesh(new THREE.PlaneGeometry(dz * .8, dy * .36), new THREE.MeshBasicMaterial({ map: ink, transparent: true, depthWrite: false }), b.max.x + .012, b.max.y - dy * .3, (b.min.z + b.max.z) / 2);
    boardInk.rotation.y = Math.PI / 2; boardInk.castShadow = false; boardInk.visible = false;
    boardSpot = V(b.max.x + .3, b.max.y + .1, (b.min.z + b.max.z) / 2);
  }
  // the office printer
  const pr = new THREE.Group(); pr.position.copy(P.printer); scene.add(pr);
  box(.9, .8, .7, 0xe6e9ee, 0, .4, 0, pr); box(.92, .14, .72, 0x3a3f48, 0, .87, 0, pr); box(.6, .05, .32, 0xffffff, 0, .62, .37, pr);
  printerLed = box(.08, .05, .02, mat(0x2bff88, { emissive: 0x2bff88, emissiveIntensity: 1 }).clone(), .32, .87, .37, pr).material;
  jamPaper = box(.5, .02, .34, 0xffffff, 0, 1.0, .1, pr); jamPaper.rotation.x = -.6; jamPaper.visible = false;
  // crayon on the living-room wall
  const cr = canvasTex(256, 160, (g, w, h) => {
    g.lineWidth = 7; g.lineCap = 'round';
    for (const c of ['#e5484d', '#2f6fd1', '#2bb673', '#ffb020']) { g.strokeStyle = c; g.beginPath(); g.moveTo(rnd(20, 230), rnd(20, 140)); for (let i = 0; i < 6; i++) g.quadraticCurveTo(rnd(10, 246), rnd(10, 150), rnd(10, 246), rnd(10, 150)); g.stroke(); }
    g.strokeStyle = '#ffb020'; g.beginPath(); g.arc(196, 44, 22, 0, 7); g.stroke();
  });
  scribble = mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshBasicMaterial({ map: cr, transparent: true, depthWrite: false }), -4.29, .78, -3.3);
  scribble.rotation.y = Math.PI / 2; scribble.castShadow = false; scribble.visible = false;
  M3('filing_cabinet', -3.95, 0, 6.6, Math.PI / 2, F);
  M3('tall_plant', 4.0, 0, 6.6, 0, F); M3('plant', -3.9, 0, -.6, 0, F); M3('tall_plant', 4.0, 0, .8, 0, F);
}
let ovenGlow, ovenFront, dishObj, diaperPack, laptopLid, laptopLidMat, phoneObj, serverLed, erezScreen, fridgeDoor, fridgeLight, fridgeTop, boardInk, boardSpot, printerLed, jamPaper, scribble;

// ───────────────────────── people ─────────────────────────
function makeKid(o) {
  const g = new THREE.Group(), s = o.s || 1;
  const body = M3(o.girl ? 'kid_girl' : o.cast ? 'kid_cast' : 'kid_boy', 0, 0, 0, 0, 1, g);
  if (o.shirt !== undefined) tint(body, 'shirt', o.shirt);
  if (o.bottom !== undefined) tint(body, 'pants', o.bottom);
  if (o.dress !== undefined) tint(body, 'dress', o.dress);
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (o.girl ? .17 : .2), .9, 0); g.add(pivot);
    const a = M3('kid_arm', 0, 0, 0, 0, 1, pivot);
    tint(a, 'shirt', o.girl ? (o.dress ?? 0x22306b) : (o.shirt ?? 0xfbfbfb));
    pivot.rotation.z = sx * .12; arms.push(pivot);
  }
  const head = new THREE.Group(); head.position.y = .93; g.add(head);
  const h = M3(o.head || (o.girl ? 'kid_head_girl' : 'kid_head_boy'), 0, 0, 0, 0, 1, head);
  if (o.hair !== undefined) tint(h, 'hair', o.hair);
  if (o.bow !== undefined) tint(h, 'bow', o.bow);
  g.scale.setScalar(s);
  g.userData = { arms, head, base: s };
  scene.add(g);
  return g;
}
function makeBaby() {
  const g = new THREE.Group();
  const b = M3('baby', 0, 0, 0, 0, 1.1, g);
  const limbs = []; b.traverse(m => { if (m.isMesh) limbs.push(m); });
  g.userData = { limbs: [], head: new THREE.Group(), base: 1, baby: true, body: b };
  scene.add(g);
  return g;
}

const kids = {};
function buildPeople() {
  const homes = {
    shterni: [V(-2.9, 0, -3.0), { girl: true, s: 1.12, dress: 0x22306b }], brachi: [V(-1.0, 0, -4.5), { girl: true, s: 1.05, dress: 0x3b4f8f, bow: 0x7ac8ff }],
    chaimi: [V(-2.0, 0, -2.5), { s: 1.0 }], sruli: [V(.7, 0, -6.2), { s: .97, cast: true }],
    feigi: [V(1.5, 0, -2.3), { girl: true, s: .93, dress: 0x6a3d8f, bow: 0xffd34a }], yanky: [V(-.3, 0, -3.2), { s: .88 }],
    ruchami: [V(.8, 0, -4.1), { girl: true, s: .82, dress: 0x2b5a8a, hair: 0x5a3a22 }], malki: [V(-1.2, 0, -6.3), { girl: true, s: .72, dress: 0xd0457a, hair: 0x6b4426 }],
  };
  for (const [k, [pos, o]] of Object.entries(homes)) {
    const kid = makeKid(o); kid.position.copy(pos); kid.rotation.y = rnd(-.4, .4);
    kid.userData.home = pos.clone(); kid.userData.homeRot = kid.rotation.y; kids[k] = kid;
  }
  const m = makeBaby(); m.position.set(1.9, 0, -2.8); m.userData.home = m.position.clone(); m.userData.homeRot = .6; m.rotation.y = .6; kids.moishi = m;
  const yotam = makeKid({ s: 1.55, shirt: 0x8fc1e8, bottom: 0x34507a, head: 'man_head', hair: 0x6a4428 });
  yotam.position.copy(P.yotam); yotam.rotation.y = -.5; yotam.userData.home = P.yotam.clone(); yotam.userData.homeRot = -.5; kids.yotam = yotam;
  box(.5, .03, .35, 0x9aa3ad, .02, .8, .25, yotam);    // his laptop
  const erez = makeKid({ s: 1.5, shirt: 0x6b6f7a, bottom: 0x2d2f36, head: 'man_head_glasses', hair: 0x1f1a17 });
  erez.position.copy(P.erez); erez.userData.home = P.erez.clone(); erez.userData.homeRot = 0; kids.erez = erez;
}

// ───────────────────────── Hani ─────────────────────────
const tl = new THREE.TextureLoader();
let hani, haniFig, haniFace = -1;
// her painted poses (from her own photos): 0 calm 1 surprised 2 joy 3 phone 4 chin 5 tehilim 6 talk
const POSES = ['calm', 'surprised', 'joy', 'phone', 'chin', 'tehilim', 'talk'];
const poseTex = POSES.map(n => { const t = tl.load(`assets/pose-${n}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
const FIG_H = 4.5;
function buildHani() {
  hani = new THREE.Group(); hani.position.copy(P.hani); scene.add(hani);
  haniFig = new THREE.Sprite(new THREE.SpriteMaterial({ map: poseTex[0], transparent: true, alphaTest: .04 }));
  haniFig.center.set(.5, 0); haniFig.position.set(0, .55, 0); haniFig.scale.set(FIG_H * .8, FIG_H, 1);
  hani.add(haniFig);
  setFace(0);
}
let popT = 0;
function setFace(i) { if (haniFace !== i && haniFig) { haniFace = i; haniFig.material.map = poseTex[i]; haniFig.material.needsUpdate = true; popT = .18; } }
const HEAD_TOP = () => V(hani.position.x, .55 + FIG_H * .8, hani.position.z);

// ───────────────────────── tweens, particles ─────────────────────────
const tweens = [];
function tween(dur, fn, done) { const t = { t: 0, dur, fn, done }; tweens.push(t); return t; }
function moveTo(o, to, dur = .5, hop = .6, done) {
  const from = o.position.clone();
  return tween(dur, k => { const e = ease(k); o.position.lerpVectors(from, to, e); o.position.y += Math.sin(k * Math.PI) * hop; }, done);
}
function tumble(o, landAt, after) {
  const from = o.position.clone(), r0 = o.rotation.x;
  o.userData.busy = true;
  tween(.55, k => { o.position.lerpVectors(from, landAt, k); o.position.y = from.y * (1 - k * k) + Math.sin(k * Math.PI) * .3; o.rotation.x = r0 - k * 1.45; }, () => {
    setTimeout(() => {
      tween(.3, k => { o.rotation.x = r0 - 1.45 * (1 - k); }, () => goHome(o, after));
    }, 1600);
  });
}
function goHome(o, after) {
  o.userData.busy = true;
  moveTo(o, o.userData.home, .9, .25, () => { o.rotation.set(0, o.userData.homeRot, 0); o.userData.busy = false; after && after(); });
}

const parts = [], pool = [];
const pGeo = new THREE.SphereGeometry(1, 8, 6);
function emit(pos, o) {
  if (parts.length > 260) return;
  const m = pool.pop() || new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  m.material.color.set(o.color); m.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.position.copy(pos); scene.add(m);
  parts.push({ m, v: o.vel ? o.vel.clone() : V(rnd(-.5, .5), rnd(1, 2), rnd(-.5, .5)), life: o.life || 1, t: 0, size: o.size || .06, grow: o.grow || 0, grav: o.grav ?? -4, op: o.op ?? 1 });
}
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    const k = p.t / p.life;
    if (k >= 1) { scene.remove(p.m); pool.push(p.m); parts.splice(i, 1); continue; }
    p.v.y += p.grav * dt; p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < .03) { p.m.position.y = .03; p.v.set(p.v.x * .5, 0, p.v.z * .5); }
    p.m.scale.setScalar(p.size * (1 + p.grow * k)); p.m.material.opacity = p.op * (1 - k);
  }
}
function burst(pos, color, n = 14, add = true) {
  for (let i = 0; i < n; i++) emit(pos, { color, add, vel: V(rnd(-2, 2), rnd(1.5, 3.5), rnd(-2, 2)), life: rnd(.5, .9), size: rnd(.04, .08), grav: -6 });
}
const discs = [];
function puddle(pos, color, r, hold = 2.5) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: .8, roughness: .1, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += .025; m.scale.setScalar(.01); scene.add(m);
  const d = { m, r, hold, t: 0 }; discs.push(d); return d;
}
function updDiscs(dt) {
  for (let i = discs.length - 1; i >= 0; i--) {
    const d = discs[i]; d.t += dt;
    if (d.live) continue; // driven by its event
    const grow = Math.min(1, d.t / .5), fade = clamp((d.t - .5 - d.hold) / 1, 0, 1);
    d.m.scale.setScalar(d.r * grow); d.m.material.opacity = .8 * (1 - fade);
    if (fade >= 1) { scene.remove(d.m); discs.splice(i, 1); }
  }
}

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, music: null };
const OWN = ['pop-1', 'pop-2', 'win-1', 'win-2', 'win-3', 'fail-1', 'fail-2', 'fail-3', 'cry', 'rub-1', 'rub-2', 'hold', 'alarm', 'zap', 'boil', 'miracle', 'munch', 'click', 'over', 'combo', 'whoosh', 'meet-1', 'meet-2', 'sizzle', 'knob'];
// Hani's own sounds live once on the site (/hani-games/sounds/); a local copy sits in ../hani-sounds/
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const BRACHI = Array.from({ length: 18 }, (_, i) => 'brachi-' + String(i + 1).padStart(2, '0'));
const HS = ['phone-ring', 'phone-ring-2', 'mumble-phone', ...BRACHI, 'kids-ima-1', 'kids-ima-2', 'kids-ima-3', 'kids-ma-ma', 'malki-wail', 'yanky-cry', 'climb-oy', 'crash', 'cookie-tin', 'house-ambience', 'office-ambience', 'niggun-freilach'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then(x => { SND.buf[n] = x; if (n === 'niggun-freilach' || n.endsWith('ambience')) startMusic(); }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
// opt: { exact, at (offset s), dur (s) }
function play(name, vol = 1, rate = 1, opt = {}) {
  if (!SND.ctx) return null;
  if (opt.exact) {
    if (!SND.buf[name]) return null;
    const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
    src.buffer = SND.buf[name]; g.gain.value = vol; src.connect(g).connect(SND.master);
    const t = SND.ctx.currentTime;
    if (opt.dur) { src.start(t, opt.at || 0, opt.dur + .3); g.gain.setValueAtTime(vol, t + opt.dur); g.gain.linearRampToValueAtTime(0, t + opt.dur + .3); }
    else src.start(t, opt.at || 0);
    return { stop() { try { src.stop(); } catch (e) {} } };
  }
  const vars = SFX.filter(n => n === name || n.startsWith(name + '-')).filter(n => SND.buf[n]);
  if (!vars.length) return null;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rate * rnd(.95, 1.05); g.gain.value = vol;
  src.connect(g).connect(SND.master); src.start();
  return { stop() { try { src.stop(); } catch (e) {} } };
}
function loopSnd(n, vol) {
  const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.loop = true; g.gain.value = vol;
  src.connect(g).connect(SND.master); src.start(); return { src, g };
}
function startMusic() {
  if (!SND.music && SND.buf['niggun-freilach']) SND.music = loopSnd('niggun-freilach', .3);
  // the home and the office hum quietly under the niggun
  if (!SND.amb && SND.buf['house-ambience'] && SND.buf['office-ambience']) SND.amb = [loopSnd('house-ambience', .16), loopSnd('office-ambience', .1)];
}
function setMusicRate(r) { if (SND.music) SND.music.src.playbackRate.setTargetAtTime(r, SND.ctx.currentTime, .5); }
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

// ───────────────────────── Hani speaks ─────────────────────────
const sayEl = $('say');
let sayT = 0, sayPri = 0;
function say(text, dur = 2.4, pri = 1, call = false) {
  if (!text || (sayT > 0 && pri < sayPri)) return;
  sayEl.textContent = text; sayEl.classList.add('on'); sayEl.classList.toggle('call', call); sayT = dur; sayPri = pri;
}

// ───────────────────────── the events ─────────────────────────
const IC = n => `assets/ic-${n}.png`;
for (let i = 0; i < 27; i++) new Image().src = IC(i);
const kidUp = (k, h) => () => kids[k].position.clone().add(V(0, h, 0));
const DEFS = [
  {
    id: 'malki', act: 'גררו לשטיח', he: 'מלכי על השיש!', ic: 1, g: 'drag', T: 8, kid: 'malki', anchor: kidUp('malki', 1.35), target: () => P.rug.clone().add(V(-.4, 0, .3)),
    start(ev) { const k = kids.malki; k.userData.busy = true; moveTo(k, P.malkiCounter, .6, .8); kidsCall(); },
    upd(ev, dt, k) { kids.malki.rotation.z = Math.sin(now * 9) * .12 * k; },
    win() { const k = kids.malki; k.rotation.z = 0; moveTo(k, P.rug.clone().add(V(-.4, 0, .3)), .7, 1.2, () => { k.userData.home = k.position.clone(); k.userData.busy = false; setTimeout(() => goHome(k), 4000); }); },
    fail() { const k = kids.malki; k.rotation.z = 0; tumble(k, V(-1.3, 0, -6.6)); play('malki-wail', .7); play('fail', .8); },
    sayWin: ['מלכי\'לה, על השיש לא עומדים. ברוך השם.', 'יורדים יפה, מלכי. כל הכבוד.'],
    sayFail: ['ברוך השם שהרצפה רכה. נס בתוך נס.', 'היא בסדר, ברוך השם. סייעתא דשמיא.'],
  },
  {
    id: 'sruli', act: 'גררו לספה', he: 'שרולי על הארון!', ic: 2, g: 'drag', T: 8.5, kid: 'sruli', anchor: kidUp('sruli', 1.55), target: () => P.couch.clone().add(V(0, 0, .1)),
    start() { const k = kids.sruli; k.userData.busy = true; moveTo(k, P.sruliClimb, .8, .3); k.rotation.y = Math.PI; play('climb-oy', .6); },
    upd(ev, dt, k) { const s = kids.sruli; s.userData.arms.forEach((a, i) => a.rotation.x = -2.6 + Math.sin(now * 8 + i * 3) * .4); s.rotation.z = Math.sin(now * 7) * .08 * k; },
    win() { const s = kids.sruli; s.rotation.set(0, 0, 0); s.userData.arms.forEach(a => a.rotation.x = 0); moveTo(s, P.couch.clone().add(V(-.4, .1, .1)), .8, 1.3, () => setTimeout(() => goHome(s), 3500)); },
    fail() { const s = kids.sruli; s.rotation.set(0, 0, 0); s.userData.arms.forEach(a => a.rotation.x = 0); tumble(s, V(1.3, 0, -6.5)); play('fail', .8); play('crash', .5); play('cry', .6); },
    sayWin: ['שרולי, עם גבס לא מטפסים. גם בלי גבס.', 'ברוך השם, שרולי על הספה.'],
    sayFail: ['ברוך השם, הגבס עוד שלם. איזו השגחה פרטית.', 'הוא בסדר. נס בתוך נס.'],
  },
  {
    id: 'pot', act: 'גררו לכיור', he: 'הסיר גולש!', ic: 0, g: 'drag', T: 8, anchor: () => P.stove.clone().add(V(0, .9, 0)), target: () => P.sink.clone().add(V(0, .3, .2)),
    start(ev) { ev.snd = play('boil', .6); if (!potObj) potObj = M3('pot', 0, 0, 0, 0, 1.15); potObj.visible = true; potObj.position.copy(P.stove).add(V(-.25, .02, .05)); },
    upd(ev, dt, k) { if (Math.random() < dt * (10 + k * 30)) emit(P.stove.clone().add(V(rnd(-.15, .15), .32, rnd(-.15, .15))), { color: 0xffffff, vel: V(rnd(-.6, .6), rnd(.3, 1), rnd(-.2, .6)), life: 1.1, size: rnd(.05, .09), grav: -2.5 }); },
    win() { moveTo(potObj, P.sink.clone().add(V(0, .02, .05)), .5, .4, () => setTimeout(() => { potObj.visible = false; }, 1500)); },
    fail() { puddle(P.stove.clone().add(V(0, -.93, .7)), 0xfdfdf5, .9); for (let i = 0; i < 26; i++) emit(P.stove.clone().add(V(0, .3, 0)), { color: 0xffffff, vel: V(rnd(-1.5, 1.5), rnd(1, 2.5), rnd(0, 2)), life: 1.3, size: rnd(.06, .1) }); play('fail', .9); setTimeout(() => { potObj.visible = false; }, 600); },
    end(ev) { ev.snd && ev.snd.stop(); },
    sayWin: ['ברוך השם, האטריות ניצלו.', 'כמו בפרודקשן – מורידים מהאש לפני שזה גולש.'],
    sayFail: ['לא נורא, יש עוד עיגוליות במקפיא.', 'ברוך השם, זה רק מרק. הכל לטובה.'],
  },
  {
    id: 'moishi', act: 'גררו לשטיח', he: 'מוישי זוחל למדרגות!', ic: 3, g: 'drag', T: 9, kid: 'moishi', anchor: kidUp('moishi', .85), target: () => P.rug.clone().add(V(.3, 0, -.2)),
    start(ev) { const m = kids.moishi; m.userData.busy = true; ev.from = m.position.clone(); m.rotation.y = Math.atan2(P.stairsFoot.x - m.position.x, P.stairsFoot.z - m.position.z); kidsCall(); },
    upd(ev, dt, k) { const m = kids.moishi; m.position.lerpVectors(ev.from, P.stairsFoot, k); m.position.y = Math.abs(Math.sin(now * 10)) * .04; m.userData.body.rotation.z = Math.sin(now * 10) * .08; },
    win() { const m = kids.moishi; moveTo(m, P.rug.clone().add(V(.3, 0, -.2)), .7, 1, () => setTimeout(() => goHome(m), 3000)); },
    fail() { const m = kids.moishi; m.userData.busy = true; tween(.4, k => { m.position.y = Math.sin(k * Math.PI) * .35; m.rotation.z = k * .8; }, () => { m.rotation.z = 0; setTimeout(() => goHome(m), 1400); }); play('cry', .8); play('fail', .6); },
    sayWin: ['מוישי\'לה, בדיוק כמו אבא – תמיד בדרך לעלות.', 'ברוך השם, חזרת לשטיח.'],
    sayFail: ['רק מדרגה אחת, ברוך השם. אפתח טיקט לשער למדרגות.', 'הוא בסדר. נס בתוך נס.'],
  },
  {
    id: 'washer', act: 'שפשפו לנגב', he: 'מכונת הכביסה מציפה!', ic: 4, g: 'rub', T: 9, anchor: () => P.washer.clone().add(V(0, 1.45, 0)),
    start(ev) { ev.d = puddle(P.washer.clone().add(V(.9, 0, .2)), 0x6ab8ff, 1); ev.d.live = true; },
    upd(ev, dt, k) { const r = (.25 + k * 1.3) * (1 - ev.prog * .9); ev.d.m.scale.setScalar(r); if (Math.random() < dt * 8) emit(P.washer.clone().add(V(.5, .5, rnd(-.2, .2))), { color: 0xffffff, vel: V(rnd(.3, 1), rnd(0, .6), rnd(-.4, .4)), life: .9, size: rnd(.05, .09), grav: -2 }); },
    win(ev) { ev.d.live = false; ev.d.hold = 0; ev.d.r = .01; ev.d.t = .6; },
    fail(ev) { ev.d.live = false; ev.d.r = 2.1; ev.d.t = .2; ev.d.hold = 2.5; play('fail', 1); },
    sayWin: ['ברוך השם, יבש. כמו דאטה נקי.', 'הכל לטובה – הרצפה קיבלה שטיפה.'],
    sayFail: ['שיטפון קטן, ברוך השם. לפחות הרצפה נקייה עכשיו.', 'בשורות טובות – נקרא לטכנאי.'],
  },
  {
    id: 'blocks', act: 'שפשפו לאסוף', he: 'אבני בניין על הרצפה!', ic: 5, g: 'rub', T: 9, kid: 'yanky', anchor: () => V(-.6, 1.3, -2.2),
    start(ev) { play('brachi-18', .5, 1, { exact: true }); ev.b = []; for (let i = 0; i < 9; i++) ev.b.push(box(.16, .1, .12, pick([0xe5484d, 0x3b82f6, 0xffc94a, 0x2bb673]), rnd(-1.6, .4), .05, rnd(-2.8, -1.5))); },
    upd(ev) { ev.b.forEach((b, i) => b.visible = i / ev.b.length >= ev.prog); },
    win(ev) { ev.b.forEach(b => scene.remove(b)); },
    fail(ev) { const y = kids.yanky; moveTo(y, V(-.6, 0, -2.2), .5, .2, () => { tumble(y, V(-.6, 0, -1.9)); play('yanky-cry', .7); }); setTimeout(() => ev.b.forEach(b => scene.remove(b)), 3000); play('fail', .7); },
    sayWin: ['יענקי, אבני הבניין חוזרות לקופסה. ברוך השם.', 'ברוך השם, אף אחד לא דרך.'],
    sayFail: ['יענקי דרך על אבני בניין. כואב, אבל ברוך השם.', 'זה עובר, יענקי\'לה. סייעתא דשמיא.'],
  },
  {
    id: 'milk', act: 'שפשפו לנגב', he: 'החלב נשפך!', ic: 15, g: 'rub', T: 8, anchor: () => P.table.clone().add(V(0, 1.6, 0)),
    start(ev) { ev.d = puddle(P.table.clone().add(V(0, .76, 0)), 0xffffff, .5); ev.d.live = true; },
    upd(ev, dt, k) { ev.d.m.scale.setScalar((.15 + k * .4) * (1 - ev.prog * .9)); },
    win(ev) { ev.d.live = false; ev.d.hold = 0; ev.d.r = .01; ev.d.t = .6; },
    fail(ev) { ev.d.live = false; ev.d.hold = 2; ev.d.t = .5; puddle(P.table.clone().add(V(.5, 0, .7)), 0xffffff, .7); play('fail', .7); },
    sayWin: ['ברוך השם, השולחן נקי.', 'אין על מה לבכות, על חלב שנשפך.'],
    sayFail: ['החלב על הרצפה. ברוך השם שזה לא המיץ ענבים.'],
  },
  {
    id: 'phone', act: 'הקישו לענות', he: 'הפלאפון הכשר מצלצל!', ic: 6, g: 'tap', T: 6, anchor: () => P.phone.clone().add(V(-.7, -.4, .9)),
    start(ev) { ev.caller = pick(CALLERS); ev.he = ev.caller.he; ev.snd = play('phone-ring', .8); },
    upd(ev) { phoneObj.rotation.y = Math.sin(now * 40) * .15; phoneObj.position.y = P.phone.y + Math.abs(Math.sin(now * 25)) * .02; },
    win(ev) { if (ev.caller.brachi) brachiCall(ev); else { ev.sayWin = ev.caller.win; play('mumble-phone', .5, 1, { exact: true, at: rnd(0, 13), dur: 2.2 }); } }, fail(ev) { ev.sayFail = ev.caller.fail; },
    end(ev) { ev.snd && ev.snd.stop(); phoneObj.rotation.y = 0; phoneObj.position.copy(P.phone); },
  },
  {
    id: 'server', act: 'החזיקו לקרר', he: 'השרת מתחמם!', ic: 8, g: 'hold', T: 8, anchor: () => P.server.clone().add(V(0, 2.75, 0)),
    start(ev) { ev.snd = play('alarm', .5); if (serverLed) { serverLed.color.set(0xff3344); serverLed.emissive.set(0xff3344); } },
    upd(ev, dt, k) {
      if (serverLed) serverLed.emissiveIntensity = (Math.sin(now * 12) > 0) ? 1.6 : .3;
      if (Math.random() < dt * (4 + k * 20)) emit(P.server.clone().add(V(rnd(-.4, .4), 2.35, rnd(-.3, .3))), { color: 0x777777, vel: V(rnd(-.2, .2), rnd(.5, 1), 0), life: 1.6, size: .12, grow: 2.5, grav: .3, op: .6 });
      if (Math.random() < dt * k * 6) { burst(P.server.clone().add(V(rnd(-.3, .3), rnd(.5, 2), .45)), 0xffd34a, 6); }
    },
    win() { play('zap', .3); },
    fail() { for (let i = 0; i < 20; i++) emit(P.server.clone().add(V(rnd(-.5, .5), rnd(.5, 2.3), .4)), { color: 0x444444, vel: V(rnd(-1, 1), rnd(.5, 1.5), rnd(0, 1)), life: 2, size: .18, grow: 2, grav: .2, op: .7 }); play('zap', 1); play('fail', .6); },
    end(ev) { ev.snd && ev.snd.stop(); if (serverLed) { serverLed.color.set(0x2bff88); serverLed.emissive.set(0x2bff88); serverLed.emissiveIntensity = 1; } },
    sayWin: ['ברוך השם, השרת נרגע. כמו מוישי אחרי בקבוק.', 'הטמפרטורה ירדה. סייעתא דשמיא.'],
    sayFail: ['השרת נפל. לא נורא, יש גיבוי, ברוך השם.', 'ארז, אפשר לפתוח אינסידנט. בנועם.'],
  },
  {
    id: 'bug', act: 'שפשפו למחוק', he: 'באג לפני ריליס!', ic: 7, g: 'rub', T: 8, anchor: () => V(-2.4, 1.2, 5.6),
    start() { laptopLidMat && laptopLidMat.emissive.set(0xff2233); },
    upd(ev, dt) { if (laptopLidMat) laptopLidMat.emissiveIntensity = .5 + Math.sin(now * 10) * .4; },
    win() { burst(V(0, 1.4, 3.2), 0x2bb673, 10); },
    fail() { play('fail', .5); },
    end() { laptopLidMat && laptopLidMat.emissive.set(0x000000); },
    sayWin: ['הבאג תוקן לפני הריליס. נס גלוי.', 'ברוך השם, כל הטסטים ירוקים.'],
    sayFail: ['הבאג עלה לפרודקשן. נתקן בעזרת השם, בלי לחץ.'],
  },
  {
    id: 'yotam', act: 'הקישו לאשר', he: 'יותם מבקש אישור', ic: 9, g: 'tap', T: 7, kid: 'yotam', anchor: kidUp('yotam', 2.45),
    start() { const y = kids.yotam; y.userData.busy = true; moveTo(y, P.yotamAsk, 1, .1); y.rotation.y = -1.9; },
    upd(ev) { kids.yotam.userData.arms[1].rotation.x = -1.2 + Math.sin(now * 6) * .5; },
    win() { const y = kids.yotam; y.userData.arms[1].rotation.x = 0; setTimeout(() => goHome(y), 600); },
    fail() { const y = kids.yotam; y.userData.arms[1].rotation.x = 0; goHome(y); },
    sayWin: ['אם זאת ההחלטה של יותם, אז בסדר גמור.', 'מאושר, יותם. בשורות טובות.'],
    sayFail: ['יותם החליט בלעדיי. אם זאת ההחלטה שלו – בסדר גמור.'],
  },
  {
    id: 'cache', act: 'החזיקו לנקות', he: 'באג ב-Cache!', ic: 14, g: 'hold', T: 8, anchor: () => P.erezDesk.clone().add(V(0, 2.0, -.2)),
    start() { erezScreen.material.emissive.set(0xff2a2a); },
    upd() { erezScreen.material.emissiveIntensity = .5 + Math.sin(now * 14) * .4; },
    win() { burst(P.erezDesk.clone().add(V(0, 1.3, -.2)), 0x2bb673, 8); },
    fail() { play('fail', .5); },
    end() { erezScreen.material.emissive.set(0x2a4a8a); erezScreen.material.emissiveIntensity = .6; },
    sayWin: ['ניקיתי את ה-Cache. כמו לפני פסח.', 'ברוך השם, ה-Cache נקי.'],
    sayFail: ['ה-Cache מחזיר נתונים של אתמול. גם אתמול היה יום טוב, ברוך השם.'],
  },
  {
    id: 'cookie', act: 'גררו לארז', he: 'ארז רוצה עיגולית', ic: 11, g: 'drag', T: 8, anchor: () => P.cookies.clone().add(V(.2, -.5, 1.0)), target: () => P.erez.clone().add(V(0, 1.2, 0)),
    start() { kids.erez.userData.arms[0].rotation.x = -1.3; },
    win() { play('cookie-tin', .5); const c = M3('cookie', P.cookies.x, 1.0, P.cookies.z, 0, 1.4); moveTo(c, P.erez.clone().add(V(0, 1.5, .3)), .6, .6, () => scene.remove(c)); },
    fail() { play('munch', .5); },
    end() { kids.erez.userData.arms[0].rotation.x = 0; },
    sayWin: ['תטעם, ארז. עיגולית של ברכת השפע.', 'ברוך השם, יש מספיק לכולם.'],
    sayFail: ['העיגוליות נגמרו. מחר אביא שתי קופסאות, בעזרת השם.'],
  },
  {
    id: 'tzedaka', act: 'גררו לקופה', he: 'מטבע לקופת הצדקה', ic: 10, g: 'drag', T: 8, anchor: () => V(-2.6, .6, 3.4), target: () => P.tzedaka.clone().add(V(0, .3, 0)),
    win() { burst(P.tzedaka.clone().add(V(0, .35, 0)), 0xffd34a, 12); },
    fail() {},
    sayWin: ['ברוך השם, עוד מטבע לקופה.', 'צדקה – הכי חשוב לפני ריליס.'],
    sayFail: ['אשים כפול מחר, בלי נדר.'],
  },
  {
    id: 'fridge', act: 'הקישו לסגור', he: 'המקרר פתוח!', ic: 16, g: 'tap', T: 7, anchor: () => fridgeTop,
    start() { fridgeDoor.visible = fridgeLight.visible = true; tween(.3, k => { fridgeDoor.rotation.y = 1.4 * k; }); },
    upd(ev, dt, k) { if (Math.random() < dt * (8 + k * 16)) emit(fridgeTop.clone().add(V(rnd(-.35, .35), -rnd(.6, 2), -.1)), { color: 0xe4f6ff, vel: V(rnd(-.2, .2), rnd(-.4, 0), rnd(.4, 1)), life: 1.4, size: rnd(.06, .1), grow: 2, grav: .3, op: .55 }); },
    win() { play('click', .8); },
    fail() { play('fail', .6); },
    end() { tween(.25, k => { fridgeDoor.rotation.y = 1.4 * (1 - k); }, () => { fridgeDoor.visible = fridgeLight.visible = false; }); },
    sayWin: ['ברוך השם, המקרר סגור. החלב עוד קר.', 'מי השאיר את המקרר פתוח? לא משנה, ברוך השם.'],
    sayFail: ['הגבינה התחממה. מחר נקנה חדשה, בעזרת השם.'],
  },
  {
    id: 'faucet', act: 'החזיקו לסגור', he: 'הברז פתוח!', ic: 17, g: 'hold', T: 8, anchor: () => P.sink.clone().add(V(0, 1.0, .25)),
    upd(ev, dt, k) {
      if (Math.random() < dt * (30 + k * 30) * (1 - ev.prog)) emit(P.sink.clone().add(V(rnd(-.04, .04), .5, 0)), { color: 0x8fd0ff, vel: V(rnd(-.15, .15), -1.2, rnd(0, .3)), life: .45, size: rnd(.03, .05), grav: -6 });
      if (k > .45 && Math.random() < dt * 8) emit(P.sink.clone().add(V(rnd(-.4, .4), .05, .5)), { color: 0x8fd0ff, vel: V(rnd(-.3, .3), -.4, rnd(.4, 1)), life: .9, size: .05 });
    },
    win() { play('click', .6); },
    fail() { puddle(V(P.sink.x, 0, P.sink.z + 1.0), 0x6ab8ff, 1.0); play('fail', .8); },
    sayWin: ['ברוך השם, הברז סגור. כל טיפה חשובה.', 'סגרתי. יש מים, ברוך השם, רק לא על הרצפה.'],
    sayFail: ['קצת מים על הרצפה. ברוך השם, יש מגב.'],
  },
  {
    id: 'babycry', act: 'סובבו לנדנד', he: 'מוישי בוכה!', ic: 18, g: 'circle', T: 8.5, kid: 'moishi', anchor: kidUp('moishi', .95),
    start(ev) { kids.moishi.userData.busy = true; ev.snd = play('cry', .45); ev.cryT = 2.6; },
    upd(ev, dt) {
      const m = kids.moishi, calm = ev.prog > .05;
      m.rotation.z = Math.sin(now * (calm ? 4 : 14)) * (calm ? .28 : .06);
      if (Math.random() < dt * 5 * (1 - ev.prog)) emit(m.position.clone().add(V(rnd(-.1, .1), .45, .15)), { color: 0x9fd8ff, vel: V(rnd(-.6, .6), 1, rnd(0, .4)), life: .6, size: .035 });
      if ((ev.cryT -= dt) <= 0 && ev.prog < .3) { ev.cryT = 2.6; ev.snd = play('cry', .4); }
    },
    win() { burst(kids.moishi.position.clone().add(V(0, .5, 0)), 0xff9ec4, 10); },
    fail() { play('kids', .5); },
    end(ev) { ev.snd && ev.snd.stop(); kids.moishi.rotation.z = 0; kids.moishi.userData.busy = false; },
    sayWin: ['שששש... מוישי\'לה נרגע. ברוך השם.', 'נדנוד קטן, שקט גדול. בשורות טובות.'],
    sayFail: ['מוישי עוד בוכה. גם זה עובר, בעזרת השם.'],
  },
  {
    id: 'crayon', act: 'שפשפו לנקות', he: 'חיימי מצייר על הקיר!', ic: 19, g: 'rub', T: 9, kid: 'chaimi', anchor: () => V(-3.9, 1.5, -3.3),
    start(ev) { const c = kids.chaimi; c.userData.busy = true; moveTo(c, V(-3.75, 0, -3.3), .8, .2, () => { c.rotation.y = -Math.PI / 2; }); scribble.visible = true; scribble.material.opacity = 0; ev.ink = 0; },
    upd(ev, dt) { ev.ink = Math.min(1, ev.ink + dt * .5); scribble.material.opacity = ev.ink * (1 - ev.prog); kids.chaimi.userData.arms[1].rotation.x = -1.7 + Math.sin(now * 14) * .3 * (1 - ev.prog); },
    win() { scribble.visible = false; },
    fail() { play('fail', .6); setTimeout(() => { scribble.visible = false; }, 2500); },
    end() { kids.chaimi.userData.arms[1].rotation.x = 0; goHome(kids.chaimi); },
    sayWin: ['חיימי, מציירים על דף. ברוך השם, הקיר נקי.', 'יפה ציירת, חיימי. בפעם הבאה – על נייר.'],
    sayFail: ['ציור על הקיר. נקרא לזה אמנות, ברוך השם.'],
  },
  {
    id: 'printer', act: 'סובבו לשחרר', he: 'המדפסת נתקעה!', ic: 20, g: 'circle', T: 8.5, anchor: () => P.printer.clone().add(V(0, 1.75, 0)),
    start() { printerLed.color.set(0xff3344); printerLed.emissive.set(0xff3344); jamPaper.visible = true; },
    upd(ev, dt, k) { printerLed.emissiveIntensity = Math.sin(now * 12) > 0 ? 1.6 : .2; jamPaper.rotation.x = -.6 + Math.sin(now * 30) * .06 * k - ev.prog * .5; },
    win() { for (let i = 0; i < 6; i++) emit(P.printer.clone().add(V(0, 1, .3)), { color: 0xffffff, vel: V(rnd(-1, 1), rnd(1.5, 2.5), rnd(.3, 1)), life: 1.2, size: .07 }); },
    fail() { play('fail', .6); },
    end() { printerLed.color.set(0x2bff88); printerLed.emissive.set(0x2bff88); printerLed.emissiveIntensity = 1; jamPaper.visible = false; },
    sayWin: ['ברוך השם, הדף יצא. המדפסת חזרה לעבוד.', 'כמו דיבאג: מסובבים, ומשחררים.'],
    sayFail: ['המדפסת עדיין תקועה. נשלח במייל, בעזרת השם.'],
  },
  {
    id: 'board', act: 'שפשפו למחוק', he: 'הלוח מלא לפני הישיבה!', ic: 21, g: 'rub', T: 9, anchor: () => boardSpot,
    start() { boardInk.visible = true; boardInk.material.opacity = 1; },
    upd(ev) { boardInk.material.opacity = 1 - ev.prog; },
    win() { boardInk.visible = false; },
    fail() { play('fail', .5); setTimeout(() => { boardInk.visible = false; }, 1500); },
    sayWin: ['הלוח נקי. ברוך השם, אפשר להתחיל את הישיבה.', 'מחקתי. הדיאגרמה כבר בראש, ברוך השם.'],
    sayFail: ['הישיבה התחילה עם לוח מלא. נסתדר, בעזרת השם.'],
  },
  {
    id: 'test', act: 'הקישו לעזור', he: 'שטערני לומדת למבחן', ic: 22, g: 'quiz', T: 11, kid: 'shterni', who: 'שטערני', subj: 'הלכה', anchor: kidUp('shterni', 1.75),
    start() { kids.shterni.userData.busy = true; },
    end() { kids.shterni.userData.busy = false; },
    sayWin: ['נכון! בעזרת השם מאה במבחן.', 'כל הכבוד, שטערני. ככה לומדים – בשמחה.'],
  },
  {
    id: 'mishna', act: 'הקישו לעזור', he: 'חיימי חוזר על משניות', ic: 22, g: 'quiz', T: 11, kid: 'chaimi', who: 'חיימי', subj: 'משנה', anchor: kidUp('chaimi', 1.6),
    start() { kids.chaimi.userData.busy = true; },
    end() { kids.chaimi.userData.busy = false; },
    sayWin: ['נכון! אשריך, חיימי.', 'יפה מאוד. משנה שגורה בפה, ברוך השם.'],
  },
  {
    id: 'milchig', act: 'גררו לכיור החלבי', he: 'צלחת חלבית בכיור הבשרי!', ic: 23, g: 'drag', T: 8.5, anchor: () => P.sink.clone().add(V(0, .75, .2)), target: () => P.dairySink.clone().add(V(0, .3, .2)),
    start(ev) { dish(0x2f6fd1, P.sink); },
    upd(ev) { dishObj.rotation.z = Math.sin(now * 6) * .1; },
    win() { moveDish(P.dairySink); },
    fail() { play('fail', .6); setTimeout(() => { dishObj.visible = false; }, 800); },
    sayWin: ['ברוך השם, החלבי חזר לכיור החלבי.', 'כל דבר במקום שלו. ברוך השם.'],
    sayFail: ['צלחת חלבית בכיור הבשרי. נשאל את הרב, בעזרת השם.', 'נתייעץ עם הרב. בינתיים – הצידה.'],
  },
  {
    id: 'fleishig', act: 'גררו לכיור הבשרי', he: 'סיר בשרי בכיור החלבי!', ic: 23, g: 'drag', T: 8.5, anchor: () => P.dairySink.clone().add(V(0, .75, .2)), target: () => P.sink.clone().add(V(0, .3, .2)),
    start(ev) { dish(0xd23b45, P.dairySink); },
    upd(ev) { dishObj.rotation.z = Math.sin(now * 6) * .1; },
    win() { moveDish(P.sink); },
    fail() { play('fail', .6); setTimeout(() => { dishObj.visible = false; }, 800); },
    sayWin: ['ברוך השם, הבשרי בכיור הבשרי.', 'הפרדה בין בשר לחלב – גם בכיור. ברוך השם.'],
    sayFail: ['בשרי בכיור החלבי. נשאל את הרב, בעזרת השם.', 'נתייעץ עם הרב. הכל לטובה.'],
  },
  {
    id: 'diaper', act: 'גררו טיטול למוישי', he: 'מוישי צריך טיטול!', ic: 24, g: 'drag', T: 9, kid: 'moishi', anchor: () => P.diapers.clone().add(V(0, .9, 0)), target: () => kids.moishi.position.clone().add(V(0, .3, 0)),
    start(ev) { kids.moishi.userData.busy = true; kidsCall(); },
    upd(ev, dt, k) {
      const m = kids.moishi; m.rotation.z = Math.sin(now * 8) * .05 * (1 + k);
      if (Math.random() < dt * (3 + k * 6)) emit(m.position.clone().add(V(rnd(-.2, .2), .5, rnd(-.1, .1))), { color: 0x9bc45a, vel: V(rnd(-.15, .15), .5, 0), life: 1.4, size: .05, grow: 1.5, grav: .2, op: .55 });
    },
    win() { const m = kids.moishi; const d = box(.2, .12, .14, 0xffffff, P.diapers.x, P.diapers.y + .4, P.diapers.z); moveTo(d, m.position.clone().add(V(0, .25, 0)), .55, .6, () => { scene.remove(d); burst(m.position.clone().add(V(0, .4, 0)), 0xbfe8ff, 12); }); },
    fail() { play('cry', .7); play('fail', .5); },
    end() { kids.moishi.rotation.z = 0; kids.moishi.userData.busy = false; },
    sayWin: ['טיטול חדש, ברוך השם. מוישי נקי ומאושר.', 'מוישי׳לה, עכשיו אפשר לזחול הלאה.'],
    sayFail: ['מוישי עוד מחכה לטיטול. עוד רגע, בעזרת השם.'],
  },
  {
    id: 'oven', act: 'סובבו לכבות', he: 'התנור נשאר דולק!', ic: 25, g: 'circle', T: 9, anchor: () => ovenFront.clone().add(V(0, .7, .6)),
    start(ev) { ovenGlow.visible = true; ev.snd = play('sizzle', .4); },
    upd(ev, dt, k) {
      ovenGlow.material.emissiveIntensity = (.8 + k * 1.2 + Math.sin(now * 9) * .25) * (1 - ev.prog * .8);
      if (Math.random() < dt * (2 + k * 14) * (1 - ev.prog)) emit(P.stove.clone().add(V(rnd(-.3, .3), .05, rnd(.1, .4))), { color: k > .6 ? 0x555555 : 0x999999, vel: V(rnd(-.2, .2), rnd(.5, 1), rnd(0, .3)), life: 1.6, size: .1, grow: 2.5, grav: .3, op: .55 });
    },
    win() { play('knob', .8); },
    fail() { for (let i = 0; i < 18; i++) emit(ovenFront.clone(), { color: 0x444444, vel: V(rnd(-.8, .8), rnd(.6, 1.6), rnd(0, 1)), life: 2, size: .16, grow: 2, grav: .2, op: .7 }); play('fail', .7); },
    end(ev) { ovenGlow.visible = false; ev.snd && ev.snd.stop(); },
    sayWin: ['כיביתי את התנור. ברוך השם, העוגה יצאה בזמן.', 'התנור כבוי. סייעתא דשמיא.'],
    sayFail: ['העוגה קצת שרופה. ברוך השם, יש עוד עיגוליות.', 'נפתח חלון לאוורר. הכל לטובה.'],
  },
  {
    id: 'meeting', act: 'הקישו להצטרף', he: 'פגישת טימס מתחילה!', ic: 26, g: 'tap', T: 7, anchor: () => V(-2.5, 1.0, 7.0),
    start(ev) { ev.snd = play('meet', .6); laptopLidMat && laptopLidMat.emissive.set(0x5b5fc7); },
    upd(ev) { if (laptopLidMat) laptopLidMat.emissiveIntensity = .6 + Math.sin(now * 8) * .35; },
    win(ev) { ev.faceT = 2.2; },
    fail() { play('fail', .4); },
    end(ev) { ev.snd && ev.snd.stop(); laptopLidMat && laptopLidMat.emissive.set(0x000000); },
    sayWin: ['שלום לכולם, אני כאן. ברוך השם, שומעים אותי?', 'הצטרפתי. אפשר להתחיל, בעזרת השם.'],
    sayFail: ['הפגישה התחילה בלעדיי. אבקש הקלטה, בעזרת השם.'],
  },
  {
    id: 'tehilim', act: 'החזיקו לקרוא', he: 'תהילים לרפואה', ic: 12, g: 'hold', hold: 2.2, T: 8, bonus: true, anchor: () => P.tehilim.clone().add(V(1.3, -.4, .8)),
    start(ev) {
      // a request in Hani's tehilim group: for a recovery or in someone's memory
      ev.kind = pick(TEHILIM); ev.he = ev.kind.he;
      say(ev.kind.ask, 2.8, 2);
    },
    upd(ev) { if (ev.ptr !== null) { setFace(5); faceT = .4; if (!ev.read) { ev.read = true; say(ev.kind.verse, 3, 3); } } },
    win() { burst(P.tehilim.clone().add(V(0, .3, 0)), 0xffe08a, 16); },
    sayWin: ['אמן. בשורות טובות.', 'ברוך השם, עוד פרק נאמר.'],
  },
];
// Hani's tehilim group asks for a chapter
const TEHILIM = [
  { he: 'תהילים לרפואה', ask: 'בקבוצה ביקשו: פרק תהילים לרפואת רבקה בת שרה.', verse: '״שיר למעלות, אשא עיני אל ההרים, מאין יבוא עזרי...״' },
  { he: 'תהילים לרפואה', ask: 'בקבוצה ביקשו: פרק תהילים לרפואת משה בן לאה.', verse: '״שיר למעלות, אשא עיני אל ההרים, מאין יבוא עזרי...״' },
  { he: 'תהילים לעילוי נשמה', ask: 'בקבוצה ביקשו: פרק תהילים לעילוי נשמת יעקב בן אברהם.', verse: '״מזמור לדוד, ה׳ רועי לא אחסר...״' },
  { he: 'תהילים לעילוי נשמה', ask: 'בקבוצה ביקשו: פרק תהילים לעילוי נשמת חנה בת מרים.', verse: '״מזמור לדוד, ה׳ רועי לא אחסר...״' },
];
function dish(color, at) {
  if (!dishObj) {
    dishObj = new THREE.Group(); scene.add(dishObj);
    cyl(.2, .16, .04, 0xffffff, 0, 0, 0, dishObj, 24);
    dishObj.userData.rim = mesh(new THREE.TorusGeometry(.19, .025, 8, 24), mat(0xffffff).clone(), 0, .02, 0, dishObj); dishObj.userData.rim.rotation.x = Math.PI / 2;
  }
  dishObj.userData.rim.material.color.set(color);
  dishObj.position.copy(at).add(V(0, .08, .05)); dishObj.rotation.set(-.5, 0, 0); dishObj.visible = true;
}
function moveDish(to) { moveTo(dishObj, to.clone().add(V(0, .08, .05)), .5, .45, () => setTimeout(() => { dishObj.visible = false; }, 1800)); }
const CALLERS = [
  { he: 'ברכי מתקשרת!', brachi: true, win: ['כן ברכי\'לה? הלחם במקפיא, ברוך השם.', 'ברכי, אפשר לשלוח לי במייל.', 'כן ברכי, מותר לאכול במבה לפני ארוחת ערב. אחת.'], fail: ['ברכי תתקשר שוב, בעזרת השם. היא תמיד מתקשרת שוב.'] },
  { he: 'אברהם משה מתקשר', win: ['בסדר גמור, תישאר בכולל. הכל בשליטה, ברוך השם.', 'ברוך השם, הוא חוזר בשמונה. בעזרת השם.'], fail: ['אברהם משה התקשר... אחזור אליו בעזרת השם.'] },
  { he: 'שטערני מתקשרת', win: ['שטערני, השמלה לבת מצווה מוכנה. כ״ח במרחשוון, בעזרת השם!'], fail: ['אחזור לשטערני. בת מצווה זה לא עניין של טלפון אחד.'] },
  { he: 'מספר לא מזוהה', win: ['לא, תודה, יש לנו כבר הוראת קבע. שיהיה בהצלחה.', 'מהבנק? אפשר לשלוח לי במייל.'], fail: ['לא נורא, אם זה חשוב הם יתקשרו שוב.'] },
];
// Brachi calls from home: her real line plays, its words show in a phone bubble, then Hani answers
const BRACHI_LINES = {
  'brachi-01': ['אמא, מלכי שוב מטפסת. אני אומרת לה לרדת והיא לא מקשיבה לי.', 'ברכי׳לה, תגידי לה שאמא אמרה לרדת. בנועם.'],
  'brachi-02': ['על השיש במטבח!', 'תחזיקי לה את היד, ברכי׳לה. אני כבר מורידה אותה.'],
  'brachi-03': ['אני מנסה, אמא! אני מושכת אותה ביד והיא לא רוצה לרדת!', 'את גיבורה, ברכי. עוד רגע זה נגמר, בעזרת השם.'],
  'brachi-04': ['אמא, היא עדיין לא יורדת. ויענקי הוציא את כל האבני בניין... ושרולי קורא לי מהחדר... אמא, את שומעת אותי?', 'שומעת, ברכי׳לה. אחד אחד, בעזרת השם.'],
  'brachi-05': ['אמא, שרולי עכשיו מטפס על הארון!', 'תגידי לשרולי שהעיגוליות במגירה למטה. בלי לטפס.'],
  'brachi-06': ['מטפס על הארון בחדר!', 'עם גבס על הארון? ברוך השם, אני מטפלת.'],
  'brachi-07': ['כן! הוא מחפש את העיגוליות!', 'העיגוליות במגירה למטה. בלי לטפס, שרולי.'],
  'brachi-08': ['אבל אמא, זה פרווה.', 'גם פרווה – רק אחרי ארוחת ערב. אחת.'],
  'brachi-09': ['כן, יענקי! הוא דרך על האבני בניין ועכשיו כואב לו!', 'תני לו נשיקה ותחזירו את אבני הבניין לקופסה. ברוך השם.'],
  'brachi-10': ['הוא רוצה להתקלח, אבל הוא אומר שהוא לא יכול לבד עם הגבס.', 'שיחכה לאבא, בעזרת השם. עם שקית על הגבס.'],
  'brachi-11': ['הוא עוד לא חזר מהכולל, התקשרתי אליו והוא לא עונה.', 'הוא באמצע סדר. ברוך השם, הוא יחזור.'],
  'brachi-12': ['טוב, אמא, מתי את חוזרת?', 'בשמונה, בעזרת השם. אחרי הריליס.'],
  'brachi-13': ['טוב, אמא, ביי!', 'ביי, ברכי׳לה. את מלכה.'],
  'brachi-14': ['אמא, שרולי נפל במקלחת!', 'תביאי לו מגבת, ברכי. ברוך השם, הגבס שלם.'],
  'brachi-15': ['כן, הוא החליק עם הגבס, והוא צועק לי שאני אבוא, אבל הכל מים.', 'לא נורא, מים מתייבשים. תעזרי לו לקום, בנועם.'],
  'brachi-16': ['טוב, אמא, אבל הוא לא מצליח לקום.', 'תביאי לו את השרפרף הקטן. הוא יקום, בעזרת השם.'],
  'brachi-17': ['ועכשיו מלכי בוכה, והיא רוצה רק אותך, ויענקי לקח לי את הכיסא... אמא? אמא! למה את לא עונה לי?', 'אני פה, ברכי׳לה. אני פה. הכל לטובה.'],
};
const BRACHI_SEC = { 'brachi-01': 1.96, 'brachi-02': .63, 'brachi-03': 1.94, 'brachi-04': 6.4, 'brachi-05': 1.03, 'brachi-06': .73, 'brachi-07': .94, 'brachi-08': .9, 'brachi-09': 1.66, 'brachi-10': 1.56, 'brachi-11': 1.4, 'brachi-12': 1.13, 'brachi-13': .83, 'brachi-14': 1, 'brachi-15': 2.07, 'brachi-16': 1.33, 'brachi-17': 4.41 };
let lastBrachi = '';
function brachiCall(ev) {
  const on = id => active.some(e => e.def.id === id && !e.done);
  let pool = on('malki') ? ['brachi-01', 'brachi-02', 'brachi-03'] : on('sruli') ? ['brachi-05', 'brachi-06', 'brachi-07'] : on('blocks') ? ['brachi-09', 'brachi-04'] : null;
  if (!pool) pool = ['brachi-08', 'brachi-10', 'brachi-11', 'brachi-12', 'brachi-13', 'brachi-14', 'brachi-15', 'brachi-16', 'brachi-17'];
  pool = pool.filter(id => id !== lastBrachi);
  const id = pick(pool); lastBrachi = id;
  const [her, hani] = BRACHI_LINES[id], sec = BRACHI_SEC[id];
  play(id, 1, 1, { exact: true });
  say('ברכי בטלפון: ״' + her + '״', sec + .9, 3, true);
  ev.sayWin = null; ev.noSay = true; ev.faceT = sec + .6;
  setTimeout(() => { if (state === 'play' || state === 'tut') { setFace(3); faceT = 2; say(hani, 2.8, 3); } }, (sec + .5) * 1000);
}
let kidsT = -9;
function kidsCall() { if (now - kidsT > 6) { kidsT = now; play('kids', .45); } }
// the questions are what children learn in school: brachot, chagim, Pirkei Avot, the first mishna in Brachot
const QUIZ = {
  'הלכה': [
    ['מה מברכים על תפוח?', 'בורא פרי העץ', 'בורא פרי האדמה'],
    ['מה מברכים על בננה?', 'בורא פרי האדמה', 'בורא פרי העץ'],
    ['מה מברכים על לחם?', 'המוציא לחם מן הארץ', 'בורא מיני מזונות'],
    ['מה מברכים על מים?', 'שהכל נהיה בדברו', 'בורא פרי הגפן'],
    ['מה מברכים על יין?', 'בורא פרי הגפן', 'שהכל נהיה בדברו'],
    ['כמה נרות מדליקים בלילה הראשון של חנוכה?', 'נר אחד, ועוד השמש', 'שמונה נרות'],
    ['מתי קוראים את מגילת אסתר?', 'בפורים', 'בחנוכה'],
    ['כמה ימים יושבים בסוכה בארץ ישראל?', 'שבעה ימים', 'שלושה ימים'],
  ],
  'משנה': [
    ['מאימתי קורין את שמע בערבית?', 'משעה שהכהנים נכנסים לאכול בתרומתן', 'משעה שהשמש זורחת'],
    ['על כמה דברים העולם עומד?', 'על שלושה: על התורה, על העבודה ועל גמילות חסדים', 'על שבעה דברים'],
    ['מי אמר ״אם אין אני לי, מי לי״?', 'הלל', 'שמאי'],
    ['״עשה לך רב, וקנה לך...״', 'חבר', 'בית'],
    ['״הוי דן את כל האדם...״', 'לכף זכות', 'לפי מעשיו'],
  ],
};
const quizEl = $('quiz');
let quizEv = null;
function openQuiz(ev) {
  const d = ev.def, pool = QUIZ[d.subj], q = pick(pool.filter(x => x !== ev.lastQ)) || pool[0];
  quizEv = ev; ev.q = q; ev.el.classList.add('touched');
  const ans = Math.random() < .5 ? [q[1], q[2]] : [q[2], q[1]];
  quizEl.innerHTML = `<div class="qh">${d.who} שואל${d.who === 'שטערני' ? 'ת' : ''} · ${d.subj}</div><div class="qq">${q[0]}</div><div class="qa">${ans.map(a => `<button data-ok="${a === q[1] ? 1 : 0}">${a}</button>`).join('')}</div>`;
  quizEl.classList.add('on'); play('pop', .5);
}
function closeQuiz() { quizEl.classList.remove('on'); quizEv = null; }
quizEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !quizEv) return;
  const ev = quizEv; closeQuiz();
  if (ev.done) return;
  if (b.dataset.ok === '1') finish(ev, true);
  else { ev.noLife = true; ev.sayFail = ['כמעט! התשובה: ' + ev.q[1] + '. נחזור על זה בערב.']; finish(ev, false); }
});
let potObj = null;
const VERB = { quiz: 'הקישו', tap: 'הקישו', drag: 'גררו', rub: 'שפשפו', hold: 'החזיקו', circle: 'סובבו' };
const HAND = '<svg viewBox="0 0 40 46"><path d="M15 4a4 4 0 0 1 8 0v15l2-.5a4 4 0 0 1 4.5 2.6l.3.9 1-.2a4 4 0 0 1 4.7 3.3l.1.6.6-.1a3.6 3.6 0 0 1 4 3.5V36a9 9 0 0 1-9 9H21a9 9 0 0 1-7.4-3.9L5.4 29.6a3.6 3.6 0 0 1 5.4-4.7L15 28z" fill="#fff" stroke="#22223a" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const GESTURE_SVG = {
  quiz: '<svg viewBox="0 0 24 24"><path d="M12 3 1 8l11 5 9-4.1V15h2V8z"/><path d="M5 12.2V16c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.8l-7 3.2z"/></svg>',
  circle: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M14 4h5v5z" fill="#fff"/></svg>',
  tap: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/></svg>',
  drag: '<svg viewBox="0 0 24 24"><path d="M4 12h12l-4-4 1.5-1.5L20 13l-6.5 6.5L12 18l4-4H4z"/></svg>',
  rub: '<svg viewBox="0 0 24 24"><path d="M2 14c3-6 5 6 8 0s5 6 8 0 4 2 4 2" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
  hold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 6v6l4 3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
};

// ───────────────────────── game state ─────────────────────────
let state = 'menu', paused = false, now = 0;
let time = 0, score = 0, lives = 3, streak = 0, meter = 0, freezeT = 0, spawnT = 1, saves = 0, lastWinAt = -9;
const active = [];
const bubsEl = $('bubs');
let tutWait = null; // { id | 'miracle', done }

function canSpawn(d) {
  if (active.some(e => e.def.id === d.id)) return false;
  if (d.kid && kids[d.kid].userData.busy) return false;
  if (d.id === 'pot' && potObj && potObj.visible) return false;
  if (d.g === 'quiz' && active.some(e => e.def.g === 'quiz')) return false;
  const busyWith = { milchig: ['fleishig'], fleishig: ['milchig'], bug: ['meeting'], meeting: ['bug'] }[d.id];
  if (busyWith && active.some(e => busyWith.includes(e.def.id))) return false;
  return true;
}
function spawn(def, opt = {}) {
  const d = typeof def === 'string' ? DEFS.find(x => x.id === def) : def;
  if (!d || !canSpawn(d)) return null;
  const lifeMul = Math.max(.48, 1 - time / 210);
  const ev = { def: d, he: d.he, T: opt.T || Math.max(3.4, d.T * lifeMul), prog: 0, age: 0, done: false, ptr: null };
  ev.rem = ev.T;
  const el = document.createElement('div');
  el.className = 'bub pop' + (d.bonus ? ' bonus' : '');
  el.innerHTML = `<svg class="ring" viewBox="0 0 74 74"><circle cx="37" cy="37" r="34" fill="none" stroke="#0005" stroke-width="6"/><circle class="arc" cx="37" cy="37" r="34" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="213.6" transform="rotate(-90 37 37)"/></svg><div class="face"><img src="${IC(d.ic)}" alt=""></div><div class="prog"></div><div class="tag">${GESTURE_SVG[d.g]}<span>${d.act || VERB[d.g]}</span></div><div class="lbl"></div><div class="hand ${d.g}">${HAND}</div>`;
  el._ev = ev; ev.el = el; ev.handEl = el.querySelector('.hand'); ev.arc = el.querySelector('.arc'); ev.progEl = el.querySelector('.prog');
  bubsEl.appendChild(el);
  if (d.target) { ev.tgt = document.createElement('div'); ev.tgt.className = 'tgt'; bubsEl.appendChild(ev.tgt); ev.path = document.createElement('div'); ev.path.className = 'path'; bubsEl.appendChild(ev.path); }
  d.start && d.start(ev);
  el.querySelector('.lbl').textContent = ev.he;
  active.push(ev);
  placeBubbles();
  play('pop', .6);
  return ev;
}
function finish(ev, won, quiet) {
  if (ev.done) return;
  ev.done = true;
  const d = ev.def;
  if (quizEv === ev) closeQuiz();
  if (won) { d.win && d.win(ev); } else { d.fail && d.fail(ev); }
  d.end && d.end(ev);
  const sp = toScreen(d.anchor());
  ev.el.remove(); ev.tgt && ev.tgt.remove(); ev.path && ev.path.remove();
  if (ev.ghost) ev.ghost.remove();
  if (ev.holdSnd) ev.holdSnd.stop();
  active.splice(active.indexOf(ev), 1);
  let nin = false;
  if (won) {
    saves++;
    if (state === 'play') {
      streak++;
      const mult = 1 + Math.min(3, Math.floor(streak / 3)) * .5;
      const pts = Math.round((100 + 60 * clamp(ev.rem / ev.T, 0, 1)) * mult * (d.bonus ? 1.5 : 1));
      score += pts; floatText(sp, '+' + pts);
      if (streak > 0 && streak % 3 === 0) { play('combo', .6); if (streak % 6 === 0) say(pick(['סייעתא דשמיא!', 'בשורות טובות!', 'ברוך השם, הכל בשליטה.']), 1.6, 2); }
      // two saves within a moment of each other: a miracle inside a miracle
      if (!quiet && now - lastWinAt < 2) {
        score += 150; meter = Math.min(100, meter + 8);
        say('נס בתוך נס!', 1.8, 4); play('combo', .8, 1.2); nin = true; haniCheerT = 1; ninBanner();
      }
      if (!quiet) lastWinAt = now;
    }
    meter = Math.min(100, meter + (d.bonus ? 34 : 13));
    if (!quiet) { play('win', .7); sparks(sp); }
    if (nin) { setFace(2); faceT = 1.3; } else setFace(d.id === 'phone' ? 3 : d.id === 'tehilim' ? 5 : 6); if (!nin) faceT = ev.faceT || (d.id === 'phone' || d.id === 'tehilim' ? 1.8 : .9);
    if (!ev.noSay) say(pick(ev.sayWin || d.sayWin || ['ברוך השם.']), 2.4, 1);
    if (tutWait && (tutWait.id === d.id)) tutWait.done = true;
  } else if (!d.bonus) {
    streak = 0;
    if (!ev.noLife) loseLife(sp);
    setFace(1); faceT = 1.4;
    say(pick(ev.sayFail || d.sayFail || ['ברוך השם.']), 2.8, 3);
  }
  hud();
}
function loseLife(sp) {
  if (state !== 'play') return;
  lives--; play('munch', .9); floatText(sp, 'אוי', true);
  shakeT = .35;
  if (lives <= 0) gameOver();
}
// the big golden words across the screen
function ninBanner() {
  const b = document.createElement('div'); b.className = 'nin'; b.innerHTML = 'נס בתוך נס!<small>+150</small>';
  bubsEl.appendChild(b); setTimeout(() => b.remove(), 1700);
}
function floatText(sp, txt, bad) {
  const f = document.createElement('div'); f.className = 'float' + (bad ? ' bad' : ''); f.textContent = txt;
  f.style.left = sp.x + 'px'; f.style.top = sp.y + 'px'; bubsEl.appendChild(f); setTimeout(() => f.remove(), 1000);
}
function sparks(sp, n = 10) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.left = sp.x + 'px'; s.style.top = sp.y + 'px'; bubsEl.appendChild(s);
    const a = rnd(6.28), r = rnd(30, 70);
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: rnd(400, 700), easing: 'ease-out' }).onfinish = () => s.remove();
  }
}

// miracle
const miracleBtn = $('miracle');
function miracle() {
  if (meter < 100 || !(state === 'play' || state === 'tut')) return;
  meter = 0; freezeT = 4.5; spawnT = Math.max(spawnT, 4.5);
  play('miracle', .9); setMusicRate(1);
  setFace(2); faceT = 2.5; haniCheerT = 2.2;
  say('וואו! איזו השגחה פרטית! באמת, בכל רגע ורגע!', 3.2, 5);
  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 70%,#fff6c8cc,#ffd76a55 40%,transparent 75%)';
  bubsEl.appendChild(flash); flash.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: 1800 }).onfinish = () => flash.remove();
  const list = active.slice();
  list.forEach((ev, i) => setTimeout(() => { if (!ev.done) { burst(ev.def.anchor(), 0xffd34a, 18); finish(ev, true, true); } }, 150 + i * 160));
  for (let i = 0; i < 40; i++) emit(hani.position.clone().add(V(rnd(-2, 2), rnd(.5, 3), rnd(-1, 1))), { color: 0xffe08a, add: true, vel: V(rnd(-.5, .5), rnd(.5, 1.5), 0), life: rnd(1, 2), size: rnd(.04, .08), grav: 0 });
  if (tutWait && tutWait.id === 'miracle') tutWait.done = true;
  hud();
}
miracleBtn.addEventListener('click', miracle);
addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M' || e.key === 'מ') && !tut.on) miracle(); });

// ───────────────────────── input on bubbles ─────────────────────────
const ptrs = new Map();
const RUB_DIST = 520, HOLD_TIME = 1.0, CIRCLE_TURNS = 1.5;
bubsEl.addEventListener('pointerdown', e => {
  const el = e.target.closest('.bub'); if (!el) return;
  const ev = el._ev; if (!ev || ev.done || ev.ptr !== null || paused) return;
  if (tut.on && !tut.step().try) return;
  e.preventDefault();
  const g = ev.def.g;
  if (g === 'tap') { finish(ev, true); return; }
  if (g === 'quiz') { if (!quizEv) openQuiz(ev); return; }
  ev.ptr = e.pointerId;
  ptrs.set(e.pointerId, { ev, x: e.clientX, y: e.clientY });
  if (g === 'drag') {
    ev.ghost = document.createElement('div'); ev.ghost.className = 'ghost';
    ev.ghost.innerHTML = `<img src="${IC(ev.def.ic)}" alt="">`; bubsEl.appendChild(ev.ghost);
    ev.ghost.style.left = e.clientX + 'px'; ev.ghost.style.top = e.clientY + 'px';
    el.style.opacity = .35; play('whoosh', .4);
  }
  if (g === 'hold') ev.holdSnd = play('hold', .5);
});
addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const ev = p.ev, dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ev.done) { ptrs.delete(e.pointerId); return; }
  if (ev.def.g === 'drag') {
    ev.ghost.style.left = p.x + 'px'; ev.ghost.style.top = p.y + 'px';
    const t = toScreen(ev.def.target());
    ev.tgt.classList.toggle('hot', Math.hypot(t.x - p.x, t.y - p.y) < 60);
  } else if (ev.def.g === 'circle') {
    // turning around the bubble: add up the angle the finger sweeps around its centre
    const r = ev.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const a1 = Math.atan2(p.y - cy, p.x - cx), a0 = Math.atan2(p.y - dy - cy, p.x - dx - cx);
    let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    if (Math.hypot(p.x - cx, p.y - cy) > 8) ev.turn = (ev.turn || 0) + da;
    ev.prog = Math.min(1, Math.abs(ev.turn) / (CIRCLE_TURNS * 2 * Math.PI));
    if ((ev.rubAcc = (ev.rubAcc || 0) + Math.abs(da)) > 2) { ev.rubAcc = 0; play('rub', .4, 1.3); }
    if (ev.prog >= 1) { release(e.pointerId); finish(ev, true); }
  } else if (ev.def.g === 'rub') {
    ev.prog = Math.min(1, ev.prog + Math.hypot(dx, dy) / RUB_DIST);
    if ((ev.rubAcc = (ev.rubAcc || 0) + Math.hypot(dx, dy)) > 120) { ev.rubAcc = 0; play('rub', .45); }
    if (ev.prog >= 1) { release(e.pointerId); finish(ev, true); }
  }
});
function release(id, e) {
  const p = ptrs.get(id); if (!p) return;
  ptrs.delete(id);
  const ev = p.ev; ev.ptr = null;
  if (ev.holdSnd) { ev.holdSnd.stop(); ev.holdSnd = null; }
  if (ev.def.g === 'drag' && !ev.done) {
    const t = toScreen(ev.def.target());
    const hit = Math.hypot(t.x - p.x, t.y - p.y) < 64;
    ev.ghost.remove(); ev.ghost = null; ev.el.style.opacity = 1; ev.tgt.classList.remove('hot');
    if (hit) finish(ev, true);
  }
}
addEventListener('pointerup', e => release(e.pointerId));
addEventListener('pointercancel', e => release(e.pointerId));

// ───────────────────────── HUD ─────────────────────────
const livesEl = $('lives');
function hud() {
  if (livesEl.children.length !== 3) livesEl.innerHTML = [0, 1, 2].map(() => '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.8 0 5.8 4.1 4.3 7.4C19.5 16.4 12 21 12 21z"/></svg>').join('');
  [...livesEl.children].forEach((im, i) => im.classList.toggle('gone', i >= lives));
  $('score').firstChild.nodeValue = score;
  const mult = 1 + Math.min(3, Math.floor(streak / 3)) * .5;
  $('combo').textContent = mult > 1 ? `רצף ×${mult}` : '';
  $('meterFill').style.width = meter + '%';
  miracleBtn.classList.toggle('ready', meter >= 100);
}
const best = () => +(store.get(KEY.best) || 0);
function showBest() {
  const b = best();
  $('bestStart').innerHTML = b ? `השיא שלך: <b>${b}</b>` : '';
}

// ───────────────────────── screens / flow ─────────────────────────
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); if (id) { sayEl.classList.remove('on'); sayT = 0; sayPri = 0; } }
function playing(on) { $('hud').style.display = on ? 'flex' : 'none'; $('meterWrap').style.display = on ? 'flex' : 'none'; }
function clearAll() {
  for (const ev of active.slice()) { ev.done = true; ev.def.end && ev.def.end(ev); ev.el.remove(); ev.tgt && ev.tgt.remove(); ev.path && ev.path.remove(); ev.ghost && ev.ghost.remove(); if (ev.d) { ev.d.live = false; ev.d.hold = 0; } if (ev.b) ev.b.forEach(b => scene.remove(b)); }
  active.length = 0; ptrs.clear(); closeQuiz();
  for (const k of Object.values(kids)) { k.rotation.set(0, k.userData.homeRot, 0); if (k.userData.busy) goHome(k); }
  if (potObj) potObj.visible = false;
  if (dishObj) dishObj.visible = false;
}
function reset() { clearAll(); time = 0; score = 0; lives = 3; streak = 0; meter = 0; freezeT = 0; spawnT = 1.2; saves = 0; firstOrder = ['phone', 'malki', 'washer', 'meeting', 'milchig', 'server', 'diaper', 'fridge', 'test', 'oven', 'babycry', 'printer', 'tehilim', 'fleishig', 'pot', 'yotam']; hud(); }
let firstOrder = [];
function startGame() {
  reset(); state = 'play'; show(null); playing(true); window.track && track('game_start', 'nisei-nissim');
  say('בוקר טוב! בעזרת השם יהיה יום רגוע.', 2.4, 1);
}
function gameOver() {
  state = 'over'; window.track && track('game_over', 'nisei-nissim');
  play('over', .8); setMusicRate(1);
  const prev = best(), rec = score > prev;
  if (rec) store.set(KEY.best, score);
  setTimeout(() => {
    clearAll(); playing(false);
    $('overScore').textContent = score;
    $('overLine').textContent = '"' + pick(['ברוך השם, היה יום מלא סייעתא דשמיא.', 'מחר יום חדש, בעזרת השם.', 'הכל לטובה. גם הכאוס הזה.', 'בשורות טובות. ננסה שוב מחר בבוקר.']) + '"';
    $('overRec').innerHTML = rec && score > 0 ? '<span class="newrec">שיא חדש!</span>' : '';
    $('bestOver').innerHTML = `השיא שלך: <b>${Math.max(prev, score)}</b> · הצלות: <b>${saves}</b>`;
    show('over');
  }, 1300);
}
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  if (on === paused) return;
  paused = on;
  if (on) { show('paused'); SND.ctx && SND.ctx.suspend(); for (const id of [...ptrs.keys()]) release(id); }
  else { show(null); SND.ctx && SND.ctx.resume(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); hush(); } });
// leaving for the site: phones keep the page alive in the back cache, so the sound must stop by itself
function hush() { try { SND.ctx && SND.ctx.suspend(); } catch (e) {} }
addEventListener('pagehide', hush);
document.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', hush));
addEventListener('pageshow', e => { if (e.persisted && (state === 'play' || state === 'tut')) pause(true); });
$('pauseBtn').onclick = () => { play('click'); pause(true); };
$('resumeBtn').onclick = () => { play('click'); pause(false); };
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); clearAll(); state = 'menu'; playing(false); tut.end(true); showBest(); show('start'); };
$('playBtn').onclick = () => { play('click'); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { play('click'); tut.begin(); };
$('againBtn').onclick = () => { play('click'); startGame(); };
addEventListener('keydown', e => {
  if (e.key === 'Escape' && state === 'play') pause(!paused);
  if ((e.key === ' ' || e.key === 'Enter') && state === 'menu' && $('start').classList.contains('on')) { e.preventDefault(); $('playBtn').click(); }
  if ((e.key === ' ' || e.key === 'Enter') && state === 'over') { e.preventDefault(); startGame(); }
});

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
const rectSpot = el => () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + 10 }; };
const worldSpot = (fn, r = 60) => () => { const s = toScreen(fn()); return { x: s.x, y: s.y, r }; };
const evSpot = id => () => { const ev = active.find(e => e.def.id === id); if (!ev) return null; const s = toScreen(ev.def.anchor()); return { x: s.x, y: s.y, r: 58 }; };
const STEPS = [
  { text: 'זו <b>חני פרידמן</b>: מפתחת בכירה בטקי־טק, ואמא לתשעה ילדים, ברוך השם. היא עובדת ברוגע... וכל השאר קורה בבת אחת.', spot: worldSpot(() => V(0, 2.3, 5.75), 110) },
  { text: 'למעלה – <b>הבית</b> בבני ברק. למטה – <b>המשרד</b>. בעיות יצוצו בשני המקומות, ולפעמים בכמה מקומות ביחד.', spot: worldSpot(() => V(0, .5, -4.2), 120) },
  { text: '<b>המטרה:</b> להחזיק מעמד כמה שיותר. כל בעיה שפותרים = נקודות. כמה הצלות ברצף = נקודות כפולות.', spot: rectSpot($('score')) },
  { text: 'אלה 3 <b>לבבות</b>. בעיה שלא טופלה בזמן – לב אחד הולך. נגמרו הלבבות – נגמר הסיבוב.', spot: rectSpot($('lives')) },
  { text: 'כל בעיה מופיעה ב<b>בועה</b>, והטבעת סביבה היא השעון. <b>לחיצה:</b> הפלאפון הכשר מצלצל – לחצו על הבועה!', try: 'phone', spot: evSpot('phone') },
  { text: '<b>גרירה:</b> מלכי על השיש! גררו את הבועה אל העיגול המהבהב על השטיח.', try: 'malki', spot: evSpot('malki') },
  { text: '<b>שפשוף:</b> מכונת הכביסה מציפה! שפשפו את הבועה הלוך ושוב, עד שהרצפה יבשה.', try: 'washer', spot: evSpot('washer') },
  { text: '<b>החזקה:</b> השרת מתחמם! החזיקו את האצבע על הבועה עד שהיא מתמלאת.', try: 'server', spot: evSpot('server') },
  { text: '<b>סיבוב:</b> מוישי בוכה! סובבו את האצבע מסביב לבועה, כמו לנדנד אותו.', try: 'babycry', spot: evSpot('babycry') },
  { text: 'פתרתם שתי בעיות בתוך שתי שניות? זה <b>נס בתוך נס!</b> – בונוס של 150 נקודות. שתי אצבעות עובדות ביחד.' },
  { text: 'מעל כל בועה כתוב <b>מה לעשות</b>, ויד קטנה מראה איך. <b>בועה זהובה</b> = תהילים: ביקשו פרק לרפואה או לעילוי נשמה. מחזיקים קצת יותר, וזה ממלא את המד מהר.', show: 'tehilim', spot: evSpot('tehilim') },
  { text: 'כל הצלה ממלאת את <b>מד סייעתא דשמיא</b>.', spot: rectSpot($('meter')) },
  { text: 'המד מלא! לחצו על <b>״ניסי ניסים!״</b> – הכאוס נעצר וכל הבעיות נפתרות בבת אחת.', try: 'miracle', spot: rectSpot($('miracle')) },
  { text: 'מוכנים? ככל שהזמן עובר – יותר בעיות בבת אחת, והשעון מהיר יותר. <b>בהצלחה, ובשורות טובות!</b>', last: true },
];
const tut = {
  on: false, i: 0,
  step() { return STEPS[this.i] || {}; },
  begin() { reset(); state = 'tut'; this.on = true; this.i = 0; show(null); playing(true); tutCard.classList.add('on'); $('tutDim').classList.add('on'); this.enter(); },
  enter() {
    const s = this.step();
    tutWait = null;
    for (const ev of active.slice()) if (ev.def.id !== s.try && ev.def.id !== s.show) { ev.done = true; ev.def.end && ev.def.end(ev); ev.el.remove(); ev.tgt && ev.tgt.remove(); ev.path && ev.path.remove(); if (ev.d) { ev.d.live = false; ev.d.hold = 0; } if (ev.b) ev.b.forEach(b => scene.remove(b)); active.splice(active.indexOf(ev), 1); }
    if (s.try === 'miracle') { meter = 100; spawn('pot', { T: 1e9 }); spawn('moishi', { T: 1e9 }); tutWait = { id: 'miracle', done: false }; }
    else if (s.try) { spawn(s.try, { T: 1e9 }); tutWait = { id: s.try, done: false }; }
    if (s.show) spawn(s.show, { T: 1e9 });
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').textContent = s.last ? 'שחקו!' : 'הבא';
    hud();
  },
  next() {
    const s = this.step();
    if (tutWait && !tutWait.done) return;
    play('click');
    if (s.last) { this.end(); return; }
    this.i++; this.enter();
  },
  end(silent) {
    if (!this.on) return;
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1');
    if (!silent) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = this.step();
    const sp = s.spot ? s.spot() : null;
    if (sp) { Object.assign(tutHole.style, { display: 'block', left: sp.x - sp.r + 'px', top: sp.y - sp.r + 'px', width: sp.r * 2 + 'px', height: sp.r * 2 + 'px' }); }
    else Object.assign(tutHole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
    const low = sp ? sp.y > H * .5 : true;
    tutCard.style.top = low ? `calc(var(--safe-t) + 70px)` : 'auto';
    tutCard.style.bottom = low ? 'auto' : `calc(var(--safe-b) + 96px)`;
    const waiting = tutWait && !tutWait.done;
    $('tutNext').disabled = !!waiting;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => { play('click'); tut.end(); };
addEventListener('keydown', e => {
  if (!tut.on) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── the kids walk around ─────────────────────────
// free floor at home (x0, x1, z0, z1): in front of the kitchen, around the rug, by the sofa, by the bookshelf, by the stairs
const FLOOR = [[-3.0, 1.0, -6.8, -6.0], [-1.0, 1.6, -4.8, -2.3], [-.8, 1.4, -2.1, -1.8], [-3.4, -2.7, -2.6, -1.6], [1.8, 2.7, -4.5, -2.4]];
// what a kid cannot walk through (x0, x1, z0, z1): counters, fridge, wardrobe, stairs, washer, table + chairs, sofa,
// bookshelf, plant, the walls; in the office: Erez's desk, Hani's desk, the printer, the server
const BLOCK = [[-4.5, 2.1, -8.3, -7.05], [2.85, 4.5, -8.3, -4.8], [-4.5, -3.25, -5.95, -4.85], [-2.95, -1.05, -5.05, -3.15],
  [1.55, 3.65, -1.65, -.55], [-4.5, -3.65, -2.65, -1.15], [3.55, 4.5, -1.65, -.75], [-9, 9, -.45, .45], [-9, -4.25, -9, 9], [4.3, 9, -9, 9],
  [1.85, 3.35, 1.55, 2.55], [-1.6, 1.6, 5.85, 6.9], [3.05, 4.15, 4.75, 5.65], [-4.3, -3.1, .6, 1.8]];
const KID_R = .24;
function blocked(n, x, z) {
  for (const b of BLOCK) if (x > b[0] - KID_R && x < b[1] + KID_R && z > b[2] - KID_R && z < b[3] + KID_R) return true;
  for (const [m, o] of Object.entries(kids)) if (m !== n && Math.hypot(o.position.x - x, o.position.z - z) < KID_R * 2) return true;
  return false;
}
function walkKids(dt) {
  for (const [n, k] of Object.entries(kids)) {
    const u = k.userData;
    if (u.busy) { u.walk = null; continue; }
    if (u.baby || n === 'erez') continue;
    u.head.rotation.y = Math.sin(now * .8 + n.length) * .3;
    if (!u.walk) {
      u.wait = (u.wait ?? rnd(.3, 4)) - dt;
      if (u.wait > 0) continue;
      let to;
      if (n === 'yotam') to = P.yotam.clone().add(V(rnd(-.8, .8), 0, rnd(-.6, .6)));
      else if (Math.random() < .3) to = u.home.clone();
      else { const f = pick(FLOOR); to = V(rnd(f[0], f[1]), 0, rnd(f[2], f[3])); }
      u.walk = { to, speed: n === 'yotam' ? .9 : rnd(1, 1.5), stuck: 0 };
    }
    const w = u.walk, d = V(w.to.x - k.position.x, 0, w.to.z - k.position.z), len = d.length();
    if (len < .08) { stopWalk(k, rnd(1.5, 5)); continue; }
    // step toward the spot; if something is in the way slide along it, and if even that fails, wait and choose elsewhere
    const st = Math.min(len, w.speed * dt), sx = d.x / len * st, sz = d.z / len * st, x = k.position.x, z = k.position.z;
    const inside = blocked(n, x, z);
    let mx = 0, mz = 0;
    if (inside || !blocked(n, x + sx, z + sz)) { mx = sx; mz = sz; }
    else if (Math.abs(sx) > .002 && !blocked(n, x + Math.sign(sx) * st, z)) mx = Math.sign(sx) * st;
    else if (Math.abs(sz) > .002 && !blocked(n, x, z + Math.sign(sz) * st)) mz = Math.sign(sz) * st;
    if (!mx && !mz) { if ((w.stuck += dt) > .5) stopWalk(k, rnd(.3, 1.2)); u.arms.forEach(a => a.rotation.x *= .8); k.position.y = 0; continue; }
    w.stuck = 0;
    k.position.x += mx; k.position.z += mz;
    k.position.y = Math.abs(Math.sin(now * 11)) * .05;
    const ry = Math.atan2(mx, mz); k.rotation.y += Math.atan2(Math.sin(ry - k.rotation.y), Math.cos(ry - k.rotation.y)) * Math.min(1, dt * 10);
    u.arms.forEach((a, i) => a.rotation.x = Math.sin(now * 11 + i * Math.PI) * .5);
  }
}
function stopWalk(k, wait) { const u = k.userData; u.walk = null; u.wait = wait; k.position.y = 0; u.arms.forEach(a => a.rotation.x = 0); }

// ───────────────────────── loop ─────────────────────────
let faceT = 0, shakeT = 0, haniCheerT = 0, idleT = 3;
function spawner(dt) {
  if (freezeT > 0) return;
  spawnT -= dt;
  const maxActive = Math.min(7, 2 + Math.floor(time / 18));
  if (spawnT > 0 || active.length >= maxActive) return;
  let d = null;
  if (firstOrder.length) d = DEFS.find(x => x.id === firstOrder.shift());
  else {
    // the kosher phone loves to ring right in the middle of a rescue
    const dragging = [...ptrs.values()].some(p => p.ev.def.g === 'drag');
    const ok = DEFS.filter(x => canSpawn(x) && (!x.bonus || time > 15));
    if (dragging && ok.some(x => x.id === 'phone') && Math.random() < .35) d = DEFS.find(x => x.id === 'phone');
    else if (ok.length) d = pick(ok.filter(x => !x.bonus || Math.random() < .6));
  }
  if (d && spawn(d)) spawnT = Math.max(.75, 3.3 - time * .027) * rnd(.7, 1.3);
  else spawnT = .3;
}
function updEvents(dt) {
  for (const ev of active.slice()) {
    if (ev.done) continue;
    ev.age += dt;
    const ticking = state === 'play' && freezeT <= 0;
    if (ticking) ev.rem -= dt;
    if (ev.def.g === 'hold') {
      if (ev.ptr !== null) ev.prog = Math.min(1, ev.prog + realDt / (ev.def.hold || HOLD_TIME));
      else ev.prog = Math.max(0, ev.prog - realDt * .6);
      if (ev.prog >= 1) { const id = ev.ptr; finish(ev, true); if (id !== null) ptrs.delete(id); continue; }
    }
    const k = clamp(1 - ev.rem / ev.T, 0, 1);
    ev.def.upd && ev.def.upd(ev, dt, state === 'tut' ? .35 : k);
    if (ev.rem <= 0) { finish(ev, false); continue; }
    // ring colour: green → yellow → red
    const f = ev.rem / ev.T;
    ev.arc.style.strokeDashoffset = 213.6 * (1 - f);
    ev.arc.style.stroke = freezeT > 0 ? '#ffd76a' : f > .5 ? '#2bb673' : f > .25 ? '#ffb020' : '#e5484d';
    ev.el.classList.toggle('urgent', f < .25 && state === 'play');
    ev.progEl.style.setProperty('--p', (ev.prog * 100) + '%');
  }
}
function placeBubbles() {
  const pts = active.map(ev => { const s = toScreen(ev.def.anchor()); return { ev, x: s.x, y: s.y }; });
  for (let it = 0; it < 8; it++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j], dx = b.x - a.x, dy = (b.y - a.y) * .7, d = Math.hypot(dx, dy) || 1;
    if (d < 120) { const push = (120 - d) / 2, ux = dx / d, uy = dy / d / .7; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
  }
  for (const p of pts) {
    p.x = clamp(p.x, 64, W - 64); p.y = clamp(p.y, TOP_PAD + 62, H - BOT_PAD - SAY_H - 50);
    p.ev.el.style.left = p.x + 'px'; p.ev.el.style.top = p.y + 'px';
    if (p.ev.tgt) {
      const t = toScreen(p.ev.def.target()); p.ev.tgt.style.left = t.x + 'px'; p.ev.tgt.style.top = t.y + 'px';
      // a dashed path from the bubble to where it goes, and the hand walks along it
      const dx = t.x - p.x, dy = t.y - p.y, len = Math.hypot(dx, dy);
      Object.assign(p.ev.path.style, { left: p.x + 'px', top: p.y + 'px', width: Math.max(0, len - 42) + 'px', transform: `rotate(${Math.atan2(dy, dx)}rad)` });
      p.ev.handEl.style.setProperty('--dx', dx + 'px'); p.ev.handEl.style.setProperty('--dy', dy + 'px');
    }
    p.ev.el.classList.toggle('touched', p.ev.ptr !== null);
  }
}
function updHani(dt) {
  if (!hani) return;
  const cheer = haniCheerT > 0;
  // breathing, a little pop on every pose change, a shake when something goes wrong
  if (popT > 0) popT -= dt;
  const pop = popT > 0 ? 1 + Math.sin(popT / .18 * Math.PI) * .04 : 1;
  const breathe = 1 + Math.sin(now * 2.2) * .008;
  const pim = haniFig.material.map.image, asp = pim && pim.width ? pim.width / pim.height : .8; // the joy pose is wider (raised hands)
  haniFig.scale.set(FIG_H * asp * pop, FIG_H * pop * breathe, 1);
  haniFig.position.x = shakeT > 0 ? Math.sin(now * 50) * .06 : 0;
  haniFig.position.y = .55 + (cheer ? Math.abs(Math.sin(now * 8)) * .1 : 0);
  if (faceT > 0) return;
  const urgent = active.some(e => !e.def.bonus && e.rem / e.T < .25) && state === 'play';
  if (urgent) setFace(1);
  else if (sayT > 0) setFace(6);
  else { idleT -= dt; if (idleT <= 0) { idleT = rnd(4, 8); setFace(Math.random() < .35 ? 4 : 0); } else if (haniFace !== 0 && haniFace !== 4) setFace(0); }
}
let last = performance.now(), realDt = 0;
function frame(t) {
  requestAnimationFrame(frame);
  realDt = Math.min(.25, (t - last) / 1000); const dt = Math.min(.05, realDt); last = t;
  if (paused) return;
  now += dt;
  if (state === 'play') {
    time += dt;
    if (freezeT > 0) freezeT -= dt;
    spawner(dt);
    setMusicRate(1 + Math.min(.18, time / 900));
  }
  if (state === 'play' || state === 'tut' || state === 'over') updEvents(dt);
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
  }
  updParts(dt); updDiscs(dt);
  if (faceT > 0) faceT -= dt;
  if (shakeT > 0) shakeT -= dt;
  if (haniCheerT > 0) haniCheerT -= dt;
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) { sayEl.classList.remove('on'); sayPri = 0; } }
  updHani(dt);
  // idle life in the home
  walkKids(dt);
  placeBubbles();
  const hs = toScreen(HEAD_TOP());
  if (SAY_H) { sayEl.classList.add('low'); sayEl.style.left = W / 2 + 'px'; sayEl.style.top = (H - BOT_PAD - sayBand + 14) + 'px'; }
  else { sayEl.classList.remove('low'); sayEl.classList.add('side'); sayEl.style.left = Math.max(150, hs.x - 260) + 'px'; sayEl.style.top = Math.max(TOP_PAD + 50, hs.y + 70) + 'px'; }
  tut.frame();
  renderer.render(scene, camera);
}

// ───────────────────────── go ─────────────────────────
loadModels(f => { $('loading').textContent = 'רגע, טוען... ' + Math.round(f * 100) + '%'; }).then(() => {
  buildWorld(); buildPeople(); buildHani();
  fitCamera(); hud(); showBest();
  $('loading').remove();
  requestAnimationFrame(frame);
});
window.__game = { get state() { return state; }, get active() { return active; }, get score() { return score; }, get lives() { return lives; }, get meter() { return meter; }, set meter(v) { meter = v; hud(); }, spawn, finish, miracle, toScreen, DEFS, tut, startGame, SND, kids };
