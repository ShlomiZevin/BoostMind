// The asset library behind the studio's Assets page (ui/assets.tsx): every background, music, sound effect, picture
// and video made for any video - zoomcut/library/<kind>/ + library/index.json (made by tools/library_harvest.mjs).
// In the cloud too (gs://shlomiverse-studio/library/): a computer that doesn't have a file yet gets it the first time
// it's played or used. Adding one to a project = the project's own Media upload (POST /api/p/:id/assets).
//   GET  /api/lib                 every item (the page searches them itself)
//   GET  /lib/<kind>/<file>       the file
//   POST /api/lib/:id/add {ep}    a copy into that project's Media -> {id: the project's asset id}
//   POST /api/lib/:id {tags}      his own words on an item ("rabbi", "office", "tense") - found by the search
import fs from 'node:fs';
import path from 'node:path';
import { list, download, getJson, putJson } from './cloud/store.mjs';

export default function library(app, { ROOT, PORT, cloudOn }) {
  const LIB = path.join(ROOT, 'library'), INDEX = path.join(LIB, 'index.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')); } catch { return { items: [] }; } };
  const save = (ix) => { fs.mkdirSync(LIB, { recursive: true }); fs.writeFileSync(INDEX, JSON.stringify(ix, null, 1)); };
  // (another computer added items: its index comes down and the two are merged by id - at start, then every 10 min)
  const merge = async () => {
    if (!cloudOn()) return;
    try {
      const c = await getJson('library/index.json'), mine = read();
      const by = new Map((c?.v.items || []).map((x) => [x.id, x]));
      for (const x of mine.items) { const o = by.get(x.id); by.set(x.id, o ? { ...o, ...x, tags: [...new Set([...(o.tags || []), ...(x.tags || [])])] } : x); }
      const all = { items: [...by.values()], at: Date.now() };
      if (JSON.stringify(all.items) !== JSON.stringify(mine.items)) save(all);
      if (!c || JSON.stringify(all.items) !== JSON.stringify(c.v.items)) await putJson('library/index.json', all, c ? c.gen : '0');
    } catch (e) { console.log('library: ' + e.message); }
  };
  setTimeout(merge, 3000); setInterval(merge, 10 * 60e3).unref?.();
  const fileOf = async (rel) => {
    const f = path.resolve(LIB, rel);
    if (!f.startsWith(LIB + path.sep)) return null;
    if (fs.existsSync(f)) return f;
    if (!cloudOn()) return null;
    const name = 'library/' + rel.split(path.sep).join('/'), o = (await list(name))[name];
    if (!o) return null;
    await download(name, f, o);
    return f;
  };

  app.get('/api/lib', (_q, res) => res.json(read()));
  app.get('/lib/*', async (q, res) => {
    const f = await fileOf(decodeURIComponent(q.params[0] || '')).catch(() => null);
    if (!f) return res.status(404).end();
    res.sendFile(f, { headers: { 'Cache-Control': 'private, max-age=86400' } });
  });
  app.post('/api/lib/:id/add', async (q, res) => {
    const it = read().items.find((x) => x.id === q.params.id), ep = String(q.body?.ep || '');
    if (!it || !ep) return res.status(404).json({ error: 'no such item / project' });
    const f = await fileOf(it.file).catch(() => null);
    if (!f) return res.status(404).json({ error: 'the file is missing' });
    const r = await fetch(`http://127.0.0.1:${PORT}/api/p/${encodeURIComponent(ep)}/assets?name=${encodeURIComponent(path.basename(f))}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: fs.readFileSync(f) });
    res.status(r.status).json(await r.json());
  });
  app.post('/api/lib/:id', (q, res) => {
    const ix = read(), it = ix.items.find((x) => x.id === q.params.id);
    if (!it) return res.status(404).json({ error: 'no such item' });
    if (Array.isArray(q.body?.tags)) it.tags = q.body.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 30);
    save(ix); merge();
    res.json(it);
  });
}
