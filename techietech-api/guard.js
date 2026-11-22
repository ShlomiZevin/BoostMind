// guard.js - the one shared protection for everything people can send to the Shlomiverse (his ask 2026-11-22, after a scripted
// probe sent the Techy-Tech CV form 7 times and ~325 requests in an hour: "protect all of our websites from this type of hacking").
//
// Why it exists: the old limits (index.js tooMany, verse.js burst) counted in each server instance's memory, so a script that
// lands on several instances, or waits for a cold start, gets through. guard.limit() counts in Firestore (collection `guard`),
// the same for every instance; a cheap in-memory gate in front of it stops a flood before it costs database writes.
//
//   const guard = require('./guard');
//   if (await guard.limit(`apply:uid:${uid}`, 3, guard.DAY)) return res.status(429).json({ error: 'too_many' });
//   if (await guard.limit(`apply:ip:${guard.ip(req)}`, 10, guard.HOUR)) ...
//   const name = guard.text(f.name, 80);            // trimmed, control characters out, cut to length
//   if (!guard.fileOk(file.data, ['pdf', 'docx', 'doc'])) ...   // the real bytes, not the name
//   const safeName = guard.fileName(file.name);     // for an attachment / a stored name: no paths, no shell or HTML characters
//   guard.esc(s)                                    // HTML-escape for anything put into an email's HTML or a page
//
// Keys: '<area>:<what>:<value>' - e.g. 'meet:uid:abc', 'code:email:x@y.z', 'apply:ip:1.2.3.4'. The value is hashed before it is
// stored, so no email / IP sits in the database in the clear. Docs carry `exp` (a TTL policy on `guard`.exp deletes old ones).
const crypto = require('crypto');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const MIN = 60e3, HOUR = 3600e3, DAY = 24 * HOUR;
const mem = new Map();   // key -> [times], this instance only: the first, free gate

function memOver(key, n, ms) {
  const now = Date.now();
  const list = (mem.get(key) || []).filter((t) => now - t < ms);
  list.push(now);
  mem.set(key, list);
  if (mem.size > 20000) for (const k of [...mem.keys()].slice(0, 5000)) mem.delete(k);   // never grows without end
  return list.length > n;
}

// true = over the limit (refuse). n sends per ms window, counted across every instance. Fails OPEN on a database error
// (a broken limiter must not take the site down) but the memory gate still holds.
async function limit(key, n, ms) {
  if (memOver(key, n, ms)) return true;
  const ref = admin.firestore().collection('guard').doc(crypto.createHash('sha256').update(key).digest('hex').slice(0, 40));
  try {
    return await admin.firestore().runTransaction(async (tx) => {
      const now = Date.now(), d = (await tx.get(ref)).data() || {};
      const list = (d.t || []).filter((t) => now - t < ms);
      if (list.length >= n) return true;
      list.push(now);
      tx.set(ref, { t: list.slice(-Math.max(n, 1)), area: String(key).split(':')[0], exp: admin.firestore.Timestamp.fromMillis(now + ms) });
      return false;
    });
  } catch (e) {
    console.error('guard.limit failed (open)', key.split(':')[0], e.message);
    return false;
  }
}

// the caller's address (Cloud Functions / Run put the client first in x-forwarded-for)
const ip = (req) => String((req.get && req.get('x-forwarded-for')) || req.ip || '').split(',')[0].trim() || 'unknown';

// a line of text from a visitor: a string, trimmed, no control characters (newlines kept only when multiline), at most max chars
function text(v, max = 200, multiline = false) {
  let s = typeof v === 'string' ? v : v == null ? '' : String(v);
  s = s.normalize('NFC').replace(multiline ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g : /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, multiline ? '' : ' ');
  if (multiline) s = s.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n');
  return s.trim().slice(0, max);
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// a file name safe to attach or store: the base name only, letters / digits / Hebrew / . _ - and spaces, at most 80, with its extension
function fileName(name, fallback = 'file') {
  const base = String(name || '').split(/[\\/]/).pop().normalize('NFC');
  const m = base.match(/^(.*?)(\.[A-Za-z0-9]{1,8})?$/) || [];
  const stem = String(m[1] || '').replace(/[^\p{L}\p{N} ._-]+/gu, '_').replace(/_{2,}/g, '_').replace(/^[ ._-]+|[ ._-]+$/g, '').slice(0, 70) || fallback;
  return stem + String(m[2] || '').toLowerCase();
}

// the real type of a file from its first bytes - never trust the name or the browser's type
const MAGIC = {
  pdf: (b) => b.slice(0, 5).toString('latin1') === '%PDF-',
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,   // a zip (docx / xlsx / pptx)
  doc: (b) => b.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP',
  gif: (b) => b.slice(0, 4).toString('latin1') === 'GIF8',
  heic: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)$/.test(b.slice(8, 12).toString('latin1')),
  mp4: (b) => b.slice(4, 8).toString('latin1') === 'ftyp',
  webm: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  mp3: (b) => b.slice(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  wav: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE',
};
// which of the allowed kinds the bytes really are ('' = none of them)
function fileKind(buf, allowed) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return '';
  return (allowed || Object.keys(MAGIC)).find((k) => MAGIC[k] && MAGIC[k](buf)) || '';
}
const fileOk = (buf, allowed) => !!fileKind(buf, allowed);

module.exports = { limit, ip, text, esc, fileName, fileKind, fileOk, MIN, HOUR, DAY };
