// ───────────────────────── the park grid ─────────────────────────
let owner = new Uint8Array(0), zone = new Uint8Array(0), block = new Uint8Array(0), zoneC = { c: 0, r: 0, R: 3.2 }, zoneCount = 0, blockCount = 0;
let props = [], lights = [];                      // props: { k, c, r } - c,r = the footprint's top-left
let trail = [], trailSet = new Set(), trailFrom = null;
const idx = (c, r) => r * COLS + c;
const inside = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
const arena = () => ARENAS[(Math.max(1, night) - 1) % ARENAS.length];
const START = () => ({ c: Math.floor(COLS / 2), r: ROWS - 7 });
const blocked = (c, r) => !inside(c, r) || block[idx(c, r)] === 1;
// clearFrom: rows from here down stay empty (the tutorial's stage)
function buildPark(seed, clearFrom) {
  owner = new Uint8Array(COLS * ROWS); zone = new Uint8Array(COLS * ROWS); block = new Uint8Array(COLS * ROWS); zoneCount = 0; blockCount = 0; props = [];
  const PR = rng(seed);
  // her house in a top corner, the restraining-order circle around it
  const left = PR() < 0.5, hc = left ? 1 : COLS - 3, hr = 1;
  props.push({ k: 'house', c: hc, r: hr });
  for (let y = hr; y < hr + 2; y++) for (let x = hc; x < hc + 2; x++) block[idx(x, y)] = 1;
  zoneC = { c: hc + 1, r: hr + 1.2, R: 3.3 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (Math.hypot(c + 0.5 - zoneC.c, r + 0.5 - zoneC.r) < zoneC.R) { zone[idx(c, r)] = 1; zoneCount++; }
  const s0 = START();
  const keepClear = (c, r) => (Math.abs(c - s0.c) <= 3 && Math.abs(r - s0.r) <= 3) || Math.hypot(c + 0.5 - zoneC.c, r + 0.5 - zoneC.r) < zoneC.R + 1.2 || (clearFrom !== undefined && r >= clearFrom);
  const scale = clamp(ROWS / 32, 0.7, 1.2);
  // every free cell keeps 2+ ways out and the free floor stays one piece - nobody can get stuck
  const roomy = () => {
    let first = -1, free = 0;
    for (let i = 0; i < block.length; i++) if (!block[i]) {
      free++; if (first < 0) first = i;
      const c = i % COLS, r = (i / COLS) | 0; let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!blocked(c + dx, r + dy)) n++;
      if (n < 2) return false;
    }
    const seen = new Uint8Array(block.length), q = [first]; seen[first] = 1; let cnt = 1;
    while (q.length) { const i = q.pop(), c = i % COLS, r = (i / COLS) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dx, nr = r + dy; if (!blocked(nc, nr)) { const j = idx(nc, nr); if (!seen[j]) { seen[j] = 1; cnt++; q.push(j); } } } }
    return cnt === free;
  };
  for (const [k, n0] of arena().props) {
    const P = PROP[k], n = Math.max(1, Math.round(n0 * scale));
    for (let m = 0; m < n; m++) for (let tries = 0; tries < 60; tries++) {
      const c = 1 + Math.floor(PR() * (COLS - P.w - 1)), r = 2 + Math.floor(PR() * (ROWS - P.h - 3));
      let okk = true;
      for (let y = r - 1; y <= r + P.h && okk; y++) for (let x = c - 1; x <= c + P.w; x++) {
        if (!inside(x, y)) continue;
        if (block[idx(x, y)]) { okk = false; break; }
        if (y >= r && y < r + P.h && x >= c && x < c + P.w && keepClear(x, y)) { okk = false; break; }
      }
      if (!okk) continue;
      for (let y = r; y < r + P.h; y++) for (let x = c; x < c + P.w; x++) block[idx(x, y)] = 1;
      if (!roomy()) { for (let y = r; y < r + P.h; y++) for (let x = c; x < c + P.w; x++) block[idx(x, y)] = 0; continue; }
      props.push({ k, c, r }); break;
    }
  }
  for (let i = 0; i < block.length; i++) blockCount += block[i];
  lights = props.filter((p) => PROP[p.k].light).map((p) => ({ x: p.c + 0.5, y: p.r - 0.6, ph: PR() * 6 }));
  trail = []; trailSet = new Set(); trailFrom = null; terrDirty = true;
}
function homeBlock() {
  const s = START();
  for (let r = s.r - 2; r <= s.r + 2; r++) for (let c = s.c - 2; c <= s.c + 2; c++) if (inside(c, r)) owner[idx(c, r)] = 1;
  terrDirty = true;
}
function ownedCount() { let n = 0; for (let i = 0; i < owner.length; i++) if (!block[i]) n += owner[i]; return n; }
const pctNow = () => Math.floor(ownedCount() / (COLS * ROWS - zoneCount - blockCount) * 100);
