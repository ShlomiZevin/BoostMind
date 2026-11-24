// Render poster2.html's variants to 1080x1920 JPGs + one labelled options sheet per kind.
//   node render.mjs            -> out/story-A.jpg ... out/cover-C.jpg, out/story-A-verse.jpg ..., out/sheet-story.jpg, out/sheet-cover.jpg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const { default: puppeteer } = await import(pathToFileURL(path.join(root, 'zoomcut/render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href);
const chrome = path.join(root, 'zoomcut/render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const out = path.join(here, process.argv[3] || 'out2');
fs.mkdirSync(out, { recursive: true });
const ids = ['story-A', 'story-B', 'story-C', 'cover-A', 'cover-B', 'cover-C', 'story-A-verse', 'story-B-verse', 'story-C-verse'];
const b = await puppeteer.launch({ executablePath: chrome, args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920 });
const page = process.argv[2] || 'poster2.html';
const url = pathToFileURL(path.join(here, page)).href;
for (const id of ids) {
  await p.goto(url + '#' + id, { waitUntil: 'load' });
  await p.reload({ waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await p.screenshot({ path: path.join(out, id + '.jpg'), type: 'jpeg', quality: 92 });
}
// options sheets: A / B / C side by side, the big letter stamped on each, Instagram safe-zone lines dashed
const sheet = async (kind, file) => {
  const imgs = ['A', 'B', 'C'].map((k) => pathToFileURL(path.join(out, `${kind}-${k}.jpg`)).href);
  await p.setViewport({ width: 3*540 + 4*30, height: 960 + 150 });
  await p.setContent(`<body style="margin:0;background:#fff;font-family:Arial;display:flex;gap:30px;padding:30px;box-sizing:border-box">${imgs.map((u, i) =>
    `<div><div style="font:900 70px Arial;height:90px">${'ABC'[i]}</div><img src="${u}" style="width:540px;height:960px;display:block;box-shadow:0 0 0 1px #ccc"></div>`).join('')}</body>`, { waitUntil: 'load' });
  await p.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 88 });
  await p.setViewport({ width: 1080, height: 1920 });
};
await sheet('story', 'sheet-story.jpg');
await sheet('cover', 'sheet-cover.jpg');
await b.close();
console.log('done', out);
