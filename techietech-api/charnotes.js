// Backstage → דמויות (2026-11-11, his ask: "a standalone ongoing thing I use from time to time - today 10 characters,
// tomorrow 3 more, then back to some of the 10"). Every character as it is live (the records + their videos), and his notes
// on any part of it - the profile, what makes them funny, a catchphrase, the site, a person, a video. He writes messy
// notes; a session reads the open ones (scripts/characters/notes.mjs), puts them in order into the record (content.mjs
// put) and answers under the note. What changed in a character since he last opened it is marked (catalogLog).
// Private: Firestore `charNotes` (no client rule = nobody reads it). Called only from verseOwner (his key): ops
// charList, charNotes, charNote, charNoteDone, charLove / charScore, charDone.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = () => admin.firestore();
const idOk = (s) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(String(s || ''));
const clip = (s, n) => String(s ?? '').slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
const pub = (u) => String(u || '').replace('https://boostmind-b052c.web.app', 'https://shlomiverse.com');
// the parts of a record shown and noted on (the rest - colour, order, questions, sources - isn't about who they are)
const FIELDS = ['name', 'name_en', 'aka', 'world', 'role', 'tagline', 'brief', 'bio', 'personality', 'speech', 'behavior', 'themes', 'look',
  'comedy', 'catchphrases', 'writing_rules', 'dont', 'relations', 'site', 'hidden', 'sheet', 'love', 'viral', 'life'];

const note = (d) => ({ id: d.id, ...d.data(), t: ms(d.data().t) });

async function owner(op, b) {
  const notes = db().collection('charNotes');
  // everything the tab needs in one call: the characters, their videos (from the chat's brain - the same one the chat
  // answers from), the sites, every note, and when each field of each character last changed
  if (op === 'charList') {
    const [chars, brainBuf, sites, ns, log] = await Promise.all([
      db().collection('catalogCharacters').get(),
      admin.storage().bucket('shlomiverse-private').file('wiki-brain.json').download().then(([x]) => x).catch(() => null),
      db().collection('catalogSites').get().catch(() => ({ docs: [] })),
      notes.orderBy('t', 'asc').limit(3000).get(),
      db().collection('catalogLog').orderBy('t', 'desc').limit(1500).get(),
    ]);
    const brain = brainBuf ? JSON.parse(brainBuf.toString('utf8')) : { characters: [], videos: [], worlds: [] };
    const order = brain.characters.map((c) => c.id);
    const own = Object.fromEntries(brain.characters.map((c) => [c.id, c.videos || []]));
    const changed = {};
    for (const d of log.docs) {
      const x = d.data();
      if (x.kind !== 'character' || !x.id) continue;
      const t = ms(x.t), m = (changed[x.id] = changed[x.id] || {});
      for (const f of x.fields || []) if (!m[f]) m[f] = t;   // newest first: the first time a field is seen = its last change
    }
    const list = chars.docs.map((d) => {
      const x = d.data(), c = { id: d.id };
      for (const f of FIELDS) if (x[f] != null) c[f] = f === 'site' ? pub(typeof x[f] === 'string' ? x[f] : x[f]?.url) : x[f];
      c.videos = own[d.id] || [];
      c.updated = ms(x.updated);
      return c;
    }).sort((a, b) => ((order.indexOf(a.id) + 1) || 999) - ((order.indexOf(b.id) + 1) || 999));
    const videos = Object.fromEntries(brain.videos.map((v) => [v.id, { title: v.title, date: v.date || '', card: (v.card || v.teaser || '').replace(/\s+/g, ' '), tr: !!v.transcript }]));
    const done = ((await db().collection('owner').doc('charsDone').get()).data() || {}).ids || {};
    return {
      chars: list, videos, changed, done,
      worlds: Object.fromEntries((brain.worlds || []).map((w) => [w.title, w.brief || w.blurb || ''])),
      sites: sites.docs.map((d) => d.data()).filter((s) => !s.hidden).map((s) => ({ title: s.title, url: pub(s.url), about: s.about || '', whose: s.whose || [] })),
      notes: ns.docs.map(note),
    };
  }
  // the notes of one character, or every open note (a session reading what he asked for)
  if (op === 'charNotes') {
    if (b.char && !idOk(b.char)) return { error: 'char' };
    const snap = b.char ? await notes.where('char', '==', b.char).get() : await notes.where('done', '==', false).get();
    return { notes: snap.docs.map(note).sort((x, y) => (x.t || 0) - (y.t || 0)) };
  }
  // a note on a part of a character (anchor: 'field' or 'field:index'; '' = the character as a whole). by: 'shlomi' (Backstage)
  // | 'claude' (a session's answer - never open; answering a note closes it)
  if (op === 'charNote') {
    if (!idOk(b.char)) return { error: 'char' };
    const text = clip(String(b.text || '').trim(), 6000);
    if (!text) return { error: 'empty' };
    const by = b.by === 'claude' ? 'claude' : 'shlomi';
    const ref = await notes.add({ char: b.char, anchor: clip(b.anchor, 80), label: clip(b.label, 300), text, by, reply: clip(b.reply, 40) || null,
      t: FieldValue.serverTimestamp(), done: by === 'claude' });
    if (by === 'claude' && b.reply && idOk(String(b.reply).toLowerCase())) await notes.doc(b.reply).update({ done: true }).catch(() => {});
    return { ok: true, id: ref.id };
  }
  // how loveable a character is, 1-10 (his click; a first guess came from how many videos they have) - into the record,
  // through the content door so it is logged like any change
  // and how viral right now (viral), the same way - two scores: a character can be much loved and not taking off now
  if (op === 'charLove' || op === 'charScore') {
    const field = op === 'charLove' ? 'love' : b.field, v = Math.round(Number(op === 'charLove' ? b.love : b.value));
    if (!idOk(b.id) || !['love', 'viral'].includes(field) || !(v >= 1 && v <= 10)) return { error: 'score' };
    const r = await require('./content').put({ kind: 'character', id: b.id, [field]: v }, 'backstage');
    return r.error ? r : { ok: true, [field]: v };
  }
  // "I'm done with this character" (his ask 2026-11-11: to see which ones he already went over) - {id: when}, kept in
  // owner/charsDone; on: false takes the mark off
  if (op === 'charDone') {
    if (!idOk(b.id)) return { error: 'id' };
    await db().collection('owner').doc('charsDone').set({ ids: { [b.id]: b.on === false ? FieldValue.delete() : Date.now() } }, { merge: true });
    return { ok: true };
  }
  if (op === 'charNoteDone') {   // handled, or open again (his "not yet")
    if (!idOk(String(b.id || '').toLowerCase())) return { error: 'id' };
    await notes.doc(b.id).update({ done: b.done !== false });
    return { ok: true };
  }
  return null;
}

module.exports = { owner };
