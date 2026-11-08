// The wiki chat's chain (2026-10-31, his ask: cheaper and smarter than sending everything on every question).
// Before: every question carried the whole brain (~60K tokens) - ~1.3¢ cached, ~11¢ after each push, growing with
// every video. Now:
//   the map      - always: one line per character + an AI-written card per video (build.py -> brain.videos[].card),
//                  part of the instructions, so OpenAI caches it once for every question and both calls below.
//   the answer   - Terra, with what is already in hand (base) and a look_up tool: it answers small talk at once, and
//                  for a question about someone / a video it calls look_up (residents and videos by meaning - "the
//                  whispering teacher", "a video about an elevator", "him") and a second call answers with the FULL
//                  profiles + transcripts. (Until 2026-11-01 a separate router call ran before every answer: "היי"
//                  waited ~1.1-1.8 s for nothing. Measured after: small talk 0.6-1.0 s to the first word.)
// His rules for who knows whom (2026-10-31):
//   the guide    knows everyone; a conversation can move from Rosenblum to someone else and keep both (what the
//                earlier turns were about stays in - the [[char]] / [[video]] cards it already showed + the router).
//   a character  speaks only in their own voice and knows only their own world (all of Techy-Tech know each other)
//                and the people linked to them; anyone else they don't know personally.
// When the wiki passes ~400 videos the map gets too long for the router: add embeddings as a first filter then
// (narrow the videos to ~20 by similarity, the router picks from those).
const MAX_MATERIAL = 30000;  // characters of full profiles + transcripts sent with one answer (~10K tokens)
const MAX_CHARS = 5, MAX_VIDEOS = 6;

const routerTask = (scope) => `ROUTING STEP - do not answer the visitor. Read the conversation and decide which residents and videos from the map above the visitor's LAST message needs (use the earlier turns for follow-ups like "him", "her", "that video", "more"). Pick by meaning, not only by exact names; include a resident the conversation was about earlier when the last message still refers to them or compares with them. Up to ${MAX_CHARS} residents and up to ${MAX_VIDEOS} videos; for greetings or general talk about the Shlomiverse pick none. If the visitor asks for videos about a topic or asks whether something exists, pick the videos whose cards fit it - and when you are unsure, also pick the ones that might touch it even in passing (the answer reads their full words and decides); picking none means the answer will say there is no such video.${scope ? `
The visitor is talking with ${scope.name} (${scope.self}). Only these residents may be picked (the people ${scope.name} knows): ${scope.allowed.join(', ') || 'none'}.` : ''}
Answer JSON only: {"characters": ["id", ...], "videos": ["id", ...]}`;

// the sites live on shlomiverse.com (the same site as boostmind-b052c.web.app, his public address since 2026-10-31)
const pub = (u) => (typeof u === 'string' ? u : u?.url || '').replace('https://boostmind-b052c.web.app', 'https://shlomiverse.com');
exports.pub = pub;

// small: only who lives here (the site's processes - Miriam, Demokratovich's booth, the simulation - 2026-11-08: the full map
// is ~100K characters, 70% of it the videos, and each step of a process paid for all of it)
exports.mapText = (brain, small = false) => {
  if (small) {
    const lines = ['# Who lives in the Shlomiverse (id | name | world | tagline)'];
    for (const c of brain.characters) lines.push([c.id, c.name, c.world || '', c.tagline || ''].join(' | '));
    return lines.join('\n');
  }
  const lines = ['# The Shlomiverse map (everything that exists; full details of the residents and videos a question is about come with it)', '## Series'];
  for (const w of brain.worlds) lines.push(`${w.id} | ${w.title} | ${w.blurb || ''}${w.brief ? ' | ' + w.brief : ''}${w.site ? ' | site: ' + pub(w.site) : ''}`);
  lines.push('## Residents (id | name | also called | world | role | tagline | their own site)');
  for (const c of brain.characters) {
    lines.push([c.id, c.name, (c.aka || []).join(', '), c.world || '', c.role || '', c.tagline || '', pub(c.site)].join(' | '));
  }
  // every site of the world (build.py site_cards - his ask, 2026-11-01: the chat must know ALL of them, Hani's games too)
  if (brain.sites?.length) {
    lines.push('## Sites - every site in the Shlomiverse (card id | name | address | what it is | whose). Asked about one, how to get to it, or to play / buy / order: show it with [[site:card id]] on its own line');
    for (const s of brain.sites) lines.push([s.id, s.title, s.url, s.about, s.whose.join(', ') + (s.in ? ` - a game in ${s.in}` : '')].join(' | '));
  }
  // the videos by title only (2026-11-08): what happens in each is found by look_up's search (wiki-search.js) - the cards were 70%
  // of the map and grew with every video
  lines.push('## Videos (id | date | title | cast) - what happens in each is NOT here: to find a video by what happens in it, use look_up with "search"');
  for (const v of brain.videos) lines.push([v.id, v.date || '', v.title, (v.cast || []).join(', ')].join(' | '));
  return lines.join('\n');
};

// who a character knows: their world + the people linked to them (either way)
exports.known = (cur, id) => {
  const c = cur.byId[id];
  const out = new Set();
  for (const o of Object.values(cur.byId)) {
    if (o.id === id) continue;
    const linked = (c.relations || []).some((r) => r.id === o.id) || (o.relations || []).some((r) => r.id === id);
    if ((c.world && o.world === c.world) || linked) out.add(o.id);
  }
  return [...out];
};

// the ids the conversation already showed as cards - what it was about stays in
exports.earlier = (cur, turns) => {
  const chars = [], vids = [];
  for (const t of turns.slice(-8)) {
    if (t.role !== 'assistant') continue;
    for (const m of t.content.matchAll(/\[\[(char|video):([\w-]+)\]\]/g)) {
      if (m[1] === 'char' && cur.byId[m[2]]) chars.push(m[2]);
      if (m[1] === 'video' && cur.videos[m[2]]) vids.push(m[2]);
    }
  }
  return { characters: [...new Set(chars.reverse())], videos: [...new Set(vids.reverse())] };  // newest first
};

// the full material, within MAX_MATERIAL: residents first (whole profiles), then videos
exports.material = (cur, charIds, videoIds, max = MAX_MATERIAL) => {
  const out = [];
  let size = 0;
  const add = (s) => { if (size + s.length > max) return false; out.push(s); size += s.length; return true; };
  for (const id of new Set(charIds)) {
    const c = cur.byId[id];
    if (c) add('### Resident ' + id + ' (full profile)\n' + JSON.stringify(c).replaceAll('https://boostmind-b052c.web.app', 'https://shlomiverse.com'));
  }
  for (const id of new Set(videoIds)) {
    const v = cur.videos[id];
    if (v && v.transcript) add(`### Video ${v.id} | ${v.title} | ${v.teaser || ''} | cast: ${(v.cast || []).join(', ')}\n${v.transcript}`);
  }
  return out.length ? '# Full details for this question\n' + out.join('\n\n') : '';
};

// what a character chat is told about who they know (their own voice only; the map lists everyone)
exports.scopeText = (cur, id, knownIds) => {
  const c = cur.byId[id];
  const names = knownIds.map((k) => cur.byId[k].name);
  return names.length
    ? `People you know personally (your world${c.world ? ' - ' + c.world : ''} and the people linked to you): ${names.join(', ')}. Anyone else on the map you don't know personally - if the visitor asks about them, say in your own voice that you don't know them, and offer them with a [[char:ID]] card if the visitor wants to talk to them.`
    : `You don't know the other residents on the map personally - if the visitor asks about one, say in your own voice that you don't know them, and offer them with a [[char:ID]] card if the visitor wants to talk to them.`;
};

// the routing call: JSON only, small output; the map is the cached prefix, the task comes after the conversation
exports.pick = async (key, model, cur, turns, scope) => {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions: cur.map,
      input: [...turns.slice(-6), { role: 'developer', content: routerTask(scope) }],
      reasoning: { effort: 'low' },
      max_output_tokens: 1200,
      prompt_cache_key: 'wiki-map',
      store: false,
      text: { format: { type: 'json_object' } },
    }),
  });
  if (!res.ok) throw new Error(`router ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const r = await res.json();
  const text = (r.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content).find((c) => c.type === 'output_text')?.text || '{}';
  let j = {};
  try { j = JSON.parse(text); } catch (e) { j = {}; }
  const ok = (id) => cur.byId[id] && (!scope || scope.allowed.includes(id) || id === scope.self);
  return {
    characters: (j.characters || []).filter(ok).slice(0, MAX_CHARS),
    videos: (j.videos || []).filter((id) => cur.videos[id]).slice(0, MAX_VIDEOS),
    usage: r.usage || {},
  };
};

// ---- one call that decides by itself (2026-11-01, his note "היי" took a while: the router ran before every answer) ----
// The answer call gets what is already known (a character: themself + own videos; the guide: what the talk was about)
// and a look_up tool. Small talk / a follow-up the material covers -> it answers at once (one call). A question about
// someone or something not in hand -> it calls look_up first (the router's job, same rules), then a second call answers
// with the full material. Same map prefix, same cache key, so a question costs what router + answer cost before.
exports.base = (cur, mode, turns) => {
  const before = exports.earlier(cur, turns);
  const self = cur.byId[mode];
  if (!self) return { characters: before.characters.slice(0, MAX_CHARS), videos: before.videos.slice(0, MAX_VIDEOS), allowed: null, scope: '' };
  const allowed = exports.known(cur, mode);
  const own = [...(self.videos || [])].sort((a, b) => String(cur.videos[b]?.date || '').localeCompare(String(cur.videos[a]?.date || '')));
  const people = before.characters.filter((id) => id !== mode && allowed.includes(id));
  return { characters: [mode, ...people], videos: [...before.videos.filter((v) => !own.includes(v)), ...own], allowed, self: mode, name: self.name,
    scope: exports.scopeText(cur, mode, allowed) };
};

// the SAME tool for everyone (2026-11-08): OpenAI puts the tools before the instructions, so a per-character description made
// every character's prompt differ from its first words and the map was never read from the cache (10c a first question vs 1c)
exports.lookupTool = () => ({
  type: 'function', name: 'look_up',
  description: `Fetch the FULL profiles and video transcripts the visitor's last message needs, when they are not already in the "Full details" you were given. Pick residents from the map by meaning, not only exact names ("the whispering teacher", "him"). Videos: the map has only their titles - pick by id when the title or an earlier card makes it clear, and for a video asked about by what happens in it ("a video about an elevator", "is there a video about X", "the one where...") put those words in "search" (Hebrew, a few words) - the matching videos come back with their full transcripts. Up to ${MAX_CHARS} residents and ${MAX_VIDEOS} videos. When you speak as a resident, pick only the people you know (listed with your part).`,
  parameters: { type: 'object', additionalProperties: false, required: ['characters', 'videos', 'search'],
    properties: { characters: { type: 'array', items: { type: 'string' } }, videos: { type: 'array', items: { type: 'string' } }, search: { type: 'string' } } },
  strict: true,
});

exports.lookupNote = (b) => (b.allowed && !b.allowed.length ? '' :
  (b.allowed ? `

look_up: you are ${b.name} - only these residents may be picked (the people you know): ${b.allowed.join(', ')}.` : '') + '\n\nBefore you write anything: the map has only one line per resident and per video. If the visitor asks about a resident, or what happened or what was said in a video, or whether a video about something exists, and those full details are NOT above, call look_up first and write nothing before it - never fill in details from the one-line cards. For a greeting, thanks or small talk, or when the details above already cover it, just answer.');

// the ids look_up asked for, checked (scope) and merged with what was already in hand
exports.merge = (cur, b, args) => {
  const ok = (id) => cur.byId[id] && (!b.allowed || b.allowed.includes(id) || id === b.self);
  const chars = (args.characters || []).filter(ok).slice(0, MAX_CHARS);
  const vids = (args.videos || []).filter((id) => cur.videos[id]).slice(0, MAX_VIDEOS);
  return { characters: [...new Set([...(b.self ? [b.self] : []), ...chars, ...b.characters])].slice(0, MAX_CHARS + 2),
    videos: [...new Set([...vids, ...b.videos])].slice(0, MAX_VIDEOS + 2) };
};

// the whole selection for one question (the old two-step router - kept for scripts/wiki/chain_test.cjs)
exports.select = async (key, model, cur, mode, turns) => {
  const before = exports.earlier(cur, turns);
  if (cur.byId[mode]) {
    // a character chat: themself + their own videos always; the router adds people they know when the talk turns to them
    const self = cur.byId[mode];
    const allowed = exports.known(cur, mode);
    const own = [...(self.videos || [])].sort((a, b) => String(cur.videos[b]?.date || '').localeCompare(String(cur.videos[a]?.date || '')));
    let p = { characters: [], videos: [], usage: {} };
    if (allowed.length && turns.length) {
      try { p = await exports.pick(key, model, cur, turns, { self: mode, name: self.name, allowed }); } catch (e) { console.error('wikiChat router failed', e.message); }
    }
    const people = p.characters.filter((id) => id !== mode);
    return { characters: [mode, ...people], videos: [...p.videos.filter((v) => !own.includes(v)), ...own], usage: p.usage,
      scope: exports.scopeText(cur, mode, allowed) };
  }
  // the guide: the router's picks first, then what the conversation was already about
  let p = { characters: [], videos: [], usage: {} };
  try { p = await exports.pick(key, model, cur, turns, null); } catch (e) { console.error('wikiChat router failed, answering from the map', e.message); }
  return { characters: [...p.characters, ...before.characters].slice(0, MAX_CHARS + 2), videos: [...p.videos, ...before.videos].slice(0, MAX_VIDEOS + 2), usage: p.usage, scope: '' };
};
