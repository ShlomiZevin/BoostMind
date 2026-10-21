// Link previews (WhatsApp / Telegram / X / iMessage).
// 1. Renders web/og/home.jpg and web/og/<id>.jpg (1200x630) from scripts/og-template.html.
// 2. Writes web/<id>.html per queen: queen.html with her Open Graph tags baked in,
//    because link scrapers do not run JavaScript.
// Run after build-queens.mjs:  node scripts/og.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const SITE = 'https://veyra-queens.web.app';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const queens = JSON.parse(fs.readFileSync(path.join(root, 'data/queens.json'), 'utf8'));

// ---- images ----
const require = createRequire('C:/workspace/lybi/package.json'); // borrow an installed playwright
const { chromium } = require('playwright');
fs.mkdirSync(path.join(web, 'og'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const template = pathToFileURL(path.join(root, 'scripts/og-template.html')).href;
for (const id of ['home', ...queens.map(q => q.id)]) {
  await page.goto(id === 'home' ? template : `${template}?q=${id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(web, 'og', `${id}.jpg`), type: 'jpeg', quality: 86 });
  console.log(`og/${id}.jpg  ${(fs.statSync(path.join(web, 'og', `${id}.jpg`)).size / 1024).toFixed(0)} KB`);
}
await browser.close();

// ---- per-queen pages ----
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const meta = ({ title, description, url, image }) => `<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Veyra">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">`;

const tpl = fs.readFileSync(path.join(web, 'queen.html'), 'utf8');
for (const q of queens) {
  const html = tpl
    .replace('<title>Veyra</title>', `<title>${esc(q.name)} — Veyra</title>\n` + meta({
      title: `${q.name} — Veyra`,
      description: `${q.tagline} Chat with ${q.name} on Veyra.`,
      url: `${SITE}/${q.id}`,
      image: `${SITE}/og/${q.id}.jpg`,
    }) + `\n<script>window.QUEEN_ID = ${JSON.stringify(q.id)};</script>`)
    .replace('<!doctype html>', `<!doctype html>\n<!-- Generated from queen.html by scripts/og.mjs — do not edit by hand. -->`);
  fs.writeFileSync(path.join(web, `${q.id}.html`), html);
  console.log(`${q.id}.html`);
}
