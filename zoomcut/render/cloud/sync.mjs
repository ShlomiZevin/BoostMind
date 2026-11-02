// The studio online: his projects follow him to whichever computer he sits at (gs://shlomiverse-studio, layout in
// ./layout.mjs). One computer at a time edits a project:
//   open   -> the project's lock (locks/<id>.json: "open on OFFICE-PC since 14:02") - taken if free, stale (no beat
//             for 3 minutes) or his own; held by another computer -> the editor asks "take it over?"
//          -> what changed in the cloud comes down (a file this computer didn't change since the last sync), then the
//             footage folders the project uses; the editor waits with a progress line
//   while open: the editor beats every minute; what changed here goes up a few seconds after an edit and every minute
//             (never while a job of the project runs - its files are half-written then; the next round takes them)
//   close / another project -> a last push, the lock is let go
// Nothing is ever deleted on this computer by the sync. A file deleted here that was in the cloud is deleted there
// (the bucket keeps deleted files 7 days). A file changed on both sides (only if two computers worked without the lock)
// keeps both: his copy as "<name> (conflict <computer>)<ext>".
// OFF until he switches it on (episodes/_cloud/config.json {"sync": "on"}) - his rule: the local folders stay as they
// are until he says so. ZC_CLOUD=test: only hidden _test projects (a second studio for tests never touches his).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EPS, skip, footageName, localPath, readJson } from './layout.mjs';
import { list, folders, getJson, putJson, remove, upload, download, same, md5File } from './store.mjs';

export const HOST = process.env.ZC_HOST || os.hostname();  // (ZC_HOST: a test studio acting as another computer)
const CONFIG = path.join(EPS, '_cloud', 'config.json');
const STALE = 3 * 60e3;
const mode = () => process.env.ZC_CLOUD === 'test' ? 'test' : readJson(CONFIG, {})?.sync === 'on' ? 'on' : 'off';
const allowed = (id) => { const m = mode(); return m === 'on' ? !id.startsWith('_') : m === 'test' ? id.startsWith('_') : false; };

export const walk = (dir, base = dir, out = {}) => {
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, base, out);
    else if (e.isFile()) { const rel = path.relative(base, f).split(path.sep).join('/'); if (!skip(rel)) { const st = fs.statSync(f); out[rel] = { size: st.size, mtime: Math.round(st.mtimeMs) }; } }
  }
  return out;
};
export const stateFile = (id) => path.join(EPS, id, '.cloud-state.json');
export const fp = (r) => r.md5 || 'c:' + r.crc;  // (an object's fingerprint)
// is the local file the cloud's object? cheap when they agreed before (same size + time as then), else by its time
// stamp from the copy (gcloud keeps it), else read it
export async function sameAs(file, loc, r, st) {
  if (!r || loc.size !== r.size) return false;
  if (st && st.size === loc.size && st.mtime === loc.mtime && st.fp === fp(r)) return true;
  const t = +(r.meta.mtime || 0) || +(r.meta['goog-reserved-file-mtime'] || 0) * 1000;
  if (t && Math.abs(t - loc.mtime) < 2000) return true;
  return same(file, r);
}
export const pool = async (items, n, f) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await f(items[i++]); })); };

export function startSync({ app, jobs, log = (s) => console.log(s) }) {
  const busy = {};  // id -> the pull / push running (one at a time per project)
  const progress = {};  // id -> {state, files, done, bytes, doneBytes, error}
  const held = new Map();  // id -> {gen, since} - the locks this computer has
  const serial = (id, f) => (busy[id] = (busy[id] || Promise.resolve()).then(f, f));

  // ---- the lock ------------------------------------------------------------------------------------------------
  const lockName = (id) => `locks/${id}.json`;
  async function lock(id, force) {
    for (let k = 0; k < 2; k++) {
      const g = await getJson(lockName(id));
      const mine = g?.v.host === HOST, stale = g && Date.now() - (g.v.beat || 0) > STALE;
      if (g && !mine && !stale && !force) return { locked: g.v };
      const v = { host: HOST, since: mine ? g.v.since : Date.now(), beat: Date.now() };
      const gen = await putJson(lockName(id), v, g ? g.gen : '0');
      if (gen) { held.set(id, { gen, since: v.since }); return { ok: true, took: g && !mine ? g.v : null }; }
    }
    return { locked: (await getJson(lockName(id)))?.v || { host: '?' } };
  }
  async function beat(id) {
    const h = held.get(id); if (!h) return { lost: null };
    const gen = await putJson(lockName(id), { host: HOST, since: h.since, beat: Date.now() }, h.gen);
    if (gen) { h.gen = gen; return { ok: true }; }
    held.delete(id);  // another computer took it over: this one stops writing it
    return { lost: (await getJson(lockName(id)))?.v || null };
  }
  async function unlock(id) {
    const h = held.get(id); if (!h) return;
    held.delete(id);
    const g = await getJson(lockName(id));
    if (g?.v.host === HOST) await remove(lockName(id)).catch(() => {});
  }

  // ---- down -----------------------------------------------------------------------------------------------------
  const footageOf = (id) => {  // the cloud folders of the raw takes this project uses, and where they go here
    const d = path.join(EPS, id), out = new Map();
    const add = (abs) => { const n = footageName(abs); if (n && n.split('/').length >= 3) out.set(n, localPath(abs)); };
    const ep = readJson(path.join(d, 'episode.json'));
    if (ep?.input_dir) add(ep.input_dir);
    for (const a of Object.values(readJson(path.join(d, 'project.json'))?.assets || {})) {
      const s = String(a?.src || ''); if (!s) continue;
      const abs = path.resolve(d, s);
      if (footageName(abs)) add(path.dirname(abs));
    }
    return out;
  };
  async function pull(id) {
    const P = (progress[id] = { state: 'checking', files: 0, done: 0, bytes: 0, doneBytes: 0 });
    const dir = path.join(EPS, id), prefix = `projects/${id}/`;
    const remote = await list(prefix);
    if (!Object.keys(remote).length) { P.state = 'ready'; return P; }  // (not in the cloud yet: the first push sends it)
    const state = readJson(stateFile(id), { files: {} }), local = walk(dir);
    const todo = [];
    for (const [name, r] of Object.entries(remote)) {
      const rel = name.slice(prefix.length); if (!rel || skip(rel)) continue;
      const loc = local[rel], st = state.files[rel], f = path.join(dir, rel);
      if (loc && await sameAs(f, loc, r, st)) { state.files[rel] = { ...loc, fp: fp(r) }; continue; }
      const unchangedHere = loc && st && st.size === loc.size && st.mtime === loc.mtime;
      if (loc && !unchangedHere && st && st.fp === fp(r)) continue;  // changed only here: it goes up
      // changed on both sides since this computer last synced: keep his copy beside it. (Never synced here - a new
      // computer, whose copies of the .json files came from git - the cloud's is the newer one: it just comes down.
      // His main PC never gets here: tools/cloud_switch.mjs records its state first, its files being the truth.)
      if (loc && !unchangedHere && st) {
        const e = path.extname(f); fs.renameSync(f, f.slice(0, f.length - e.length) + ` (conflict ${HOST})` + e);
        log(`cloud: ${id}/${rel} changed here and in the cloud - kept this computer's copy beside it`);
      }
      todo.push({ name, r, rel, f });
    }
    P.state = 'pulling';
    const get = async (list_) => {
      P.files += list_.length; P.bytes += list_.reduce((s, x) => s + x.r.size, 0);
      await pool(list_, 3, async (x) => {
        await download(x.name, x.f, x.r);
        if (!x.footage) { const st = fs.statSync(x.f); state.files[x.rel] = { size: st.size, mtime: Math.round(st.mtimeMs), fp: fp(x.r) }; }
        P.done++; P.doneBytes += x.r.size;
      });
    };
    await get(todo);
    fs.writeFileSync(stateFile(id), JSON.stringify(state));
    // then the footage folders it uses - read from the project as it is now (never overwritten: a take doesn't
    // change; only what's missing here)
    const foot = [];
    for (const [cloudDir, here] of footageOf(id)) {
      for (const [name, r] of Object.entries(await list(cloudDir + '/'))) {
        const f = path.join(here, name.slice(cloudDir.length + 1));
        if (!fs.existsSync(f)) foot.push({ name, r, f, footage: true });
      }
    }
    await get(foot);
    todo.push(...foot);
    P.state = 'ready';
    if (todo.length) log(`cloud: ${id} - ${todo.length} files down (${(P.bytes / 1e6).toFixed(0)} MB)`);
    return P;
  }

  // ---- up -------------------------------------------------------------------------------------------------------
  async function push(id) {
    if (!held.has(id) || jobs[id]?.running) return { skipped: true };
    const dir = path.join(EPS, id), prefix = `projects/${id}/`;
    const state = readJson(stateFile(id), { files: {} }), local = walk(dir);
    // (quick: nothing changed since the last sync - no need to ask the cloud)
    const changed = Object.entries(local).filter(([rel, l]) => { const st = state.files[rel]; return !st || st.size !== l.size || st.mtime !== l.mtime; });
    const gone = Object.keys(state.files).filter((rel) => !local[rel]);
    if (!changed.length && !gone.length) return { up: 0 };
    const remote = await list(prefix);
    let up = 0, bytes = 0;
    await pool(changed, 3, async ([rel, l]) => {
      const f = path.join(dir, rel), r = remote[prefix + rel];
      if (r && await sameAs(f, l, r, state.files[rel])) { state.files[rel] = { ...l, fp: fp(r) }; return; }
      const md5 = await md5File(f);
      const o = await upload(f, prefix + rel, md5);
      const now = fs.statSync(f);
      if (now.size === l.size && Math.round(now.mtimeMs) === l.mtime) state.files[rel] = { ...l, fp: o.md5Hash || md5 };  // (changed while it went up: next round)
      up++; bytes += l.size;
    });
    for (const rel of gone) { await remove(prefix + rel).catch(() => {}); delete state.files[rel]; }
    // takes added to its footage folder on this computer (the Drop, a copy from the phone) go up too
    for (const [cloudDir, here] of footageOf(id)) {
      const have = walk(here); if (!Object.keys(have).length) continue;
      const fr = await list(cloudDir + '/');
      for (const rel of Object.keys(have)) if (!fr[cloudDir + '/' + rel]) { await upload(path.join(here, rel), cloudDir + '/' + rel); up++; bytes += have[rel].size; }
    }
    fs.writeFileSync(stateFile(id), JSON.stringify(state));
    if (up || gone.length) log(`cloud: ${id} - ${up} files up (${(bytes / 1e6).toFixed(1)} MB)${gone.length ? `, ${gone.length} deleted` : ''}`);
    return { up, gone: gone.length };
  }
  const soon = {};
  const pushSoon = (id) => { if (!allowed(id) || !held.has(id)) return; clearTimeout(soon[id]); soon[id] = setTimeout(() => serial(id, () => push(id)).catch((e) => log('cloud push: ' + e.message)), 4000); };
  const tick = setInterval(() => { for (const id of held.keys()) serial(id, () => push(id)).catch((e) => log('cloud push: ' + e.message)); }, 60e3);
  tick.unref?.();

  // ---- the studio's endpoints -------------------------------------------------------------------------------------
  app.get('/api/cloud', (_q, res) => res.json({ mode: mode(), host: HOST, held: [...held.keys()] }));
  // open a project here: its lock, then what changed comes down. {locked: {host, since}} = ask him; {pulling} = wait
  app.post('/api/cloud/:id/open', async (q, res) => {
    const id = q.params.id;
    if (!allowed(id)) return res.json({ ready: true, off: true });
    try {
      for (const other of [...held.keys()]) if (other !== id) serial(other, async () => { await push(other); await unlock(other); }).catch(() => {});  // (one project open here at a time)
      const l = await lock(id, !!q.body?.force);
      if (l.locked) return res.json({ locked: l.locked });
      serial(id, () => pull(id)).catch((e) => { progress[id] = { ...(progress[id] || {}), state: 'error', error: e.message }; log('cloud pull: ' + e.message); });
      res.json({ pulling: true, took: l.took });
    } catch (e) { res.json({ ready: true, error: e.message }); }  // (no internet / no login: he works on what is here)
  });
  app.get('/api/cloud/:id/progress', (q, res) => res.json(progress[q.params.id] || { state: 'ready' }));
  app.post('/api/cloud/:id/beat', async (q, res) => { try { res.json(allowed(q.params.id) ? await beat(q.params.id) : { off: true }); } catch (e) { res.json({ error: e.message }); } });
  app.post('/api/cloud/:id/close', async (q, res) => {
    const id = q.params.id;
    serial(id, async () => { await push(id); await unlock(id); }).catch(() => {});
    res.json({ ok: true });
  });
  app.post('/api/cloud/:id/push', async (q, res) => { try { res.json(await serial(q.params.id, () => push(q.params.id))); } catch (e) { res.json({ error: e.message }); } });

  // the projects in the cloud that aren't on this computer yet (the project menu lists them; opening one brings it)
  let cloudIds = { at: 0, ids: [] };
  const cloudOnly = async () => {
    if (mode() === 'off') return [];
    if (Date.now() - cloudIds.at > 120e3) cloudIds = { at: Date.now(), ids: await folders('projects/').catch(() => cloudIds.ids) };
    return cloudIds.ids.filter((id) => allowed(id) && !fs.existsSync(path.join(EPS, id, 'episode.json')));
  };
  return { pushSoon, cloudOnly, pull, push, lock, unlock, mode, allowed };
}
