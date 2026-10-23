// The characters of his channel - "the multiverse": one folder per character (zoomcut/characters/<id>/character.json,
// its images beside it - gitignored, his face), shown on the studio's Characters page (ui/characters.tsx).
//   GET  /api/characters            every character (index.json order) with its portrait, videos and pace
//   GET  /api/characters/:id        one, with its videos' titles and every asset as a URL
//   POST /api/characters/:id        {patch} - edit (or create) one; null removes a field
//   POST /api/characters/pace       {paces: {<name as in a script>: wpm}, script} - the Reader's paces, matched by name
//   GET  /charfile?p=<path>         an asset file (only under the studio, the website folder or Downloads)
// A video belongs to a character when its project.json lists the id in `characters` (the builders write it) or the
// character lists the video.
import fs from 'node:fs';
import path from 'node:path';

export default function characters(app, { ROOT, EPS }) {
  const DIR = path.join(ROOT, 'characters');
  const PUBLIC = path.resolve(ROOT, '..', 'public');
  const DOWNLOADS = path.join(process.env.USERPROFILE || 'C:/Users/shazbak', 'Downloads');
  const ALLOWED = [path.resolve(ROOT), PUBLIC, path.resolve(DOWNLOADS)].map((p) => p.toLowerCase());
  const read = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
  const write = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); };
  const ids = () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(DIR, d, 'character.json'))) : []);
  const order = () => { const o = read(path.join(DIR, 'index.json'), {})?.order || []; return [...o.filter((x) => ids().includes(x)), ...ids().filter((x) => !o.includes(x)).sort()]; };

  // a path in character.json: absolute, relative to the character's folder, or to the studio / repo
  const resolve = (id, p) => {
    if (!p) return '';
    if (/^https?:/.test(p)) return p;
    for (const base of [path.join(DIR, id), ROOT, path.resolve(ROOT, '..')]) { const f = path.resolve(base, p); if (fs.existsSync(f)) return f; }
    return path.isAbsolute(p) && fs.existsSync(p) ? p : '';
  };
  const fileUrl = (id, p) => { const f = resolve(id, p); if (!f) return ''; if (/^https?:/.test(f)) return f;
    let v = 0; try { v = Math.round(fs.statSync(f).mtimeMs); } catch {} return `/charfile?p=${encodeURIComponent(f)}&v=${v}`; };

  // which videos each character is in: the projects' `characters` + the character's own list
  const videosOf = () => {
    const map = {};
    for (const ep of fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(EPS, d, 'episode.json')))) {
      const pj = read(path.join(EPS, ep, 'project.json'), {}) || {};
      for (const c of pj.characters || []) (map[c] = map[c] || new Set()).add(ep);
    }
    return map;
  };
  const epInfo = (ep) => { const cfg = read(path.join(EPS, ep, 'episode.json'), {}) || {}; const out = path.join(EPS, ep, 'out');
    const mp4 = fs.existsSync(out) ? fs.readdirSync(out).find((f) => f.endsWith('.mp4') && !f.includes('draft') && !f.includes('email')) : null;
    return { id: ep, title: cfg.title || ep, done: !!cfg.done, exists: fs.existsSync(path.join(EPS, ep)),
      video: mp4 ? `/media/${ep}/out/${encodeURIComponent(mp4)}` : null }; };

  // a pace the Reader sent before its character existed (characters/_paces.json, by name) lands on the profile
  const norm = (x) => String(x || '').trim().toLowerCase();
  const adoptPace = (id, c) => {
    const pending = read(path.join(DIR, '_paces.json'), {}) || {};
    const names = [id, c.name, c.name_en, ...(c.aka || [])].map(norm).filter(Boolean);
    const hit = Object.entries(pending).filter(([n]) => names.includes(norm(n))).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
    if (!hit) return c;
    if (!c.pace || (hit[1].at || 0) > (c.pace.at || 0)) { c.pace = hit[1]; write(path.join(DIR, id, 'character.json'), c); }
    for (const [n] of Object.entries(pending)) if (names.includes(norm(n))) delete pending[n];
    write(path.join(DIR, '_paces.json'), pending);
    return c;
  };

  const full = (id, vids) => {
    const c = adoptPace(id, read(path.join(DIR, id, 'character.json'), {}) || {});
    const videos = [...new Set([...(c.videos || []), ...(vids[id] || [])])].filter((v) => fs.existsSync(path.join(EPS, v)));
    const A = c.assets || {};
    const portraits = [c.portrait, ...(A.portraits || [])].filter(Boolean);
    return { ...c, id, videos, portrait_url: portraits.map((p) => fileUrl(id, p)).find(Boolean) || '',
      asset_urls: Object.fromEntries(Object.entries(A).map(([k, list]) => [k, (list || []).map((p) => ({ path: p, url: fileUrl(id, p), name: path.basename(String(p)) })).filter((x) => x.url)])) };
  };

  app.get('/api/characters', (_q, res) => {
    const vids = videosOf();
    const idx = read(path.join(DIR, 'index.json'), {}) || {};
    res.json({ worlds: idx.worlds || {}, characters: order().map((id) => { const c = full(id, vids); return { ...c, video_count: c.videos.length }; }) });
  });
  app.get('/api/characters/:id', (q, res) => {
    const id = q.params.id.replace(/[^\w-]/g, '');
    if (!fs.existsSync(path.join(DIR, id, 'character.json'))) return res.status(404).json({ error: 'no such character' });
    const c = full(id, videosOf());
    res.json({ ...c, videos: c.videos.map(epInfo) });
  });
  app.post('/api/characters/pace', (q, res) => {  // the Reader: {paces: {name: wpm}, script}
    const { paces = {}, script = '' } = q.body || {};
    const all = order().map((id) => ({ id, c: read(path.join(DIR, id, 'character.json'), {}) || {} }));
    const done = [], unknown = read(path.join(DIR, '_paces.json'), {}) || {};
    for (const [name, wpm] of Object.entries(paces)) {
      if (!+wpm) continue;
      const hit = all.find(({ id, c }) => [id, c.name, c.name_en, ...(c.aka || [])].some((n) => norm(n) && norm(n) === norm(name)));
      if (!hit) { unknown[name] = { wpm: +wpm, at: Date.now(), script }; continue; }
      if (hit.c.pace?.wpm === +wpm) continue;
      hit.c.pace = { wpm: +wpm, at: Date.now(), script };
      write(path.join(DIR, hit.id, 'character.json'), hit.c);
      done.push(hit.id);
    }
    write(path.join(DIR, '_paces.json'), unknown);
    res.json({ ok: true, updated: done });
  });
  app.post('/api/characters/:id', (q, res) => {
    const id = q.params.id.replace(/[^\w-]/g, '').toLowerCase();
    if (!id) return res.status(400).json({ error: 'id' });
    const p = path.join(DIR, id, 'character.json');
    const c = read(p, { id }) || { id };
    for (const [k, v] of Object.entries(q.body?.patch || {})) { if (v === null) delete c[k]; else c[k] = v; }
    write(p, c);
    const idx = read(path.join(DIR, 'index.json'), { order: [] }) || { order: [] };
    if (!(idx.order || []).includes(id)) { idx.order = [...(idx.order || []), id]; write(path.join(DIR, 'index.json'), idx); }
    res.json({ ok: true, character: full(id, videosOf()) });
  });
  app.get('/charfile', (q, res) => {
    const f = path.resolve(String(q.query.p || ''));
    if (!ALLOWED.some((a) => f.toLowerCase().startsWith(a)) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return res.status(404).end();
    res.setHeader('Cache-Control', q.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.sendFile(f);
  });
}
