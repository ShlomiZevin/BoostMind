// SMS from "Shlomiverse" (his ask 2026-11-19: a greeting's email can land in spam - the requester also gets an SMS with the link).
// Twilio, his account (paid). Keys: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM (the sender name, "Shlomiverse") from the
// environment, else zoomcut/.env (git-ignored), else Secret Manager (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN). Never print the token.
//   node scripts/greetings/sms.cjs test <phone>                 a test SMS (to him)
//   node scripts/greetings/sms.cjs greeting <greeting id> --yes the greeting's SMS to the requester (greet.cjs send --yes does it by itself)
// Used by greet.cjs: const { sendSms, phoneOf } = require('./sms.cjs')
const fs = require('fs'), path = require('path');

function keys() {
  const k = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM };
  if (!k.sid || !k.token) {
    const f = path.join(__dirname, '..', '..', 'zoomcut', '.env');
    const env = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const get = (n) => (env.match(new RegExp(`^${n}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
    Object.assign(k, { sid: get('TWILIO_ACCOUNT_SID'), token: get('TWILIO_AUTH_TOKEN'), from: k.from || get('TWILIO_FROM') });
  }
  if (!k.sid || !k.token) {   // any computer / the online studio: Secret Manager (his OK 2026-11-19)
    const sm = (n) => { try { return require('child_process').execSync(`gcloud secrets versions access latest --secret=${n} --project=boostmind-b052c`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; } };
    k.sid = k.sid || sm('TWILIO_ACCOUNT_SID'); k.token = k.token || sm('TWILIO_AUTH_TOKEN');
  }
  if (!k.sid || !k.token) throw new Error('Twilio keys missing (zoomcut/.env or Secret Manager TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  return { ...k, from: k.from || 'Shlomiverse' };
}

// an Israeli or international number -> +E.164, or null ("050-1234567" -> "+972501234567"; an email -> null)
function phoneOf(s) {
  let p = String(s || '').replace(/[\s\-().]/g, '');
  if (!/^\+?\d{9,15}$/.test(p)) return null;
  if (p.startsWith('+')) return p;
  if (p.startsWith('972')) return '+' + p;
  if (p.startsWith('0')) return '+972' + p.slice(1);
  return null;
}

async function sendSms(to, body) {
  const k = keys(), num = phoneOf(to);
  if (!num) throw new Error('not a phone number');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${k.sid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${k.sid}:${k.token}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: num, From: k.from, Body: body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${j.message || 'error'}`);
  return { sid: j.sid, status: j.status, to: num };
}
const tail = (n) => '...' + String(n).slice(-3);

// the greeting's SMS (Hebrew; one line + the link)
const greetingText = (g) => `שלומיוורס: הברכה מ${g.charName} ל${String(g.forWho).replace(/^ל/, '')} מוכנה. לצפייה: https://shlomiverse.com/greeting/${g.id}`;

module.exports = { sendSms, phoneOf, greetingText, tail };

if (require.main === module) {
  (async () => {
    const [cmd, arg] = process.argv.slice(2);
    if (cmd === 'test') {
      const r = await sendSms(arg, 'שלומיוורס: בדיקה - ככה תיראה הודעה מהשלומיוורס.');
      console.log(`sms test ${r.status} to ${tail(r.to)} (${r.sid})`);
    } else if (cmd === 'greeting') {
      if (!process.argv.includes('--yes')) throw new Error('--yes: only after Shlomi approved sending this SMS');
      const admin = require(path.join(__dirname, '..', '..', 'techietech-api', 'node_modules', 'firebase-admin'));
      admin.initializeApp({ projectId: 'boostmind-b052c' });
      const db = admin.firestore();
      const gd = await db.collection('greetings').doc(arg).get();
      if (!gd.exists) throw new Error('no such greeting');
      const g = { id: gd.id, ...gd.data() };
      const r = g.requestId ? (await db.collection('requests').doc(g.requestId).get()).data() || {} : {};
      const to = phoneOf(r.phone) || phoneOf(r.contact);
      if (!to) throw new Error('no phone on this request');
      const s = await sendSms(to, greetingText(g));
      await db.collection('greetings').doc(g.id).update({ smsAt: admin.firestore.FieldValue.serverTimestamp(), smsSid: s.sid });
      console.log(`sms ${s.status} to ${tail(s.to)} for greeting ${g.id}`);
    } else console.log('test <phone> | greeting <id> --yes');
    process.exit(0);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
