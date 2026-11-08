// Drop - the PC side. Files he drops from the iPhone (the page: shlomiverse.com/drop/ - public/drop, straight into the
// bucket through Firebase Storage, his Google account only - storage.rules) land in the bucket and STAY there: the
// Drop is where his raw takes live, nothing takes them out but a delete on the Drop page (his rule, 2026-11-08 - the
// old way, every studio pulling new files every minute and removing them from the Drop, let the wrong computer take
// them). Nothing comes down by itself: "Download here" on a folder (New video, the Drop card) brings it to
// Downloads\drop\<folder> on THIS computer, where "+ New video" and any session find it like any footage folder;
// checked (size + md5). The copy here is never touched by the cloud: another file with a name already here comes
// down as name-2. Uses this computer's gcloud login - no keys in the code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

// what a file really is: "3840x2160 hevc 59.94 fps 28 Mb/s" (to see it arrived as filmed, not a converted copy)
const probe = (file) => new Promise((ok) => {
  execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,bit_rate,side_data_list:stream_side_data=rotation', '-of', 'json', file],
    { windowsHide: true }, (e, out) => {
      try {
        const s = JSON.parse(out).streams[0];
        if (!s) return ok('');
        const [a, b] = String(s.avg_frame_rate || '0/1').split('/').map(Number), fps = b ? a / b : 0;
        ok(`${s.width}x${s.height} ${s.codec_name}${fps ? ` ${+fps.toFixed(2)} fps` : ''}${s.bit_rate ? ` ${Math.round(s.bit_rate / 1e6)} Mb/s` : ''}`);
      } catch { ok(''); }
    });
});

const BUCKET = 'boostmind-drop';
const PAGE = 'https://shlomiverse.com/drop/';
const API = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;
const gb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`);

export function startDrop({ app, DOWNLOADS, ROOT, PY, recordJob }) {
  const DIR = path.join(DOWNLOADS, 'drop');
  const local = (name) => path.join(DIR, ...name.split('/'));
  let tok = { v: '', until: 0 };
  const token = () => new Promise((ok, fail) => {
    if (tok.v && Date.now() < tok.until) return ok(tok.v);
    execFile('cmd', ['/c', 'gcloud', 'auth', 'print-access-token'], { windowsHide: true }, (e, out) => {
      if (e) return fail(new Error('gcloud login: ' + e.message.split('\n')[0]));
      tok = { v: out.trim(), until: Date.now() + 40 * 60e3 }; ok(tok.v);
    });
  });
  const gcs = async (url, opts = {}) => fetch(url, { ...opts, headers: { Authorization: `Bearer ${await token()}`, ...(opts.headers || {}) } });
  async function list(prefix = '') {  // every object (a test folder "_x" is not his)
    const items = [];
    let page = '';
    do {
      const r = await gcs(`${API}?prefix=${encodeURIComponent(prefix)}&fields=items(name,size,updated,md5Hash),nextPageToken${page ? `&pageToken=${page}` : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || `storage ${r.status}`);
      items.push(...(j.items || []));
      page = j.nextPageToken || '';
    } while (page);
    const all = items.map((i) => ({ name: i.name, size: +i.size, updated: i.updated, md5: i.md5Hash || '' })).filter((o) => !o.name.startsWith('_') && !o.name.endsWith('/'));
    list.folders = new Set(all.map((o) => o.name.split('/')[0]));  // (every folder in the cloud, an empty new one too)
    list.gone = all.filter((o) => o.name.split('/')[1] === '.gone');  // (deleted on the page: <folder>/.gone/<size>~<name>)
    return all.filter((o) => !o.name.split('/').slice(1).some((x) => x.startsWith('.')));  // (".keep", ".thumbs/": not footage)
  }

  const state = { running: null, cloud: [], error: null, checked: 0 };
  async function download(o) {
    const dst = local(o.as || o.name), part = dst + '.part';
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const r = await gcs(`${API}/${encodeURIComponent(o.name)}?alt=media`);
    if (!r.ok) throw new Error(`download ${r.status}`);
    const out = fs.createWriteStream(part);
    for await (const chunk of r.body) {
      if (!out.write(chunk)) await new Promise((res) => out.once('drain', res));
      state.running.bytes += chunk.length;
    }
    await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
    if (fs.statSync(part).size !== o.size) throw new Error(`${path.basename(dst)}: size differs`);
    fs.renameSync(part, dst);  // (only a whole file gets its real name)
  }
  // the file here is the one in the cloud: same size and the same md5 (cached per file + size + time)
  const sums = new Map();
  const md5 = (file) => new Promise((ok) => {
    const st = fs.statSync(file), k = `${file}|${st.size}|${st.mtimeMs}`;
    if (sums.has(k)) return ok(sums.get(k));
    const h = crypto.createHash('md5');
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => { const d = h.digest('base64'); sums.set(k, d); ok(d); }).on('error', () => ok(''));
  });
  const same = async (o) => { try { return fs.statSync(local(o.name)).size === o.size && (!o.md5 || (await md5(local(o.name))) === o.md5); } catch { return false; } };
  // a name already here with other bytes (the Drop reuses a name once the first file left it): name-2, name-3
  const freeName = (name) => {
    const i = name.lastIndexOf('.'), [base, ext] = i > name.indexOf('/') ? [name.slice(0, i), name.slice(i)] : [name, ''];
    let n = name;
    for (let k = 2; fs.existsSync(local(n)) || fs.existsSync(local(n) + '.part'); k++) n = `${base}-${k}${ext}`;
    return n;
  };
  // already here: the same name, or the name-2 / name-3 it came down as, with the same size and md5
  const hereAs = async (o) => {
    if (await same(o)) return true;
    const folder = o.name.split('/')[0], file = o.name.slice(folder.length + 1);
    const i = file.lastIndexOf('.'), [base, ext] = i > 0 ? [file.slice(0, i), file.slice(i)] : [file, ''];
    let names = []; try { names = fs.readdirSync(path.join(DIR, folder)); } catch { return false; }
    for (const n of names.filter((n) => n.startsWith(base + '-') && n.endsWith(ext) && /^\d+$/.test(n.slice(base.length + 1, n.length - ext.length)))) {
      const f = path.join(DIR, folder, n);
      try { if (fs.statSync(f).size === o.size && (!o.md5 || (await md5(f)) === o.md5)) return true; } catch {}
    }
    return false;
  };
  // the folders he asked to bring to this computer ("Download here") - until they are here whole
  const wanted = new Set();
  async function sync() {
    if (state.running) return;
    let items;
    try { items = await list(); state.error = null; } catch (e) { state.error = e.message; return; }
    state.cloud = items; state.checked = Date.now();
    // deleted on the Drop page (a voice take he didn't like): the copy here goes too - only the same name and size
    for (const g of list.gone || []) {
      const [folder, , mark] = g.name.split('/'), cut = mark.indexOf('~'), size = +mark.slice(0, cut), file = mark.slice(cut + 1);
      // (it may have come down as name-2 when the name was here already: those too, by size)
      const i = file.lastIndexOf('.'), [base, ext] = i > 0 ? [file.slice(0, i), file.slice(i)] : [file, ''];
      let names = []; try { names = fs.readdirSync(path.join(DIR, folder)); } catch {}
      const hit = file && !file.includes('..') && names.find((n) => (n === file || (n.startsWith(base + '-') && n.endsWith(ext) && /^\d+$/.test(n.slice(base.length + 1, n.length - ext.length))))
        && fs.statSync(path.join(DIR, folder, n)).size === size);
      if (hit) { try { fs.rmSync(path.join(DIR, folder, hit)); recordJob({ id: folder, kind: 'drop', started: Date.now(), ended: Date.now(), ok: true, line: `${hit} deleted on the Drop page - deleted here too` }); } catch {} }
      if (!items.some((o) => o.name === `${folder}/${file}`)) await gcs(`${API}/${encodeURIComponent(g.name)}`, { method: 'DELETE' }).catch(() => {});
    }
    // only the folders he asked for on this computer: what isn't here yet comes down (a name here with other bytes
    // comes down as name-2). The Drop keeps every file.
    const todo = [];
    for (const o of items) {
      if (!wanted.has(o.name.split('/')[0]) || await hereAs(o)) continue;
      todo.push(fs.existsSync(local(o.name)) ? { ...o, as: freeName(o.name) } : o);
    }
    for (const f of [...wanted]) if (!todo.some((o) => o.name.split('/')[0] === f)) wanted.delete(f);  // (here whole already)
    const folders = [...new Set(todo.map((o) => o.name.split('/')[0]))];
    for (const folder of folders) {  // one job per folder (the Jobs panel)
      const files = todo.filter((o) => o.name.split('/')[0] === folder), total = files.reduce((s, o) => s + o.size, 0), started = Date.now();
      state.running = { folder, i: 0, n: files.length, bytes: 0, total, started, file: '' };
      let ok = true, err = '';
      const seen = [];
      for (const o of files) {
        state.running.i++; state.running.file = (o.as || o.name).split('/').pop();
        try { await download(o); } catch (e) { ok = false; err = e.message; break; }
        const what = await probe(local(o.as || o.name));
        seen.push(`${state.running.file} ${gb(o.size)}${what ? ` ${what}` : ''}`);
        // whole? (download checked the size; md5 when the cloud has one)
        if (o.md5 && (await md5(local(o.as || o.name))) !== o.md5) { ok = false; err = `${state.running.file}: md5 differs`; try { fs.rmSync(local(o.as || o.name)); } catch {} break; }
      }
      if (ok) wanted.delete(folder);  // (a failed one tries again on the next round)
      recordJob({ id: folder, kind: 'drop', started, ended: Date.now(), ok, files: seen,
        line: ok ? `${files.length} file${files.length === 1 ? '' : 's'} · ${gb(total)} → Downloads\\drop\\${folder} · ${seen.join(' | ')} · kept in the Drop` : `failed: ${err}` });
      state.running = null;
    }
  }
  // the scripts, up for the phone's Shoot page (its prompter): the Reader's saved scripts (scripts/*.txt) and every
  // project's own script.txt, as _scripts/<s|e>/<id>.txt + _scripts/index.json [{id, name, updated, drop}] ("drop": the
  // project's Drop folder - picking its script on the phone sends the takes there). "_" = never pulled down, never
  // listed as a project. Only what changed goes up; everything again once a day (the bucket forgets after 60 days)
  const pushed = new Map();
  let pushedDay = 0;
  function scriptList() {  // [{id, file, name, updated, drop}], newest first
    const all = [], since = Date.now() - 120 * 864e5;
    const take = (id, file, name, drop) => { try { const st = fs.statSync(file); if (st.mtimeMs > since) all.push({ id, file, name, updated: st.mtimeMs, drop }); } catch {} };
    const SC = path.join(ROOT, 'scripts'), EPS = path.join(ROOT, 'episodes');
    try { for (const f of fs.readdirSync(SC).filter((f) => f.endsWith('.txt'))) take(`s/${f.slice(0, -4)}`, path.join(SC, f), '', ''); } catch {}
    try {
      for (const d of fs.readdirSync(EPS).filter((d) => !d.startsWith('_'))) {
        let cfg; try { cfg = JSON.parse(fs.readFileSync(path.join(EPS, d, 'episode.json'), 'utf8')); } catch { continue; }
        if (cfg.done) continue;
        const inp = path.resolve(String(cfg.input_dir || ''));
        const drop = cfg.input_dir && inp.toLowerCase().startsWith(DIR.toLowerCase() + path.sep) ? path.relative(DIR, inp).split(path.sep)[0] : '';
        if (cfg.script) { const s = all.find((x) => x.id === `s/${cfg.script}`); if (s && drop) s.drop = drop; continue; }  // (it links to a saved script)
        take(`e/${d}`, path.join(EPS, d, 'script.txt'), cfg.title || d, drop);
      }
    } catch {}
    for (const s of all) {
      try { const first = fs.readFileSync(s.file, 'utf8').split(/\r?\n/)[0]; if (first.startsWith('# ')) s.name = first.slice(2).trim(); } catch {}
      s.name ||= s.id.slice(2);
    }
    return all.sort((a, b) => b.updated - a.updated);
  }
  async function pushScripts() {
    if (Date.now() - pushedDay > 864e5) { pushed.clear(); pushedDay = Date.now(); }
    const all = scriptList();
    let changed = false;
    for (const s of all) {
      if (pushed.get(s.id) === s.updated) continue;
      const text = fs.readFileSync(s.file, 'utf8');
      const r = await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(`_scripts/${s.id}.txt`)}`,
        { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: text });
      if (r.ok) { pushed.set(s.id, s.updated); changed = true; }
    }
    const index = JSON.stringify(all.map(({ id, name, updated, drop }) => ({ id, name, updated, drop })));
    if (changed || index !== pushScripts.last) {
      const r = await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent('_scripts/index.json')}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: index });
      if (r.ok) pushScripts.last = index;
    }
  }
  setTimeout(sync, 5000);
  setInterval(sync, 60e3);
  setTimeout(() => pushScripts().catch(() => {}), 8000);
  setInterval(() => pushScripts().catch(() => {}), 60e3);

  // a project marked Done: nothing leaves the Drop any more - his raw takes stay there (his rule, 2026-11-08)
  const cleanup = () => {};

  app.get('/api/drop', (_q, res) => {
    const folders = {};
    for (const o of state.cloud) { const f = o.name.split('/')[0]; (folders[f] ||= { name: f, files: 0, bytes: 0, here: 0 }); folders[f].files++; folders[f].bytes += o.size; try { if (fs.statSync(local(o.name)).size === o.size) folders[f].here++; } catch {} }
    for (const f of Object.values(folders)) f.wanted = wanted.has(f.name);
    res.json({ page: PAGE, ready: true, folders: Object.values(folders), running: state.running, error: state.error, checked: state.checked, dir: DIR });
  });
  app.post('/api/drop/sync', (_q, res) => { sync(); res.json({ ok: true }); });  // (looks at the Drop now - takes nothing)
  // "Download here": this folder of the Drop comes to this computer (and stays in the Drop)
  app.post('/api/drop/pull', (q, res) => {
    const folder = String(q.body?.folder || '');
    if (!folder || folder.includes('/') || folder.includes('..') || folder.startsWith('_')) return res.status(400).json({ error: 'which folder?' });
    wanted.add(folder); sync(); res.json({ ok: true });
  });
  app.get('/api/drop/open', (_q, res) => res.redirect(PAGE));  // (the studio's "Open the Drop")
  // the page's link as a QR - scanned once with the iPhone camera (he signs in with Google there once)
  app.get('/api/drop/qr.svg', (_q, res) => {
    execFile(PY, ['-c', "import segno,sys; segno.make(sys.argv[1], error='l').save(sys.stdout.buffer, kind='svg', scale=5, dark='#141312', light='#ffffff', border=2)", PAGE],
      { encoding: 'buffer', windowsHide: true }, (e, out) => { if (e) return res.status(500).end(); res.type('image/svg+xml').set('Cache-Control', 'no-store').send(out); });
  });

  // a new project's folder in the cloud before its first file (a placeholder - so the phone's pages list it)
  const mkdir = (folder) => gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(`${folder}/.keep`)}`,
    { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '' });

  return {
    cleanup,
    mkdir,
    running: () => (state.running ? [{ id: state.running.folder, kind: 'drop', started: state.running.started,
      pct: Math.floor((state.running.bytes / Math.max(1, state.running.total)) * 100),
      log: [`${state.running.i}/${state.running.n} · ${state.running.file} · ${gb(state.running.bytes)} of ${gb(state.running.total)}`] }] : []),
    folders: () => { try { return fs.readdirSync(DIR).filter((f) => fs.statSync(path.join(DIR, f)).isDirectory()).map((f) => path.join(DIR, f)); } catch { return []; } },
  };
}
