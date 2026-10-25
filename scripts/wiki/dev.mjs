// Local preview of /wiki/ with a working chat: serves public/ and runs the same request as the wikiChat function.
//   node scripts/wiki/dev.mjs   ->  http://localhost:5180/wiki/
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const ENV = 'C:/workspace/aspect/aspect-agent-server/.env';
const KEY = process.env.WIKI_OPENAI_KEY || fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim().replace(/^"|"$/g, '');
const { _stream } = require(path.join(ROOT, 'techietech-api/wiki.js'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/wikiChat') {
    let body = '';
    for await (const c of req) body += c;
    const { mode, messages } = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    try {
      const u = await _stream(KEY, mode, messages.map((m) => ({ role: m.role, content: m.content })), (t) => res.write(t));
      console.log(mode, 'in', u.input_tokens, 'cached', u.input_tokens_details?.cached_tokens, 'out', u.output_tokens);
    } catch (e) { console.error(e.message); res.write('\n(error)'); }
    return res.end();
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, 'public', p);
  if (!file.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  const stat = fs.statSync(file), type = TYPES[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) {
    const start = +range[1], end = range[2] ? +range[2] : stat.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}).listen(5180, () => console.log('http://localhost:5180/wiki/'));
