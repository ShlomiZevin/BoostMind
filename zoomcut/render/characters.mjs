// The characters of his channel - "the multiverse", shown on the studio's Characters page (ui/characters.tsx). Read and
// saved in the Shlomiverse's database (verse_db.mjs - catalogCharacters / catalogSeries, since 2026-11-06: one copy, the
// one the site uses; no character.json / index.json in git). Their pictures stay files on each computer
// (zoomcut/characters/<id>/ - gitignored, his face, the same on both through render/cloud/pool.mjs); the face on the
// site (wiki.json's img) is shown where this computer has no picture.
//   GET  /api/characters            every character (the records' order) with its portrait, videos and pace, + the worlds
//   GET  /api/characters/:id        one, with its videos' titles and every asset as a URL
//   POST /api/characters/:id        {patch} - edit (or create) one; null removes a field
//   POST /api/characters/pace       {paces: {<name as in a script>: wpm}, script} - the Reader's paces, matched by name
//   GET  /charfile?p=<path>         an asset file (only under the studio, the website folder or Downloads)
// A video belongs to a character when its project.json lists the id in `characters` (the builders write it) or the
// character lists the video.
import fs from 'node:fs';
import path from 'node:path';
import * as db from './verse_db.mjs';

export default function characters(app, { ROOT, EPS }) {
  const DIR = path.join(ROOT, 'characters');  // (the pictures; and _paces.json - the Reader's paces of names not known yet)
  const PUBLIC = path.resolve(ROOT, '..', 'public');
  const DOWNLOADS = path.join(process.env.USERPROFILE || 'C:/Users/shazbak', 'Downloads');
  const ALLOWED = [path.resolve(ROOT), PUBLIC, path.resolve(DOWNLOADS)].map((p) => p.toLowerCase());
  const read = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
  const write = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); };
  const fail = (res, e) => res.status(502).json({ error: String(e.message || e).slice(0, 300) });

  // a path in a record: absolute, relative to the character's folder, or to the studio / repo - on THIS computer (a
  // picture the other computer has and this one doesn't just isn't shown)
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
  const namesOf = (c) => [c.id, c.name, c.name_en, ...(c.aka || [])].map(norm).filter(Boolean);
  const PACES = path.join(DIR, '_paces.json');
  const adoptPaces = async (all) => {
    const pending = read(PACES, {}) || {};
    if (!Object.keys(pending).length) return;
    let changed = false;
    for (const c of all) {
      const names = namesOf(c);
      const hit = Object.entries(pending).filter(([n]) => names.includes(norm(n))).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
      if (!hit) continue;
      if (!c.pace || (hit[1].at || 0) > (c.pace.at || 0)) { c.pace = hit[1]; await db.putCharacter(c.id, { pace: hit[1] }).catch(() => {}); }
      for (const [n] of Object.entries(pending)) if (names.includes(norm(n))) delete pending[n];
      changed = true;
    }
    if (changed) write(PACES, pending);
  };

  const full = (c, vids, face = {}) => {
    const id = c.id;
    const videos = [...new Set([...(c.videos || []), ...(vids[id] || [])])].filter((v) => fs.existsSync(path.join(EPS, v)));
    const A = c.assets || {};
    const portraits = [c.portrait, ...(A.portraits || [])].filter(Boolean);
    return { ...c, id, videos, portrait_url: portraits.map((p) => fileUrl(id, p)).find(Boolean) || face[id] || '',  // (no picture here: the site's face)
      asset_urls: Object.fromEntries(Object.entries(A).map(([k, list]) => [k, (list || []).map((p) => ({ path: p, url: fileUrl(id, p), name: path.basename(String(p)) })).filter((x) => x.url)])) };
  };

  app.get('/api/characters', async (_q, res) => {
    try {
      const [all, worlds, face] = await Promise.all([db.characters(), db.worlds(), db.faces()]);
      await adoptPaces(all);
      const vids = videosOf();
      res.json({ worlds, characters: all.map((c) => { const x = full(c, vids, face); return { ...x, video_count: x.videos.length }; }) });
    } catch (e) { fail(res, e); }
  });
  app.get('/api/characters/:id', async (q, res) => {
    try {
      const id = q.params.id.replace(/[^\w-]/g, '');
      const c = await db.character(id);
      if (!c) return res.status(404).json({ error: 'no such character' });
      await adoptPaces([c]);
      const x = full(c, videosOf(), await db.faces());
      res.json({ ...x, videos: x.videos.map(epInfo) });
    } catch (e) { fail(res, e); }
  });
  app.post('/api/characters/pace', async (q, res) => {  // the Reader: {paces: {name: wpm}, script}
    try {
      const { paces = {}, script = '' } = q.body || {};
      const all = await db.characters();
      const done = [], unknown = read(PACES, {}) || {};
      for (const [name, wpm] of Object.entries(paces)) {
        if (!+wpm) continue;
        const hit = all.find((c) => namesOf(c).includes(norm(name)));
        if (!hit) { unknown[name] = { wpm: +wpm, at: Date.now(), script }; continue; }
        if (hit.pace?.wpm === +wpm) continue;
        await db.putCharacter(hit.id, { pace: { wpm: +wpm, at: Date.now(), script } });  // (a studio field: the site isn't recomposed)
        done.push(hit.id);
      }
      write(PACES, unknown);
      res.json({ ok: true, updated: done });
    } catch (e) { fail(res, e); }
  });
  app.post('/api/characters/:id', async (q, res) => {
    try {
      const id = q.params.id.replace(/[^\w-]/g, '').toLowerCase();
      if (!id) return res.status(400).json({ error: 'id' });
      const c = await db.putCharacter(id, q.body?.patch || {});
      res.json({ ok: true, character: c ? full(c, videosOf(), await db.faces()) : null });
    } catch (e) { fail(res, e); }
  });
  app.get('/charfile', (q, res) => {
    const f = path.resolve(String(q.query.p || ''));
    if (!ALLOWED.some((a) => f.toLowerCase().startsWith(a)) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return res.status(404).end();
    res.setHeader('Cache-Control', q.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.sendFile(f);
  });
}
