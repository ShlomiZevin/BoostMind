// Where the studio's things live in the cloud (gs://shlomiverse-studio, boostmind-b052c - the Shlomiverse's own
// project). One place for the rules, so the copy, the check and the studio's sync agree:
//   projects/<id>/<path>     a project's folder (project.json, media, work caches, exports)
//   footage/<path>           his raw takes, by their place under his home folder (Downloads/drop/...) - so any
//                            computer, whatever its Windows user name, finds them under its own home
//   assets/_assets/...       the shared assets (episodes/_assets), assets/characters/... the characters
//   studio/ideas.json, studio/jobs.json   the Ideas page, the jobs history
//   locks/<id>.json          who has a project open (one computer at a time)
// Not copied: scratch that is remade in seconds or never read again - the export's raw sound (*.f32, 13 GB) and the
// old engine's cut pieces (work/pieces, 13.7 GB, untouched since 2026-10-25).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cp_ from 'node:child_process';

export const BUCKET = 'shlomiverse-studio';
export const PROJECT = 'boostmind-b052c';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');  // zoomcut/
export const EPS = process.env.ZC_EPISODES || path.join(ROOT, 'episodes');  // (ZC_EPISODES: a test studio acting as another computer)
export const HOME = os.homedir();

// a project's file that stays on this computer only (a path inside the project, forward slashes)
export const SKIP = /(^|\/)work\/pieces\/|\.f32$|\.cloud-[^/]*$|\.tmp$/i;  // (.cloud-*: the sync's own state and half-downloaded files)
export const skip = (rel) => SKIP.test(rel.replace(/\\/g, '/'));
// the characters' profiles live in the Shlomiverse's database since 2026-11-06 (render/verse_db.mjs): a character.json /
// profile.md / index.json left in characters/ on a computer is an old copy - never carried to the cloud
export const DB_ONLY = /(^|\/)(character\.json|profile\.md|index\.json)$/i;
export const DB_ONLY_RSYNC = String.raw`(.*[/\\])?(character\.json|profile\.md|index\.json)$`;
// the same rule for gcloud storage rsync (its paths may use either slash)
export const SKIP_RSYNC = String.raw`.*work[/\\]pieces[/\\].*|.*\.f32$|.*\.tmp$|.*\.cloud-[^/\\]*$`;

// a place under some computer's home folder -> its cloud name (null: not under a home folder)
export function footageName(abs) {
  const m = String(abs).replace(/\\/g, '/').match(/^[a-z]:\/users\/[^/]+\/(.+)$/i);
  return m ? 'footage/' + m[1].replace(/\/+$/, '') : null;
}
// a path written on another computer (C:/Users/<someone>/...) -> the same place under THIS computer's home
export function localPath(abs) {
  if (!abs || fs.existsSync(abs)) return abs;  // (there as written: as it is)
  const m = String(abs).replace(/\\/g, '/').match(/^[a-z]:\/users\/[^/]+\/(.+)$/i);
  return m ? path.join(HOME, m[1]) : abs;
}

// the folders of raw takes the projects use: their footage folder + any file they point at outside themselves
export function footageDirs() {
  const dirs = new Set();
  for (const id of fs.readdirSync(EPS)) {
    if (id.startsWith('_')) continue;
    const d = path.join(EPS, id);
    const ep = readJson(path.join(d, 'episode.json'));
    if (!ep) continue;
    if (ep.input_dir) dirs.add(localPath(ep.input_dir));
    const pj = readJson(path.join(d, 'project.json'));
    for (const a of Object.values(pj?.assets || {})) {
      const s = String(a?.src || '');
      if (!s) continue;
      const abs = path.resolve(d, localPath(s));
      if (abs.startsWith(ROOT + path.sep)) continue;  // (inside the studio: a project, _assets, fonts)
      dirs.add(path.dirname(abs));
    }
  }
  // (a folder inside another one on the list is already in it)
  // (never a whole Downloads / Desktop: a folder in it, at least)
  const all = [...dirs].filter((x) => fs.existsSync(x) && footageName(x)?.split('/').length >= 3);
  return all.filter((x) => !all.some((y) => y !== x && x.startsWith(y + path.sep))).sort();
}

export function readJson(p, d = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }

// gcloud without cmd.exe in the middle (cmd reads | and & in an argument as its own): its python and gcloud.py,
// found once from `gcloud info` - so a regex or a Hebrew folder name reaches gcloud exactly as written
let gc = null;
export function gcloud(args) {
  if (!gc) {
    const { execFileSync } = cp_;
    const i = JSON.parse(execFileSync('cmd', ['/c', 'gcloud', 'info', '--format=json'], { windowsHide: true, encoding: 'utf8' }));
    gc = { py: i.basic.python_location, main: path.join(i.installation.sdk_root, 'lib', 'gcloud.py') };
  }
  return [gc.py, [gc.main, ...args]];
}


