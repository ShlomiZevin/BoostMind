// When each video of the project was recorded - Media lists Footage newest first (his ask, 2026-10-28: "I want last to
// be first"). The phone's own recording time from inside the file (ffprobe creation_time), else the file's date.
// Read only: nothing in the project changes. Cached in work/dates.json by file size + date, so it is instant after once.
// -> { dates: { <asset id>: ms } }
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const probe = (f) => new Promise((ok) => execFile('ffprobe', ['-v', 'error', '-show_entries', 'format_tags=creation_time,com.apple.quicktime.creationdate',
  '-of', 'json', f], { windowsHide: true, timeout: 15000 }, (e, out) => {
  try { const t = JSON.parse(out).format?.tags || {}; const v = t['com.apple.quicktime.creationdate'] || t.creation_time; ok(v ? Date.parse(v) : null); } catch { ok(null); }
}));

export default async function dates({ dir }) {
  let project;
  try { project = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')); } catch { return { error: 'no project.json' }; }
  const cf = path.join(dir, 'work', 'dates.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch {}
  const out = {};
  let changed = false;
  await Promise.all(Object.entries(project.assets || {}).filter(([, a]) => a.kind === 'video' && a.src).map(async ([id, a]) => {
    const f = path.resolve(dir, a.src);
    let st;
    try { st = fs.statSync(f); } catch { return; }
    const key = `${f}|${st.size}|${st.mtimeMs}`;
    if (cache[key] == null) { cache[key] = (await probe(f)) || st.mtimeMs; changed = true; }
    out[id] = cache[key];
  }));
  if (changed) { try { fs.mkdirSync(path.dirname(cf), { recursive: true }); fs.writeFileSync(cf, JSON.stringify(cache)); } catch {} }
  return { dates: out };
}
