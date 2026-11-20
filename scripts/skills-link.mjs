// Links every Shlomiverse skill in the repo (zoomcut/skill/<name>) into this computer's ~/.claude/skills/<name>, so a skill edited in
// git is the one every session uses - on any computer (his ask 2026-11-20: "skills should be part of our git"). Safe to run again:
// an existing link is left as it is; a real folder with the same name is NOT touched (reported, so nothing local is lost).
//   node scripts/skills-link.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'zoomcut', 'skill');
const DST = path.join(os.homedir(), '.claude', 'skills');
fs.mkdirSync(DST, { recursive: true });
for (const name of fs.readdirSync(SRC)) {
  const from = path.join(SRC, name);
  if (!fs.existsSync(path.join(from, 'SKILL.md'))) continue;
  const to = path.join(DST, name);
  let st = null; try { st = fs.lstatSync(to); } catch (e) { /* not there */ }
  if (st && st.isSymbolicLink()) { console.log('linked already', name); continue; }
  if (st) { console.log('SKIPPED (a real folder is there - move it away first):', name); continue; }
  fs.symlinkSync(from, to, 'junction');   // a junction needs no admin rights on Windows
  console.log('linked', name);
}
