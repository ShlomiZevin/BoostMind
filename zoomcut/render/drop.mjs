// Drop - the PC side. Files he drops from the iPhone (the page: zoomcut/drop, on Cloud Run) land in the bucket; the
// studio pulls each new one down to Downloads\drop\<folder> by itself (every minute), where "+ New video" and any
// session find it like any footage folder. Once a file is here, checked (size + md5), it leaves the Drop - the Drop
// only holds what is still on its way (his rule, 2026-10-23). The copy here is never touched by the cloud: a name
// used again later comes down as name-2. A project marked Done empties what is left of its folder in the cloud; the
// bucket also forgets anything older than 60 days. Uses this computer's gcloud login - no keys in the code.
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
  // off the Drop: the file (and its picture); the project stays on the phone (".keep"), empty, for the next upload
  const kept = new Set();
  async function unDrop(o) {
    const folder = o.name.split('/')[0], file = o.name.slice(folder.length + 1);
    const r = await gcs(`${API}/${encodeURIComponent(o.name)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) throw new Error(`remove ${r.status}`);
    await gcs(`${API}/${encodeURIComponent(`${folder}/.thumbs/${file}.jpg`)}`, { method: 'DELETE' }).catch(() => {});
    if (!kept.has(folder)) {
      await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(`${folder}/.keep`)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '' }).catch(() => {});
      kept.add(folder);
    }
  }
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
    // already here (pulled before this rule, or its removal failed): just off the Drop. Else: down (a name here with
    // other bytes comes down as name-2), then off the Drop
    const todo = [];
    for (const o of items) {
      if (await same(o)) { try { await unDrop(o); } catch {} continue; }
      todo.push(fs.existsSync(local(o.name)) ? { ...o, as: freeName(o.name) } : o);
    }
    const folders = [...new Set(todo.map((o) => o.name.split('/')[0]))];
    for (const folder of folders) {  // one job per folder (the Jobs panel)
      const files = todo.filter((o) => o.name.split('/')[0] === folder), total = files.reduce((s, o) => s + o.size, 0), started = Date.now();
      state.running = { folder, i: 0, n: files.length, bytes: 0, total, started, file: '' };
      let ok = true, err = '';
      const seen = [];
      let off = 0;
      for (const o of files) {
        state.running.i++; state.running.file = (o.as || o.name).split('/').pop();
        try { await download(o); } catch (e) { ok = false; err = e.message; break; }
        const what = await probe(local(o.as || o.name));
        seen.push(`${state.running.file} ${gb(o.size)}${what ? ` ${what}` : ''}`);
        // here and whole (download checked the size; md5 when the cloud has one) - off the Drop
        if (!o.md5 || (await md5(local(o.as || o.name))) === o.md5) { try { await unDrop(o); off++; } catch {} }
        else { ok = false; err = `${state.running.file}: md5 differs - kept on the Drop`; break; }
      }
      recordJob({ id: folder, kind: 'drop', started, ended: Date.now(), ok, files: seen,
        line: ok ? `${files.length} file${files.length === 1 ? '' : 's'} · ${gb(total)} → Downloads\\drop\\${folder} · ${seen.join(' | ')}${off ? ` · ${off} removed from the Drop` : ''}` : `failed: ${err}` });
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
