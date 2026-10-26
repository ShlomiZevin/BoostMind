// Techy-Tech careers: the "send your CV" form on /techietech/ posts here (multipart), and the CV is emailed to Shlomi.
// siteLead (below): the other characters' sites - a booking / a membership request, emailed the same way.
// (techietechApply:)
// as an attachment. Nothing is stored. Deploy from this folder: firebase deploy --only functions
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Busboy = require('busboy');
const nodemailer = require('nodemailer');

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const TO = 'shlomi@boostart.io';
const MAX_FILE = 5 * 1024 * 1024;
const OK_FILE = /\.(pdf|docx?)$/i;

// a few sends per address per hour, per instance - enough to stop a script hammering the form
const recent = new Map();
const tooMany = (ip) => {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
};

function parse(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null, tooBig = false;
    // utf8 file names: browsers send a Hebrew name ("קורות חיים.pdf") as raw UTF-8, busboy's default reads latin1
    const bb = Busboy({ headers: req.headers, defCharset: 'utf8', defParamCharset: 'utf8', limits: { fileSize: MAX_FILE, files: 1, fields: 12, fieldSize: 5000 } });
    bb.on('field', (k, v) => { fields[k] = String(v).trim(); });
    bb.on('file', (_k, stream, info) => {
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('limit', () => { tooBig = true; });
      stream.on('end', () => { file = { name: info.filename, type: info.mimeType, data: Buffer.concat(chunks) }; });
    });
    bb.on('error', reject);
    bb.on('close', () => resolve({ fields, file, tooBig }));
    bb.end(req.rawBody);
  });
}

exports.techietechApply = onRequest({
  region: 'europe-west1',
  secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/, /^https:\/\/techytech(--[\w-]+)?\.web\.app$/],
  maxInstances: 3,
  memory: '256MiB',
  timeoutSeconds: 60,
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (tooMany(req.ip)) return res.status(429).json({ error: 'too_many' });
  let form;
  try { form = await parse(req); } catch { return res.status(400).json({ error: 'bad_form' }); }
  const { fields: f, file, tooBig } = form;
  if (f.website) return res.json({ ok: true });  // the hidden field only a bot fills
  if (!f.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '')) return res.status(400).json({ error: 'details' });
  if (tooBig) return res.status(400).json({ error: 'file_size' });
  if (!file || !file.data.length || !OK_FILE.test(file.name)) return res.status(400).json({ error: 'file_type' });

  const position = (f.position || 'פנייה כללית').slice(0, 120);
  const text = [
    `משרה: ${position}`,
    `שם: ${f.name}`,
    `אימייל: ${f.email}`,
    `טלפון: ${f.phone || '-'}`,
    '',
    f.message ? `הודעה:\n${f.message}` : '',
    '',
    `נשלח מאתר Techy-Tech (/techietech/) · ${new Date().toISOString()}`,
  ].join('\n');
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
    await t.sendMail({
      from: `Techy-Tech Careers <${GMAIL_USER.value()}>`,
      to: TO,
      replyTo: f.email,
      subject: `Techy-Tech | קורות חיים: ${position} · ${f.name}`.slice(0, 200),
      text,
      attachments: [{ filename: file.name, content: file.data, contentType: file.type }],
    });
  } catch (e) {
    console.error('send failed', e.message);
    return res.status(502).json({ error: 'send' });
  }
  res.json({ ok: true });
});

// The other characters' sites (on boostmind-b052c.web.app): a request emailed to Shlomi, nothing stored, nothing charged.
//   /ayelet/     - booking a treatment / the workshop (Ayelet Hashachar)
//   /hindsight/  - joining a membership plan (HINDSIGHT VIP)
//   /demokratovich/ - a question for the rabbi's Q&A, or a donation pledge (Kehilat Shaarei Bagatz)
const SITES = {
  ayelet: { from: 'איילת השחר - האתר', subject: (f) => `איילת השחר | בקשה ל${f.choice || 'טיפול'} · ${f.name}`, choice: 'טיפול', page: '/ayelet/' },
  hindsight: { from: 'HINDSIGHT VIP', subject: (f) => `HINDSIGHT VIP | הצטרפות ל-${f.choice || 'קבוצה'} · ${f.name}`, choice: 'מסלול', page: '/hindsight/' },
  demokratovich: { from: 'קהילת שערי בג״ץ - האתר', subject: (f) => `שערי בג״ץ | ${f.choice || 'פנייה'} · ${f.name}`, choice: 'נושא', page: '/demokratovich/' },
  dorit: { from: 'דורית מרקורי - האתר', subject: (f) => `דורית מרקורי | הזמנה: ${f.choice || 'מפת לידה'} · ${f.name}`, choice: 'שירות', page: '/dorit/' },
  'ofnat-hani': { from: 'אופנת חני - האתר', subject: (f) => `אופנת חני | הזמנה לאיסוף: ${f.choice || 'פריט'} · ${f.name}`, choice: 'פריט', page: '/ofnat-hani/' },
};
exports.siteLead = onRequest({
  region: 'europe-west1',
  secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/],
  maxInstances: 3,
  memory: '256MiB',
  timeoutSeconds: 60,
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (tooMany(req.ip)) return res.status(429).json({ error: 'too_many' });
  let form;
  try { form = await parse(req); } catch { return res.status(400).json({ error: 'bad_form' }); }
  const f = form.fields;
  const site = SITES[f.site];
  if (!site) return res.status(400).json({ error: 'site' });
  if (f.website) return res.json({ ok: true });  // the hidden field only a bot fills
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '') ? f.email : '';
  const phone = (f.phone || '').replace(/[^\d+\-\s()]/g, '').slice(0, 30);
  if (!f.name || (!email && phone.replace(/\D/g, '').length < 9)) return res.status(400).json({ error: 'details' });
  const clip = (v, n) => String(v || '').slice(0, n);
  const text = [
    `${site.choice}: ${clip(f.choice, 120) || '-'}`,
    `שם: ${clip(f.name, 120)}`,
    `טלפון: ${phone || '-'}`,
    `אימייל: ${email || '-'}`,
    f.when ? `מתי נוח: ${clip(f.when, 200)}` : '',
    '',
    f.message ? `הודעה:\n${clip(f.message, 3000)}` : '',
    '',
    `נשלח מהאתר ${site.page} · ${new Date().toISOString()}`,
  ].filter((l, i, a) => l || a[i - 1]).join('\n');
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
    await t.sendMail({ from: `${site.from} <${GMAIL_USER.value()}>`, to: TO, ...(email ? { replyTo: email } : {}),
      subject: site.subject({ ...f, name: clip(f.name, 80), choice: clip(f.choice, 60) }).slice(0, 200), text });
  } catch (e) {
    console.error('send failed', e.message);
    return res.status(502).json({ error: 'send' });
  }
  res.json({ ok: true });
});

// the characters wiki's chat (/wiki/) - see wiki.js
exports.wikiChat = require('./wiki').wikiChat;

// Shlomi's own analytics (public/t.js -> track, the /stats/ dashboard -> stats) - see analytics.js
Object.assign(exports, require('./analytics'));
