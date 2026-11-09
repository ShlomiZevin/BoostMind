// Builds part of the lot bank by hill-climbing: a random 6x6 layout is mutated (a car moved / added / removed) and
// kept while its hardest state gets harder, until a state with a shortest solution inside the tier exists.
//   node tools/gen.js <tier 0-4> <count> <seed>      -> tools/out/tier<t>-<seed>.json
//   node tools/gen.js merge                         -> public/yotam-games/deadlock/lots.json { tiers: [[{p, opt}]] }
// p = [[row, col, len, horizontal(0/1)], ...], p[0] = Yotam's car (row 2, horizontal, len 2). A move = one car
// slid any distance (Rush Hour counting). Solved = Yotam's car at col 4 (touching the gate).
const fs = require('fs'), path = require('path');
const N = 6, EXIT_ROW = 2;
const TIERS = [[4, 7], [8, 12], [13, 17], [18, 22], [23, 60]];
const OUT = path.join(__dirname, 'out');

if (process.argv[2] === 'merge') {
  const tiers = TIERS.map(() => []), seen = new Set();
  for (const f of fs.readdirSync(OUT).filter((f) => /^tier\d.*\.json$/.test(f))) {
    // bucket by the real shortest solution, whatever tier the run aimed at
    for (const x of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))) { const k = JSON.stringify(x.p), t = TIERS.findIndex(([lo, hi]) => x.opt >= lo && x.opt <= hi); if (t >= 0 && !seen.has(k)) { seen.add(k); tiers[t].push(x); } }
  }
  fs.writeFileSync(path.join(__dirname, '../../../../public/yotam-games/deadlock/lots.json'), JSON.stringify({ tiers }));
  console.log(tiers.map((t) => t.length + ' (opt ' + Math.min(...t.map((x) => x.opt)) + '-' + Math.max(...t.map((x) => x.opt)) + ')').join(', '));
  process.exit(0);
}

const TIER = +process.argv[2], COUNT = +process.argv[3] || 40;
let seed = +process.argv[4] || 1; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const fits = (P, r, c, len, h, skip = -1) => {
  for (let i = 0; i < len; i++) { const rr = h ? r : r + i, cc = h ? c + i : c; if (rr >= N || cc >= N) return false;
    for (let k = 0; k < P.length; k++) { if (k === skip) continue; const [r2, c2, l2, h2] = P[k];
      for (let j = 0; j < l2; j++) if ((h2 ? r2 : r2 + j) === rr && (h2 ? c2 + j : c2) === cc) return false; } }
  return true;
};
function addCar(P) {
  const n3 = P.filter((x) => x[2] === 3).length, n2 = P.length - 1 - n3;
  const len = n3 < 3 && (n2 >= 9 || rnd() < 0.3) ? 3 : 2;
  if (len === 2 && n2 >= 9) return false;
  for (let t = 0; t < 40; t++) { const h = rnd() < 0.5 ? 1 : 0, r = ri(0, N - 1), c = ri(0, N - 1);
    if (h && r === EXIT_ROW) continue;
    if (fits(P, r, c, len, h)) { P.push([r, c, len, h]); return true; } }
  return false;
}
function layout() { const P = [[EXIT_ROW, ri(0, 2), 2, 1]]; const n = ri(7, 11); for (let k = 0; k < 60 && P.length < n; k++) addCar(P); return P; }
function mutate(P0) {
  const P = P0.map((x) => x.slice()), m = rnd();
  if (m < 0.2 && P.length < 13) addCar(P);
  else if (m < 0.35 && P.length > 6) P.splice(ri(1, P.length - 1), 1);
  else { const i = ri(1, P.length - 1), len = P[i][2];
    for (let t = 0; t < 40; t++) { const h = rnd() < 0.5 ? 1 : 0, r = ri(0, N - 1), c = ri(0, N - 1);
      if (h && r === EXIT_ROW) continue;
      if (fits(P, r, c, len, h, i)) { P[i] = [r, c, len, h]; break; } } }
  return P;
}

// state = positions (col for horizontal, row for vertical) as a digit string; returns distance-to-solved per state
function explore(P) {
  const fixed = P.map(([r, c, len, h]) => ({ len, h, line: h ? r : c }));
  const start = P.map(([r, c, , h]) => (h ? c : r)).join('');
  const next = (s) => {
    const g = new Int8Array(36).fill(-1);
    for (let i = 0; i < fixed.length; i++) { const f = fixed[i], p = +s[i]; for (let k = 0; k < f.len; k++) { const r = f.h ? f.line : p + k, c = f.h ? p + k : f.line; g[r * 6 + c] = i; } }
    const out = [];
    for (let i = 0; i < fixed.length; i++) { const f = fixed[i], p = +s[i], at = (q) => (f.h ? g[f.line * 6 + q] : g[q * 6 + f.line]);
      for (let q = p - 1; q >= 0 && at(q) < 0; q--) out.push(s.slice(0, i) + q + s.slice(i + 1));
      for (let q = p + f.len; q < N && at(q) < 0; q++) out.push(s.slice(0, i) + (q - f.len + 1) + s.slice(i + 1)); }
    return out;
  };
  const seen = new Set([start]), all = [start];
  for (let k = 0; k < all.length; k++) { for (const t of next(all[k])) if (!seen.has(t)) { seen.add(t); all.push(t); } if (all.length > 40000) return null; }
  const dist = new Map(), q = [];
  for (const s of all) if (s[0] === '4') { dist.set(s, 0); q.push(s); }
  if (!q.length) return null;
  let max = 0;
  for (let k = 0; k < q.length; k++) { const d = dist.get(q[k]); if (d > max) max = d; for (const t of next(q[k])) if (!dist.has(t)) { dist.set(t, d + 1); q.push(t); } }
  return { fixed, dist, max };
}

const [lo, hi] = TIERS[TIER], found = [], keys = new Set();
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `tier${TIER}-${seed}.json`);
let climbs = 0;
while (found.length < COUNT && climbs++ < 5000) {
  let P = layout(), e = explore(P);
  for (let k = 0; k < 400 && (!e || e.max < lo); k++) {
    const P2 = mutate(P), e2 = explore(P2);
    if (e2 && (!e || e2.max >= e.max)) { P = P2; e = e2; }
  }
  if (!e || e.max < lo) continue;
  const want = Math.min(hi, e.max), top = [];
  for (const [s, d] of e.dist) if (d === want) top.push(s);
  const s = top[Math.floor(rnd() * top.length)];
  const p = e.fixed.map((f, i) => (f.h ? [f.line, +s[i], f.len, 1] : [+s[i], f.line, f.len, 0]));
  const k = JSON.stringify(p); if (keys.has(k)) continue; keys.add(k);
  found.push({ p, opt: want });
  fs.writeFileSync(file, JSON.stringify(found));
  console.log(`tier ${TIER}: ${found.length}/${COUNT} (opt ${want}, ${P.length} cars)`);
}
