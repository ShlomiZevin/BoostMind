// local test server: /sagi-games/scooter-snake/* from public/sagi-games/scooter-snake/, everything else from BoostMind/public (t.js, /verse/)
// node serve.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const BUILD = path.join(__dirname, '../../../../public/sagi-games/scooter-snake'), PUB = path.join(__dirname, '../../../../public');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const port = +process.argv[2] || 8765;
http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  const pre = '/sagi-games/scooter-snake/';
  let f = u.startsWith(pre) ? path.join(BUILD, u.slice(pre.length)) : path.join(PUB, u);
  if (u === '/verse/game-frame.js') f = path.join(PUB, '../v2/site/verse/game-frame.js');
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end('404'); }
  s.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(s);
}).listen(port, () => console.log('http://localhost:' + port + '/sagi-games/scooter-snake/?solo=1'));
