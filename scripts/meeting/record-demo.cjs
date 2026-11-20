// Records the Syncs demo (/syncs?demo=1 - his ask 2026-11-20: watch a whole meeting on the phone): drives one real meeting through
// the real page (?rec=1 keeps every event the server streamed, with when it came) and writes v2/site/verse/syncs-demo.json.
//   node scripts/meeting/record-demo.cjs <base url> <account.json>
// base url: the local emulators (node v2/dev.mjs -> http://localhost:5050) - the meeting runs on the functions emulator with the
// design keys; account.json: {email, pw} of an owner account in the auth emulator (never a real password). Costs one meeting (~$0.2).
// The visitor's lines are below; the room: everyone (Daniel, Gilad and Yaniv in it - his cut, the boss, the one who drops off).
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT || 'C:/workspace/xplace-auto-bidder/node_modules/playwright');
const [BASE = 'http://localhost:5050', ACC] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(ACC, 'utf8'));
const OUT = path.join(__dirname, '..', '..', 'v2', 'site', 'verse', 'syncs-demo.json');
const ROOM = ['ofer', 'daniel', 'gilad', 'yaniv'];
const LINES = [
  'היי לכולם. אני רוצה להציע לכם מערכת AI שמסכמת ישיבות ומחלקת משימות לבד.',
  'דניאל, אתה יכול להסביר איך זה יתחבר למערכות שלכם?',
  'יניב, זה עובר אצלך מבחינת אבטחת מידע?',
  'יניב? אתה עדיין פה? צריך את האישור שלך',
  'טוב, תודה לכולם. נדבר בהמשך',
  'ביי',
];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'he-IL' })).newPage();
  page.on('pageerror', (e) => log('page error', e.message));
  await page.goto(BASE + '/syncs');
  await page.waitForSelector('.eov, .mt-pk', { timeout: 40000 });
  await page.evaluate(async ({ e, p }) => { const m = await import('/verse/fb.js'); await m.A.signInWithEmailAndPassword(m.auth, e, p); }, { e: A.email, p: A.pw });
  await page.waitForTimeout(1500);
  await page.goto(BASE + '/syncs?rec=1');
  await page.waitForSelector('.mt-pk', { timeout: 40000 });
  for (const id of ROOM) await page.click(`.mt-pk-row:has(input[value="${id}"])`);
  await page.click('#mt-go');
  const floor = () => page.waitForFunction(() => { const i = document.querySelector('#mt-in'); return !i || /תורכם/.test(i.placeholder) || document.querySelector('.mt.done'); }, null, { timeout: 300000, polling: 300 });
  for (let i = 0; i < LINES.length; i++) {
    await floor();
    if (await page.$('.mt.done')) break;
    log('visitor', i + 1);
    await page.fill('#mt-in', LINES[i]);
    await page.click('#mt-send');
    if (i === 1) {   // the raised hand: type the next line while a resident still talks
      const ok = await page.waitForSelector('.mt-row.now:not(.me)', { timeout: 120000 }).then(() => true).catch(() => false);
      if (ok && !(await page.$('.mt.done'))) { await page.waitForTimeout(800); await page.fill('#mt-in', LINES[++i]); await page.dispatchEvent('#mt-in', 'input'); await page.waitForTimeout(500); await page.click('#mt-send'); log('hand + visitor', i + 1); }
    }
  }
  await page.waitForSelector('.mt.done', { timeout: 300000 });
  await page.waitForSelector('.mt-recap:not(.wait)', { timeout: 120000 });
  await page.waitForTimeout(1000);
  const rec = await page.evaluate(async () => (await import('/verse/meeting.js')).takeRec());
  fs.writeFileSync(OUT, JSON.stringify(rec));
  const kinds = rec.events.reduce((a, x) => ((a[x.e.t] = (a[x.e.t] || 0) + 1), a), {});
  log('wrote', OUT, Math.round(rec.ms / 1000) + 's', JSON.stringify(kinds));
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
