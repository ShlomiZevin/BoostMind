// The Shlomiverse as an MCP server (his ask, 2026-11-10: "I want my ChatGPT web to reach the Shlomiverse and read about the
// characters and everything - I write a lot of scripts with it"). Read-only: every character's full writer's profile, the
// series, every video with its transcript, the sites and the games - the same composed brain the chat reads
// (gs://shlomiverse-private/wiki-brain.json, written by content.js / catalog.js from the records).
// Writes (his ask, 2026-11-17: "from the MCP I can update the nuance about the characters ... and update the skill of how we
// write scripts"): update_character_sheet (the record's sheet = Backstage → דמויות, through the content door - logged in
// catalogLog, marked as changed in Backstage, the full sheet before kept in Firestore sheetEdits, undo_sheet_change brings it
// back) and the writing guide (scriptcraft.js: get_writing_guide / update_writing_guide). ChatGPT asks him before any write.
//
// Address: https://shlomiverse.com/mcp/<VERSE_MCP_KEY> (firebase.json rewrite -> verseMcp). The key in the path is the lock
// (ChatGPT's connectors take a URL with "no authentication"); a wrong path gets 404. The URL is his - don't post it.
// Protocol: MCP streamable HTTP, stateless - every POST is one JSON-RPC message answered as JSON (no sessions, no SSE).
// Tools: search + fetch in the shape ChatGPT's connectors / deep research expect, and named tools for a writing session
// (about, get_writing_guide, list_characters, get_character, list_series, list_videos, get_video, sites_and_games; writes:
// update_character_sheet, undo_sheet_change, update_writing_guide). Free: no AI call inside.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const content = require('./content');
const craft = require('./scriptcraft');

if (!admin.apps.length) admin.initializeApp();
const BY = 'mcp (ChatGPT)';
const KEY = defineSecret('VERSE_MCP_KEY');
const wrong = new Map();   // address -> times of wrong keys (maxInstances 3, so at most 60 guesses an hour)
const SITE = 'https://shlomiverse.com';
const pub = (u) => (typeof u === 'string' ? u : u?.url || '').replace('https://boostmind-b052c.web.app', SITE);

// ---- the brain, re-read when the bucket's copy changes (checked at most every 2 minutes) ----
// (who is in which series comes from the site's own wiki.json - the brain's worlds don't list their characters)
let brain = null, md5 = null, checked = 0;
async function load() {
  if (brain && Date.now() - checked < 120e3) return brain;
  checked = Date.now();
  const file = admin.storage().bucket('shlomiverse-private').file('wiki-brain.json');
  const site = admin.storage().bucket('shlomiverse-media').file('wiki/data/wiki.json');
  try {
    const [[meta], [meta2]] = await Promise.all([file.getMetadata(), site.getMetadata()]);
    if (meta.md5Hash + meta2.md5Hash !== md5) {
      const [[buf], [buf2]] = await Promise.all([file.download(), site.download()]);
      const b = JSON.parse(buf.toString('utf8'));
      const members = Object.fromEntries((JSON.parse(buf2.toString('utf8')).series || []).map((x) => [x.id, x.characters || []]));
      for (const w of b.worlds) w.cast = members[w.id] || [];
      b.byId = Object.fromEntries(b.characters.map((c) => [c.id, c]));
      b.vById = Object.fromEntries(b.videos.map((v) => [v.id, v]));
      b.wById = Object.fromEntries(b.worlds.map((w) => [w.id, w]));
      brain = b; md5 = meta.md5Hash + meta2.md5Hash;
    }
  } catch (e) {
    if (!brain) throw e;
    console.error('verseMcp: brain re-read failed, keeping the last one', e.message);
  }
  return brain;
}

// ---- finding things ----
const norm = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"׳'`’]/g, '').replace(/[-_]/g, ' ');
const nameOf = (b, id) => b.byId[id]?.name || id;
const worldOf = (b, c) => b.worlds.find((w) => w.cast.includes(c.id)) || null;
function findCharacter(b, q) {
  const n = norm(q).trim();
  if (b.byId[q]) return b.byId[q];
  return b.characters.find((c) => [c.id, c.name, c.name_en, ...(c.aka || [])].some((x) => norm(x) === n))
    || b.characters.find((c) => [c.name, c.name_en, ...(c.aka || [])].some((x) => x && norm(x).includes(n) && n.length > 1));
}
function findWorld(b, q) {
  const n = norm(q).trim();
  return b.wById[q] || b.worlds.find((w) => norm(w.title) === n || norm(w.id) === n) || b.worlds.find((w) => n.length > 1 && norm(w.title).includes(n));
}
const castOf = (b, w) => w.cast.map((id) => b.byId[id]).filter(Boolean);

// every searchable thing: [kind, id, title, url, [ [text, weight], ... ]]
function docs(b) {
  if (b._docs) return b._docs;
  const out = [];
  for (const c of b.characters) out.push(['character', c.id, `${c.name} - ${c.role || c.tagline || ''}`, `${SITE}/c/${c.id}`,
    [[[c.name, c.name_en, ...(c.aka || [])].join(' '), 6], [`${c.tagline || ''} ${c.role || ''} ${c.world || ''}`, 3], [`${c.bio || ''} ${c.brief || ''} ${(c.personality || []).join(' ')} ${(c.catchphrases || []).join(' ')}`, 1]]]);
  for (const v of b.videos) out.push(['video', v.id, v.title, `${SITE}/v/${v.id}`,
    [[v.title, 6], [`${v.card || ''} ${v.teaser || ''} ${(v.cast || []).map((id) => nameOf(b, id)).join(' ')}`, 3], [v.transcript || '', 1]]]);
  for (const w of b.worlds) out.push(['series', w.id, w.title, `${SITE}/s/${w.id}`, [[w.title, 6], [`${w.blurb || ''} ${w.brief || ''}`, 2]]]);
  for (const s of b.sites || []) out.push(['site', s.id, s.title, pub(s.url), [[s.title, 5], [`${s.about || ''} ${(s.whose || []).join(' ')}`, 2]]]);
  for (const g of b.games || []) out.push(['game', g.id, g.title, pub(g.url), [[g.title, 5], [`${g.tagline || ''} ${(g.chars || []).map((id) => nameOf(b, id)).join(' ')}`, 2]]]);
  b._docs = out.map(([kind, id, title, url, fields]) => ({ kind, id, title, url, fields: fields.map(([t, w]) => [norm(t), w, String(t || '')]) }));
  return b._docs;
}
function search(b, query, kinds, limit = 10) {
  const q = norm(query).trim();
  const words = [...new Set(q.split(/\s+/).filter((w) => w.length > 1))];
  if (!words.length) return [];
  const hits = [];
  for (const d of docs(b)) {
    if (kinds && !kinds.includes(d.kind)) continue;
    let score = 0, snip = '';
    for (const [text, w, raw] of d.fields) {
      let found = 0;
      for (const word of words) if (text.includes(word)) found++;
      if (found) score += w * found * found + (words.length > 1 && text.includes(q) ? w * 4 : 0);
      if (found && !snip && w <= 3) {
        const i = text.indexOf(words.find((x) => text.includes(x)));
        snip = raw.slice(Math.max(0, i - 80), i + 160).replace(/\s+/g, ' ').trim();
      }
    }
    if (score) hits.push({ ...d, score, snip });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---- what a tool returns, as readable text ----
// a profile field can be a list, a string or an object (written by hand over time) - any shape reads
const list = (a) => (!a ? '' : typeof a === 'string' ? a : Array.isArray(a) ? a.map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : JSON.stringify(a, null, 1));
function characterText(b, c, notes = []) {
  const w = worldOf(b, c);
  const vids = (c.videos || []).map((id) => b.vById[id]).filter(Boolean).sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
  const parts = [`# ${c.name}${c.name_en ? ` (${c.name_en})` : ''} - id: ${c.id}`, `Page: ${SITE}/c/${c.id}`,
    c.aka?.length ? `Also called: ${c.aka.join(', ')}` : '', `World / series: ${w ? `${w.title} (series id ${w.id})` : c.world || '-'}`,
    c.role ? `Role: ${c.role}` : '', c.tagline ? `Tagline: ${c.tagline}` : '', c.site ? `Their own site: ${pub(c.site)}` : ''];
  const sec = (title, body) => { if (body && String(body).trim()) parts.push(`\n## ${title}\n${body}`); };
  // the character sheet (Backstage → דמויות, shaped by him - his ask 2026-11-11: "the most important thing for the MCP: GPT
  // reads about this character and we draft a script"). When there is one it IS the character: the older long profile is left
  // out - it still holds things he took out (only facts stay: look, relations, site, their life)
  const sh = c.sheet && c.sheet.person ? c.sheet : null;
  if (sh) {
    parts.push('\nThis is the character sheet Shlomi approved - write from it. The Shlomiverse is real: they are real people; their videos are moments of their life.');
    if (c.love || c.viral) parts.push(`How loveable: ${c.love || '-'}/10 · How viral right now: ${c.viral || '-'}/10`);
    sec('מי זה (who they are)', sh.person); sec('איך מדבר (how they talk)', sh.speech); sec('מה מצחיק (what is funny about them)', sh.funny);
    sec('הפרודיה (what it mirrors)', sh.parody); sec('הדיסוננס (the core contradiction)', sh.dissonance);
    sec('ניואנסים (nuances)', list(sh.nuances)); sec('קאצ\'פרייז / רפליקות (catchphrases - only these)', list(sh.catchphrases) || '(none - their whole way of talking is the signature)');
    sec('Look', c.look);
    sec('Their life - one event per video, in order (get_video for the full transcript)', (c.life || []).map((x, i) => `${i + 1}. ${x.d || ''} | ${x.v} | ${x.e}`).join('\n'));
  } else {
    sec('Bio', c.bio); sec('Brief (the writer\'s full picture)', c.brief); sec('Look', c.look);
    sec('Personality', list(c.personality)); sec('How they speak', list(c.speech)); sec('Catchphrases', list(c.catchphrases));
    sec('Behavior', list(c.behavior)); sec('Where the comedy is', list(c.comedy)); sec('Themes', list(c.themes));
    sec('Writing rules', list(c.writing_rules)); sec('Never', list(c.dont));
  }
  sec('Relations', (Array.isArray(c.relations) ? c.relations : []).map((r) => `- ${nameOf(b, r.id)} (id ${r.id}): ${r.relation || ''}`).join('\n'));
  if (!sh) sec('Videos (newest first - get_video for the full transcript)', vids.map((v) => `- ${v.id} | ${v.date || ''} | ${v.title}${v.card ? ` - ${v.card}` : ''}`).join('\n'));
  // his own notes on this character in Backstage that no session has folded into the sheet yet - his raw thinking, worth
  // knowing while writing (the sheet stays the truth)
  sec('Shlomi\'s open notes on this character (Backstage, not yet in the sheet - his raw thoughts)', notes.map((n) => `- ${n.label ? `[${n.label}] ` : ''}${n.text}`).join('\n'));
  return parts.filter(Boolean).join('\n');
}
function videoText(b, v) {
  return [`# ${v.title} - id: ${v.id}`, `Page: ${SITE}/v/${v.id}`, `Date: ${v.date || '-'}`,
    `Cast: ${(v.cast || []).map((id) => `${nameOf(b, id)} (${id})`).join(', ') || '-'}`, v.teaser ? `Teaser: ${v.teaser}` : '',
    v.card ? `What happens: ${v.card}` : '', `\n## Transcript\n${v.transcript || '(no transcript)'}`].filter(Boolean).join('\n');
}
function worldText(b, w) {
  const cast = castOf(b, w);
  const vids = b.videos.filter((v) => (v.cast || []).some((id) => cast.some((c) => c.id === id)));
  return [`# ${w.title} - series id: ${w.id}`, `Page: ${SITE}/s/${w.id}`, w.site ? `Site: ${pub(w.site)}` : '', w.blurb ? `\n${w.blurb}` : '',
    w.brief ? `\n## Brief\n${w.brief}` : '', `\n## Characters (${cast.length})\n${cast.map((c) => `- ${c.id} | ${c.name} | ${c.role || ''} | ${c.tagline || ''}`).join('\n')}`,
    `\n## Videos (${vids.length})\n${vids.map((v) => `- ${v.id} | ${v.date || ''} | ${v.title}`).join('\n')}`].filter(Boolean).join('\n');
}
function aboutText(b) {
  return `# The Shlomiverse (שלומיוורס) - ${SITE}
Shlomi Zevin's comedy universe: recurring characters he plays himself in short Hebrew comedy videos (TikTok / Instagram / YouTube).
The characters are written as real people - each with a job, a family, a way of speaking, rules about what they would never say -
and they live on: their own sites (shops, companies, services), games, stories, and a chat where visitors talk to each of them.
Everything is in Hebrew. ${b.characters.length} characters, ${b.worlds.length} series, ${b.videos.length} videos, ${(b.sites || []).length} sites, ${(b.games || []).length} games.

How to use this server for writing: FIRST read get_writing_guide - how we write scripts here (the craft, and the lessons
learned in earlier sessions). get_character gives a character's sheet - who they are, how they talk, what is funny about
them, the parody, the dissonance, nuances, catchphrases, and their life (one event per video) - plus family and relations; get_video gives a video's full transcript; list_series /
list_characters / list_videos give the map; search finds anything by words (Hebrew or English).

## Series
${b.worlds.map((w) => `- ${w.id} | ${w.title} | ${w.blurb || ''} | ${castOf(b, w).length} characters`).join('\n')}`;
}

// ---- the tools ----
const S = (props, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const str = (d) => ({ type: 'string', description: d });
const RO = { readOnlyHint: true, openWorldHint: false, destructiveHint: false };
const TOOLS = [
  { name: 'search', title: 'Search the Shlomiverse', description: 'Search characters, videos (titles, what happens, full transcripts), series, sites and games by words - Hebrew or English. Returns ids to pass to fetch.',
    inputSchema: S({ query: str('Words to search for, e.g. "חנה פרידמן", "מנגל", "Techy-Tech", "a wedding"') }, ['query']) },
  { name: 'fetch', title: 'Read one item in full', description: 'Read one search result in full by its id: "character:<id>", "video:<id>", "series:<id>", "site:<id>", "game:<id>", or "about".',
    inputSchema: S({ id: str('An id from search, e.g. "character:hani" or "video:haredit-1"') }, ['id']) },
  { name: 'about', title: 'About the Shlomiverse', description: 'What the Shlomiverse is, its series and how to use these tools. Start here.', inputSchema: S({}) },
  { name: 'get_writing_guide', title: 'How we write scripts', description: 'The Shlomiverse\'s script-writing guide: how we craft a script (realism and day-to-day nuance, each character\'s parody and catchphrases, copying the mechanics of scripts that worked, the format) plus the lessons learned in earlier writing sessions. Read it before writing any script, and follow it.', inputSchema: S({}) },
  { name: 'list_characters', title: 'List characters', description: 'Every character (id, name, world, role, tagline), optionally only one series.',
    inputSchema: S({ series: str('Optional: a series id or name, e.g. "techytech" or "טקי-טק"') }) },
  { name: 'get_character', title: 'Character profile', description: 'A character\'s sheet - who they are, how they talk, what is funny about them, the parody, the dissonance, nuances, catchphrases, how loveable / how viral now, and their life one event per video - plus relations and look. Read it before writing a script for them.',
    inputSchema: S({ character: str('The character id, name or nickname (Hebrew or English), e.g. "hani", "חני", "Avram"') }, ['character']) },
  { name: 'list_series', title: 'List series', description: 'Every series / world with its blurb and number of characters.', inputSchema: S({}) },
  { name: 'get_series', title: 'Series in full', description: 'A series: its brief, its characters and its videos.', inputSchema: S({ series: str('Series id or name') }, ['series']) },
  { name: 'list_videos', title: 'List videos', description: 'Videos (id, date, title, cast, what happens), newest first - all of them, or only one character\'s or one series\'.',
    inputSchema: S({ character: str('Optional: a character id or name'), series: str('Optional: a series id or name') }) },
  { name: 'get_video', title: 'Video with transcript', description: 'A video: date, cast, what happens, and its full transcript.', inputSchema: S({ id: str('The video id') }, ['id']) },
  { name: 'sites_and_games', title: 'Sites and games', description: 'The characters\' own sites (shops, companies, services) and their games.', inputSchema: S({}) },
].map((t) => ({ ...t, annotations: RO }));
// the writes (his ask, 2026-11-17) - only when Shlomi asks for them; show him exactly what will change first
const W = { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: false };
const SHEET_TEXT = ['person', 'speech', 'funny', 'parody', 'dissonance'], SHEET_LIST = ['nuances', 'catchphrases'];
TOOLS.push(
  { name: 'update_character_sheet', title: 'Update a character\'s sheet', annotations: W,
    description: 'Write what was learned about a character into their sheet (Backstage → דמויות - the one truth about them, also used by the site\'s chat). ONLY when Shlomi asks ("update the character", "put what we learned in Backstage"), and only after showing him exactly what will change. Fields: person (מי זה), speech (איך מדבר), funny (מה מצחיק), parody (הפרודיה), dissonance (הדיסוננס) - text: action replace (the whole new text) or append (adds a sentence); nuances (ניואנסים), catchphrases (קאצ\'פרייז) - lists: action add, remove (an existing item) or edit (old -> text). Hebrew, in the sheet\'s own style. Every change is logged and can be undone with undo_sheet_change.',
    inputSchema: S({ character: str('The character id, name or nickname'), why: str('One line: what was learned in this session (shown to Shlomi in the log)'),
      changes: { type: 'array', minItems: 1, maxItems: 12, description: 'The changes, applied in order',
        items: S({ field: { type: 'string', enum: [...SHEET_TEXT, ...SHEET_LIST] }, action: { type: 'string', enum: ['replace', 'append', 'add', 'remove', 'edit'] },
          text: str('The new text / the item to add or remove / the edited item'), old: str('For edit: the existing list item to change') }, ['field', 'action', 'text']) } },
      ['character', 'why', 'changes']) },
  { name: 'undo_sheet_change', title: 'Undo the last sheet change', annotations: W,
    description: 'Put a character\'s sheet back as it was before the last update_character_sheet - when Shlomi says a change was wrong.',
    inputSchema: S({ character: str('The character id, name or nickname') }, ['character']) },
  { name: 'update_writing_guide', title: 'Update how we write scripts', annotations: W,
    description: 'Save what a writing session learned about HOW we write scripts (not about one character - that goes to update_character_sheet). ONLY when Shlomi asks ("we learned something, update the guide"). action add_lesson = one clear lesson in his words (the usual way); action rewrite = the WHOLE guide re-written (only when he asks to reorganise it - read get_writing_guide first, keep everything that still holds; clear_lessons when the lessons were folded into the text). Every version is kept.',
    inputSchema: S({ action: { type: 'string', enum: ['add_lesson', 'rewrite'] }, text: str('The lesson, or the whole new guide (markdown, Hebrew)'),
      characters: str('Optional: which characters / series the lesson came from'), why: str('What was learned and why (required for rewrite)'),
      clear_lessons: { type: 'boolean', description: 'rewrite only: the lessons are now inside the text' } }, ['action', 'text']) },
);

const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
// his open Backstage notes on a character (charnotes.js) - read with the character
async function openNotes(id) {
  try {
    const s = await admin.firestore().collection('charNotes').where('char', '==', id).get();
    return s.docs.map((d) => d.data()).filter((n) => !n.done && n.by !== 'claude').sort((x, y) => (x.t?.toMillis?.() || 0) - (y.t?.toMillis?.() || 0));
  } catch (e) { console.error('verseMcp notes', e.message); return []; }
}
const sameText = (x, y) => norm(x).replace(/\s+/g, ' ').trim() === norm(y).replace(/\s+/g, ' ').trim();
const findItem = (arr, t) => { const i = arr.findIndex((x) => sameText(x, t)); return i >= 0 ? i : arr.findIndex((x) => norm(t).trim().length > 3 && norm(x).includes(norm(t).trim())); };
async function afterWrite() { await require('./catalog').compose(admin); checked = 0; }   // the site, the chat and this server read the new sheet

async function editSheet(b, a) {
  const c = findCharacter(b, a.character || '') || fail(`No character "${a.character}" - try list_characters`);
  const rec = await content.get('character', c.id);
  if (rec.error) fail(`Could not read ${c.name}'s record (${rec.error})`);
  const before = JSON.parse(JSON.stringify(rec.sheet || {})), sheet = JSON.parse(JSON.stringify(rec.sheet || {}));
  const done = [];
  for (const ch of a.changes || []) {
    const f = ch.field, t = String(ch.text || '').trim();
    if (!t) fail(`Empty text for ${f}`);
    if (SHEET_TEXT.includes(f)) {
      if (ch.action === 'replace') sheet[f] = t;
      else if (ch.action === 'append') sheet[f] = `${String(sheet[f] || '').trim()} ${t}`.trim();
      else fail(`${f} is a text: action replace or append`);
    } else if (SHEET_LIST.includes(f)) {
      const arr = sheet[f] = Array.isArray(sheet[f]) ? sheet[f] : sheet[f] ? [String(sheet[f])] : [];
      if (ch.action === 'add') { if (arr.some((x) => sameText(x, t))) fail(`"${t}" is already in ${f}`); arr.push(t); }
      else if (ch.action === 'remove' || ch.action === 'edit') {
        const key = ch.action === 'remove' ? t : String(ch.old || '');
        const i = key ? findItem(arr, key) : -1;
        if (i < 0) fail(`No item like "${key}" in ${c.name}'s ${f}. The items now:\n${arr.map((x) => `- ${x}`).join('\n')}`);
        if (ch.action === 'remove') arr.splice(i, 1); else arr[i] = t;
      } else fail(`${f} is a list: action add, remove or edit`);
    } else fail(`Unknown field ${f}`);
    done.push(`${f}: ${ch.action}${ch.action === 'edit' ? ` "${ch.old}" ->` : ''} "${t}"`);
  }
  if (JSON.stringify(sheet) === JSON.stringify(before)) return `Nothing changed in ${c.name}'s sheet.`;
  const why = String(a.why || '').slice(0, 500);
  await admin.firestore().collection('sheetEdits').add({ char: c.id, before, after: sheet, why, changes: done, by: BY, undone: false, t: FieldValue.serverTimestamp() });
  const r = await content.put({ kind: 'character', id: c.id, sheet }, `${BY}: ${why}`.slice(0, 120));
  if (r.error) fail(`Not saved: ${r.error} ${r.detail || ''}`);
  await afterWrite();
  return `Saved to ${c.name}'s sheet (Backstage → דמויות shows it as changed; the site's chat answers from it now):\n${done.map((x) => `- ${x}`).join('\n')}\nUndo: undo_sheet_change.`;
}
async function undoSheet(b, a) {
  const c = findCharacter(b, a.character || '') || fail(`No character "${a.character}"`);
  const s = await admin.firestore().collection('sheetEdits').where('char', '==', c.id).get();
  const last = s.docs.filter((d) => !d.data().undone).sort((x, y) => (y.data().t?.toMillis?.() || 0) - (x.data().t?.toMillis?.() || 0))[0];
  if (!last) fail(`No change to ${c.name}'s sheet made from here to undo.`);
  const e = last.data(), rec = await content.get('character', c.id);
  if (JSON.stringify(rec.sheet || {}) !== JSON.stringify(e.after)) fail(`${c.name}'s sheet was changed again since (in Backstage or by a session) - not undoing over it. Tell Shlomi which part to fix and use update_character_sheet.`);
  const r = await content.put({ kind: 'character', id: c.id, sheet: e.before }, `${BY}: undo`);
  if (r.error) fail(`Not undone: ${r.error}`);
  await last.ref.update({ undone: true, undoneAt: FieldValue.serverTimestamp() });
  await afterWrite();
  return `Undone - ${c.name}'s sheet is back as it was before: ${(e.changes || []).join('; ')}`;
}

async function run(b, name, a = {}) {
  switch (name) {
    case 'about': return aboutText(b);
    case 'get_writing_guide': return craft.text(await craft.get());
    case 'update_writing_guide': {
      const r = await craft.change(a, BY);
      if (r.error) fail(r.error);
      return a.action === 'add_lesson' ? `Lesson saved - it is part of the writing guide now (${r.lessons} lessons). Every GPT that writes through this server reads it.` : `The writing guide is re-written (version ${r.v}; the one before is kept).`;
    }
    case 'update_character_sheet': return editSheet(b, a);
    case 'undo_sheet_change': return undoSheet(b, a);
    case 'list_characters': {
      const w = a.series ? findWorld(b, a.series) || fail(`No series "${a.series}" - see list_series`) : null;
      const cs = w ? castOf(b, w) : b.characters;
      return `${cs.length} characters${w ? ` in ${w.title}` : ''} (id | name | world | role | tagline):\n` + cs.map((c) => [c.id, c.name, c.world || '', c.role || '', c.tagline || ''].join(' | ')).join('\n');
    }
    case 'get_character': { const c = findCharacter(b, a.character || '') || fail(`No character "${a.character}" - try search or list_characters`); return characterText(b, c, await openNotes(c.id)); }
    case 'list_series': return aboutText(b).split('## Series\n')[1];
    case 'get_series': return worldText(b, findWorld(b, a.series || '') || fail(`No series "${a.series}" - see list_series`));
    case 'list_videos': {
      let vs = [...b.videos];
      if (a.character) { const c = findCharacter(b, a.character) || fail(`No character "${a.character}"`); vs = vs.filter((v) => (v.cast || []).includes(c.id)); }
      if (a.series) { const w = findWorld(b, a.series) || fail(`No series "${a.series}"`); const ids = new Set(castOf(b, w).map((c) => c.id)); vs = vs.filter((v) => (v.cast || []).some((id) => ids.has(id))); }
      vs.sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
      return `${vs.length} videos (id | date | title | cast | what happens):\n` + vs.map((v) => [v.id, v.date || '', v.title, (v.cast || []).map((id) => nameOf(b, id)).join(', '), v.card || v.teaser || ''].join(' | ')).join('\n');
    }
    case 'get_video': return videoText(b, b.vById[a.id] || b.videos.find((v) => v.id.toLowerCase() === String(a.id || '').toLowerCase()) || fail(`No video "${a.id}" - try search`));
    case 'sites_and_games':
      return `## Sites\n${(b.sites || []).map((s) => `- ${s.title} | ${pub(s.url)} | ${s.about || ''} | whose: ${(s.whose || []).join(', ')}`).join('\n')}\n\n## Games\n${(b.games || []).map((g) => `- ${g.title} | ${pub(g.url)} | ${g.tagline || ''} | with: ${(g.chars || []).map((id) => nameOf(b, id)).join(', ')}`).join('\n')}`;
    case 'search': {
      const results = search(b, a.query || '').map((h) => ({ id: `${h.kind}:${h.id}`, title: `${h.title} (${h.kind})`, url: h.url, text: h.snip }));
      return { json: { results } };
    }
    case 'fetch': {
      const id = String(a.id || '');
      if (id === 'about') return { json: { id, title: 'The Shlomiverse', text: aboutText(b), url: SITE } };
      const [kind, ...rest] = id.split(':'), key = rest.join(':');
      const item = (title, text, url) => ({ json: { id, title, text, url, metadata: { kind } } });
      if (kind === 'character') { const c = findCharacter(b, key) || fail(`No ${id}`); return item(c.name, characterText(b, c, await openNotes(c.id)), `${SITE}/c/${c.id}`); }
      if (kind === 'video') { const v = b.vById[key] || fail(`No ${id}`); return item(v.title, videoText(b, v), `${SITE}/v/${v.id}`); }
      if (kind === 'series') { const w = findWorld(b, key) || fail(`No ${id}`); return item(w.title, worldText(b, w), `${SITE}/s/${w.id}`); }
      if (kind === 'site') { const s = (b.sites || []).find((x) => x.id === key) || fail(`No ${id}`); return item(s.title, `${s.title}\n${pub(s.url)}\n${s.about || ''}\nWhose: ${(s.whose || []).map((x) => nameOf(b, x)).join(', ')}`, pub(s.url)); }
      if (kind === 'game') { const g = (b.games || []).find((x) => x.id === key) || fail(`No ${id}`); return item(g.title, `${g.title}\n${pub(g.url)}\n${g.tagline || ''}\nWith: ${(g.chars || []).map((x) => nameOf(b, x)).join(', ')}`, pub(g.url)); }
      return fail(`Unknown id "${id}" - ids look like character:hani or video:haredit-1`);
    }
    default: return fail(`Unknown tool ${name}`);
  }
}

// ---- MCP over HTTP (stateless JSON-RPC) ----
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'The Shlomiverse - Shlomi Zevin\'s Hebrew comedy universe. Before writing a script, read get_writing_guide (how we write scripts here - follow it), then each character\'s sheet with get_character (who they are, how they talk, what is funny, catchphrases, their life) and the transcripts of their videos with get_video. Content is in Hebrew. Writes only when Shlomi asks: what was learned about a character -> update_character_sheet; about how we write -> update_writing_guide.';
async function answer(msg) {
  const { id, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
  if (!method) return err(-32600, 'Invalid request');
  if (id === undefined || id === null) return null;   // a notification (initialized, cancelled): nothing to answer
  if (method === 'initialize') {
    const v = VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0];
    return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'shlomiverse', title: 'Shlomiverse', version: '1.1.0' }, instructions: INSTRUCTIONS });
  }
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok({ tools: TOOLS });
  if (method === 'resources/list') return ok({ resources: [] });
  if (method === 'prompts/list') return ok({ prompts: [] });
  if (method === 'tools/call') {
    try {
      const out = await run(await load(), params.name, params.arguments || {});
      if (out && out.json) return ok({ content: [{ type: 'text', text: JSON.stringify(out.json) }], structuredContent: out.json });
      return ok({ content: [{ type: 'text', text: out }] });
    } catch (e) {
      if (!e.user) console.error('verseMcp tool', params.name, e);
      return ok({ content: [{ type: 'text', text: e.user ? e.message : 'Something went wrong reading the Shlomiverse - try again.' }], isError: true });
    }
  }
  return err(-32601, `Method not found: ${method}`);
}

exports.verseMcp = onRequest({ region: 'europe-west1', secrets: [KEY], memory: '512MiB', timeoutSeconds: 120, maxInstances: 3, cors: true }, async (req, res) => {
  const parts = req.path.split('/').filter(Boolean);   // /mcp/<key> through shlomiverse.com, /<key> on the function's own URL
  const key = parts[parts.length - 1] || '';
  const want = KEY.value().trim();
  // his key is short (his choice, 2026-11-10), so wrong guesses are limited: 20 an hour per address, then nothing answers
  const ip = req.ip || '?', now = Date.now(), tries = (wrong.get(ip) || []).filter((t) => now - t < 3600e3);
  if (tries.length >= 20) return res.status(429).send('Too many tries');
  if (!want || key.length !== want.length || !require('crypto').timingSafeEqual(Buffer.from(key), Buffer.from(want))) {
    wrong.set(ip, [...tries, now]);
    return res.status(404).send('Not found');
  }
  if (req.method === 'GET') return res.status(405).set('Allow', 'POST').send('This MCP server answers POST (streamable HTTP, no SSE stream).');
  if (req.method === 'DELETE') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('');
  const body = req.body;
  if (Array.isArray(body)) {
    const outs = (await Promise.all(body.map(answer))).filter(Boolean);
    return outs.length ? res.json(outs) : res.status(202).send('');
  }
  const out = await answer(body);
  if (!out) return res.status(202).send('');
  res.json(out);
});
exports._mcp = { answer, load, run };
