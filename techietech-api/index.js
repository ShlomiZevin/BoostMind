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
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^https:\/\/boostmind-b052c\.firebaseapp\.com$/, /^https:\/\/techytech(--[\w-]+)?\.web\.app$/];

// Sending anything from a Shlomiverse site needs a Google account (his rule, 2026-11-01: he wants the email of everyone
// who plays with his sites). The page signs in with the Shlomiverse's Firebase Auth (public/verse/site-signin.js) and
// sends its ID token; the person is kept in siteUsers and the request in `requests` - both show in /backstage/.
const SITE_NAMES = { 'dr-naomi': 'ד״ר נעמי־ציפורה', ksa: 'KSA GROUP', archive: 'הארכיון', tziftzif: 'ציפציפ', charadot: 'ח24', ayelet: 'איילת השחר', hindsight: 'HINDSIGHT VIP', demokratovich: 'שערי בג״ץ', dorit: 'דורית מרקורי',
  'ofnat-hani': 'אופנת חני', 'avi-balloons': 'אבי בלונים', 'neve-tidhar': 'המקיף נווה תדהר', techietech: 'טקי-טק', yotamverse: 'YOTAMVERSE' };
// Security (his ask after the 22.11 scripted probe - 11 CVs with shell-injection file names from 5 fresh accounts, because the old
// limit counted per instance in memory): every send is counted in Firestore across instances (guard.js) per account, per address
// (IPv6 counts by /64) and in total; every field is cleaned and cut; the CV's type is read from its bytes and its name made safe;
// replyTo is a checked address; the automatic reply goes only to the account's own (verified) address, with its own cap (mailer.js).
const ONE_EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
const okEmail = (e) => typeof e === 'string' && e.length <= 254 && ONE_EMAIL.test(e);
async function signedIn(req) {
  const m = (req.get('authorization') || '').match(/^Bearer (.{20,4096})$/);
  if (!m) return null;
  try {
    const t = await admin.auth().verifyIdToken(m[1], true);   // true = a blocked / revoked account is refused at once
    return t.email && t.email_verified && okEmail(t.email) ? t : null;   // Google and the email code both verify the address
  } catch { return null; }
}
// too many? - counted across every instance; the first key that is over answers (and is logged, without the address itself)
async function over(limits, what) {
  for (const [key, n, ms] of limits) if (await guard.limit(key, n, ms)) { console.warn(what, 'refused (limit)', key.split(':').slice(0, 2).join(':')); return true; }
  return false;
}
async function keepUser(u, site) {
  const ref = admin.firestore().collection('siteUsers').doc(u.uid);
  const was = (await ref.get()).exists;
  await ref.set({ email: u.email, name: guard.text(u.name, 80) || null, photo: /^https:\/\//.test(u.picture || '') ? String(u.picture).slice(0, 500) : null, sites: FieldValue.arrayUnion(site), lastSite: site,
    last: FieldValue.serverTimestamp(), ...(was ? {} : { created: FieldValue.serverTimestamp() }) }, { merge: true });
}
// the request in the backstage inbox, next to the verse's own (kind 'site'); the mail stays the main way it reaches him
const keepRequest = (u, site, f) => admin.firestore().collection('requests').add({ kind: 'site', site, siteName: SITE_NAMES[site] || site,
  uid: u.uid, email: u.email, contact: u.email, name: f.name || guard.text(u.name, 80) || null, nick: null, phone: f.phone || null, choice: f.choice || null,
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
  if (await over([[`siteuser:uid:${u.uid}`, 60, guard.HOUR], [`siteuser:ip:${guard.ip(req)}`, 120, guard.HOUR]], 'siteUser')) return res.status(429).json({ error: 'too_many' });
  const site = String((req.body || {}).site || '');
  await keepUser(u, Object.hasOwn(SITE_NAMES, site) ? site : 'other').catch((e) => console.error('siteUser', e.message));
  res.json({ ok: true });
});

function parse(req) {
  return new Promise((resolve, reject) => {
    const fields = Object.create(null);
    let file = null, tooBig = false, extra = false;
    // utf8 file names: browsers send a Hebrew name ("קורות חיים.pdf") as raw UTF-8, busboy's default reads latin1
    const bb = Busboy({ headers: req.headers, defCharset: 'utf8', defParamCharset: 'utf8', limits: { fileSize: MAX_FILE, files: 1, fields: 12, fieldSize: 5000, parts: 14, fieldNameSize: 40 } });
    bb.on('field', (k, v) => { if (/^[a-z]{1,20}$/.test(k)) fields[k] = String(v).trim(); });
    bb.on('file', (_k, stream, info) => {
      if (file) { extra = true; stream.resume(); return; }
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('limit', () => { tooBig = true; });
      stream.on('end', () => { file = { name: String(info.filename || ''), data: Buffer.concat(chunks) }; });
    });
    bb.on('error', reject);
    bb.on('close', () => resolve({ fields, file, tooBig, extra }));
    bb.end(req.rawBody);
  });
}
// the CV's real type, from its bytes (never the name or the browser's type) -> its extension and content type
const CV_KINDS = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
function cvKind(buf) {
  const k = guard.fileKind(buf, ['pdf', 'docx', 'doc']);
  if (k === 'docx' && !buf.includes('word/')) return '';   // any zip has the docx's first bytes: a Word file carries word/document.xml
  return k;
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
  const where = guard.ip(req);
  // tries (a wrong file, a typo) are allowed generously; what is SENT is counted below
  if (await over([[`applytry:uid:${u.uid}`, 15, guard.HOUR], [`applytry:ip:${where}`, 20, guard.HOUR]], 'apply')) return res.status(429).json({ error: 'too_many' });
  let form;
  try { form = await parse(req); } catch { return res.status(400).json({ error: 'bad_form' }); }
  const { fields: f, file, tooBig, extra } = form;
  if (f.website) return res.json({ ok: true });  // the hidden field only a bot fills
  const email = okEmail(f.email) ? f.email : u.email;   // replyTo: one checked address, never a list / a header
  const name = guard.text(f.name, 80) || guard.text(u.name, 80);
  if (!name) return res.status(400).json({ error: 'details' });
  if (tooBig) return res.status(400).json({ error: 'file_size' });
  const kind = file && file.data.length ? cvKind(file.data) : '';
  if (!kind || extra) return res.status(400).json({ error: 'file_type' });
  // a safe name (no paths, no shell / HTML characters - 22.11: "cv.$(id).pdf") with the extension of what the file really is
  const fileName = guard.fileName(file.name, 'cv').replace(/\.[a-z0-9]{1,8}$/, '') + '.' + kind;
  const phone = guard.text(f.phone, 30).replace(/[^\d+\-\s()]/g, '');
  const message = guard.text(f.message, 3000, true);
  const position = guard.text(f.position, 120) || 'פנייה כללית';
  const reqText = [message, `קורות חיים: ${fileName} (במייל)`].filter(Boolean).join('\n\n');
  if (await sentJustNow(u, 'techietech', reqText)) return res.json({ ok: true, again: true });
  // what is sent, across every instance: an account 3 CVs a day, an address (IPv6 /64) 3 an hour and 6 a day, the form 40 a day -
  // a script with fresh accounts stops at the address, a flood at the day's total
  if (await over([[`apply:uid:${u.uid}`, 3, guard.DAY], [`apply:ip:${where}`, 3, guard.HOUR], [`apply:ipday:${where}`, 6, guard.DAY], ['apply:all:day', 40, guard.DAY]], 'apply')) {
    return res.status(429).json({ error: 'too_many' });
  }
  const text = [
    `משרה: ${position}`,
    `שם: ${name}`,
    `אימייל: ${email}`,
    `טלפון: ${phone || '-'}`,
    `חשבון Google: ${u.email}`,
    '',
    message ? `הודעה:\n${message}` : '',
    '',
    `נשלח מאתר Techy-Tech (/techietech/) · ${new Date().toISOString()}`,
  ].join('\n');
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
    await t.sendMail({
      from: `Techy-Tech Careers <${GMAIL_USER.value()}>`,
      to: TO,
      replyTo: email,
      subject: guard.text(`Techy-Tech | קורות חיים: ${position} · ${name}`, 200),
      text,
      attachments: [{ filename: fileName, content: file.data, contentType: CV_KINDS[kind] }],
    });
  } catch (e) {
    console.error('send failed', e.message);
    return res.status(502).json({ error: 'send' });
  }
  await Promise.all([keepUser(u, 'techietech').catch(() => {}),
    keepRequest(u, 'techietech', { name, phone, choice: position, text: reqText }),
    mailer.reply('techietech', { email: u.email, name, uid: u.uid, choice: position })]);   // the reply: to the account's own address only
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
  const where = guard.ip(req);
  if (await over([[`leadtry:uid:${u.uid}`, 15, guard.HOUR], [`leadtry:ip:${where}`, 20, guard.HOUR]], 'siteLead')) return res.status(429).json({ error: 'too_many' });
  let form;
  try { form = await parse(req); } catch { return res.status(400).json({ error: 'bad_form' }); }
  const f = form.fields;
  if (!Object.hasOwn(SITES, f.site || '')) return res.status(400).json({ error: 'site' });
  const site = SITES[f.site];
  if (f.website) return res.json({ ok: true });  // the hidden field only a bot fills
  if (form.file) return res.status(400).json({ error: 'bad_form' });   // these forms carry no file
  // the Google account is always a way back; an email typed in the form (if any) goes first - for him (replyTo) only
  const email = okEmail(f.email) ? f.email : u.email;
  const phone = guard.text(f.phone, 30).replace(/[^\d+\-\s()]/g, '');
  const name = guard.text(f.name, 120) || guard.text(u.name, 120);
  if (!name) return res.status(400).json({ error: 'details' });
  const choice = guard.text(f.choice, 120), when = guard.text(f.when, 200), message = guard.text(f.message, 3000, true);
  const text = [
    `${site.choice}: ${choice || '-'}`,
    `שם: ${name}`,
    `טלפון: ${phone || '-'}`,
    `אימייל: ${email || '-'}`,
    `חשבון Google: ${u.email}`,
    when ? `מתי נוח: ${when}` : '',
    '',
    message ? `הודעה:\n${message}` : '',
    '',
    `נשלח מהאתר ${site.page} · ${new Date().toISOString()}`,
  ].filter((l, i, a) => l || a[i - 1]).join('\n');
  if (await sentJustNow(u, f.site, message)) return res.json({ ok: true, again: true });
  // what is sent, across every instance: an account 5 requests a day, an address (IPv6 /64) 5 an hour and 12 a day, all the
  // sites together 80 a day
  if (await over([[`lead:uid:${u.uid}`, 5, guard.DAY], [`lead:ip:${where}`, 5, guard.HOUR], [`lead:ipday:${where}`, 12, guard.DAY], ['lead:all:day', 80, guard.DAY]], 'siteLead')) {
    return res.status(429).json({ error: 'too_many' });
  }
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
    await t.sendMail({ from: `${site.from} <${GMAIL_USER.value()}>`, to: TO, replyTo: email,
      subject: guard.text(site.subject({ name: name.slice(0, 80), choice: choice.slice(0, 60) }), 200), text });
  } catch (e) {
    console.error('send failed', e.message);
    return res.status(502).json({ error: 'send' });
  }
  await Promise.all([keepUser(u, f.site).catch(() => {}),
    keepRequest(u, f.site, { name, phone, choice, when, text: message }),
    mailer.reply(f.site, { email: u.email, name: name.slice(0, 80), uid: u.uid, choice: choice.slice(0, 60), when: when.slice(0, 80) })]);   // the reply: the account's own address
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
