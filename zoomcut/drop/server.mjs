// Drop - the iPhone's way into Sketch Studio. The page (index.html) uploads files at full quality straight into the
// bucket (resumable sessions, any size, picks up after a dropped connection) and is a browser of what is there:
// projects (folders), their files, rename, delete. This service checks the key and talks to Storage; no dependencies -
// its Google token comes from Cloud Run's metadata server. The studio on the PC mirrors every folder to
// Downloads\drop\<folder> (renames and deletes too) and empties a folder when its project is marked Done.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BUCKET = process.env.BUCKET || 'boostmind-drop';
const KEY = process.env.DROP_KEY || '';
const PAGE = fs.readFileSync(new URL('./index.html', import.meta.url));
const API = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;

let tok = { value: '', until: 0 };
async function token() {  // the service account's access token (cached until shortly before it expires)
  if (tok.value && Date.now() < tok.until) return tok.value;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
  const j = await r.json();
  tok = { value: j.access_token, until: Date.now() + (j.expires_in - 120) * 1000 };
  return tok.value;
}
const gcs = async (url, opts = {}) => fetch(url, { ...opts, headers: { Authorization: `Bearer ${await token()}`, ...(opts.headers || {}) } });
const keyOk = (k) => {
  const a = Buffer.from(String(k || '')), b = Buffer.from(KEY);
  return KEY.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
// a folder / file name as it lands in the bucket and on the PC: letters (Hebrew too), digits, - _ . and spaces
const clean = (s, max = 120) => String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}\-_. ]+/gu, '-').replace(/^[-. ]+|[-. ]+$/g, '').slice(0, max);
const enc = encodeURIComponent;

async function listAll(prefix = '') {
  const items = [];
  let page = '';
  do {
    const r = await gcs(`${API}?prefix=${enc(prefix)}&fields=items(name,size,updated,contentType),nextPageToken${page ? `&pageToken=${page}` : ''}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `storage ${r.status}`);
    items.push(...(j.items || []));
    page = j.nextPageToken || '';
  } while (page);
  return items;
}
async function exists(name) { return (await gcs(`${API}/${enc(name)}?fields=name`)).ok; }
async function rename(from, to) {  // copy (rewrite - big files take several calls) then delete the old one
  let rt = '';
  do {
    const r = await gcs(`${API}/${enc(from)}/rewriteTo/b/${BUCKET}/o/${enc(to)}${rt ? `?rewriteToken=${enc(rt)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `storage ${r.status}`);
    rt = j.done ? '' : j.rewriteToken;
  } while (rt);
  await gcs(`${API}/${enc(from)}`, { method: 'DELETE' });
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};
const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } }); });

const routes = {
  // every project (folder) with its files - the browser (a "_name" folder is a test, not his)
  async list() {
    const folders = {};
    for (const o of await listAll()) {
      const [f, ...rest] = o.name.split('/');
      if (!f || f.startsWith('_')) continue;
      const fo = (folders[f] ||= { name: f, files: [], bytes: 0, updated: '' });
      const name = rest.join('/');
      if (o.updated > fo.updated) fo.updated = o.updated;
      if (!name || name.startsWith('.')) continue;  // (".keep": a project made before its first file)
      fo.files.push({ name, size: +o.size, updated: o.updated, type: o.contentType || '' });
      fo.bytes += +o.size;
    }
    return { folders: Object.values(folders).sort((a, b) => (b.updated > a.updated ? 1 : -1)) };
  },
  async mkdir(b) {  // a new project: a placeholder so it shows before its first file
    const folder = clean(b.folder, 60);
    if (!folder) throw Object.assign(new Error('a name'), { code: 400 });
    await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${enc(`${folder}/.keep`)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '' });
    return { folder };
  },
  async session(b, req) {  // a resumable upload session for one file
    const folder = clean(b.folder, 60), name = clean(b.name);
    const size = Number(b.size);
    if (!folder || !name || !(size > 0)) throw Object.assign(new Error('folder, name, size'), { code: 400 });
    const r = await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=resumable&name=${enc(`${folder}/${name}`)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': String(b.type || 'application/octet-stream'), 'X-Upload-Content-Length': String(size),
        Origin: req.headers.origin || '' },  // (the session then answers the page's own origin - CORS)
      body: JSON.stringify({ name: `${folder}/${name}`, contentType: String(b.type || 'application/octet-stream') }),
    });
    if (!r.ok) throw new Error(`storage ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { url: r.headers.get('location'), object: `${folder}/${name}` };
  },
  async rename(b) {
    const folder = clean(b.folder, 60), from = String(b.from || ''), to = clean(b.to);
    if (!folder || !from || !to) throw Object.assign(new Error('folder, from, to'), { code: 400 });
    if (from === to) return { name: to };
    if (await exists(`${folder}/${to}`)) throw Object.assign(new Error(`"${to}" is already there`), { code: 409 });
    await rename(`${folder}/${from}`, `${folder}/${to}`);
    return { name: to };
  },
  async delete(b) {
    const folder = clean(b.folder, 60), name = String(b.name || '');
    if (!folder || !name) throw Object.assign(new Error('folder, name'), { code: 400 });
    await gcs(`${API}/${enc(`${folder}/${name}`)}`, { method: 'DELETE' });
    return { ok: true };
  },
  async rmdir(b) {  // a whole project
    const folder = clean(b.folder, 60);
    if (!folder) throw Object.assign(new Error('folder'), { code: 400 });
    const objs = await listAll(`${folder}/`);
    for (const o of objs) await gcs(`${API}/${enc(o.name)}`, { method: 'DELETE' });
    return { removed: objs.length };
  },
};

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) return send(res, 200, PAGE, 'text/html; charset=utf-8');
    const route = req.method === 'POST' && u.pathname.startsWith('/api/') && routes[u.pathname.slice(5)];
    if (!route) return send(res, 404, { error: 'not found' });
    const b = await body(req);
    if (!keyOk(b.k)) return send(res, 401, { error: 'key' });
    send(res, 200, await route(b, req));
  } catch (e) {
    send(res, e.code || 500, { error: String(e.message || e) });
  }
}).listen(process.env.PORT || 8080);
