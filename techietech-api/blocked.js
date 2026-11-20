// An account that turned ALL of the Shlomiverse's mail off (mailUsers/<uid>.off - the choices page's "stop everything", the mail
// app's one-click unsubscribe, or every topic unchecked) gets no chat and no sticker-making. His call 2026-11-20 (after I raised the
// privacy-law risk of tying a free feature to marketing mail, twice): "just block it", no explanation - it fails like a fault.
// Someone who switched off only some topics keeps everything. Used by wiki.js (the chat) and verse.js (op sticker).
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const seen = new Map();   // uid -> { off, t } - 5 minutes, so a chat doesn't read the record on every message
async function mailOff(uid) {
  if (!uid) return false;
  const c = seen.get(uid);
  if (c && Date.now() - c.t < 300e3) return c.off;
  let off = false;
  try { off = ((await admin.firestore().collection('mailUsers').doc(uid).get()).data() || {}).off === true; } catch (e) { return false; }
  seen.set(uid, { off, t: Date.now() });
  return off;
}
module.exports = { mailOff };
