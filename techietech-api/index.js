// Techy-Tech careers: the "send your CV" form on /techietech/ posts here (multipart), and the CV is emailed to Shlomi.
// siteLead (below): the other characters' sites - a booking / a membership request, emailed the same way.
// (techietechApply:)
// as an attachment (the request itself is kept for /backstage/, the CV is not). Deploy from this folder: firebase deploy --only functions
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Busboy = require('busboy');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const mailer = require('./mailer');   // the automatic reply from the site's character (mailer.js)
const guard = require('./guard');     // limits across instances (22.11: a script sent the CV form from 5 fresh accounts)

if (!admin.apps.length) admin.initializeApp();
const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const TO = 'shlomi@boostart.io';
const MAX_FILE = 5 * 1024 * 1024;
const OK_FILE = /\.(pdf|docx?)$/i;
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/, /^https:\/\/techytech(--[\w-]+)?\.web\.app$/];

// Sending anything from a Shlomiverse site needs a Google account (his rule, 2026-11-01: he wants the email of everyone
// who plays with his sites). The page signs in with the Shlomiverse's Firebase Auth (public/verse/site-signin.js) and
// sends its ID token; the person is kept in siteUsers and the request in `requests` - both show in /backstage/.
const SITE_NAMES = { 'dr-naomi': 'ד״ר נעמי־ציפורה', ksa: 'KSA GROUP', archive: 'הארכיון', tziftzif: 'ציפציפ', charadot: 'ח24', ayelet: 'איילת השחר', hindsight: 'HINDSIGHT VIP', demokratovich: 'שערי בג״ץ', dorit: 'דורית מרקורי',
  'ofnat-hani': 'אופנת חני', 'avi-balloons': 'אבי בלונים', 'neve-tidhar': 'המקיף נווה תדהר', techietech: 'טקי-טק', yotamverse: 'YOTAMVERSE' };
async function signedIn(req) {
  const m = (req.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try { const t = await admin.auth().verifyIdToken(m[1], true); return t.email ? t : null; } catch { return null; }   // true = a blocked / revoked account is refused at once
}
async function keepUser(u, site) {
  const ref = admin.firestore().collection('siteUsers').doc(u.uid);
  const was = (await ref.get()).exists;
  await ref.set({ email: u.email, name: u.name || null, photo: u.picture || null, sites: FieldValue.arrayUnion(site), lastSite: site,
    last: FieldValue.serverTimestamp(), ...(was ? {} : { created: FieldValue.serverTimestamp() }) }, { merge: true });
}
// the request in the backstage inbox, next to the verse's own (kind 'site'); the mail stays the main way it reaches him
const keepRequest = (u, site, f) => admin.firestore().collection('requests').add({ kind: 'site', site, siteName: SITE_NAMES[site] || site,
  uid: u.uid, email: u.email, contact: u.email, name: f.name || u.name || null, nick: null, phone: f.phone || null, choice: f.choice || null,
  when: f.when || null, text: f.text || '', t: FieldValue.serverTimestamp(), done: false }).catch((e) => console.error('keep request failed', e.message));

// the same form from the same person again within 5 minutes = one request (2026-11-17: a CV came 3 times in a minute -
// 3 mails, 3 rows in Backstage); the second send answers ok and does nothing
async function sentJustNow(u, site, text) {
  const q = await admin.firestore().collection('requests').where('uid', '==', u.uid).limit(30).get().catch(() => null);
  return !!q?.docs.some((d) => { const r = d.data(); return r.kind === 'site' && r.site === site && (r.text || '') === (text || '') && Date.now() - (r.t?.toMillis?.() || 0) < 5 * 60e3; });
}

// a site page signed someone in: keep them, even if they never send (e.g. Yotamverse's order goes to its own collection)
exports.siteUser = onRequest({ region: 'europe-west1', cors: CORS, maxInstances: 3, memory: '256MiB', timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const u = await signedIn(req);
  if (!u) return res.status(401).json({ error: 'sign_in' });
  const site = String((req.body || {}).site || '');
  await keepUser(u, SITE_NAMES[site] ? site : 'other');
  res.json({ ok: true });
});

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
  secrets: mailer.MAIL_SECRETS,   // Gmail + the key that signs the choices link
  cors: CORS,
  maxInstances: 3,
  memory: '256MiB',
  timeoutSeconds: 60,
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const u = await signedIn(req);
  if (!u) return res.status(401).json({ error: 'sign_in' });
  if (tooMany(req.ip)) return res.status(429).json({ error: 'too_many' });
  // across every instance: an account sends at most 3 CVs a day, an address (IPv6 /64) 3 an hour and 6 a day,
  // and the whole form 40 a day - a script with fresh accounts stops at the address, a flood at the day's total
  const where = guard.ip(req);
  if (await guard.limit(`apply:uid:${u.uid}`, 3, guard.DAY) || await guard.limit(`apply:ip:${where}`, 3, guard.HOUR)
    || await guard.limit(`apply:ipday:${where}`, 6, guard.DAY) || await guard.limit('apply:all:day', 40, guard.DAY)) {
    console.warn('apply refused (limit)', u.uid, where);
    return res.status(429).json({ error: 'too_many' });
  }
  let form;
  try { form = await parse(req); } catch { return res.status(400).json({ error: 'bad_form' }); }
  const { fields: f, file, tooBig } = form;
  if (f.website) return res.json({ ok: true });  // the hidden field only a bot fills
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '')) f.email = u.email;
  f.name = f.name || u.name || '';
  if (!f.name) return res.status(400).json({ error: 'details' });
  if (tooBig) return res.status(400).json({ error: 'file_size' });
  if (!file || !file.data.length || !OK_FILE.test(file.name) || !guard.fileOk(file.data, ['pdf', 'docx', 'doc'])) return res.status(400).json({ error: 'file_type' });
  file.name = guard.fileName(file.name, 'cv');   // no shell / HTML characters in what reaches the mail (22.11: "cv.$(id).pdf")
  f.name = guard.text(f.name, 80); f.phone = guard.text(f.phone, 30); f.message = guard.text(f.message, 3000, true);

  const position = (f.position || 'פנייה כללית').slice(0, 120);
  if (await sentJustNow(u, 'techietech', [f.message, `קורות חיים: ${file.name} (במייל)`].filter(Boolean).join('\n\n'))) return res.json({ ok: true, again: true });
  const text = [
    `משרה: ${position}`,
    `שם: ${f.name}`,
    `אימייל: ${f.email}`,
    `טלפון: ${f.phone || '-'}`,
    `חשבון Google: ${u.email}`,
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
  await Promise.all([keepUser(u, 'techietech').catch(() => {}),
    keepRequest(u, 'techietech', { name: f.name, phone: f.phone, choice: position, text: [f.message, `קורות חיים: ${file.name} (במייל)`].filter(Boolean).join('\n\n') }),
    mailer.reply('techietech', { email: f.email, name: f.name, uid: u.uid, choice: position })]);
  res.json({ ok: true });
});

// The other characters' sites (shlomiverse.com): a request emailed to Shlomi and kept for /backstage/, nothing charged.
//   /ayelet/     - booking a treatment / the workshop (Ayelet Hashachar)
//   /hindsight/  - joining a membership plan (HINDSIGHT VIP)
//   /demokratovich/ - a question for the rabbi's Q&A, or a donation pledge (Kehilat Shaarei Bagatz)
//   /neve-tidhar/ - a message to the school office (המקיף נווה תדהר - Rosenblum's and Esther's school)
//   /dr-naomi/   - Dr. Naomi-Tzipora's clinic: a first meeting, the organisations program, a lecture, a signed book, DoulaSense AI's waitlist
const SITES = {
  ayelet: { from: 'איילת השחר - האתר', subject: (f) => `איילת השחר | בקשה ל${f.choice || 'טיפול'} · ${f.name}`, choice: 'טיפול', page: '/ayelet/' },
  hindsight: { from: 'HINDSIGHT VIP', subject: (f) => `HINDSIGHT VIP | הצטרפות ל-${f.choice || 'קבוצה'} · ${f.name}`, choice: 'מסלול', page: '/hindsight/' },
  demokratovich: { from: 'קהילת שערי בג״ץ - האתר', subject: (f) => `שערי בג״ץ | ${f.choice || 'פנייה'} · ${f.name}`, choice: 'נושא', page: '/demokratovich/' },
  dorit: { from: 'דורית מרקורי - האתר', subject: (f) => `דורית מרקורי | הזמנה: ${f.choice || 'מפת לידה'} · ${f.name}`, choice: 'שירות', page: '/dorit/' },
  'ofnat-hani': { from: 'אופנת חני - האתר', subject: (f) => `אופנת חני | הזמנה לאיסוף: ${f.choice || 'פריט'} · ${f.name}`, choice: 'פריט', page: '/ofnat-hani/' },
  'avi-balloons': { from: 'אבי בלונים ואירועים - האתר', subject: (f) => `אבי בלונים | הצעת מחיר: ${f.choice || 'חבילה'} · ${f.name}`, choice: 'חבילה', page: '/avi-balloons/' },
  ksa: { from: 'KSA GROUP - האתר', subject: (f) => `KSA GROUP | ${f.choice || 'פנייה'} · ${f.name}`, choice: 'נושא', page: '/ksa/' },
  'dr-naomi': { from: 'ד״ר נעמי־ציפורה - המחוג שבלב', subject: (f) => `ד״ר נעמי־ציפורה | ${f.choice || 'פנייה'} · ${f.name}`, choice: 'מה מביא אותך', page: '/dr-naomi/' },
  'neve-tidhar': { from: 'המקיף נווה תדהר - המזכירות', subject: (f) => `המקיף נווה תדהר | פנייה למזכירות: ${f.choice || 'פנייה'} · ${f.name}`, choice: 'נושא', page: '/neve-tidhar/' },
};
exports.siteLead = onRequest({
  region: 'europe-west1',
  secrets: mailer.MAIL_SECRETS,   // Gmail + the key that signs the choices link
  cors: CORS,
  maxInstances: 3,
  memory: '256MiB',
  timeoutSeconds: 60,
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const u = await signedIn(req);
  if (!u) return res.status(401).json({ error: 'sign_in' });
  if (tooMany(req.ip)) return res.status(429).json({ error: 'too_many' });
  // across every instance: an account sends at most 3 CVs a day, an address (IPv6 /64) 3 an hour and 6 a day,
  // and the whole form 40 a day - a script with fresh accounts stops at the address, a flood at the day's total
  const where = guard.ip(req);
  if (await guard.limit(`apply:uid:${u.uid}`, 3, guard.DAY) || await guard.limit(`apply:ip:${where}`, 3, guard.HOUR)
    || await guard.limit(`apply:ipday:${where}`, 6, guard.DAY) || await guard.limit('apply:all:day', 40, guard.DAY)) {
    console.warn('apply refused (limit)', u.uid, where);
    return res.status(429).json({ error: 'too_many' });
  }
  let form;
  try { form = await parse(req); } catch { return res.status(400).json({ error: 'bad_form' }); }
  const f = form.fields;
  const site = SITES[f.site];
  if (!site) return res.status(400).json({ error: 'site' });
  if (f.website) return res.json({ ok: true });  // the hidden field only a bot fills
  // the Google account is always a way back; an email typed in the form (if any) goes first
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '') ? f.email : u.email;
  const phone = (f.phone || '').replace(/[^\d+\-\s()]/g, '').slice(0, 30);
  f.name = f.name || u.name || '';
  if (!f.name) return res.status(400).json({ error: 'details' });
  const clip = (v, n) => String(v || '').slice(0, n);
  const text = [
    `${site.choice}: ${clip(f.choice, 120) || '-'}`,
    `שם: ${clip(f.name, 120)}`,
    `טלפון: ${phone || '-'}`,
    `אימייל: ${email || '-'}`,
    `חשבון Google: ${u.email}`,
    f.when ? `מתי נוח: ${clip(f.when, 200)}` : '',
    '',
    f.message ? `הודעה:\n${clip(f.message, 3000)}` : '',
    '',
    `נשלח מהאתר ${site.page} · ${new Date().toISOString()}`,
  ].filter((l, i, a) => l || a[i - 1]).join('\n');
  if (await sentJustNow(u, f.site, clip(f.message, 3000))) return res.json({ ok: true, again: true });
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
    await t.sendMail({ from: `${site.from} <${GMAIL_USER.value()}>`, to: TO, replyTo: email,
      subject: site.subject({ ...f, name: clip(f.name, 80), choice: clip(f.choice, 60) }).slice(0, 200), text });
  } catch (e) {
    console.error('send failed', e.message);
    return res.status(502).json({ error: 'send' });
  }
  await Promise.all([keepUser(u, f.site).catch(() => {}),
    keepRequest(u, f.site, { name: clip(f.name, 120), phone, choice: clip(f.choice, 120), when: clip(f.when, 200), text: clip(f.message, 3000) }),
    mailer.reply(f.site, { email, name: clip(f.name, 80), uid: u.uid, choice: clip(f.choice, 60), when: clip(f.when, 80) })]);
  res.json({ ok: true });
});

// the characters wiki's chat (/wiki/) - see wiki.js
exports.wikiChat = require('./wiki').wikiChat;
exports.verseSim = require('./sim').verseSim;
exports.verseCitizen = require('./citizen').verseCitizen;   // the citizenship journey (citizen.js, /citizenship)   // "אתם חיים בסימולציה?" - the simulation test (sim.js, /simulation)
// ציפציפ (the residents' X) + ח24 (the news channel), built beside the verse - see tz.js (/tziftzif, /charadot)
const tz = require('./tz');
exports.verseTz = tz.verseTz;
exports.verseTzRun = tz.verseTzRun;
exports.verseTzOnPost = tz.verseTzOnPost;
exports.verseTzPage = tz.verseTzPage;   // ציפציפ / ח24's link previews
exports.verseAds = require('./ads').verseAds;
exports.verseMcp = require('./mcp').verseMcp;   // the Shlomiverse as a read-only MCP server for his ChatGPT (mcp.js, shlomiverse.com/mcp/<key>)   // the sponsored banners ("ממומן", first sponsor עיגוליות) - see ads.js
exports.verseMeeting = require('./meeting-fn').verseMeeting;   // ישיבת זום · טקי-טק - the Zoom meeting with the Techy-Tech team (meeting-fn.js + meeting.js; owner-only, /meeting)

// Shlomi's own analytics (public/t.js -> track, the /stats/ dashboard -> stats) - see analytics.js
Object.assign(exports, require('./analytics'));

// the Shlomiverse's fans: accounts, follows, comments, stickers, stories, push (shlomiverse.com/wiki/) - see verse.js.
// Live since 2026-11-01 (v2/dev.mjs runs the same code in the emulators). Needs the VERSE_VAPID_PRIVATE secret.
Object.assign(exports, require('./verse'));

// the mail engine: news mail (one a day at most), the choices page, Yotamverse's order reply - see mailer.js
exports.verseMailer = mailer.verseMailer;
exports.verseMail = mailer.verseMail;
exports.verseOrderReply = mailer.verseOrderReply;
// the verse's page addresses (/c/hani, /play/<game>...) with their own link preview for WhatsApp - see page.js
Object.assign(exports, require('./page'));
// "המוח השני" (shlomiverse.com/mind/): everything in his head + every Claude session on his computers, one page,
// a hook door and an MCP server - see mind.js
Object.assign(exports, require('./mind'));
// the video catalog's door: the studio, insta-to-verse and sessions publish / update / hide a video - see publish.js,
// catalog.js (the list of videos lives in the database since 2026-11-05)
// its key: the VERSE_PUBLISH_KEY secret (Secret Manager; the studio reads the same value from studio-keys)
exports.versePublish = require('./publish').versePublish;
exports.verseHeal = require('./publish').verseHeal;
// Piko (shlomiverse.com/piko/): his own picture + video maker - GPT Image pictures, Seedance videos through EvoLink, a
// spoken prompt; one API for his app and his other tools (startdoing.co.il) - see piko.js, piko-api.md
const piko = require('./piko');
exports.piko = piko.piko;
exports.pikoWork = piko.pikoWork;
exports.pikoSweep = piko.pikoSweep;
// רופא הגינה (shlomiverse.com/garden/?k=<key>): photo of a plant (+ a spoken question) -> what it is, what is wrong,
// what to do, read aloud; private links, no sign-in - see garden.js, scripts/garden/key.mjs
exports.garden = require('./garden').garden;
// the daily AI-cost alert: every hour, today's total (the "סה"כ AI" of Backstage → הוצאות); at $10 a mail to
// him, at $30 a big warning - one mail per level a day (owner/costAlert) - see costs.js
exports.costAlert = require('./costs').costAlert;
// Shlomiverse Online: the scheduled cleaner of stale rooms (net.js) - the moves themselves never pass through a function
exports.verseNetSweep = require('./net').verseNetSweep;
