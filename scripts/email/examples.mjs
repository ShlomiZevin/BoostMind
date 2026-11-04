// Example mails from the verse's real content: writes each one to an HTML file to look at, and with --send=<address>
// mails them there (Gmail, the GMAIL_USER / GMAIL_APP_PASSWORD secrets taken from the environment).
//   node scripts/email/examples.mjs [--out=<dir>] [--send=<address>] [--only=game,story]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { render } = require('../../techietech-api/mail.js');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const out = arg('out') || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'out');
const only = arg('only')?.split(',');

const MEDIA = 'https://storage.googleapis.com/shlomiverse-media/wiki';
const face = (id) => `${MEDIA}/img/c/${id}.jpg`;
const who = (id, name) => ({ name, img: face(id), href: `/c/${id}` });
const poster = (id) => `${MEDIA}/v/${id}.jpg`;
const G = 'https://shlomiverse.com';

const MAILS = {
  game: {
    subject: 'משחק חדש: פקי-טק 🏃‍♂️💻',
    preheader: 'יותם רץ בקומה של טקי-טק ואוסף קונטקסט. כולם רודפים אחריו עם בקשות.',
    title: 'פקי-טק', url: '/yotam-games/pacman/', hero: `${G}/yotam-games/pacman/assets/hero.jpg`,
    tagline: 'יותם רץ בקומות של טקי-טק עם הלפטופ ואוסף קונטקסט. ארז, אסנת ויניב רודפים אחריו עם בקשות – ורק שחני לא תעצור אותו שוב.',
    points: [['☕', 'קפה מכניס את יותם ל<b style="color:#fff">מצב הסבר</b> – כולם נתקעים בטעינה ובורחים ממנו.'],
      ['📅', 'אספו <b style="color:#fff">זימון לחדר</b> ותיכנסו לישיבה: 6 שניות שאף אחד לא יכול להגיע אליכם.'],
      ['🛗', 'שלוש קומות – משרדים, קוביות, מטבח – ובין לבין נסיעה במעלית עם עידו.'],
      ['🏆', 'שיא יומי – כולם משחקים את אותו לוח היום.']],
    cast: [who('yotam', 'יותם'), who('hani', 'חני'), who('erez', 'ארז'), who('osnat', 'אסנת'), who('yaniv', 'יניב')],
    more: [{ title: 'מילימטרים', text: 'פיזיותרפיה ליניב. עוד מילימטר והוא צועק.', img: `${G}/yaniv-games/millimeters/cover.jpg`, href: '/yaniv-games/millimeters/' },
      { title: 'מה אני אגיד לך?', text: 'תנו לאסף עם העיתון לפני שהוא הורס לכם.', img: `${G}/asaf-games/sofa/cover.jpg`, href: '/asaf-games/sofa/' }],
  },
  story: {
    subject: 'יותם העלה סטורי חדש',
    preheader: 'משחק חדש – פקי-טק! כמה קונטקסט תאספו?',
    name: 'יותם', face: face('yotam'), img: 'https://storage.googleapis.com/shlomiverse-media/verse/stories/8qPvVELke1k2hRzd6s6M.jpg',
    href: '/story/yotam', page: '/c/yotam', link: '/yotam-games/pacman/', cta: 'לשחק בפקי-טק',
    text: 'משחק חדש – פקי-טק! יותם רץ בקומה של טקי-טק עם הלפטופ ואוסף קונטקסט, ארז, אסנת ויניב רודפים אחריו עם בקשות, קפה מכניס אותו למצב הסבר – ורק שחני לא תעצור אותו שוב. כמה קונטקסט תאספו?',
  },
  video: {
    subject: 'סרטון חדש: חני ויותם בחדר הישיבות',
    preheader: 'ישיבה אחת בטקי-טק, וחני מגיעה עם מה שצריך להגיד לפני שמתחילים.',
    title: 'חני ויותם בחדר הישיבות', href: '/v/haredit-4', poster: poster('haredit-4'),
    teaser: 'ישיבה אחת בטקי-טק, וחני מגיעה עם מה שצריך להגיד לפני שמתחילים.',
    more: [{ title: 'אסף עולה לביקור', img: poster('asaf-1'), href: '/v/asaf-1' }, { title: 'הדינוזאור', img: poster('tzvika-1'), href: '/v/tzvika-1' }, { title: 'חני מילון', img: poster('hani-milon'), href: '/v/hani-milon' }],
  },
  digest: {
    subject: 'השבוע בשלומיוורס: 3 משחקים חדשים ויותם בורח מבקשות',
    preheader: 'פקי-טק, מילימטרים, מה אני אגיד לך? – וכל הסרטונים החדשים.',
    week: 'השבוע בשלומיוורס · 4 בנובמבר', title: 'שבוע של משחקים',
    intro: 'שלוש דמויות קיבלו השבוע משחק משלהן. הנה כל מה שחדש ביקום.',
    lead: { title: 'פקי-טק', text: 'פקמן בטקי-טק: יותם אוסף קונטקסט, כולם רודפים אחריו עם בקשות – ורק שחני לא תעצור אותו שוב.',
      img: `${G}/yotam-games/pacman/assets/hero.jpg`, href: '/yotam-games/pacman/', cta: 'לשחק עכשיו' },
    games: [{ tag: 'משחק חדש', title: 'מילימטרים', text: 'כמה טיפולים יניב ישרוד?', img: `${G}/yaniv-games/millimeters/cover.jpg`, href: '/yaniv-games/millimeters/' },
      { tag: 'משחק חדש', title: 'מה אני אגיד לך?', text: 'אסף הורס כל בשורה טובה.', img: `${G}/asaf-games/sofa/cover.jpg`, href: '/asaf-games/sofa/' }],
    videos: [{ tag: 'סרטון', title: 'חני ויותם בחדר הישיבות', img: poster('haredit-4'), href: '/v/haredit-4' },
      { tag: 'סרטון', title: 'אסף עולה לביקור', img: poster('asaf-1'), href: '/v/asaf-1' },
      { tag: 'סרטון', title: 'הדינוזאור', img: poster('tzvika-1'), href: '/v/tzvika-1' },
      { tag: 'סרטון', title: 'חני מילון', img: poster('hani-milon'), href: '/v/hani-milon' }],
    faces: [who('yotam', 'יותם'), who('asaf', 'אסף'), who('yaniv', 'יניב'), who('hani', 'חני')],
  },
  welcome: {
    subject: 'ברוכים הבאים לשלומיוורס 🪐',
    preheader: 'כל הדמויות. כל הסרטונים. ואפשר לדבר עם כולן.',
    name: 'שלומי', hero: `${G}/verse/og.jpg`,
    cast: [who('hani', 'חני'), who('tzvika', 'צביקה'), who('rosenblum', 'רוזנבלום'), who('ayelet', 'איילת'), who('yaniv', 'יניב')],
  },
};

fs.mkdirSync(out, { recursive: true });
const to = arg('send');
let send;
if (to) {
  const nodemailer = require(process.env.NODEMAILER || 'nodemailer');
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  send = (m) => t.sendMail({ from: `השלומיוורס <${process.env.GMAIL_USER}>`, to, subject: m.subject, html: m.html, text: m.text, headers: m.headers });
}
for (const [kind, d] of Object.entries(MAILS)) {
  if (only && !only.includes(kind)) continue;
  const m = render(kind, d);
  fs.writeFileSync(path.join(out, `${kind}.html`), m.html);
  if (send) { await send(m); console.log('sent', kind, '->', to); } else console.log('wrote', path.join(out, `${kind}.html`));
}
