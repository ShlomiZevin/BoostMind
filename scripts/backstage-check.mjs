// Phone screenshots of Backstage (a preview channel or live) for the lead's own look before a release.
//   node scripts/backstage-check.mjs <base url ending in /backstage/> <out dir>
// Writes are blocked (only read ops reach the server). The owner key is found by scripts/owner-key.mjs - never printed.
import { createRequire } from 'node:module';
import { ownerKey } from './owner-key.mjs';
const require = createRequire(import.meta.url);
const { webkit } = require('C:/workspace/xplace-auto-bidder/node_modules/playwright');
const [base, out] = process.argv.slice(2);
const READ = /"op":"(pulse|list|charList|plans|plan|planFiles|chats|people|requests|ideas|content|videos|stats|events|visits|mail\w*List|mailState|costs|tzState|seenGet)"/;
const b = await webkit.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.route('**/verseOwner**', (r) => { const body = r.request().postData() || ''; if (/"op":"seen"/.test(body) || (!READ.test(body) && /"op":/.test(body) && !/"op":"(pulse)"/.test(body))) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); return r.continue(); });
await p.goto(base + '#k=' + ownerKey(), { waitUntil: 'load' });
await p.waitForTimeout(6000);
await p.screenshot({ path: out + '/bs-overview.png' });
for (const tab of ['chats', 'people']) {
  await p.evaluate((t) => { location.hash = t; }, tab).catch(() => {});
  const btn = p.locator('text=' + (tab === 'chats' ? 'שיחות' : 'אנשים')).last();
  await btn.click({ timeout: 5000 }).catch((e) => console.log('tap failed', tab, e.message.slice(0, 80)));
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${out}/bs-${tab}.png` });
}
console.log('errors', errs.slice(0, 5), 'sideways', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
await b.close();
