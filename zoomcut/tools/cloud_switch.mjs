// Switch THIS computer (his main PC, where every project was made) to the studio online - once, when he says so.
// His files here are the truth: what changed since the copy goes up, what the cloud has that this PC doesn't (a test,
// an old cache) is removed there (the bucket keeps deleted files 7 days), each project's sync state is recorded - and
// only then the sync is switched on (episodes/_cloud/config.json). Nothing on this computer is changed or deleted.
// Then restart the studio (when no job runs). Never while a job runs: it refuses.
//   node tools/cloud_switch.mjs            (--dry: say what it would do)
import fs from 'node:fs';
import path from 'node:path';
import { EPS, skip } from '../render/cloud/layout.mjs';
import { list, upload, remove, md5File } from '../render/cloud/store.mjs';
import { walk, stateFile, fp, sameAs, pool } from '../render/cloud/sync.mjs';

const dry = process.argv.includes('--dry');
const jobs = await fetch('http://127.0.0.1:4747/api/jobs').then((r) => r.json()).catch(() => null);
if (jobs && (jobs.running.length || jobs.busy.length)) { console.log('A job is running in the studio - try again when it is done.'); process.exit(1); }
let up = 0, upBytes = 0, gone = 0, same = 0;
for (const id of fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(EPS, d, 'episode.json'))).sort()) {
  const dir = path.join(EPS, id), prefix = `projects/${id}/`;
  const remote = await list(prefix), local = walk(dir), state = { files: {} };
  await pool(Object.entries(local), 3, async ([rel, l]) => {
    const f = path.join(dir, rel), r = remote[prefix + rel];
    if (r && await sameAs(f, l, r, null)) { state.files[rel] = { ...l, fp: fp(r) }; same++; return; }
    up++; upBytes += l.size;
    if (dry) return;
    const md5 = await md5File(f), o = await upload(f, prefix + rel, md5);
    state.files[rel] = { ...l, fp: o.md5Hash || md5 };
  });
  for (const name of Object.keys(remote)) {
    const rel = name.slice(prefix.length);
    if (local[rel] || skip(rel)) continue;
    gone++;
    if (!dry) await remove(name);
  }
  if (!dry) fs.writeFileSync(stateFile(id), JSON.stringify(state));
  process.stdout.write(`\r${id.padEnd(30)} `);
}
console.log(`\n${same} files already in the cloud, ${up} sent (${(upBytes / 1e6).toFixed(0)} MB), ${gone} removed from the cloud${dry ? ' - DRY RUN, nothing done' : ''}.`);
if (!dry) {
  fs.mkdirSync(path.join(EPS, '_cloud'), { recursive: true });
  fs.writeFileSync(path.join(EPS, '_cloud', 'config.json'), JSON.stringify({ sync: 'on', since: new Date().toISOString() }, null, 2));
  console.log('The sync is ON for this computer - restart the studio (when no job runs) and it takes effect.');
}
