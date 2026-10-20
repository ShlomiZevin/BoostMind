// Runs one studio job detached from the editor server, so a page refresh or a server restart never stops it.
//   node tools/jobwrap.mjs <work/job.json> <program> [args...]
// Its output goes where the server pointed it (work/job.log); when the program ends, the exit code is written into
// job.json ({running: false, code, ended}) - the server reads both, and finishes the job's sends from there.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [stateFile, cmd, ...args] = process.argv.slice(2);
const p = spawn(cmd, args, { stdio: 'inherit', env: process.env, windowsHide: true });
const done = (code) => {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  Object.assign(s, { running: false, code: code ?? 1, ended: Date.now() });
  fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
  process.exit(0);
};
p.on('exit', done);
p.on('error', () => done(1));
