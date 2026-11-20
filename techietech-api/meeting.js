// ישיבת זום - a Zoom meeting with the Techy-Tech team inside the chat (his idea 2026-11-20). ENGINE ONLY, local for now
// (scripts/meeting/server.mjs + page.html - he tries it, then it gets designed and built into the verse).
// His rules (2026-11-20):
//   - only the Techy-Tech team can be in a meeting together: Amir, Ofer, Daniel, Ronit, Gilad. The visitor picks who is in it.
//   - every resident speaks with their own voice exactly as in the chat: the SAME chain (wiki-deep.js - the director on their page
//     + every script, then Terra writes the Hebrew). They know each other for real (their relations); the visitor is a guest
//     they don't know.
//   - Amir drives the meeting: he always opens it ("okay, glad everyone's here").
//   - Gilad, when he is in it, stops people - his interruptions are part of every meeting he is in.
//   - the meeting ends when Amir decides - or Gilad when he is in it. No stop button.
//   - text only, signed-in only (the verse side, later).
// The ORGANIZER (Sonnet, a small fast call) never writes a line: after every line it decides who has the floor next - a resident
// (with a cue: what they react to), whether they cut the line in the air off, whether they end the meeting - or the visitor.
// No endless AI talk: the organizer is told how many lines went by since the visitor spoke and leans to them; a line that turns to
// the visitor gives them the floor; a typing visitor = a raised hand (the floor is theirs after the line being said); and after
// MAX_RUN resident lines in a row the floor is the visitor's whatever the organizer said.
const chain = require('./wiki-chain');
const { DIRECTOR, RULES, sheetText, ALL, scriptsOf, sonnet, call, PLAN_FORMAT, NOW, nowIL } = require('./wiki-deep')._parts;

const TEAM = ['amir', 'ofer', 'daniel', 'ronit', 'gilad'];
const HOST = 'amir', BOSS = 'gilad';
const MAX_RUN = 4;          // resident lines in a row before the floor is the visitor's (a guard, not the organizer's taste)
const GUEST = 'האורח';
const ender = (room) => (room.includes(BOSS) ? BOSS : HOST);
const nameOf = (cur, id) => (id === 'user' ? GUEST : cur.byId[id]?.name || id);

// the room as people: who, their job, and how they stand with everyone else IN THIS ROOM (their own relations, both ways)
function forces(cur, room, me = null) {
  return room.filter((id) => !me || id !== me).map((id) => {
    const c = cur.byId[id];
    const rel = (c.relations || []).filter((r) => room.includes(r.id)).map((r) => `${nameOf(cur, r.id)}: ${r.relation}`);
    return `- ${c.name} (${c.role || ''})${rel.length ? ' - ' + rel.join(' · ') : ''}`;
  }).join('\n');
}
function transcript(cur, log) {
  return log.map((l) => `${nameOf(cur, l.who)}: ${l.text}${l.cut ? ' [נקטע באמצע המשפט]' : ''}`).join('\n') || '(the meeting has not started)';
}
const short = (v, n) => { const t = (Array.isArray(v) ? v.join(' · ') : String(v || '')).trim(); return t.length > n ? t.slice(0, t.lastIndexOf(' ', n)) + '…' : t; };

// ---------- the organizer ----------
function organizerSystem(cur, room) {
  const cards = room.map((id) => { const c = cur.byId[id], s = c.sheet || {};
    return `### ${c.name} (id ${id}) - ${c.role || ''}\nWho: ${short(s.person || c.brief, 380)}\nWhat is funny about them: ${short(s.funny, 300)}\nHow they stand with the others here: ${(c.relations || []).filter((r) => room.includes(r.id)).map((r) => `${nameOf(cur, r.id)} - ${r.relation}`).join(' · ') || '-'}`; }).join('\n\n');
  const E = nameOf(cur, ender(room));
  return `You run a Zoom meeting of טקי-טק (Techy-Tech), a company in the Shlomiverse - a comedy world whose residents are real people living their lives. You are the meeting's organizer, like Zoom's host controls: you never write what anyone says. After every line you decide who has the floor next.

In the meeting: the team members below, who know each other well, and a guest from outside (${GUEST}) - a real person who joined; the team doesn't know them.

${cards}

How this team's meetings go:
- ${nameOf(cur, HOST)} drives the meeting: he opened it, he moves it along, turns to people, sums up.
${room.includes(BOSS) ? `- ${nameOf(cur, BOSS)} is the boss in this room, and the one who stops people: whoever runs ahead, goes in circles, piles up buzzwords or talks without a business behind it - he cuts them off in the middle ("מה הביזנס?"). That is who he is; a meeting with him in it always has him cutting people off. He doesn't cut every line - he cuts the ones that deserve it.\n` : ''}- The meeting ends only when ${E} decides: when it has run its course, when it went nowhere, when the guest is done, or when ${E} has simply had enough. Only ${E} can end it.
- The pecking order and the relations above are the forces in the room: who agrees with whom no matter what, who corrects whom, who gets talked over, who checks with the boss.

How you choose who speaks next:
- whoever was just addressed by name, asked, blamed, contradicted or put on the spot answers.
- otherwise whoever the line pulls in by their relation (the one who always agrees, the one who corrects, the boss).
- the guest (next = "user") gets the floor when a line turns to them or asks them something, when the exchange came to a natural rest, or when the team has talked among themselves for a while - the meeting is with the guest, not a show for them. Two or three lines among the team is the fun; more and the guest is a spectator. You are told how many team lines went by since the guest last spoke.
- everyone on the call is there for a reason: someone who hasn't said a word for a while gets pulled in when a line touches their part (their job, their relation to who just spoke) - by ${nameOf(cur, HOST)} turning to them, or by them jumping in.
- never the one who is speaking now.
- cut: the next speaker cuts the line being said off in the middle. That is ${room.includes(BOSS) ? nameOf(cur, BOSS) + "'s way; anyone else only very rarely" : 'rare in this meeting'}.
- end: true only together with next = "${ender(room)}", when ${E} ends the meeting now.

Answer JSON only:
{"next": "<a team member's id> | user", "cut": true|false, "end": true|false,
 "cue": "for the next speaker: what they react to and what they do now, as content - one plain Hebrew sentence (never the wording). \\"\\" when next is user",
 "why": "one short English reason"}`;
}
async function organize(M, inAir) {
  const { cur, room, log } = M;
  const user = `Team lines since the guest last spoke: ${M.run}.
The meeting so far:
${transcript(cur, log)}
${inAir ? `\nRight now ${nameOf(cur, inAir.who)} is saying (its content): ${inAir.say}\n\nWho speaks after ${nameOf(cur, inAir.who)}?` : '\nWho speaks now?'}`;
  let r = null;
  if (M.akey) r = await sonnet(M.akey, organizerSystem(cur, room), user).catch((e) => { console.error('organizer on Sonnet failed - Terra', e.message); return null; });
  if (!r) r = await call(M.key, 'direct', organizerSystem(cur, room), [{ role: 'user', content: user }], { max: 600 });
  M.cost += r.cost || 0;
  const o = r.out || {};
  const speaking = inAir ? inAir.who : (log[log.length - 1] || {}).who;
  let next = room.includes(o.next) && o.next !== speaking ? o.next : 'user';
  if (M.run + (inAir ? 1 : 0) >= MAX_RUN) next = 'user';   // the guard: the floor goes back to the guest
  return { next, cut: next !== 'user' && !!inAir && o.cut === true, end: next === ender(room) && o.end === true, cue: String(o.cue || ''), why: String(o.why || ''), ms: r.ms };
}

// ---------- a resident's line: the chat's own chain, in a meeting ----------
function scene(cur, M, id) {
  const c = cur.byId[id], others = M.room.filter((x) => x !== id).map((x) => nameOf(cur, x));
  return `THIS TIME ${c.name} IS NOT IN A CHAT: ${c.name} is in a Zoom meeting of טקי-טק, on camera, with ${others.length ? others.join(', ') : 'nobody else from the team'} - people ${c.name} knows well - and a guest from outside who joined (${GUEST}), whom ${c.name} doesn't know.
How ${c.name} stands with each of them: ${(c.relations || []).filter((r) => M.room.includes(r.id) && r.id !== id).map((r) => `${nameOf(cur, r.id)} - ${r.relation}`).join(' · ') || '-'}
The others, and how they stand with everyone here:
${forces(cur, M.room, id)}

The meeting so far:
${transcript(cur, M.log)}`;
}
async function speak(M, plan, emit) {
  const { cur } = M, id = plan.next, c = cur.byId[id];
  const now = nowIL();
  const prev = M.log[M.log.length - 1];
  const why = plan.opening
    ? `The meeting is just starting and ${c.name} opens it, as always: glad everyone is here, a word to the guest who joined, and what this meeting is about${M.log.length ? '' : ' - or ask the guest what brought them'}.`
    : `Why ${c.name} speaks now: ${plan.cue || 'the line that was just said'}`
      + (plan.cut && prev ? `\n${c.name} cuts ${nameOf(cur, prev.who)} off in the middle of the sentence.` : '')
      + (plan.end ? `\n${c.name} ends the meeting now - closes it in their own way, in one line.` : '');
  const phrases = M.phrases[id] || [];
  // 1 · direct - the same director as the chat (their page + every script, cached per resident), the meeting as the moment
  const system = DIRECTOR(c, chain.known(cur, id).map((x) => cur.byId[x].name), scriptsOf(cur, c), chain.world(cur));
  const ask = `${NOW(now)}${phrases.length ? `\nCatchphrases ${c.name} already said in this meeting (never again): ${JSON.stringify(phrases)}` : ''}

${scene(cur, M, id)}

${why}

"say" = what ${c.name} says now, out loud, in the meeting: a real reaction of this person to what was just said, said to whoever it is said to. One spoken line in a meeting - not a speech, not a chat answer. Whatever the director's job above says about answering "the visitor", here it is this meeting.
${PLAN_FORMAT(c)}`;
  let d = null;
  if (M.akey) d = await sonnet(M.akey, system, ask).catch((e) => { console.error('meeting director on Sonnet failed - Terra', e.message); return null; });
  if (!d) d = await call(M.key, 'direct', system, [{ role: 'user', content: ask }], { max: 1600, cacheKey: 'dir-' + id });
  M.cost += d.cost || 0;
  const D = d.out || {};

  // 2 · in parallel: Terra writes the line, and the organizer decides who comes after it (it knows what is being said)
  const notes = [`What you say now (the director's notes - true; say it in your own words and voice): ${D.say || ''}`,
    D.nuance ? `The nuance that comes out of you here, naturally, never pushed: ${D.nuance}` : '',
    (D.lines || []).length ? `What you really said / what really happened (your own videos): ${JSON.stringify(D.lines)}` : '',
    phrases.length ? `Phrases you already said in this meeting - not again: ${phrases.join(' · ')}` : ''].filter(Boolean).join('\n');
  const writer = call(M.key, 'talk', `${RULES.replace('{{WORLD}}', chain.world(cur))}\n\nRight now you are ${c.name}. Speak in the first person.\n\n${sheetText(c, ALL.filter((k) => k !== 'catchphrases'))}`,
    [{ role: 'developer', content: `${NOW(now)}\n\n${scene(cur, M, id)}\n\n${why}\n\n${notes}\n\nWrite only your line in the meeting - said out loud on the call: one to three short spoken sentences, Hebrew, to whoever you are talking to (a name when you would say it). No cards, no [[...]] in a meeting.` }],
    { json: false, max: 700 });
  const [t, after] = await Promise.all([writer, organize(M, { who: id, say: D.say || '' })]);
  M.cost += t.cost || 0;
  let text = String(t.out || '').replace(/\[\[[^\]]*\]\]/g, '').trim();
  M.phrases[id] = [...new Set([...phrases, ...(c.sheet?.catchphrases || []).filter((p) => text.includes(p))])];
  return { text, after, plan: D };
}

// the line someone cut off: what was said until the cut - a little past the middle, at a word, with a dash
function cutOff(text) {
  const words = text.replace(/<[^<>]*>/g, '').trim().split(/\s+/);
  if (words.length < 6) return text;
  return words.slice(0, Math.max(3, Math.round(words.length * 0.55))).join(' ').replace(/[,.;:!?-]+$/, '') + '—';
}

// ---------- one round: residents speak until the floor is the visitor's (or the meeting ended) ----------
// M = newMeeting(); emit(event): {t:'typing', who} · {t:'line', who, text, cut} · {t:'org', why, next, cut, end} · {t:'floor'} ·
// {t:'end', who} · {t:'cost', usd}
function newMeeting({ cur, key, akey, room }) {
  const r = [HOST, ...TEAM.filter((id) => id !== HOST && (room || []).includes(id))];
  return { cur, key, akey, room: r, log: [], run: 0, phrases: {}, hand: false, ended: false, cost: 0, next: null };
}
async function round(M, emit) {
  let plan = M.next;
  if (!plan) plan = M.log.length === 0 ? { next: HOST, opening: true, cue: '' } : await organize(M, null);
  if (!M.log.length || plan.opening) emit({ t: 'org', next: plan.next, why: 'Amir opens every meeting' });
  else emit({ t: 'org', next: plan.next, cut: plan.cut, end: plan.end, why: plan.why });
  while (!M.ended) {
    if (plan.next === 'user' || M.hand) { M.hand = false; M.next = null; emit({ t: 'floor' }); return; }
    emit({ t: 'typing', who: plan.next });
    const s = await speak(M, plan, emit);
    const line = { who: plan.next, text: s.text, cut: false };
    const after = s.after;
    if (after.cut && !plan.end) { line.cut = true; line.full = s.text; line.text = cutOff(s.text); }
    M.log.push(line); M.run++;
    emit({ t: 'line', who: line.who, text: line.text, cut: line.cut });
    emit({ t: 'cost', usd: Math.round(M.cost * 10000) / 10000 });
    if (plan.end) { M.ended = true; emit({ t: 'end', who: plan.next }); return; }
    plan = after;
    emit({ t: 'org', next: plan.next, cut: plan.cut, end: plan.end, why: plan.why });
  }
}
// the visitor says something: on the log, the count starts again, and the next round answers it
function guestSays(M, text) {
  M.log.push({ who: 'user', text: String(text).slice(0, 600) });
  M.run = 0; M.next = null; M.hand = false;
}

module.exports = { TEAM, HOST, BOSS, MAX_RUN, newMeeting, round, guestSays, _test: { organizerSystem, cutOff, transcript } };
