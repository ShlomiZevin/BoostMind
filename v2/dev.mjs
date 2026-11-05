// The Shlomiverse v2, locally: Firebase's emulators (sign-in, Firestore, functions, storage - project demo-shlomiverse,
// so nothing touches the live project) + the site on http://localhost:5050, where v2/site lies over public/.
//   node v2/dev.mjs            (Ctrl+C stops everything; local data is kept in v2/.emu between runs)
//   node v2/dev.mjs --site     (the site only, when the emulators already run)
// The OpenAI key is read from zoomcut/.env (his WIKI key) at start and handed to the emulator in memory.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SITE = path.join(HERE, 'site');
const PUBLIC = path.join(ROOT, 'public');
const PORT = 5050;
const FN = 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1';
const JAVA = path.join(process.env.USERPROFILE || 'C:/Users/shazbak', '.local', 'jre21');

const envKey = (file, name) => { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, ''); } catch { return undefined; } };

if (!process.argv.includes('--site')) {
  const key = envKey(path.join(ROOT, 'zoomcut', '.env'), 'OPENAI_API_KEY') || envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
  if (!key) console.log('! no OpenAI key found - character replies, moderation and stickers will fail');
  const env = { ...process.env, JAVA_HOME: JAVA, PATH: path.join(JAVA, 'bin') + path.delimiter + process.env.PATH, VERSE_OPENAI_KEY: key || '', WIKI_OPENAI_KEY: key || '' };
  const emu = spawn('firebase', ['emulators:start', '--project', 'demo-shlomiverse', '--import', './.emu', '--export-on-exit', './.emu'],
    { cwd: HERE, env, shell: true, stdio: 'inherit' });
  emu.on('exit', (code) => { console.log('emulators stopped', code); process.exit(code || 0); });
  const stop = () => { emu.kill('SIGINT'); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

// analytics stay local: the page's t.js is replaced by one that only logs
const T_STUB = `window.track = function (e, x) { console.debug('[track]', e, x || ''); };`;

function find(urlPath) {
  for (const base of [SITE, PUBLIC]) {
    let p = path.join(base, decodeURIComponent(urlPath));
    if (!p.startsWith(base)) return null;
    try {
      if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (fs.statSync(p).isFile()) return p;
    } catch {}
  }
  return null;
}

function proxy(req, res, fn) {
  const up = http.request(`${FN}/${fn}`, { method: req.method, headers: { ...req.headers, host: '127.0.0.1:5001' } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => { res.writeHead(502); res.end('functions emulator not running'); });
  req.pipe(up);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return proxy(req, res, url.pathname.slice(5) + url.search);
  if (url.pathname === '/t.js') { res.writeHead(200, { 'content-type': TYPES['.js'] }); return res.end(T_STUB); }
  if (url.pathname === '/') { res.writeHead(302, { location: '/wiki/' }); return res.end(); }
  // the verse's real addresses (/c/hani, /story/hani, /play/<game> - live they are versePage's) are the wiki page itself
  const file = find(url.pathname) || (!path.extname(url.pathname) ? find('/wiki/index.html') : null);
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const size = fs.statSync(file).size;
  const headers = { 'content-type': type, 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
  if (url.pathname === '/sw.js') headers['service-worker-allowed'] = '/';
  // videos seek with Range requests
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? +range[1] : size - +range[2];
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`\n  Shlomiverse v2 (local): http://localhost:${PORT}/wiki/   emulators UI: http://localhost:4000\n`));
