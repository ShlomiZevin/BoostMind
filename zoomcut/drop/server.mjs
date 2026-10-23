// Drop - the iPhone's way into Sketch Studio. The page (index.html) uploads files at full quality straight into the
// bucket (resumable sessions, any size, picks up after a dropped connection) and is a browser of what is there:
// projects (folders), their files, rename, delete. This service checks the key and talks to Storage; no dependencies -
// its Google token comes from Cloud Run's metadata server. The studio on the PC pulls every file to
// Downloads\drop\<folder> within a minute and then removes it from here; a delete on the page leaves a marker
// (<folder>/.gone/<size>~<name>) so the studio deletes its copy too.
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
let saEmail = '';
async function email() {
  if (!saEmail) saEmail = await (await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', { headers: { 'Metadata-Flavor': 'Google' } })).text();
  return saEmail;
}
const rfc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
// a V4 signed URL for one object (valid an hour) - signed by this service's own account through the IAM signBlob API
async function signedUrl(object, disposition) {
  const who = await email();
  const iso = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');  // 20261022T091500Z
  const day = iso.slice(0, 8), scope = `${day}/auto/storage/goog4_request`;
  const path = `/${BUCKET}/${object.split('/').map(rfc).join('/')}`;
  const q = { 'X-Goog-Algorithm': 'GOOG4-RSA-SHA256', 'X-Goog-Credential': `${who}/${scope}`, 'X-Goog-Date': iso, 'X-Goog-Expires': '3600', 'X-Goog-SignedHeaders': 'host' };
  if (disposition) q['response-content-disposition'] = disposition;
  const qs = Object.keys(q).sort().map((k) => `${rfc(k)}=${rfc(q[k])}`).join('&');
  const canonical = ['GET', path, qs, 'host:storage.googleapis.com\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['GOOG4-RSA-SHA256', iso, scope, crypto.createHash('sha256').update(canonical).digest('hex')].join('\n');
  const r = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${who}:signBlob`, {
    method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: Buffer.from(toSign).toString('base64') }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `sign ${r.status}`);
  return `https://storage.googleapis.com${path}?${qs}&X-Goog-Signature=${Buffer.from(j.signedBlob, 'base64').toString('hex')}`;
}
const gcs = async (url, opts = {}) => fetch(url, { ...opts, headers: { Authorization: `Bearer ${await token()}`, ...(opts.headers || {}) } });
const keyOk = (k) => {
  const m = /[#?&]k=([^&#\s]+)/.exec(String(k || ''));  // (the whole Drop link pasted: its key)
  if (m) k = m[1];
  const a = Buffer.from(String(k || '')), b = Buffer.from(KEY);
  return KEY.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
// a folder / file name as it lands in the bucket and on the PC: letters (Hebrew too), digits, - _ . and spaces
const clean = (s, max = 120) => String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}\-_. ]+/gu, '-').replace(/^[-. ]+|[-. ]+$/g, '').slice(0, max);
const enc = encodeURIComponent;
const TYPES = { mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/x-m4v', heic: 'image/heic', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', m4a: 'audio/mp4', wav: 'audio/wav', mp3: 'audio/mpeg' };

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
      if (name.startsWith('.thumbs/')) { (fo.thumbs ||= new Set()).add(name.slice(8, -4)); continue; }  // (a file's picture)
      if (!name || name.split('/').some((x) => x.startsWith('.'))) continue;  // (".keep": a project made before its first file)
      fo.files.push({ name, size: +o.size, updated: o.updated, type: o.contentType || '' });
      fo.bytes += +o.size;
    }
    for (const fo of Object.values(folders)) { for (const x of fo.files) x.thumb = !!fo.thumbs?.has(x.name); delete fo.thumbs; }
    return { folders: Object.values(folders).sort((a, b) => (b.updated > a.updated ? 1 : -1)) };
  },
  async mkdir(b) {  // a new project: a placeholder so it shows before its first file
    const folder = clean(b.folder, 60);
    if (!folder) throw Object.assign(new Error('a name'), { code: 400 });
    await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${enc(`${folder}/.keep`)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '' });
    return { folder };
  },
  // a resumable upload session for one file. The page sends name + size; the iPhone Shortcut (originals straight from
  // Photos) sends only a name and the file's extension - no size, and a taken name gets -2, -3 here
  async session(b, req) {
    const folder = clean(b.folder, 60);
    const ext = clean(b.ext || '', 8).replace(/^\.+/, '');
    let name = clean(b.name) || 'video';
    if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) name += `.${ext}`;
    const size = Number(b.size);
    if (!folder) throw Object.assign(new Error('folder'), { code: 400 });
    if (b.unique) {  // (the Shortcut cannot see what is there)
      const [base, dot] = name.includes('.') ? [name.slice(0, name.lastIndexOf('.')), name.slice(name.lastIndexOf('.'))] : [name, ''];
      for (let k = 2; await exists(`${folder}/${name}`); k++) name = `${base}-${k}${dot}`;
    }
    const type = String(b.type || TYPES[ext.toLowerCase()] || 'application/octet-stream');
    const r = await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=resumable&name=${enc(`${folder}/${name}`)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': type, ...(size > 0 ? { 'X-Upload-Content-Length': String(size) } : {}),
        Origin: req.headers.origin || '' },  // (the session then answers the page's own origin - CORS)
      body: JSON.stringify({ name: `${folder}/${name}`, contentType: type }),
    });
    if (!r.ok) throw new Error(`storage ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { url: r.headers.get('location'), object: `${folder}/${name}`, name };
  },
  async rename(b) {
    const folder = clean(b.folder, 60), from = String(b.from || ''), to = clean(b.to);
    if (!folder || !from || !to) throw Object.assign(new Error('folder, from, to'), { code: 400 });
    if (from === to) return { name: to };
    if (await exists(`${folder}/${to}`)) throw Object.assign(new Error(`"${to}" is already there`), { code: 409 });
    await rename(`${folder}/${from}`, `${folder}/${to}`);
    if (await exists(`${folder}/.thumbs/${from}.jpg`)) await rename(`${folder}/.thumbs/${from}.jpg`, `${folder}/.thumbs/${to}.jpg`);  // (its picture too)
    return { name: to };
  },
  async delete(b) {
    const folder = clean(b.folder, 60), name = String(b.name || '');
    if (!folder || !name) throw Object.assign(new Error('folder, name'), { code: 400 });
    const m = await gcs(`${API}/${enc(`${folder}/${name}`)}?fields=size`);  // (gone already when the studio has it: the page's size)
    const size = m.ok ? +(await m.json()).size : Number(b.size) || 0;
    if (size > 0) await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${enc(`${folder}/.gone/${size}~${name}`)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '' });
    await gcs(`${API}/${enc(`${folder}/${name}`)}`, { method: 'DELETE' });
    await gcs(`${API}/${enc(`${folder}/.thumbs/${name}.jpg`)}`, { method: 'DELETE' });  // (its picture, if it has one)
    return { ok: true };
  },
  async thumb(b) {  // a file's small picture (a JPEG drawn by the page), kept beside it in .thumbs/
    const folder = clean(b.folder, 60), name = String(b.name || '');
    const data = Buffer.from(String(b.data || '').replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    if (!folder || !name || !data.length || data.length > 200000) throw Object.assign(new Error('folder, name, data'), { code: 400 });
    await gcs(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${enc(`${folder}/.thumbs/${name}.jpg`)}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: data });
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
    // a file from the bucket: ?k=key&f=folder/name[&dl=1 = save it] -> a signed link straight to it in storage (an
    // hour). Not through this service: Cloud Run cuts a response at 32 MB. Storage serves any size, Range included
    // (a video seeks, a big download resumes); the page draws thumbnails from it
    if (req.method === 'GET' && u.pathname === '/api/get') {
      if (!keyOk(u.searchParams.get('k'))) return send(res, 401, { error: 'key' });
      const f = String(u.searchParams.get('f') || '');
      if (!f || f.startsWith('_') || f.includes('..')) return send(res, 400, { error: 'f' });
      const url = await signedUrl(f, u.searchParams.get('dl') ? `attachment; filename*=UTF-8''${rfc(f.split('/').pop())}` : '');
      res.writeHead(302, { Location: url, 'Cache-Control': 'private, max-age=1800' });
      return res.end();
    }
    const route = req.method === 'POST' && u.pathname.startsWith('/api/') && routes[u.pathname.slice(5)];
    if (!route) return send(res, 404, { error: 'not found' });
    const b = await body(req);
    if (!keyOk(b.k)) return send(res, 401, { error: 'key' });
    send(res, 200, await route(b, req));
  } catch (e) {
    send(res, e.code || 500, { error: String(e.message || e) });
  }
}).listen(process.env.PORT || 8080);
