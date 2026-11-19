// Personal greetings - from the exported video to the person who asked (his plan greeting-send, approved 2026-11-19).
// A greeting is NOT a video of the resident's life: it never goes to wiki.json, the brain, the chat or the resident's videos. It lives
// in Firestore `greetings/<id>` + the PRIVATE bucket shlomiverse-private/greetings/<id>/ (video.mp4, poster.jpg), and is seen only at
// its own link-only page https://shlomiverse.com/greeting/<id> (techietech-api/page.js streams it; v2/site/greeting/page.html).
//
//   node scripts/greetings/greet.cjs add --video <file.mp4> --char <resident id> [--request <requests doc id>] [--for "מאיה"] [--event "שנתיים ביחד"]
//        [--to <requester email>] [--poster <jpg>] [--at <seconds for the poster frame>] [--name "how the resident signs"]   -> prints the greeting id + its page
//   node scripts/greetings/greet.cjs mail <greeting id> [--out preview.html]     the email as HTML, to look at (nothing sent)
//   node scripts/greetings/greet.cjs send <greeting id> --test                   the email to Shlomi's own inbox (how it looks in Gmail)
//   node scripts/greetings/greet.cjs send <greeting id> --yes                    to the requester - ONLY after Shlomi approved THIS greeting.
//        Inside the requester's own thread when they ever wrote to us (his rule: answers go in their thread); logged in mailLog;
//        the request is marked done.
//   node scripts/greetings/greet.cjs public <greeting id> on|off                 shown in the verse's "ברכות" section / for stories (his call)
//   node scripts/greetings/greet.cjs list
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync, execFileSync } = require('child_process');
const API = path.join(__dirname, '..', '..', 'techietech-api');
const admin = require(path.join(API, 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'boostmind-b052c', storageBucket: 'shlomiverse-private' });
const db = admin.firestore(), bucket = admin.storage().bucket('shlomiverse-private');
const SITE = 'https://shlomiverse.com', MEDIA = 'https://storage.googleapis.com/shlomiverse-media/wiki/';
const [cmd, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
const flag = (k) => rest.includes('--' + k);
const die = (m) => { console.error(m); process.exit(1); };
const newId = () => { const A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(crypto.randomBytes(14), (b) => A[b % A.length]).join(''); };
const secret = (n) => execSync(`gcloud secrets versions access latest --secret=${n} --project=boostmind-b052c`, { encoding: 'utf8' }).trim();

// how a resident signs a greeting when it differs from the page's name (Hani: never "חני" from her own mouth)
const NAME_AS = { hani: 'חנה פרידמן' };
async function add() {
  const video = opt('video'), char = opt('char');
  if (!video || !fs.existsSync(video)) die('--video <file.mp4> is missing');
  if (!char) die('--char <resident id> is missing');
  const rec = await db.collection('catalogCharacters').doc(char).get();
  if (!rec.exists) die(`no resident "${char}"`);
  const c = rec.data();
  const w = await (await fetch(MEDIA + 'data/wiki.json')).json();
  const wc = (w.characters || []).find((x) => x.id === char) || {};
  const img = wc.img ? (/^https?:/.test(wc.img) ? wc.img : MEDIA + wc.img.replace(/^\/?(wiki\/)?/, '')) : '';
  let r = {};
  if (opt('request')) { const d = await db.collection('requests').doc(opt('request')).get(); if (!d.exists) die('no such request'); r = d.data(); }
  const forWho = opt('for', r.forWho), event = opt('event', r.event || ''), to = opt('to', r.email || '');
  if (!forWho) die('--for <name> is missing (and no --request)');
  const id = newId(), tmp = path.join(require('os').tmpdir(), `greet-${id}`);
  fs.mkdirSync(tmp, { recursive: true });
  let poster = opt('poster');
  if (!poster) {   // a frame from the middle of the greeting (past the opening card): the resident talking
    const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }).trim() || 10;
    poster = path.join(tmp, 'poster.jpg');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(opt('at', (dur * 0.4).toFixed(2))), '-i', video, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', poster]);
  }
  await bucket.upload(video, { destination: `greetings/${id}/video.mp4`, metadata: { contentType: 'video/mp4', cacheControl: 'private, max-age=0' } });
  await bucket.upload(poster, { destination: `greetings/${id}/poster.jpg`, metadata: { contentType: 'image/jpeg' } });
  await db.collection('greetings').doc(id).set({
    char, charName: opt('name', NAME_AS[char] || c.name), charImg: img, world: c.world || '', techy: c.world === 'טקי-טק' || flag('techy'),
    forWho, event, to, requestId: opt('request') || null, public: false,
    t: admin.firestore.FieldValue.serverTimestamp(), sentAt: null,
  });
  console.log(`greeting ${id}\n${SITE}/greeting/${id}`);
}

async function load(id) {
  const d = await db.collection('greetings').doc(String(id || '')).get();
  if (!d.exists) die('no such greeting');
  return { id: d.id, ...d.data() };
}
async function build(g, first) {
  const { render } = require(path.join(API, 'mail.js'));
  const d = {
    subject: `הברכה ל${g.forWho} מוכנה`, preheader: `ברכה מ${g.charName} ל${g.forWho}`,
    title: `הברכה ל${g.forWho} מוכנה`, line: `מאת ${g.charName}${g.event ? ' · ' + g.event : ''}`,
    paras: [`${first ? first + ', ' : ''}ביקשתם ברכה מ${g.charName} ל${g.forWho}, והיא כאן.`,
      'ונשמח מאוד אם תשתפו אותה בסטורי שלכם, ובכל מקום שבא לכם. ברכה טובה צריכה להגיע רחוק.'],   // his ask 2026-11-19
    poster: `${SITE}/greeting/${g.id}/poster.jpg`, href: `/greeting/${g.id}`,
    note: 'זו ברכה אישית מהשלומיוורס. אפשר להשיב למייל הזה.',
  };
  return render('greeting', d);
}
async function requester(g) {
  const r = g.requestId ? (await db.collection('requests').doc(g.requestId).get()).data() || {} : {};
  return { first: String(r.name || r.nick || '').split(' ')[0], email: g.to || r.email };
}
// the newest mail this person sent us (his rule: answer inside their thread)
async function theirThread(email) {
  const { ImapFlow } = require(path.join(API, 'node_modules', 'imapflow'));
  const c = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: secret('GMAIL_USER'), pass: secret('GMAIL_APP_PASSWORD') }, logger: false });
  await c.connect();
  try {
    const box = ((await c.list()).find((b) => b.specialUse === '\\All') || {}).path || 'INBOX';
    await c.mailboxOpen(box);
    const uids = (await c.search({ from: email }, { uid: true })) || [];
    if (!uids.length) return null;
    const m = await c.fetchOne(String(Math.max(...uids)), { envelope: true, headers: ['references'] }, { uid: true });
    const refs = (m.headers ? m.headers.toString().replace(/^references:\s*/i, '').replace(/\s+/g, ' ').trim() : '');
    return { messageId: m.envelope.messageId, subject: m.envelope.subject || '', refs };
  } finally { await c.logout().catch(() => {}); }
}

async function send(id) {
  const g = await load(id), who = await requester(g);
  const test = flag('test');
  if (!test && !flag('yes')) die('Sending to the requester needs --yes (only after Shlomi approved this greeting). --test sends it to his own inbox.');
  const user = secret('GMAIL_USER');
  const to = test ? user : who.email;
  if (!to) die('no address for the requester (--to on add)');
  const m = await build(g, who.first);
  let subject = m.subject, headers = { ...m.headers };
  const th = test ? null : await theirThread(to);
  if (th && th.messageId) {
    subject = /^re:/i.test(th.subject) ? th.subject : `Re: ${th.subject}`;
    headers['In-Reply-To'] = th.messageId;
    headers.References = `${th.refs ? th.refs + ' ' : ''}${th.messageId}`.trim();
  }
  const nm = require(path.join(API, 'node_modules', 'nodemailer'));
  const tr = nm.createTransport({ service: 'gmail', auth: { user, pass: secret('GMAIL_APP_PASSWORD') } });
  await tr.sendMail({ from: `השלומיוורס <${user}>`, to, subject, html: m.html, text: m.text, headers, replyTo: 'shlomi@boostart.io' });
  await db.collection('mailLog').add({ to, uid: null, kind: test ? 'greeting-test' : 'greeting', subject, fromName: 'השלומיוורס', meta: { greeting: g.id, thread: !!th }, ok: true,
    t: admin.firestore.FieldValue.serverTimestamp(), html: m.html.length < 300000 ? m.html : null });
  if (!test) {
    await db.collection('greetings').doc(g.id).update({ sentAt: admin.firestore.FieldValue.serverTimestamp(), sentTo: to });
    if (g.requestId) await db.collection('requests').doc(g.requestId).update({ done: true, answer: `greeting sent: ${SITE}/greeting/${g.id}`, answeredAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  console.log(`sent ${test ? '(test, to Shlomi)' : 'to the requester'}${th ? ' in their thread' : ''}: ${subject}`);
}

(async () => {
  if (cmd === 'add') await add();
  else if (cmd === 'mail') { const g = await load(rest[0]), m = await build(g, (await requester(g)).first); const out = opt('out', `greeting-${g.id}.html`); fs.writeFileSync(out, m.html); console.log(m.subject, '->', out); }
  else if (cmd === 'send') await send(rest[0]);
  else if (cmd === 'public') { const g = await load(rest[0]); await db.collection('greetings').doc(g.id).update({ public: rest[1] === 'on' }); console.log(g.id, 'public', rest[1] === 'on'); }
  else if (cmd === 'list') { const s = await db.collection('greetings').get(); s.docs.forEach((d) => { const x = d.data(); console.log(d.id, '|', x.char, '->', x.forWho, '|', x.event, '|', x.sentAt ? 'sent' : 'not sent', x.public ? '| public' : ''); }); }
  else die('commands: add | mail | send | public | list (see the top of this file)');
  process.exit(0);
})().catch((e) => die(e.stack || e.message));
