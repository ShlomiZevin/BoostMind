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

const STICKERS_A_DAY = 3;          // free stickers per fan per day (tokens later)
const CHARACTER_REPLIES_A_DAY = 10; // @character answers per fan per day
const IDEAS_A_DAY = 5;              // ideas per fan per day on the community wall
const COMMENT_MAX = 500;
const REGION = 'europe-west1';
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];

// ---------- small helpers ----------
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const clip = (v, n) => String(v ?? '').replace(/\s+$/g, '').slice(0, n);
const oneLine = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const idOk = (v) => typeof v === 'string' && /^[\w-]{1,80}$/.test(v);
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
const STICKER_PROMPT = (text) => `Turn this frame from a comedy video into one die-cut sticker.
Keep the person EXACTLY as they are in the frame: the same face, expression, hair or wig, glasses, clothes and colours - a
faithful likeness of this exact person, never a different or prettier one. Crop to the most expressive part (usually head
and shoulders), cut out from the background.
Sticker style: a thick clean white outline around the whole silhouette, a soft drop shadow, a slightly glossy vinyl look,
vivid but true colours.
On the sticker, bold playful Hebrew lettering (right-to-left, correctly spelled, every letter exact) that says:
"${text}"
White-outlined comic lettering with a dark fill, placed across the lower part or in a small speech bubble, never covering
the face. No other text, no watermark, no logo. Transparent background around the sticker.`;

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
    const nick = oneLine(d.nick, 24);
    if (nick.length < 2) fail('invalid-argument', 'nick_short');
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
    if (!was) await note(uid, { kind: 'welcome', text: nick });
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
      videoId: d.videoId, parentId, uid, nick: fan.nick, photo: fan.photo || null, text, mention,
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
          url: `/wiki/#/v/${cm.videoId}?c=${d.commentId}`, icon: ICON, badge: BADGE, tag: 'likes_' + d.commentId });
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
    const doc = { videoId: d.videoId, char: d.char || null, at: Math.max(0, Number(d.at) || 0), text, img: publicUrl(path), uid, nick: fan.nick, photo: fan.photo || null,
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
          url: `/wiki/#/v/${st.videoId}?sticker=${d.stickerId}`, icon: ICON, badge: BADGE, image: st.img, tag: 'stamps_' + d.stickerId });
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
    const ref = await db.collection('ideas').add({ text, kind, chars, uid, nick: fan.nick, photo: fan.photo || null, votes: 0, hidden: false,
      unchecked: !!m.unchecked, t: FieldValue.serverTimestamp() });
    return { ok: true, id: ref.id };
  },

  // +1 on an idea (the planet, never a heart); the idea's writer hears at 1, 5, 10, 25...
  async vote(uid, d) {
    if (!idOk(d.ideaId)) fail('invalid-argument', 'idea');
    await fanOf(uid);
    const ref = db.collection('ideas').doc(d.ideaId);
    const mine = db.collection('fans').doc(uid).collection('votes').doc(d.ideaId);
    const r = await db.runTransaction(async (tx) => {
      const [is, ms] = await Promise.all([tx.get(ref), tx.get(mine)]);
      if (!is.exists || is.data().hidden) fail('not-found', 'idea');
      const on = d.on !== false;
      if (on === ms.exists) return { n: is.data().votes || 0, idea: is.data(), changed: false };
      tx.update(ref, { votes: FieldValue.increment(on ? 1 : -1) });
      if (on) tx.set(mine, { t: FieldValue.serverTimestamp() }); else tx.delete(mine);
      return { n: (is.data().votes || 0) + (on ? 1 : -1), idea: is.data(), changed: on };
    });
    const idea = r.idea;
    if (r.changed && idea.uid && idea.uid !== uid) {
      await db.collection('fans').doc(idea.uid).collection('notes').doc('votes_' + d.ideaId).set({ kind: 'vote', ideaId: d.ideaId, text: idea.text.slice(0, 140), n: r.n,
        read: false, t: FieldValue.serverTimestamp() });
      if ([1, 5, 10, 25, 50, 100, 250, 500, 1000].includes(r.n)) {
        await push([idea.uid], { title: r.n === 1 ? '+1 לרעיון שלכם' : `${r.n} הצביעו לרעיון שלכם`, body: `"${idea.text.slice(0, 90)}"`,
          url: `/wiki/#/community?idea=${d.ideaId}`, icon: ICON, badge: BADGE, tag: 'votes_' + d.ideaId });
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
    const n = await push([uid], { title: 'השלומיוורס', body: `ההתראות פועלות, ${fan.nick}.`, url: '/wiki/#/notes', icon: ICON, badge: BADGE, tag: 'test' });
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

// the guide's smart contact: "can't find a video?" / collaborations - works signed out too
async function request(d, auth, ip) {
  if (burst('r' + ip, 4, 3600e3)) fail('resource-exhausted', 'slow_down');
  const kind = ['video', 'business', 'bug'].includes(d.kind) ? d.kind : 'contact';
  const text = clip(String(d.text || '').trim(), 3000);
  if (text.length < 3) fail('invalid-argument', 'empty');
  const contact = oneLine(d.contact, 160);
  const doc = { kind, text, contact, uid: auth?.uid || null, nick: null, t: FieldValue.serverTimestamp(), done: false };
  // the business page: who, which company, about what (the email is the way back)
  if (kind === 'business') Object.assign(doc, { name: oneLine(d.name, 80), company: oneLine(d.company, 120), topic: oneLine(d.topic, 40) });
  // "something isn't working": the page, the device and the page's last errors, so it can be fixed without asking back
  if (kind === 'bug') Object.assign(doc, { page: oneLine(d.page, 300), ua: oneLine(d.ua, 300), screen: oneLine(d.screen, 20),
    errors: (Array.isArray(d.errors) ? d.errors : []).slice(0, 5).map((x) => oneLine(x, 200)) });
  if (['video', 'contact'].includes(kind)) doc.from = d.from === 'community' ? 'community' : 'chat';
  if (auth?.uid) doc.nick = ((await db.collection('fans').doc(auth.uid).get()).data() || {}).nick || null;
  const ref = await db.collection('requests').add(doc);
  const subject = kind === 'bug' ? `שלומיוורס | משהו לא עובד${doc.nick ? ' · ' + doc.nick : ''}`
    : kind === 'business' ? `שלומיוורס | שיתוף פעולה · ${doc.company || doc.name || 'עסק'}${doc.topic ? ' · ' + doc.topic : ''}`
    : kind === 'video' ? `שלומיוורס | מחפשים סרטון${doc.nick ? ' · ' + doc.nick : ''}` : `שלומיוורס | פנייה${doc.nick ? ' · ' + doc.nick : ''}`;
  const where = kind === 'bug' ? 'דיווח תקלה' : kind === 'business' ? 'מעמוד העסקים' : d.from === 'community' ? 'מעמוד הקהילה' : 'דרך המדריך בצ׳אט';
  const body = [...(kind === 'bug' ? [`${doc.page}`, `${doc.ua} · ${doc.screen}`, ...(doc.errors.length ? ['שגיאות: ' + doc.errors.join(' | ')] : []), ''] : []),
    ...(kind === 'business' ? [`${doc.name || '-'} · ${doc.company || '-'}${doc.topic ? ' · ' + doc.topic : ''}`, ''] : []), text, '', `איך לחזור: ${contact || '-'}`,
    doc.nick ? `בשלומיוורס: ${doc.nick}` : 'לא מחובר/ת', '', `${where} · ${new Date().toISOString()} · ${ref.id}`].join('\n');
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
  const url = `/wiki/#/v/${c.videoId}?c=${c.parentId || id}`;
  const { byId, videos } = await _canon();
  const video = videos[c.videoId];

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
    video ? `את/ה בתגובות מתחת לסרטון "${video.title}" (${video.teaser || ''}). מה שנאמר בסרטון:\n${(video.transcript || '').slice(0, 6000)}` : 'את/ה בתגובות מתחת לאחד הסרטונים.',
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
// a story's picture or short clip comes as multipart
function parseStory(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null, tooBig = false;
    const bb = Busboy({ headers: req.headers, defCharset: 'utf8', defParamCharset: 'utf8', limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 10, fieldSize: 5000 } });
    bb.on('field', (k, v) => { fields[k] = String(v); });
    bb.on('file', (_k, stream, info) => {
      const chunks = [];
      stream.on('data', (x) => chunks.push(x));
      stream.on('limit', () => { tooBig = true; });
      stream.on('end', () => { file = { type: info.mimeType, data: Buffer.concat(chunks) }; });
    });
    bb.on('error', reject);
    bb.on('close', () => resolve({ fields, file, tooBig }));
    bb.end(req.rawBody);
  });
}
const MEDIA = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };

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
  const sent = await push(fans, { title, body: oneLine(v.title, 120), url: `/wiki/#/v/${videoId}`, icon: lead ? faceUrl(lead) : ICON, badge: BADGE,
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

exports.verseOwner = onRequest({ region: REGION, secrets: SECRETS, cors: CORS, maxInstances: 1, memory: '512MiB', timeoutSeconds: 120 }, async (req, res) => {
  if (!ownerOk(req, res)) return;
  const op = req.query.op;
  const b = req.body || {};
  try {
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
      const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data(), t: d.data().t?.toMillis?.() || null }));
      return res.json({ comments: rows(comments), stickers: rows(stickers), requests: rows(requests), stories: rows(stories),
        announced: Object.fromEntries(announced.docs.map((d) => [d.id, d.data().t?.toMillis?.() || 1])), fans: fans.data().count, ideas: rows(ideas),
        fansWeek: fansWeek.data().count, autoSince: auto.exists ? auto.data().since?.toMillis?.() || null : null });
    }
    if (op === 'hide') {
      const col = b.kind === 'sticker' ? 'stickers' : b.kind === 'story' ? 'stories' : b.kind === 'idea' ? 'ideas' : 'comments';
      if (!idOk(b.id)) return res.status(400).json({ error: 'id' });
      await db.collection(col).doc(b.id).update({ hidden: b.hidden !== false, ...(b.hidden !== false ? { removedBy: 'owner' } : {}) });
      return res.json({ ok: true });
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
    // a character's story, written by Shlomi: a line, maybe a picture or a short clip; followers hear about it
    if (op === 'story') {
      const { fields: f, file, tooBig } = await parseStory(req);
      if (!idOk(f.char)) return res.status(400).json({ error: 'char' });
      if (tooBig) return res.status(400).json({ error: 'file_size' });
      const text = clip(String(f.text || '').trim(), 600);
      if (!text && !file) return res.status(400).json({ error: 'empty' });
      const ref = db.collection('stories').doc();
      let media = null;
      if (file && file.data.length) {
        const ext = MEDIA[file.type];
        if (!ext) return res.status(400).json({ error: 'file_type' });
        const path = `verse/stories/${ref.id}.${ext}`;
        await admin.storage().bucket(BUCKET).file(path).save(file.data, { contentType: file.type, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
        media = { url: publicUrl(path), kind: file.type.startsWith('video/') ? 'video' : 'image' };
      }
      const { byId } = await _canon();
      const name = byId[f.char]?.name || f.char;
      await ref.set({ char: f.char, text, media, hidden: false, t: FieldValue.serverTimestamp() });
      let fans = [], sent = 0;
      if (f.notify !== 'no') {
        fans = await followersOf([f.char]);
        await Promise.all(fans.map((uid) => note(uid, { kind: 'story', storyId: ref.id, char: f.char, from: name, text: text.slice(0, 140) })));
        sent = await push(fans, { title: `סטורי חדש מ${name}`, body: text.slice(0, 140) || name, url: `/wiki/#/story/${f.char}`, icon: faceUrl(f.char), badge: BADGE,
          image: media?.kind === 'image' ? media.url : undefined, tag: 'story_' + f.char });
      }
      return res.json({ ok: true, id: ref.id, fans: fans.length, sent });
    }
    return res.status(400).json({ error: 'op' });
  } catch (e) {
    console.error('verseOwner', op, e);
    return res.status(500).json({ error: 'server', message: e.message });
  }
});
