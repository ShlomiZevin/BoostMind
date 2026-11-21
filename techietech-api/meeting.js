// ישיבת זום - a Zoom meeting with the Techy-Tech team (his idea 2026-11-20). THE ENGINE: the live page (/meeting, v2/site/verse/
// meeting.js) drives it through verseMeeting (meeting-fn.js - the state in Firestore); the local try-out (scripts/meeting/server.mjs
// + page.html) drives the very same engine in memory.
// His rules (2026-11-20):
//   - only the Techy-Tech team can be in a meeting together: Amir, Ofer, Daniel, Ronit, Gilad - and Yaniv (his note on the plan:
//     "he never understands why they brought him in, and he drops off"). The visitor picks who is in it.
//   - every resident speaks with their own voice exactly as in the chat: the SAME chain (wiki-deep.js - the director on their page
//     + every script, then Terra writes the Hebrew). They know each other for real (their relations); the visitor is someone from
//     outside they don't know.
//   - Amir drives the meeting: he always opens it ("okay, glad everyone's here").
//   - Gilad, when he is in it, stops people - his interruptions are part of every meeting he is in.
//   - the meeting ends when Amir decides - or Gilad when he is in it. No stop button. Then Amir's wrap-up (recap): what was said,
//     who owns what (his notes on the end screen: "action items + share").
//   - someone may LEAVE the call (Yaniv's nature): they say their line and drop off; they don't come back.
// The ORGANIZER (Sonnet, a small fast call) never writes a line: after every line it decides who has the floor next - a resident
// (with a cue: what they react to), whether they cut the line in the air off, whether they leave after their line, whether they
// end the meeting - or the visitor.
// No endless AI talk: the organizer is told how many lines went by since the visitor spoke and leans to them; a line that turns to
// the visitor gives them the floor; a typing visitor = a raised hand (the floor is theirs after the line being said); and after
// MAX_RUN resident lines in a row the floor is the visitor's whatever the organizer said.
// STREAMING (the live page writes each line word by word): the writer's text goes out as it comes ({t:'delta'}); the organizer
// runs beside it - when it decides the next speaker cuts this line, the deltas stop and the line is cut a little past its middle
// (or where the stream already is, if that is further) - {t:'cut'}; the log keeps only what was said.
const chain = require('./wiki-chain');
const { DIRECTOR, RULES, sheetText, ALL, scriptsOf, sonnet, call, PLAN_FORMAT, NOW, nowIL, holyNow } = require('./wiki-deep')._parts;

const TEAM = ['amir', 'ofer', 'daniel', 'ronit', 'gilad', 'yaniv'];
const HOST = 'amir', BOSS = 'gilad';
const MAX_RUN = 4;          // resident lines in a row before the floor is the visitor's (a guard, not the organizer's taste)
const SILENT_S = 10;        // the visitor's silence on their own floor before the page asks the room to go on (the page's nudge)
const DANIEL = 'daniel';   // never finishes a sentence: Amir always cuts him off and picks up his last words (his rule, 2026-11-20)
const ender = (room) => (room.includes(BOSS) ? BOSS : HOST);
// the visitor: no "guest" anywhere (his note 2026-11-20, "a real product"). They join with their Shlomiverse name (we have it - they
// are signed in) and the title THEY typed for this meeting (his ask 2026-11-21: "he chooses his title, and Amir only refers to it" -
// the AI-made titles were weird); everyone calls them by it. Nobody makes up a title or describes them in their own words.
// Each meeting reads the brain through its own thin copy (Object.create) that knows how to call the visitor.
const label = (v = {}) => [v.name, v.title].filter(Boolean).join(', ') || 'the visitor';
// titled: they gave themselves a title when they joined (an older page sends none - then they are just their name)
const withVisitor = (cur, v) => Object.assign(Object.create(cur), { visitor: label(v), titled: !!v.title });
const nameOf = (cur, id) => (id === 'user' ? cur.visitor || 'the visitor' : cur.byId[id]?.name || id);
const relIn = (cur, id, room) => (cur.byId[id].relations || []).filter((r) => room.includes(r.id) && r.id !== id);
// someone with no relation to anyone in the room (Yaniv): an outsider who was added to the call and doesn't get why
const outsider = (cur, id, room) => !relIn(cur, id, room).length && !room.some((o) => o !== id && (cur.byId[o].relations || []).some((r) => r.id === id));
const OUTSIDER = 'not part of this team\'s meetings - someone added him to the call, and he doesn\'t understand why he is here';

// the room as people: who, their job, and how they stand with everyone else IN THIS ROOM (their own relations, both ways)
function forces(cur, room, me = null) {
  return room.filter((id) => !me || id !== me).map((id) => {
    const c = cur.byId[id];
    const rel = relIn(cur, id, room).map((r) => `${nameOf(cur, r.id)}: ${r.relation}`);
    return `- ${c.name} (${c.role || ''})${rel.length ? ' - ' + rel.join(' · ') : outsider(cur, id, room) ? ' - ' + OUTSIDER : ''}`;
  }).join('\n');
}
function transcript(cur, log) {
  return log.map((l) => (l.left ? `(${nameOf(cur, l.who)} left the call)`
    : l.silent ? `(the floor was ${nameOf(cur, 'user')}'s - ${SILENT_S} seconds went by and they said nothing)`
    : `${nameOf(cur, l.who)}: ${l.text}${l.cut ? ' [נקטע באמצע המשפט]' : ''}`)).join('\n') || '(the meeting has not started)';
}
const spoken = (l) => l && !l.left && !l.silent;   // a line someone said (not someone leaving, not the visitor's silence)
const short = (v, n) => { const t = (Array.isArray(v) ? v.join(' · ') : String(v || '')).trim(); return t.length > n ? t.slice(0, t.lastIndexOf(' ', n)) + '…' : t; };
const clean = (t) => String(t || '').replace(/\[\[[^\]]*\]\]/g, '').trim();
// every model call's cost, counted once: M.cost (the total) + M.costBy by provider (Backstage → הוצאות shows Syncs as its own line:
// the OpenAI part is taken out of the chat key's line - meetings use WIKI_OPENAI_KEY - and the Anthropic part, which no provider
// report gives us, is added; costs.js). Sonnet calls come back with a claude-* model, Terra's with gpt-*. `unsplit` = what a meeting
// had spent before the split existed (2026-11-20), provider unknown.
function spend(M, r) {
  const c = (r && r.cost) || 0;
  M.cost += c;
  const by = (M.costBy ||= { openai: 0, anthropic: 0, unsplit: 0 });
  by[/^claude/.test(String((r && r.model) || '')) ? 'anthropic' : 'openai'] += c;
}

// ---------- the organizer ----------
function organizerSystem(cur, room) {
  const cards = room.map((id) => { const c = cur.byId[id], s = c.sheet || {};
    const rel = relIn(cur, id, room).map((r) => `${nameOf(cur, r.id)} - ${r.relation}`).join(' · ');
    return `### ${c.name} (id ${id}) - ${c.role || ''}\nWho: ${short(s.person || c.brief, 380)}\nWhat is funny about them: ${short(s.funny, 300)}\nHow they stand with the others here: ${rel || (outsider(cur, id, room) ? OUTSIDER : '-')}`; }).join('\n\n');
  const E = nameOf(cur, ender(room));
  return `You run a Zoom meeting of טקי-טק (Techy-Tech), a company in the Shlomiverse - a comedy world whose residents are real people living their lives. You are the meeting's organizer, like Zoom's host controls: you never write what anyone says. After every line you decide who has the floor next.

In the meeting: the team members below, who know each other well, and a visitor from outside - ${nameOf(cur, 'user')} - a real person who joined; the team doesn't know them.${cur.titled ? ' When they joined they introduced themselves with that title - their own words for who they are in this meeting (nobody on the team gave it to them).' : ''}

${cards}

How this team's meetings go:
- ${nameOf(cur, HOST)} drives the meeting: he opened it, he moves it along, turns to people, sums up.
${room.includes(BOSS) ? `- ${nameOf(cur, BOSS)} is the boss in this room, and the one who stops people: whoever runs ahead, goes in circles, piles up buzzwords or talks without a business behind it - he cuts them off in the middle ("מה הביזנס?"). That is who he is; a meeting with him in it always has him cutting people off. He doesn't cut every line - he cuts the ones that deserve it.\n` : ''}- The meeting ends only when ${E} decides: when it has run its course, when it went nowhere, when the visitor is done, or when ${E} has simply had enough. Only ${E} can end it.
- The pecking order and the relations above are the forces in the room: who agrees with whom no matter what, who corrects whom, who gets talked over, who checks with the boss.
- Someone may drop off the call - only when that is who they are: whoever never gets why they were brought in and is fed up with calls (an outsider who was added to the call, see the cards) drops off in every meeting they are in. They get pulled in first (asked, turned to, blamed), they answer - and the next time they get the floor, or the moment the talk lands on them again, they say their line and leave the call (leave: true), gone for good. Never ${nameOf(cur, HOST)}${room.includes(BOSS) ? ` or ${nameOf(cur, BOSS)}` : ''}.

How you choose who speaks next:
- whoever was just addressed by name, asked, blamed, contradicted or put on the spot answers.
- otherwise whoever the line pulls in by their relation (the one who always agrees, the one who corrects, the boss).
- the visitor (next = "user") gets the floor when a line turns to them or asks them something, when the exchange came to a natural rest, or when the team has talked among themselves for a while - the meeting is with the visitor, not a show for them. Two or three lines among the team is the fun; more and the visitor is a spectator. You are told how many team lines went by since the visitor last spoke.
- everyone on the call is there for a reason: someone who hasn't said a word for a while gets pulled in when a line touches their part (their job, their relation to who just spoke) - by ${nameOf(cur, HOST)} turning to them, or by them jumping in.
- never the one who is speaking now.
${room.includes(DANIEL) ? `- ${nameOf(cur, DANIEL)} never finishes a sentence: whenever he speaks, ${nameOf(cur, HOST)} cuts him off and picks up his last words (that part is set for you - after his line you are not asked).\n` : ''}- cut: the next speaker cuts the line being said off in the middle. That is ${room.includes(BOSS) ? nameOf(cur, BOSS) + "'s way; anyone else only very rarely" : 'rare in this meeting'}.
- leave: true when the next speaker says their line and drops off the call right after it.
- end: true only together with next = "${ender(room)}", when ${E} ends the meeting now.
- closes: true when the line being said right now is ${E} closing the meeting ("we're synced, closing", "thanks everyone, that's it", a goodbye) - then the meeting ends after it, whatever comes next. Only ${E}'s line can close it.

Answer JSON only:
{"next": "<a team member's id> | user", "cut": true|false, "leave": true|false, "end": true|false, "closes": true|false,
 "cue": "for the next speaker: what they react to and what they do now, as content - one plain Hebrew sentence (never the wording). \\"\\" when next is user",
 "why": "one short English reason"}`;
}
async function organize(M, inAir) {
  const { cur, log } = M;
  // his rule: Daniel never finishes a sentence - Amir cuts him off, always (no organizer call, the guards don't apply)
  if (inAir && inAir.who === DANIEL && M.room.includes(HOST) && !inAir.leaving)
    return { next: HOST, cut: true, leave: false, end: false, forced: true, cue: `${nameOf(cur, HOST)} cuts ${nameOf(cur, DANIEL)} off before he finishes and picks up his last words`, why: 'Daniel never finishes a sentence (his rule)' };
  const room = M.room.filter((id) => !(inAir && inAir.leaving && id === inAir.who));   // the one leaving now is not on the call after their line
  const user = `Team lines since the visitor's last turn: ${M.run}.${M.left.length ? `\nLeft the call (gone): ${M.left.map((id) => nameOf(cur, id)).join(', ')}.` : ''}
The meeting so far:
${transcript(cur, log)}
${inAir ? `\nRight now ${nameOf(cur, inAir.who)} is saying (its content): ${inAir.say}${inAir.leaving ? `\n(${nameOf(cur, inAir.who)} drops off the call after this line.)` : ''}\n\nWho speaks after ${nameOf(cur, inAir.who)}?` : '\nWho speaks now?'}`;
  let r = null;
  if (M.akey) r = await sonnet(M.akey, organizerSystem(cur, room), user).catch((e) => { console.error('organizer on Sonnet failed - Terra', e.message); return null; });
  if (!r) r = await call(M.key, 'direct', organizerSystem(cur, room), [{ role: 'user', content: user }], { max: 600 });
  spend(M, r);
  const o = r.out || {};
  const speaking = inAir ? inAir.who : (log[log.length - 1] || {}).who;
  let next = room.includes(o.next) && o.next !== speaking ? o.next : 'user';
  if (M.run + (inAir ? 1 : 0) >= MAX_RUN) next = 'user';   // the guard: the floor goes back to the visitor
  // the floor was the visitor's and they let it pass (the page's nudge): it doesn't go straight back to them with nobody saying a word -
  // the room goes on; when the organizer still names the visitor, the host (he drives the meeting) takes it
  if (!inAir && next === 'user' && silentLast(log) && room.includes(HOST))
    return { next: HOST, cut: false, leave: false, end: false, cue: String(o.cue || ''), why: `the visitor let the floor pass - ${nameOf(cur, HOST)} drives the meeting on (${String(o.why || '')})`, ms: r.ms };
  const end = next === ender(room) && o.end === true;
  // leaving: a team member who isn't the host or the one who ends it, after the first few lines, never on the meeting's last line
  const leave = next !== 'user' && !end && o.leave === true && next !== HOST && next !== DANIEL && next !== ender(room) && log.length >= 3;
  // the line in the air closes the meeting (his note 2026-11-20: Amir said "סוגרים" and the floor went back to him): only the ender's
  const closes = !!inAir && inAir.who === ender(room) && o.closes === true && log.length >= 2;
  if (closes) return { next: 'user', cut: false, leave: false, end: false, closes: true, cue: '', why: String(o.why || 'the ender closed the meeting'), ms: r.ms };
  return { next, cut: next !== 'user' && !!inAir && o.cut === true, leave, end, cue: String(o.cue || ''), why: String(o.why || ''), ms: r.ms };
}

// ---------- a resident's line: the chat's own chain, in a meeting ----------
function scene(cur, M, id) {
  const c = cur.byId[id], others = M.room.filter((x) => x !== id).map((x) => nameOf(cur, x));
  const rel = relIn(cur, id, M.room).map((r) => `${nameOf(cur, r.id)} - ${r.relation}`).join(' · ');
  return `THIS TIME ${c.name} IS NOT IN A CHAT: ${c.name} is in a Zoom meeting of טקי-טק, on camera, with ${others.length ? others.join(', ') : 'nobody else from the team'} - people ${c.name} knows${outsider(cur, id, M.room) ? ' from work but doesn\'t work with; someone added ' + c.name + ' to this call and ' + c.name + ' has no idea why' : ' well'} - and a visitor from outside who joined, ${nameOf(cur, 'user')}${cur.titled ? ` (the title is the one they introduced themselves with when they joined, in their own words - nobody on the team gave it to them, and ${c.name} never makes up another one or describes them in their own words)` : ''} - not from the team.${M.visitorNote ? `
What ${c.name} knows about this visitor from before (the same as in the chat - it lives in how ${c.name} sees them and comes up when the talk reaches it): ${M.visitorNote}` : ` ${c.name} doesn't know them.`}${cur.titled ? ` The way people really use a title like that: the full title once in a while (greeting them, introducing them, a formal moment), otherwise ${c.name} calls them by their first name - never the whole title in every line.` : ''}
${M.topic ? `The meeting (${nameOf(cur, HOST)} set it up): "${M.topic.title}" - ${M.topic.why}${(M.topic.agenda || []).length ? `\nAgenda: ${M.topic.agenda.join(' · ')}` : ''}\n` : ''}${genderLine(M)}
How ${c.name} stands with each of them: ${rel || '-'}
The others, and how they stand with everyone here:
${forces(cur, M.room, id)}

The meeting so far:
${transcript(cur, M.log)}`;
}
// the line someone cut off: what was said until the cut - a little past the middle, at a word, with a dash; never shorter than
// what already went out (`said` - the stream was already past the middle)
function cutOff(text, said = '', force = false) {
  const words = text.replace(/<[^<>]*>/g, '').trim().split(/\s+/);
  if (words.length < (force ? 3 : 6)) return text;
  const out = said ? said.replace(/<[^<>]*>?/g, '').trim().split(/\s+/).filter(Boolean).length : 0;
  const n = Math.min(words.length - 1, Math.max(3, Math.round(words.length * 0.55), out));
  return words.slice(0, n).join(' ').replace(/[,.;:!?-]+$/, '') + '—';
}

// one line: the director (as the chat), then Terra writes it, streamed out, while the organizer decides who comes after it
async function speak(M, plan, emit, handNow) {
  const { cur } = M, id = plan.next, c = cur.byId[id];
  const now = nowIL();
  const prev = M.log.filter(spoken).slice(-1)[0];
  const why = plan.opening
    ? `The meeting is just starting and ${c.name} opens it, as always: glad everyone is here, a word to the visitor who joined - ${cur.titled ? `greeting them by their name and referring naturally to the title they introduced themselves with when they joined (${nameOf(cur, 'user')}): what they wrote, fitted into his sentence the way people say someone's title out loud (never recited word for word; their own first-person words like "באתי ל..." turn into "שבאו ל..."), never a new title or ${c.name}'s own description of who they are` : `greeting them by their name, ${nameOf(cur, 'user')} - never a title or ${c.name}'s own description of who they are`} - and he opens the meeting's subject.`
    : `Why ${c.name} speaks now: ${plan.cue || 'the line that was just said'}`
      + (plan.cut && prev ? (prev.who === DANIEL
        ? `\n${c.name} cuts ${nameOf(cur, DANIEL)} off before he finishes the sentence - as always - and picks up his last words ("${lastWords(prev.text)}"): ${c.name}'s line starts from exactly those words and reacts to them.`
        : `\n${c.name} cuts ${nameOf(cur, prev.who)} off in the middle of the sentence.`) : '')
      + (plan.leave ? `\nAfter this line ${c.name} drops off the call - says it their own way (they don't get why they are on this call, they have had enough) and leaves.`
        : outsider(cur, id, M.room) ? `\n${c.name} stays on the call after this line, however little they want to be on it - they don't announce leaving now.` : '')
      + (plan.end ? `\n${c.name} ends the meeting now - closes it in their own way, in one line.`
        : id === ender(M.room) ? `\nThe meeting goes on after this line: ${c.name} does not close, wrap up or end it now (no "סוגרים", no goodbye).` : '');
  const phrases = M.phrases[id] || [];
  // 1 · direct - the same director as the chat (their page + every script, cached per resident), the meeting as the moment
  // parity with the chat (his rule 2026-11-20: "every agent replies exactly as in the chat"): the same director system as wiki-deep
  // reply() - their page, every script, the world + the legend (from the visitor's own words) - only the moment differs
  const turns = M.log.filter((l) => l.who === 'user' && spoken(l)).map((l) => ({ role: 'user', content: l.text }));
  const world = chain.world(cur) + chain.legend(cur, turns);
  const system = DIRECTOR(c, chain.known(cur, id).map((x) => cur.byId[x].name), scriptsOf(cur, c), world);
  const ask = `${NOW(now)}${phrases.length ? `\nCatchphrases ${c.name} already said in this meeting (never again): ${JSON.stringify(phrases)}` : ''}

${scene(cur, M, id)}

${why}

"say" = what ${c.name} says now, out loud, in the meeting: a real reaction of this person to what was just said, said to whoever it is said to. One spoken line in a meeting - not a speech, not a chat answer. Whatever the director's job above says about answering "the visitor", here it is this meeting.
${PLAN_FORMAT(c)}`;
  let d = null;
  if (M.akey) d = await sonnet(M.akey, system, ask).catch((e) => { console.error('meeting director on Sonnet failed - Terra', e.message); return null; });
  if (!d) d = await call(M.key, 'direct', system, [{ role: 'user', content: ask }], { max: 1600, cacheKey: 'dir-' + id });
  spend(M, d);
  const D = d.out || {};
  const holy = holyNow(new Date());
  if (holy && D.rest === true) return { away: holy, text: '', after: { next: 'user' }, sent: '', cut: false, plan: D };   // the chat's [[away]]: they keep it, they're not here

  // 2 · in parallel: Terra writes the line (streamed out as it comes), and the organizer decides who comes after it (it knows
  // what is being said). A cut decided while the line still streams stops the stream there.
  const notes = [`What you say now (the director's notes - true; say it in your own words and voice): ${D.say || ''}`,
    D.nuance ? `The nuance that comes out of you here, naturally, never pushed: ${D.nuance}` : '',
    (D.lines || []).length ? `What you really said / what really happened (your own videos): ${JSON.stringify(D.lines)}` : '',
    phrases.length ? `Phrases you already said in this meeting - not again: ${phrases.join(' · ')}` : ''].filter(Boolean).join('\n');
  // hold = the deltas stop (the line is cut there); a forced cut (Daniel) lets the first words out, then stops
  let sent = '', hold = false, forced = false;
  const words = (t) => t.replace(/<[^<>]*>?/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const onText = (dt) => { if (hold) return; sent += dt; emit({ t: 'delta', who: id, text: dt }); if (forced && words(sent) >= 9) hold = true; };
  // how much they know about the subject (the chat's own words, wiki-deep reply())
  const lvl = D.knows?.level;
  const limit = lvl === 'no' || lvl === 'heard_of' ? `\n\nYou (${c.name}) ${lvl === 'no' ? "don't know what this is at all" : 'know this only by name'} - you do NOT know its content. Don't explain it, don't state any detail of it (not even what the visitor's question hints at), however well the writer behind you knows it. ${D.knows.how || ''}`
    : lvl === 'some' ? `\n\nYou know this only a little, like an educated outsider - no details an expert would know, and you may get things wrong. ${D.knows.how || ''}` : '';
  const writer = call(M.key, 'talk', `${RULES.replace('{{WORLD}}', world)}\n\nRight now you are ${c.name}. Speak in the first person.\n\n${sheetText(c, ALL.filter((k) => k !== 'catchphrases'))}${c.site ? `\n\nYour site: ${chain.pub(c.site)}` : ''}`,
    [{ role: 'developer', content: `${NOW(now)}\n\n${scene(cur, M, id)}\n\n${why}\n\n${notes}${limit}\n\nWrite only your line in the meeting - said out loud on the call: one to three short spoken sentences, Hebrew, to whoever you are talking to (a name when you would say it). No cards, no [[...]] in a meeting.` }],
    { json: false, max: 900, onText });
  const org = organize(M, { who: id, say: D.say || '', leaving: !!plan.leave }).then(async (a) => {
    // the next speaker cuts this line - unless the visitor's hand is up (the floor is theirs after this line, nobody cuts); Daniel is
    // cut whatever happens (his rule)
    const hand = a.forced ? false : await handNow();
    if (a.forced) forced = true;
    else if (a.cut && !plan.end && !hand) hold = true;
    // the speakers queue (his ask 2026-11-20): who is up next shows the moment it is decided, while this line is still said
    if (!plan.end && !a.closes) emit({ t: 'next', who: a.forced ? a.next : hand ? 'user' : a.next, cut: a.cut && (a.forced || !hand) && !plan.end, after: id });
    return a;
  });
  const [t, after] = await Promise.all([writer, org]);
  spend(M, t);
  const text = clean(t.out);
  M.phrases[id] = [...new Set([...phrases, ...(c.sheet?.catchphrases || []).filter((p) => text.includes(p))])];
  return { text, after, sent, cut: hold || forced, plan: D };
}

// ---------- one round: residents speak until the floor is the visitor's (or the meeting ended) ----------
// emit(event): {t:'org', next, cut, leave, end, why} · {t:'typing', who} · {t:'delta', who, text} · {t:'cut', who, by, text} ·
// {t:'line', who, text, cut} · {t:'left', who} · {t:'floor'} · {t:'end', who} · {t:'recap', recap} · {t:'cost', usd}
// opts.hand: async () => is the visitor's hand up (the live function reads it from Firestore; the try-out from M.hand)
function newMeeting({ cur, key, akey, room, visitor = {}, visitorNote = '' }) {
  const r = [HOST, ...TEAM.filter((id) => id !== HOST && (room || []).includes(id) && cur.byId[id])];
  const v = { name: String(visitor.name || '').trim().slice(0, 40), title: String(visitor.title || '').replace(/\s+/g, ' ').trim().slice(0, 40) };
  return { cur: withVisitor(cur, v), visitor: v, visitorNote: String(visitorNote || '').slice(0, 3000), key, akey, room: r, all: r.slice(), left: [], log: [], run: 0, phrases: {}, hand: false, ended: false, cost: 0, costBy: { openai: 0, anthropic: 0, unsplit: 0 }, next: null, recap: null };
}
// what is kept between requests (meeting-fn.js puts it in Firestore) and how it comes back
const STATE = ['room', 'all', 'left', 'log', 'run', 'phrases', 'hand', 'ended', 'cost', 'costBy', 'recap', 'visitor', 'visitorNote', 'topic'];

// the meeting's subject (his ask 2026-11-21): before the call starts the director sets it with Amir's head - his page, his scripts
// (the POC, the AI initiative), who is on the call, the visitor and their title - a title, why this meeting, an agenda. It goes into
// every speaker's scene, so Amir comes with his meeting ready and everyone on the call knows what it is about.
async function subject(M) {
  const { cur } = M, a = cur.byId[HOST];
  const system = DIRECTOR(a, chain.known(cur, HOST).map((x) => cur.byId[x].name), scriptsOf(cur, a), chain.world(cur));
  const ask = `${NOW(nowIL())}

BEFORE THE CALL - not a reply to anyone. ${a.name} set up a Zoom meeting of טקי-טק for now. On the call: ${M.room.filter((x) => x !== HOST).map((x) => `${nameOf(cur, x)} (${cur.byId[x].role || ''})`).join(', ') || 'nobody else from the team'}, and a visitor from outside, ${nameOf(cur, 'user')}.${M.visitorNote ? `\nWhat ${a.name} knows about the visitor: ${M.visitorNote}` : ''}
Think as ${a.name}: why did he call this meeting today, and what is on it? Out of his own world - what is going on in his life and his videos now - and the people on the call.

Answer JSON only:
{"title": "the meeting's title as it appears on the invite - 2 to 6 words, Hebrew", "why": "why ${a.name} called it - one short Hebrew sentence", "agenda": ["2 to 3 short Hebrew items"]}`;
  let r = null;
  if (M.akey) r = await sonnet(M.akey, system, ask).catch((e) => { console.error('meeting subject on Sonnet failed - Terra', e.message); return null; });
  if (!r) r = await call(M.key, 'direct', system, [{ role: 'user', content: ask }], { max: 800, cacheKey: 'dir-' + HOST });
  spend(M, r);
  const o = r.out || {}, s = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return s(o.title, 80) ? { title: s(o.title, 80), why: s(o.why, 200), agenda: [].concat(o.agenda || []).map((x) => s(x, 120)).filter(Boolean).slice(0, 3) } : null;
}
const stateOf = (M) => Object.fromEntries(STATE.map((k) => [k, M[k] ?? null]));
const fromState = (s, { cur, key, akey }) => ({ cur: withVisitor(cur, s.visitor || {}), key, akey, visitor: {}, room: [], all: [], left: [], log: [], run: 0, phrases: {}, hand: false, ended: false, cost: 0, recap: null,
  ...Object.fromEntries(STATE.filter((k) => s[k] != null).map((k) => [k, s[k]])), costBy: s.costBy || { openai: 0, anthropic: 0, unsplit: s.cost || 0 }, next: null });

async function round(M, emit, opts = {}) {
  const handNow = opts.hand || (async () => M.hand);
  const cost = () => emit({ t: 'cost', usd: Math.round(M.cost * 10000) / 10000 });
  if (!M.log.length) emit({ t: 'visitor', name: M.visitor.name || '', title: M.visitor.title || '' });
  if (!M.log.length && !M.topic) M.topic = await subject(M).catch((e) => { console.error('meeting subject failed', e.message); return null; });
  let plan = M.next;
  if (!plan) plan = M.log.length === 0 ? { next: HOST, opening: true, cue: '' } : await organize(M, null);
  if (!M.log.length || plan.opening) emit({ t: 'org', next: plan.next, why: 'Amir opens every meeting' });
  else emit({ t: 'org', next: plan.next, cut: plan.cut, leave: plan.leave, end: plan.end, why: plan.why });
  while (!M.ended) {
    if (plan.next === 'user' || (M.log.length && !plan.forced && await handNow())) { M.hand = false; M.next = null; emit({ t: 'floor' }); return; }
    emit({ t: 'typing', who: plan.next });
    const s = await speak(M, plan, emit, handNow);
    if (s.away) {   // Shabbat / a holiday and their page keeps it: they are not on the call (as the chat answers for them)
      M.room = M.room.filter((x) => x !== plan.next); M.left.push(plan.next);
      M.log.push({ who: plan.next, left: true, away: s.away });
      emit({ t: 'away', who: plan.next, holy: s.away });
      if (plan.next === HOST || plan.end) { M.ended = true; emit({ t: 'end', who: plan.next }); return; }
      plan = { next: 'user' }; continue;
    }
    const line = { who: plan.next, text: s.text, cut: false };
    const after = s.after;
    if (s.cut) {
      const said = cutOff(s.text, s.sent, !!after.forced);
      if (said !== s.text) { line.cut = true; line.text = said; emit({ t: 'cut', who: line.who, by: after.next, text: said }); }
      else after.cut = false;   // too short to cut: the next speaker just answers
    }
    M.log.push(line); M.run++;
    emit({ t: 'line', who: line.who, text: line.text, cut: line.cut });
    if (plan.leave) {   // they said their line - and drop off the call
      M.room = M.room.filter((x) => x !== line.who); M.left.push(line.who);
      M.log.push({ who: line.who, left: true });
      emit({ t: 'left', who: line.who });
    }
    cost();
    if (plan.end || after.closes) {   // ended by plan, or the ender's line closed it (the organizer heard it)
      M.ended = true; emit({ t: 'end', who: plan.next });
      try { M.recap = await recap(M); emit({ t: 'recap', recap: M.recap }); } catch (e) { console.error('meeting recap failed', e.message); }
      cost();
      return;
    }
    plan = after;
    if (plan.next !== 'user' && !M.room.includes(plan.next)) plan = { next: 'user' };   // never someone who is gone
    emit({ t: 'org', next: plan.next, cut: plan.cut, leave: plan.leave, end: plan.end, why: plan.why });
  }
}
// how to talk TO the visitor (his note 2026-11-20: Amir said "ברוכה הבאה" to "צוות השיווק"): their gender only when the account says it
// (none of the verse's accounts does today) - otherwise always the plural
const genderLine = (M) => {
  const g = (M.visitor || {}).gender;
  if (g === 'm') return 'The visitor is a man: speak to him in the masculine singular.';
  if (g === 'f') return 'The visitor is a woman: speak to her in the feminine singular.';
  return "Nobody knows the visitor's gender (never guess it from their name or title): speak to them in the PLURAL - אתם, ברוכים הבאים, לפני שאתם זזים, תגידו, איתכם - never a masculine or feminine singular form for them.";
};
const lastWords = (t, n = 4) => String(t || '').replace(/<[^<>]*>/g, '').replace(/[—-]\s*$/, '').trim().split(/\s+/).slice(-n).join(' ');

// the visitor says something: on the log, the count starts again, and the next round answers it (hand: they raised a hand before
// the floor was theirs - the shared page shows it)
function guestSays(M, text, { hand = false } = {}) {
  M.log.push({ who: 'user', text: String(text).slice(0, 600), ...(hand ? { hand: true } : {}) });
  M.run = 0; M.next = null; M.hand = false;
}
// the floor was the visitor's and they said nothing for SILENT_S seconds (his ask 2026-11-20: the page asks the room to go on): the
// silence goes on the log as it happened - the organizer and every speaker see it in the transcript and decide what to do with it
// (someone turns to them, the team carries on); it counts as the visitor's turn
function guestSilent(M) {
  M.log.push({ who: 'user', silent: true });
  M.run = 0; M.next = null; M.hand = false;
}
const silentLast = (log) => !!((log || [])[(log || []).length - 1] || {}).silent;

// ---------- the wrap-up (his notes on the end screen: "action items + share"; then "a real, good-looking wrap-up"): Amir's
// summary of THIS meeting, the one he sends everyone after the call - what it was about, who said / decided what, who owns what.
// Terra (the better Hebrew), in Amir's own voice; true to what was said, the absurd comes from that.
async function recap(M) {
  const { cur } = M, a = cur.byId[HOST];
  const ids = [...M.all, 'user'];
  const r = await call(M.key, 'talk', `${RULES.replace('{{WORLD}}', chain.world(cur))}\n\nRight now you are ${a.name}. Write in the first person.\n\n${sheetText(a, ALL)}`,
    [{ role: 'developer', content: `${NOW(nowIL())}

The Zoom meeting of טקי-טק you ran just ended. Who was on it: ${M.all.map((id) => `${nameOf(cur, id)} (id ${id}, ${cur.byId[id].role || ''})`).join(', ')}, and a visitor from outside, ${nameOf(cur, 'user')} (id user).
The whole meeting:
${transcript(cur, M.log)}

Write the meeting summary you send everyone after the call ("סיכום ישיבה") - in your own corporate voice, the way you really write these: confident, full of your words, sure it was a productive meeting whatever happened in it - you spin everything that happened as progress (being cut off is "a valuable input", someone dropping off the call "took it offline", a question nobody answered is "an open item"). It is funny because it is true to THIS meeting: every point and every action item comes from what was really said here (who said what, who was cut off, who left, what the visitor said) - never invented topics. Short.
${(M.visitor || {}).gender ? '' : "The visitor's gender is unknown (never guess it from their name or title): write about them in the plural (הציגו, ביקשו) or without a gendered verb."}

Answer JSON only:
{"title": "the meeting's subject as you would name it in the summary - 2 to 6 words",
 "summary": "one or two short sentences: what the meeting was about and where it got to",
 "points": [{"who": "<id>", "text": "what they said or decided - one short line, without their name (it is shown next to it)"}],
 "items": [{"who": "<id> (the owner)", "text": "the action item - one short line, an action, without the owner's name"}],
 "next": "one short line about the follow-up, or \\"\\""}
points: 2 to 3. items: 3 to 5, each with its owner (ids from: ${ids.join(', ')}). Everything in Hebrew.` }],
    { json: true, max: 1400 });
  spend(M, r);
  const o = r.out || {};
  const s = (v, n) => String(v || '').replace(/\[\[[^\]]*\]\]/g, '').trim().slice(0, n);
  const row = (x) => ({ who: ids.includes(x?.who) ? x.who : HOST, text: s(x?.text, 220) });
  return { title: s(o.title, 80), summary: s(o.summary, 400), points: (o.points || []).slice(0, 3).map(row).filter((x) => x.text),
    items: (o.items || []).slice(0, 5).map(row).filter((x) => x.text), next: s(o.next, 200), by: HOST };
}

module.exports = { TEAM, HOST, BOSS, MAX_RUN, SILENT_S, newMeeting, round, guestSays, guestSilent, silentLast, stateOf, fromState, ender, _test: { organizerSystem, cutOff, transcript, recap } };
