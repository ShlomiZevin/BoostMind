// The shared folders, the same on every computer (the studio online): what was made for videos and is used by many -
// the set pictures, sounds and props (episodes/_assets -> assets/_assets/) - and the characters' pictures
// (characters/ -> assets/characters/: their pictures - the profiles live in the Shlomiverse's database, layout.DB_ONLY).
// A project is edited by one computer at a time (sync.mjs, with a lock); these are a common pool that only grows:
//   - a file new or changed on one side goes to the other (a file still being written - changed in the last 15 s -
//     waits for the next round);
//   - nothing is ever deleted by the sync, here or in the cloud. A file deleted here after it was synced isn't brought
//     back here (and stays in the cloud for the other computers); one deleted in the cloud goes up again;
//   - changed on both sides since the last sync: both are kept, this computer's as "<name> (conflict <computer>)<ext>";
//   - a file git carries is never in the cloud too (two systems carrying one file overwrote each other - tzvika-1).
// When: at start, every 5 minutes, after a project goes up (the pictures it uses go with it) and before a project opens
// (its pictures are here before he sees it). State: episodes/_cloud/pool-state.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EPS, ROOT, skip, readJson, DB_ONLY } from './layout.mjs';
import { list, upload, download, remove, md5File } from './store.mjs';
import { walk, fp, sameAs, pool, HOST } from './sync.mjs';

export const POOLS = [
  { dir: path.join(EPS, '_assets'), prefix: 'assets/_assets/', git: 'episodes/_assets' },
  { dir: path.join(ROOT, 'characters'), prefix: 'assets/characters/', git: 'characters', never: DB_ONLY },
];
const STATE = path.join(EPS, '_cloud', 'pool-state.json');
const FRESH = 15e3;

// the files git carries in this folder (relative to it) - null when git can't say (then the folder is left alone:
// better no sync than the cloud carrying a profile git carries)
function gitFiles(P) {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', P.git], { encoding: 'utf8', maxBuffer: 64e6, windowsHide: true });
    return new Set(out.split('\0').filter(Boolean).map((f) => f.slice(P.git.length + 1)));
  } catch { return null; }
}
const conflictName = (f) => { const e = path.extname(f); return f.slice(0, f.length - e.length) + ` (conflict ${HOST})` + e; };

async function syncPool(P, state, n) {
  const tracked = gitFiles(P);
  if (!tracked) return;
  const st = (state[P.prefix] ||= {});
  const local = fs.existsSync(P.dir) ? walk(P.dir) : {}, remote = await list(P.prefix);
  const rels = new Set([...Object.keys(local), ...Object.keys(remote).map((k) => k.slice(P.prefix.length))]);
  const up = [], down = [];
  for (const rel of rels) {
    if (!rel || skip(rel)) continue;
    const l = local[rel], r = remote[P.prefix + rel], s = st[rel], f = path.join(P.dir, rel);
    if (tracked.has(rel) || P.never?.test(rel)) { if (r) { await remove(P.prefix + rel).catch(() => {}); n.cleaned++; } delete st[rel]; continue; }  // (git carries it)
    if (l && Date.now() - l.mtime < FRESH && !(s && s.mtime === l.mtime)) continue;  // (still being written here - not one that just came down)
    if (l && r) {
      if (await sameAs(f, l, r, s)) { st[rel] = { ...l, fp: fp(r) }; continue; }
      const here = !s || s.size !== l.size || s.mtime !== l.mtime, there = !s || s.fp !== fp(r);
      if (here && !there) up.push(rel);
      else if (!here && there) down.push(rel);
      else if (!s && l.mtime >= (+(r.meta.mtime || 0) || Date.parse(r.updated) || 0)) up.push(rel);  // (never synced here: the newer one wins - this one)
      else {  // (both changed: keep both - this computer's copy goes up under its new name)
        fs.renameSync(f, conflictName(f));
        up.push(path.relative(P.dir, conflictName(f)).split(path.sep).join('/'));
        down.push(rel); n.conflicts.push(rel);
      }
    } else if (l) up.push(rel);
    else if (!(s && s.fp === fp(r))) down.push(rel);  // (in the cloud and never here - or changed there since it was deleted here)
  }
  await pool(up, 3, async (rel) => {
    const f = path.join(P.dir, rel);
    try {
      const st0 = fs.statSync(f), md5 = await md5File(f), o = await upload(f, P.prefix + rel, md5);
      st[rel] = { size: st0.size, mtime: Math.round(st0.mtimeMs), fp: o.md5Hash || md5 };
      n.up++; n.upBytes += st0.size;
    } catch (e) { n.errors.push(`${rel}: ${e.message}`); }
  });
  await pool(down, 3, async (rel) => {
    const f = path.join(P.dir, rel), r = remote[P.prefix + rel];
    try {
      await download(P.prefix + rel, f, r);
      const st1 = fs.statSync(f);
      st[rel] = { size: st1.size, mtime: Math.round(st1.mtimeMs), fp: fp(r) };
      n.down++; n.downBytes += r.size;
    } catch (e) { n.errors.push(`${rel}: ${e.message}`); }
  });
}

// one round over every pool; rounds never overlap (a second call waits for the running one and shares it)
let running = null;
export function poolRound({ log = console.log } = {}) {
  if (running) return running;
  running = (async () => {
    const state = readJson(STATE, {});
    const n = { up: 0, down: 0, upBytes: 0, downBytes: 0, cleaned: 0, conflicts: [], errors: [] };
    try {
      for (const P of POOLS) await syncPool(P, state, n);
    } finally {
      fs.mkdirSync(path.dirname(STATE), { recursive: true });
      fs.writeFileSync(STATE, JSON.stringify(state));
    }
    const mb = (b) => (b / 1e6).toFixed(1);
    if (n.up || n.down || n.cleaned) log(`cloud: shared folders - ${n.up} up (${mb(n.upBytes)} MB), ${n.down} down (${mb(n.downBytes)} MB)${n.cleaned ? `, ${n.cleaned} git files taken out of the cloud` : ''}`);
    if (n.conflicts.length) log(`cloud: shared folders - changed on both computers, both kept: ${n.conflicts.slice(0, 5).join(', ')}`);
    if (n.errors.length) log(`cloud: shared folders - ${n.errors.length} failed (next round tries again): ${n.errors.slice(0, 3).join(' | ')}`);
    return n;
  })().finally(() => { running = null; });
  return running;
}

// the studio's side: a round at start, every 5 minutes, and soon() - a few seconds after a project went up
export function startPools({ log = console.log } = {}) {
  const round = () => poolRound({ log }).catch((e) => log('cloud: shared folders - ' + e.message));
  setTimeout(round, 20e3);
  const t = setInterval(round, 5 * 60e3); t.unref?.();
  let soonT = null;
  return { round, soon: () => { clearTimeout(soonT); soonT = setTimeout(round, 5000); } };
}

// node render/cloud/pool.mjs   - one round now (what the studio does by itself every 5 minutes)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.slice(1))) {
  const n = await poolRound();
  console.log(JSON.stringify({ up: n.up, down: n.down, cleaned: n.cleaned, conflicts: n.conflicts.length, errors: n.errors }));
}
