// אבני בניין – מזבח הקטורת: build the golden incense altar, row by row, with golden building bricks.
// "אַמָּה אָרְכּוֹ וְאַמָּה רָחְבּוֹ, רָבוּעַ יִהְיֶה, וְאַמָּתַיִם קֹמָתוֹ, מִמֶּנּוּ קַרְנֹתָיו" – a 6x6 ring, 12 rows, a crown and four horns.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const KEY = { best: 'hani-games:ketoret:best', tut: 'hani-games:ketoret:tut', snd: 'hani-games:ketoret:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const N = 6, ROWS = 12, LOOP = 20;          // 6x6 ring = 20 cells; 12 rows = twice as tall as wide
const PLATE_Y = .3;                          // top of the building plate

// ───────────────────────── renderer ─────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x24345f);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
const camera = new THREE.PerspectiveCamera(40, 1, .1, 200);
let W = innerWidth, H = innerHeight;
let camY = 3, camYT = 3;
function fit() {
  W = innerWidth; H = innerHeight; renderer.setSize(W, H, false);
  const aspect = W / H;
  const hfov = 34 * Math.PI / 180;
  camera.fov = clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI, 30, 72);
  camera.aspect = aspect; camera.updateProjectionMatrix();
}
addEventListener('resize', fit);
function placeCamera() {
  const aspect = W / H;
  const dist = aspect < 1 ? 15.5 : 17;
  const el = 52 * Math.PI / 180;
  camera.position.set(0, camY + dist * Math.sin(el), dist * Math.cos(el));
  camera.lookAt(0, camY - (aspect < 1 ? 2.6 : 1.2), aspect < 1 ? 1.2 : .4);
}
const _p = new THREE.Vector3();
function toScreen(v) { _p.copy(v).project(camera); return { x: (_p.x + 1) / 2 * W, y: (1 - _p.y) / 2 * H }; }

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a5a8a, 1.3));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
sun.position.set(-8, 22, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 18, bottom: -8, near: 1, far: 60 });
sun.shadow.bias = -.0006; scene.add(sun);
const warm = new THREE.PointLight(0xffc06a, 30, 30); warm.position.set(6, 10, 6); scene.add(warm);

// ───────────────────────── models ─────────────────────────
const MODEL_KEYS = ['brick1', 'brick2', 'brick3', 'brick4', 'horn', 'crown_side', 'base_plate', 'dining_table', 'chair', 'bookshelf',
  'kid_boy', 'kid_girl', 'kid_arm', 'kid_head_boy', 'kid_head_girl', 'tall_plant', 'side_table'];
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
function M3(k, x = 0, y = 0, z = 0, ry = 0, s = 1, parent = scene) {
  const o = models[k] ? models[k].clone(true) : new THREE.Group();
  o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); parent.add(o); return o;
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TABLE_S = 4.6, TABLE_TOP = .75 * TABLE_S;
function buildRoom() {
  const wood = canvasTex(512, 512, (g, w) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#a8703f', '#9e683a', '#b07744', '#9a6236'][i % 4]; g.fillRect(0, i * 64, w, 64); g.fillStyle = '#00000020'; g.fillRect(0, i * 64, w, 3); }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: wood, roughness: .85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -TABLE_TOP; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0xefe2cc, roughness: .95 }));
  wall.position.set(0, 10, -14); wall.receiveShadow = true; scene.add(wall);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), new THREE.MeshStandardMaterial({ color: 0x9fc8ff, emissive: 0x3a5a9a, emissiveIntensity: .6 }));
  win.position.set(-7, 8, -13.9); scene.add(win);
  const tw = new THREE.MeshStandardMaterial({ color: 0x9a5e33, roughness: .55 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(16, .5, 11), tw); top.position.y = -.25; top.castShadow = top.receiveShadow = true; scene.add(top);
  for (const [x, z] of [[-7.4, -4.9], [7.4, -4.9], [-7.4, 4.9], [7.4, 4.9]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.6, TABLE_TOP, .6), tw); l.position.set(x, -TABLE_TOP / 2 - .25, z); l.castShadow = true; scene.add(l); }
  M3('bookshelf', 8, -TABLE_TOP, -12.6, 0, 4.4);
  M3('tall_plant', -12, -TABLE_TOP, -10, 0, 4.4);
  // a lace tablecloth under the plate
  const cloth = new THREE.Mesh(new THREE.CircleGeometry(5.6, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }));
  cloth.rotation.x = -Math.PI / 2; cloth.position.y = .02; cloth.receiveShadow = true; scene.add(cloth);
  M3('base_plate', 0, 0, 0, 0, 1);
}
// Yanky helps: he stands at the table and brings bricks
let yanky;
function buildYanky() {
  const g = new THREE.Group();
  M3('kid_boy', 0, 0, 0, 0, 1, g);
  for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * .2, .9, 0); g.add(p); M3('kid_arm', 0, 0, 0, 0, 1, p); p.rotation.z = sx * .12; }
  const head = new THREE.Group(); head.position.y = .93; g.add(head); M3('kid_head_boy', 0, 0, 0, 0, 1, head);
  g.scale.setScalar(4.2); g.position.set(7.4, -TABLE_TOP, 2.5); g.rotation.y = -.7;
  g.userData.head = head; scene.add(g); yanky = g;
}

// ───────────────────────── the ring ─────────────────────────
// loop order: top row left→right, right column down, bottom row right→left, left column up
const RING = [];
for (let i = 0; i < N; i++) RING.push([i, 0]);
for (let j = 1; j < N; j++) RING.push([N - 1, j]);
for (let i = N - 2; i >= 0; i--) RING.push([i, N - 1]);
for (let j = N - 2; j >= 1; j--) RING.push([0, j]);
const loopOf = {}; RING.forEach(([i, j], k) => loopOf[i + ',' + j] = k);
const SIDES = [
  [...Array(N).keys()].map(i => [i, 0]), [...Array(N).keys()].map(j => [N - 1, j]),
  [...Array(N).keys()].map(i => [N - 1 - i, N - 1]), [...Array(N).keys()].map(j => [0, N - 1 - j]),
];
const cellX = i => i - (N - 1) / 2, cellZ = j => j - (N - 1) / 2;
const rowY = r => PLATE_Y + r;

// state
let state = 'menu', paused = false, now = 0;
let score = 0, row = 0, altarNo = 1, stability = 100, swaps = 3, perfectRow = true, bricksPlaced = 0, phase = 'build';
let occ = new Array(LOOP).fill(0);   // brick id per loop cell in the current row
let jointsBelow = new Set();          // loop edges (between k and k+1) that are joints in the row below
let nextId = 1;
const tray = [0, 0, 0];
const altarGroup = new THREE.Group(); scene.add(altarGroup);
const seamMarks = new THREE.Group(); scene.add(seamMarks);
const ringGlow = new THREE.Group(); scene.add(ringGlow);
let hornSpots = [];

const goldGhost = new THREE.MeshStandardMaterial({ color: 0x7dffb0, transparent: true, opacity: .55, emissive: 0x2bb673, emissiveIntensity: .5, depthWrite: false });
const redGhost = new THREE.MeshStandardMaterial({ color: 0xff6b6b, transparent: true, opacity: .45, emissive: 0xe5484d, emissiveIntensity: .5, depthWrite: false });
let ghost = null;
function setGhostModel(L, okay) {
  if (ghost && ghost.userData.L === L) { ghost.traverse(m => { if (m.isMesh) m.material = okay ? goldGhost : redGhost; }); return; }
  if (ghost) scene.remove(ghost);
  ghost = M3('brick' + L); ghost.userData.L = L;
  ghost.traverse(m => { if (m.isMesh) { m.material = okay ? goldGhost : redGhost; m.castShadow = false; } });
}
function hideGhost() { if (ghost) ghost.visible = false; }

// a placement: L cells along one side, all empty
function windows(L) {
  const out = [];
  for (let s = 0; s < 4; s++) for (let a = 0; a + L <= N; a++) {
    const cells = SIDES[s].slice(a, a + L);
    if (cells.every(([i, j]) => !occ[loopOf[i + ',' + j]])) out.push({ s, cells });
  }
  return out;
}
function fitsAnywhere(L) { return windows(L).length > 0; }
function bestWindow(L, px, pz) {
  let best = null, bd = 1e9;
  for (const w of windows(L)) {
    const cx = w.cells.reduce((a, c) => a + c[0], 0) / L, cz = w.cells.reduce((a, c) => a + c[1], 0) / L;
    const d = Math.hypot(px - cx, pz - cz);
    if (d < bd) { bd = d; best = w; }
  }
  return bd < 2.2 ? best : null;
}
function brickPose(w) {
  const L = w.cells.length;
  const cx = w.cells.reduce((a, c) => a + cellX(c[0]), 0) / L, cz = w.cells.reduce((a, c) => a + cellZ(c[1]), 0) / L;
  return { pos: V(cx, rowY(row), cz), ry: (w.s === 1 || w.s === 3) ? Math.PI / 2 : 0 };
}

function placeBrick(L, w, fromScreen) {
  const id = nextId++;
  const ks = w.cells.map(([i, j]) => loopOf[i + ',' + j]);
  ks.forEach(k => occ[k] = id);
  const pose = brickPose(w);
  const b = M3('brick' + L, pose.pos.x, pose.pos.y + 2.5, pose.pos.z, pose.ry, 1, altarGroup);
  tween(.22, k => { b.position.y = pose.pos.y + 2.5 * (1 - k * k); }, () => { b.position.y = pose.pos.y; dust(pose.pos); });
  play('snap', .8);
  bricksPlaced++;
  // joints made now: at each end, against a neighbour that is already filled by another brick
  let seams = 0;
  const sorted = ks.slice();
  const ends = [];
  // the two loop edges at the ends of this brick: find edges e where exactly one side is this brick
  for (let e = 0; e < LOOP; e++) {
    const a = occ[e], c = occ[(e + 1) % LOOP];
    if ((a === id) !== (c === id) && a && c) ends.push(e);
  }
  for (const e of ends) if (row > 0 && jointsBelow.has(e)) { seams++; seamHit(e); }
  const pts = 10 * L;
  addScore(pts, fromScreen);
  if (seams) {
    perfectRow = false;
    const loss = (8 + 4 * (altarNo - 1)) * seams;
    stability = Math.max(0, stability - loss);
    play('seam', .8);
    say(pick(['תפר מעל תפר... נחזק את השורה הבאה, בעזרת השם.', 'אוי, תפר ישר. לא נורא – לומדים.', 'יענקי, ראית? תפר על תפר זה חלש.']), 2.6, 3);
    setPose('surprised', 1.4);
    if (stability <= 0) { collapse(); return; }
  } else if (Math.random() < .25) say(pick(['יפה מאוד.', 'בדיוק במקום.', 'ברוך השם, יושב טוב.', 'כל אבן במקומה.']), 1.6, 1);
  hud();
  if (occ.every(Boolean)) rowDone();
  else checkStuck();
}
function seamHit(e) {
  const [i1, j1] = RING[e], [i2, j2] = RING[(e + 1) % LOOP];
  const p = V((cellX(i1) + cellX(i2)) / 2, rowY(row) + .5, (cellZ(j1) + cellZ(j2)) / 2);
  for (let i = 0; i < 12; i++) emit(p, { color: 0xff5a5a, vel: V(rnd(-1.5, 1.5), rnd(1, 3), rnd(-1.5, 1.5)), life: .7, size: .09, grav: -6, add: true });
  const s = toScreen(p); floatText(s, 'תפר ישר', true);
  shakeT = .4;
}
function jointsOf() {
  const js = new Set();
  for (let e = 0; e < LOOP; e++) if (occ[e] !== occ[(e + 1) % LOOP]) js.add(e);
  return js;
}
function rowDone() {
  const perfect = row > 0 && perfectRow;
  jointsBelow = jointsOf();
  const pts = 100 + 20 * row * altarNo + (perfect ? 150 : 0);
  addScore(pts, toScreen(V(0, rowY(row) + 1.5, 0)));
  stability = Math.min(100, stability + 3);
  if (perfect) { stability = Math.min(100, stability + 15); play('perfect', .8); toast('חיבור מושלם!'); setPose('joy', 1.6); say(pick(['חיבור מושלם! ברוך השם.', 'כמו שצריך. אף תפר ישר.', 'נס בתוך נס – שורה מושלמת!']), 2.4, 4); }
  else { play('row', .8); setPose('talk', 1.2); say(pick(ROW_LINES), 2.4, 2); }
  row++; perfectRow = true;
  occ = new Array(LOOP).fill(0);
  if (row >= ROWS) { startCrown(); return; }
  camYT = rowY(row);
  drawSeams(); drawRingGlow(); hud(); checkStuck();
}
const ROW_LINES = ['עוד שורה, ברוך השם.', 'עולים יפה. אמה על אמה.', 'יענקי, תחזיק לי את הקופסה בבקשה.', 'עוד קצת, ומגיעים לזר הזהב.', 'ככה בונים – לאט ובטוח.', 'השורה הזאת לזכות שטערני, לבת המצווה.'];
function drawSeams() {
  seamMarks.clear();
  if (row === 0) return;
  const m = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
  for (const e of jointsBelow) {
    const [i1, j1] = RING[e], [i2, j2] = RING[(e + 1) % LOOP];
    const x = (cellX(i1) + cellX(i2)) / 2, z = (cellZ(j1) + cellZ(j2)) / 2;
    const horiz = j1 === j2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(horiz ? .1 : 1.02, .06, horiz ? 1.02 : .1), m);
    bar.position.set(x, rowY(row) + .22, z); seamMarks.add(bar);
  }
}
function drawRingGlow() {
  ringGlow.clear();
  const m = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: .18, depthWrite: false });
  for (const [i, j] of RING) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(.94, .02, .94), m);
    t.position.set(cellX(i), rowY(row) + .2, cellZ(j)); ringGlow.add(t);
  }
}
function checkStuck() {
  if (state !== 'play' || phase !== 'build') return;
  const any = tray.some(L => L && fitsAnywhere(L));
  $('swap').classList.toggle('hint', !any && swaps > 0);
  if (!any) {
    if (swaps > 0) say('אין אבן שמתאימה. יענקי, תביא בבקשה אבנים אחרות!', 3, 3);
    else setTimeout(() => { if (state === 'play' && !tray.some(L => L && fitsAnywhere(L))) gameOver('נגמרו האבנים המתאימות', 'לא נורא. בפעם הבאה נשאיר מקום לאבנים קטנות, בעזרת השם.'); }, 900);
  }
}

// the tray: three bricks; fresh ones lean toward the gaps that are left
function gaps() {
  const out = [];
  for (let L = 1; L <= 4; L++) if (fitsAnywhere(L)) out.push(L);
  return out;
}
function newBrick() {
  const g = gaps();
  if (g.length && Math.random() < Math.max(.2, .55 - .1 * (altarNo - 1))) return pick(g);
  const r = Math.random();
  return r < .14 ? 1 : r < .48 ? 2 : r < .78 ? 3 : 4;
}
function fillTray(all) { for (let i = 0; i < 3; i++) if (all || !tray[i]) tray[i] = newBrick(); drawTray(); }
function drawTray() {
  document.querySelectorAll('.slot').forEach((el, i) => {
    const L = tray[i];
    const u = Math.min(28, (el.clientWidth - 8) / 4 || 26);
    el.classList.toggle('empty', !L);
    el.innerHTML = L ? `<div class="brk" style="width:${L * u}px;--u:${u}px"></div>` : '';
  });
  $('swap').querySelector('b').textContent = swaps;
  $('swap').disabled = swaps <= 0;
}
$('swap').addEventListener('click', () => {
  if (state !== 'play' || swaps <= 0 || phase !== 'build') return;
  if (tut.on && tut.step().try !== 'swap') return;
  swaps--; play('swap', .8);
  yankyHopT = .8;
  say(pick(['תודה יענקי! ובלי לדרוך עליהן.', 'יענקי הביא אבנים חדשות. ברוך השם.', 'כל הכבוד, יענקי\'לה.']), 2.2, 2);
  fillTray(true); checkStuck();
  if (tutWait && tutWait.id === 'swap') tutWait.done = true;
});

// ───────────────────────── drag from the tray ─────────────────────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
function aimCell(x, y) {
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.constant = -(rowY(row) + .5);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  return { px: hit.x + (N - 1) / 2, pz: hit.z + (N - 1) / 2 };
}
$('tray').addEventListener('pointerdown', e => {
  const slot = e.target.closest('.slot'); if (!slot || paused) return;
  if (state !== 'play' || phase !== 'build') return;
  if (tut.on && !tut.step().try) return;
  const i = +slot.dataset.i, L = tray[i]; if (!L) return;
  e.preventDefault();
  const el = document.createElement('div'); el.className = 'brk dragBrk';
  el.style.cssText += `;width:${L * 34}px;--u:34px;height:36px`;
  $('ui').appendChild(el);
  drag = { i, L, el, id: e.pointerId, w: null, x: e.clientX, y: e.clientY };
  play('pick', .6); moveDrag(e.clientX, e.clientY);
});
const LIFT = 70; // the brick floats above the finger so the finger never hides it
function moveDrag(x, y) {
  drag.x = x; drag.y = y;
  drag.el.style.left = x + 'px'; drag.el.style.top = (y - LIFT) + 'px';
  const a = aimCell(x, y - LIFT);
  drag.w = a ? bestWindow(drag.L, a.px, a.pz) : null;
  if (drag.w) {
    const p = brickPose(drag.w); setGhostModel(drag.L, true);
    ghost.visible = true; ghost.position.copy(p.pos); ghost.rotation.y = p.ry;
    drag.el.style.opacity = .25;
  } else { hideGhost(); drag.el.style.opacity = .9; }
}
addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) moveDrag(e.clientX, e.clientY); });
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null; d.el.remove(); hideGhost();
  if (d.w && state === 'play') { tray[d.i] = 0; placeBrick(d.L, d.w, { x: d.x, y: d.y - LIFT }); if (state === 'play' && phase === 'build') { fillTray(false); checkStuck(); } if (tutWait && tutWait.id === 'place') tutWait.done = true; }
  else if (Math.hypot(d.x - e.clientX, d.y - e.clientY) < 1) play('nofit', .4);
}
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
addEventListener('contextmenu', e => e.preventDefault());

// ───────────────────────── the crown and the horns ─────────────────────────
function startCrown() {
  phase = 'crown'; seamMarks.clear(); ringGlow.clear();
  camYT = rowY(ROWS) - 1;
  play('crown', .9); setPose('joy', 2.5);
  say('שתים עשרה שורות! עכשיו זר הזהב מסביב.', 2.6, 4);
  const y = rowY(ROWS);
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2;
    const c = M3('crown_side', 0, y + 6, 0, a, 1, altarGroup);
    const off = 3.12;
    const tx = [0, off, 0, -off][s], tz = [-off, 0, off, 0][s];
    c.position.set(tx, y + 6, tz); c.rotation.y = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][s];
    setTimeout(() => tween(.5, k => { c.position.y = y + 6 * (1 - ease(k)) - .55 * ease(k); }, () => { play('snap', .7); dust(V(tx, y - .4, tz)); }), 300 + s * 350);
  }
  // the altar's roof (גגו), a golden plate over the top
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.02, .25, 4.02), new THREE.MeshStandardMaterial({ color: 0xf0bf3a, metalness: .9, roughness: .3 }));
  roof.position.set(0, y + 6, 0); roof.castShadow = roof.receiveShadow = true; altarGroup.add(roof);
  tween(.6, k => { roof.position.y = y + 6 * (1 - ease(k)) - .3 * ease(k); }, () => dust(V(0, y, 0)));
  addScore(500, toScreen(V(0, y + 1, 0)));
  setTimeout(startHorns, 2200);
}
function startHorns() {
  phase = 'horns'; hornSpots = [];
  say('ועכשיו הקרנות – ממנו קרנותיו. לחצו על ארבע הפינות!', 3.2, 4);
  const y = rowY(ROWS);
  for (const [i, j] of [[0, 0], [N - 1, 0], [N - 1, N - 1], [0, N - 1]]) {
    const g = M3('horn', cellX(i), y, cellZ(j), 0, 1);
    g.traverse(m => { if (m.isMesh) { m.material = goldGhost; m.castShadow = false; } });
    hornSpots.push({ g, i, j, done: false });
  }
  hud();
}
function tapHorn(x, y) {
  let best = null, bd = 1e9;
  for (const h of hornSpots) if (!h.done) { const s = toScreen(h.g.position.clone().add(V(0, .7, 0))); const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = h; } }
  if (!best || bd > 90) return;
  best.done = true; scene.remove(best.g);
  const y0 = rowY(ROWS);
  const g = M3('horn', cellX(best.i), y0 + 4, cellZ(best.j), 0, 1, altarGroup);
  tween(.35, k => { g.position.y = y0 + 4 * (1 - k * k); }, () => { play('horn', .9); dust(g.position); });
  addScore(250, toScreen(g.position.clone().add(V(0, 1, 0))));
  if (hornSpots.every(h => h.done)) setTimeout(finale, 600);
}
addEventListener('pointerdown', e => { if (state === 'play' && phase === 'horns' && !paused && !e.target.closest('button, .slot')) tapHorn(e.clientX, e.clientY); });
function finale() {
  phase = 'done';
  play('finale', .9); setPose('joy', 3.5); yankyHopT = 2;
  say('ברוך השם! מזבח הקטורת מוכן. "וְהִקְטִיר עָלָיו קְטֹרֶת סַמִּים"', 3.6, 5);
  addScore(1000 * altarNo, toScreen(V(0, rowY(ROWS) + 2, 0)));
  smokeT = 5;
  toast(`מזבח ${altarNo} הושלם!`);
  setTimeout(() => { if (state === 'play') nextAltar(); }, 5200);
}
function nextAltar() {
  altarNo++; row = 0; phase = 'build'; occ = new Array(LOOP).fill(0); jointsBelow = new Set(); perfectRow = true;
  stability = Math.min(100, stability + 30);
  const old = altarGroup.children.slice();
  old.forEach((o, i) => { const v = V(rnd(-1, 1), rnd(2, 4), rnd(-1, 1)); tween(.8, k => { o.position.addScaledVector(v, .06); o.scale.setScalar(Math.max(.01, 1 - k)); }, () => altarGroup.remove(o)); });
  camYT = rowY(0);
  toast(`מזבח ${altarNo} – הפעם תפר ישר עולה יותר!`);
  say('בונים עוד אחד? הפעם בלי אף תפר ישר, בעזרת השם.', 2.8, 3);
  swaps = Math.min(3, swaps + 1);
  fillTray(true); drawSeams(); drawRingGlow(); hud();
}
function collapse() {
  phase = 'fall'; play('wobble', .8);
  say('המגדל מתנדנד...', 1.5, 6); setPose('surprised', 3);
  const parts = altarGroup.children.slice();
  tween(1.0, k => { altarGroup.rotation.z = Math.sin(k * 20) * .04 * k; }, () => {
    play('collapse', 1); altarGroup.rotation.z = 0;
    parts.forEach(o => { const v = V(rnd(-4, 4), rnd(2, 6), rnd(-4, 4)), spin = V(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)); let vy = v.y;
      tween(1.6, k => { o.position.x += v.x * .016; o.position.z += v.z * .016; vy -= 18 * .016; o.position.y = Math.max(o.position.y + vy * .016, 0); o.rotation.x += spin.x * .016; o.rotation.z += spin.z * .016; }); });
    setTimeout(() => gameOver('המגדל נפל', pick(['ברוך השם שזה רק אבני בניין. בונים שוב?', 'הכל לטובה. הפעם נחזק את התפרים.', 'לא נורא. גם בית המקדש ייבנה מחדש, בעזרת השם.'])), 1700);
  });
}

// ───────────────────────── effects ─────────────────────────
const tweens = [];
function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); }
const parts = [], pool = [], pGeo = new THREE.SphereGeometry(1, 8, 6);
function emit(pos, o) {
  if (parts.length > 300) return;
  const m = pool.pop() || new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  m.material.color.set(o.color); m.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.position.copy(pos); scene.add(m);
  parts.push({ m, v: o.vel.clone(), life: o.life, t: 0, size: o.size, grow: o.grow || 0, grav: o.grav ?? -4, op: o.op ?? 1 });
}
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; const k = p.t / p.life;
    if (k >= 1) { scene.remove(p.m); pool.push(p.m); parts.splice(i, 1); continue; }
    p.v.y += p.grav * dt; p.m.position.addScaledVector(p.v, dt);
    p.m.scale.setScalar(p.size * (1 + p.grow * k)); p.m.material.opacity = p.op * (1 - k);
  }
}
function dust(p) { for (let i = 0; i < 8; i++) emit(p.clone().add(V(0, .1, 0)), { color: 0xfff1b8, add: true, vel: V(rnd(-1.5, 1.5), rnd(.3, 1.2), rnd(-1.5, 1.5)), life: .5, size: rnd(.04, .08), grav: -2 }); }
let smokeT = 0, shakeT = 0, yankyHopT = 0;
function floatText(s, txt, bad) {
  const f = document.createElement('div'); f.className = 'float' + (bad ? ' bad' : ''); f.textContent = txt;
  f.style.left = s.x + 'px'; f.style.top = s.y + 'px'; $('ui').appendChild(f); setTimeout(() => f.remove(), 1100);
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('ui').appendChild(d); setTimeout(() => d.remove(), 2400); }
function addScore(n, s) { if (state !== 'play' || tut.on) return; score += n; if (s) floatText(s, '+' + n); hud(); }

// ───────────────────────── Hani ─────────────────────────
const haniEl = $('hani'), sayEl = $('say');
const POSE = n => `assets/pose-${n}.png`;
['calm', 'surprised', 'joy', 'phone', 'chin', 'tehilim', 'talk'].forEach(n => { const i = new Image(); i.src = POSE(n); });
let poseT = 0, sayT = 0, sayPri = 0, curPose = 'chin', idleT = 4;
function setPose(n, dur = 0) {
  if (curPose !== n) { curPose = n; haniEl.src = POSE(n); haniEl.classList.toggle('wide', n === 'joy'); haniEl.classList.add('pop'); setTimeout(() => haniEl.classList.remove('pop'), 150); }
  if (dur) poseT = dur;
}
function say(t, dur = 2.4, pri = 1) {
  if (sayT > 0 && pri < sayPri) return;
  sayEl.textContent = t; sayEl.classList.add('on'); sayT = dur; sayPri = pri;
  if (!poseT) setPose('talk');
}

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, music: null };
const OWN = ['snap-1', 'snap-2', 'snap-3', 'pick', 'seam', 'perfect', 'row-1', 'row-2', 'wobble', 'collapse', 'crown', 'finale', 'swap', 'click', 'nofit', 'horn'];
// Hani's own sounds live once on the site (/hani-games/sounds/); a local copy sits in ../hani-sounds/
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const HS = ['niggun-freilach', 'house-ambience'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then(x => { SND.buf[n] = x; if (HS.includes(n)) startMusic(); }).catch(() => {});
}
function unlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter(n => (n === name || n.startsWith(name + '-')) && SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars); if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length]; SND.last[name] = n;
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  s.buffer = SND.buf[n]; s.playbackRate.value = rnd(.95, 1.06); g.gain.value = vol; s.connect(g).connect(SND.master); s.start();
}
function loopSnd(n, vol) {
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  s.buffer = SND.buf[n]; s.loop = true; g.gain.value = vol; s.connect(g).connect(SND.master); s.start(); return s;
}
function startMusic() {
  if (!SND.music && SND.buf['niggun-freilach']) SND.music = loopSnd('niggun-freilach', .3);
  // the house goes on quietly around the table
  if (!SND.amb && SND.buf['house-ambience']) SND.amb = loopSnd('house-ambience', .12);
}
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
function drawSnd() { document.querySelectorAll('.sndBtn').forEach(b => b.innerHTML = SND.on ? ICON_ON : ICON_OFF); }
document.querySelectorAll('.sndBtn').forEach(b => b.addEventListener('click', () => { SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); unlock(); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; drawSnd(); }));
drawSnd();
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

// ───────────────────────── HUD / screens ─────────────────────────
function hud() {
  $('score').textContent = score;
  $('row').textContent = phase === 'build' ? `מזבח ${altarNo} · שורה ${Math.min(row + 1, ROWS)} / ${ROWS}` : phase === 'horns' ? 'הקרנות!' : `מזבח ${altarNo}`;
  $('stabFill').style.width = stability + '%';
  $('stab').classList.toggle('low', stability <= 30);
  drawTray();
}
const best = () => +(store.get(KEY.best) || 0);
function showBest() { const b = best(); $('bestStart').innerHTML = b ? `השיא שלך: <b>${b}</b>` : ''; }
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function playing(on) { $('hud').style.display = on ? 'flex' : 'none'; $('tray').style.display = on ? 'flex' : 'none'; }
function reset() {
  altarGroup.clear(); hornSpots.forEach(h => scene.remove(h.g)); hornSpots = [];
  score = 0; row = 0; altarNo = 1; stability = 100; swaps = 3; perfectRow = true; bricksPlaced = 0; phase = 'build';
  occ = new Array(LOOP).fill(0); jointsBelow = new Set(); camYT = rowY(0);
  fillTray(true); drawSeams(); drawRingGlow(); hud();
}
function startGame() {
  reset(); state = 'play'; show(null); playing(true); window.track && track('game_start', 'ketoret');
  say('אמה על אמה, ואמתיים קומתו. בונים בסייעתא דשמיא!', 3, 2);
  setTimeout(drawTray, 50);
}
function gameOver(h, line) {
  if (state !== 'play') return;
  state = 'over'; window.track && track('game_over', 'ketoret');
  const prev = best(), rec = score > prev;
  if (rec) store.set(KEY.best, score);
  setTimeout(() => {
    playing(false);
    $('overH').textContent = h; $('overLine').textContent = '"' + line + '"';
    $('overScore').textContent = score;
    $('overRec').innerHTML = rec && score > 0 ? '<span class="newrec">שיא חדש!</span>' : '';
    $('bestOver').innerHTML = `השיא שלך: <b>${Math.max(prev, score)}</b> · אבנים: <b>${bricksPlaced}</b>`;
    sayEl.classList.remove('on'); show('over');
  }, 900);
}
function pause(on) {
  if (state !== 'play' || on === paused) return;
  paused = on;
  if (on) { show('paused'); SND.ctx && SND.ctx.suspend(); if (drag) { drag.el.remove(); drag = null; hideGhost(); } }
  else { show(null); SND.ctx && SND.ctx.resume(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); hush(); } });
// leaving for the site: phones keep the page alive in the back cache, so the sound must stop by itself
function hush() { try { SND.ctx && SND.ctx.suspend(); } catch (e) {} }
addEventListener('pagehide', hush);
document.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', hush));
addEventListener('pageshow', e => { if (e.persisted) pause(true); });
$('pauseBtn').onclick = () => { play('click'); pause(true); };
$('resumeBtn').onclick = () => { play('click'); pause(false); };
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); tut.end(true); state = 'menu'; playing(false); reset(); showBest(); show('start'); };
$('playBtn').onclick = () => { play('click'); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { play('click'); tut.begin(); };
$('againBtn').onclick = () => { play('click'); startGame(); };
addEventListener('keydown', e => {
  if (e.key === 'Escape' && state === 'play' && !tut.on) pause(!paused);
  if ((e.key === ' ' || e.key === 'Enter') && state !== 'play' && !tut.on) { const b = $('start').classList.contains('on') ? $('playBtn') : $('over').classList.contains('on') ? $('againBtn') : null; if (b) { e.preventDefault(); b.click(); } }
});

// ───────────────────────── tutorial ─────────────────────────
let tutWait = null;
const tutCard = $('tutCard'), tutHole = $('tutHole');
const rectSpot = el => () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + 8 }; };
const worldSpot = (fn, r) => () => { const s = toScreen(fn()); return { x: s.x, y: s.y, r }; };
function setRow(filled, below) {      // a prepared row for the lessons
  occ = new Array(LOOP).fill(0);
  for (const [a, b] of filled) { const id = nextId++; for (let k = a; k <= b; k++) occ[k % LOOP] = id; }
  for (let k = 0; k < LOOP; k++) if (occ[k]) {
    // draw the prepared bricks as single cells (only for show)
    const [i, j] = RING[k]; M3('brick1', cellX(i), rowY(row), cellZ(j), 0, 1, altarGroup);
  }
  if (below) jointsBelow = below;
}
const STEPS = [
  { text: 'חני בונה עם הילדים את <b>מזבח הקטורת</b> מאבני בניין: אמה על אמה, ואמתיים קומתו.', spot: rectSpot($('hani')) },
  { text: '<b>המטרה:</b> לבנות 12 שורות, לשים זר זהב וארבע קרנות – ולהמשיך למזבח הבא. כל אבן = נקודות.', spot: rectSpot($('scoreBox')) },
  { text: '<b>גררו אבן מהמגש</b> אל הטבעת הזוהרת של השורה. האבן הירוקה מראה איפה היא תיכנס – ושחררו.', try: 'place', spot: rectSpot($('tray')), enter() { reset(); } },
  { text: 'במגש יש תמיד <b>3 אבנים</b>. אבן ארוכה לא מתכופפת בפינה – היא נכנסת רק לאורך צד אחד.', spot: rectSpot($('tray')) },
  { text: 'הקווים <b>האדומים</b> הם התפרים של השורה שמתחת. <b>אל תשימו תפר מעל תפר</b> – כסו את הקו האדום באמצע אבן.', spot: worldSpot(() => V(0, rowY(1), 0), 120), enter() { tutRowTwo(); } },
  { text: 'נסו עכשיו: גררו אבן כך שהקו האדום יהיה <b>באמצע</b> האבן.', try: 'place', spot: rectSpot($('tray')) },
  { text: 'כל תפר ישר מוריד את <b>מד היציבות</b>. נגמר – המגדל נופל. שורה בלי אף תפר ישר = <b>חיבור מושלם</b>, והיציבות עולה.', spot: rectSpot($('stabWrap')) },
  { text: 'אין אבן שמתאימה? <b>יענקי מביא</b> אבנים חדשות – 3 פעמים בסיבוב. נסו!', try: 'swap', spot: rectSpot($('swap')) },
  { text: 'בסוף 12 השורות – זר הזהב, ואז <b>לוחצים על ארבע הפינות</b> כדי לשים את הקרנות.' },
  { text: 'מוכנים? <b>בונים בסייעתא דשמיא!</b>', last: true },
];
function tutRowTwo() {
  reset(); state = 'play'; tut.on = true;
  // row 1 ready (bricks of 3 and 2), row 2 open with its seams shown
  const id = () => nextId++;
  const lens = [3, 2, 3, 2, 3, 2, 3, 2];
  let k = 0; const below = new Set();
  for (const L of lens) { const b = id(); for (let t = 0; t < L; t++) occ[(k + t) % LOOP] = b; k += L; }
  for (let e = 0; e < LOOP; e++) { const [i, j] = RING[e]; M3('brick1', cellX(i), rowY(0), cellZ(j), 0, 1, altarGroup); }
  jointsBelow = jointsOf();
  row = 1; occ = new Array(LOOP).fill(0); camYT = rowY(1);
  tray[0] = 3; tray[1] = 2; tray[2] = 4;
  drawSeams(); drawRingGlow(); hud();
}
const tut = {
  on: false, i: 0,
  step() { return STEPS[this.i] || {}; },
  begin() { reset(); state = 'play'; this.on = true; this.i = 0; show(null); playing(true); tutCard.classList.add('on'); $('tutDim').classList.add('on'); this.enter(); },
  enter() {
    const s = this.step(); tutWait = null;
    s.enter && s.enter();
    if (s.try) tutWait = { id: s.try, done: false };
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').textContent = s.last ? 'בונים!' : 'הבא';
  },
  next() { if (tutWait && !tutWait.done) return; play('click'); if (this.step().last) { this.end(); return; } this.i++; this.enter(); },
  end(silent) {
    if (!this.on) return;
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1');
    if (!silent) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = this.step(), sp = s.spot ? s.spot() : null;
    if (sp) Object.assign(tutHole.style, { left: sp.x - sp.r + 'px', top: sp.y - sp.r + 'px', width: sp.r * 2 + 'px', height: sp.r * 2 + 'px' });
    else Object.assign(tutHole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
    const low = sp ? sp.y > H * .5 : true;
    tutCard.style.top = low ? 'calc(var(--safe-t) + 70px)' : 'auto';
    tutCard.style.bottom = low ? 'auto' : 'calc(var(--safe-b) + 100px)';
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
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

// ───────────────────────── loop ─────────────────────────
let last = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  if (paused) return;
  now += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); } }
  updParts(dt);
  camY += (camYT - camY) * Math.min(1, dt * 3);
  placeCamera();
  if (shakeT > 0) { shakeT -= dt; camera.position.x += Math.sin(now * 60) * .08; }
  ringGlow.children.forEach(m => m.material.opacity = .14 + Math.sin(now * 4) * .08);
  seamMarks.visible = Math.sin(now * 6) > -.6;
  if (smokeT > 0) {
    smokeT -= dt;
    if (Math.random() < .7) emit(V(rnd(-.4, .4), rowY(ROWS) + .2, rnd(-.4, .4)), { color: 0xf4f0ff, vel: V(rnd(-.15, .15), rnd(1, 1.6), rnd(-.15, .15)), life: 3, size: .25, grow: 3, grav: .1, op: .45 });
  }
  if (yanky) {
    if (yankyHopT > 0) { yankyHopT -= dt; yanky.position.y = -TABLE_TOP + Math.abs(Math.sin(now * 10)) * .6; } else yanky.position.y = -TABLE_TOP;
    yanky.userData.head.rotation.y = Math.sin(now * .7) * .3;
  }
  if (poseT > 0) { poseT -= dt; if (poseT <= 0) setPose(sayT > 0 ? 'talk' : 'calm'); }
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) { sayEl.classList.remove('on'); sayPri = 0; if (!poseT) setPose('calm'); } }
  else if (!poseT && state !== 'over') { idleT -= dt; if (idleT <= 0) { idleT = rnd(4, 8); setPose(Math.random() < .4 ? 'chin' : 'calm'); } }
  tut.frame();
  renderer.render(scene, camera);
}

loadModels(f => { $('loading').textContent = 'רגע, טוען... ' + Math.round(f * 100) + '%'; }).then(() => {
  buildRoom(); buildYanky(); fit(); reset(); showBest();
  $('loading').remove(); requestAnimationFrame(frame);
});
function botMove() {   // test helper: the best move a careful player would make
  let best = null;
  tray.forEach((L, i) => { if (!L) return; for (const w of windows(L)) { const r = window.__game.seamRisk(w) * 10 - L; if (!best || r < best.r) best = { i, L, w, r }; } });
  if (!best) return false;
  tray[best.i] = 0; placeBrick(best.L, best.w); if (state === 'play' && phase === 'build') { fillTray(false); checkStuck(); }
  return true;
}
window.__game = { botMove, swap() { $('swap').click(); }, get state() { return state; }, get score() { return score; }, get row() { return row; }, get phase() { return phase; }, get tray() { return tray; }, get stability() { return stability; },
  windows, brickPose, toScreen, seamRisk(w) { const ks = w.cells.map(([i, j]) => loopOf[i + ',' + j]); const lo = ks[0], hi = ks[ks.length - 1]; const a = (Math.min(lo, hi) - 1 + LOOP) % LOOP, b = Math.max(lo, hi); const wrap = Math.abs(lo - hi) > 4; return wrap ? [jointsBelow.has(Math.min(lo, hi)), jointsBelow.has((Math.max(lo, hi) - 1 + LOOP) % LOOP)].filter(Boolean).length : [jointsBelow.has(a), jointsBelow.has(b)].filter(Boolean).length; }, tut, startGame, rowY, get hornSpots() { return hornSpots; } };
