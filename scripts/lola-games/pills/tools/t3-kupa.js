// t3: the kupat holim layer - hold music starts on the first touch and loops, the menu voice speaks and ducks it,
// the end screen says why the call ended, the tutorial counts down as a queue. Screenshots at 320x568 + 390x844.
const path = require('path');
const { chromium } = require(path.join(process.env.HOME || process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const BASE = process.argv[2] || 'http://localhost:8765/lola-games/pills/?solo=1&notrack=1';
const OUT = path.join(__dirname, '..', 'shots', 'kupa'); require('fs').mkdirSync(OUT, { recursive: true });
const fail = []; const ok = (c, m, x = '') => { console.log(c ? 'ok  ' : 'FAIL', m, x); if (!c) fail.push(m); };

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const tag = w + 'x' + h;
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('requestfailed', (r) => errs.push('404 ' + r.url()));
    await p.goto(BASE); await p.waitForTimeout(800);
    const q1 = await p.textContent('#qLine'); await p.waitForTimeout(4200); const q2 = await p.textContent('#qLine');
    ok(/מקומך בתור/.test(q1) && q1 !== q2, tag + ' queue line counts down', q1 + ' -> ' + q2);
    await p.screenshot({ path: `${OUT}/${tag}-start.png` });
    await p.mouse.click(5, h - 5); await p.waitForTimeout(2500);  // first touch somewhere empty
    const a = await p.evaluate(() => ({ music: !!PILLS.hold.src && PILLS.hold.src.loop, len: PILLS.hold.buf && PILLS.hold.buf.duration, vo: PILLS.hold.last, speaking: !!PILLS.hold.vo, gain: PILLS.hold.gain && PILLS.hold.gain.gain.value, nvo: Object.keys(PILLS.audio.buf).filter((k) => k.startsWith('vo-')).length }));
    ok(a.music && a.len > 30, tag + ' hold music loops', JSON.stringify(a));
    ok(a.vo === 'hello' && a.nvo === 10, tag + ' the line opens with "hello", all 10 menu lines loaded');
    ok(a.speaking ? a.gain < .1 : true, tag + ' music ducks under the voice');
    await p.waitForTimeout(3000);
    ok(await p.evaluate(() => !PILLS.hold.vo && PILLS.hold.gain.gain.value > .12), tag + ' music back up after the voice');
    // tutorial: queue countdown + "press 1"
    await p.click('.mode[data-mode=box] .how'); await p.waitForTimeout(600);
    ok(/מקומך בתור: \d/.test(await p.textContent('#tutN')), tag + ' tutorial counts down as a queue', await p.textContent('#tutN'));
    await p.screenshot({ path: `${OUT}/${tag}-tut.png` });
    await p.keyboard.press('1'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => PILLS.G.tut && PILLS.G.tut.i === 1), tag + ' key 1 = next');
    await p.keyboard.press('#'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !PILLS.G.tut && PILLS.G.mode === 'box'), tag + ' # = skip');
    // end screen
    await p.evaluate(() => PILLS.endGame('box')); await p.waitForTimeout(1600);
    ok(/אין תורים פנויים/.test(await p.textContent('#endTitle')), tag + ' box end = no free appointments');
    ok(['busy', 'bye'].includes(await p.evaluate(() => PILLS.hold.last)), tag + ' end screen voice');
    ok(/חיוג חוזר/.test(await p.textContent('#bAgain')) && /לתפריט הראשי/.test(await p.textContent('#bMenu')), tag + ' end buttons in kupa words');
    await p.screenshot({ path: `${OUT}/${tag}-end.png` });
    // tray: the prescription
    await p.click('#bMenu'); await p.evaluate(() => localStorage.setItem('shlomiverse:pills:tut-tray', '1'));
    await p.keyboard.press('3'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => PILLS.G.mode === 'tray' && /המרשם של סבתא/.test(document.querySelector('#ticket').textContent)), tag + ' key 3 opens the tray, ticket = prescription');
    await p.screenshot({ path: `${OUT}/${tag}-tray.png` });
    await p.evaluate(() => PILLS.endGame('tray')); await p.waitForTimeout(400);
    ok(/השיחה נותקה/.test(await p.textContent('#endTitle')), tag + ' tray end = the call dropped');
    ok(!errs.length, tag + ' no errors', errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(fail.length ? fail.length + ' FAILED' : 'ALL OK'); process.exit(fail.length ? 1 : 0);
})();
