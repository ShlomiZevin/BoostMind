// Before git stops carrying the projects (2026-11-05): every file git has under episodes/ must be in the cloud too, so
// the other computer, whose git pull removes its copies, gets each one back from the cloud. Lists what is missing there
// (and with --send, sends it: a project's file to projects/<id>/, a shared one to assets/_assets/).
//   node tools/cloud_untrack_check.mjs [--send]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../render/cloud/layout.mjs';
import { list, upload } from '../render/cloud/store.mjs';

const send = process.argv.includes('--send');
const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', 'episodes'], { encoding: 'utf8', maxBuffer: 64e6 }).split('\0').filter(Boolean);
const cloudName = (f) => {  // episodes/<id>/<rel> -> its place in the bucket
  const rel = f.slice('episodes/'.length);
  return rel.startsWith('_assets/') ? 'assets/' + rel : 'projects/' + rel;
};
const remote = { ...(await list('projects/')), ...(await list('assets/_assets/')) };
const missing = tracked.filter((f) => !remote[cloudName(f)]);
const by = {};
for (const f of missing) { const k = f.split('/')[1]; by[k] = (by[k] || 0) + 1; }
console.log(`${tracked.length} files in git under episodes/, ${missing.length} not in the cloud`, by);
if (send) {
  let n = 0;
  for (const f of missing) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) { console.log('not on this computer either:', f); continue; }
    await upload(abs, cloudName(f)); n++;
  }
  console.log(`sent ${n}`);
}
