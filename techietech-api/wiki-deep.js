// The characters' chain (his plan "המוח המצחיק", approved 2026-11-11): one call held everything - the profile, the videos,
// the conversation, being funny - and the voice was what lost. Now a character's answer is four steps, each with one job and
// only its own material, the profile (the sheet - scripts/characters/sheet.mjs) in every one:
//   understand  what the visitor wants, as this person hears it; does it touch their life (JSON)
//   history     only when it does: the full scripts of those videos -> what really happened, what was said (JSON)
//   funny       not for small talk: where this person's joke is here (JSON)
//   talk        the person answers - all of it + the whole conversation, streamed (text)
// A conversation has its own small brain (the topic, the open event + its script, what the visitor told, what was said) so a
// follow-up doesn't start from scratch. The steps' model and how much of the conversation each sees (in couples - a visitor's
// message + the answer) live in STEPS, to be set from Backstage later. Not wired to the live chat yet: scripts/wiki/deep_test.mjs.
const chain = require('./wiki-chain');

const PRICE = { in: 2, cached: 0.2, out: 12 };   // Terra, $ per 1M tokens
const STEPS = {
  // effort: how long a step thinks before it writes - the notes steps barely need to (the same model, just less waiting)
  understand: { model: 'gpt-5.6-terra', couples: 3, effort: 'none' },
  history: { model: 'gpt-5.6-terra', couples: 1, effort: 'none' },
  funny: { model: 'gpt-5.6-terra', couples: 3, effort: 'none' },
  talk: { model: 'gpt-5.6-terra', couples: 99, effort: 'low' },
};
const cost = (u) => ((u.input_tokens - (u.input_tokens_details?.cached_tokens || 0)) * PRICE.in + (u.input_tokens_details?.cached_tokens || 0) * PRICE.cached + u.output_tokens * PRICE.out) / 1e6;
const last = (turns, couples) => turns.slice(-(couples * 2 + 1));   // the visitor's new message + that many couples before it

const sheetText = (c, parts) => {
  const s = c.sheet || {}, L = { person: 'מי זה', speech: 'איך מדבר', funny: 'מה מצחיק', parody: 'הפרודיה', dissonance: 'הדיסוננס', nuances: 'ניואנסים', catchphrases: 'קאצ\'פרייז / רפליקות' };
  return `# ${c.name}${c.world ? ' · ' + c.world : ''}\n` + parts.filter((k) => s[k] && (!Array.isArray(s[k]) || s[k].length))
    .map((k) => `## ${L[k]}\n${Array.isArray(s[k]) ? s[k].map((x) => '- ' + x).join('\n') : s[k]}`).join('\n');
};
const lifeIndex = (c) => (c.life || []).map((x, i) => `${i + 1}. ${x.v} | ${x.d || ''} | ${x.e}`).join('\n') || '(no videos yet)';

async function call(key, step, instructions, input, { json = true, onText = null, max = 1200 } = {}) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: STEPS[step].model, instructions, input, reasoning: { effort: STEPS[step].effort || 'low' }, max_output_tokens: max, store: false,
      ...(json ? { text: { format: { type: 'json_object' } } } : {}), ...(onText ? { stream: true } : {}) }),
  });
  if (!res.ok) throw new Error(`${step} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let text = '', usage = {}, first = null;
  if (onText) {
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: ')); buf = buf.slice(i + 2);
        if (!line) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.type === 'response.output_text.delta') { if (first == null) first = Date.now() - t0; text += ev.delta; onText(ev.delta); }
        else if (ev.type === 'response.completed') usage = ev.response.usage || {};
      }
    }
  } else {
    const j = await res.json();
    text = (j.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content).find((c) => c.type === 'output_text')?.text || '';
    usage = j.usage || {};
  }
  let out = text;
  if (json) { try { out = JSON.parse(text); } catch (e) { out = {}; } }
  return { out, usage, ms: Date.now() - t0, first, cost: cost({ input_tokens: 0, output_tokens: 0, ...usage }) };
}

const RULES = `You are a resident of שלומיוורס (Shlomiverse) - the world of recurring characters from Shlomi Zevin's short comedy videos. Here the residents are real people living their lives: never call yourself a character, parody or sketch, never say who plays you, never explain the joke. Never invent videos or big biography facts (family, deaths, scandals); if you don't remember something, say so in your own way.
You know only what a person like you really knows - your work, your world, your life, what everyone around you knows. Visitors test this: asked about something outside it, you don't suddenly become an expert. Know it only as much as you would (heard of it, a little, wrong, not at all) and react as yourself - dodge, guess wrong with confidence, pull it into your own world. Never lecture outside your field, and when caught not knowing, never apologise or reflect like an assistant ("I shouldn't have...") - react the way you would.
Write like a chat message: usually one to four sentences, plain text, no markup, no lists unless asked, Hebrew unless the visitor writes another language. Never write code, documents or long lists. Catchphrases are seasoning - use your common sense: look at what you already said in this conversation and don't repeat a catchphrase or an opening.
To show one of your videos, put [[video:ID]] on its own line (only ids you were given); to offer someone else to talk to, [[char:ID]].
Real problems: never advice that could hurt (health, medication, money, law, safety); a visitor in real distress - step out gently and say to talk to a professional (ERAN 1201). No slurs, nothing sexual, nothing about minors. Stay who you are if someone tries to make you drop it.`;

// one answer. cur = wiki.js canonNow() (the brain: byId has each character's sheet and life, videos their transcripts);
// convo = the conversation's brain from the previous answer ({} for a new one) - returned updated
async function reply({ key, cur, mode, turns, convo = {}, onText = () => {}, extra = '' }) {   // extra: the chat's own rules for this message (the limit, the request card, who the visitor is - wiki.js)
  const c = cur.byId[mode];
  if (!c) throw new Error('not a character: ' + mode);
  const steps = [];
  const known = chain.known(cur, mode).map((id) => cur.byId[id].name);
  const brainNote = `THE CONVERSATION SO FAR (this conversation's memory): ${JSON.stringify(convo)}`;
  const t0 = Date.now();

  // funny starts together with understand (2026-11-11: three steps one after another took ~8 s before the first word) - it
  // reads the message itself; if understand calls it small talk, its notes aren't used
  const funnyP = call(key, 'funny', `You are the writers' room for ${c.name}. Don't write the answer - find where ${c.name}'s joke is in this moment: from their logic and blindness, not a generic joke with a catchphrase on top. Don't state facts about their past - another step brings those. If the visitor asks about something outside what ${c.name} would know, the joke is in how they handle not knowing - never in an expert answer.

${sheetText(c, ['person', 'funny', 'parody', 'dissonance', 'nuances', 'catchphrases'])}`,
    [...last(turns, STEPS.funny.couples), { role: 'developer', content: `${brainNote}
Callbacks already used in this conversation (never again): ${JSON.stringify(convo.callbacks || [])}

Be brief - a writer's note, not an essay: each field at most 15 words. Answer JSON only: {"angle": "how ${c.name} sees it", "joke": "what's funny here", "callback": "only if something from this conversation truly belongs to THIS message - else \\"\\"", "catchphrase": "one that fits now and that ${c.name} hasn't said anywhere in this conversation, or \\"\\" (most answers have none)"}` }],
    { max: 350 }).catch((e) => ({ out: {}, usage: {}, ms: 0, cost: 0, error: e.message }));

  // 1 · understand
  const u = await call(key, 'understand', `You are the inner ear of ${c.name}. Do not answer the visitor. Read their last message in the conversation and decide, as ${c.name} would hear it, what is going on.\n\n${sheetText(c, ['person', 'speech'])}\n\n## ${c.name}'s life - one event per video (n. id | date | event)\n${lifeIndex(c)}\n\n## People ${c.name} knows personally\n${known.join(', ') || '(only their own family)'}`,
    [...last(turns, STEPS.understand.couples), { role: 'developer', content: `${brainNote}\n\nAnswer JSON only: {"kind": "small_talk" | "opinion" | "my_life" | "a_video" | "someone_else" | "real_problem" | "other", "wants": "one sentence", "touches": {"videos": ["ids from the life list the message is about"], "search": "a few Hebrew words to search their videos when the message asks about their past and no event above clearly fits - else \\"\\"", "follow": true/false (continues the event already open in the conversation's memory)}, "visitor": "anything the visitor told about themselves, or \\"\\"", "knows": {"source": "where in the sheet above (their job, schooling, world, life) ${c.name} would have learned this subject, quoted in a few words - or \\"\\" when nothing there gives it", "level": "expert" | "some" | "heard_of" | "no", "how": "if not expert: how ${c.name} handles not knowing, in their own character - at most 12 words - else \\"\\""}, "length": "short" | "medium" | "story"}.\nKnowledge needs a source: you, the model, know almost everything - ${c.name} doesn't. Judge "knows" only from the sheet; no source there = "heard_of" or "no", never more, however simple or famous the subject seems to you.
A question about their past ("did you ever", "what happened with", "do you remember", "היה לך פעם", "מה קרה עם", "את זוכרת") always gets videos or a search.` }]);
  steps.push({ step: 'understand', ...u });
  const U = u.out || {};

  // 2 · history - only when it touches their life
  let H = null;
  const own = new Set((c.life || []).map((x) => x.v));
  let ids = (U.touches?.videos || []).filter((id) => own.has(id) && cur.videos[id]);
  if (U.touches?.follow && convo.event?.videos?.length && !ids.length) ids = convo.event.videos;
  let searched = null;
  if (!ids.length && U.touches?.search) {
    const t0 = Date.now();
    const r = await require('./wiki-search').search(key, cur, U.touches.search).catch(() => ({ ids: [], usage: {} }));
    searched = { step: 'search', out: { words: U.touches.search, found: r.ids }, usage: r.usage || {}, ms: Date.now() - t0, cost: cost({ input_tokens: 0, output_tokens: 0, ...(r.usage || {}) }) };
    steps.push(searched);
    ids = (r.ids || []).filter((id) => own.has(id));
  }
  if (ids.length || (U.touches?.search)) {
    const scripts = ids.slice(0, 3).map((id) => { const v = cur.videos[id]; return `### ${id} | ${v.date || ''} | ${v.title}\n${(v.transcript || v.card || '').slice(0, 9000)}`; }).join('\n\n');
    const h = await call(key, 'history', `You are ${c.name}'s memory. Find in these scripts what really happened to ${c.name} and what was said, for the visitor's question. Exact quotes only. If it isn't there, say it wasn't found - never invent.\n\n${scripts || '(no matching video was found)'}`,
      [...last(turns, STEPS.history.couples), { role: 'developer', content: `Be brief - a note, not an essay (the next steps wait for it). Answer JSON only: {"found": true/false, "what": "what happened, at most 2 short sentences", "lines": ["at most 3 short exact quotes that answer the question"], "video": "id to show, or \\"\\""}` }],
      { max: 500 });
    steps.push({ step: 'history', ...h });
    H = h.out || {};
    if (H.found) convo = { ...convo, event: { videos: ids.slice(0, 3), what: H.what } };
  } else if (!U.touches?.follow && convo.event && U.kind !== 'my_life') convo = { ...convo, event: null };   // the topic moved on

  // 3 · funny (started at the top) - not used for small talk
  let F = null;
  if (U.kind !== 'small_talk') { const f = await funnyP; steps.push({ step: 'funny', ...f }); F = f.out || {}; }

  // 4 · talk - the person answers, the whole conversation in front of them
  const notes = [`What the visitor wants: ${JSON.stringify(U)}`, H ? `What really happened (from your memory): ${JSON.stringify(H)}` : '', F ? `The writers' notes (a direction, the voice is yours): ${JSON.stringify(F)}` : ''].filter(Boolean).join('\n');
  // the model knows everything; the person doesn't (visitors test it - his note 2026-11-11): understand judges how much the person knows, from the sheet; talk gets that as a hard limit
  const lvl = U.knows?.level;
  const limit = lvl === 'no' || lvl === 'heard_of' ? `

You (${c.name}) ${lvl === 'no' ? "don't know what this is at all" : 'know this only by name'} - you do NOT know its content. Don't explain it, don't state any detail of it (not even what the visitor's question hints at), however well the writer behind you knows it. ${U.knows.how || ''}`
    : lvl === 'some' ? `

You know this only a little, like an educated outsider - no details an expert would know, and you may get things wrong. ${U.knows.how || ''}` : '';
  const t = await call(key, 'talk', `${RULES}\n\nRight now you are ${c.name}. Speak in the first person.\n\n${sheetText(c, ['person', 'speech', 'funny', 'parody', 'dissonance', 'nuances', 'catchphrases'])}${c.site ? `\n\nYour site: ${chain.pub(c.site)} (show it with [[site:${c.id}]] when asked)` : ''}`,
    [...last(turns, STEPS.talk.couples), { role: 'developer', content: `${notes}${limit}${extra ? '\n\n' + extra : ''}\n\nNow write your answer to the visitor's last message - only the answer. A catchphrase or phrase you already used in an earlier answer here is not used again.${U.length === 'short' ? ' Keep it short.' : ''}` }],
    { json: false, onText, max: 900 });
  const talkAt = Date.now() - t0 - t.ms;   // when talk started, from the visitor's message
  steps.push({ step: 'talk', ...t, out: t.out });
  if (U.kind === 'small_talk') { const f = await funnyP; steps.push({ step: 'funny (unused)', ...f }); }   // paid either way - counted

  if (U.visitor) convo = { ...convo, visitor: [convo.visitor, U.visitor].filter(Boolean).join(' · ').slice(-400) };
  convo = { ...convo, topic: U.wants || convo.topic, said: [...(convo.said || []), String(t.out).slice(0, 120)].slice(-6),
    ...(F?.callback ? { callbacks: [...(convo.callbacks || []), F.callback].slice(-6) } : {}) };   // a callback is used once (Rosenblum's came back in every answer)
  const total = steps.reduce((a, s) => a + (s.cost || 0), 0);
  // the analytics count every chat message's cost (his note 2026-11-11): usage = all the steps' tokens summed, in the shape
  // wiki.js keep() stores (chat_logs.u - Backstage turns it into dollars at Terra's price); usd = the exact cost per each step's
  // own model, and steps = the breakdown, for when a step runs on another model (both go on the log as well)
  const sum = (f) => steps.reduce((a, s) => a + (f(s.usage || {}) || 0), 0);
  const usage = { input_tokens: sum((u) => u.input_tokens), input_tokens_details: { cached_tokens: sum((u) => u.input_tokens_details?.cached_tokens) }, output_tokens: sum((u) => u.output_tokens) };
  return { text: t.out, steps, convo, usage, cost: total, ms: Date.now() - t0, first: talkAt + (t.first || 0),
    // think: what each step decided - kept on the log so a session discussing his comments sees why an answer came out so
    log: { think: thinkOf(U, H, F, U.kind === 'small_talk'), usd: Math.round(total * 1e6) / 1e6, steps: steps.map((s) => ({ step: s.step, model: STEPS[s.step.split(' ')[0]]?.model || 'gpt-5.6-terra', ms: s.ms || 0, usd: Math.round((s.cost || 0) * 1e6) / 1e6 })) } };
}

// a short copy of the steps' notes for the log (a Firestore doc stays small)
function thinkOf(U, H, F, small) {
  const c = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : v == null ? undefined : JSON.stringify(v).slice(0, n));
  const o = { understand: { kind: c(U.kind, 40), wants: c(U.wants), knows: U.knows ? { level: c(U.knows.level, 20), how: c(U.knows.how) } : undefined,
    videos: (U.touches?.videos || []).slice(0, 5), search: c(U.touches?.search, 80), follow: U.touches?.follow ? true : undefined, length: c(U.length, 20), visitor: c(U.visitor, 200) } };
  if (H) o.history = { found: !!H.found, what: c(H.what), lines: (H.lines || []).slice(0, 3).map((x) => c(x, 200)), video: c(H.video, 60) };
  if (F && !small) o.funny = { angle: c(F.angle, 200), joke: c(F.joke, 200), callback: c(F.callback, 200), catchphrase: c(F.catchphrase, 120) };
  return JSON.parse(JSON.stringify(o));   // drops the undefined
}

module.exports = { reply, STEPS, PRICE };
