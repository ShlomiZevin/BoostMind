// The studio's small shared files, the same on every computer (the studio online): the Ideas notebook
// (zoomcut/ideas/ideas.json -> studio/ideas.json) and the Jobs history (episodes/_jobs.json -> studio/jobs.json).
// Each side is MERGED, never replaced - two computers that both wrote meanwhile keep both: ideas by id (the newer
// edit wins, a deleted one stays deleted), jobs by their start. At start, every 2 minutes and when the file changes.
import fs from 'node:fs';
import path from 'node:path';
import { EPS, ROOT, readJson } from './layout.mjs';
import { getJson, putJson } from './store.mjs';

export const FILES = [
  { file: path.join(ROOT, 'ideas', 'ideas.json'), name: 'studio/ideas.json', empty: { ideas: [], deleted: [] },
    merge(a, b) {
      const deleted = new Map();
      for (const d of [...(a.deleted || []), ...(b.deleted || [])]) if (!deleted.has(d.id) || deleted.get(d.id).at < d.at) deleted.set(d.id, d);
      const by = new Map();
      for (const x of [...(a.ideas || []), ...(b.ideas || [])]) { const o = by.get(x.id); if (!o || (x.updated || 0) > (o.updated || 0)) by.set(x.id, x); }
      const ideas = [...by.values()].filter((x) => !(deleted.has(x.id) && deleted.get(x.id).at >= (x.updated || 0)));
      return { ideas: ideas.sort((x, y) => x.created - y.created), deleted: [...deleted.values()] };
    } },
  { file: path.join(EPS, '_jobs.json'), name: 'studio/jobs.json', empty: [],
    merge(a, b) {
      const by = new Map();
      for (const j of [...(a || []), ...(b || [])]) by.set(`${j.id}|${j.kind}|${j.started}|${j.channel || ''}`, j);
      return [...by.values()].sort((x, y) => (x.ended || x.started || 0) - (y.ended || y.started || 0)).slice(-300);
    } },
];

export function startShared({ log = console.log } = {}) {
  let busy = Promise.resolve();
  const syncOne = (F) => (busy = busy.then(async () => {
    for (let k = 0; k < 3; k++) {
      const local = readJson(F.file, F.empty), cloud = await getJson(F.name);
      const merged = F.merge(local, cloud?.v || F.empty);
      const s = JSON.stringify(merged);
      if (s !== JSON.stringify(local)) { fs.mkdirSync(path.dirname(F.file), { recursive: true }); fs.writeFileSync(F.file, JSON.stringify(merged, null, 2)); }
      if (cloud && s === JSON.stringify(cloud.v)) return;
      if (await putJson(F.name, merged, cloud ? cloud.gen : '0')) return;  // (another computer wrote meanwhile: merge again)
    }
  }).catch((e) => log(`cloud ${F.name}: ${e.message}`)));
  const all = () => FILES.forEach(syncOne);
  all();
  for (const F of FILES) fs.watchFile(F.file, { interval: 5000 }, () => syncOne(F));
  const t = setInterval(all, 120e3); t.unref?.();
}
