// Screenshot the site for review. Usage: node scripts/shots.mjs  (expects a server on :5055)
import { createRequire } from 'node:module';
const require = createRequire('C:/workspace/lybi/package.json');
const { chromium } = require('playwright');
const base = 'http://localhost:5055';
const out = new URL('../design/shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'chrome' });
const pages = [['home', '/index.html'], ['queen', '/queen.html?q=sabine'], ['chat', '/chat.html?q=mina']];
for (const [vw, vh, tag] of [[1440, 900, 'desk'], [390, 844, 'mobile']]) {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
    await ctx.addInitScript(t => { localStorage.setItem('veyra.adult', 'true'); localStorage.setItem('veyra.theme', JSON.stringify(t)); }, theme);
    const p = await ctx.newPage();
    for (const [name, path] of pages) {
      await p.goto(base + path); await p.waitForTimeout(700);
      if (name === 'chat') { await p.fill('#input', 'Hello Mina'); await p.press('#input', 'Enter'); await p.waitForTimeout(2600); }
      await p.screenshot({ path: `${out}${name}-${tag}-${theme}.png`, fullPage: name !== 'chat' });
    }
    await ctx.close();
  }
}
// age gate + tribute sheet
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(base + '/index.html'); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}agegate.png` });
await p.click('[data-enter]'); await p.goto(base + '/queen.html?q=anna'); await p.waitForTimeout(500);
await p.click('.tribute button >> nth=2'); await p.waitForTimeout(300);
await p.screenshot({ path: `${out}tribute-sheet.png` });
await browser.close();
console.log('done');
