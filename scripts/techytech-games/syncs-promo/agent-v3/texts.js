// renders every caption to its own transparent PNG (txt/<id>.png), logo-style lettering
const { chromium } = require(require('os').homedir() + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path');
const T = [
  ['notsync', 'לא מסונכרנים?', 150, 'w'],
  ['presents', 'טקי-טק מציגה', 84, 'w'],
  ['syncs', 'Syncs', 210, 'o'],
  ['newapp', 'אפליקציית הפגישות החדשה', 70, 'w'],
  ['pick', 'בוחרים מי בפגישה', 100, 'w'],
  ['write', 'כותבים להנהלה', 104, 'w'],
  ['live', 'ההנהלה עונה בלייב', 100, 'w'],
  ['owner', 'אמיר מדבר Ownership', 92, 'w'],
  ['mute', 'גלעד משתיק את עופר', 96, 'w'],
  ['end', 'גלעד מסיים את הפגישה', 92, 'w'],
  ['recap', 'סיכום אוטומטי +', 104, 'w'],
  ['recap2', 'Action items', 96, 'o'],
  ['meet', 'בואו לפגוש את הצוות', 92, 'w'],
  ['now', 'עכשיו בשלומיוורס', 104, 'w'],
  ['punch', 'אמיר: מעולה. אז אנחנו מסונכרנים.', 46, 's'],
];
const css = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap');
html,body{margin:0;background:transparent}
.t{display:inline-block;font-family:Rubik;font-weight:900;line-height:1.1;padding:30px 40px;white-space:nowrap;position:relative}
.t span{position:relative;display:block}
.t .st{position:absolute;inset:0;-webkit-text-stroke:var(--sw) #1b0d05;color:#1b0d05;filter:drop-shadow(0 10px 14px rgba(0,0,0,.55))}
.w .fg{background:linear-gradient(180deg,#ffffff 0%,#fff6ea 45%,#ffd2a3 62%,#ffe9d2 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.o .fg{background:linear-gradient(180deg,#ffd29c 0%,#ff9a3d 40%,#fc7211 60%,#ff9b4a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.s{font-weight:700!important}
.s .fg{color:#fff}
`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 600 } });
  for (const [id, txt, size, kind] of T) {
    const sw = kind === 's' ? '8px' : Math.round(size * 0.16) + 'px';
    await p.setContent(`<style>${css}</style><div dir="rtl" class="t ${kind}" style="font-size:${size}px;--sw:${sw}"><div style="position:relative"><span class="st">${txt}</span><span class="fg">${txt}</span></div></div>`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    const el = await p.$('.t');
    await el.screenshot({ path: path.join(__dirname, 'txt', id + '.png'), omitBackground: true });
  }
  await b.close();
})();
