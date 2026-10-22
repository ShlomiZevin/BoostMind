// Techy-Tech careers: the "send your CV" form on /techietech/ posts here (multipart), and the CV is emailed to Shlomi
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
