// Did every file reach the cloud? Each local file the copy takes (tools/cloud_copy.mjs, the same rules) is read and its
// md5 compared with the bucket's copy. Nothing is changed anywhere. Report: episodes/_cloud/verify.json + a summary.
// A file changed after the copy started shows as "changed since" (the next copy / the studio's sync takes it).
//   node tools/cloud_verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { EPS, ROOT, skip, DB_ONLY, footageDirs, footageName } from '../render/cloud/layout.mjs';
import { list, same } from '../render/cloud/store.mjs';

const walk = (dir, base = dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, base, out); else if (e.isFile()) out.push(path.relative(base, f).split(path.sep).join('/'));
  }
  return out;
};
const parts = [];
for (const id of fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.statSync(path.join(EPS, d)).isDirectory()).sort())
  parts.push({ dir: path.join(EPS, id), prefix: `projects/${id}/`, skip: true });
for (const d of footageDirs()) parts.push({ dir: d, prefix: footageName(d) + '/' });
parts.push({ dir: path.join(EPS, '_assets'), prefix: 'assets/_assets/', skip: true });
parts.push({ dir: path.join(ROOT, 'characters'), prefix: 'assets/characters/', never: DB_ONLY });  // (the pictures - the profiles are the database's)

const report = { at: new Date().toISOString(), ok: 0, okBytes: 0, missing: [], different: [], skipped: 0, skippedBytes: 0 };
for (const p of parts) {
  const remote = await list(p.prefix);
  for (const rel of walk(p.dir)) {
    const f = path.join(p.dir, rel), st = fs.statSync(f);
    if (p.never?.test(rel.replace(/\\/g, '/'))) continue;
    if (p.skip && skip(rel)) { report.skipped++; report.skippedBytes += st.size; continue; }
    const r = remote[p.prefix + rel];
    if (!r) { report.missing.push({ file: f, size: st.size }); continue; }
    if (!(await same(f, r))) { report.different.push({ file: f, size: st.size, cloud: r.size, changedAt: new Date(st.mtimeMs).toISOString() }); continue; }
    report.ok++; report.okBytes += st.size;
  }
  process.stdout.write(`\r${parts.indexOf(p) + 1}/${parts.length} checked  `);
}
fs.writeFileSync(path.join(EPS, '_cloud', 'verify.json'), JSON.stringify(report, null, 1));
const gb = (b) => (b / 1e9).toFixed(1) + ' GB';
console.log(`\n${report.ok} files identical in the cloud (${gb(report.okBytes)}); ${report.missing.length} missing (${gb(report.missing.reduce((s, x) => s + x.size, 0))}); ${report.different.length} different; ${report.skipped} scratch files left out on purpose (${gb(report.skippedBytes)}).`);
if (report.missing.length || report.different.length) console.log('details: episodes/_cloud/verify.json');
process.exit(report.missing.length || report.different.length ? 1 : 0);
