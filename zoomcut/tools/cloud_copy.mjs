// Copy the studio to the cloud (gs://shlomiverse-studio - layout in render/cloud/layout.mjs): every project, the
// footage folders they use, the shared assets, the characters, the asset library, Ideas and the jobs history. Nothing here is moved or
// changed - it is a copy; run it again and it sends only what changed. Gentle on purpose (one process, 4 threads:
// his PC blue-screens under full load). Progress: episodes/_cloud/copy.log. Then: node tools/cloud_verify.mjs
//   node tools/cloud_copy.mjs [only-this-project] [--skip=a,b]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BUCKET, EPS, ROOT, SKIP_RSYNC, DB_ONLY_RSYNC, footageDirs, footageName, gcloud } from '../render/cloud/layout.mjs';

const args = process.argv.slice(2);
// --skip a,b: projects this run leaves alone (one coming from another computer - its version must win)
const skipIds = new Set((args.find((x) => x.startsWith('--skip='))?.slice(7) || '').split(',').filter(Boolean));
const only = args.find((x) => !x.startsWith('--'));
const LOGDIR = path.join(EPS, '_cloud');
fs.mkdirSync(LOGDIR, { recursive: true });
const LOG = path.join(LOGDIR, 'copy.log');
const log = (s) => { const l = `${new Date().toISOString().slice(11, 19)} ${s}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };
const env = { ...process.env, CLOUDSDK_STORAGE_PROCESS_COUNT: '1', CLOUDSDK_STORAGE_THREAD_COUNT: '4', PYTHONIOENCODING: 'utf-8' };

const run = (args) => new Promise((ok) => {
  const [exe, argv] = gcloud(args);
  const p = spawn(exe, argv, { env, windowsHide: true });
  let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
  p.stdout.on('data', () => {});
  p.on('close', (code) => ok({ code, err }));
});
const rsync = async (src, dst, exclude) => {
  const t = Date.now();
  const r = await run(['storage', 'rsync', '-r', src, `gs://${BUCKET}/${dst}`, ...(exclude ? [`--exclude=${exclude}`] : [])]);
  log(`${r.code ? 'FAILED' : 'ok    '} ${dst}  (${Math.round((Date.now() - t) / 1000)} s)${r.code ? '  ' + r.err.trim().split('\n').slice(-3).join(' | ') : ''}`);
  return !r.code;
};
const cp = async (src, dst) => {
  if (!fs.existsSync(src)) return true;
  const r = await run(['storage', 'cp', src, `gs://${BUCKET}/${dst}`]);
  log(`${r.code ? 'FAILED' : 'ok    '} ${dst}`);
  return !r.code;
};

const jobs = [];
// (a folder without episode.json is no project - e.g. a trailer's workshop - it stays on this computer)
const projects = fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(EPS, d, 'episode.json'))).sort();
for (const id of projects) if ((!only || only === id) && !skipIds.has(id)) jobs.push(() => rsync(path.join(EPS, id), `projects/${id}`, SKIP_RSYNC));
if (!only) {
  for (const d of footageDirs()) jobs.push(() => rsync(d, footageName(d)));
  jobs.push(() => rsync(path.join(EPS, '_assets'), 'assets/_assets', SKIP_RSYNC));
  jobs.push(() => rsync(path.join(ROOT, 'characters'), 'assets/characters', DB_ONLY_RSYNC));  // (the pictures - the profiles are the database's)
  jobs.push(() => rsync(path.join(ROOT, 'models'), 'studio/models'));  // (Whisper, cut-out, gaze - not in git; a new computer's setup.ps1 pulls them)
  if (fs.existsSync(path.join(ROOT, 'library'))) jobs.push(() => rsync(path.join(ROOT, 'library'), 'library'));  // (the Assets page's library)
  jobs.push(() => cp(path.join(ROOT, 'ideas', 'ideas.json'), 'studio/ideas.json'));
  jobs.push(() => cp(path.join(EPS, '_jobs.json'), 'studio/jobs.json'));
}
log(`copy started: ${jobs.length} parts`);
let bad = 0;
for (const j of jobs) if (!(await j())) bad++;
log(bad ? `copy done with ${bad} failed part(s) - run it again` : 'copy done - every part sent');
process.exit(bad ? 1 : 0);
