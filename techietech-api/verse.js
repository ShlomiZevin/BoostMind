// The Shlomiverse's social layer (shlomiverse.com/wiki/): fans sign in with Google, follow characters, save videos,
// comment (comments have likes, videos don't), make a "sticker from the moment", stamp other fans' stickers, and get
// web push + an in-site bell when something happens to a character they follow.
//   verse       - one callable for everything a fan does (op: profile | follow | save | comment | like | sticker | ...)
//   verseOwner  - Shlomi's page (/verse-owner/, his owner key): write a character's story, announce a new video, hide
//                 a comment or a sticker, read the requests the guide passed on
//   verseOnComment - a new comment: the @character answers in its own voice, and whoever was replied to hears about it
// Everything that costs money or moves a count runs here, never from the browser; the rules let fans only read.
// Locally (the emulators, v2/dev.mjs) nothing reaches the live project: keys come from the environment, mail is logged.
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
const Busboy = require('busboy');
const webpush = require('web-push');
const nodemailer = require('nodemailer');
const { _stream, _canon } = require('./wiki');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const LOCAL = process.env.FUNCTIONS_EMULATOR === 'true';
const OPENAI = defineSecret('WIKI_OPENAI_KEY');
const VAPID_PRIVATE = defineSecret('VERSE_VAPID_PRIVATE');
const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const SECRETS = LOCAL ? [] : [OPENAI, VAPID_PRIVATE, GMAIL_USER, GMAIL_APP_PASSWORD];
const openaiKey = () => (LOCAL ? process.env.VERSE_OPENAI_KEY : OPENAI.value());
// the public half is in the page too (v2/site/verse/fb.js); the private half is a secret (locally: .env.local)
const VAPID_PUBLIC = 'BApNz6a4ZuFrPgaIEHGY9rvyKkwIvrJPsRjH0k01QYruVT2yz5ce-0fVuuIsk9vyprZ8Gq1nGxXajBL-EMD0hP0';
const vapidPublic = () => process.env.VERSE_VAPID_PUBLIC || VAPID_PUBLIC;
const vapidPrivate = () => (LOCAL ? process.env.VERSE_VAPID_PRIVATE : VAPID_PRIVATE.value());

const SITE = LOCAL ? (process.env.VERSE_SITE || 'http://localhost:5050') : 'https://shlomiverse.com';
const BUCKET = LOCAL ? 'demo-shlomiverse.appspot.com' : 'shlomiverse-media';
const publicUrl = (path) => LOCAL
  ? `http://127.0.0.1:9199/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`
  : `https://storage.googleapis.com/${BUCKET}/${path}`;
const OWNER_KEY_SHA256 = require('./owner.json').ownerKeySha256;
const TO = 'shlomi@boostart.io';
// his own account IS the Shlomiverse (his ask, 2026-11-01: "when I reply to someone it's the verse"): its profile is
// always this name + the logo, marked official - set here only, never by a fan; the name is reserved for him
const OFFICIAL = { nick: 'שלומיוורס', photo: 'https://shlomiverse.com/verse/logo-512.png', official: true };
const isOwner = (auth) => auth?.token?.email === TO && auth.token.email_verified;
const reserved = (nick) => /שלומיוורס|shlomi\s*verse/i.test(nick);

const STICKERS_A_DAY = 3;          // free stickers per fan per day (tokens later)
const CHARACTER_REPLIES_A_DAY = 10; // @character answers per fan per day
const IDEAS_A_DAY = 5;              // ideas per fan per day on the community wall
// an idea's way and what its writer hears at each step (Terra, 2026-11-05; the bell and the mail have their own lines)
const IDEA_STEPS = ['liked', 'making', 'live'];
const IDEA_COPY = {
  liked: { title: 'השלומיוורס אהב', body: 'הרעיון שלכם סומן בקיר: {idea}' },
  making: { title: 'מתחילים לעבוד', body: 'הרעיון שלכם נכנס לעבודה בשלומיוורס' },
  live: { title: 'זה באוויר', body: 'יצא סרטון מהרעיון שלכם, עם קרדיט לכם' },
  liveVoter: { title: 'רעיון שווה צפייה', body: 'רעיון שהצבעתם לו הפך לסרטון' },
  reply: { title: 'השלומיוורס הגיב לרעיון שלכם' },
};
const COMMENT_MAX = 500;
const REGION = 'europe-west1';
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];

// ---------- small helpers ----------
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const clip = (v, n) => String(v ?? '').replace(/\s+$/g, '').slice(0, n);
const oneLine = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const idOk = (v) => typeof v === 'string' && /^[\w-]{1,80}$/.test(v);
// daily records: how many scores a fan may send a day, the score as shown (12.4 -> "12.4", 12 -> "12"), the push copy (Terra)
const SCORES_A_DAY = 300;
const fmtScore = (v) => String(Math.round(v * 100) / 100);
const RECORD_PUSH = { title: 'לקחו לכם את הבכורה', body: (nick, game, n, unit) => `${nick} לקחו את ההובלה ב־${game}: ${n} ${unit}. חוזרים?` };
// where a comment / sticker lives: a video's page or a game's (games keep their comments under the game's id)
const pageOf = async (id) => `/${(await _canon()).games?.[id] ? 'play' : 'v'}/${id}`;
const fail = (code, msg) => { throw new HttpsError(code, msg); };

// per-instance burst guard (the daily quotas below are the real limits)
const bursts = new Map();
function burst(key, n, ms) {
  const now = Date.now();
  const list = (bursts.get(key) || []).filter((t) => now - t < ms);
  list.push(now);
  bursts.set(key, list);
  return list.length > n;
}

// a daily counter in a transaction; returns false when the day's quota is used up
async function spend(kind, uid, limit, n = 1) {
  const ref = db.collection('quota').doc(`${kind}_${uid}_${dayIL()}`);
  return db.runTransaction(async (tx) => {
    const used = ((await tx.get(ref)).data() || {}).n || 0;
    if (used + n > limit) return false;
    tx.set(ref, { n: used + n, uid, kind, exp: Timestamp.fromMillis(Date.now() + 3 * 864e5) }, { merge: true });
    return true;
  });
}
const refund = (kind, uid) => db.collection('quota').doc(`${kind}_${uid}_${dayIL()}`).set({ n: FieldValue.increment(-1) }, { merge: true });
const quotaLeft = async (kind, uid, limit) => limit - (((await db.collection('quota').doc(`${kind}_${uid}_${dayIL()}`).get()).data() || {}).n || 0);

// OpenAI's free moderation check before anything a fan wrote is shown to others. If the check itself is down the text
// goes up marked `unchecked`, so Shlomi's page can find it.
async function moderate(text) {
  if (!text) return { ok: true };
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST', headers: { authorization: `Bearer ${openaiKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!res.ok) throw new Error('moderation ' + res.status);
    const r = (await res.json()).results[0];
    return { ok: !r.flagged };
  } catch (e) {
    console.error('moderation failed', e.message);
    return { ok: true, unchecked: true };
  }
}

// the same free check for a photo a fan uploads as their face (omni-moderation reads images too)
async function moderateImage(dataUrl) {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST', headers: { authorization: `Bearer ${openaiKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: dataUrl } }] }),
    });
    if (!res.ok) throw new Error('moderation ' + res.status);
    return { ok: !(await res.json()).results[0].flagged };
  } catch (e) {
    console.error('image moderation failed', e.message);
    return { ok: true, unchecked: true };
  }
}

async function fanOf(uid) {
  const snap = await db.collection('fans').doc(uid).get();
  if (!snap.exists || !snap.data().nick) fail('failed-precondition', 'no_profile');
  return snap.data();
}

// ---------- the bell + push ----------
// a story sent to everyone stays news for its three days on the home page: an account made in those days finds it in
// its bell too (his question, 2026-11-02: "I registered a new user - I won't see the story published before that?")
async function recentNews(uid) {
  const snap = await db.collection('stories').where('t', '>=', new Date(Date.now() - 3 * 864e5)).get();
  const { byId } = await _canon();
  await Promise.all(snap.docs.filter((d) => d.data().everyone && !d.data().hidden).map((d) => {
    const x = d.data();
    return db.collection('fans').doc(uid).collection('notes').add({ kind: 'story', storyId: d.id, char: x.char, from: x.char === 'verse' ? OFFICIAL.nick : byId[x.char]?.name || x.char, text: (x.text || '').slice(0, 140), read: false, t: x.t });
  }));
}
const note = (uid, data) => db.collection('fans').doc(uid).collection('notes').add({ ...data, read: false, t: FieldValue.serverTimestamp() });

function pushReady() {
  const priv = vapidPrivate();
  if (!priv) return false;
  webpush.setVapidDetails('mailto:' + TO, vapidPublic(), priv);
  return true;
}
// one message to every device of these fans; dead subscriptions are dropped
async function push(uids, payload) {
  uids = [...new Set(uids)].filter(Boolean);
  if (!uids.length || !pushReady()) return 0;
  let sent = 0;
  for (let i = 0; i < uids.length; i += 30) {
    const subs = await db.collection('pushSubs').where('uid', 'in', uids.slice(i, i + 30)).get();
    await Promise.all(subs.docs.map(async (d) => {
      try {
        await webpush.sendNotification(d.data().sub, JSON.stringify(payload), { TTL: 86400, urgency: 'normal' });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete();
        else console.error('push failed', e.statusCode, e.body || e.message);
      }
    }));
  }
  return sent;
}
// everyone who follows any of these characters
async function followersOf(chars) {
  const uids = new Set();
  for (let i = 0; i < chars.length; i += 30) {
    const snap = await db.collection('fans').where('follows', 'array-contains-any', chars.slice(i, i + 30)).select().get();
    snap.docs.forEach((d) => uids.add(d.id));
  }
  return [...uids];
}
const faceUrl = (id) => `${SITE}/wiki/img/c/${id}.jpg`;
const ICON = `${SITE}/verse/icon-192.png`;
const BADGE = `${SITE}/verse/badge-96.png`;

// ---------- the sticker ----------
// the look is his reference (sticker-style.jpg, 2026-11-02: "I rather have the stickers looking like this") - the same
// words as scripts/v2-design/sticker-pack.mjs (the ready pack), keep them in step
const STICKER_STYLE = require('fs').readFileSync(require('path').join(__dirname, 'sticker-style.jpg'));
const STICKER_PROMPT = (text) => `Make one die-cut WhatsApp sticker of the person in the FIRST image (a frame from a comedy video), drawn
in exactly the style of the SECOND image (the style reference - copy its look, not its person or its words):
- an illustrated comic / vector portrait: clean bold black ink outlines, flat cel-shaded colour with a few soft tones, fine
  line detail on the face (stubble, wrinkles) - not a photo, not a 3D render;
- the person EXACTLY as in the first image: the same face, expression, hair or wig, head covering, glasses and clothes - a
  faithful, instantly recognisable likeness of this exact person, never a different or prettier one. Head and shoulders,
  cut out from the background, the expression as strong as in the frame;
- a thick clean white border around the whole sticker (the person and the lettering together, one silhouette), a very
  subtle shadow;
- across the bottom, overlapping the shoulders, big bold Hebrew letters (right-to-left, correctly spelled, every letter
  exact) that say: "${text}" - white letters with a heavy black outline, like the reference; nothing else written.
Transparent background around the sticker. No watermark, no logo.`;

async function makeSticker(frameB64, text) {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst');
  form.append('prompt', STICKER_PROMPT(text));
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('background', 'transparent');
  form.append('output_format', 'webp');
  form.append('n', '1');
  form.append('image[]', new Blob([Buffer.from(frameB64, 'base64')], { type: 'image/jpeg' }), 'frame.jpg');
  form.append('image[]', new Blob([STICKER_STYLE], { type: 'image/jpeg' }), 'style.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${openaiKey()}` }, body: form });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error(`image ${res.status}: ${j.error?.message}`), { refused: j.error?.code === 'moderation_blocked' });
  console.log('sticker', j.usage ? `in ${j.usage.input_tokens} out ${j.usage.output_tokens}` : '');
  return Buffer.from(j.data[0].b64_json, 'base64');
}

// ---------- what a fan does ----------
const ops = {
  // first sign-in (and later edits): the name the characters and other fans see, and their face - a photo they uploaded and
  // cropped in the page (a square JPEG, checked here), the Google one if they ask, or none. `keepPhoto`: a name-only edit.
  async profile(uid, d, auth) {
    if (isOwner(auth)) {
      const was = (await db.collection('fans').doc(uid).get()).exists;
      await db.collection('fans').doc(uid).set({ ...OFFICIAL, ...(was ? {} : { follows: [], created: FieldValue.serverTimestamp() }) }, { merge: true });
      return { ok: true, fan: OFFICIAL };
    }
    const nick = oneLine(d.nick, 24);
    if (nick.length < 2) fail('invalid-argument', 'nick_short');
    if (reserved(nick)) fail('invalid-argument', 'nick_bad');
    if (!(await moderate(nick)).ok) fail('invalid-argument', 'nick_bad');
    const ref = db.collection('fans').doc(uid);
    const was = (await ref.get()).exists;
    let photo = d.usePhoto && auth.token.picture ? String(auth.token.picture) : null, unchecked = false;
    if (typeof d.photoData === 'string' && d.photoData) {
      const jpg = Buffer.from(d.photoData, 'base64');
      if (jpg.length > 600e3 || jpg[0] !== 0xff || jpg[1] !== 0xd8) fail('invalid-argument', 'photo_bad_file');
      const check = await moderateImage(`data:image/jpeg;base64,${d.photoData}`);
      if (!check.ok) fail('invalid-argument', 'photo_bad');
      unchecked = !!check.unchecked;
      const path = `verse/fans/${uid}/${Date.now()}.jpg`;
      await admin.storage().bucket(BUCKET).file(path).save(jpg, { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
      photo = publicUrl(path);
    }
    const fan = { nick, ...(d.keepPhoto && !d.photoData ? {} : { photo, photoUnchecked: unchecked }) };
    await ref.set({ ...fan, ...(was ? {} : { follows: [], created: FieldValue.serverTimestamp() }) }, { merge: true });
    if (!was) {
      await note(uid, { kind: 'welcome', text: nick });
      await recentNews(uid).catch((e) => console.error('recentNews', e.message));
    }
    return { ok: true, fan };
  },

  async follow(uid, d) {
    if (!idOk(d.char)) fail('invalid-argument', 'char');
    await fanOf(uid);
    await db.collection('fans').doc(uid).update({ follows: d.on === false ? FieldValue.arrayRemove(d.char) : FieldValue.arrayUnion(d.char) });
    return { ok: true };
  },

  async save(uid, d) {
    if (!idOk(d.videoId)) fail('invalid-argument', 'video');
    const ref = db.collection('fans').doc(uid).collection('saves').doc(d.videoId);
    if (d.on === false) await ref.delete(); else await ref.set({ t: FieldValue.serverTimestamp() });
    return { ok: true };
  },

  // ---------- daily records (verse/records.js; his ask 2026-11-03) ----------
  // A game reports its final score (game-frame.js VerseFrame.score); each fan keeps their best of the Israeli day per
  // game (records/<game>_<day>/players/<uid>), and the day's doc holds the top 10 everyone reads (nickname + Google first
  // name only). Whoever loses first place hears about it (bell + push). Browser scores can be faked - a daily cap on
  // sends and the game's own max keep it a fun board.
  async score(uid, d, auth) {
    const g = (await _canon()).games?.[d.game];
    if (!g || !g.record) fail('not-found', 'game');
    const value = Math.round(Number(d.value) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value > (g.record.max || 1e7)) fail('invalid-argument', 'value');
    const fan = await fanOf(uid);
    if (!(await spend('score', uid, SCORES_A_DAY))) fail('resource-exhausted', 'slow_down');
    const low = g.record.better === 'low', beats = (a, b) => (low ? a < b : a > b);
    const day = dayIL(), dayRef = db.collection('records').doc(`${d.game}_${day}`), mine = dayRef.collection('players').doc(uid);
    const first = String(auth?.token?.name || '').trim().split(/\s+/)[0].slice(0, 20) || null;
    const r = await db.runTransaction(async (tx) => {
      const [m, dd] = await Promise.all([tx.get(mine), tx.get(dayRef)]);
      const was = m.exists ? m.data().value : null;
      if (was !== null && !beats(value, was)) return { best: false, value: was };
      const top = (dd.data()?.top || []).filter((x) => x.uid !== uid);
      const leader = (dd.data()?.top || [])[0] || null;
      top.push({ uid, nick: fan.nick, first, photo: fan.photo || null, value, t: Date.now() });
      top.sort((a, b) => (low ? a.value - b.value : b.value - a.value) || a.t - b.t);
      tx.set(mine, { value, t: FieldValue.serverTimestamp() });
      tx.set(dayRef, { game: d.game, day, top: top.slice(0, 10), players: FieldValue.increment(m.exists ? 0 : 1) }, { merge: true });
      const firstNow = top[0].uid === uid;
      return { best: true, value, first: firstNow, passed: firstNow && leader && leader.uid !== uid ? leader : null, opened: firstNow && !leader };
    });
    const place = (await dayRef.collection('players').where('value', low ? '<' : '>', r.value).count().get()).data().count + 1;
    if (r.passed) {
      await note(r.passed.uid, { kind: 'record', game: d.game, from: fan.nick, photo: fan.photo || null, text: g.title, value: r.value, unit: g.record.unit }).catch(() => {});
      await push([r.passed.uid], { title: RECORD_PUSH.title, body: RECORD_PUSH.body(fan.nick, g.title, fmtScore(r.value), g.record.unit),
        url: `/play/${d.game}?records=1`, icon: fan.photo || ICON, badge: BADGE, tag: 'record_' + d.game }).catch(() => {});
    }
    return { ok: true, best: r.best, value: r.value, place, first: !!r.first, passed: r.passed ? { nick: r.passed.nick, photo: r.passed.photo || null, value: r.passed.value } : null };
  },

  async rank(uid, d) {
    const g = (await _canon()).games?.[d.game];
    if (!g || !g.record) fail('not-found', 'game');
    const dayRef = db.collection('records').doc(`${d.game}_${dayIL()}`);
    const m = await dayRef.collection('players').doc(uid).get();
    if (!m.exists) return { value: null };
    const value = m.data().value;
    const place = (await dayRef.collection('players').where('value', g.record.better === 'low' ? '<' : '>', value).count().get()).data().count + 1;
    return { value, place };
  },

  // the like on a game's page (the planet, 2026-11-03): one per fan, counted beside its comments
  async heart(uid, d) {
    if (!idOk(d.id)) fail('invalid-argument', 'id');
    await fanOf(uid);
    const mine = db.collection('fans').doc(uid).collection('hearts').doc(d.id), stats = db.collection('videoStats').doc(d.id);
    await db.runTransaction(async (tx) => {
      const had = (await tx.get(mine)).exists, on = d.on !== false;
      if (had === on) return;
      if (on) tx.set(mine, { t: FieldValue.serverTimestamp() }); else tx.delete(mine);
      tx.set(stats, { hearts: FieldValue.increment(on ? 1 : -1) }, { merge: true });
    });
    return { ok: true };
  },

  async comment(uid, d) {
    if (!idOk(d.videoId)) fail('invalid-argument', 'video');
    const text = clip(String(d.text || '').trim(), COMMENT_MAX);
    if (!text) fail('invalid-argument', 'empty');
    if (burst('c' + uid, 8, 60e3)) fail('resource-exhausted', 'slow_down');
    const fan = await fanOf(uid);
    let parentId = null;
    if (d.parentId) {
      if (!idOk(d.parentId)) fail('invalid-argument', 'parent');
      const parent = await db.collection('comments').doc(d.parentId).get();
      if (!parent.exists || parent.data().videoId !== d.videoId) fail('not-found', 'parent');
      parentId = parent.data().parentId || parent.id;   // one level of replies, like a conversation under the comment
    }
    const m = await moderate(text);
    if (!m.ok) fail('invalid-argument', 'text_bad');
    // @character: the character answers (verseOnComment), a few times a day per fan
    let mention = null;
    if (idOk(d.mention)) {
      const { byId } = await _canon();
      if (byId[d.mention] && text.includes('@' + byId[d.mention].name)) mention = d.mention;
    }
    const doc = {
      videoId: d.videoId, parentId, uid, nick: fan.nick, photo: fan.photo || null, ...(fan.official ? { official: true } : {}), text, mention,
      replyTo: d.replyTo && idOk(d.replyTo) ? d.replyTo : null,
      likeCount: 0, replyCount: 0, hidden: false, ...(m.unchecked ? { unchecked: true } : {}), t: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('comments').add(doc);
    await Promise.all([
      db.collection('videoStats').doc(d.videoId).set({ comments: FieldValue.increment(1) }, { merge: true }),
      parentId && db.collection('comments').doc(parentId).update({ replyCount: FieldValue.increment(1) }),
    ]);
    return { ok: true, id: ref.id, mention };
  },

  // likes on comments (never on videos); a fan's likes live under the fan, so the page reads them in one query
  async like(uid, d) {
    if (!idOk(d.commentId)) fail('invalid-argument', 'comment');
    const c = db.collection('comments').doc(d.commentId);
    const mine = db.collection('fans').doc(uid).collection('likes').doc(d.commentId);
    const r = await db.runTransaction(async (tx) => {
      const [cs, ms] = await Promise.all([tx.get(c), tx.get(mine)]);
      if (!cs.exists) fail('not-found', 'comment');
      const on = d.on !== false;
      if (on === ms.exists) return { n: cs.data().likeCount || 0, cm: cs.data(), changed: false };
      tx.update(c, { likeCount: FieldValue.increment(on ? 1 : -1) });
      if (on) tx.set(mine, { videoId: cs.data().videoId, t: FieldValue.serverTimestamp() }); else tx.delete(mine);
      return { n: (cs.data().likeCount || 0) + (on ? 1 : -1), cm: cs.data(), changed: on };
    });
    // the writer hears about it: one line per comment that keeps its count (like the stickers' stamps), a push only at
    // 1, 5, 10, 25... so a popular comment doesn't buzz the phone all day
    const cm = r.cm;
    if (r.changed && cm.uid && cm.uid !== uid) {
      const liker = (await db.collection('fans').doc(uid).get()).data() || {};
      await db.collection('fans').doc(cm.uid).collection('notes').doc('likes_' + d.commentId).set({ kind: 'like', videoId: cm.videoId, commentId: cm.parentId || d.commentId,
        focus: d.commentId, text: String(cm.text || '').slice(0, 140), n: r.n, from: liker.nick || null, photo: liker.photo || null, read: false, t: FieldValue.serverTimestamp() });
      if ([1, 5, 10, 25, 50, 100, 250, 500, 1000].includes(r.n)) {
        await push([cm.uid], { title: r.n === 1 ? `אהבתי מ${liker.nick || 'מישהו בשלומיוורס'}` : `${r.n} אהבו את התגובה שלכם`, body: `"${String(cm.text || '').slice(0, 90)}"`,
          url: `${await pageOf(cm.videoId)}?c=${d.commentId}`, icon: ICON, badge: BADGE, tag: 'likes_' + d.commentId });
      }
    }
    return { ok: true, likeCount: r.n };
  },

  async deleteComment(uid, d) {
    if (!idOk(d.id)) fail('invalid-argument', 'comment');
    const ref = db.collection('comments').doc(d.id);
    const c = await ref.get();
    if (!c.exists || c.data().uid !== uid) fail('permission-denied', 'not_yours');
    await ref.update({ hidden: true, removedBy: 'fan' });
    await db.collection('videoStats').doc(c.data().videoId).set({ comments: FieldValue.increment(-1) }, { merge: true });
    return { ok: true };
  },

  // sticker from the moment: the frame the fan paused on -> a die-cut sticker with their text, kept as a draft until
  // they post it
  async sticker(uid, d) {
    if (!idOk(d.videoId) || !idOk(d.char || 'x')) fail('invalid-argument', 'video');
    const text = oneLine(d.text, 40);
    if (!text) fail('invalid-argument', 'empty');
    const frame = String(d.frame || '').replace(/^data:image\/jpeg;base64,/, '');
    if (frame.length < 1000 || frame.length > 2.5e6) fail('invalid-argument', 'frame');
    const fan = await fanOf(uid);
    const m = await moderate(text);
    if (!m.ok) fail('invalid-argument', 'text_bad');
    if (!(await spend('sticker', uid, STICKERS_A_DAY))) fail('resource-exhausted', 'quota');
    let png;
    try { png = await makeSticker(frame, text); } catch (e) {
      await refund('sticker', uid);
      console.error('sticker failed', e.message);
      fail(e.refused ? 'invalid-argument' : 'unavailable', e.refused ? 'image_refused' : 'image_failed');
    }
    const ref = db.collection('stickers').doc();
    const path = `verse/stickers/${ref.id}.webp`;
    await admin.storage().bucket(BUCKET).file(path).save(png, { contentType: 'image/webp', resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
    const doc = { videoId: d.videoId, char: d.char || null, at: Math.max(0, Number(d.at) || 0), text, img: publicUrl(path), uid, nick: fan.nick, photo: fan.photo || null, ...(fan.official ? { official: true } : {}),
      status: 'draft', stampCount: 0, hidden: false, t: FieldValue.serverTimestamp() };
    await ref.set(doc);
    return { ok: true, id: ref.id, img: doc.img, left: await quotaLeft('sticker', uid, STICKERS_A_DAY) };
  },

  async publishSticker(uid, d) {
    if (!idOk(d.id)) fail('invalid-argument', 'sticker');
    const ref = db.collection('stickers').doc(d.id);
    const s = await ref.get();
    if (!s.exists || s.data().uid !== uid) fail('permission-denied', 'not_yours');
    if (s.data().status === 'live') return { ok: true };
    await ref.update({ status: 'live', live: FieldValue.serverTimestamp() });
    await db.collection('videoStats').doc(s.data().videoId).set({ stickers: FieldValue.increment(1) }, { merge: true });
    return { ok: true };
  },

  async stickerQuota(uid) { return { left: await quotaLeft('sticker', uid, STICKERS_A_DAY), perDay: STICKERS_A_DAY }; },

  // the character's stamp is the like on a sticker. The sticker's maker hears about it at 1, 5, 10, 25, 50, 100... -
  // one bell item per sticker that keeps its count, never one push per stamp
  async stamp(uid, d) {
    if (!idOk(d.stickerId)) fail('invalid-argument', 'sticker');
    const s = db.collection('stickers').doc(d.stickerId);
    const mine = db.collection('fans').doc(uid).collection('stamps').doc(d.stickerId);
    const r = await db.runTransaction(async (tx) => {
      const [ss, ms] = await Promise.all([tx.get(s), tx.get(mine)]);
      if (!ss.exists || ss.data().status !== 'live') fail('not-found', 'sticker');
      const on = d.on !== false;
      if (on === ms.exists) return { n: ss.data().stampCount, sticker: ss.data(), changed: false };
      tx.update(s, { stampCount: FieldValue.increment(on ? 1 : -1) });
      if (on) tx.set(mine, { videoId: ss.data().videoId, t: FieldValue.serverTimestamp() }); else tx.delete(mine);
      return { n: ss.data().stampCount + (on ? 1 : -1), sticker: ss.data(), changed: on };
    });
    const st = r.sticker;
    if (r.changed && st.uid !== uid) {
      const ref = db.collection('fans').doc(st.uid).collection('notes').doc('stamps_' + d.stickerId);
      await ref.set({ kind: 'stamp', stickerId: d.stickerId, videoId: st.videoId, char: st.char, img: st.img, text: st.text, n: r.n, read: false, t: FieldValue.serverTimestamp() });
      if ([1, 5, 10, 25, 50, 100, 250, 500, 1000].includes(r.n)) {
        await push([st.uid], { title: r.n === 1 ? 'מישהו החתים את הסטיקר שלכם' : `${r.n} החתמות על הסטיקר שלכם`, body: `"${st.text}"`,
          url: `${await pageOf(st.videoId)}?sticker=${d.stickerId}`, icon: ICON, badge: BADGE, image: st.img, tag: 'stamps_' + d.stickerId });
      }
    }
    return { ok: true, stampCount: r.n };
  },

  // "what's next in the Shlomiverse": a viewer's idea goes on the public wall (checked first; Shlomi can hide any)
  async idea(uid, d) {
    const fan = await fanOf(uid);
    const text = oneLine(d.text, 300);
    if (text.length < 4) fail('invalid-argument', 'empty');
    const kind = ['episode', 'character', 'meet', 'other'].includes(d.kind) ? d.kind : 'other';
    const chars = (Array.isArray(d.chars) ? d.chars : []).filter(idOk).slice(0, 3);
    if (burst('i' + uid, 3, 60e3)) fail('resource-exhausted', 'slow_down');
    if (!(await spend('idea', uid, IDEAS_A_DAY))) fail('resource-exhausted', 'quota');
    const m = await moderate(text);
    if (!m.ok) { await refund('idea', uid); fail('invalid-argument', 'text_bad'); }
    const ref = await db.collection('ideas').add({ text, kind, chars, uid, nick: fan.nick, photo: fan.photo || null, ...(fan.official ? { official: true } : {}), votes: 0, hidden: false,
      unchecked: !!m.unchecked, t: FieldValue.serverTimestamp() });
    return { ok: true, id: ref.id };
  },

  // +1 on an idea (the planet, never a heart); the idea's writer hears at 1, 5, 10, 25...
  async vote(uid, d) {
    if (!idOk(d.ideaId)) fail('invalid-argument', 'idea');
    const voter = await fanOf(uid);
    const ref = db.collection('ideas').doc(d.ideaId);
    const mine = db.collection('fans').doc(uid).collection('votes').doc(d.ideaId);
    const r = await db.runTransaction(async (tx) => {
      const [is, ms] = await Promise.all([tx.get(ref), tx.get(mine)]);
      if (!is.exists || is.data().hidden) fail('not-found', 'idea');
      const on = d.on !== false;
      if (on === ms.exists) return { n: is.data().votes || 0, idea: is.data(), changed: false };
      tx.update(ref, { votes: FieldValue.increment(on ? 1 : -1) });
      if (on) tx.set(mine, { t: FieldValue.serverTimestamp() }); else tx.delete(mine);
      // who voted, kept private (ideaVoters/<idea>): they hear when it goes live (ideaStatus)
      tx.set(db.collection('ideaVoters').doc(d.ideaId), { uids: on ? FieldValue.arrayUnion(uid) : FieldValue.arrayRemove(uid) }, { merge: true });
      return { n: (is.data().votes || 0) + (on ? 1 : -1), idea: is.data(), changed: on };
    });
    const idea = r.idea;
    // his own +1 (the official Shlomiverse account) = "השלומיוורס אהב": the writer gets that (bell, push, mail), not a plain +1
    if (r.changed && voter.official && !idea.status) { await ideaStep(d.ideaId, 'liked'); return { ok: true, votes: r.n, liked: true }; }
    if (r.changed && idea.uid && idea.uid !== uid) {
      await db.collection('fans').doc(idea.uid).collection('notes').doc('votes_' + d.ideaId).set({ kind: 'vote', ideaId: d.ideaId, text: idea.text.slice(0, 140), n: r.n,
        read: false, t: FieldValue.serverTimestamp() });
      if ([1, 5, 10, 25, 50, 100, 250, 500, 1000].includes(r.n)) {
        await push([idea.uid], { title: r.n === 1 ? '+1 לרעיון שלכם' : `${r.n} הצביעו לרעיון שלכם`, body: `"${idea.text.slice(0, 90)}"`,
          url: `/community?idea=${d.ideaId}`, icon: ICON, badge: BADGE, tag: 'votes_' + d.ideaId });
      }
    }
    return { ok: true, votes: r.n };
  },

  async pushSub(uid, d) {
    const sub = d.sub;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) fail('invalid-argument', 'sub');
    const id = crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 40);
    await db.collection('pushSubs').doc(id).set({ uid, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, ua: oneLine(d.ua, 120), t: FieldValue.serverTimestamp() });
    return { ok: true, vapid: vapidPublic() };
  },
  async pushUnsub(uid, d) {
    if (typeof d.endpoint !== 'string') fail('invalid-argument', 'sub');
    const id = crypto.createHash('sha256').update(d.endpoint).digest('hex').slice(0, 40);
    const ref = db.collection('pushSubs').doc(id);
    const s = await ref.get();
    if (s.exists && s.data().uid === uid) await ref.delete();
    return { ok: true };
  },
  async pushTest(uid) {
    const fan = await fanOf(uid);
    const n = await push([uid], { title: 'השלומיוורס', body: `ההתראות פועלות, ${fan.nick}.`, url: '/notes', icon: ICON, badge: BADGE, tag: 'test' });
    return { ok: true, sent: n };
  },

  async readNotes(uid) {
    const snap = await db.collection('fans').doc(uid).collection('notes').where('read', '==', false).limit(200).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
    return { ok: true, n: snap.size };
  },
};

// the guide's smart contact: "can't find a video?" / collaborations / a bug. Signed in only (his rule, 2026-11-01:
// everyone who sends anything is a Google account, so he has their email) - the account's email is the way back
// when no other contact was typed.
async function request(d, auth, ip) {
  if (!auth?.token?.email) fail('unauthenticated', 'sign_in');
  if (burst('r' + ip, 4, 3600e3)) fail('resource-exhausted', 'slow_down');
  const kind = ['video', 'business', 'bug'].includes(d.kind) ? d.kind : 'contact';
  const text = clip(String(d.text || '').trim(), 3000);
  if (text.length < 3) fail('invalid-argument', 'empty');
  const contact = oneLine(d.contact, 160) || auth.token.email;
  const doc = { kind, text, contact, email: auth.token.email, uid: auth.uid, nick: null, t: FieldValue.serverTimestamp(), done: false };
  // the business page: who, which company, about what (the email is the way back)
  if (kind === 'business') Object.assign(doc, { name: oneLine(d.name, 80), company: oneLine(d.company, 120), topic: oneLine(d.topic, 40) });
  // "something isn't working": the page, the device and the page's last errors, so it can be fixed without asking back
  if (kind === 'bug') Object.assign(doc, { page: oneLine(d.page, 300), ua: oneLine(d.ua, 300), screen: oneLine(d.screen, 20),
    errors: (Array.isArray(d.errors) ? d.errors : []).slice(0, 5).map((x) => oneLine(x, 200)) });
  if (['video', 'contact'].includes(kind)) doc.from = d.from === 'community' ? 'community' : 'chat';
  if (auth?.uid) doc.nick = ((await db.collection('fans').doc(auth.uid).get()).data() || {}).nick || null;
  const ref = await db.collection('requests').add(doc);
  // the person hears back right away (mailer.js), from the Shlomiverse
  const back = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) ? contact : auth.token.email;
  require('./mailer').reply('verse-' + kind, { email: back, name: doc.name || auth.token.name || doc.nick || '', uid: auth.uid }).catch(() => {});
  const subject = kind === 'bug' ? `שלומיוורס | משהו לא עובד${doc.nick ? ' · ' + doc.nick : ''}`
    : kind === 'business' ? `שלומיוורס | שיתוף פעולה · ${doc.company || doc.name || 'עסק'}${doc.topic ? ' · ' + doc.topic : ''}`
    : kind === 'video' ? `שלומיוורס | מחפשים סרטון${doc.nick ? ' · ' + doc.nick : ''}` : `שלומיוורס | פנייה${doc.nick ? ' · ' + doc.nick : ''}`;
  const where = kind === 'bug' ? 'דיווח תקלה' : kind === 'business' ? 'מעמוד העסקים' : d.from === 'community' ? 'מעמוד הקהילה' : 'דרך המדריך בצ׳אט';
  const body = [...(kind === 'bug' ? [`${doc.page}`, `${doc.ua} · ${doc.screen}`, ...(doc.errors.length ? ['שגיאות: ' + doc.errors.join(' | ')] : []), ''] : []),
    ...(kind === 'business' ? [`${doc.name || '-'} · ${doc.company || '-'}${doc.topic ? ' · ' + doc.topic : ''}`, ''] : []), text, '', `איך לחזור: ${contact || '-'}`,
    `חשבון Google: ${doc.email}${doc.nick ? ` · בשלומיוורס: ${doc.nick}` : ''}`, '', `${where} · ${new Date().toISOString()} · ${ref.id}`].join('\n');
  if (LOCAL) console.log('[local] request mail not sent:', subject, '\n' + body);
  else {
    try {
      const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
      const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) ? contact : null;
      await t.sendMail({ from: `השלומיוורס <${GMAIL_USER.value()}>`, to: TO, ...(email ? { replyTo: email } : {}), subject, text: body });
    } catch (e) { console.error('request mail failed (kept in Firestore)', e.message); }
  }
  return { ok: true };
}

exports.verse = onCall({ region: REGION, secrets: SECRETS, cors: CORS, maxInstances: 6, concurrency: 40, memory: '512MiB', timeoutSeconds: 120 }, async (req) => {
  const { op, ...d } = req.data || {};
  if (op === 'request') return request(d, req.auth, req.rawRequest.ip);
  if (!req.auth) fail('unauthenticated', 'sign_in');
  if (!ops[op]) fail('invalid-argument', 'op');
  if (burst('u' + req.auth.uid, 120, 60e3)) fail('resource-exhausted', 'slow_down');
  return ops[op](req.auth.uid, d, req.auth);
});

// ---------- a new comment: the character answers, the replied-to fan hears ----------
// a Firestore trigger runs where the database is (me-west1)
exports.verseOnComment = onDocumentCreated({ document: 'comments/{id}', region: 'me-west1', secrets: SECRETS, memory: '512MiB', timeoutSeconds: 120 }, async (event) => {
  const c = event.data?.data();
  if (!c || c.char) return;   // a character's own reply triggers nothing
  const id = event.params.id;
  const { byId, videos, games } = await _canon();
  const video = videos[c.videoId], game = games && games[c.videoId];
  const url = `/${game ? 'play' : 'v'}/${c.videoId}?c=${c.parentId || id}`;

  // a fan replied to someone: that someone hears about it
  if (c.parentId) {
    const target = c.replyTo ? (await db.collection('comments').doc(c.replyTo).get()).data() : (await db.collection('comments').doc(c.parentId).get()).data();
    if (target?.uid && target.uid !== c.uid) {
      await note(target.uid, { kind: 'reply', videoId: c.videoId, commentId: c.parentId, from: c.nick, photo: c.photo || null, text: c.text.slice(0, 140) });
      await push([target.uid], { title: `תשובה מ${c.nick}`, body: c.text.slice(0, 140), url, icon: c.photo || ICON, badge: BADGE, tag: 'reply_' + c.parentId });
    }
  }

  // @character
  const who = c.mention && byId[c.mention];
  if (!who) return;
  if (!(await spend('reply', c.uid, CHARACTER_REPLIES_A_DAY))) return;
  let thread = [];
  if (c.parentId) {
    const prev = await db.collection('comments').where('parentId', '==', c.parentId).orderBy('t').limit(12).get().catch(() => null);
    const root = (await db.collection('comments').doc(c.parentId).get()).data();
    thread = [root, ...(prev ? prev.docs.map((x) => x.data()) : [])].filter((x) => x && x.text !== c.text).slice(-8)
      .map((x) => `${x.char ? byId[x.char]?.name || x.nick : x.nick}: ${x.text}`);
  }
  const turn = [
    video ? `את/ה בתגובות מתחת לסרטון "${video.title}" (${video.teaser || ''}). מה שנאמר בסרטון:\n${(video.transcript || '').slice(0, 6000)}`
      : game ? `את/ה בתגובות מתחת למשחק "${game.title}"${game.tagline ? ` (${game.tagline})` : ''}, משחק קצר בשלומיוורס.`
      : 'את/ה בתגובות מתחת לאחד הסרטונים.',
    thread.length ? `\nהשיחה בתגובות עד עכשיו:\n${thread.join('\n')}` : '',
    `\n${c.nick} כתב/ה עכשיו בתגובות, ותייג/ה אותך: "${c.text}"`,
    '\nענה/י כמו תגובה ברשת: משפט או שניים, בקול שלך, ישר אל ' + c.nick + '. בלי כרטיסים [[...]], בלי האשטגים, בלי לצטט את ההנחיות.',
  ].join('\n');
  let reply = '';
  try {
    await _stream(openaiKey(), who.id, [{ role: 'user', content: turn }], (t) => { reply += t; });
  } catch (e) { console.error('character reply failed', e.message); await refund('reply', c.uid); return; }
  reply = reply.replace(/\[\[[^\]]*\]\]/g, '').trim().slice(0, 600);
  if (!reply) return;
  const root = c.parentId || id;
  await db.collection('comments').add({ videoId: c.videoId, parentId: root, replyTo: id, uid: null, char: who.id, nick: who.name, photo: null, text: reply,
    likeCount: 0, replyCount: 0, hidden: false, t: FieldValue.serverTimestamp() });
  await Promise.all([
    db.collection('comments').doc(root).update({ replyCount: FieldValue.increment(1) }),
    db.collection('videoStats').doc(c.videoId).set({ comments: FieldValue.increment(1) }, { merge: true }),
    note(c.uid, { kind: 'reply', videoId: c.videoId, commentId: root, char: who.id, from: who.name, text: reply.slice(0, 140) }),
  ]);
  await push([c.uid], { title: `תשובה מ${who.name}`, body: reply.slice(0, 140), url, icon: faceUrl(who.id), badge: BADGE, tag: 'reply_' + root });
});

// an idea's step, from /backstage/ (ideaStatus) or from his own +1 on the wall (vote, his official account = liked)
async function ideaStep(id, status, vid) {
  const ref = db.collection('ideas').doc(id), was = await ref.get();
  if (!was.exists) return { error: 'idea' };
  const x = was.data(), videoId = status === 'live' ? String(vid || '').trim() : null;
  if (status === 'live' && !idOk(videoId)) return { error: 'video' };
  const first = status !== 'new' && !(x.told || {})[status];
  await ref.update({ status: status === 'new' ? FieldValue.delete() : status, statusAt: FieldValue.serverTimestamp(), videoId: videoId || FieldValue.delete(),
    ...(first ? { ['told.' + status]: FieldValue.serverTimestamp() } : {}) });
  let voters = 0;
  if (first && x.uid && !x.official) {
    const c = IDEA_COPY[status], url = status === 'live' ? await pageOf(videoId) : `/community?idea=${id}`;
    await db.collection('fans').doc(x.uid).collection('notes').add({ kind: 'idea', status, ideaId: id, videoId, text: x.text.slice(0, 140), read: false, t: FieldValue.serverTimestamp() });
    await push([x.uid], { title: c.title, body: c.body.replace('{idea}', clip(x.text, 80)), url, icon: ICON, badge: BADGE, tag: 'idea_' + id });
    await require('./mailer').ideaMail({ uid: x.uid, nick: x.nick, ideaId: id, text: x.text, status, videoId }).catch((e) => console.error('idea mail', e.message));
  }
  if (first && status === 'live') {
    const vs = (((await db.collection('ideaVoters').doc(id).get()).data() || {}).uids || []).filter((u) => u !== x.uid);
    voters = vs.length;
    if (vs.length) {
      const batch = db.batch();
      vs.slice(0, 450).forEach((u) => batch.set(db.collection('fans').doc(u).collection('notes').doc(), { kind: 'idea', status: 'liveVoter', ideaId: id, videoId, text: x.text.slice(0, 140), read: false, t: FieldValue.serverTimestamp() }));
      await batch.commit();
      await push(vs, { title: IDEA_COPY.liveVoter.title, body: IDEA_COPY.liveVoter.body, url: await pageOf(videoId), icon: ICON, badge: BADGE, tag: 'idea_' + id });
    }
  }
  return { told: first, voters };
}

// ---------- Shlomi's page ----------
const wrongKey = new Map();
function ownerOk(req, res) {
  const auth = req.get('authorization') || '';
  if (!auth.startsWith('Key ')) { res.status(401).json({ error: 'key' }); return false; }
  // locally (the emulators only) a test key from .env.local works too, so the page can be tried without his real key
  if (LOCAL && process.env.VERSE_LOCAL_OWNER_KEY && auth.slice(4) === process.env.VERSE_LOCAL_OWNER_KEY) return true;
  const now = Date.now(), fails = (wrongKey.get(req.ip) || []).filter((t) => now - t < 3600e3);
  if (fails.length >= 10) { res.status(429).json({ error: 'too_many' }); return false; }
  const got = crypto.createHash('sha256').update(auth.slice(4)).digest();
  if (!crypto.timingSafeEqual(got, Buffer.from(OWNER_KEY_SHA256, 'hex'))) { fails.push(now); wrongKey.set(req.ip, fails); res.status(401).json({ error: 'key' }); return false; }
  return true;
}
// a story's picture or short clip comes as multipart: `file`, and for a clip its cover picture as `poster` (its first
// moment - scripts/stories/video.mjs or /backstage/ make it), shown while it loads, blurred around it and in the push
function parseStory(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null, poster = null, tooBig = false;
    const bb = Busboy({ headers: req.headers, defCharset: 'utf8', defParamCharset: 'utf8', limits: { fileSize: 30 * 1024 * 1024, files: 2, fields: 12, fieldSize: 12000 } });
    bb.on('field', (k, v) => { fields[k] = String(v); });
    bb.on('file', (k, stream, info) => {
      const chunks = [];
      stream.on('data', (x) => chunks.push(x));
      stream.on('limit', () => { tooBig = true; });
      stream.on('end', () => { const f = { type: info.mimeType, data: Buffer.concat(chunks) }; if (k === 'poster') poster = f; else file = f; });
    });
    bb.on('error', reject);
    bb.on('close', () => resolve({ fields, file, poster, tooBig }));
    bb.end(req.rawBody);
  });
}
const MEDIA = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };
// a story's words as boxes on its 9:16 stage (v2/site/verse/story-art.js draws them; the same names and limits there):
// up to 8, each up to 300 characters; places in % of the stage. Anything else is dropped. null = no / broken boxes field.
const BOX_ST = ['box', 'glass', 'line', 'outline', 'shadow', 'bubble', 'note', 'tag'];
const BOX_F = ['heebo', 'rubik', 'secular', 'suez', 'frank', 'amatic', 'karantina', 'varela'];
const boxColor = (v) => (v === 'char' || /^#[0-9a-f]{3,8}$/i.test(v || '') || /^rgba?\([\d.,\s%]+\)$/.test(v || '') ? String(v) : null);
function cleanBoxes(raw) {
  if (raw == null || raw === '') return null;
  let list; try { list = JSON.parse(raw); } catch (e) { return null; }
  if (!Array.isArray(list)) return null;
  const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x)) * 100) / 100 : d; };
  return list.slice(0, 8).map((b) => {
    const t = clip(String(b?.t || '').replace(/\r/g, '').trim(), 300);
    if (!t) return null;
    const o = { t, x: n(b.x, 50, 0, 100), y: n(b.y, 50, 0, 100), w: n(b.w, 80, 10, 100), s: n(b.s, 6, 2, 22), st: BOX_ST.includes(b.st) ? b.st : 'box' };
    if (BOX_F.includes(b.f)) o.f = b.f;
    if (boxColor(b.c)) o.c = boxColor(b.c);
    if (boxColor(b.bg)) o.bg = boxColor(b.bg);
    if (['right', 'center', 'left'].includes(b.al)) o.al = b.al;
    if (b.r != null) o.r = n(b.r, 0, -30, 30);
    if ([400, 700, 800, 900].includes(Number(b.wt))) o.wt = Number(b.wt);
    if (['br', 'bl', 'tr', 'tl', 'none'].includes(b.tail)) o.tail = b.tail;
    return o;
  }).filter(Boolean);
}
// a story's button: an address on the web, a page of this site (/hani-games/...) or a place in the wiki (#/c/hani);
// null = none, false = not a link
const storyLink = (f) => {
  const url = String(f.link || '').trim();
  if (!url) return null;
  if (!/^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*|#\/[^\s"'<>]*)$/.test(url) || url.length > 500) return false;
  return { url, label: clip(oneLine(f.linkLabel || '', 40), 40) || 'לפתוח' };
};
const saveFile = async (path, f) => { await admin.storage().bucket(BUCKET).file(path).save(f.data, { contentType: f.type, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } }); return publicUrl(path); };
async function saveStoryMedia(id, file, poster) {
  const ext = MEDIA[file.type];
  if (!ext) return null;
  const base = `verse/stories/${id}${file.v ? '-' + file.v : ''}`;
  const media = { url: await saveFile(`${base}.${ext}`, file), kind: file.type.startsWith('video/') ? 'video' : 'image' };
  if (media.kind === 'video' && poster?.data.length && POSTER[poster.type]) media.poster = await saveFile(`${base}-poster.${POSTER[poster.type]}`, poster);
  return media;
}
const POSTER = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// ---------- a new video: everyone who follows someone in its cast hears about it, once ----------
async function announceVideo(videoId, v, again = false) {
  const flag = db.collection('announced').doc(videoId);
  if ((await flag.get()).exists && !again) return null;
  const { byId } = await _canon();
  // a video whose cast is missing in the data still reaches the right followers: the character named in its id
  // (demokratovich-nechama -> demokratovich, hani-games-promo -> hani), the same fallback the video page uses
  let cast = (v.cast || []).filter(idOk);
  if (!cast.length) cast = Object.keys(byId).filter((id) => videoId === id || videoId.startsWith(id + '-') || videoId.split('-').includes(id)).slice(0, 2);
  const lead = cast[0];
  const fans = await followersOf(cast);
  const title = byId[lead] ? `סרטון חדש מ${byId[lead].name}` : 'סרטון חדש בשלומיוורס';
  await Promise.all(fans.map((uid) => note(uid, { kind: 'video', videoId, char: lead || null, from: byId[lead]?.name || null, text: oneLine(v.title, 120), poster: v.poster || null })));
  const sent = await push(fans, { title, body: oneLine(v.title, 120), url: `/v/${videoId}`, icon: lead ? faceUrl(lead) : ICON, badge: BADGE,
    image: v.poster ? `${SITE}/wiki/${v.poster}` : undefined, tag: 'video_' + videoId });
  await flag.set({ t: FieldValue.serverTimestamp(), fans: fans.length, sent });
  return { fans: fans.length, sent };
}

// Following a character = hearing when they have a new video, whoever added it and however (Sketch Studio's publish,
// the wiki build, by hand). The wiki's own list knows which videos are history (old Instagram reels, `archive`) - those
// never ring. The very first run only writes down what already exists, so launch day doesn't send the whole back
// catalogue. At most 5 a run, so a big import never floods anyone's phone.
const WIKI_DATA = 'https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json';
async function wikiVideos() {
  const w = LOCAL ? JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../public/wiki/data/wiki.json'), 'utf8'))
    : await (await fetch(WIKI_DATA, { cache: 'no-store' })).json();
  return (w.videos || []).filter((v) => v && idOk(v.id) && !v.archive);
}
async function autoAnnounce() {
  const videos = await wikiVideos();
  const done = new Set((await db.collection('announced').get()).docs.map((d) => d.id));
  const fresh = videos.filter((v) => !done.has(v.id));
  const meta = db.collection('verseMeta').doc('autoAnnounce');
  if (!(await meta.get()).exists) {
    const batch = db.batch();
    fresh.slice(0, 450).forEach((v) => batch.set(db.collection('announced').doc(v.id), { t: FieldValue.serverTimestamp(), baseline: true }));
    batch.set(meta, { since: FieldValue.serverTimestamp(), baseline: fresh.length });
    await batch.commit();
    return { baseline: fresh.length };
  }
  const out = [];
  for (const v of fresh.slice(0, 5)) out.push({ id: v.id, ...(await announceVideo(v.id, v)) });
  if (out.length) console.log('auto announce', JSON.stringify(out));
  return { announced: out };
}
exports.verseAutoAnnounce = onSchedule({ schedule: 'every 15 minutes', region: REGION, secrets: SECRETS, timeoutSeconds: 120, memory: '512MiB' }, async () => { await autoAnnounce(); });

// every account (Firebase Auth) with where it came from - the admin page's people and its numbers
async function peopleList() {
  const users = [];
  let next;
  do { const r = await admin.auth().listUsers(1000, next); users.push(...r.users); next = r.pageToken; } while (next && users.length < 50000);
  const [fans, sites] = await Promise.all([db.collection('fans').select('nick', 'official').get(), db.collection('siteUsers').select('sites').get()]);
  const fan = Object.fromEntries(fans.docs.map((d) => [d.id, d.data()]));
  const site = Object.fromEntries(sites.docs.map((d) => [d.id, d.data().sites || []]));
  return users.map((u) => ({ uid: u.uid, email: u.email || null, name: u.displayName || null, photo: u.photoURL || null,
    created: Date.parse(u.metadata.creationTime) || null, last: Date.parse(u.metadata.lastRefreshTime || u.metadata.lastSignInTime) || null,
    google: u.providerData.length > 0, fan: u.uid in fan, nick: fan[u.uid]?.nick || null, official: !!fan[u.uid]?.official, sites: site[u.uid] || [] }));
}

// the numbers Terra answers from: 90 days of counters (without page routes / search words), every account (no emails -
// those stay here), the conversations per day and character with the latest questions, the community. Israel time.
async function askData(q) {
  const from = dayIL(new Date(Date.now() - 89 * 864e5));
  const hm = (ms) => (ms ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(ms)) : null);
  const [d, people, chats, comments, ideas, requests] = await Promise.all([
    db.collection('analytics_days').where('d', '>=', from).orderBy('d').get(),
    peopleList(),
    db.collection('chat_logs').where('t', '>=', Timestamp.fromMillis(Date.now() - 30 * 864e5)).orderBy('t', 'desc').limit(4000).select('t', 'mode', 'q', 'n', 'in', 's', 'v').get(),
    db.collection('comments').orderBy('t', 'desc').limit(300).select('t', 'videoId', 'char', 'nick').get(),
    db.collection('ideas').orderBy('t', 'desc').limit(100).select('t', 'text', 'votes', 'kind').get(),
    db.collection('requests').orderBy('t', 'desc').limit(200).select('t', 'kind', 'done', 'site').get(),
  ]);
  const days = d.docs.map((x) => {
    const v = x.data(), n = {};
    for (const [k, c] of Object.entries(v.n || {})) if (!/^(view|search|click)\|/.test(k)) n[k] = c;
    return { d: v.d, visitors: v.visitors || 0, new_visitors: v.new_visitors || 0, src: v.src || {}, dev: v.dev || {}, site_views: v.site || {}, n,
      time_on_site: v.time_n ? { visits: v.time_n, total_seconds: v.time_s || 0 } : undefined };
  });
  const perDay = {};
  for (const x of chats.docs) {
    const c = x.data(), day = dayIL(c.t.toDate()), k = `${day}|${c.mode}`;
    perDay[k] = perDay[k] || { day, character: c.mode, messages: 0, signed_in: 0, threads: new Set() };
    perDay[k].messages++; if (c.in) perDay[k].signed_in++; perDay[k].threads.add(c.s || c.v);
  }
  const pack = {
    now_israel: hm(Date.now()), today: dayIL(),
    notes: 'days[].n = event counts ("event" total, "event|x" by what: chat_message|<character id or guide>, video|<video id>, site|<site id>, game_start|<game>, sign_in|new|back, signin_ask|inapp|browser = the sign-in window opened (inapp = inside Instagram/TikTok/Facebook, where Google sign-in cannot work), tb|<i> = visits by length bucket (upper edges 5,10,20,30,45,60,90,120,180,240,300,420,600,900,1200,1800,2700,3600 s), request|<kind>, follow|<character>...). time_on_site = visits that reported time and their total active seconds (measured since 2026-11-02; average = total_seconds / visits). visitors = unique visitors that day, src = where they came from (by first visit of the day), dev = phone/desktop. people = every account (google = real Google sign-in; fan = joined the Shlomiverse with a name; sites = character sites they sent something from). chats = the chat with the characters (each visitor message = one answer).',
    characters: Object.fromEntries(Object.values((await _canon()).byId || {}).map((c) => [c.id, c.name])),
    days,
    people: people.filter((p) => p.google).map((p) => ({ joined: hm(p.created), last_seen: hm(p.last), name: p.nick || p.name || null, shlomiverse: p.fan, sites: p.sites })),
    chats_per_day: Object.values(perDay).map((x) => ({ day: x.day, character: x.character, messages: x.messages, conversations: x.threads.size, signed_in_messages: x.signed_in })),
    latest_questions: chats.docs.slice(0, 250).map((x) => { const c = x.data(); return { at: hm(c.t.toMillis()), to: c.mode, q: String(c.q || '').slice(0, 140) }; }),
    comments: comments.docs.map((x) => { const c = x.data(); return { at: hm(c.t?.toMillis?.()), video: c.videoId, by_character: c.char || null }; }),
    ideas: ideas.docs.map((x) => { const c = x.data(); return { at: hm(c.t?.toMillis?.()), text: c.text, votes: c.votes || 0, kind: c.kind }; }),
    requests: requests.docs.map((x) => { const c = x.data(); return { at: hm(c.t?.toMillis?.()), kind: c.kind, done: !!c.done, site: c.site || null }; }),
  };
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${openaiKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-terra', reasoning: { effort: 'medium' }, max_output_tokens: 4000, store: false,
      instructions: `You are the data analyst of Shlomi's admin page for שלומיוורס (his comedy universe site: videos, characters people chat with, games, character sites). Answer his question from the DATA only, in Hebrew, short and exact: first one line with the answer and the key number(s), then - only if it helps - a small markdown table (at most 12 rows) or 2-4 short bullet lines. Compute carefully (sum, compare periods, percentages). Dates are Israel time. If the data can't answer it, say exactly what is missing. Never invent numbers. No preamble.`,
      input: [{ role: 'user', content: `DATA:\n${JSON.stringify(pack)}\n\nQUESTION: ${q}` }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('ask ' + r.status + ' ' + JSON.stringify(j.error || {}).slice(0, 200));
  const answer = (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('\n').trim();
  console.log('owner ask', q.slice(0, 80), JSON.stringify(j.usage || {}));
  const u = j.usage || {};
  return { answer, cost: (((u.input_tokens || 0) - (u.input_tokens_details?.cached_tokens || 0)) * 2 + (u.input_tokens_details?.cached_tokens || 0) * 0.2 + (u.output_tokens || 0) * 12) / 1e6 };
}

exports.verseOwner = onRequest({ region: REGION, secrets: SECRETS, cors: CORS, maxInstances: 1, memory: '512MiB', timeoutSeconds: 120 }, async (req, res) => {
  if (!ownerOk(req, res)) return;
  const op = req.query.op;
  const b = req.body || {};
  try {
    // the mails: what we send, what was sent, the switch (mailer.js)
    if (String(op).startsWith('mail')) { const r = await require('./mailer').owner(op, b); if (r) return res.json(r); }
    if (op === 'list') {
      const week = Timestamp.fromMillis(Date.now() - 7 * 864e5);
      const [comments, stickers, requests, stories, announced, fans, ideas, fansWeek, auto] = await Promise.all([
        db.collection('comments').orderBy('t', 'desc').limit(120).get(),
        db.collection('stickers').where('status', '==', 'live').orderBy('t', 'desc').limit(60).get(),
        db.collection('requests').orderBy('t', 'desc').limit(60).get(),
        db.collection('stories').orderBy('t', 'desc').limit(60).get(),
        db.collection('announced').get(),
        db.collection('fans').count().get(),
        db.collection('ideas').orderBy('t', 'desc').limit(120).get(),
        db.collection('fans').where('created', '>=', week).count().get(),
        db.collection('verseMeta').doc('autoAnnounce').get(),
      ]);
      // how many follow each character (the new story window says how many a story reaches)
      const followers = {};
      (await db.collection('fans').select('follows').get()).docs.forEach((d) => (d.data().follows || []).forEach((c) => { followers[c] = (followers[c] || 0) + 1; }));
      const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data(), t: d.data().t?.toMillis?.() || null }));
      return res.json({ comments: rows(comments), stickers: rows(stickers), requests: rows(requests), stories: rows(stories),
        announced: Object.fromEntries(announced.docs.map((d) => [d.id, d.data().t?.toMillis?.() || 1])), fans: fans.data().count, ideas: rows(ideas),
        fansWeek: fansWeek.data().count, autoSince: auto.exists ? auto.data().since?.toMillis?.() || null : null, followers });
    }
    // everyone with an account (his ask, 2026-11-01): the verse's fans and whoever signed in on a character's site to
    // send something - from Firebase Auth itself, so nobody is missing, with where they came from
    if (op === 'people') return res.json({ people: await peopleList() });
    // ---------- his one admin page (2026-11-01: Backstage + the stats page, "a really admin, super powerful tool") ----------
    // the per-day counters (analytics.js) for the range and the one before it (the trend), the newest events, every account
    if (op === 'stats') {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);
      const from = dayIL(new Date(Date.now() - (2 * days - 1) * 864e5));
      const [d, ev, people] = await Promise.all([
        db.collection('analytics_days').where('d', '>=', from).orderBy('d').get(),
        db.collection('analytics_events').orderBy('t', 'desc').limit(400).get(),
        peopleList(),
      ]);
      return res.json({ days: d.docs.map((x) => x.data()), people,
        events: ev.docs.map((x) => { const e = x.data(); delete e.exp; return { ...e, t: e.t.toMillis() }; }) });
    }
    // the conversations (wiki.js keeps them): a time range (from / to in ms), or everything one account said (uid)
    if (op === 'chats') {
      const snap = req.query.uid
        ? await db.collection('chat_logs').where('uid', '==', String(req.query.uid)).limit(500).get()
        : await db.collection('chat_logs').where('t', '>=', Timestamp.fromMillis(+req.query.from || Date.now() - 864e5))
          .where('t', '<', Timestamp.fromMillis(+req.query.to || Date.now() + 6e4)).orderBy('t', 'desc').limit(3000).get();
      return res.json({ chats: snap.docs.map((x) => { const c = x.data(); delete c.exp; return { id: x.id, ...c, t: c.t.toMillis() }; }) });
    }
    // conversations he starred (the funny ones) - one list in owner/chatStars, by thread key (session|character)
    if (op === 'stars') return res.json({ stars: ((await db.collection('owner').doc('chatStars').get()).data() || {}).keys || [] });
    if (op === 'star') {
      const k = String(b.key || '').slice(0, 80);
      if (!k) return res.status(400).json({ error: 'key' });
      await db.collection('owner').doc('chatStars').set({ keys: b.on === false ? FieldValue.arrayRemove(k) : FieldValue.arrayUnion(k) }, { merge: true });
      return res.json({ ok: true });
    }
    // "שאלו את הנתונים": a question in plain words, answered by Terra from a compact pack of the real numbers
    if (op === 'ask') {
      const q = String(b.q || '').trim().slice(0, 600);
      if (!q) return res.status(400).json({ error: 'q' });
      return res.json(await askData(q));
    }
    if (op === 'hide') {
      const col = b.kind === 'sticker' ? 'stickers' : b.kind === 'story' ? 'stories' : b.kind === 'idea' ? 'ideas' : 'comments';
      if (!idOk(b.id)) return res.status(400).json({ error: 'id' });
      await db.collection(col).doc(b.id).update({ hidden: b.hidden !== false, ...(b.hidden !== false ? { removedBy: 'owner' } : {}) });
      return res.json({ ok: true });
    }
    // an idea's way (his ask, 2026-11-05): liked -> making -> live (with its video); each step tells the writer once - the
    // bell, a push and a mail (mailer.ideaMail: Shabbat and night wait, a stopped mail never goes) - and 'live' also tells
    // everyone who voted for it (bell + push). 'new' takes the mark off and tells nobody.
    // the Shlomiverse answers an idea (his ask, 2026-11-05: "I want to comment from there"): shown under it on the wall,
    // the writer gets a bell note and a push; an empty text takes the answer off (and tells nobody)
    if (op === 'ideaReply') {
      if (!idOk(b.id)) return res.status(400).json({ error: 'id' });
      const ref = db.collection('ideas').doc(b.id), was = await ref.get();
      if (!was.exists) return res.status(404).json({ error: 'idea' });
      const x = was.data(), text = clip(String(b.text || '').trim(), 600);
      await ref.update({ reply: text ? { text, t: FieldValue.serverTimestamp() } : FieldValue.delete() });
      if (text && x.uid && !x.official) {
        await db.collection('fans').doc(x.uid).collection('notes').add({ kind: 'idea', status: 'reply', ideaId: b.id, text: text.slice(0, 140), read: false, t: FieldValue.serverTimestamp() });
        await push([x.uid], { title: IDEA_COPY.reply.title, body: clip(text, 120), url: `/community?idea=${b.id}`, icon: ICON, badge: BADGE, tag: 'idea_reply_' + b.id });
      }
      return res.json({ ok: true, told: !!(text && x.uid && !x.official) });
    }
    if (op === 'ideaStatus') {
      if (!idOk(b.id) || ![...IDEA_STEPS, 'new'].includes(b.status)) return res.status(400).json({ error: 'id' });
      const r = await ideaStep(b.id, b.status, b.videoId);
      return r.error ? res.status(r.error === 'idea' ? 404 : 400).json(r) : res.json({ ok: true, ...r });
    }
    if (op === 'done') {
      if (!idOk(b.id)) return res.status(400).json({ error: 'id' });
      await db.collection('requests').doc(b.id).update({ done: b.done !== false });
      return res.json({ ok: true });
    }
    // a new video is up: everyone who follows someone in its cast hears about it, once
    if (op === 'announce') {
      if (!idOk(b.videoId)) return res.status(400).json({ error: 'video' });
      const v = b.video && typeof b.video === 'object' ? b.video : (await _canon()).videos[b.videoId];
      if (!v) return res.status(404).json({ error: 'video' });
      const r = await announceVideo(b.videoId, v, !!b.again);
      if (!r) return res.status(409).json({ error: 'already' });
      return res.json({ ok: true, ...r });
    }
    // the automatic check by hand (the schedule runs it every 15 minutes)
    if (op === 'autoAnnounce') return res.json(await autoAnnounce());
    // a character's story, written by Shlomi: a line, maybe a picture or a short clip, maybe a button with a link (a new
    // game, a video, a site); followers hear about it - or, with everyone=yes, every account (big news only, his call)
    if (op === 'story') {
      const { fields: f, file, poster, tooBig } = await parseStory(req);
      if (!idOk(f.char)) return res.status(400).json({ error: 'char' });
      if (tooBig) return res.status(400).json({ error: 'file_size' });
      // text = the line in the bell and the push (and the words, for a story from before its boxes); boxes = the words
      // as the story shows them (story-art.js)
      const text = clip(String(f.text || '').trim(), 600);
      const boxes = cleanBoxes(f.boxes);
      if (!text && !file && !boxes?.length) return res.status(400).json({ error: 'empty' });
      const link = storyLink(f);
      if (link === false) return res.status(400).json({ error: 'link' });
      const ref = db.collection('stories').doc();
      let media = null;
      if (file && file.data.length) {
        media = await saveStoryMedia(ref.id, file, poster);
        if (!media) return res.status(400).json({ error: 'file_type' });
      }
      const { byId } = await _canon();
      // 'verse' = the Shlomiverse itself (his official account): its name and logo, and nobody follows it, so its
      // notification goes to everyone
      const isVerse = f.char === 'verse';
      const name = isVerse ? OFFICIAL.nick : byId[f.char]?.name || f.char;
      const everyone = f.everyone === 'yes' || (isVerse && f.notify !== 'no');
      await ref.set({ char: f.char, text: text || (boxes || []).map((b) => b.t).join(' ').slice(0, 600), ...(boxes ? { boxes } : {}), media, link, everyone, hidden: false, t: FieldValue.serverTimestamp() });
      let fans = [], sent = 0;
      if (f.notify !== 'no' || everyone) {
        fans = everyone ? (await db.collection('fans').select().get()).docs.map((d) => d.id) : await followersOf([f.char]);
        const n = { kind: 'story', storyId: ref.id, char: f.char, from: name, text: text.slice(0, 140), read: false, t: FieldValue.serverTimestamp() };
        for (let i = 0; i < fans.length; i += 400) {   // the bell, in batches (every account can be thousands)
          const batch = db.batch();
          fans.slice(i, i + 400).forEach((uid) => batch.set(db.collection('fans').doc(uid).collection('notes').doc(), n));
          await batch.commit();
        }
        sent = await push(fans, { title: `סטורי חדש מ${name}`, body: text.slice(0, 140) || name, url: `/story/${f.char}`, icon: isVerse ? ICON : faceUrl(f.char), badge: BADGE,
          image: media?.kind === 'image' ? media.url : media?.poster, tag: 'story_' + f.char });
        await ref.update({ reach: fans.length, pushes: sent });
      }
      return res.json({ ok: true, id: ref.id, fans: fans.length, sent, everyone });
    }
    // fixing a story that is already up - its words / boxes, its button, its picture - without telling anyone again
    // (fields: id, then only what changes: boxes (JSON; '[]' = no words on it), text, link + linkLabel or noLink=yes, file,
// poster - a clip's cover, with its file or alone)
    if (op === 'storyEdit') {
      const { fields: f, file, poster, tooBig } = await parseStory(req);
      if (tooBig) return res.status(400).json({ error: 'file_size' });
      if (!/^[A-Za-z0-9]{10,40}$/.test(f.id || '')) return res.status(400).json({ error: 'story' });
      const ref = db.collection('stories').doc(f.id);
      const was = await ref.get();
      if (!was.exists) return res.status(404).json({ error: 'story' });
      const up = {};
      if (f.boxes != null) { const b = cleanBoxes(f.boxes); if (!b) return res.status(400).json({ error: 'boxes' }); up.boxes = b; }
      if (f.text != null) up.text = clip(String(f.text).trim(), 600);
      if (f.noLink === 'yes') up.link = null;
      else if (f.link != null) { const l = storyLink(f); if (l === false) return res.status(400).json({ error: 'link' }); up.link = l; }
      if (file && file.data.length) {
        const media = await saveStoryMedia(ref.id, { ...file, v: Date.now().toString(36) }, poster);
        if (!media) return res.status(400).json({ error: 'file_type' });
        up.media = media;
      } else if (poster?.data.length && was.data().media?.kind === 'video' && POSTER[poster.type]) {   // a new cover for the clip that is up
        up.media = { ...was.data().media, poster: await saveFile(`verse/stories/${ref.id}-${Date.now().toString(36)}-poster.${POSTER[poster.type]}`, poster) };
      }
      if (!Object.keys(up).length) return res.status(400).json({ error: 'empty' });
      await ref.update({ ...up, edited: FieldValue.serverTimestamp() });
      return res.json({ ok: true, id: ref.id, changed: Object.keys(up) });
    }
    return res.status(400).json({ error: 'op' });
  } catch (e) {
    console.error('verseOwner', op, e);
    return res.status(500).json({ error: 'server', message: e.message });
  }
});
