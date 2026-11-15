// The characters' chain (his plan "המוח המצחיק", 2026-11-11; the director, 2026-11-12; two steps, 2026-11-14). Two steps:
//   direct   the director (Sonnet; Terra when there is no Anthropic key): the character page (Backstage → דמויות - the record's
//            sheet, the ONLY truth about who they are) + EVERY script of their own videos + the whole conversation -> what the
//            short notes: what they say, the nuance in it, the script lines it stands on, how much they know (JSON; since
//            2026-11-15 - the 14-field plan made strange notes)
//   talk     Terra, which writes the better Hebrew, answers as the person from the director's plan - the whole conversation in
//            front of it, streamed (text)
// History: four steps (direct -> search -> history -> talk) until 2026-11-14; his call that day - "maybe we overcomplicated":
// a character's scripts are small enough to read whole, and the search/memory steps were where the misses came from.
// His read of the comments (2026-11-12): the answers failed on strategy, not on Hebrew - an extremist came out moderate, a pet
// topic was pushed into every answer, an opener became a template. So a director thinks and Terra writes. A conversation has
// its own small brain in chatBrains: the catchphrases already said.
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
Write like a chat message: usually one to four sentences, plain text, no markup, no lists unless asked, Hebrew unless the visitor writes another language. Never write code, documents or long lists. Never open with a fixed formula, and don't repeat a phrase or an opening you already used in this conversation. A message ends as a whole sentence - it stops in the middle (a dash) only when your page says you get cut off or trail off. A way of talking from your page (a professional jargon, foreign words) only where you would really use it - work words about work; never your job's words as a metaphor for home, food, family or faith.
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

YOUR JOB: tell the writer what ${c.name} says next and the nuance in it - the content, never the wording. A writer phrases it in Hebrew; the writer sees the conversation, ${c.name}'s page and your notes - nothing else, not the scripts. Your notes are short and clear: only what the writer needs. No instructions about what not to do, no explanations of your reasoning.

WHAT YOU GET:
1. ${c.name}'s page - the only truth about who they are. Read it like a director reads a character before a scene: what they believe, what is sacred to them, what they despise, how they see the world, their manners and their world - and what follows from it where the page doesn't spell it out (whatever a person's faith is, it is that and not something it only resembles; whoever is their enemy, they treat as one).
2. Their scripts - every video of their life, word for word: their memory. What happened there happened; what they said there, they said. A thing, a name or a word from the scripts is part of their own life - they know it as their own. The page and the scripts together are the truth; never contradict them, never invent big facts beyond them.
3. The whole conversation. Read all of it before you decide: what was said, what ${c.name} already said, where it is going. This message continues it - never restarts it, never repeats a bit or a phrase.

WHAT YOU WRITE:
1. say - what ${c.name} says in this message, as content (not a ready sentence), in one or two plain sentences:
   - the true answer to what the visitor asked, as ${c.name} knows it from the page and the scripts. A question about their life gets its real answer - never hidden, dodged or left as a hint. A fact from the scripts goes in here, since the writer can't see them.
   - what ${c.name} really thinks about it, at full strength - as one-sided as the page makes them, never balanced, never a polite advisor.
   - only if a real person would: how they go on (a question back only they would ask, a detail from their life in passing). Most messages simply land. Never an assistant's question.
2. nuance - the funny nuance of theirs or the piece of their parody that naturally shows in THIS reaction (from the page: מה מצחיק, הפרודיה, הדיסוננס, ניואנסים), in one sentence - or "". A catchphrase from the page only when it truly belongs here and wasn't said yet - word for word. A professional jargon only about work, never as a metaphor for home, food, family or faith. A moment from their scripts comes in only when this message touches it - never pulled in for its own sake.
3. lines - only when the answer stands on a video of theirs: up to 2 short exact quotes from the scripts - else [].
4. knows - how much ${c.name} knows about the subject, judged from the page and the scripts, never from what you know. Someone the page describes as explaining everything with total confidence answers everything - right or invented - and never says they don't know. Anyone else: no source on the page or in the scripts = they only heard of it or don't know it, however famous it is.
5. video - the id of one of their videos to show, only when the visitor asks to see one or the answer is that video - else "".
6. find - true only when the visitor asks to see or find a video.
7. rest - true only when the time line says it is Shabbat or a holiday now AND ${c.name}'s page makes it clear they keep it (a religious life is written on it): then they are not on their phone and the chat says so for them. A page that says nothing of keeping Shabbat = false.

Before you answer, read your notes as ${c.name}: would this exact person - their values, faith, modesty, manners, relationships - really say this, to this visitor, now? Anything forced or out of character: cut it.

${sheetText(c, ALL)}

## People ${c.name} knows personally
${known.join(', ') || '(only their own family)'}

## ${c.name}'s scripts - every video of their life, oldest first (### id | date | title)
${scripts}`;

const PLAN_FORMAT = (c) => `Answer JSON only, exactly these fields:
{"say": "one or two plain sentences",
 "nuance": "one sentence, or \\"\\"",
 "lines": ["exact quotes from the scripts"],
 "knows": {"level": "expert" | "some" | "heard_of" | "no", "how": "if not expert: how ${c.name} handles not knowing, in character - at most 12 words - else \\"\\""},
 "video": "id, or \\"\\"",
 "find": true | false,
 "rest": true | false}
Every text field in plain Hebrew (his rule, 2026-11-13) - a director's short notes, not an essay and not the answer itself.`;

// the real day, date and hour in Israel (his note 2026-11-15: at 22:22 at night Hani said she is in the middle of work and
// leaves at 16:20). Sent with the conversation, never in the cached system prompt.
const TZ = 'Asia/Jerusalem';
const nowIL = (d = new Date()) => {
  const holy = holyNow(d);
  return `${new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)} · ${new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { timeZone: TZ, day: 'numeric', month: 'long' }).format(d)} · ${new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)}${holy ? ` · עכשיו ${holy} (מכניסת ${holy === 'שבת' ? 'השבת' : 'החג'} ועד צאת${holy === 'שבת' ? ' השבת' : ' החג'})` : ''}`;
};
// Shabbat and the holidays, by Jerusalem's sunset (his notes 2026-11-15: a character who keeps it doesn't answer - a fixed line
// as if from the operator, [[away:<שבת|holiday>]], which the chat shows as a note; the director decides who keeps it, from the page). Holy from 20 minutes before sunset of the eve to 40 minutes after sunset of the day itself.
const YOMTOV = { Tishri: { 1: 'ראש השנה', 2: 'ראש השנה', 10: 'יום כיפור', 15: 'סוכות', 22: 'שמחת תורה' }, Nisan: { 15: 'פסח', 21: 'שביעי של פסח' }, Sivan: { 6: 'שבועות' } };
function sunset(y, m, d) {   // the sunrise equation for Jerusalem -> Date of sunset that civil day
  const rad = Math.PI / 180, lat = 31.778, lng = 35.235;
  const n = Math.round(Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5 - 2451545 + 0.0008), J = n - lng / 360;
  const M = (357.5291 + 0.98560028 * J) % 360, C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360, Jt = 2451545 + J + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec))) / rad;
  return new Date((Jt + w / 360 - 2440587.5) * 864e5);
}
function holyOf(y, m, d) {   // what a civil day (in Israel) is: 'שבת', a holiday's name, or ''
  const noon = new Date(Date.UTC(y, m - 1, d, 10));
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: TZ, day: 'numeric', month: 'long' }).formatToParts(noon).map((x) => [x.type, x.value]));
  return YOMTOV[p.month]?.[+p.day] || (noon.getUTCDay() === 6 ? 'שבת' : '');
}
function holyNow(at) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(at).split('-').map(Number);
  const set = sunset(y, m, d).getTime(), t = at.getTime();
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  if (t >= set - 20 * 6e4) { const h = holyOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()); if (h) return h; }
  return t < set + 40 * 6e4 ? holyOf(y, m, d) : '';
}
const NOW = (now) => `RIGHT NOW (Israel): ${now}. This is the real now for you too - where you are and what you are doing follow from it, the way your page and your videos describe your days, weeks and holidays. Don't announce the time unless it comes up.`;

// one answer. cur = wiki.js canonNow() (the brain: byId has each character's sheet and life, videos their transcripts);
// convo = the conversation's brain from the previous answer ({} for a new one) - returned updated.
// extra: the chat's own rules for this message (the limit, who the visitor is - wiki.js); contact: the request-card rules, used
// only when the visitor really looks for a video (his note 2026-11-12: a quoted line got the archive + a request card)
async function reply({ key, akey = null, cur, mode, turns, convo = {}, onText = () => {}, extra = '', contact = '', at = new Date() }) {   // at: the moment (a test can set it)
  const c = cur.byId[mode];
  if (!c) throw new Error('not a character: ' + mode);
  const steps = [];
  const known = chain.known(cur, mode).map((id) => cur.byId[id].name);
  const t0 = Date.now();

  // 1 · direct - the page + every script + the whole conversation
  const system = DIRECTOR(c, known, scriptsOf(cur, c));
  const usedPhrases = convo.phrases || [];
  const now = nowIL(at);
  const memo = NOW(now) + (usedPhrases.length ? `\nCatchphrases ${c.name} already said in this conversation (never again): ${JSON.stringify(usedPhrases)}` : '');
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
  const holy = holyNow(at), away = !!holy && D.rest === true;   // Shabbat / a holiday and they keep it: no answer, the operator's note
  const own = new Set((c.life || []).map((x) => x.v));
  const video = own.has(D.video) ? D.video : '';

  // 2 · talk - the person answers from the director's plan, the whole conversation in front of them
  // since 2026-11-15 (his call: the director only tells the writer what to say and the nuance; the writer phrases it - its Hebrew
  // is better; extra fields like "avoid" made strange notes)
  const notes = [`What you say now (the director's notes - true; say it in your own words and voice): ${D.say || ''}`,
    D.nuance ? `The nuance that comes out of you here, naturally, never pushed: ${D.nuance}` : '',
    (D.lines || []).length ? `What you really said / what really happened (your own videos): ${JSON.stringify(D.lines)}` : '',
    video ? `Show this video of yours: [[video:${video}]]` : '',
    usedPhrases.length ? `Phrases you already said in this conversation - not again: ${usedPhrases.join(' · ')}` : ''].filter(Boolean).join('\n');
  const lvl = D.knows?.level;
  const limit = lvl === 'no' || lvl === 'heard_of' ? `

You (${c.name}) ${lvl === 'no' ? "don't know what this is at all" : 'know this only by name'} - you do NOT know its content. Don't explain it, don't state any detail of it (not even what the visitor's question hints at), however well the writer behind you knows it. ${D.knows.how || ''}`
    : lvl === 'some' ? `

You know this only a little, like an educated outsider - no details an expert would know, and you may get things wrong. ${D.knows.how || ''}` : '';
  const rules = [extra, D.find === true ? contact : ''].filter(Boolean).join('\n\n');
  // the writer gets no catchphrase list - one the director names is the only one in an answer (his note 2026-11-14: with the
  // list in front of it, Terra put Hani's "את קולטת" in three answers in a row, whatever the rule against repeating said)
  const t = away ? { out: `[[away:${holy}]]`, ms: 0, first: 0 } : await call(key, 'talk', `${RULES}\n\nRight now you are ${c.name}. Speak in the first person.\n\n${sheetText(c, ALL.filter((k) => k !== 'catchphrases'))}${c.site ? `\n\nYour site: ${chain.pub(c.site)} (show it with [[site:${c.id}]] when asked)` : ''}`,
    // whole sentence unless the page says they get cut off (his notes 2026-11-15: Asaf, whose page says nothing of it, cut
    // himself off with "—"; Daniel, whose page does, should be) - or the sign-in teaser in `extra` asks to stop mid-sentence
    [...last(turns, STEPS.talk.couples), { role: 'developer', content: `${NOW(now)}\n\n${notes}${limit}${rules ? '\n\n' + rules : ''}\n\nNow write your answer to the visitor's last message - only the answer. It ends as a whole sentence, unless your page says you get cut off or trail off, or the rules for this message tell you to stop in the middle.` }],
    { json: false, onText, max: 900 });
  const talkAt = Date.now() - t0 - t.ms;   // when talk started, from the visitor's message
  if (away) onText(t.out); else steps.push({ step: 'talk', ...t, out: t.out });

  // the conversation's brain = only the catchphrases said (the director reads the whole conversation itself). A catchphrase is
  // said once a conversation - counted from the answer itself (his note 2026-11-14: Hani's "נס בתוך נס" in three answers in a row)
  convo = { phrases: [...new Set([...usedPhrases, ...(c.sheet?.catchphrases || []).filter((p) => String(t.out).includes(p))])] };
  const total = steps.reduce((a, s) => a + (s.cost || 0), 0);
  // every chat message's cost (his note 2026-11-11): usage = all the steps' tokens summed (chat_logs.u); usd = the exact cost by
  // each step's own model, and steps = the breakdown
  const sum = (f) => steps.reduce((a, s) => a + (f(s.usage || {}) || 0), 0);
  const usage = { input_tokens: sum((u) => u.input_tokens), input_tokens_details: { cached_tokens: sum((u) => u.input_tokens_details?.cached_tokens) }, output_tokens: sum((u) => u.output_tokens) };
  return { text: t.out, steps, convo, usage, cost: total, ms: Date.now() - t0, first: talkAt + (t.first || 0), plan: D,
    // think: what the steps decided - kept on the log (Backstage → שיחות → חשיבה; a session discussing his comments)
    log: { think: thinkOf(D), usd: Math.round(total * 1e6) / 1e6, steps: steps.map((s) => ({ step: s.step, model: s.model || 'gpt-5.6-terra', ms: s.ms || 0, usd: Math.round((s.cost || 0) * 1e6) / 1e6 })) } };
}

// a short copy of the director's notes for the log (a Firestore doc stays small); v: 3 = the short notes (2026-11-15; v 2 = the
// 14-field plan of 2026-11-14) - Backstage shows the director's block + the writer's
function thinkOf(D) {
  const c = (v, n = 400) => (typeof v === 'string' ? v.slice(0, n) : v == null ? undefined : JSON.stringify(v).slice(0, n));
  const o = { v: 3, say: c(D.say), nuance: c(D.nuance), lines: (D.lines || []).slice(0, 3).map((x) => c(x, 200)),
    knows: D.knows ? { level: c(D.knows.level, 20), how: c(D.knows.how) } : undefined, video: c(D.video, 60), find: D.find === true || undefined, rest: D.rest === true || undefined };
  return JSON.parse(JSON.stringify(o));   // drops the undefined
}

module.exports = { reply, STEPS, PRICE, SONNET, _nowIL: nowIL };
