// The Shlomiverse as an MCP server (his ask, 2026-11-10: "I want my ChatGPT web to reach the Shlomiverse and read about the
// characters and everything - I write a lot of scripts with it"). Read-only: every character's full writer's profile, the
// series, every video with its transcript, the sites and the games - the same composed brain the chat reads
// (gs://shlomiverse-private/wiki-brain.json, written by content.js / catalog.js from the records).
// Writes (his ask, 2026-11-17: "from the MCP I can update the nuance about the characters ... and update the skill of how we
// write scripts"): update_character_sheet (the record's sheet = Backstage → דמויות, through the content door - logged in
// catalogLog, marked as changed in Backstage, the full sheet before kept in Firestore sheetEdits, undo_sheet_change brings it
// back) and the writing guide (scriptcraft.js: get_writing_guide / update_writing_guide). ChatGPT asks him before any write.
// New residents (his ask, 2026-11-17: "I'll add characters from my GPT session, with their profile pictures"): get_new_character_guide
// (the structure + a real example + the picture house style), create_character (page + sheet + relations both ways, through the
// content door), update_character_details, create_series, set_character_picture (ChatGPT hands the image through
// _meta openai/fileParams -> {download_url}, or image_url; cropped 4:5 -> wiki/img/c/<id>.jpg, the old one and the original kept in
// shlomiverse-private/portraits/<id>/). Fallback when ChatGPT can't pass the image: his upload page /mcp/<key>/upload/<id>.
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
  { name: 'get_personal_requests', title: 'Personal video requests', description: 'The requests for a personal video (a greeting from a resident - birthday, anniversary...) exactly as they arrived to the verse: for whom, the occasion and its date, which resident they asked for, and everything they wrote. Open ones by default, oldest event first. To discuss with Shlomi how to make each greeting.',
    inputSchema: S({ all: { type: 'boolean', description: 'Also the ones already handled (done)' } }) },
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

// ---- new residents and their pictures (his ask, 2026-11-17: "I'm going to add characters to the verse from my GPT session - it
// should create the profile with the same structure as all the rest, send the profile image and update profile images") ----
const RELATION = S({ character: str('The other character: id or name (must already exist)'), relation: str('Hebrew: who the other one is to THIS character, e.g. "אחיה הגדול - מתקשר כל ערב"'),
  back: str('Hebrew: who THIS character is to the other one (written on the other one\'s page - links go both ways)') }, ['character', 'relation', 'back']);
const SHEET = S({ person: str('מי זה - who they are, as a real person (a paragraph)'), speech: str('איך מדבר - how they talk'), funny: str('מה מצחיק - what is funny about them'),
  parody: str('הפרודיה - what in real life they mirror'), dissonance: str('הדיסוננס - their core contradiction'),
  nuances: { type: 'array', items: { type: 'string' }, description: 'ניואנסים - small real-life details, one per item' },
  catchphrases: { type: 'array', items: { type: 'string' }, description: 'קאצ\'פרייז - only real recurring lines (can be empty)' } }, ['person', 'speech', 'funny', 'parody', 'dissonance']);
const DETAILS = {
  name: str('Hebrew full name as people call them, e.g. "רבקי שטיין"'), name_en: str('English name, e.g. "Rivki Stein"'),
  role: str('Hebrew: what they do / who they are in one line, e.g. "גננת בבית שמש"'), tagline: str('Hebrew: 3-6 words under the name on their page'),
  bio: str('Hebrew: the page\'s bio - 2-4 sentences, third person, as a real person (their job, family, one telling habit)'),
  look: str('Hebrew: how they look (clothes, hair, glasses...) - also the base of their picture'),
  aka: { type: 'array', items: { type: 'string' }, description: 'Every name / nickname people may search them by, Hebrew and English' },
  ask: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'Hebrew: 3 short questions a visitor would ask them in the chat (the chat\'s starters)' },
  color: str('Their colour on the site, hex like "#1f3a5f"'),
  love: { type: 'integer', minimum: 1, maximum: 10, description: 'How loveable (1-10)' }, viral: { type: 'integer', minimum: 1, maximum: 10, description: 'How viral right now (1-10)' },
};
const IMAGE = { type: 'object', additionalProperties: true, description: 'The picture from this conversation (an image you generated or one Shlomi attached)',
  properties: { download_url: { type: 'string' }, file_id: { type: 'string' }, mime_type: { type: 'string' }, file_name: { type: 'string' } } };
TOOLS.push(
  { name: 'get_new_character_guide', title: 'How a new character is built', annotations: RO,
    description: 'READ THIS FIRST before create_character or making a character\'s picture: the exact structure every Shlomiverse character has (with a real example), the rules for each field, the series to choose from, and the house style of profile pictures.',
    inputSchema: S({}) },
  { name: 'create_character', title: 'Create a new character', annotations: W,
    description: 'Add a new character (resident) to the Shlomiverse - same structure as every other one: page details + the character sheet (the one truth the site\'s chat answers from) + relations both ways. Read get_new_character_guide first. ONLY when Shlomi asks, after showing him the whole profile. Live on the site and in the chat at once; then set_character_picture.',
    inputSchema: S({ id: str('English id for the address shlomiverse.com/c/<id>: lowercase letters, digits and -, e.g. "rivki-stein"'),
      series: str('The series / world they belong to - id or name from list_series (a new one: create_series first)'), ...DETAILS, sheet: SHEET,
      relations: { type: 'array', items: RELATION, description: 'Family / work ties to existing characters - written on both pages' } },
      ['id', 'series', 'name', 'name_en', 'role', 'tagline', 'bio', 'look', 'aka', 'ask', 'sheet']) },
  { name: 'update_character_details', title: 'Update a character\'s page details', annotations: W,
    description: 'Change a character\'s page details (name, role, tagline, bio, look, nicknames, chat starters, colour, loveable / viral) or add relations - ONLY when Shlomi asks, after showing him the change. A list you send (aka, ask) replaces the whole list. The sheet itself: update_character_sheet.',
    inputSchema: S({ character: str('The character id, name or nickname'), why: str('One line: why (shown in the log)'), ...DETAILS,
      add_relations: { type: 'array', items: RELATION, description: 'New ties to existing characters - written on both pages' } }, ['character', 'why']) },
  { name: 'create_series', title: 'Create a new series / world', annotations: W,
    description: 'A new series (world) for new characters - ONLY when Shlomi asks and no existing series fits (list_series first).',
    inputSchema: S({ id: str('English id: lowercase letters, digits and -'), title: str('Hebrew title as shown on the site'), blurb: str('Hebrew: one or two sentences - what this world is'),
      brief: str('Hebrew: the writer\'s picture of this world (who, where, the tone)') }, ['id', 'title', 'blurb']) },
  { name: 'set_character_picture', title: 'Set a character\'s profile picture', annotations: W,
    _meta: { 'openai/fileParams': ['image'] },
    description: 'Put a picture as a character\'s profile picture (new or replacing the old one - the old one is kept). Pass the image from this conversation in `image` (generated or attached), or a public https link in `image_url`. Follow the house style in get_new_character_guide. ONLY when Shlomi approves the picture. Cropped 4:5 from the top - the face high and centred. If it cannot get the picture it returns an upload link for Shlomi.',
    inputSchema: S({ character: str('The character id, name or nickname'), image: IMAGE, image_url: str('Instead of image: a public https link to the picture') }, ['character']) },
);
const ENID = /^[a-z0-9][a-z0-9-]{1,40}$/;
async function seriesRec(b, q) {
  const w = findWorld(b, q || '');
  const id = w ? w.id : String(q || '').trim();
  const r = await content.get('series', id);
  if (r.error) fail(`No series "${q}". The series:\n${b.worlds.map((x) => `- ${x.id} | ${x.title}`).join('\n')}\n(a new one: create_series)`);
  return r;
}
const pick = (a) => Object.fromEntries(Object.keys(DETAILS).filter((k) => a[k] !== undefined && a[k] !== '' && !(Array.isArray(a[k]) && !a[k].length)).map((k) => [k, typeof a[k] === 'string' ? a[k].trim() : a[k]]));
// relations both ways: [{character, relation, back}] -> this one's list + a line on each other one's record
async function tie(b, id, name, rels, mine) {
  const out = [...mine], done = [];
  for (const r of rels || []) {
    const o = findCharacter(b, r.character || '') || fail(`No character "${r.character}" to tie to - try list_characters`);
    if (o.id === id) continue;
    if (!out.some((x) => x.id === o.id)) out.push({ id: o.id, relation: String(r.relation || '').trim() });
    const rec = await content.get('character', o.id), theirs = Array.isArray(rec.relations) ? rec.relations : [];
    if (!theirs.some((x) => x.id === id)) {
      const w = await content.put({ kind: 'character', id: o.id, relations: [...theirs, { id, relation: String(r.back || '').trim() }] }, `${BY}: tie to ${id}`);
      if (w.error) fail(`Could not write the tie on ${o.name}'s page: ${w.error}`);
    }
    done.push(`${o.name} (${o.id})`);
  }
  return { list: out, done };
}
async function createCharacter(b, a) {
  const id = String(a.id || '').trim().toLowerCase();
  if (!ENID.test(id)) fail('id: lowercase English letters, digits and - only (2-41 chars), e.g. "rivki-stein"');
  if (!(await content.get('character', id)).error) fail(`There is already a character "${id}" - pick another id, or update_character_details / update_character_sheet for that one.`);
  const same = findCharacter(b, a.name || '');
  if (same && norm(same.name) === norm(a.name)) fail(`${same.name} already exists (id ${same.id}). If this is someone else, give the full name; to change that one use update_character_details.`);
  const s = await seriesRec(b, a.series);
  const sh = a.sheet || {};
  for (const f of SHEET_TEXT) if (!String(sh[f] || '').trim()) fail(`The sheet needs ${f} - see get_new_character_guide`);
  const sheet = Object.fromEntries([...SHEET_TEXT.map((f) => [f, String(sh[f]).trim()]), ...SHEET_LIST.map((f) => [f, (Array.isArray(sh[f]) ? sh[f] : []).map((x) => String(x).trim()).filter(Boolean)])]);
  const order = Math.max(0, ...b.characters.map((c) => +c.order || 0)) + 1;
  const rec = { kind: 'character', id, ...pick(a), series: s.id, world: s.world || s.title, sheet, order };
  const r = await content.put(rec, `${BY}: new character`);
  if (r.error) fail(`Not created: ${r.error} ${r.detail || ''}`);
  const t = await tie(b, id, a.name, a.relations, []);
  if (t.list.length) await content.put({ kind: 'character', id, relations: t.list }, `${BY}: relations`);
  await afterWrite();
  return `Created ${a.name} (${id}) in ${s.title} - live now: ${SITE}/c/${id} (the chat knows them from their sheet).${t.done.length ? `\nTied both ways to: ${t.done.join(', ')}` : ''}\nNo picture yet - next: set_character_picture (house style in get_new_character_guide).`;
}
async function updateDetails(b, a) {
  const c = findCharacter(b, a.character || '') || fail(`No character "${a.character}" - try list_characters`);
  const set = pick(a), rec = await content.get('character', c.id);
  let tied = [];
  if (a.add_relations?.length) { const t = await tie(b, c.id, c.name, a.add_relations, Array.isArray(rec.relations) ? rec.relations : []); set.relations = t.list; tied = t.done; }
  if (!Object.keys(set).length) fail('Nothing to change - send the fields to change');
  const r = await content.put({ kind: 'character', id: c.id, ...set }, `${BY}: ${String(a.why || '').slice(0, 100)}`);
  if (r.error) fail(`Not saved: ${r.error} ${r.detail || ''}`);
  await afterWrite();
  return r.changed.length ? `Saved on ${c.name}'s page: ${r.changed.join(', ')}.${tied.length ? ` Tied both ways to: ${tied.join(', ')}.` : ''} ${SITE}/c/${c.id}` : `Nothing changed - ${c.name}'s page already says that.`;
}
async function createSeries(b, a) {
  const id = String(a.id || '').trim().toLowerCase();
  if (!ENID.test(id)) fail('id: lowercase English letters, digits and - only');
  if (!(await content.get('series', id)).error || findWorld(b, a.title || '')?.title === a.title) fail(`Series "${a.id}" / "${a.title}" already exists - see list_series`);
  const r = await content.put({ kind: 'series', id, title: a.title.trim(), blurb: a.blurb.trim(), brief: String(a.brief || '').trim(), world: a.title.trim(), name: a.title.trim(),
    order: Math.max(0, ...b.worlds.map((w) => +w.order || 0)) + 1 }, `${BY}: new series`);
  if (r.error) fail(`Not created: ${r.error} ${r.detail || ''}`);
  await afterWrite();
  return `Created the series ${a.title} (${id}): ${SITE}/s/${id} - now create_character with series "${id}". (It shows on the site once it has characters.)`;
}

// ---- pictures ----
// the same crop as content.mjs portrait / build.py: 4:5 from the top (faces sit high), 480x600 JPEG - gs://shlomiverse-media/wiki/img/c/<id>.jpg.
// The picture it replaces and the original that came in are kept in the private bucket (portraits/<id>/...)
const MEDIA = 'shlomiverse-media', PRIV = 'shlomiverse-private';
async function savePortrait(id, buf, by) {
  const sharp = require('sharp');
  const img = sharp(buf, { failOn: 'none' }).rotate(), m = await img.metadata();
  if (!m.width || !m.height) fail('That is not a picture I can read (PNG, JPEG or WebP).');
  if (m.width < 300 || m.height < 300) fail(`The picture is too small (${m.width}x${m.height}) - at least 300 px each side, ideally 1024.`);
  const w = m.width, h = m.height, box = w / h > 0.8 ? { left: Math.floor((w - Math.floor(h * 0.8)) / 2), top: 0, width: Math.floor(h * 0.8), height: h } : { left: 0, top: 0, width: w, height: Math.floor(w / 0.8) };
  const jpg = await sharp(buf, { failOn: 'none' }).rotate().extract(box).resize(480, 600, { kernel: 'lanczos3' }).flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const live = admin.storage().bucket(MEDIA).file(`wiki/img/c/${id}.jpg`), stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const [had] = await live.exists();
  if (had) await live.copy(admin.storage().bucket(PRIV).file(`portraits/${id}/before-${stamp}.jpg`));
  await admin.storage().bucket(PRIV).file(`portraits/${id}/in-${stamp}.${(m.format || 'img').replace('jpeg', 'jpg')}`).save(buf, { contentType: `image/${m.format || 'png'}` });
  await live.save(jpg, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000', metadata: { by, mtime: String(Date.now()) } } });
  await admin.firestore().collection('catalogLog').add({ kind: 'character', id, op: 'portrait', fields: ['portrait'], before: { portrait: had ? `kept: portraits/${id}/before-${stamp}.jpg` : 'none' }, by, t: FieldValue.serverTimestamp() });
  await afterWrite();
  return { had, size: `${w}x${h}` };
}
const uploadLink = (key, id) => `${SITE}/mcp/${key}/upload/${encodeURIComponent(id)}`;
async function setPicture(b, a, key) {
  const c = findCharacter(b, a.character || '') || fail(`No character "${a.character}" - try list_characters`);
  const img = a.image, url = (img && typeof img === 'object' ? img.download_url || img.url : typeof img === 'string' && /^https?:/.test(img) ? img : '') || a.image_url || '';
  const manual = `Shlomi can upload it himself on this page (from the phone too): ${uploadLink(key, c.id)}`;
  if (!/^https:\/\//.test(url)) fail(`I did not receive the picture itself${img ? ' (only a reference, without a link to download)' : ''}. ${manual}`);
  let buf;
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) { fail(`Could not download the picture (${e.message}). ${manual}`); }
  if (buf.length > 20e6) fail('The picture is over 20 MB.');
  const s = await savePortrait(c.id, buf, BY);
  return `${s.had ? 'Replaced' : 'Set'} ${c.name}'s profile picture (${s.size} -> 480x600, cropped 4:5 from the top)${s.had ? '; the old one is kept' : ''}. Live: ${SITE}/c/${c.id}`;
}
function newCharacterGuide(b) {
  const ex = b.byId.hani, exJson = ex ? JSON.stringify({ id: ex.id, series: ex.series || 'techytech', name: ex.name, name_en: ex.name_en, role: ex.role, tagline: ex.tagline, bio: ex.bio,
    look: ex.look, aka: (ex.aka || []).slice(0, 5), ask: ex.ask, color: ex.color, love: ex.love, viral: ex.viral, sheet: ex.sheet,
    relations: [{ character: 'yotam', relation: 'המילה שלו קובעת בשבילה - "תבדוק קודם עם יותם"', back: 'חנה מהצוות שלו - בודקת איתו כל החלטה' }] }, null, 1) : '';
  return `# How a new Shlomiverse character is built

Every character is one record - the same structure for all of them. create_character writes it; the site page
(${SITE}/c/<id>) and the site's chat are made from it at once. All text in Hebrew except id and name_en.

The Shlomiverse is real: they are real people with a job, a family, habits - never "a character", "a sketch" or "Shlomi's".
Shlomi plays every one of them himself in his videos.

## The fields
- id - the address, English: lowercase letters, digits and -, e.g. "rivki-stein". Never changes.
- series - the world they live in (list below). A new world only if none fits: create_series first.
- name - Hebrew, as people call them. name_en - English.
- role - what they do, one line ("מפתחת Backend בטקי-טק"). tagline - 3-6 words under the name.
- bio - the page's text: 2-4 sentences, third person, a real person: job, family, one telling habit. No "דמות", no jokes explained.
- look - how they look; their picture is built from it.
- aka - every name and nickname people may search (Hebrew + English).
- ask - 3 short questions a visitor would ask them in the chat ("אפשר לשלוח לך בוואטסאפ?").
- color - a hex colour for their page. love / viral - 1-10 (a new character: what Shlomi says, else leave out).
- sheet - THE most important part: the one truth about them; the chat answers only from it:
  person (מי זה - a paragraph: who they are), speech (איך מדבר), funny (מה מצחיק - where the comedy comes from),
  parody (הפרודיה - what in real life it mirrors), dissonance (הדיסוננס - the core contradiction),
  nuances (ניואנסים - small concrete real-life details, one per item), catchphrases (only lines they really repeat; may be empty).
- relations - ties to existing characters: relation = who the other is to them, back = who they are to the other
  (written on the other one's page too - family links always go both ways).

Their life (one event per video) and their videos are added by themselves when a video with them is published.

## A real example (Hani / Hana)
${exJson}

## The series
${b.worlds.map((w) => `- ${w.id} | ${w.title} | ${w.blurb || ''}`).join('\n')}

## The profile picture - house style (every resident looks like this)
Photoreal studio headshot: head and shoulders, centred, eyes open looking into the camera, soft even light, plain light-grey
seamless background (a setting of their role is fine when it says who they are - a teacher's chalkboard). A believable real
person - nothing looks like a costume or a filter. When Shlomi gives a frame of himself playing them: keep his face and the
character's look (hair, glasses, beard, clothes) and make it a real person; a woman he plays gets a smooth clean-shaven
feminine face. A profile = who they ARE, not a moment from a video: no gestures, no props in the face, no text in the picture.
Real age. Portrait or square, the face in the upper middle (it is cropped 4:5 from the top to 480x600).
Show Shlomi the picture first; set_character_picture only after he approves it.

## Order of work
1. Talk with Shlomi until the profile is right; show it to him whole. 2. create_character. 3. Make the picture, he approves.
4. set_character_picture. Changing later: update_character_details (page) / update_character_sheet (sheet) / set_character_picture.`;
}
function uploadPage(name, id) {
  const e = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>תמונת פרופיל - ${e(name)}</title><style>body{margin:0;background:#0f0f12;color:#f5f4f1;font:16px/1.5 system-ui,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
.c{max-width:360px;width:100%;text-align:center}h1{font-size:22px;margin:0 0 6px}p{color:#aaa;margin:0 0 18px}label{display:block;background:#ff6a1f;color:#fff;border-radius:14px;padding:16px;font-weight:700;cursor:pointer}
input{display:none}img{width:240px;height:300px;object-fit:cover;border-radius:16px;margin:18px auto 0;display:none}#s{margin-top:14px;min-height:24px}</style></head><body><div class="c">
<h1>${e(name)}</h1><p>תמונת פרופיל חדשה. נחתכת 4:5 מלמעלה; הישנה נשמרת.</p><label>בחירת תמונה<input id="f" type="file" accept="image/*"></label><img id="v" alt=""><div id="s"></div></div>
<script>f.onchange=async()=>{const x=f.files[0];if(!x)return;s.textContent='מעלה…';try{const r=await fetch(location.pathname,{method:'POST',headers:{'content-type':x.type||'application/octet-stream'},body:x});const j=await r.json();
if(!r.ok)throw new Error(j.error||r.status);v.src=j.img+'&t='+Date.now();v.style.display='block';s.textContent='עלתה. היא באתר.';}catch(err){s.textContent='לא עלתה: '+err.message;}};</script></body></html>`;
}

// "איך מברך" - each resident's technique for a personal video (his ask, 2026-11-19): his own area, NOT the sheet and never in the chat
// (greetvoice.js, Firestore greetingVoice). Read with get_greeting_voice, written when he asks.
TOOLS.push(
  { name: 'get_greeting_voice', title: 'How a resident blesses (personal videos)', annotations: RO,
    description: 'A resident’s "איך מברך": how they bless someone for an event in a personal video - the structure, the voice, what is always there and what never. Shlomi’s own working area for personal videos. NOT part of the character design: it is a separate layer only for personal videos. It is not in the character sheet (get_character / update_character_sheet), it never goes to the site’s chat or to ציפציפ, and the chat never learns from it - so what is written here never changes how the resident talks anywhere else, and nothing about who the resident is belongs here (that goes to update_character_sheet). Without a character: which residents already have one. Read it (with get_character and get_personal_requests) before writing a greeting.',
    inputSchema: S({ character: str('Optional: the character id, name or nickname') }) },
  { name: 'update_greeting_voice', title: 'Update how a resident blesses', annotations: W,
    description: 'Write a resident’s "איך מברך" (how they bless for an event in a personal video) back to the verse - ONLY when Shlomi asks, after showing him the text. action replace = the whole new text (markdown, Hebrew); append = adds a part at the end. NOT part of the character design: it is a separate layer only for personal videos. It is not in the character sheet (get_character / update_character_sheet), it never goes to the site’s chat or to ציפציפ, and the chat never learns from it - so what is written here never changes how the resident talks anywhere else, and nothing about who the resident is belongs here (that goes to update_character_sheet). Shows in Backstage → דמויות on the resident’s page, in its own section. Every earlier version is kept (undo_greeting_voice).',
    inputSchema: S({ character: str('The character id, name or nickname'), action: { type: 'string', enum: ['replace', 'append'] }, text: str('The text (Hebrew, markdown)'),
      why: str('One line: what was learned in this session') }, ['character', 'action', 'text']) },
  { name: 'undo_greeting_voice', title: 'Undo the last "how they bless" change', annotations: W,
    description: 'Put a resident’s "איך מברך" back as it was before the last change - when Shlomi says a change was wrong.',
    inputSchema: S({ character: str('The character id, name or nickname') }, ['character']) },
);
async function greetVoice(b, a, op) {
  const gv = require('./greetvoice'), NL = '\n';
  if (op === 'get' && !a.character) {
    const all = await gv.all(), ids = Object.keys(all).filter((id) => all[id].text);
    return ids.length ? 'Residents with "איך מברך":' + NL + ids.map((id) => `- ${id} | ${nameOf(b, id)} | ${(all[id].text.split(NL)[0] || '').slice(0, 80)}`).join(NL) : 'No resident has "איך מברך" yet.';
  }
  const c = findCharacter(b, a.character || '') || fail(`No character "${a.character}" - try search or list_characters`);
  if (op === 'get') { const g = await gv.get(c.id); const head = `# ${c.name} - איך מברך (personal videos only)${NL}(A separate layer for personal videos - not part of the character design, never in the chat. Who ${c.name} is: get_character.)${NL}${NL}`;
    return g && g.text ? head + g.text : `${c.name} has no "איך מברך" yet.`; }
  if (op === 'undo') { const r = await gv.undo(c.id, BY); if (r.error) fail(r.error); return `Done - the "איך מברך" of ${c.name} is back to:${NL}${NL}${r.text}`; }
  const text = String(a.text || '').trim() || fail('text is empty');
  const was = (await gv.get(c.id))?.text || '';
  const r = await gv.put(c.id, a.action === 'append' && was ? was + NL + NL + text : text, BY, a.why || '');
  if (r.error) fail(r.error);
  return `Saved - the "איך מברך" of ${c.name} (Backstage → דמויות). Undo: undo_greeting_voice.`;
}
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
// the personal-video requests as they arrived (his ask, 2026-11-19: "give the MCP the requests as they arrived to the verse, the raw
// data - I'll discuss them with ChatGPT"): Firestore requests, kind 'personal' (+ a community 'video' request - the older form for it).
// Everything they wrote, as stored; the sender's address, phone and account id stay out (ChatGPT doesn't need them to write a greeting).
async function personalRequests(all) {
  const s = await admin.firestore().collection('requests').where('kind', 'in', ['personal', 'video']).get();
  const ts = (v) => (v?.toDate ? v.toDate().toISOString() : v);
  const reach = (c) => (!c || /@|^[+\d][\d\s-]{6,}$/.test(String(c).trim()) ? undefined : c);   // "לא לחזור" stays, an address or a phone doesn't
  const rows = s.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => (r.kind === 'personal' || r.from === 'community') && (all || !r.done))
    .map(({ uid, email, phone, contact, of, ...r }) => JSON.parse(JSON.stringify({ ...r, contact: reach(contact), t: ts(r.t), answeredAt: ts(r.answeredAt) })))
    .sort((x, y) => String(x.date || x.t || '').localeCompare(String(y.date || y.t || '')));
  return { json: { count: rows.length, requests: rows } };
}
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

async function run(b, name, a = {}, key = '') {
  switch (name) {
    case 'about': return aboutText(b);
    case 'get_writing_guide': return craft.text(await craft.get());
    case 'update_writing_guide': {
      const r = await craft.change(a, BY);
      if (r.error) fail(r.error);
      return a.action === 'add_lesson' ? `Lesson saved - it is part of the writing guide now (${r.lessons} lessons). Every GPT that writes through this server reads it.` : `The writing guide is re-written (version ${r.v}; the one before is kept).`;
    }
    case 'update_character_sheet': return editSheet(b, a);
    case 'get_new_character_guide': return newCharacterGuide(b);
    case 'create_character': return createCharacter(b, a);
    case 'update_character_details': return updateDetails(b, a);
    case 'create_series': return createSeries(b, a);
    case 'set_character_picture': return setPicture(b, a, key);
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
    case 'get_personal_requests': return personalRequests(!!a.all);
    case 'get_greeting_voice': return greetVoice(b, a, 'get');
    case 'update_greeting_voice': return greetVoice(b, a, 'put');
    case 'undo_greeting_voice': return greetVoice(b, a, 'undo');
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
const INSTRUCTIONS = 'The Shlomiverse - Shlomi Zevin\'s Hebrew comedy universe. Before writing a script, read get_writing_guide (how we write scripts here - follow it), then each character\'s sheet with get_character (who they are, how they talk, what is funny, catchphrases, their life) and the transcripts of their videos with get_video. Content is in Hebrew. Writes only when Shlomi asks: what was learned about a character -> update_character_sheet; about how we write -> update_writing_guide; a new character -> read get_new_character_guide, then create_character and set_character_picture. Personal videos (greetings people asked for): get_personal_requests, and how each resident blesses in get_greeting_voice - a separate layer for personal videos only, NOT part of the character design: it never goes to the chat (write it back with update_greeting_voice only when Shlomi asks; what was learned about the character itself goes to update_character_sheet).';
async function answer(msg, key = '') {
  const { id, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
  if (!method) return err(-32600, 'Invalid request');
  if (id === undefined || id === null) return null;   // a notification (initialized, cancelled): nothing to answer
  if (method === 'initialize') {
    const v = VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0];
    return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'shlomiverse', title: 'Shlomiverse', version: '1.2.0' }, instructions: INSTRUCTIONS });
  }
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok({ tools: TOOLS });
  if (method === 'resources/list') return ok({ resources: [] });
  if (method === 'prompts/list') return ok({ prompts: [] });
  if (method === 'tools/call') {
    try {
      const out = await run(await load(), params.name, params.arguments || {}, key);
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
  const parts = req.path.split('/').filter(Boolean);   // /mcp/<key>[/upload/<id>] through shlomiverse.com, /<key>... on the function's own URL
  if (parts[0] === 'mcp') parts.shift();
  const key = parts[0] || '', rest = parts.slice(1);
  const want = KEY.value().trim();
  // his key is short (his choice, 2026-11-10), so wrong guesses are limited: 20 an hour per address, then nothing answers
  const ip = req.ip || '?', now = Date.now(), tries = (wrong.get(ip) || []).filter((t) => now - t < 3600e3);
  if (tries.length >= 20) return res.status(429).send('Too many tries');
  if (!want || key.length !== want.length || !require('crypto').timingSafeEqual(Buffer.from(key), Buffer.from(want))) {
    wrong.set(ip, [...tries, now]);
    return res.status(404).send('Not found');
  }
  // the picture upload page (set_character_picture's fallback, his phone): GET = the page, POST = the picture's bytes
  if (rest[0] === 'upload' && rest[1]) {
    const b = await load(), c = b.byId[decodeURIComponent(rest[1])];
    if (!c) return res.status(404).send('No such character');
    if (req.method === 'GET') return res.set('Cache-Control', 'no-store').type('html').send(uploadPage(c.name, c.id));
    if (req.method !== 'POST') return res.status(405).send('');
    try {
      await savePortrait(c.id, req.rawBody || Buffer.alloc(0), 'upload page (his MCP link)');
      const f = (await admin.storage().bucket(MEDIA).file(`wiki/img/c/${c.id}.jpg`).getMetadata())[0];
      return res.json({ ok: true, img: `https://storage.googleapis.com/${MEDIA}/wiki/img/c/${c.id}.jpg?v=${Buffer.from(f.md5Hash, 'base64').toString('hex').slice(0, 8)}` });
    } catch (e) { if (!e.user) console.error('verseMcp upload', e); return res.status(400).json({ error: e.user ? e.message : 'failed' }); }
  }
  if (req.method === 'GET') return res.status(405).set('Allow', 'POST').send('This MCP server answers POST (streamable HTTP, no SSE stream).');
  if (req.method === 'DELETE') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('');
  const body = req.body;
  if (Array.isArray(body)) {
    const outs = (await Promise.all(body.map((m) => answer(m, key)))).filter(Boolean);
    return outs.length ? res.json(outs) : res.status(202).send('');
  }
  const out = await answer(body, key);
  if (!out) return res.status(202).send('');
  res.json(out);
});
exports._mcp = { answer, load, run };
