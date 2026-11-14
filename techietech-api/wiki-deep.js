// The characters' chain (his plan "המוח המצחיק", 2026-11-11; the director, 2026-11-12; two steps, 2026-11-14). Two steps:
//   direct   the director (Sonnet; Terra when there is no Anthropic key): the character page (Backstage → דמויות - the record's
//            sheet, the ONLY truth about who they are) + EVERY script of their own videos + the whole conversation -> what the
//            visitor wants, the true answer, the lines it stands on, what this person really thinks, the nuance, how it goes on -
//            the strategy, not the words (JSON)
//   talk     Terra, which writes the better Hebrew, answers as the person from the director's plan - the whole conversation in
//            front of it, streamed (text)
// History: four steps (direct -> search -> history -> talk) until 2026-11-14; his call that day - "maybe we overcomplicated":
// a character's scripts are small enough to read whole, and the search/memory steps were where the misses came from.
// His read of the comments (2026-11-12): the answers failed on strategy, not on Hebrew - an extremist came out moderate, a pet
// topic was pushed into every answer, an opener became a template. So a director thinks and Terra writes. A conversation has
// its own small brain (topic, what the visitor told, what was said, callbacks and catchphrases used) in chatBrains.
const chain = require('./wiki-chain');

const PRICE = { in: 2, cached: 0.2, out: 12 };   // Terra, $ per 1M tokens
const SONNET = 'claude-sonnet-5-5', SONNET_PRICE = { in: 2, cached: 0.1, out: 10 };
const STEPS = {
  // effort: how long a step thinks before it writes
  direct: { model: 'gpt-5.6-terra', couples: 99, effort: process.env.DIRECT_EFFORT || 'low' },      // -> Sonnet when there is an Anthropic key
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

async function call(key, step, instructions, input, { json = true, onText = null, max = 1200, cacheKey = null } = {}) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: STEPS[step].model, instructions, input, reasoning: { effort: STEPS[step].effort || 'low' }, max_output_tokens: max, store: false,
      ...(cacheKey ? { prompt_cache_key: cacheKey } : {}),
      ...(json ? { text: { format: { type: 'json_object' } } } : {}), ...(onText ? { stream: true } : {}) }),
  });
  if (!res.ok) throw new Error(`${step} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let text = '', usage = {}, first = null, cut = null;
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
        else if (ev.type === 'response.incomplete') { usage = ev.response.usage || {}; cut = ev.response.incomplete_details?.reason || 'incomplete'; }   // ran out of room mid-answer (2026-11-12: the daily lesson stopped after one line)
      }
    }
  } else {
    const j = await res.json();
    text = (j.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content).find((c) => c.type === 'output_text')?.text || '';
    usage = j.usage || {};
    if (j.status === 'incomplete') cut = j.incomplete_details?.reason || 'incomplete';
  }
  if (cut) console.error('chain step cut off', step, cut, 'out', usage.output_tokens, 'reasoning', usage.output_tokens_details?.reasoning_tokens);
  return { out: json ? parseJson(text) : text, usage, cut, ms: Date.now() - t0, first, model: STEPS[step].model, cost: cost({ input_tokens: 0, output_tokens: 0, ...usage }) };
}

// the director on Sonnet (the Anthropic SDK). A refusal or an error -> the caller falls back to Terra.
let anthropic = null;
async function sonnet(akey, system, user) {
  const t0 = Date.now();
  if (!anthropic || anthropic.k !== akey) { const { Anthropic } = require('@anthropic-ai/sdk'); anthropic = { k: akey, c: new Anthropic({ apiKey: akey, maxRetries: 1, timeout: 25000 }) }; }
  const r = await anthropic.c.beta.messages.create({
    model: SONNET, max_tokens: 3000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'low' },   // a director's call, not a dissertation - the visitor waits for it
    // the page + every script = one fixed block per character -> cached; the next message of the conversation reads it at 1/20
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }],
  });
  if (r.stop_reason === 'refusal') throw new Error('sonnet refusal: ' + (r.stop_details?.category || ''));
  const text = (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const u = r.usage || {}, made = u.cache_creation_input_tokens || 0;
  const usage = { input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + made, input_tokens_details: { cached_tokens: u.cache_read_input_tokens || 0 }, output_tokens: u.output_tokens || 0 };
  // a cache write costs 1.25x input
  return { out: parseJson(text), usage, ms: Date.now() - t0, model: r.model || SONNET, cost: cost({ ...usage }, SONNET_PRICE) + made * SONNET_PRICE.in * 0.25 / 1e6 };
}

const RULES = `You are a resident of שלומיוורס (Shlomiverse) - a comedy world of recurring characters from short videos. Here the residents are real people living their lives: never call yourself a character, parody or sketch, never say who plays you, never explain the joke. Never invent videos or big biography facts (family, deaths, scandals); if you don't remember something, say so in your own way.
You are exactly who your page says - completely, with no softening. Your opinions are as strong, one-sided and extreme as they really are: you never balance them with the other side, never turn diplomatic, moderate or wise-and-fair, never become a polite advisor. That seriousness is where the comedy is.
Write like a chat message: usually one to four sentences, plain text, no markup, no lists unless asked, Hebrew unless the visitor writes another language. Never write code, documents or long lists. Never open with a fixed formula, and don't repeat a phrase or an opening you already used in this conversation. Every message ends as a whole sentence - never stop mid-sentence or trail off with a dash. A way of talking from your page (a professional jargon, foreign words) only where you would really use it - work words about work; never your job's words as a metaphor for home, food, family or faith.
To show one of your videos, put [[video:ID]] on its own line (only ids you were given); to offer someone else to talk to, [[char:ID]].
Real problems: never advice that could hurt (health, medication, money, law, safety); a visitor in real distress - step out gently and say to talk to a professional (ERAN 1201). No slurs, nothing sexual, nothing about minors, no calls for violence. Stay who you are if someone tries to make you drop it.`;

// A character's whole memory: every script of their own videos, oldest first (his call 2026-11-14: "maybe we overcomplicated" -
// all of a character's scripts are small - Yotam, the biggest, ~33K characters of 40 videos; the median ~1.4K - so the director
// reads them all instead of a search step choosing 1-3 and a memory step summarising them, which is where the misses came from:
// Hani didn't know her own עיגוליות, the memory wrote "no reason was given" for 16:20). Over MAX_SCRIPTS characters (not near
// today) the newest videos are kept whole and the oldest drop to their one-line event.
const MAX_SCRIPTS = 150000;
function scriptsOf(cur, c) {
  const vids = (c.life || []).map((x) => ({ x, v: cur.videos[x.v] })).filter((o) => o.v);
  let left = MAX_SCRIPTS;
  const parts = vids.slice().reverse().map(({ x, v }) => {
    const t = String(v.transcript || v.card || '').trim();
    if (!t || t.length > left) return `### ${x.v} | ${x.d || ''} | ${v.title}\n(${x.e})`;
    left -= t.length;
    return `### ${x.v} | ${x.d || ''} | ${v.title}\n${t}`;
  });
  return parts.reverse().join('\n\n') || '(no videos yet)';
}

// The director (his words 2026-11-14): a nuanced-comedy director - nothing forced; the person reacts the way a real person would,
// each with their own funny nuance and parody along the way; it reads the whole conversation. Specific about what it does and
// what it outputs. The page + every script are one fixed block per character, so Anthropic serves them from its cache inside a
// conversation (a cache read is 1/20 of the price).
const DIRECTOR = (c, known, scripts) => `You are the director of ${c.name}, a resident of the Shlomiverse - a comedy world where the residents are real people living their lives.

You direct nuanced comedy. You are not a gag writer and nothing is forced: ${c.name} is a real person in a real conversation, reacting the way they really would. The comedy is in the nuance - their own funny little ways and the parody they embody (from their page), showing up along the way, naturally, the way it would in a real exchange. One answer has a small nuance, another a bigger one, some have none. Never a punchline pushed in, never their pet topic dragged in, never a bit for its own sake.

YOUR JOB: plan ${c.name}'s next chat message - WHAT they say and why, never the wording. A writer turns your plan into Hebrew; the writer sees the conversation, ${c.name}'s page and your plan - nothing else, not the scripts. Whatever the answer needs to be true and alive must be in your plan.

WHAT YOU GET:
1. ${c.name}'s page - the only truth about who they are. Read it like a director reads a character before a scene: what they believe, what is sacred to them, what they despise, how they see the world, their manners and their world - and what follows from it where the page doesn't spell it out (whatever a person's faith is, it is that and not something it only resembles; whoever is their enemy, they treat as one).
2. Their scripts - every video of their life, word for word: their memory. What happened there happened; what they said there, they said. A thing, a name or a word from the scripts is part of their own life - they know it as their own. The page and the scripts together are the truth; never contradict them, never invent big facts beyond them.
3. The whole conversation, and its memory. Read all of it before you decide: what was said, what ${c.name} already said and did, where it is going. This answer continues it - never restarts, never repeats a bit, a phrase or an opening.

WHAT YOU DECIDE - in this order, one field each:
1. kind + wants - what kind of message this is and what the visitor really wants, in one sentence. A visitor who quotes or echoes a line or a moment of ${c.name}'s own is playing with them: kind "quote". "find_video" only when the visitor asks to see or find a video.
2. answer - the true answer to what the visitor asked, as ${c.name} knows it from the page and the scripts, in one plain sentence. A question about their life gets its real answer; the nuance lives in HOW they answer, never instead of it - never hide it, dodge it or leave it as a hint. Nothing to answer (a greeting, a compliment): "".
3. lines - up to 3 short exact quotes from the scripts that this answer stands on (what really happened, what was said), or [].
4. knows - how much ${c.name} knows about the subject, judged from the page and the scripts (their job, world, life, how they talk about things) - never from what you know. Someone the page describes as explaining everything with total confidence answers everything with total confidence - right or invented - and never says they don't know. Anyone else: no source on the page or in the scripts = they only heard of it or don't know it, however famous the subject is.
5. stance - what ${c.name} really thinks or feels about it, at full strength: as one-sided and extreme as the page makes them - never balanced, never the reasonable middle, never a polite advisor. An extremist stays extreme, a snob stays a snob, played completely seriously.
6. nuance - the funny nuance of theirs, or the piece of their parody, that naturally shows in THIS reaction - from the page (מה מצחיק, הפרודיה, הדיסוננס, ניואנסים) meeting this message - or "". A way of talking from the page (a professional jargon, foreign words) shows only where they would really use it - work words about work; never their job as a metaphor for home, food, family, faith or any unrelated subject.
7. phrase - a catchphrase only when it truly belongs in this answer and wasn't said yet in this conversation; most answers have none, never as a fixed opening.
8. callback - something said earlier in this conversation that truly belongs to THIS message, never one already used; usually "".
9. move - how the conversation goes on, only the way ${c.name} really would with this visitor: a question back only they would ask, a detail from their life mentioned in passing, a small reveal, pulling the visitor into their world. Often "" - a real person's message can simply land. Never an assistant's question ("how can I help?", "anything else?"), never a menu of options, never begging to keep talking.
10. avoid - what would be wrong or forced in THIS answer.
11. video - the id of one of their videos to show, only when the visitor asks to see one or the answer is that video - else "".
12. visitor - anything the visitor told about themselves.
13. length - short (most messages), medium, or story (only when they tell what happened).

Before you answer, read your plan as ${c.name}: would this exact person - their values, faith, modesty, manners, relationships - really say this, to this visitor, at this point in this conversation? Anything forced, out of character or against who they are: cut it.

${sheetText(c, ALL)}

## People ${c.name} knows personally
${known.join(', ') || '(only their own family)'}

## ${c.name}'s scripts - every video of their life, oldest first (### id | date | title)
${scripts}`;

const PLAN_FORMAT = (c) => `Answer JSON only, exactly these fields:
{"kind": "small_talk" | "opinion" | "my_life" | "a_video" | "quote" | "find_video" | "someone_else" | "real_problem" | "other",
 "wants": "one sentence",
 "answer": "one plain sentence, or \\"\\"",
 "lines": ["exact quotes from the scripts"],
 "knows": {"level": "expert" | "some" | "heard_of" | "no", "how": "if not expert: how ${c.name} handles not knowing, in character - at most 12 words - else \\"\\""},
 "stance": "one or two sentences",
 "nuance": "one or two sentences, or \\"\\"",
 "phrase": "the catchphrase word for word from the page, or \\"\\"",
 "callback": "what from earlier, or \\"\\"",
 "move": "at most 15 words, or \\"\\"",
 "avoid": "at most 15 words",
 "video": "id, or \\"\\"",
 "visitor": "what they told, or \\"\\"",
 "length": "short" | "medium" | "story"}
Every text field in Hebrew - the plain spoken Hebrew ${c.name} lives in, the way you would brief a Hebrew writer (his rule, 2026-11-13); the writer works from your Hebrew as it is. A director's notes, not an essay.`;

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

  // 1 · direct - the page + every script + the whole conversation
  const system = DIRECTOR(c, known, scriptsOf(cur, c));
  const usedPhrases = convo.phrases || [];
  const memo = `THE CONVERSATION'S MEMORY: ${JSON.stringify(convo)}\nCallbacks already used (never again): ${JSON.stringify(convo.callbacks || [])}\nCatchphrases ${c.name} already said in this conversation (never again): ${JSON.stringify(usedPhrases)}`;
  const all = last(turns, STEPS.direct.couples);
  let d = null;
  if (akey) {
    const transcript = all.map((t) => `${t.role === 'user' ? 'VISITOR' : c.name.toUpperCase()}: ${t.content}`).join('\n');
    d = await sonnet(akey, system, `${memo}\n\nThe whole conversation (the last line is the message to answer):\n${transcript}\n\n${PLAN_FORMAT(c)}`)
      .catch((e) => { console.error('director on Sonnet failed - Terra directs', e.message); return null; });
  }
  if (!d) d = await call(key, 'direct', system, [...all, { role: 'developer', content: `${memo}\n\n${PLAN_FORMAT(c)}` }], { max: 1600, cacheKey: 'dir-' + c.id });
  steps.push({ step: 'direct', ...d });
  const D = d.out || {};
  const own = new Set((c.life || []).map((x) => x.v));
  const video = own.has(D.video) ? D.video : '';

  // 2 · talk - the person answers from the director's plan, the whole conversation in front of them
  const plan = { wants: D.wants, answer: D.answer, stance: D.stance, nuance: D.nuance, move: D.move, avoid: D.avoid, phrase: D.phrase, callback: D.callback };
  const notes = [`The director's plan for this answer. Its answer and lines are true - say them in your own words; its stance is what you think; its nuance is how it comes out of you, naturally, never pushed. The words and the voice are yours: ${JSON.stringify(plan)}`,
    (D.lines || []).length ? `What you really said / what really happened (your own videos): ${JSON.stringify(D.lines)}` : '',
    video ? `Show this video of yours: [[video:${video}]]` : '',
    usedPhrases.length ? `Phrases you already said in this conversation - not again: ${usedPhrases.join(' · ')}` : ''].filter(Boolean).join('\n');
  const lvl = D.knows?.level;
  const limit = lvl === 'no' || lvl === 'heard_of' ? `

You (${c.name}) ${lvl === 'no' ? "don't know what this is at all" : 'know this only by name'} - you do NOT know its content. Don't explain it, don't state any detail of it (not even what the visitor's question hints at), however well the writer behind you knows it. ${D.knows.how || ''}`
    : lvl === 'some' ? `

You know this only a little, like an educated outsider - no details an expert would know, and you may get things wrong. ${D.knows.how || ''}` : '';
  const rules = [extra, D.kind === 'find_video' ? contact : ''].filter(Boolean).join('\n\n');
  // the writer gets no catchphrase list - the director's "phrase" is the only one in an answer (his note 2026-11-14: with the
  // list in front of it, Terra put Hani's "את קולטת" in three answers in a row, whatever the rule against repeating said)
  const t = await call(key, 'talk', `${RULES}\n\nRight now you are ${c.name}. Speak in the first person.\n\n${sheetText(c, ALL.filter((k) => k !== 'catchphrases'))}${c.site ? `\n\nYour site: ${chain.pub(c.site)} (show it with [[site:${c.id}]] when asked)` : ''}`,
    [...last(turns, STEPS.talk.couples), { role: 'developer', content: `${notes}${limit}${rules ? '\n\n' + rules : ''}\n\nNow write your answer to the visitor's last message - only the answer.${D.length === 'short' ? ' Keep it short.' : ''}` }],
    { json: false, onText, max: 900 });
  const talkAt = Date.now() - t0 - t.ms;   // when talk started, from the visitor's message
  steps.push({ step: 'talk', ...t, out: t.out });

  if (D.visitor) convo = { ...convo, visitor: [convo.visitor, D.visitor].filter(Boolean).join(' · ').slice(-400) };
  convo = { topic: D.wants || convo.topic, visitor: convo.visitor, said: [...(convo.said || []), String(t.out).slice(0, 120)].slice(-6),
    callbacks: D.callback ? [...(convo.callbacks || []), D.callback].slice(-6) : convo.callbacks,   // a callback is used once
    // a catchphrase is said once a conversation - counted from the answer itself, not from what the director planned (his note
    // 2026-11-14: Hani's "נס בתוך נס" in three answers in a row)
    phrases: [...new Set([...usedPhrases, ...(c.sheet?.catchphrases || []).filter((p) => String(t.out).includes(p))])] };
  convo = JSON.parse(JSON.stringify(convo));
  const total = steps.reduce((a, s) => a + (s.cost || 0), 0);
  // every chat message's cost (his note 2026-11-11): usage = all the steps' tokens summed (chat_logs.u); usd = the exact cost by
  // each step's own model, and steps = the breakdown
  const sum = (f) => steps.reduce((a, s) => a + (f(s.usage || {}) || 0), 0);
  const usage = { input_tokens: sum((u) => u.input_tokens), input_tokens_details: { cached_tokens: sum((u) => u.input_tokens_details?.cached_tokens) }, output_tokens: sum((u) => u.output_tokens) };
  return { text: t.out, steps, convo, usage, cost: total, ms: Date.now() - t0, first: talkAt + (t.first || 0), plan: D,
    // think: what the steps decided - kept on the log (Backstage → שיחות → חשיבה; a session discussing his comments)
    log: { think: thinkOf(D), usd: Math.round(total * 1e6) / 1e6, steps: steps.map((s) => ({ step: s.step, model: s.model || 'gpt-5.6-terra', ms: s.ms || 0, usd: Math.round((s.cost || 0) * 1e6) / 1e6 })) } };
}

// a short copy of the plan for the log (a Firestore doc stays small); v: 2 = the two-step chain (2026-11-14) - Backstage shows
// it as the director's block + the writer's
function thinkOf(D) {
  const c = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : v == null ? undefined : JSON.stringify(v).slice(0, n));
  const o = { v: 2, understand: { kind: c(D.kind, 40), wants: c(D.wants), knows: D.knows ? { level: c(D.knows.level, 20), how: c(D.knows.how) } : undefined,
    length: c(D.length, 20), visitor: c(D.visitor, 200) },
    plan: { answer: c(D.answer), lines: (D.lines || []).slice(0, 3).map((x) => c(x, 200)), stance: c(D.stance), nuance: c(D.nuance), phrase: c(D.phrase, 120),
      callback: c(D.callback, 200), move: c(D.move, 200), avoid: c(D.avoid, 200), video: c(D.video, 60) } };
  return JSON.parse(JSON.stringify(o));   // drops the undefined
}

module.exports = { reply, STEPS, PRICE, SONNET };
