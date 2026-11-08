// ציפציפ + ח24's pages, seen as a phone sees them: the emulators (Firestore + the functions) with one real engine run, a static
// server for public/ (with the sites' address rewrites), and screenshots of the timeline, a thread, a resident, ח24's front
// page and an article - into TZ_SHOTS (default ./tz-shots). Costs one engine run (~3-5 cents, the design key).
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only firestore,functions "node ../techietech-api/test/tz-pages.emu.mjs"
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-shlomiverse';
if (!process.env.VERSE_OPENAI_KEY) {
  const env = fs.readFileSync(new URL('../../scripts/design.env', import.meta.url), 'utf8');
  process.env.VERSE_OPENAI_KEY = /OPENAI_API_KEY=(.+)/.exec(env)[1].trim().replace(/^["']|["']$/g, '');
}
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const tz = require('../tz.js');
const db = admin.firestore();
const PUB = path.resolve(new URL('../../public', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = process.env.TZ_SHOTS || 'tz-shots';
fs.mkdirSync(SHOTS, { recursive: true });

// one run, everything live and already in the past (so the pages show it all)
await db.collection('verseMeta').doc('tz').set({ open: true, img: false, auto: true, silent: null });
// TZ_FIXTURE = a JSON of real posts / articles (exported from the live site) - shown as they are, no engine run, no AI cost
let r;
if (process.env.TZ_FIXTURE) {
  const F = JSON.parse(fs.readFileSync(process.env.TZ_FIXTURE, 'utf8'));
  const back = (o) => JSON.parse(JSON.stringify(o), (k, v) => (v && v.__t !== undefined ? admin.firestore.Timestamp.fromMillis(v.__t) : v));
  for (const p of F.posts) await db.collection('tzPosts').doc(p.id).set(back(p));
  for (const a of F.arts) await db.collection('tzArticles').doc(a.id).set(back(a));
  r = { made: F.posts.length, run: F.posts[0] && F.posts[0].run };
} else r = await tz._run('morning');
console.log('run', JSON.stringify(r));
if (!r.made) { console.log('nothing to show (a bad day?)'); process.exit(0); }
const posts = (await db.collection('tzPosts').where('run', '==', r.run).get()).docs;
const now = Date.now();
await Promise.all(posts.map((d, i) => d.ref.update({ t: admin.firestore.Timestamp.fromMillis(now - (posts.length - i) * 7 * 60e3), stamps: Math.floor(Math.random() * 300), replies: d.data().replies })));
const arts = (await db.collection('tzArticles').where('run', '==', r.run).get()).docs;
await Promise.all(arts.map((d) => d.ref.update({ t: admin.firestore.Timestamp.fromMillis(now - 3600e3) })));

// public/ with the two sites' rewrites
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const site of ['tziftzif', 'charadot']) if (p.startsWith(`/${site}/`) && !path.extname(p)) p = `/${site}/index.html`;
  if (p === '/tziftzif' || p === '/charadot') p += '/index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(5077);

const puppeteer = require('../../zoomcut/render/node_modules/puppeteer-core');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
const shot = async (url, name, w = 390, h = 844, full = true, bottom = false) => {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5077' + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((ok) => setTimeout(ok, 4500));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (wide) console.log('SIDEWAYS SCROLL on', url);
  if (bottom) await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  if (bottom) await new Promise((ok) => setTimeout(ok, 600));
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: full });
  console.log('ok ', name);
};
const top = posts.map((d) => d.data()).find((p) => !p.parent && p.by !== 'charadot') || posts[0].data();
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('ck-seen', '1'); } catch (e) {} });   // no cookie notice over the screenshots
await shot('/tziftzif', 'tz-0-top', 390, 844, false);
await shot('/tziftzif', 'tz-0-bottom', 390, 844, false, true);
await shot('/tziftzif', 'tz-1-timeline');
await shot('/tziftzif/p/' + top.root, 'tz-2-thread');
await shot('/tziftzif/u/' + top.by, 'tz-3-resident');
await shot('/tziftzif/people', 'tz-4-people', 390, 844, false);
if (arts[0]) await shot('/tziftzif/a/' + arts[0].id, 'tz-5-article');
await shot('/charadot', 'ch-1-front');
if (arts[0]) await shot('/charadot/a/' + arts[0].id, 'ch-2-article');
await shot('/charadot', 'ch-3-front-desktop', 1280, 900, false);
await browser.close();
server.close();
process.exit(0);
