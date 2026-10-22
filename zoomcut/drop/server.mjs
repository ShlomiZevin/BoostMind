// Drop - the iPhone's way into Sketch Studio: the page (index.html) uploads videos at full quality straight into the
// bucket (resumable sessions, any size, picks up after a dropped connection); this service only checks the key and
// opens the upload sessions. No dependencies: its Google token comes from Cloud Run's metadata server.
// The studio on the PC pulls each new file down to Downloads\drop\<folder> and empties a folder when its project is Done.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BUCKET = process.env.BUCKET || 'boostmind-drop';
const KEY = process.env.DROP_KEY || '';
const PAGE = fs.readFileSync(new URL('./index.html', import.meta.url));

let tok = { value: '', until: 0 };
async function token() {  // the service account's access token (cached until shortly before it expires)
  if (tok.value && Date.now() < tok.until) return tok.value;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
  const j = await r.json();
  tok = { value: j.access_token, until: Date.now() + (j.expires_in - 120) * 1000 };
  return tok.value;
}
const keyOk = (k) => {
  const a = Buffer.from(String(k || '')), b = Buffer.from(KEY);
  return KEY.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
// a folder / file name as it lands in the bucket and on the PC: letters (Hebrew too), digits, - _ . and spaces
const clean = (s, max = 120) => String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}\-_. ]+/gu, '-').replace(/^[-. ]+|[-. ]+$/g, '').slice(0, max);

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};
const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } }); });

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'POST' && u.pathname === '/api/folders') {  // the folders already there (to add to one)
      const b = await body(req);
      if (!keyOk(b.k)) return send(res, 401, { error: 'key' });
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?delimiter=/&fields=prefixes`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await r.json();
      return send(res, 200, { folders: (j.prefixes || []).map((p) => p.replace(/\/$/, '')) });
    }
    if (req.method === 'POST' && u.pathname === '/api/session') {  // a resumable upload session for one file
      const b = await body(req);
      if (!keyOk(b.k)) return send(res, 401, { error: 'key' });
      const folder = clean(b.folder, 60), name = clean(b.name);
      const size = Number(b.size);
      if (!folder || !name || !(size > 0)) return send(res, 400, { error: 'folder, name, size' });
      const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=resumable&name=${encodeURIComponent(`${folder}/${name}`)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json',
          'X-Upload-Content-Type': String(b.type || 'application/octet-stream'), 'X-Upload-Content-Length': String(size),
          Origin: req.headers.origin || '' },  // (the session then answers the page's own origin - CORS)
        body: JSON.stringify({ name: `${folder}/${name}`, contentType: String(b.type || 'application/octet-stream') }),
      });
      if (!r.ok) return send(res, 502, { error: `storage ${r.status}: ${(await r.text()).slice(0, 200)}` });
      return send(res, 200, { url: r.headers.get('location'), object: `${folder}/${name}` });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(process.env.PORT || 8080);
