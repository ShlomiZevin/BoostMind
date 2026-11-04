// Every character's automatic reply (techietech-api/replies.json) as HTML files, with --send=<address> mailed there.
//   NODE_PATH=<techietech-api node_modules> node scripts/email/replies.mjs --out=<dir> [--wiki=<wiki.json>] [--send=<address>] [--only=techietech,ayelet]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const { replyMail } = require('../../techietech-api/mailer.js');
const { render } = require('../../techietech-api/mail.js');
const replies = require('../../techietech-api/replies.json');
const w = arg('wiki') ? JSON.parse(fs.readFileSync(arg('wiki'), 'utf8'))
  : await (await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json')).json();
const out = arg('out') || 'out';
const only = arg('only')?.split(',');
// a believable sender for each form
const SAMPLE = { techietech: { choice: 'מפתח/ת Backend' }, ayelet: { choice: 'טיפול אישי' }, hindsight: { choice: 'מסלול VIP' },
  demokratovich: { choice: 'שאלה לרב: מותר להצביע פעמיים?' }, dorit: { choice: 'מפת לידה' }, 'ofnat-hani': { choice: 'מטפחת קשירה' },
  'avi-balloons': { choice: 'חבילת בלי הליום' }, yotamverse: { choice: 'חולצת GEEK, ללמוד עם יותם', order: '4821' } };

fs.mkdirSync(out, { recursive: true });
let send;
if (arg('send')) {
  const t = require('nodemailer').createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  send = (m, from) => t.sendMail({ from: `${from} <${process.env.GMAIL_USER}>`, to: arg('send'), subject: m.subject, html: m.html, text: m.text });
}
for (const key of Object.keys(replies)) {
  if (only && !only.includes(key)) continue;
  const x = replyMail(key, { name: 'דנה כהן', ...(SAMPLE[key] || {}) }, w);
  const m = render('reply', x.d);
  fs.writeFileSync(path.join(out, `reply-${key}.html`), m.html);
  if (send) { await send(m, x.r.fromName); console.log('sent', key); } else console.log('wrote', key, '-', m.subject);
}
