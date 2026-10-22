// Drop - the PC side. Files he drops from the iPhone (the page: zoomcut/drop, on Cloud Run) land in the bucket; the
// studio pulls each new one down to Downloads\drop\<folder> by itself (every minute), where "+ New video" and any
// session find it like any footage folder. A project marked Done empties its folder in the cloud (the copy here stays);
// the bucket also forgets anything older than 60 days. Uses this computer's gcloud login - no keys in the code.
import fs from 'node:fs';
import path from 'node:path';
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
const PAGE = 'https://drop-463727469066.me-west1.run.app';
const API = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;
const gb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`);

export function startDrop({ app, DOWNLOADS, ROOT, PY, recordJob }) {
  const DIR = path.join(DOWNLOADS, 'drop');
  const local = (name) => path.join(DIR, ...name.split('/'));
  const key = () => { try { return /^DROP_KEY=(.+)$/m.exec(fs.readFileSync(path.join(ROOT, '.env'), 'utf8'))?.[1].trim() || ''; } catch { return ''; } };
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
      const r = await gcs(`${API}?prefix=${encodeURIComponent(prefix)}&fields=items(name,size,updated),nextPageToken${page ? `&pageToken=${page}` : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || `storage ${r.status}`);
      items.push(...(j.items || []));
      page = j.nextPageToken || '';
    } while (page);
    const all = items.map((i) => ({ name: i.name, size: +i.size, updated: i.updated })).filter((o) => !o.name.startsWith('_') && !o.name.endsWith('/'));
    list.folders = new Set(all.map((o) => o.name.split('/')[0]));  // (every folder in the cloud, an empty new one too)
    return all.filter((o) => !o.name.split('/').slice(1).some((x) => x.startsWith('.')));  // (".keep", ".thumbs/": not footage)
  }

  const state = { running: null, cloud: [], error: null, checked: 0 };
  async function download(o) {
    const dst = local(o.name), part = dst + '.part';
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
  // a file renamed or deleted on the Drop page: the same here - a rename is the same size under a new name (no
  // download again). Only for folders still in the cloud (a project marked Done keeps its copy here).
  function mirror(items) {
    const done = [];
    for (const folder of list.folders || []) {
      let here = [];
      try { here = fs.readdirSync(path.join(DIR, folder)).filter((f) => !f.endsWith('.part') && fs.statSync(path.join(DIR, folder, f)).isFile()); } catch { continue; }
      const cloud = items.filter((o) => o.name.split('/')[0] === folder);
      const names = new Set(cloud.map((o) => o.name.split('/').slice(1).join('/')));
      const missing = cloud.filter((o) => !fs.existsSync(local(o.name)));
      for (const f of here.filter((x) => !names.has(x))) {
        const size = fs.statSync(path.join(DIR, folder, f)).size;
        const to = missing.find((o) => o.size === size);
        try {
          if (to) { fs.renameSync(path.join(DIR, folder, f), local(to.name)); missing.splice(missing.indexOf(to), 1); done.push(`${f} → ${to.name.split('/').pop()}`); }
          else { fs.rmSync(path.join(DIR, folder, f)); done.push(`${f} removed`); }
        } catch {}
      }
      if (done.length) recordJob({ id: folder, kind: 'drop', started: Date.now(), ended: Date.now(), ok: true, line: `as on the Drop page: ${done.join(' · ')}` }), done.length = 0;
    }
  }
  async function sync() {
    if (state.running) return;
    let items;
    try { items = await list(); state.error = null; } catch (e) { state.error = e.message; return; }
    state.cloud = items; state.checked = Date.now();
    mirror(items);
    const todo = items.filter((o) => { try { return fs.statSync(local(o.name)).size !== o.size; } catch { return true; } });
    const folders = [...new Set(todo.map((o) => o.name.split('/')[0]))];
    for (const folder of folders) {  // one job per folder (the Jobs panel)
      const files = todo.filter((o) => o.name.split('/')[0] === folder), total = files.reduce((s, o) => s + o.size, 0), started = Date.now();
      state.running = { folder, i: 0, n: files.length, bytes: 0, total, started, file: '' };
      let ok = true, err = '';
      const seen = [];
      for (const o of files) {
        state.running.i++; state.running.file = o.name.split('/').pop();
        try { await download(o); } catch (e) { ok = false; err = e.message; break; }
        const what = await probe(local(o.name));
        seen.push(`${state.running.file} ${gb(o.size)}${what ? ` ${what}` : ''}`);
      }
      recordJob({ id: folder, kind: 'drop', started, ended: Date.now(), ok, files: seen,
        line: ok ? `${files.length} file${files.length === 1 ? '' : 's'} · ${gb(total)} → Downloads\\drop\\${folder} · ${seen.join(' | ')}` : `failed: ${err}` });
      state.running = null;
    }
  }
  setTimeout(sync, 5000);
  setInterval(sync, 60e3);

  // a project marked Done: its footage folder (when it came from the drop) leaves the cloud - the copy here stays
  async function cleanup(cfg, id) {
    const inp = path.resolve(String(cfg?.input_dir || ''));
    if (!cfg?.input_dir || !inp.toLowerCase().startsWith(DIR.toLowerCase() + path.sep)) return;
    const folder = path.relative(DIR, inp).split(path.sep)[0];
    try {
      const objs = (await list(`${folder}/`));
      for (const o of objs) await gcs(`${API}/${encodeURIComponent(o.name)}`, { method: 'DELETE' });
      if (objs.length) recordJob({ id, kind: 'drop', started: Date.now(), ended: Date.now(), ok: true,
        line: `done: ${objs.length} file${objs.length === 1 ? '' : 's'} · ${gb(objs.reduce((s, o) => s + o.size, 0))} removed from the cloud (the copy in Downloads\\drop\\${folder} stays)` });
      state.cloud = state.cloud.filter((o) => !o.name.startsWith(`${folder}/`));
    } catch (e) {
      recordJob({ id, kind: 'drop', started: Date.now(), ended: Date.now(), ok: false, line: `cloud clean-up failed: ${e.message}` });
    }
  }

  const link = () => `${PAGE}/#k=${key()}`;
  app.get('/api/drop', (_q, res) => {
    const folders = {};
    for (const o of state.cloud) { const f = o.name.split('/')[0]; (folders[f] ||= { name: f, files: 0, bytes: 0, here: 0 }); folders[f].files++; folders[f].bytes += o.size; try { if (fs.statSync(local(o.name)).size === o.size) folders[f].here++; } catch {} }
    res.json({ page: PAGE, ready: !!key(), folders: Object.values(folders), running: state.running, error: state.error, checked: state.checked, dir: DIR });
  });
  app.post('/api/drop/sync', (_q, res) => { sync(); res.json({ ok: true }); });
  app.get('/api/drop/open', (_q, res) => res.redirect(link()));  // (the page with its key - the studio's "Open the Drop")
  // the page's link with the key in it, as a QR - scanned once with the iPhone camera, the phone keeps the key
  app.get('/api/drop/qr.svg', (_q, res) => {
    execFile(PY, ['-c', "import segno,sys; segno.make(sys.argv[1], error='l').save(sys.stdout.buffer, kind='svg', scale=5, dark='#141312', light='#ffffff', border=2)", link()],
      { encoding: 'buffer', windowsHide: true }, (e, out) => { if (e) return res.status(500).end(); res.type('image/svg+xml').set('Cache-Control', 'no-store').send(out); });
  });

  return {
    cleanup,
    running: () => (state.running ? [{ id: state.running.folder, kind: 'drop', started: state.running.started,
      pct: Math.floor((state.running.bytes / Math.max(1, state.running.total)) * 100),
      log: [`${state.running.i}/${state.running.n} · ${state.running.file} · ${gb(state.running.bytes)} of ${gb(state.running.total)}`] }] : []),
    folders: () => { try { return fs.readdirSync(DIR).filter((f) => fs.statSync(path.join(DIR, f)).isDirectory()).map((f) => path.join(DIR, f)); } catch { return []; } },
  };
}
