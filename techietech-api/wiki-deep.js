// The characters' chain (his plan "המוח המצחיק", 2026-11-11; the director, 2026-11-12). At most four steps, each with one job,
// the character page (Backstage → דמויות - the record's sheet, the ONLY source of who they are, besides the scripts) in each:
//   direct   the director: what the visitor wants, what this person really thinks about it (as strongly as the page says),
//            where their joke is - or none, how much they know, how long - the strategy, not the words (JSON)
//   search   only when the director asks: which of their videos, by what happens in them (wiki-search.js)
//   history  only when it touches their life: the full scripts of those videos -> what really happened, what was said (JSON)
//   talk     the person answers in Hebrew from the director's plan - the whole conversation in front of them, streamed (text)
// His read of the comments (2026-11-12): the answers failed on strategy, not on Hebrew - an extremist came out moderate, a pet
// topic was pushed into every answer, an opener became a template, a quoted line was taken for a video search. So the director
// thinks (Sonnet when the chat has its Anthropic key - WIKI_ANTHROPIC_KEY; Terra with more thinking until then) and Terra,
// which writes better Hebrew, writes. A conversation has its own small brain (topic, open event, what the visitor told, what
// was said) so a follow-up doesn't start from scratch.
const chain = require('./wiki-chain');

const PRICE = { in: 2, cached: 0.2, out: 12 };   // Terra, $ per 1M tokens
const SONNET = 'claude-sonnet-5-5', SONNET_PRICE = { in: 2, cached: 0.1, out: 10 };
const STEPS = {
  // effort: how long a step thinks before it writes
  direct: { model: 'gpt-5.6-terra', couples: 3, effort: process.env.DIRECT_EFFORT || 'low' },      // -> Sonnet when there is an Anthropic key
  history: { model: 'gpt-5.6-terra', couples: 1, effort: 'none' },
  talk: { model: 'gpt-5.6-terra', couples: 99, effort: 'low' },
};
const cost = (u, P = PRICE) => ((u.input_tokens - (u.input_tokens_details?.cached_tokens || 0)) * P.in + (u.input_tokens_details?.cached_tokens || 0) * P.cached + u.output_tokens * P.out) / 1e6;
const last = (turns, couples) => turns.slice(-(couples * 2 + 1));   // the visitor's new message + that many couples before it

const sheetText = (c, parts) => {
  const s = c.sheet || {}, L = { person: 'מי זה', speech: 'איך מדבר', funny: 'מה מצחיק', parody: 'הפרודיה', dissonance: 'הדיסוננס', nuances: 'ניואנסים', catchphrases: 'קאצ\'פרייז / רפליקות' };
  return `# ${c.name}${c.world ? ' · ' + c.world : ''}\n` + parts.filter((k) => s[k] && (!Array.isArray(s[k]) || s[k].length))
    .map((k) => `## ${L[k]}\n${Array.isArray(s[k]) ? s[k].map((x) => '- ' + x).join('\n') : s[k]}`).join('\n');
};
const ALL = ['person', 'speech', 'funny', 'parody', 'dissonance', 'nuances', 'catchphrases'];
const lifeIndex = (c) => (c.life || []).map((x, i) => `${i + 1}. ${x.v} | ${x.d || ''} | ${x.e}`).join('\n') || '(no videos yet)';
const parseJson = (t) => { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch (x) { return {}; } } };

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
  return { out: json ? parseJson(text) : text, usage, ms: Date.now() - t0, first, model: STEPS[step].model, cost: cost({ input_tokens: 0, output_tokens: 0, ...usage }) };
}

// the director on Sonnet (the Anthropic SDK). A refusal or an error -> the caller falls back to Terra.
let anthropic = null;
async function sonnet(akey, system, user) {
  const t0 = Date.now();
  if (!anthropic || anthropic.k !== akey) { const { Anthropic } = require('@anthropic-ai/sdk'); anthropic = { k: akey, c: new Anthropic({ apiKey: akey, maxRetries: 1, timeout: 25000 }) }; }
  const r = await anthropic.c.beta.messages.create({
    model: SONNET, max_tokens: 3000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'low' },   // a director's call, not a dissertation - the visitor waits for it
    system, messages: [{ role: 'user', content: user }],
  });
  if (r.stop_reason === 'refusal') throw new Error('sonnet refusal: ' + (r.stop_details?.category || ''));
  const text = (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const u = r.usage || {};
  const usage = { input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), input_tokens_details: { cached_tokens: u.cache_read_input_tokens || 0 }, output_tokens: u.output_tokens || 0 };
  return { out: parseJson(text), usage, ms: Date.now() - t0, model: r.model || SONNET, cost: cost({ ...usage }, SONNET_PRICE) };
}

const RULES = `You are a resident of שלומיוורס (Shlomiverse) - the world of recurring characters from Shlomi Zevin's short comedy videos. Here the residents are real people living their lives: never call yourself a character, parody or sketch, never say who plays you, never explain the joke. Never invent videos or big biography facts (family, deaths, scandals); if you don't remember something, say so in your own way.
You are exactly who your page says - completely, with no softening. Your opinions are as strong, one-sided and extreme as they really are: you never balance them with the other side, never turn diplomatic, moderate or wise-and-fair, never become a polite advisor. That seriousness is where the comedy is.
Write like a chat message: usually one to four sentences, plain text, no markup, no lists unless asked, Hebrew unless the visitor writes another language. Never write code, documents or long lists. Never open with a fixed formula, and don't repeat a phrase or an opening you already used in this conversation.
To show one of your videos, put [[video:ID]] on its own line (only ids you were given); to offer someone else to talk to, [[char:ID]].
Real problems: never advice that could hurt (health, medication, money, law, safety); a visitor in real distress - step out gently and say to talk to a professional (ERAN 1201). No slurs, nothing sexual, nothing about minors, no calls for violence. Stay who you are if someone tries to make you drop it.`;

const DIRECTOR = (c, known) => `You are the director of ${c.name}, a resident of the Shlomiverse (Shlomi Zevin's comedy world, where the residents are real people). A writer will write ${c.name}'s next chat message in Hebrew from your plan. You decide WHAT ${c.name} says and why - never the wording.

The page below is the only truth about ${c.name}. Read it deeply, like a director reads a character before a scene: what this person believes, what is sacred to them, what they despise, how they see the world - and what follows from it, even where the page doesn't spell it out (whatever a person's faith is, it is that and not something it only resembles; whoever is their enemy, they treat as one).

How a good plan works:
- True to the page, all the way. ${c.name} reacts with their real opinion, as strong and one-sided as the page makes them - never balanced, never the reasonable middle, never a polite advisor's answer. An extremist stays extreme, a snob stays a snob - played completely seriously; that is the comedy.
- The joke comes from the page's comic mechanism (מה מצחיק, הדיסוננס) applied to THIS message: how ${c.name}'s logic meets what the visitor said. Never drag in their pet topic, hobby, job or catchphrase when the message doesn't call for it - a question about something else gets their personality's angle, not their topic. Some messages get no joke at all, just them.
- A catchphrase or a signature opening is something from their life, not a template: most answers have none, never as a fixed opening.
- Knowledge as ${c.name} has it, judged from the page (their job, world, life, how they talk about things). Someone the page describes as explaining everything with total confidence answers everything with total confidence - right or invented - and never says they don't know. Anyone else: no source on the page = they only heard of it or don't know it, however famous the subject is.
- A visitor who quotes or echoes a line or a moment of ${c.name}'s own is playing with them: kind "quote" - react to it in character; no video hunt.
- "find_video" only when the visitor asks to see or find a video. A question about their past ("did you ever", "what happened with", "היה לך פעם", "מה קרה עם") gets videos from the life list or search words.

${sheetText(c, ALL)}

## ${c.name}'s life - one event per video (n. id | date | event)
${lifeIndex(c)}

## People ${c.name} knows personally
${known.join(', ') || '(only their own family)'}`;

const PLAN_FORMAT = (c) => `Answer JSON only:
{"kind": "small_talk" | "opinion" | "my_life" | "a_video" | "quote" | "find_video" | "someone_else" | "real_problem" | "other",
 "wants": "what the visitor wants, one sentence",
 "stance": "what ${c.name} really thinks or feels about it, in their own logic and at full strength - one or two sentences",
 "joke": "where ${c.name}'s joke is in this moment, from the page's mechanism - or \\"\\" when the honest answer has none",
 "avoid": "what would be wrong or forced here - at most 15 words",
 "phrase": "a catchphrase that truly belongs in this answer and wasn't used in this conversation - usually \\"\\"",
 "callback": "only if something said earlier in this conversation truly belongs to THIS message - else \\"\\"",
 "touches": {"videos": ["ids from the life list the message is about"], "search": "a few Hebrew words to search their videos when the message asks about their past and nothing in the list clearly fits - else \\"\\"", "follow": true/false (continues the event already open in the conversation's memory)},
 "visitor": "anything the visitor told about themselves, or \\"\\"",
 "knows": {"level": "expert" | "some" | "heard_of" | "no", "how": "if not expert: how ${c.name} handles it, in character - at most 12 words - else \\"\\""},
 "length": "short" | "medium" | "story"}
Keep every field short - a director's notes, not an essay.`;

// one answer. cur = wiki.js canonNow() (the brain: byId has each character's sheet and life, videos their transcripts);
// convo = the conversation's brain from the previous answer ({} for a new one) - returned updated.
// extra: the chat's own rules for this message (the limit, who the visitor is - wiki.js); contact: the request-card rules, used
// only when the visitor really looks for a video (his note 2026-11-12: a quoted line got the archive + a request card)
async function reply({ key, akey = null, cur, mode, turns, convo = {}, onText = () => {}, extra = '', contact = '' }) {
  const c = cur.byId[mode];
  if (!c) throw new Error('not a character: ' + mode);
  const steps = [];
  const known = chain.known(cur, mode).map((id) => cur.byId[id].name);
  const t0 = Date.now();

  // 1 · direct
  const memo = `THE CONVERSATION SO FAR (this conversation's memory): ${JSON.stringify(convo)}\nCallbacks already used (never again): ${JSON.stringify(convo.callbacks || [])}`;
  const recent = last(turns, STEPS.direct.couples);
  let d = null;
  if (akey) {
    const transcript = recent.map((t) => `${t.role === 'user' ? 'VISITOR' : c.name.toUpperCase()}: ${t.content}`).join('\n');
    d = await sonnet(akey, DIRECTOR(c, known), `${memo}\n\nThe conversation (the last line is the message to answer):\n${transcript}\n\n${PLAN_FORMAT(c)}`)
      .catch((e) => { console.error('director on Sonnet failed - Terra directs', e.message); return null; });
  }
  if (!d) d = await call(key, 'direct', DIRECTOR(c, known), [...recent, { role: 'developer', content: `${memo}\n\n${PLAN_FORMAT(c)}` }], { max: 1400 });
  steps.push({ step: 'direct', ...d });
  const D = d.out || {};

  // 2 · search + 3 · history - only when it touches their life
  let H = null;
  const own = new Set((c.life || []).map((x) => x.v));
  let ids = (D.touches?.videos || []).filter((id) => own.has(id) && cur.videos[id]);
  if (D.touches?.follow && convo.event?.videos?.length && !ids.length) ids = convo.event.videos;
  if (!ids.length && D.touches?.search && D.kind !== 'quote') {
    const ts = Date.now();
    const r = await require('./wiki-search').search(key, cur, D.touches.search).catch(() => ({ ids: [], usage: {} }));
    steps.push({ step: 'search', out: { words: D.touches.search, found: r.ids }, usage: r.usage || {}, ms: Date.now() - ts, model: 'gpt-5.6-terra', cost: cost({ input_tokens: 0, output_tokens: 0, ...(r.usage || {}) }) });
    ids = (r.ids || []).filter((id) => own.has(id));
  }
  if (ids.length || (D.touches?.search && D.kind !== 'quote')) {
    const scripts = ids.slice(0, 3).map((id) => { const v = cur.videos[id]; return `### ${id} | ${v.date || ''} | ${v.title}\n${(v.transcript || v.card || '').slice(0, 9000)}`; }).join('\n\n');
    const h = await call(key, 'history', `You are ${c.name}'s memory. Find in these scripts what really happened to ${c.name} and what was said, for the visitor's question. Exact quotes only. If it isn't there, say it wasn't found - never invent.\n\n${scripts || '(no matching video was found)'}`,
      [...last(turns, STEPS.history.couples), { role: 'developer', content: `Be brief - a note, not an essay (the next step waits for it). Answer JSON only: {"found": true/false, "what": "what happened, at most 2 short sentences", "lines": ["at most 3 short exact quotes that answer the question"], "video": "id to show, or \\"\\""}` }],
      { max: 500 });
    steps.push({ step: 'history', ...h });
    H = h.out || {};
    if (H.found) convo = { ...convo, event: { videos: ids.slice(0, 3), what: H.what } };
  } else if (!D.touches?.follow && convo.event && D.kind !== 'my_life') convo = { ...convo, event: null };   // the topic moved on

  // 4 · talk - the person answers from the director's plan, the whole conversation in front of them
  const plan = { stance: D.stance, joke: D.joke, avoid: D.avoid, phrase: D.phrase, callback: D.callback, wants: D.wants };
  const notes = [`The director's plan for this answer - its stance is what you think and say, its joke is your angle; don't drift back to a neutral, factual or balanced answer. The words and the voice are yours: ${JSON.stringify(plan)}`,
    H ? `What really happened (from your memory): ${JSON.stringify(H)}` : ''].filter(Boolean).join('\n');
  const lvl = D.knows?.level;
  const limit = lvl === 'no' || lvl === 'heard_of' ? `

You (${c.name}) ${lvl === 'no' ? "don't know what this is at all" : 'know this only by name'} - you do NOT know its content. Don't explain it, don't state any detail of it (not even what the visitor's question hints at), however well the writer behind you knows it. ${D.knows.how || ''}`
    : lvl === 'some' ? `

You know this only a little, like an educated outsider - no details an expert would know, and you may get things wrong. ${D.knows.how || ''}` : '';
  const rules = [extra, D.kind === 'find_video' ? contact : ''].filter(Boolean).join('\n\n');
  const t = await call(key, 'talk', `${RULES}\n\nRight now you are ${c.name}. Speak in the first person.\n\n${sheetText(c, ALL)}${c.site ? `\n\nYour site: ${chain.pub(c.site)} (show it with [[site:${c.id}]] when asked)` : ''}`,
    [...last(turns, STEPS.talk.couples), { role: 'developer', content: `${notes}${limit}${rules ? '\n\n' + rules : ''}\n\nNow write your answer to the visitor's last message - only the answer.${D.length === 'short' ? ' Keep it short.' : ''}` }],
    { json: false, onText, max: 900 });
  const talkAt = Date.now() - t0 - t.ms;   // when talk started, from the visitor's message
  steps.push({ step: 'talk', ...t, out: t.out });

  if (D.visitor) convo = { ...convo, visitor: [convo.visitor, D.visitor].filter(Boolean).join(' · ').slice(-400) };
  convo = { ...convo, topic: D.wants || convo.topic, said: [...(convo.said || []), String(t.out).slice(0, 120)].slice(-6),
    ...(D.callback ? { callbacks: [...(convo.callbacks || []), D.callback].slice(-6) } : {}) };   // a callback is used once
  const total = steps.reduce((a, s) => a + (s.cost || 0), 0);
  // every chat message's cost (his note 2026-11-11): usage = all the steps' tokens summed (chat_logs.u); usd = the exact cost by
  // each step's own model, and steps = the breakdown
  const sum = (f) => steps.reduce((a, s) => a + (f(s.usage || {}) || 0), 0);
  const usage = { input_tokens: sum((u) => u.input_tokens), input_tokens_details: { cached_tokens: sum((u) => u.input_tokens_details?.cached_tokens) }, output_tokens: sum((u) => u.output_tokens) };
  return { text: t.out, steps, convo, usage, cost: total, ms: Date.now() - t0, first: talkAt + (t.first || 0), plan: D,
    // think: what the steps decided - kept on the log (Backstage → שיחות → חשיבה; a session discussing his comments)
    log: { think: thinkOf(D, H), usd: Math.round(total * 1e6) / 1e6, steps: steps.map((s) => ({ step: s.step, model: s.model || 'gpt-5.6-terra', ms: s.ms || 0, usd: Math.round((s.cost || 0) * 1e6) / 1e6 })) } };
}

// a short copy of the plan for the log (a Firestore doc stays small)
function thinkOf(D, H) {
  const c = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : v == null ? undefined : JSON.stringify(v).slice(0, n));
  const o = { understand: { kind: c(D.kind, 40), wants: c(D.wants), knows: D.knows ? { level: c(D.knows.level, 20), how: c(D.knows.how) } : undefined,
    videos: (D.touches?.videos || []).slice(0, 5), search: c(D.touches?.search, 80), follow: D.touches?.follow ? true : undefined, length: c(D.length, 20), visitor: c(D.visitor, 200) },
    plan: { stance: c(D.stance), joke: c(D.joke), avoid: c(D.avoid, 200), phrase: c(D.phrase, 120), callback: c(D.callback, 200) } };
  if (H) o.history = { found: !!H.found, what: c(H.what), lines: (H.lines || []).slice(0, 3).map((x) => c(x, 200)), video: c(H.video, 60) };
  return JSON.parse(JSON.stringify(o));   // drops the undefined
}

module.exports = { reply, STEPS, PRICE, SONNET };
