// Keep this computer light (his rule, 2026-11-02: "whatever you uploaded to the cloud remove from this computer - only
// if you're sure", "each project more careful about spending space"). Two things, both safe by construction:
//  1. scratch - the export's raw sound renders (*.f32) and the old engine's cut pieces (work/pieces/): never in the
//     cloud, remade by themselves if ever needed (not in a project whose job is running);
//  2. a project he hasn't touched for `days`: its heavy files that the cloud holds IDENTICALLY (size + md5 / CRC32C) are
//     removed here. The project itself - every .json / .txt (project.json, episode.json, captions...) and the small
//     files - always stays, so it stays in his menu as it was; opening it brings the rest back (sync.mjs pull).
// Only with the studio online switched on (else nothing would bring the files back). The sync state forgets what was
// removed, so the sync never reads it as "deleted here" and never deletes it in the cloud.
import fs from 'node:fs';
import path from 'node:path';
import { EPS, readJson } from './layout.mjs';
import { list } from './store.mjs';
import { walk, stateFile, sameAs } from './sync.mjs';

const SCRATCH = /\.f32$|(^|\/)work\/pieces\/|(^|\/)work\/layers\/render\//i;  // (the export's sound renders: the tracks AND their job markers - a marker left alone said "done" with its tracks gone)
const allFiles = (dir, base = dir, out = []) => {
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) { const f = path.join(dir, e.name); if (e.isDirectory()) allFiles(f, base, out); else if (e.isFile()) out.push(path.relative(base, f).split(path.sep).join('/')); }
  return out;
};

export async function thin({ days = 7, dry = false, only = null, busy = () => false, log = console.log } = {}) {
  if (readJson(path.join(EPS, '_cloud', 'config.json'), {})?.sync !== 'on') { log('space: the studio online is not switched on here - nothing removed'); return { freed: 0 }; }
  let scratch = 0, heavy = 0, projects = 0;
  for (const id of fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(EPS, d, 'episode.json'))).sort()) {
    if ((only && id !== only) || busy(id)) continue;
    const dir = path.join(EPS, id);
    // 1. scratch
    for (const rel of allFiles(dir)) if (SCRATCH.test(rel)) { const f = path.join(dir, rel); scratch += fs.statSync(f).size; if (!dry) fs.rmSync(f, { force: true }); }
    // 2. not touched for `days` (his edits = project.json; a build / export writes work/job.json)
    const last = Math.max(...['project.json', 'episode.json', 'work/job.json'].map((r) => { try { return fs.statSync(path.join(dir, r)).mtimeMs; } catch { return 0; } }));
    if (Date.now() - last < days * 864e5) continue;
    const remote = await list(`projects/${id}/`), local = walk(dir);
    const state = readJson(stateFile(id), { files: {} });
    let freed = 0;
    for (const [rel, l] of Object.entries(local)) {
      if (/\.(json|txt|srt|md)$/i.test(rel) || l.size < 64 * 1024) continue;  // (the project itself and the small files stay)
      const r = remote[`projects/${id}/${rel}`];
      if (!r || !(await sameAs(path.join(dir, rel), l, r, state.files[rel]))) continue;  // (only what the cloud holds identically)
      freed += l.size;
      if (!dry) { fs.rmSync(path.join(dir, rel)); delete state.files[rel]; }
    }
    if (freed && !dry) fs.writeFileSync(stateFile(id), JSON.stringify(state));
    if (freed) { heavy += freed; projects++; }
  }
  const gb = (b) => (b / 1e9).toFixed(1);
  log(`space: ${gb(scratch)} GB of scratch and ${gb(heavy)} GB of ${projects} resting projects (safe in the cloud) ${dry ? 'WOULD BE ' : ''}removed from this computer`);
  return { freed: scratch + heavy, scratch, heavy, projects };
}
