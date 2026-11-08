// "אתם חיים בסימולציה?" - the simulation test (stage 2 of the conversion plan; plan conversion-next v6, approved by him
// 2026-11-06 in Backstage → תוכניות). Like the silly teen-magazine quizzes, but the questions are written by the AI one
// after the other from the visitor's answers, in the voice of a host (the character the visitor is with; a different one
// on the home page). At the end the AI gives a score and MIXES a simulation for this one visitor: 2-3 real characters from
// different worlds, what each does there, a name and a verdict - and a picture of them together made with their real
// portraits (GPT Image, low quality, ~$0.04, only when a resident opens the full result; a daily cap).
// A tourist sees the score; the full result after "מסדירים תושבות" (sign-in) - the result then sticks to the account.
// Everything is a record in Firestore `sims/<rid>` (the questions, answers, result, tokens) - Backstage reads the funnel
// from it (op simStats through verseOwner); what it costs = Backstage → הוצאות, from the provider (his rule: no self-tracking). The page: v2/site/verse/sim.js (/simulation).
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const bundled = require('./wiki-brain.json');
const material = require('./character-material');
const proc = require('./process');
const about = require('./about');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const KEY = defineSecret('VERSE_SITE_OPENAI_KEY');   // the site's own OpenAI key (Backstage → הוצאות shows its spend; the chat has WIKI_OPENAI_KEY)
const MODEL = 'gpt-5.6-terra';
const IMG_MODEL = 'gpt-image-2.6-flare';
const STEPS = 7;
const MEDIA = 'shlomiverse-media';
const IMG_CAP = 200;          // pictures a day for everyone together (Backstage shows the count)
const STARTS_A_DAY = 10;      // tests a day per address (one per person on the page - his rule; this only stops a flood)
// the classifier: Yotam, the System Architect of life, runs the Shlomiverse's classification (his note 2026-11-07: not a random
// character). HOSTS stays only as a fallback cast for the picture.
const HOST = 'yotam';
const HOSTS = ['yotam', 'hani', 'demokratovich', 'rosenblum', 'miriam', 'gilad', 'nahor', 'dorit', 'ayelet', 'vova', 'genz', 'yudit'];
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
// "ספרו לנו עליכם" (plan cz-sim-r3, his yes 2026-11-07): three of the 7 questions also fill the person's profile (about.js), at
// fixed places - asked only when the field is still missing for a signed-in person, always for a tourist (it moves in when they
// sign in). Each of its 4 answers carries a fixed value; their own words are read by the AI (a value or nothing).
const PURPOSE = { 2: 'stage', 4: 'world', 6: 'channel' };
const GOAL = {
  stage: 'where the visitor is in life (school, army or national service, studies, work, parenting, retirement)',
  world: 'which world (series) of the Shlomiverse makes them laugh most - each answer clearly evokes a different world from the list (its place, its kind of people or humour; you may name it)',
  channel: 'how they would want to hear when something new happens in the Shlomiverse',
};
const WORLDS_OFFERED = 12;   // the world question picks its 4 from the worlds with the most videos
const answered = (s) => s.pick !== undefined || s.free !== undefined;
const answerOf = (s) => (s.free !== undefined ? `(in their own words) "${s.free}"` : s.a[s.pick]);

// the characters, from the same brain as the chat (gs://shlomiverse-private/wiki-brain.json, looked at every 3 minutes)
let brain = bundled, brainMd5 = 'bundled', checked = 0;
async function brainNow() {
  if (Date.now() - checked < 180e3) return brain;
  checked = Date.now();
  try {
    const f = admin.storage().bucket('shlomiverse-private').file('wiki-brain.json');
    const [m] = await f.getMetadata();
    if (m.md5Hash !== brainMd5) { const [buf] = await f.download(); brain = JSON.parse(buf.toString('utf8')); brainMd5 = m.md5Hash; }
  } catch (e) { console.error('sim brain', e.message); }
  return brain;
}
const byId = (b) => Object.fromEntries(b.characters.map((c) => [c.id, c]));
const short = (s, n) => { s = Array.isArray(s) ? s.join(' · ') : String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const hostText = (c) => [`Name: ${c.name} (id ${c.id})`, `Who: ${short(c.brief || c.bio, 500)}`, `Personality: ${short(c.personality, 400)}`,
  `Speech: ${short(c.speech, 400)}`, `Catchphrases: ${short(c.catchphrases, 300)}`, `Never: ${short(c.dont, 300)}`, `Writing notes: ${short(c.writing_rules, 300)}`].join('\n');
// the host's material for the questions (his call, 2026-11-06: "the questions in the tone of the character asking"):
// the whole profile from the character bible + real lines from their own videos, so the model uses their real phrases
// and world, not invented jargon. The same text for every call of that host - OpenAI serves it from its cache.
const FIELDS = [['brief', 'Who'], ['personality', 'Personality'], ['speech', 'How they talk'], ['catchphrases', 'Catchphrases'], ['behavior', 'Behaviour'],
  ['comedy', 'What is funny about them'], ['themes', 'Their themes'], ['writing_rules', 'Writing notes'], ['dont', 'Never']];
// now the full material, as the chat gets it (his rule 2026-11-07: as funny as the chat, even if it costs more)
const hostMaterial = (c, b) => material(b, c.id);
// "who" = their role in one line, not the start of their bio (his cost plan 2026-11-08: the result step read 5.8K tokens of
// residents; with the role 3.7K, and the role says who they are better than a bio cut at 110 characters)
const castLine = (c) => `${c.id} | ${c.name} | ${c.world || ''} | ${c.tagline} | ${short(c.role || c.brief || c.bio, 70)}`;
// a different handful of residents on every result (his note 2026-11-08 - "very important": of 10 results Yotam was in 6,
// Rosenblum in 5, the neighbour in 5 - from the whole list the model kept the same favourites). A shuffled ~24, at most 4 from
// one world (Techy-Tech alone is 32 of 83), the host only in about one result of five. It changes every run, so it goes in the
// call's `now`, never in the cached `fixed` part - and the call reads ~24 lines instead of all of them.
const OFFER = 24, PER_WORLD = 4, HOST_SOMETIMES = 0.2;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function castOffer(b) {
  const per = {}, out = [];
  for (const c of shuffle(b.characters.filter((x) => x.tagline && x.id !== HOST))) {
    const w = c.world || c.id;
    if (out.length >= OFFER || (per[w] || 0) >= PER_WORLD) continue;
    per[w] = (per[w] || 0) + 1; out.push(c);
  }
  const host = b.characters.find((x) => x.id === HOST);
  if (host && Math.random() < HOST_SOMETIMES) out.splice(Math.floor(Math.random() * (out.length + 1)), 0, host);
  return out;
}
const castList = (list) => list.map(castLine).join('\n');

// PLAIN WORDS (his note 2026-11-08: "the options of Yotam are not that clear... this is the most annoying part of Yotam - all is
// super sophisticated and not clear"): questions and answers in everyday Hebrew, no tech words; his voice only in the reaction
const GAME = `You run "באיזו סימולציה אתם חיים?" ("Which simulation do you live in?") - the Shlomiverse's official classification. שלומיוורס (the Shlomiverse) is a world of comedy characters shown as real people; its registry classifies every visitor into the simulation they live in, and the classification is conducted by Yotam, the Shlomiverse's System Architect of life - he is the host who asks. The visitors keep writing "we live in a simulation"; this classification tells them which one.
It is like the silly quizzes of the 90s Israeli teen magazines (מעריב לנוער): light, absurd, fast, one thumb. The questions are about THE VISITOR - their habits, reactions, daily-life absurdities, small confessions - never a trivia test about the characters.
PLAIN WORDS - this rule is above your usual way of talking. The questions and the 4 answers are written in simple, everyday spoken Hebrew that a 12-year-old understands at the first read: short, concrete, one simple idea, the words people use at home. NO tech words and no jargon in a question or an answer (no system, bug, update, server, algorithm, data, version, process, loop, backup, protocol - in Hebrew or in English), no metaphors to decode, no wordplay that needs a second read, no English. The joke is the situation itself - a familiar everyday moment and four honest, recognisable ways people react to it - never clever phrasing. Good (the level, not a topic to reuse): "מה אתם עושים כשהשעון המעורר מצלצל?" - "קמים מיד", "עוד חמש דקות. ועוד חמש.", "מכבים וממשיכים לישון", "מתעוררים לפני השעון".
The host's voice lives only in "react": his short reaction to their last answer, in his way of talking, light - at most one word of his world, and still clear to anyone.
The TOPIC is always the visitor: each question visits a DIFFERENT corner of everyday life (mornings, the phone, the family WhatsApp group, food, work or school, sleep, friends, shopping, driving, holidays...) - never two in a row about the same thing. At most two callbacks in the whole test (a quick nod to something they answered, inside a NEW topic) - never a chain where each question follows the previous answer's object.
The 4 answers are what the visitor would say: short phrases, ideally with no subject; if they have one, the grammar must agree ("אני קם" / "אנחנו קמים", never "אני קמים").
HEBREW GRAMMAR, checked before you answer (it went wrong in tests): prefer answers with no verb at all - a noun phrase ("צלצול של בית הספר", "ישיבת צוות שאף אחד לא ביקש"), which also stays gender-neutral. An answer with "אני" takes a SINGULAR verb ("אני קם") - never "אני" with a plural verb ("אני קמים" is wrong). Only the question and your reactions speak to the visitor in plural (אתם). Re-read each answer for agreement of subject, verb and adjective.
Hebrew, addressed in plural (אתם) and gender-neutral. No emoji. Nothing about politics, religious observance, health, sex, money amounts, minors or anything that could hurt. Never explain how the test works or mention AI.`;

// OpenAI Responses API with a JSON schema - one short structured answer
async function ask(key, instructions, input, schema, name, effort = 'low') {
  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, instructions, input, reasoning: { effort }, max_output_tokens: 1600, store: false,
      prompt_cache_key: 'sim-' + name, text: { format: { type: 'json_schema', name, strict: true, schema } } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`openai ${r.status} ${j.error?.message || ''}`);
  const text = (j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '';
  const u = j.usage || {};
  return { out: JSON.parse(text), u: [u.input_tokens || 0, u.input_tokens_details?.cached_tokens || 0, u.output_tokens || 0], ms: Date.now() - t0 };
}
const S = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const str = { type: 'string' };
// every question has the same schema (a plain one leaves v empty) - the same prefix on all 7 steps, so OpenAI's cache serves it
// (his cost plan 2026-11-08); the values of a purposeful question are checked in stepOf, not by an enum
const Q_SCHEMA = S({ react: str, q: str, a: { type: 'array', minItems: 4, maxItems: 4, items: S({ t: str, v: str }) } });
const OPEN_SCHEMA = S({ title: str, line: str, btn: str });
const RESULT_SCHEMA = S({ score: { type: 'integer' }, dept: str, name: str, verdict: str, cast: { type: 'array', minItems: 2, maxItems: 3, items: S({ id: str, role: str, scene: str }) },
  share: str, ask: str, setting: str });

// the host's opening screen: written once per host and kept (simHosts/<id>); Yotam's is the one he approved in the plan
const SEED = { yotam: { title: 'יותם מריץ בדיקת מערכת', line: 'יותם פתח טיקט. לצערו, אתם הטיקט.', btn: 'תבדקו אותי' } };
async function opening(key, host) {
  if (SEED[host.id]) return SEED[host.id];
  const ref = db().collection('simHosts').doc(host.id), got = await ref.get();
  if (got.exists && got.data().title) return got.data();
  const { out } = await ask(key, `${GAME}\n\nThe host of this test:\n${hostText(host)}`,
    [{ role: 'user', content: `Write the test's opening screen, in the host's own voice and world (the way they themselves would put it), funny: title - up to 5 words, with the host's name written exactly as "${host.name}", saying the host is running the check (example of the tone, for Yotam the tech architect: "יותם מריץ בדיקת מערכת"); line - up to 12 words, a joke in their voice about checking the visitor (example for Yotam: "יותם פתח טיקט. לצערו, אתם הטיקט."); btn - the start button, up to 3 words, the visitor speaking to the host or a plural command to the visitor, never singular (example: "תבדקו אותי"). Never describe how the test works.` }],
    OPEN_SCHEMA, 'open');
  await ref.set({ ...out, t: FieldValue.serverTimestamp() });
  return out;
}

const qPrompt = (host, b) => `${GAME}

The host of this test - you write as them:
${hostMaterial(host, b || brain)}`;
// purpose = { field, vals: [[value, meaning]] } when this question also fills a profile field (PURPOSE)
function qInput(steps, purpose) {
  const done = steps.filter(answered);
  const lines = done.map((s, i) => `${i + 1}. ${s.react ? `(your reaction before it: ${s.react}) ` : ''}${s.q}\n   answered: ${answerOf(s)}`).join('\n');
  const n = done.length + 1;
  const last = done[done.length - 1];
  return [{ role: 'user', content: `${done.length ? 'The test so far:\n' + lines + '\n\n' : ''}Write question ${n} of ${STEPS}.
- react: ${done.length ? `the host's quick reaction to the last answer, in their voice, up to 9 words (funny, never mean)${last && last.free !== undefined ? ' - they wrote it in their own words: react to exactly what they wrote' : ''}. Every reaction opens differently from your earlier ones; a catchphrase at most twice in the whole test, never in two reactions in a row` : 'empty string'}.
- q: the question, up to 12 words, about the visitor, in plain everyday words (PLAIN WORDS above - no tech words, nothing to decode).
- a: exactly 4 answers, each up to 5 plain words, clearly different from each other, all funny and all tempting - no "correct" one, no "none of the above". a[i].t = the answer as the visitor says it; a[i].v = ${purpose ? 'its value (below)' : 'empty string'}.${n === STEPS ? ' This is the last question: make it the most absurd situation - still in plain words.' : ''}${purpose ? `
THIS QUESTION ALSO FILLS THE REGISTRY: it finds out ${GOAL[purpose.field]}. It stays a funny, plain question about the visitor in the game's tone - never a form question, never say why you ask. Each of the 4 answers points to a DIFFERENT one of these values, and the visitor must be able to tell which; a[i].v = exactly one value from this list.
The values (value = what it means):
${purpose.vals.map(([v, m]) => `${v} = ${m}`).join('\n')}` : ''}` }];
}


// the chat's own character runs the test (process.js - his ask 2026-11-07: "exactly the chat, told it runs a process")
async function askAs(key, hostId, task, schema, name) {
  const t0 = Date.now();
  const r = await proc.run(key, hostId, [], task, schema, name);
  return { ...r, ms: Date.now() - t0 };
}
const qTask = (steps, purpose) => ({ fixed: GAME, now: qInput(steps, purpose)[0].content });
// the values a purposeful question offers: the field's fixed answers, or for the world question the worlds people know
async function purposeOf(field) {
  if (!field) return null;
  const f = about.FIELDS[field];
  if (f.kind === 'pick') return { field, vals: Object.entries(f.opts) };
  const I = await about.ids();
  return { field, vals: I.worldList.slice(0, WORLDS_OFFERED).map((w) => [w.id, `${w.title}: ${short(w.blurb, 90)}`]) };
}
// question n (1-based) for this test: a plain one, or one that also fills a field (its 4 answers then carry values)
async function makeQ(key, hostId, steps, d) {
  const n = steps.filter(answered).length + 1, field = (d.purpose || {})[n] || null;
  const purpose = await purposeOf(field);
  const r = await askAs(key, hostId, qTask(steps, purpose), Q_SCHEMA, 'q');
  return { step: stepOf(r.out, purpose), u: r.u, ms: r.ms };
}
function stepOf(o, purpose) {
  if (!purpose) return { q: clip(o.q, 200), a: o.a.map((x) => clip(x.t, 80)), react: sayClip(o.react || '', 160) };
  const vals = purpose.vals.map(([v]) => v);
  return { q: clip(o.q, 200), a: o.a.map((x) => clip(x.t, 80)), v: o.a.map((x) => (vals.includes(x.v) ? x.v : null)), field: purpose.field, react: sayClip(o.react || '', 160) };
}
const qOut = (s) => ({ q: s.q, a: s.a, react: s.react || '' });

const rPrompt = () => `${GAME}

Now the classification is over. Classify this visitor - the result is the Shlomiverse's official classification, signed by Yotam. Every Hebrew field is in PLAIN WORDS too (no tech words, no English):
- score: an integer 0-100, how much this visitor lives in a simulation - your judgement from the answers, not a formula.
- dept: the department of the Shlomiverse this visitor is assigned to, in Hebrew, up to 5 words, starting with "מחלקת", in the registry's dry bureaucratic tone, fitting THEIR answers - invent it for this visitor (example of the tone: "מחלקת תלונות על המציאות").
- cast: mix a simulation for THIS visitor from 2 or 3 residents below, from at least 2 different worlds, who fit their answers in a surprising, funny way. For each: id (exactly from the list), role - in Hebrew, up to 8 words, what they do in the visitor's simulation; scene - in English, what they physically do in ONE shared picture (action, prop, place in the frame).
- setting: in English, the one place where the picture happens (it mixes their worlds), one sentence.
- name: the name of the simulation they are classified into, in Hebrew, up to 6 words (example of the tone: "מבחן פתע אצל השכן").
- verdict: two short Hebrew lines about the visitor, plural (אתם), funny, separated by a newline (example: "אתם מוקפים באנשים שמסבירים הכול.\\nחבל שאף אחד לא מסביר מה קורה פה.").
- share: one line the visitor posts on their story, first person, gender-neutral (past tense), up to 8 words (example: "קיבלתי סימולציה עם מכתב תלונה.").
- ask: the question to their friends, up to 4 words (example: "מי אצלכם?").
The residents you may cast from come with the visitor's answers (a different few each time).`;
// the call's two parts: the rules (cached) and, this time, the answers + this run's residents (castOffer)
const rTask = (b, steps) => ({ fixed: rPrompt(), now: "The visitor's answers:\n" + steps.map((s, i) => `${i + 1}. ${s.q}\n   answered: ${answerOf(s)}`).join('\n')
  + '\n\nThe residents you may cast from this time (id | name | world | tagline | who):\n' + castList(castOffer(b)) });

// the result: score, the mixed simulation, the share lines - from the answers given (all 7, or 3+ when they skipped)
async function finish(key, ref, d, steps, br, skipped = false) {
  const C = byId(br);
  const done = await askAs(key, HOST, rTask(br, steps), RESULT_SCHEMA, 'result');
  const o = done.out;
  const cast = o.cast.filter((c, i, a) => C[c.id] && a.findIndex((x) => x.id === c.id) === i).slice(0, 3).map((c) => ({ id: c.id, role: clip(c.role, 80), scene: clip(c.scene, 300) }));
  if (cast.length < 2) for (const id of HOSTS) if (cast.length < 2 && !cast.some((c) => c.id === id) && C[id]) cast.push({ id, role: '', scene: 'stands in the scene looking suspicious' });
  // the department replaces the score on screen (his decision, plan cz-sim-r4 2026-11-07: "the 0-100 means nothing"); score stays in the data
  const result = { score: Math.max(0, Math.min(100, Math.round(o.score))), dept: clip(o.dept, 60), name: clip(o.name, 60), verdict: clip(o.verdict, 200), cast, share: clip(o.share, 80), ask: clip(o.ask, 40), setting: clip(o.setting, 300) };
  await ref.update({ steps, result, skipped, u: (d.u || [0, 0, 0]).map((x, i) => x + (done.u[i] || 0)), finished: FieldValue.serverTimestamp(), pre: FieldValue.delete() });
  // a resident: the result goes on the account now (it never did - the home band invited him again after a finished test,
  // 2026-11-07) and the profile fields it found go in; a tourist's wait for the claim
  if (d.uid) await Promise.all([toFan(d.uid, d.rid, result), toProfile(d.uid, d)]);
  return { done: true, score: result.score, dept: result.dept, ms: done.ms };
}
// the test's line on the account (fans/<uid>.sim): the home band, the passport and the chat read it
const toFan = (uid, rid, r) => db().collection('fans').doc(uid).set({ sim: { rid, name: r.name, dept: r.dept || null, score: r.score, t: Date.now() } }, { merge: true });
// the fields this test found (d.vals; their own words in d.raw) -> the person's profile; only fields still empty are filled
async function toProfile(uid, d) {
  const vals = d.vals || {};
  if (!Object.keys(vals).length) return;
  try { const I = await about.ids(); await about.save(uid, vals, 'yotam', { raw: d.raw || {}, ids: new Set([...I.chars, ...I.worlds]) }); }
  catch (e) { console.error('sim about', uid, e.message); }
}

const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const day = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
async function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { return null; }
}
const clip = (s, n) => String(s ?? '').slice(0, n);
// Yotam's reaction is never cut mid-word (same rule as citizen.js sayClip): the last full sentence, else the last word
const sayClip = (s, n) => {
  const t = String(s ?? '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n), end = Math.max(...['.', '?', '!', '…', ':'].map((c) => cut.lastIndexOf(c)));
  return end > n * 0.4 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')).replace(/[,\s]+$/, '') + '…';
};
const RID = /^[a-z0-9]{10,24}$/;

// what the page may see of a test: a tourist the score; the owner (signed in) or anyone once it was shared - all of it
function view(d, full) {
  const v = { rid: d.rid, host: d.host, score: d.result ? d.result.score : null, dept: d.result ? d.result.dept || null : null, done: !!d.result, step: (d.steps || []).filter(answered).length };
  if (full && d.result) Object.assign(v, { name: d.result.name, verdict: d.result.verdict, cast: d.result.cast.map((c) => ({ id: c.id, role: c.role })),
    share: d.result.share, ask: d.result.ask, img: d.img || null, imgState: d.imgState || null, shared: !!d.shared });
  return v;
}

async function picture(key, rid, d) {
  const b = await brainNow(), C = byId(b), cast = d.result.cast.filter((c) => C[c.id]);
  const form = new FormData();
  form.append('model', IMG_MODEL); form.append('size', '1024x1536'); form.append('quality', 'low'); form.append('n', '1'); form.append('output_format', 'jpeg');
  const order = cast.map((c, i) => `image ${i + 1} = ${C[c.id].name_en || c.id}${C[c.id].look ? ' (' + short(C[c.id].look, 160) + ')' : ''}`).join('; ');
  form.append('prompt', `A tall 9:16 comedic cinematic scene, no text, no letters, no logos, no signs with writing. ${d.result.setting}
The people, each EXACTLY as in their attached portrait (same face, hair, glasses, clothes) and each in their own role: ${order}.
${cast.map((c, i) => `Image ${i + 1}: ${c.scene}`).join('\n')}
One coherent scene, warm cinematic light, dark background with orange glow accents, playful, every face clear and recognisable.
Leave the top 25% and the bottom 20% calmer and darker (text is laid over later).`);
  const bucket = admin.storage().bucket(MEDIA);
  for (const c of cast) {
    const [buf] = await bucket.file(`wiki/img/c/${c.id}.jpg`).download();
    form.append('image[]', new Blob([buf], { type: 'image/jpeg' }), `${c.id}.jpg`);
  }
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(`image ${r.status} ${j.error?.message || ''}`);
  const path = `wiki/sim/${rid}.jpg`;
  await bucket.file(path).save(Buffer.from(j.data[0].b64_json, 'base64'), { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
  return { url: `https://storage.googleapis.com/${MEDIA}/${path}` };
}

async function handle(req, res) {
  const b = req.body || {}, op = b.op;
  const key = process.env.FUNCTIONS_EMULATOR === 'true' ? process.env.VERSE_OPENAI_KEY : KEY.value();
  const sims = db().collection('sims');

  // the opening screen of a host (the page shows it before anything is spent)
  if (op === 'open') {
    const br = await brainNow(), C = byId(br);
    const host = C[HOST] || C[b.host];
    return { host: { id: host.id, name: host.name }, open: await opening(key, host) };
  }

  // a new test: the record + question 1
  if (op === 'start') {
    const br = await brainNow(), C = byId(br);
    const host = C[HOST] || C[b.host] || C[HOSTS[0]];
    const ip = hash(ipOf(req)), rate = db().collection('simRate').doc(`${day()}_${ip}`);
    const n = await db().runTransaction(async (tx) => { const g = await tx.get(rate); const k = (g.exists ? g.data().n : 0) + 1; tx.set(rate, { n: k, exp: Timestamp.fromMillis(Date.now() + 2 * 864e5) }); return k; });
    if (n > STARTS_A_DAY) return { error: 'limit' };
    const rid = crypto.randomBytes(9).toString('hex').slice(0, 14);
    const user = await who(req);
    // which questions also fill the profile: a resident - only the fields still missing; a tourist - all three
    const miss = new Set(user ? about.missing(await about.get(user.uid), Object.values(PURPOSE)) : Object.values(PURPOSE));
    const purpose = Object.fromEntries(Object.entries(PURPOSE).filter(([, f]) => miss.has(f)));
    const first = await makeQ(key, host.id, [], { purpose });
    const step = { ...first.step, react: '' };
    await sims.doc(rid).set({ rid, host: { id: host.id, name: host.name }, from: clip(b.from || '', 20), ref: RID.test(b.ref || '') ? b.ref : null,
      v: clip(String(b.v || '').replace(/[^a-z0-9]/gi, ''), 12), ip, uid: user ? user.uid : null, resident: !!user, own: !!b.own,
      purpose, vals: {}, raw: {}, steps: [step], u: first.u, created: FieldValue.serverTimestamp(), day: day(), ...(b.pre ? { pre1: true } : {}) });
    return { rid, n: 1, of: STEPS, ...qOut(step), ms: first.ms };
  }
  // the first question is written as the page opens (pre: true - plan cz-sim-r4, 2026-11-07: the wait after "תבדקו אותי" was too
  // long); the tap on the button marks the test as really started, so Backstage counts only those (simStats)
  if (op === 'go') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists) return { error: 'gone' };
    if (got.data().pre1 && !got.data().tapped) await ref.update({ tapped: FieldValue.serverTimestamp() });
    return { ok: true };
  }

  // nothing is written ahead any more (his call 2026-11-08: "I won't pay for it - it's okay that the user will wait"; the page
  // types Yotam's lines meanwhile). Kept as a no-op for pages still open from before
  if (op === 'pre') return { ok: true };

  // an answer: kept, then the next question - or, after the last one, the result
  if (op === 'answer') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists) return { error: 'gone' };
    const d = got.data(), steps = d.steps || [], cur = steps[steps.length - 1];
    if (d.result) return { done: true, score: d.result.score, dept: d.result.dept || null };
    // a tapped answer (pick 0-3) or their own words (text - "או כתבו תשובה משלכם", plan cz-sim-r3)
    const text = b.text !== undefined ? clip(String(b.text).replace(/\s+/g, ' ').trim(), 120) : null;
    const pick = text === null ? Number(b.pick) : null;
    if ((text === null && !(pick >= 0 && pick < 4)) || text === '' || answered(cur) || Number(b.n) !== steps.length) return { error: 'step' };
    if (text !== null) cur.free = text; else cur.pick = pick;
    // a question that fills the profile: the tapped answer's value, or what the AI reads in their words (alongside the next question)
    d.vals = d.vals || {}; d.raw = d.raw || {};
    let mapping = null;
    if (cur.field && text === null) d.vals[cur.field] = (cur.v || [])[pick] ?? null;
    if (cur.field && text !== null) { d.raw[cur.field] = text; mapping = about.ids().then((I) => about.mapText(key, cur.field, text, I.worldList.slice(0, WORLDS_OFFERED * 2))); }
    const br = await brainNow(), C = byId(br), host = C[d.host.id] || C[HOSTS[0]];
    const add = (u) => d.u.map((x, i) => x + (u[i] || 0));
    if (steps.length < STEPS) {
      // the branch written in advance (op pre) - waited for up to 6 s while it is still being written (their own words: none, written now)
      let pre = text === null && d.pre && d.pre.n === steps.length ? d.pre : null;
      for (let i = 0; pre && !pre.b[pick] && Date.now() - pre.at < 9000 && i < 15; i++) {
        await new Promise((r) => setTimeout(r, 400));
        const again = (await ref.get()).data().pre;
        pre = again && again.n === steps.length ? again : null;
      }
      let step = pre && pre.b[pick], u = [0, 0, 0];
      const [next, mv] = await Promise.all([step ? null : makeQ(key, host.id, steps, d), mapping]);
      if (next) { step = next.step; u = next.u; }
      if (mapping) d.vals[cur.field] = mv;
      await ref.update({ steps: [...steps, step], vals: d.vals, raw: d.raw, u: add(u), pre: FieldValue.delete() });
      return { n: steps.length + 1, of: STEPS, ...qOut(step), ready: !!(pre && pre.b[pick]) };
    }
    if (mapping) d.vals[cur.field] = await mapping;
    await ref.update({ vals: d.vals, raw: d.raw });
    return finish(key, ref, d, steps, br);
  }

  // "skip to the result" after 3 answers (his ask, 2026-11-06): the result from what they answered so far
  if (op === 'finish') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists) return { error: 'gone' };
    const d = got.data();
    if (d.result) return { done: true, score: d.result.score, dept: d.result.dept || null };
    const steps = (d.steps || []).filter(answered);
    if (steps.length < 3) return { error: 'step' };
    return finish(key, ref, d, steps, await brainNow(), true);
  }

  // the result: the score for anyone; all of it for its owner (signed in - the test sticks to the account here) or once shared
  if (op === 'get') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists) return { error: 'gone' };
    const d = got.data(), user = await who(req);
    let mine = user && (!d.uid || d.uid === user.uid);
    if (mine && !d.uid && d.result) {
      await ref.update({ uid: user.uid, claimed: FieldValue.serverTimestamp() });
      await toFan(user.uid, d.rid, d.result);
      await toProfile(user.uid, d);   // the tourist's answers move into their new profile (only fields still empty)
      d.uid = user.uid;
    } else if (mine && d.result && !d.fullSeen) await ref.update({ fullSeen: FieldValue.serverTimestamp() });
    return { ...view(d, (mine || d.shared) && !!d.result), mine: !!mine };
  }

  // the picture of the mixed simulation - only for its signed-in owner, once, within the day's cap
  if (op === 'image') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const user = await who(req);
    if (!user) return { error: 'auth' };
    const ref = sims.doc(b.rid);
    const go = await db().runTransaction(async (tx) => {
      const g = await tx.get(ref);
      if (!g.exists || !g.data().result || g.data().uid !== user.uid) return { error: 'not_yours' };
      const d = g.data();
      if (d.img) return { img: d.img };
      if (d.imgState === 'making' && Date.now() - (d.imgAt || 0) < 90e3) return { wait: true };
      const capRef = db().collection('verseMeta').doc('simImages'), cap = await tx.get(capRef);
      const c = cap.exists && cap.data().day === day() ? cap.data() : { day: day(), n: 0 };
      if (c.n >= (cap.exists && cap.data().cap ? cap.data().cap : IMG_CAP)) return { error: 'cap' };
      tx.set(capRef, { day: c.day, n: c.n + 1 }, { merge: true });
      tx.update(ref, { imgState: 'making', imgAt: Date.now() });
      return { make: d };
    });
    if (!go.make) return go;
    try {
      const p = await picture(key, b.rid, go.make);
      await ref.update({ img: p.url, imgState: 'ok' });
      return { img: p.url };
    } catch (e) {
      console.error('sim image', b.rid, e.message);
      await ref.update({ imgState: 'failed', imgErr: clip(e.message, 300) });
      return { error: 'image' };
    }
  }

  // the owner shared it: from now the link shows the result to friends (and its WhatsApp preview)
  if (op === 'share') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const user = await who(req), ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists || !user || got.data().uid !== user.uid) return { error: 'not_yours' };
    await ref.update({ shared: true, shares: FieldValue.increment(1), shareVia: FieldValue.arrayUnion(clip(b.via || 'link', 12)) });
    return { ok: true };
  }
  return { error: 'op' };
}

exports.verseSim = onRequest({ region: 'europe-west1', cors: CORS, secrets: [KEY], memory: '512MiB', timeoutSeconds: 120, maxInstances: 10, concurrency: 40 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'post' });
  try {
    const r = await handle(req, res);
    res.status(r && r.error ? (r.error === 'limit' || r.error === 'cap' ? 429 : 400) : 200).json(r);
  } catch (e) {
    console.error('verseSim', req.body && req.body.op, e.message);
    res.status(500).json({ error: 'server' });
  }
});

// Backstage (verseOwner op simStats): the funnel of the last days, from the records themselves
exports.owner = async (op, b) => {
  if (op !== 'simStats') return null;
  const days = Math.min(30, Math.max(1, Number(b.days) || 7));
  const since = Timestamp.fromMillis(Date.now() - days * 864e5);
  const snap = await db().collection('sims').where('created', '>=', since).get();
  const all = snap.docs.map((x) => x.data()).filter((d) => !d.own && !(d.pre1 && !d.tapped && !(d.steps || []).some(answered)));   // written ahead, never tapped = not a start
  const by = {}, drop = Array(STEPS + 1).fill(0);
  let finished = 0, residentsAtStart = 0, claimed = 0, shared = 0, fromShare = 0, imgs = 0;
  for (const d of all) {
    by[d.from || 'other'] = (by[d.from || 'other'] || 0) + 1;
    const n = (d.steps || []).filter(answered).length;
    drop[n]++;
    if (d.result) finished++;
    if (d.resident) residentsAtStart++;
    else if (d.uid) claimed++;
    if (d.shared) shared++;
    if (d.ref) fromShare++;
    if (d.img) imgs++;
  }
  const cap = await db().collection('verseMeta').doc('simImages').get();
  const recent = all.filter((d) => d.result).sort((a, b) => (b.created?.toMillis?.() || 0) - (a.created?.toMillis?.() || 0)).slice(0, 12)
    .map((d) => ({ rid: d.rid, t: d.created?.toMillis?.() || 0, host: d.host?.name, from: d.from, score: d.result.score, dept: d.result.dept || null, name: d.result.name, cast: d.result.cast.map((c) => c.id), img: d.img || null, uid: !!d.uid, shared: !!d.shared }));
  return { days, started: all.length, finished, residentsAtStart, touristsStarted: all.length - residentsAtStart, becameResidents: claimed, shared, fromShare, imgs,
    by, drop, today: { n: cap.exists && cap.data().day === day() ? cap.data().n : 0, cap: (cap.exists && cap.data().cap) || IMG_CAP }, recent };
};

exports._test = { ask, qPrompt, hostMaterial, qInput, rPrompt, rTask, castOffer, opening, Q_SCHEMA, RESULT_SCHEMA, OPEN_SCHEMA, byId, hostText, picture, STEPS, PURPOSE, purposeOf, makeQ, answered, toProfile, handle };
