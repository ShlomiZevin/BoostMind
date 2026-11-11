// The Shlomiverse's content in the database (his rule, 2026-11-05: "two computers must never break the site - a new video,
// a new character, a new profile picture can't come from git"). Every thing the site shows is ONE record, written only
// through versePublish (publish.js), and the site + the chat are composed from the records (catalog.js):
//   catalogVideos/<id>      the videos (catalog.js / publish.js, since 2026-11-05 morning)
//   catalogCharacters/<id>  a character: the page (name, role, tagline, bio, questions, colour, site, relations) and the
//                           chat's full profile (brief, personality, catchphrases, speech, behavior, ...)
//   catalogSeries/<id>      a world: title, blurb, site, brief
//   catalogGames/<id>       a live game of a character (from its game.json)
//   catalogSites/<id>       a site of the verse (its card: title, picture, about, whose, topic)
//   portraits = files, gs://shlomiverse-media/wiki/img/c/<id>.jpg - a character has a face when its file is there
//   catalogLog              every change: what, which fields, the value before, who (the computer / session), when
// Two ways in, both merge-only - nothing is ever removed or blanked except by `hide` / an explicit `clear`:
//   sync  (scripts/wiki/push.cjs, from a computer's files) per field THREE-WAY: a field is written only when the
//         computer's file changed since the value that last came from files (`_src` keeps its hash). So a computer that
//         lacks something sends nothing for it, an older copy can't undo a newer one, and an edit made through `put`
//         stays until someone really edits that field in the files again.
//   put   (a session, the owner page, any tool) sets the fields it sends, now.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

const LISTS = ['aka', 'ask', 'life', 'catchphrases', 'relations', 'personality', 'behavior', 'themes', 'dont', 'writing_rules', 'chars', 'whose', 'mainOf', 'links', 'videos', 'sources'];
const KINDS = {
  character: { col: 'catalogCharacters', need: ['name'], fields: ['order', 'name', 'name_en', 'aka', 'world', 'series', 'role', 'tagline', 'bio', 'ask',
    'catchphrases', 'color', 'site', 'relations', 'brief', 'personality', 'speech', 'behavior', 'comedy', 'themes', 'dont', 'look', 'writing_rules',
    // the studio's own (since 2026-11-06 the record is the ONLY copy - no character.json in git): the voice preset, the
    // Reader's pace, links, the projects it's in, sources, and paths to its pictures / sounds on the computers
    'voice', 'pace', 'links', 'videos', 'sources', 'portrait', 'assets', 'tier', 'site_notes',   // site_notes: the studio's site.notes (site = its url)
    // the character sheet (Backstage → דמויות, 2026-11-11, his ask: "people, not replicas"): who they are, how they talk, what is
    // funny, the parody, the nuance, the dissonance, a few catchphrases (sheet); how loveable 1-10 (love); their life, one event
    // per video (life: [{v, d, e}]) - what the chat's chain answers from
    'sheet', 'love', 'life'] },
  // world = the studio's name for it (character.world), name = its full name there (was characters/index.json)
  series: { col: 'catalogSeries', need: ['title'], fields: ['order', 'title', 'blurb', 'site', 'brief', 'world', 'name'] },
  game: { col: 'catalogGames', need: ['url', 'title'], fields: ['url', 'title', 'tagline', 'img', 'chars', 'site', 'date', 'record'] },
  site: { col: 'catalogSites', need: ['url'], fields: ['order', 'url', 'title', 'about', 'img', 'host', 'whose', 'in', 'topic', 'tagline', 'mainOf'] },
};
const STUDIO = ['voice', 'pace', 'links', 'videos', 'sources', 'portrait', 'assets', 'tier', 'site_notes'];   // not on the site
const ID = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const db = () => admin.firestore();
const hash = (v) => crypto.createHash('md5').update(JSON.stringify(v ?? null)).digest('hex').slice(0, 12);
const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const short = (v) => { const s = JSON.stringify(v ?? null); return s.length > 1500 ? s.slice(0, 1500) + '…' : s; };

function clean(kind, item) {
  const K = KINDS[kind];
  const out = {};
  for (const f of K.fields) if (item[f] !== undefined) out[f] = LISTS.includes(f) && item[f] != null && !Array.isArray(item[f]) ? [item[f]] : item[f];
  return out;
}

async function log(kind, id, op, before, after, by) {
  const fields = Object.keys(after);
  if (!fields.length) return;
  await db().collection('catalogLog').add({ kind, id, op, fields, before: Object.fromEntries(fields.map((f) => [f, short(before?.[f])])), by: String(by || '').slice(0, 120), t: FieldValue.serverTimestamp() });
}

// from a computer's files: [{id, ...fields}] of one kind -> what changed (three-way per field, see above)
async function sync(kind, items, by, dry = false) {
  const K = KINDS[kind];
  if (!K) return { error: 'kind', detail: Object.keys(KINDS).join(' | ') };
  const changed = [], added = [], skipped = [];
  const refs = items.filter((x) => ID.test(x?.id || '')).map((x) => db().collection(K.col).doc(x.id));
  const docs = refs.length ? await db().getAll(...refs) : [];
  for (const [i, d] of docs.entries()) {
    const item = items.filter((x) => ID.test(x?.id || ''))[i], f = clean(kind, item), was = d.exists ? d.data() : null;
    if (!was && K.need.some((n) => empty(f[n]))) { skipped.push(`${item.id} (no ${K.need.join('/')})`); continue; }
    const src = { ...(was?._src || {}) }, set = {}, before = {};
    for (const [k, v] of Object.entries(f)) {
      const h = hash(v);
      if (was && src[k] === h) continue;                              // the files didn't change this field since it last came from them
      src[k] = h;
      if (empty(v) && was && !empty(was[k])) continue;               // a computer missing something never blanks it
      if (was && same(was[k], v)) continue;
      set[k] = v; before[k] = was?.[k];
    }
    const srcMoved = !same(src, was?._src || {});
    if (!Object.keys(set).length && !srcMoved) continue;
    if (dry) { if (Object.keys(set).length) (was ? changed : added).push(was ? `${item.id}: ${Object.keys(set).join(', ')}` : item.id); continue; }
    await d.ref.set({ ...set, _src: src, updated: FieldValue.serverTimestamp(), ...(was ? {} : { created: FieldValue.serverTimestamp(), hidden: false }) }, { merge: true });
    if (Object.keys(set).length) {
      (was ? changed : added).push(was ? `${item.id}: ${Object.keys(set).join(', ')}` : item.id);
      await log(kind, item.id, 'sync', before, set, by);
    }
  }
  return { ok: true, kind, added, changed, skipped };
}

// a direct edit: {kind, id, ...fields, clear?: [fields]} - sets what it sends (a new record needs its required fields)
async function put(b, by) {
  const K = KINDS[b.kind];
  if (!K) return { error: 'kind', detail: Object.keys(KINDS).join(' | ') };
  if (!ID.test(b.id || '')) return { error: 'id', detail: 'letters, digits, - and _ only' };
  const ref = db().collection(K.col).doc(b.id), was = (await ref.get()).data() || null;
  const set = clean(b.kind, b);
  for (const k of Object.keys(set)) if (empty(set[k])) delete set[k];   // blanking only through `clear`
  for (const k of [].concat(b.clear || [])) if (K.fields.includes(k)) set[k] = LISTS.includes(k) ? [] : null;
  if (!was && K.need.some((n) => empty(set[n]))) return { error: 'missing', detail: `a new ${b.kind} needs ${K.need.join(', ')}` };
  const before = Object.fromEntries(Object.keys(set).map((k) => [k, was?.[k]]));
  for (const k of Object.keys(set)) if (was && same(was[k], set[k])) delete set[k];
  if (!Object.keys(set).length) return { ok: true, kind: b.kind, id: b.id, changed: [] };
  await ref.set({ ...set, updated: FieldValue.serverTimestamp(), ...(was ? {} : { created: FieldValue.serverTimestamp(), hidden: false }) }, { merge: true });
  await log(b.kind, b.id, 'put', before, set, by);
  return { ok: true, kind: b.kind, id: b.id, created: !was, changed: Object.keys(set) };
}

async function hide(kind, id, hidden, by) {
  const K = KINDS[kind];
  if (!K) return { error: 'kind' };
  const ref = db().collection(K.col).doc(id), was = await ref.get();
  if (!was.exists) return { error: 'not_found' };
  await ref.update({ hidden: hidden !== false, updated: FieldValue.serverTimestamp() });
  await log(kind, id, 'hide', { hidden: was.data().hidden }, { hidden: hidden !== false }, by);
  return { ok: true, kind, id, hidden: hidden !== false };
}

async function get(kind, id) {
  const K = KINDS[kind];
  if (!K) return { error: 'kind' };
  const d = await db().collection(K.col).doc(id).get();
  if (!d.exists) return { error: 'not_found' };
  const { _src, ...rest } = d.data();
  return { kind, id, ...rest };
}

// full: every record whole (the studio and the scripts read the characters / worlds from here - the only copy)
async function list(kind, full = false) {
  const K = KINDS[kind];
  if (!K) return { error: 'kind' };
  const s = await db().collection(K.col).get();
  if (full) return { kind, items: s.docs.map((d) => { const { _src, created, updated, ...rest } = d.data(); return { id: d.id, ...rest, updated: updated?.toMillis?.() || null }; }) };
  return { kind, items: s.docs.map((d) => ({ id: d.id, name: d.data().name || d.data().title || d.data().url, hidden: !!d.data().hidden })) };
}

async function history(b) {
  let q = db().collection('catalogLog').orderBy('t', 'desc').limit(Math.min(+b.limit || 30, 200));
  const s = await q.get();
  return { log: s.docs.map((d) => ({ ...d.data(), t: d.data().t?.toDate?.().toISOString() })).filter((x) => (!b.kind || x.kind === b.kind) && (!b.id || x.id === b.id)) };
}

module.exports = { KINDS, STUDIO, sync, put, hide, get, list, history, hash };
