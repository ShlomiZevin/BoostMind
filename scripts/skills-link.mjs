// Links every Shlomiverse skill in the repo into this computer's ~/.claude/skills/<name>, so a skill edited in git is the one every
// session uses - on any computer (his ask 2026-11-20: "skills should be part of our git").
//   zoomcut/skill/<name>  the tools (editing videos, content, stories, games...)
//   roles/<name>          the positions in the Shlomiverse - one folder per role: shlomiverse-conversion (Conversion Manager),
//                         shlomiverse-marketing (Marketing Manager), and more to come (his words: "we will probably have more roles")
// Safe to run again: an existing link is left as it is; a real folder with the same name is NOT touched (reported).
//   node scripts/skills-link.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DST = path.join(os.homedir(), '.claude', 'skills');
fs.mkdirSync(DST, { recursive: true });
for (const dir of [path.join(ROOT, 'zoomcut', 'skill'), path.join(ROOT, 'roles')]) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    const from = path.join(dir, name);
    if (!fs.existsSync(path.join(from, 'SKILL.md'))) continue;
    const to = path.join(DST, name);
    let st = null; try { st = fs.lstatSync(to); } catch (e) { /* not there */ }
    if (st && st.isSymbolicLink()) {
      let target = ''; try { target = fs.realpathSync(to); } catch (e) { /* broken link */ }
      if (target && path.resolve(target) === path.resolve(from)) { console.log('linked already', name); continue; }
      fs.rmSync(to, { recursive: false, force: true });   // a link to an old place (the skill moved): point it at the new one
    } else if (st) { console.log('SKIPPED (a real folder is there - move it away first):', name); continue; }
    fs.symlinkSync(from, to, 'junction');   // a junction needs no admin rights on Windows
    console.log('linked', name);
  }
}
