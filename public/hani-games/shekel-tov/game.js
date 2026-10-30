// שקל טוב – catch the neighbours' coins in the tzedakah box on a sunny Bnei Brak street, and keep away from the aveiros.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const KEY = { best: 'hani-games:shekel-tov:best', tut: 'hani-games:shekel-tov:tut', snd: 'hani-games:shekel-tov:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = ag => '₪' + (ag / 100).toFixed(2);

// ───────────────────────── renderer / camera ─────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the street does not move: render its shadows once
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // the baked street and the live coins must match
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
const FOV = 30;
const camera = new THREE.PerspectiveCamera(FOV, 1, .5, 200);

let W = innerWidth, H = innerHeight;
let STRIP = 96, TOP_PAD = 100, ppu = 40, camY = 5, camD = 30, fieldTop = 10, fieldHalf = 4.3;
const BOX_W = 1.75, BOX_H = 1.45, BOX_D = 1.05;
function fitCamera() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  STRIP = Math.round(clamp(H * .14, 76, 120));
  document.documentElement.style.setProperty('--strip', STRIP + 'px');
  TOP_PAD = 100;
  // the play field is 9 units wide on a phone; on a wide screen it keeps a phone-like shape
  ppu = Math.min(W, H * .62) / 9;
  const visH = H / ppu;
  camD = visH / 2 / Math.tan(FOV / 2 * Math.PI / 180);
  const groundSy = H - STRIP - 12;
  camY = (groundSy - H / 2) / ppu;
  camera.aspect = W / H; camera.position.set(0, camY, camD); camera.lookAt(0, camY, 0); camera.updateProjectionMatrix();
  fieldTop = (H / 2 - TOP_PAD) / ppu + camY;
  fieldHalf = Math.min(W / ppu / 2 - .3, 6.5);
  scene.fog = new THREE.Fog(0xd8eefc, camD + 4, camD + 60);
  if (skyTex) bakeStreet();
}
addEventListener('resize', fitCamera);
const _p = new THREE.Vector3();
function toScreen(v) { _p.copy(v).project(camera); return { x: (_p.x + 1) / 2 * W, y: (1 - _p.y) / 2 * H }; }
const syToY = sy => (H / 2 - sy) / ppu + camY; // screen y → world y on the play plane (z = 0)

// ───────────────────────── light ─────────────────────────
scene.add(new THREE.HemisphereLight(0xfff6e4, 0x8a7a64, .62));
const sun = new THREE.DirectionalLight(0xffecc8, 1.45);
sun.position.set(-14, 26, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -6, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
sun.target.position.set(0, 4, -6);
scene.add(sun, sun.target);

// ───────────────────────── helpers ─────────────────────────
const mats = {};
function mat(c, o = {}) {
  const k = c + JSON.stringify(o);
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o }));
}
let ROOT = scene;
function mesh(geo, m, x = 0, y = 0, z = 0, parent = ROOT, shadow = true) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = shadow; parent.add(o); return o;
}
function box(w, h, d, c, x, y, z, parent = ROOT, o) { return mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c, o) : c, x, y, z, parent); }
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ───────────────────────── the street ─────────────────────────
const PLASTER = ['#f1e6d2', '#eadbc2', '#f4ede0', '#e6d6bb', '#efe3cc', '#ece4d8'];
const AWN = ['#2f7fd6', '#e8a33a', '#3aa36a', '#d65a4a'];
function facadeTex(cols, floors, color, balc) {
  const PX = 26, cw = 2.3 * PX, fh = 2.9 * PX;
  const c = cv(Math.round(cols * cw), Math.round(floors * fh + 1.2 * PX), (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},.04)`; g.fillRect(rnd(w), rnd(h), 2, 2); }
    // floor lines
    g.fillStyle = 'rgba(0,0,0,.07)';
    for (let f = 0; f <= floors; f++) g.fillRect(0, h - 1.2 * PX - f * fh, w, 3);
    for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
      const x0 = k * cw, y0 = h - 1.2 * PX - (f + 1) * fh;
      const door = balc[f] && balc[f].includes(k);
      const ww = door ? cw * .62 : cw * .5, wh = door ? fh * .78 : fh * .5;
      const x = x0 + (cw - ww) / 2, y = door ? y0 + fh - wh - 2 : y0 + fh * .22;
      g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 3, ww + 6, wh + 6);
      const gr = g.createLinearGradient(x, y, x + ww, y + wh); gr.addColorStop(0, '#9cc9ea'); gr.addColorStop(.5, '#5f95c4'); gr.addColorStop(1, '#3d6f9e');
      g.fillStyle = gr; g.fillRect(x, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + ww * .15, y); g.lineTo(x + ww * .4, y); g.lineTo(x + ww * .1, y + wh); g.lineTo(x, y + wh); g.lineTo(x, y + wh * .6); g.fill();
      // trisim: the Israeli roller shutters, some half down
      const sh = Math.random() < .5 ? rnd(.15, .7) : 0;
      if (sh) { g.fillStyle = '#d9d4cb'; g.fillRect(x, y, ww, wh * sh); g.fillStyle = 'rgba(0,0,0,.12)'; for (let yy = y + 4; yy < y + wh * sh; yy += 5) g.fillRect(x, yy, ww, 1); }
      g.fillStyle = '#ffffff'; g.fillRect(x + ww / 2 - 1.5, y + wh * sh, 3, wh * (1 - sh));
      if (!door) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x - 5, y + wh + 3, ww + 10, 4); }
    }
    // ground floor: shop fronts
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h - 1.2 * PX, w, 1.2 * PX);
  });
  return tex(c);
}
const railTex = tex(cv(128, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 5, w, 5);
  for (let x = 3; x < w; x += 10) g.fillRect(x, 0, 3, h);
}));
railTex.wrapS = THREE.RepeatWrapping;
const awnTex = AWN.map(c => tex(cv(64, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : c; g.fillRect(i * 8, 0, 8, h); } })));
function building(x, w, floors, z, color, far) {
  const cols = Math.max(2, Math.round(w / 2.3)); w = cols * 2.3;
  const h = floors * 2.9 + 1.2;
  const balc = {};
  if (!far) for (let f = 0; f < floors; f++) { balc[f] = []; for (let k = 0; k < cols; k++) if ((k + f) % 2 === 0 && Math.random() < .75) balc[f].push(k); }
  const ft = facadeTex(cols, floors, color, balc);
  const side = mat(new THREE.Color(color).multiplyScalar(.86).getHex());
  const front = new THREE.MeshStandardMaterial({ map: ft, roughness: .9 });
  const top = mat(0xcfc6b6);
  const b = mesh(new THREE.BoxGeometry(w, h, 6), [side, side, top, top, front, side], x, h / 2, z - 3);
  if (far) { b.castShadow = false; return; }
  const zf = z;
  for (let f = 0; f < floors; f++) for (const k of balc[f]) {
    const cx = x - w / 2 + (k + .5) * 2.3, fy = 1.2 + f * 2.9;
    box(2.1, .16, .9, 0xf2efe8, cx, fy + .06, zf + .45);
    const r = mesh(new THREE.PlaneGeometry(2.1, .95), new THREE.MeshStandardMaterial({ map: railTex, transparent: true, alphaTest: .5, side: THREE.DoubleSide, roughness: .5 }), cx, fy + .6, zf + .88);
    r.material.map = railTex;
    if (Math.random() < .5) { // plants on the balcony
      const pot = mesh(new THREE.CylinderGeometry(.16, .12, .26, 10), mat(0xc0643a), cx + rnd(-.7, .7), fy + .27, zf + .55);
      mesh(new THREE.SphereGeometry(.26, 10, 8), mat(0x3f9a44), 0, .28, 0, pot);
    }
    if (Math.random() < .3) { // a striped sun awning
      const a = mesh(new THREE.PlaneGeometry(2.1, 1.1), new THREE.MeshStandardMaterial({ map: pick(awnTex), side: THREE.DoubleSide, roughness: .8 }), cx, fy + 2.45, zf + .5);
      a.rotation.x = -1.0;
    }
  }
  // the ground floor: shops with coloured awnings
  for (let k = 0; k < cols; k++) if (Math.random() < .6) {
    const a = mesh(new THREE.PlaneGeometry(2.2, 1), new THREE.MeshStandardMaterial({ map: pick(awnTex), side: THREE.DoubleSide }), x - w / 2 + (k + .5) * 2.3, 1.05, zf + .45);
    a.rotation.x = -.9;
  }
  // roof: solar water heaters (the dud shemesh on every Israeli roof)
  for (let i = 0; i < 2; i++) {
    const sx = x + rnd(-w / 3, w / 3);
    const tank = mesh(new THREE.CylinderGeometry(.35, .35, 1.4, 14), mat(0xf4f4f0, { roughness: .4 }), sx, h + .8, zf - 2);
    tank.rotation.z = Math.PI / 2;
    const pn = box(1.6, .06, 1.1, mat(0x24456e, { roughness: .3, metalness: .4 }), sx, h + .45, zf - 1.2); pn.rotation.x = .5;
  }
}
function tree(x, z) {
  mesh(new THREE.CylinderGeometry(.14, .2, 2.4, 8), mat(0x7a5a3a), x, 1.2, z);
  for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(rnd(.7, 1), 10, 8), mat(pick([0x3f8f3c, 0x4fa244, 0x357a34])), x + rnd(-.7, .7), 2.7 + rnd(.8), z + rnd(-.4, .4));
}
function buildStreet() {
  ROOT = street; scene.add(street);
  // sky
  skyTex = tex(cv(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5fb3ef'); gr.addColorStop(.6, '#a6d6f6'); gr.addColorStop(1, '#e4f3fd'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  // sidewalk with pavers, a curb, the road
  const pav = tex(cv(128, 128, (g, w, h) => {
    g.fillStyle = '#cfc8bd'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = ((x + y) % 2) ? '#d9d2c6' : '#c6bdb0'; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
  }));
  pav.wrapS = pav.wrapT = THREE.RepeatWrapping; pav.repeat.set(40, 6);
  const side = mesh(new THREE.PlaneGeometry(80, 12), new THREE.MeshStandardMaterial({ map: pav, roughness: .95 }), 0, 0, -1);
  side.rotation.x = -Math.PI / 2;
  box(80, .25, .4, 0xe8e2d6, 0, .12, 5.1);
  const road = mesh(new THREE.PlaneGeometry(80, 20), mat(0x55585e), 0, -.02, 15);
  road.rotation.x = -Math.PI / 2;
  // the row of houses across the street from us, and a paler row behind
  let x = -34;
  while (x < 34) { const w = rnd(6, 9.5); building(x + w / 2, w, 4 + Math.floor(rnd(4)), -7, pick(PLASTER)); x += w + rnd(.3, 1.2); }
  x = -50;
  while (x < 50) { const w = rnd(7, 11); building(x + w / 2, w, 7 + Math.floor(rnd(5)), -20, pick(PLASTER), true); x += w + rnd(.5, 2); }
  for (const tx of [-7.6, 7.6, -13, 13, -19, 19]) tree(tx, -5);
  ROOT = scene;
}
// the street never moves: render it once into a picture and draw only the coins and the box live
const street = new THREE.Group();
let skyTex, streetRT = null;
function bakeStreet() {
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (streetRT) streetRT.dispose();
  streetRT = new THREE.WebGLRenderTarget(sz.x, sz.y, { samples: 4 });
  const hidden = scene.children.filter(o => o !== street && o.visible && !o.isLight);
  hidden.forEach(o => o.visible = false);
  street.visible = true; scene.background = skyTex;
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(streetRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
  hidden.forEach(o => o.visible = true);
  street.visible = false; scene.background = streetRT.texture;
}

// ───────────────────────── the coins: real Israeli coins, drawn on canvas ─────────────────────────
const MM = .056; // world units per millimetre
const COINS = [
  { id: 'a10', ag: 10, mm: 22, metal: 'gold', num: '10', words: ['אגורות'], motif: 'menorah', w: 30, label: '10 אג׳' },
  { id: 'h', ag: 50, mm: 26, metal: 'gold', num: '½', words: ['שקל חדש'], motif: 'lyre', w: 25, label: '½ ₪' },
  { id: 's1', ag: 100, mm: 18, metal: 'silver', num: '1', words: ['שקל חדש'], motif: 'lily', w: 20, label: '1 ₪' },
  { id: 's2', ag: 200, mm: 21.6, metal: 'silver', num: '2', words: ['שקלים', 'חדשים'], motif: 'horns', w: 13, label: '2 ₪' },
  { id: 's5', ag: 500, mm: 24, metal: 'silver', sides: 12, num: '5', words: ['שקלים', 'חדשים'], motif: 'capital', w: 8, label: '5 ₪' },
  { id: 's10', ag: 1000, mm: 23, metal: 'bi', num: '10', words: ['שקלים', 'חדשים'], motif: 'palm', w: 4, label: '10 ₪' },
];
const COIN = Object.fromEntries(COINS.map(c => [c.id, c]));
const PAL = {
  gold: { hi: '#fff6cf', lo: '#553809', face: '#e3bb5c', b0: '#f6d98a', b1: '#c7963c', b2: '#8a5f22', edge: 0xd2a24a },
  silver: { hi: '#ffffff', lo: '#40464f', face: '#d5d9de', b0: '#eef0f3', b1: '#aab0b8', b2: '#68707a', edge: 0xaeb3ba },
};
const CORE = 176; // the gold centre of the 10 ₪ (16 of 23 mm)
function shapePath(g, c, r) {
  g.beginPath();
  if (c.sides) for (let i = 0; i <= c.sides; i++) { const a = i / c.sides * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](256 + Math.cos(a) * r, 256 + Math.sin(a) * r); }
  else g.arc(256, 256, r, 0, Math.PI * 2);
  g.closePath();
}
function tint(m, color) { return cv(512, 512, g => { g.drawImage(m, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 512, 512); }); }
function metal(g, p, r) {
  const gr = g.createRadialGradient(190, 170, 10, 230, 230, r * 1.25);
  gr.addColorStop(0, p.b0); gr.addColorStop(.55, p.b1); gr.addColorStop(1, p.b2);
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  // fine brushed grain
  g.globalAlpha = .06;
  for (let i = 0; i < 260; i++) { g.strokeStyle = Math.random() < .5 ? '#000' : '#fff'; g.beginPath(); const a = rnd(6.28), rr = rnd(r); g.arc(256, 256, rr, a, a + rnd(.2, .8)); g.stroke(); }
  g.globalAlpha = 1;
}
// raised design: dark shadow below-right, bright edge above-left, polished top
function relief(g, m, p) {
  g.globalAlpha = .8; g.drawImage(tint(m, p.lo), 4, 5);
  g.globalAlpha = .9; g.drawImage(tint(m, p.hi), -3, -3);
  g.globalAlpha = 1; g.drawImage(tint(m, p.face), 0, 0);
}
const cut = (m, fn) => { m.save(); m.globalCompositeOperation = 'destination-out'; fn(); m.restore(); };
const F = (w, s) => `${w} ${s}px Rubik, "Arial Hebrew", Arial, sans-serif`;
function arcText(m, txt, R, size, top, rtl, weight = 700) {
  m.save(); m.font = F(weight, size); m.textAlign = 'center'; m.textBaseline = 'middle';
  const ch = [...txt], ws = ch.map(x => m.measureText(x).width + size * .1), tot = ws.reduce((a, b) => a + b, 0);
  let a = (rtl ? 1 : -1) * tot / R / 2;
  const dir = rtl ? -1 : 1;
  ch.forEach((x, i) => {
    a += dir * ws[i] / 2 / R;
    m.save();
    if (top) { m.translate(256 + R * Math.sin(a), 256 - R * Math.cos(a)); m.rotate(a); }
    else { m.translate(256 + R * Math.sin(a), 256 + R * Math.cos(a)); m.rotate(-a); }
    m.fillText(x, 0, 0); m.restore();
    a += dir * ws[i] / 2 / R;
  });
  m.restore();
}
const MOTIF = {
  // the Hasmonean menorah on a stepped stand
  menorah(m) {
    m.lineWidth = 12;
    m.beginPath(); m.moveTo(256, 146); m.lineTo(256, 350); m.stroke();
    for (let i = 1; i <= 3; i++) { m.beginPath(); m.arc(256, 146, 36 * i, 0, Math.PI); m.stroke(); }
    for (let i = -3; i <= 3; i++) { rrect(m, 256 + i * 36 - 12, 120, 24, 20, 4); m.fill(); }
    m.fillRect(222, 344, 68, 16);
    m.beginPath(); m.moveTo(212, 360); m.lineTo(300, 360); m.lineTo(320, 398); m.lineTo(192, 398); m.closePath(); m.fill();
    cut(m, () => { m.lineWidth = 3; for (const y of [372, 385]) { m.beginPath(); m.moveTo(206, y); m.lineTo(306, y); m.stroke(); } });
  },
  // an ancient lyre
  lyre(m) {
    m.lineWidth = 14;
    for (const s of [1, -1]) {
      m.save(); if (s < 0) { m.translate(512, 0); m.scale(-1, 1); }
      m.beginPath(); m.moveTo(216, 370); m.bezierCurveTo(150, 320, 164, 210, 204, 152); m.quadraticCurveTo(214, 132, 232, 142); m.stroke();
      m.restore();
    }
    m.lineWidth = 15; m.beginPath(); m.moveTo(194, 174); m.lineTo(318, 174); m.stroke();
    rrect(m, 194, 350, 124, 46, 16); m.fill();
    m.lineWidth = 5; for (let x = 226; x <= 286; x += 12) { m.beginPath(); m.moveTo(x, 174); m.lineTo(x, 352); m.stroke(); }
    cut(m, () => { m.lineWidth = 3; rrect(m, 204, 360, 104, 26, 10); m.stroke(); });
  },
  // the lily with the ancient word יהד
  lily(m) {
    m.beginPath(); m.moveTo(256, 322); m.bezierCurveTo(220, 268, 226, 190, 256, 136); m.bezierCurveTo(286, 190, 292, 268, 256, 322); m.fill();
    m.lineWidth = 20;
    for (const s of [1, -1]) {
      m.save(); if (s < 0) { m.translate(512, 0); m.scale(-1, 1); }
      m.beginPath(); m.moveTo(244, 316); m.bezierCurveTo(196, 300, 158, 252, 168, 196); m.quadraticCurveTo(178, 168, 204, 184); m.stroke();
      m.restore();
    }
    rrect(m, 204, 318, 104, 20, 8); m.fill();
    m.fillRect(244, 336, 24, 38);
    rrect(m, 214, 372, 84, 16, 7); m.fill();
    cut(m, () => { m.lineWidth = 3; m.beginPath(); m.moveTo(256, 160); m.lineTo(256, 300); m.stroke(); });
    m.font = F(900, 46); m.textAlign = 'center'; m.textBaseline = 'middle'; m.direction = 'rtl';
    m.fillText('יהד', 128, 300);
  },
  // two cornucopias with a pomegranate between them
  horns(m) {
    for (const s of [1, -1]) {
      m.save(); if (s < 0) { m.translate(512, 0); m.scale(-1, 1); }
      m.beginPath(); m.moveTo(146, 206); m.bezierCurveTo(156, 304, 226, 362, 302, 396); m.bezierCurveTo(240, 330, 214, 282, 218, 200); m.closePath(); m.fill();
      cut(m, () => { m.lineWidth = 4; for (let i = 1; i < 6; i++) { const t = i / 6; m.beginPath(); m.moveTo(146 + 40 * t + 20 * t, 206 + 150 * t); m.lineTo(218 + 20 * t, 200 + 120 * t); m.stroke(); } });
      m.lineWidth = 8; m.beginPath(); m.ellipse(182, 198, 40, 13, -.15, 0, Math.PI * 2); m.stroke();
      for (const [x, y, r] of [[160, 176, 15], [186, 168, 16], [210, 178, 14], [174, 148, 14], [198, 142, 13]]) { m.beginPath(); m.arc(x, y, r, 0, 6.3); m.fill(); }
      m.restore();
    }
    m.beginPath(); m.arc(256, 238, 26, 0, 6.3); m.fill();
    m.beginPath(); m.moveTo(240, 214); m.lineTo(246, 196); m.lineTo(252, 210); m.lineTo(256, 192); m.lineTo(260, 210); m.lineTo(266, 196); m.lineTo(272, 214); m.closePath(); m.fill();
  },
  // the capital of an Ionic column
  capital(m) {
    m.fillRect(168, 172, 176, 22);
    m.lineWidth = 10;
    for (const s of [1, -1]) {
      m.save(); if (s < 0) { m.translate(512, 0); m.scale(-1, 1); }
      m.beginPath();
      for (let t = 0; t <= Math.PI * 4.2; t += .1) { const r = 38 - t * 2.6, x = 198 - Math.cos(t) * r, y = 236 - Math.sin(t) * r; t ? m.lineTo(x, y) : m.moveTo(x, y); }
      m.stroke(); m.beginPath(); m.arc(198, 236, 7, 0, 6.3); m.fill();
      m.restore();
    }
    rrect(m, 204, 196, 104, 50, 12); m.fill();
    cut(m, () => { m.lineWidth = 4; for (const x of [226, 256, 286]) { m.beginPath(); m.ellipse(x, 222, 10, 15, 0, 0, 6.3); m.stroke(); } });
    m.fillRect(214, 252, 84, 12);
    m.fillRect(220, 270, 72, 110);
    cut(m, () => { m.lineWidth = 5; for (const x of [232, 247, 262, 277]) { m.beginPath(); m.moveTo(x, 276); m.lineTo(x, 376); m.stroke(); } });
  },
  // a palm tree with two baskets of dates
  palm(m) {
    m.lineWidth = 20; m.lineCap = 'round';
    m.beginPath(); m.moveTo(256, 396); m.quadraticCurveTo(244, 300, 256, 190); m.stroke();
    cut(m, () => { m.lineWidth = 3; for (let y = 210; y < 390; y += 17) { m.beginPath(); m.moveTo(242, y); m.quadraticCurveTo(252, y + 6, 266, y); m.stroke(); } });
    const top = [256, 186];
    for (const a of [-170, -145, -118, -90, -62, -35, -10]) {
      const r = a * Math.PI / 180, len = 112, ex = top[0] + Math.cos(r) * len, ey = top[1] + Math.sin(r) * len * .8 + (Math.abs(a + 90) > 60 ? 40 : 0);
      const nx = -Math.sin(r), ny = Math.cos(r);
      m.beginPath(); m.moveTo(top[0], top[1]);
      m.quadraticCurveTo((top[0] + ex) / 2 + nx * 18 - 6, (top[1] + ey) / 2 - 26 + ny * 18, ex, ey);
      m.quadraticCurveTo((top[0] + ex) / 2 - nx * 14, (top[1] + ey) / 2 - 18 - ny * 14, top[0], top[1]); m.fill();
    }
    for (const s of [1, -1]) {
      m.save(); if (s < 0) { m.translate(512, 0); m.scale(-1, 1); }
      m.beginPath(); m.moveTo(150, 336); m.lineTo(222, 336); m.lineTo(212, 394); m.lineTo(160, 394); m.closePath(); m.fill();
      for (const [x, y] of [[164, 326], [182, 322], [200, 322], [216, 328], [174, 310], [192, 306], [208, 312]]) { m.beginPath(); m.arc(x, y, 10, 0, 6.3); m.fill(); }
      cut(m, () => { m.lineWidth = 3; for (let i = 0; i < 6; i++) { m.beginPath(); m.moveTo(146 + i * 14, 340); m.lineTo(166 + i * 14, 392); m.stroke(); m.beginPath(); m.moveTo(226 - i * 14, 340); m.lineTo(206 - i * 14, 392); m.stroke(); } });
      m.restore();
    }
  },
};
function coinFace(c, side) {
  const bi = c.metal === 'bi', p = bi ? PAL.silver : PAL[c.metal];
  const m = cv(512, 512, g => {
    g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 13; shapePath(g, c, 236); g.stroke(); // raised rim
    if (side === 0) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      if (bi) {
        g.font = F(900, 150); g.fillText(c.num, 256, 214);
        g.font = F(700, 42); c.words.forEach((w, i) => g.fillText(w, 256, 296 + i * 44));
      } else {
        g.font = F(900, c.num.length > 1 ? 178 : 210); g.fillText(c.num, 256, 196);
        const two = c.words.length > 1;
        g.font = F(700, two ? 52 : 58); c.words.forEach((w, i) => g.fillText(w, 256, (two ? 322 : 342) + i * 56));
        g.lineWidth = 6; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(108 + i * 11, 232); g.lineTo(108 + i * 11, 262); g.stroke(); }
      }
    } else {
      g.save();
      const k = bi ? .64 : .94;
      g.translate(256, bi ? 262 : 268); g.scale(k, k); g.translate(-256, -256);
      MOTIF[c.motif](g);
      g.restore();
      if (bi) { arcText(g, 'ישראל', 208, 36, true, true, 900); arcText(g, 'ISRAEL', 210, 30, false, false, 900); }
      else { arcText(g, 'ישראל', 196, 40, true, true, 900); arcText(g, 'ISRAEL', 204, 32, false, false, 900); }
    }
  });
  const map = cv(512, 512, g => {
    shapePath(g, c, 255); g.clip();
    metal(g, p, 256);
    if (bi) {
      g.save(); g.beginPath(); g.arc(256, 256, CORE, 0, 6.3); g.clip(); metal(g, PAL.gold, CORE); relief(g, m, PAL.gold); g.restore();
      g.save(); g.beginPath(); g.arc(256, 256, 256, 0, 6.3); g.arc(256, 256, CORE, 0, 6.3, true); g.clip(); relief(g, m, PAL.silver); g.restore();
      g.lineWidth = 4; g.strokeStyle = '#3a3a3a'; g.globalAlpha = .55; g.beginPath(); g.arc(256, 256, CORE, 0, 6.3); g.stroke(); g.globalAlpha = 1;
    } else relief(g, m, p);
  });
  const bump = cv(512, 512, g => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 512, 512);
    g.filter = 'blur(2px)'; g.drawImage(m, 0, 0); g.filter = 'none';
    if (bi) { g.strokeStyle = '#303030'; g.lineWidth = 5; g.beginPath(); g.arc(256, 256, CORE, 0, 6.3); g.stroke(); }
  });
  return new THREE.MeshStandardMaterial({ map: tex(map), bumpMap: tex(bump, false), bumpScale: 2.5, metalness: .72, roughness: .34, envMapIntensity: .85 });
}
const coinKit = {};
function buildCoinKit() {
  for (const c of COINS) {
    const r = c.mm * MM / 2, th = Math.max(.08, c.mm * MM * .09), segs = c.sides || 48;
    const edgeGeo = new THREE.CylinderGeometry(r, r, th, segs, 1, true); edgeGeo.rotateX(Math.PI / 2);
    const edgeMat = new THREE.MeshStandardMaterial({ color: (c.metal === 'gold' ? PAL.gold : PAL.silver).edge, metalness: .6, roughness: .32, flatShading: !!c.sides });
    coinKit[c.id] = { r, th, edgeGeo, edgeMat, faceGeo: new THREE.CircleGeometry(r, segs), front: coinFace(c, 0), back: coinFace(c, 1) };
  }
}
function makeCoin(c) {
  const k = coinKit[c.id], g = new THREE.Group();
  g.add(new THREE.Mesh(k.edgeGeo, k.edgeMat));
  const f = new THREE.Mesh(k.faceGeo, k.front); f.position.z = k.th / 2; g.add(f);
  const b = new THREE.Mesh(k.faceGeo, k.back); b.position.z = -k.th / 2; b.rotation.y = Math.PI; g.add(b);
  scene.add(g); return g;
}

// ───────────────────────── the aveiros (gentle, labelled) ─────────────────────────
const BADS = [
  { id: 'lashon', label: 'לשון הרע', line: 'בלי לשון הרע, בעזרת השם.' },
  { id: 'kaas', label: 'כעס', line: 'רגע, נושמים עמוק. בלי כעס.' },
  { id: 'kina', label: 'קנאה', line: 'כל אחד והחלק שלו. בלי קנאה.' },
];
const BAD = Object.fromEntries(BADS.map(b => [b.id, b]));
const BAD_W = 2.1, BAD_H = 1.6;
function badTex(b) {
  return tex(cv(512, 390, (g, w, h) => {
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 16; g.shadowOffsetY = 8;
    g.lineJoin = 'round';
    if (b.id === 'lashon') { // a dark speech bubble
      g.beginPath(); g.ellipse(256, 170, 222, 136, 0, 0, Math.PI * 2);
      g.moveTo(130, 270); g.lineTo(84, 362); g.lineTo(206, 296); g.closePath();
      const gr = g.createLinearGradient(0, 30, 0, 340); gr.addColorStop(0, '#5a606c'); gr.addColorStop(1, '#22262e'); g.fillStyle = gr; g.fill();
      g.restore(); g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(200, 98, 110, 34, -.15, 0, Math.PI * 2); g.fill();
    } else if (b.id === 'kaas') { // a hot red spiky cloud
      g.beginPath();
      const n = 16;
      for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 150 : 192; g.lineTo(256 + Math.cos(a) * r * 1.22, 195 + Math.sin(a) * r * .95); }
      g.closePath();
      const gr = g.createRadialGradient(230, 150, 20, 256, 195, 230); gr.addColorStop(0, '#ff9a6a'); gr.addColorStop(.6, '#e53a2a'); gr.addColorStop(1, '#a3121a'); g.fillStyle = gr; g.fill();
      g.restore(); g.lineWidth = 10; g.strokeStyle = '#ffe3c8'; g.stroke();
    } else { // a sour green cloud
      g.beginPath();
      for (const [x, y, r] of [[150, 210, 96], [250, 150, 118], [360, 196, 100], [300, 262, 92], [190, 268, 88]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
      const gr = g.createLinearGradient(0, 40, 0, 360); gr.addColorStop(0, '#c9ec62'); gr.addColorStop(1, '#5e9a1f'); g.fillStyle = gr; g.fill();
      g.restore(); g.fillStyle = gr;
      g.lineWidth = 10; g.strokeStyle = '#f6ffd8';
      for (const [x, y, r] of [[150, 210, 96], [250, 150, 118], [360, 196, 100], [300, 262, 92], [190, 268, 88]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
      for (const [x, y, r] of [[150, 210, 91], [250, 150, 113], [360, 196, 95], [300, 262, 87], [190, 268, 83]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    }
    // the label
    const size = b.label.length > 4 ? 92 : 124;
    g.font = F(900, size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    const ty = b.id === 'lashon' ? 172 : 200;
    g.lineWidth = 14; g.strokeStyle = b.id === 'kina' ? '#2f5a0c' : b.id === 'kaas' ? '#7a0c10' : '#14171c'; g.strokeText(b.label, 256, ty);
    g.fillStyle = '#ffffff'; g.fillText(b.label, 256, ty);
  }));
}
const badMat = {};
function makeBad(b) {
  const o = new THREE.Mesh(badGeo, badMat[b.id]); scene.add(o); return o;
}
let badGeo;

// ───────────────────────── the tzedakah box ─────────────────────────
let pushke, pushkeBody, boxX = 0, boxShow = 0;
function buildBox() {
  pushke = new THREE.Group(); scene.add(pushke);
  pushkeBody = new THREE.Group(); pushke.add(pushkeBody);
  const front = tex(cv(512, 424, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f78dc'); gr.addColorStop(1, '#14479a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; rrect(g, 30, 92, w - 60, 240, 26); g.fill();
    g.fillStyle = '#1d5fbf'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = F(900, 128); g.fillText('צדקה', 256, 200);
    g.font = F(700, 40); g.fillText('מוסדות ״שקל טוב״', 256, 292);
    g.fillStyle = '#ffffff'; g.font = F(700, 38); g.fillText('צדקה תציל ממוות', 256, 50);
    g.fillRect(0, 372, w, 10); g.fillRect(0, 392, w, 6);
    // a small Magen David either side of the word
    g.strokeStyle = '#1d5fbf'; g.lineWidth = 5;
    for (const x of [82, 430]) for (const r0 of [0, Math.PI]) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = r0 - Math.PI / 2 + i * Math.PI * 2 / 3; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 22, 200 + Math.sin(a) * 22); } g.closePath(); g.stroke(); }
  }));
  const sideT = tex(cv(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f78dc'); gr.addColorStop(1, '#14479a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 54, w, 3); }));
  const tin = o => new THREE.MeshStandardMaterial({ roughness: .35, metalness: .45, envMapIntensity: .9, ...o });
  const sideM = tin({ map: sideT }), topM = tin({ color: 0x2a6fd0 });
  const body = mesh(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D), [sideM, sideM, topM, topM, tin({ map: front }), sideM], 0, BOX_H / 2, 0, pushkeBody);
  body.castShadow = false;
  // white tin rims top and bottom
  box(BOX_W + .06, .1, BOX_D + .06, tin({ color: 0xf4f6fa }), 0, BOX_H - .03, 0, pushkeBody).castShadow = false;
  box(BOX_W + .06, .1, BOX_D + .06, tin({ color: 0xf4f6fa }), 0, .05, 0, pushkeBody).castShadow = false;
  // the slot
  box(1.1, .03, .16, mat(0x0b1424, { roughness: .9 }), 0, BOX_H + .02, 0, pushkeBody).castShadow = false;
  box(1.22, .05, .3, tin({ color: 0xdfe5ee }), 0, BOX_H + .005, 0, pushkeBody).castShadow = false;
  box(1.1, .06, .16, mat(0x0b1424, { roughness: .9 }), 0, BOX_H + .02, 0, pushkeBody).castShadow = false;
  // a little padlock hasp
  box(.2, .26, .05, tin({ color: 0xd8b04e, metalness: .8 }), 0, BOX_H - .2, BOX_D / 2 + .03, pushkeBody).castShadow = false;
  // a soft shadow on the pavement
  const sh = mesh(new THREE.CircleGeometry(1.15, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false }), 0, .01, 0, pushke, false);
  sh.rotation.x = -Math.PI / 2; sh.scale.set(1, .55, 1);
  pushkeBody.rotation.x = .12;
  pushke.traverse(o => { o.castShadow = false; o.receiveShadow = false; });
}

// ───────────────────────── Hani ─────────────────────────
const POSES = ['calm', 'surprised', 'joy', 'phone', 'chin', 'tehilim', 'talk'];
const poseImg = {};
for (const n of POSES) { const im = new Image(); im.src = `assets/pose-${n}.png`; poseImg[n] = im; }
const haniEl = $('hani');
let haniPose = 'calm', faceT = 0, idleT = 4;
function setPose(n, hold = 0) {
  if (hold) faceT = hold;
  if (haniPose === n) return;
  haniPose = n; haniEl.src = poseImg[n].src;
  haniEl.parentNode.classList.toggle('up', n === 'joy');
  $('strip').classList.toggle('up', n === 'joy');
  haniEl.classList.remove('pop'); void haniEl.offsetWidth; haniEl.classList.add('pop');
}
const sayEl = $('say');
let sayT = 0, sayPri = 0, sayGap = 0;
function say(text, dur = 2.6, pri = 1) {
  if (!text || (sayT > 0 && pri < sayPri)) return;
  sayEl.textContent = text; sayEl.classList.add('on'); sayT = dur; sayPri = pri; sayGap = 3.5;
  if (faceT <= 0) setPose('talk');
}
const LINES = {
  coin: ['ברוך השם, עוד שקל לקופה.', 'שקל ועוד שקל – קופה מלאה.', 'צדקה תציל ממוות.', 'תזכו למצוות!', 'כל אגורה חשובה.', 'יישר כוח לשכנים.'],
  big: ['עשרה שקלים! ברוך השם.', 'איזו נדיבות, תזכו למצוות.', 'שכנים כאלה, ברוך השם.'],
  start: ['בעזרת השם נמלא את הקופה.', 'יאללה, אוספים צדקה.', 'שקל ועוד שקל – קופה מלאה.'],
  hurry: ['עוד קצת, בעזרת השם.', 'כמעט! עוד כמה מטבעות.'],
  full: ['ברוך השם, הקופה מלאה!', 'קופה מלאה! תזכו למצוות.'],
};

// ───────────────────────── tweens, sparks ─────────────────────────
const tweens = [];
function tween(dur, fn, done) { const t = { t: 0, dur, fn, done }; tweens.push(t); return t; }
const fxEl = $('fx');
function floatText(sp, txt, bad) {
  const f = document.createElement('div'); f.className = 'float' + (bad ? ' bad' : ''); f.textContent = txt;
  f.style.left = sp.x + 'px'; f.style.top = sp.y + 'px'; fxEl.appendChild(f); setTimeout(() => f.remove(), 1000);
}
function sparks(sp, n = 10, color) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.left = sp.x + 'px'; s.style.top = sp.y + 'px'; if (color) s.style.background = color; fxEl.appendChild(s);
    const a = rnd(Math.PI, Math.PI * 2), r = rnd(30, 80);
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: rnd(400, 750), easing: 'ease-out' }).onfinish = () => s.remove();
  }
}
// the big golden words across the screen (as in ניסי ניסים)
function banner(text, small, cls = '') {
  const b = document.createElement('div'); b.className = 'nin ' + cls; b.innerHTML = text + (small ? `<small>${small}</small>` : '');
  if (tut.on) b.style.top = '56%';
  fxEl.appendChild(b); setTimeout(() => b.remove(), 1900);
}
function ninBanner() { banner('נס בתוך נס!', '+₪18'); }

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, music: null };
const OWN = ['coin-1', 'coin-2', 'coin-3', 'coin-4', 'big-1', 'big-2', 'bad-1', 'bad-2', 'bad-3', 'heart', 'goal', 'nin', 'over', 'click', 'whoosh', 'tick'];
// Hani's own sounds live once on the site (/hani-games/sounds/); a local copy sits in ../hani-sounds/
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const HS = ['niggun-freilach'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then(x => { SND.buf[n] = x; if (n === 'niggun-freilach') startMusic(); }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
// a name plays one of its variants (coin → coin-1..4), never the same one twice in a row
function play(name, vol = 1, rate = 1) {
  if (!SND.ctx) return null;
  const vars = SFX.filter(n => n === name || n.startsWith(name + '-')).filter(n => SND.buf[n]);
  if (!vars.length) return null;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rate * rnd(.94, 1.06); g.gain.value = vol;
  src.connect(g).connect(SND.master); src.start();
  return { stop() { try { src.stop(); } catch (e) {} } };
}
function loopSnd(n, vol) {
  const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.loop = true; g.gain.value = vol;
  src.connect(g).connect(SND.master); src.start(); return { src, g };
}
function startMusic() { if (!SND.music && SND.buf['niggun-freilach']) SND.music = loopSnd('niggun-freilach', .28); }
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

// ───────────────────────── game state ─────────────────────────
let state = 'menu', paused = false, now = 0;
let round = 1, goalAg = 1800, roundAg = 0, totalAg = 0, timeLeft = 30, lives = 3, spawnT = 1, betweenT = 0, last10At = -9, caughtN = 0, nesN = 0, lastTick = 99, shakeT = 0, pairT = -1;
const items = [];
const roundTime = n => Math.min(54, 30 + 6 * (n - 1));
const CATCH_Y = BOX_H + .08;
function coinWeights(n) { return COINS.map((c, i) => c.w * (1 + .1 * i * (n - 1))); }
function pickCoin(n) {
  const ws = coinWeights(n), tot = ws.reduce((a, b) => a + b, 0);
  let r = rnd(tot); for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return COINS[i]; }
  return COINS[0];
}
function spawnItem(kind, def, x, y, o = {}) {
  const obj = kind === 'coin' ? makeCoin(def) : makeBad(def);
  const r = kind === 'coin' ? coinKit[def.id].r : BAD_H / 2;
  const it = { kind, def, obj, x, y, r, vx: o.vx ?? rnd(-.25, .25), vy: o.vy ?? -(2.4 + .42 * (round - 1)) * rnd(.9, 1.12), phase: o.phase || 'fall', t: 0,
    spin: rnd(2.2, 4.2) * (Math.random() < .5 ? -1 : 1), wob: rnd(6.28), ry: rnd(6.28), tut: o.tut };
  obj.position.set(x, y, 0);
  items.push(it); return it;
}
function removeItem(it) { scene.remove(it.obj); const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); if (it.lbl) it.lbl.remove(); }
function clearItems() { for (const it of items.slice()) removeItem(it); }
function freeX(y) {
  for (let tries = 0; tries < 8; tries++) {
    const x = rnd(-fieldHalf + .8, fieldHalf - .8);
    if (!items.some(it => it.phase === 'fall' && Math.abs(it.x - x) < 1.4 && Math.abs(it.y - y) < 2)) return x;
  }
  return rnd(-fieldHalf + .8, fieldHalf - .8);
}
function spawner(dt) {
  spawnT -= dt;
  if (pairT > 0) { pairT -= dt; if (pairT <= 0) { const p = items.filter(i => i.def.id === 's10').pop(); spawnItem('coin', COIN.s10, clamp((p ? p.x : 0) + rnd(-1.2, 1.2), -fieldHalf + .8, fieldHalf - .8), fieldTop + 1); } }
  if (spawnT > 0) return;
  spawnT = Math.max(.34, 1.05 * Math.pow(.86, round - 1)) * rnd(.75, 1.25);
  const y = fieldTop + 1, x = freeX(y);
  const badChance = Math.min(.36, .12 + .05 * (round - 1));
  if (round > 0 && Math.random() < badChance) spawnItem('bad', pick(BADS), x, y, { vy: -(2.1 + .35 * (round - 1)) * rnd(.9, 1.1) });
  else {
    const c = pickCoin(round);
    spawnItem('coin', c, x, y);
    // a generous neighbour sometimes drops two tens at once
    if (c.id === 's10' && Math.random() < .3) pairT = .55;
  }
}
function catchHalf(it) { return it.kind === 'coin' ? BOX_W / 2 + it.r * .35 : BOX_W / 2 + .45; }
function caught(it) {
  it.phase = 'caught'; it.t = 0;
  const sp = toScreen(V(boxX, BOX_H + .3, 0));
  if (it.kind === 'coin') {
    const c = it.def; caughtN++;
    if (state === 'play' || state === 'tut') { totalAg += c.ag; roundAg += c.ag; }
    const x0 = it.x, y0 = it.y;
    // into the slot, upright, with a little bounce of the box
    tween(.16, k => { it.obj.position.set(x0 + (boxX - x0) * k, y0 + (BOX_H + it.r * .6 - y0) * k, 0); it.obj.rotation.set(0, it.obj.rotation.y * (1 - k), 0); },
      () => tween(.18, k => { it.obj.position.set(boxX, BOX_H + it.r * .6 - k * it.r * 2.4, 0); }, () => removeItem(it)));
    tween(.22, k => { const s = Math.sin(k * Math.PI); pushkeBody.scale.set(1 + s * .06, 1 - s * .08, 1 + s * .06); });
    if (c.id === 's10') {
      play('big', .8); sparks(sp, 18, '#fff3b0'); setPose('joy', 1.2);
      if (now - last10At < 2) { last10At = -9; nes(); }
      else { last10At = now; if (state === 'play') say(pick(LINES.big), 2.4, 2); }
    } else {
      play('coin', .75); sparks(sp, 8);
      if (state === 'play' && sayGap <= 0 && Math.random() < .3) say(pick(LINES.coin), 2.4, 1);
    }
    floatText({ x: sp.x, y: sp.y - 20 }, '+' + (c.ag < 100 ? c.ag + ' אג׳' : fmt(c.ag).replace('.00', '')));
    $('total').classList.remove('bump'); void $('total').offsetWidth; $('total').classList.add('bump');
    if (state === 'tut' && it.tut && tutWait && tutWait.id === 'catch') tutWait.done = true;
  } else {
    // an aveira landed in the box: a heart goes, a shake, Hani is surprised
    const x0 = it.x, y0 = it.y;
    tween(.3, k => { it.obj.position.set(x0, y0 + k * .4, .5); it.obj.scale.setScalar(1 - k); }, () => removeItem(it));
    play('bad', .8); play('heart', .55);
    shakeT = .4; setPose('surprised', 1.2);
    haniEl.classList.remove('shake'); void haniEl.offsetWidth; haniEl.classList.add('shake');
    const fl = $('flash'); fl.style.opacity = .35; setTimeout(() => fl.style.opacity = 0, 160);
    floatText({ x: sp.x, y: sp.y - 20 }, it.def.label + '? אוי', true);
    if (state === 'play') {
      lives--; say(it.def.line, 2.6, 3);
      const hs = [...$('lives').children]; if (hs[lives]) { hs[lives].classList.add('hit'); }
      if (lives <= 0) gameOver('hearts');
    } else if (state === 'tut') { say('אופס! זוזו הצידה, ונסו שוב.', 2.4, 3); if (tutWait && tutWait.id === 'dodge') tutWait.retry = true; }
  }
  hud();
}
function nes() {
  totalAg += 1800; roundAg += 1800; nesN++;
  play('nin', .9); ninBanner(); setPose('joy', 1.8);
  say('נס בתוך נס!', 2.2, 4);
  for (let i = 0; i < 3; i++) setTimeout(() => sparks({ x: rnd(W * .2, W * .8), y: rnd(H * .3, H * .5) }, 14, '#ffe27a'), i * 150);
  if (state === 'tut' && tutWait && tutWait.id === 'nes') tutWait.done = true;
}
function updItems(dt) {
  for (const it of items.slice()) {
    it.t += dt;
    const o = it.obj;
    if (it.phase === 'fall') {
      const py = it.y;
      it.vy -= .7 * dt; it.y += it.vy * dt; it.x += it.vx * dt;
      if (Math.abs(it.x) > fieldHalf - .5) { it.x = Math.sign(it.x) * (fieldHalf - .5); it.vx *= -1; }
      if (it.kind === 'coin') { it.ry += it.spin * dt; o.rotation.set(Math.sin(it.t * 2.3 + it.wob) * .55, it.ry, Math.sin(it.t * 1.7 + it.wob) * .4); }
      else { o.rotation.set(0, 0, Math.sin(it.t * 3 + it.wob) * .18); const s = 1 + Math.sin(it.t * 5 + it.wob) * .04; o.scale.set(s, 1 / s, 1); }
      o.position.set(it.x, it.y, 0);
      const live = state === 'play' || state === 'tut';
      if (live && py > CATCH_Y && it.y <= CATCH_Y && Math.abs(it.x - boxX) < catchHalf(it)) { caught(it); continue; }
      if (it.y <= (it.kind === 'coin' ? it.r * .2 : .2)) { // missed: lands on the pavement
        it.phase = 'land'; it.t = 0; it.y0 = it.y;
        if (it.tut && tutWait) { if (tutWait.id === 'dodge' && it.kind === 'bad') tutWait.done = true; else tutWait.respawn = .6; }
      }
    } else if (it.phase === 'land') {
      if (it.kind === 'coin') {
        // a little bounce, settles flat on the pavement and fades into the street
        const k = Math.min(1, it.t / .5);
        o.position.set(it.x, it.r * .2 + Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * .5, .6 * k);
        o.rotation.x += (-Math.PI / 2 - o.rotation.x) * Math.min(1, dt * 10);
        if (it.t > .7) o.scale.setScalar(Math.max(0, 1 - (it.t - .7) / .35));
        if (it.t > 1.05) removeItem(it);
      } else {
        o.scale.setScalar(Math.max(0, 1 - it.t / .3)); o.position.y = .2 + it.t;
        if (it.t > .3) removeItem(it);
      }
    } else if (it.phase === 'show') { // the tutorial line-up
      if (it.kind === 'coin') { it.ry += dt * 1.6; o.rotation.set(Math.sin(it.t * 1.3 + it.wob) * .25, it.ry, 0); }
      else o.rotation.z = Math.sin(it.t * 2 + it.wob) * .12;
      o.position.set(it.x, it.y, 0);
      if (it.lbl) { const s = toScreen(V(it.x, it.y - it.r - .15, 0)); it.lbl.style.left = s.x + 'px'; it.lbl.style.top = s.y + 'px'; }
    } else if (it.phase === 'fade') {
      o.scale.setScalar(Math.max(0, 1 - it.t / .35)); if (it.t > .35) removeItem(it);
    }
  }
}

// ───────────────────────── input: drag anywhere, the box follows the finger's movement ─────────────────────────
const keys = new Set();
let drag = null;
const canMove = () => !paused && (state === 'play' || state === 'tut' || state === 'between');
addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('button,a,.screen,#tutCard')) return;
  if (!canMove()) return;
  drag = { id: e.pointerId, x: e.clientX };
});
addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id || !canMove()) return;
  const dx = e.clientX - drag.x; drag.x = e.clientX;
  boxX = clamp(boxX + dx / ppu * 1.2, -fieldHalf + BOX_W / 2, fieldHalf - BOX_W / 2);
});
const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { keys.add(k); e.preventDefault(); } });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// ───────────────────────── HUD ─────────────────────────
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.1 1.8-1.9 3.3-3.1 5.4-3.1 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z" fill="#ff4f6d" stroke="#fff" stroke-width="1.8"/><path d="M7 8.2c-1 .3-1.6 1.2-1.6 2.2" stroke="#ffd0d8" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
const livesEl = $('lives');
// the HUD only touches the page when something really changed (phones and slow GPUs thank us)
const hudLast = {};
function setIf(k, v, fn) { if (hudLast[k] !== v) { hudLast[k] = v; fn(v); } }
function hud() {
  if (livesEl.children.length !== 3) livesEl.innerHTML = HEART + HEART + HEART;
  setIf('lives', lives, v => [...livesEl.children].forEach((s, i) => s.classList.toggle('gone', i >= v)));
  setIf('total', fmt(totalAg), v => $('total').textContent = v);
  setIf('round', 'סיבוב ' + round, v => $('round').textContent = v);
  setIf('fill', Math.min(100, roundAg / goalAg * 100).toFixed(1) + '%', v => $('goalFill').style.width = v);
  setIf('goal', `${fmt(Math.min(roundAg, goalAg))} / ₪${goalAg / 100}`, v => $('goalTxt').textContent = v);
  const t = Math.max(0, Math.ceil(timeLeft));
  setIf('time', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, v => $('timeTxt').textContent = v);
  setIf('low', state === 'play' && t <= 5, v => $('timer').classList.toggle('low', v));
}
const best = () => +(store.get(KEY.best) || 0);
function showBest() { const b = best(); $('bestStart').innerHTML = b ? `השיא שלך: <b>₪${b.toFixed(2)}</b>` : ''; }

// ───────────────────────── screens / flow ─────────────────────────
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function playing(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); boxShow = on ? 1 : 0; }
function reset() { clearItems(); round = 1; goalAg = 1800; roundAg = 0; totalAg = 0; timeLeft = roundTime(1); lives = 3; last10At = -9; caughtN = 0; nesN = 0; pairT = -1; boxX = 0; hud(); }
function startGame() { reset(); state = 'play'; show(null); playing(true); window.track && track('game_start', 'shekel-tov'); startRound(1); }
function startRound(n) {
  round = n; goalAg = 1800 * n; roundAg = 0; timeLeft = roundTime(n); spawnT = .9; lastTick = 99; state = 'play';
  banner('סיבוב ' + n, 'יעד: ₪' + (18 * n), 'full'); play('whoosh', .7);
  say(n === 1 ? pick(LINES.start) : `סיבוב ${n}. בעזרת השם נמלא גם את זו.`, 2.4, 2);
  setMusicRate(Math.min(1.12, 1 + (n - 1) * .025));
  hud();
}
function roundFull() {
  state = 'between'; betweenT = 2.6;
  for (const it of items) if (it.phase === 'fall') { it.phase = 'fade'; it.t = 0; }
  const back = lives < 3; if (back) lives++;
  banner('הקופה מלאה!', back ? 'קיבלתם לב בחזרה' : '₪' + (18 * round) + ' לצדקה', 'full');
  play('goal', .8); setPose('joy', 2.2); say(pick(LINES.full), 2.4, 3);
  for (let i = 0; i < 4; i++) setTimeout(() => sparks(toScreen(V(boxX, BOX_H + .3, 0)), 12, '#ffe27a'), i * 180);
  hud();
}
function gameOver(why) {
  if (state === 'over') return;
  state = 'over'; drag = null; window.track && track('game_over', 'shekel-tov');
  play('over', .8); setMusicRate(1);
  const score = Math.round(totalAg) / 100, prev = best(), rec = score > prev;
  if (rec) store.set(KEY.best, score.toFixed(2));
  setPose('talk', 2);
  setTimeout(() => {
    clearItems(); playing(false);
    $('overH').textContent = why === 'time' ? 'הזמן נגמר' : 'הלבבות נגמרו';
    $('overScore').textContent = fmt(totalAg);
    $('overLine').textContent = '״' + pick(['כל שקל נחשב. תזכו למצוות!', 'צדקה תציל ממוות. עוד סיבוב?', 'ברוך השם, אספנו יפה.', 'שקל ועוד שקל – קופה מלאה.']) + '״';
    $('overRec').innerHTML = rec && score > 0 ? '<span class="newrec">שיא חדש!</span>' : '';
    $('bestOver').innerHTML = `הגעתם לסיבוב <b>${round}</b> · השיא שלך: <b>₪${Math.max(prev, score).toFixed(2)}</b>`;
    show('over');
  }, 1300);
}
function pause(on) {
  if (state !== 'play' && state !== 'tut' && state !== 'between') return;
  if (on === paused) return;
  paused = on; drag = null; keys.clear();
  if (on) { show('paused'); SND.ctx && SND.ctx.suspend(); }
  else { show(null); SND.ctx && SND.ctx.resume(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); hush(); } });
// leaving for the site: phones keep the page alive in the back cache, so the sound must stop by itself
function hush() { try { SND.ctx && SND.ctx.suspend(); } catch (e) {} }
addEventListener('pagehide', hush);
document.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', hush));
addEventListener('pageshow', e => { if (e.persisted && (state === 'play' || state === 'tut' || state === 'between')) pause(true); });
$('pauseBtn').onclick = () => { play('click'); pause(true); };
$('resumeBtn').onclick = () => { play('click'); pause(false); };
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); clearItems(); state = 'menu'; playing(false); tut.end(true); showBest(); show('start'); };
$('playBtn').onclick = () => { play('click'); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { play('click'); tut.begin(); };
$('againBtn').onclick = () => { play('click'); startGame(); };
addEventListener('keydown', e => {
  if (e.key === 'Escape' && (state === 'play' || state === 'between')) pause(!paused);
  if ((e.key === ' ' || e.key === 'Enter') && state === 'menu' && $('start').classList.contains('on')) { e.preventDefault(); $('playBtn').click(); }
  if ((e.key === ' ' || e.key === 'Enter') && state === 'over' && $('over').classList.contains('on')) { e.preventDefault(); startGame(); }
  if ((e.key === ' ' || e.key === 'Enter') && paused) { e.preventDefault(); pause(false); }
});

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const elRect = (...els) => () => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const el of els) { const r = el.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16 }; };
const rowSpot = () => { const sh = items.filter(i => i.phase === 'show'); if (!sh.length) return null; const a = toScreen(V(-fieldHalf + .2, sh[0].y + 1.3, 0)), b = toScreen(V(fieldHalf - .2, sh[0].y - 1.6, 0)); return { x: Math.max(4, a.x), y: a.y, w: Math.min(W - 8, b.x - a.x), h: b.y - a.y }; };
const boxSpot = () => { const a = toScreen(V(boxX - 1.4, BOX_H + .9, 0)), b = toScreen(V(boxX + 1.4, -.2, 0)); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; };
const STEPS = [
  { text: 'מוסדות <b>״שקל טוב״</b> אוספים צדקה! השכנים זורקים מטבעות מהמרפסות, ואתם תופסים אותם ב<b>קופה</b>.', spot: boxSpot },
  { text: '<b>גררו את האצבע ימינה</b> – בכל מקום על המסך. הקופה זזה יחד עם האצבע. <span class="keyhint">(במחשב: חיצים או A / D)</span>', try: 'right' },
  { text: 'יופי. ועכשיו <b>גררו שמאלה</b>.', try: 'left' },
  { text: 'אלה המטבעות, בדיוק כמו בארנק: <b>10 אגורות, חצי שקל, שקל, 2 ו־5 שקלים</b>. הנדיר מכולם: <b>10 שקלים</b>!', show: 'coins', spot: rowSpot },
  { text: 'מטבע נופל! <b>תפסו אותו בקופה.</b>', try: 'catch' },
  { text: 'אבל נופלות גם <b>עבירות</b>: לשון הרע, כעס וקנאה. <b>אותן לא תופסים!</b>', show: 'bads', spot: rowSpot },
  { text: 'כעס בדרך למטה! <b>זוזו הצידה</b> ותנו לו ליפול.', try: 'dodge' },
  { text: 'יש לכם <b>3 לבבות</b>. עבירה שנכנסת לקופה – לב אחד הולך. נגמרו הלבבות – נגמר המשחק.', spot: elRect($('lives')) },
  { text: 'לכל סיבוב יש <b>יעד</b> ו<b>שעון</b>: ₪18, אחר כך ₪36, ₪54… כפולות של חי. מלאו את הקופה לפני שהזמן נגמר – וכל קופה מלאה מחזירה לב.', spot: elRect($('round'), $('goal'), $('timer')) },
  { text: 'שני מטבעות של 10 שקלים בתוך שתי שניות? זה <b>נס בתוך נס!</b> – בונוס של ₪18. <b>תפסו את שניהם!</b>', try: 'nes' },
  { text: 'מוכנים? כל סיבוב מהיר יותר. <b>בהצלחה – שקל ועוד שקל, קופה מלאה!</b>', last: true },
];
function tutDropY() { const r = tutCard.getBoundingClientRect(); return Math.min(syToY(r.bottom + 30), fieldTop); }
function tutSpawn(id) {
  for (const it of items.slice()) if (it.tut) removeItem(it);
  const y = tutDropY(), side = boxX > 0 ? -1 : 1;
  if (id === 'catch') spawnItem('coin', COIN.h, clamp(boxX + side * 1.6, -fieldHalf + .8, fieldHalf - .8), y, { tut: true, vy: -1.6, vx: 0 });
  if (id === 'dodge') spawnItem('bad', BAD.kaas, boxX, y, { tut: true, vy: -1.3, vx: 0 });
  if (id === 'nes') {
    spawnItem('coin', COIN.s10, clamp(boxX, -fieldHalf + 1, fieldHalf - 1), y, { tut: true, vy: -1.7, vx: 0 });
    setTimeout(() => { if (tutWait && tutWait.id === 'nes' && !tutWait.done) spawnItem('coin', COIN.s10, clamp(boxX + rnd(-.5, .5), -fieldHalf + 1, fieldHalf - 1), tutDropY(), { tut: true, vy: -1.7, vx: 0 }); }, 700);
  }
}
const tut = {
  on: false, i: 0,
  step() { return STEPS[this.i] || {}; },
  begin() { reset(); state = 'tut'; this.on = true; this.i = 0; show(null); playing(true); tutCard.classList.add('on'); this.enter(); },
  enter() {
    const s = this.step();
    clearItems(); tutWait = null; last10At = -9;
    if (s.try === 'right' || s.try === 'left') tutWait = { id: s.try, done: false, x0: boxX };
    if (s.try === 'catch' || s.try === 'dodge' || s.try === 'nes') { tutWait = { id: s.try, done: false }; requestAnimationFrame(() => tutSpawn(s.try)); }
    if (s.show === 'coins') {
      const sp = Math.min(1.5, (fieldHalf * 2 - 1.7) / 5), y = (fieldTop + BOX_H) / 2 + .6;
      // Hebrew order: the smallest coin on the right
      COINS.forEach((c, i) => { const it = spawnItem('coin', c, (2.5 - i) * sp, y, { phase: 'show' }); it.ry = i % 2 ? 0 : Math.PI; addLbl(it, c.label); });
    }
    if (s.show === 'bads') {
      const sp = Math.min(2.6, (fieldHalf * 2 - 2.2) / 2), y = (fieldTop + BOX_H) / 2 + .6;
      BADS.forEach((b, i) => spawnItem('bad', b, (1 - i) * sp, y, { phase: 'show' }));
    }
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
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
  frame(dt) {
    if (!this.on) return;
    const s = this.step();
    const sp = s.spot ? s.spot() : null;
    $('tutDim').classList.toggle('on', !!sp);
    if (sp) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    const low = sp ? sp.y + sp.h / 2 > H * .45 : true;
    tutCard.style.top = low ? `calc(var(--safe-t) + 104px)` : 'auto';
    tutCard.style.bottom = low ? 'auto' : `calc(var(--safe-b) + ${STRIP + 12}px)`;
    if (tutWait && !tutWait.done) {
      if (tutWait.id === 'right' && boxX - tutWait.x0 > 1.5) tutWait.done = true;
      if (tutWait.id === 'left' && tutWait.x0 - boxX > 1.5) tutWait.done = true;
      if (tutWait.retry) { tutWait.retry = false; tutWait.respawn = .8; }
      if (tutWait.respawn > 0) { tutWait.respawn -= dt; if (tutWait.respawn <= 0) { tutWait.respawn = 0; if (!items.some(i => i.tut && i.phase === 'fall')) tutSpawn(tutWait.id); } }
    }
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; play('whoosh', .3); }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
function addLbl(it, txt) { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = txt; fxEl.appendChild(l); it.lbl = l; }
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => { play('click'); tut.end(); };
addEventListener('keydown', e => {
  if (!tut.on || paused) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── loop ─────────────────────────
function updHani(dt) {
  if (faceT > 0) { faceT -= dt; return; }
  if (sayT > 0) { if (haniPose !== 'talk') setPose('talk'); return; }
  idleT -= dt;
  if (idleT <= 0) { idleT = rnd(4, 8); setPose(Math.random() < .3 ? 'chin' : Math.random() < .3 ? 'tehilim' : 'calm'); }
  else if (!['calm', 'chin', 'tehilim'].includes(haniPose)) setPose('calm');
}
let last = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  if (paused) return;
  now += dt;
  // keys
  const kd = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  if (kd && canMove()) boxX = clamp(boxX + kd * 9 * dt, -fieldHalf + BOX_W / 2, fieldHalf - BOX_W / 2);
  boxX = clamp(boxX, -fieldHalf + BOX_W / 2, fieldHalf - BOX_W / 2);
  pushke.position.x += (boxX - pushke.position.x) * Math.min(1, dt * 30);
  pushke.visible = boxShow > 0;
  pushkeBody.rotation.z = (boxX - pushke.position.x) * -.25;
  if (state === 'play') {
    timeLeft -= dt;
    spawner(dt);
    const sec = Math.ceil(timeLeft);
    if (sec <= 5 && sec < lastTick && sec > 0) { lastTick = sec; play('tick', .6, sec % 2 ? 1 : 1.15); if (sec === 5 && roundAg < goalAg) say(pick(LINES.hurry), 2, 2); }
    if (roundAg >= goalAg) roundFull();
    else if (timeLeft <= 0) { timeLeft = 0; gameOver('time'); }
    hud();
  } else if (state === 'between') {
    betweenT -= dt; if (betweenT <= 0) startRound(round + 1);
  }
  updItems(dt);
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
  }
  if (shakeT > 0) shakeT -= dt;
  canvas.style.transform = shakeT > 0 ? `translateX(${(Math.sin(now * 55) * 7 * shakeT / .4).toFixed(1)}px)` : '';
  if (sayGap > 0) sayGap -= dt;
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) { sayEl.classList.remove('on'); sayPri = 0; } }
  updHani(dt);
  tut.frame(dt);
  renderer.render(scene, camera);
}

// ───────────────────────── go ─────────────────────────
(async () => {
  try { await Promise.race([Promise.all([document.fonts.load(F(900, 40)), document.fonts.load(F(700, 40))]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  buildStreet(); buildCoinKit();
  badGeo = new THREE.PlaneGeometry(BAD_W, BAD_W * 390 / 512);
  for (const b of BADS) badMat[b.id] = new THREE.MeshBasicMaterial({ map: badTex(b), transparent: true, alphaTest: .05, toneMapped: false, side: THREE.DoubleSide });
  buildBox();
  fitCamera(); hud(); showBest();
  $('loading').remove();
  requestAnimationFrame(frame);
})();
window.__game = {
  get state() { return state; }, get items() { return items; }, get boxX() { return boxX; }, get fieldHalf() { return fieldHalf; }, get ppu() { return ppu; },
  get lives() { return lives; }, get totalAg() { return totalAg; }, get round() { return round; }, get roundAg() { return roundAg; }, get goalAg() { return goalAg; }, get timeLeft() { return timeLeft; },
  get nesN() { return nesN; }, get caughtN() { return caughtN; }, CATCH_Y, toScreen, tut, startGame, SND, COINS, spawnItem, COIN,
};
