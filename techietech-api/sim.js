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

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const KEY = defineSecret('VERSE_SITE_OPENAI_KEY');   // the site's own OpenAI key (Backstage → הוצאות shows its spend; the chat has WIKI_OPENAI_KEY)
const MODEL = 'gpt-5.6-terra';
const IMG_MODEL = 'gpt-image-2.6-flare';
const STEPS = 7;
const MEDIA = 'shlomiverse-media';
const IMG_CAP = 200;          // pictures a day for everyone together (Backstage shows the count)
const STARTS_A_DAY = 25;      // tests a day per visitor / address
// hosts for the home page (a different one each visit) - residents with a strong voice of their own
const HOSTS = ['yotam', 'hani', 'demokratovich', 'rosenblum', 'miriam', 'gilad', 'nahor', 'dorit', 'ayelet', 'vova', 'genz', 'yudit'];
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];

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
const castList = (b) => b.characters.filter((c) => c.tagline).map((c) => `${c.id} | ${c.name} | ${c.world || ''} | ${c.tagline} | ${short(c.brief || c.bio, 110)}`).join('\n');

const GAME = `You run "אתם חיים בסימולציה?" ("Do you live in a simulation?") inside שלומיוורס (the Shlomiverse) - a world of comedy characters shown as real people. The visitors keep writing "we live in a simulation"; this test answers them.
It is like the silly quizzes of the 90s Israeli teen magazines (מעריב לנוער): light, absurd, fast, one thumb. The questions are about THE VISITOR - their habits, reactions, daily-life absurdities, small confessions - never a trivia test about the characters.
Each question visits a DIFFERENT corner of everyday life (mornings, the phone, the family WhatsApp group, food, work or school, sleep, friends, shopping, driving, holidays...) - never two in a row about the same thing - and every other question or so calls back to something they answered before, so no two tests are alike. Write the questions in plain everyday Hebrew anyone gets; the host's own world and words go into their short reaction, and at most a touch of it into a question - never jargon in every line.
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
const Q_SCHEMA = S({ react: str, q: str, a: { type: 'array', items: str, minItems: 4, maxItems: 4 } });
const OPEN_SCHEMA = S({ title: str, line: str, btn: str });
const RESULT_SCHEMA = S({ score: { type: 'integer' }, name: str, verdict: str, cast: { type: 'array', minItems: 2, maxItems: 3, items: S({ id: str, role: str, scene: str }) },
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

const qPrompt = (host, steps) => `${GAME}

The host of this test (write the questions in their voice and world - their references, their jobs, their obsessions - but always about the visitor):
${hostText(host)}`;
function qInput(steps) {
  const done = steps.filter((s) => s.pick !== undefined);
  const lines = done.map((s, i) => `${i + 1}. ${s.react ? `(your reaction before it: ${s.react}) ` : ''}${s.q}\n   answered: ${s.a[s.pick]}`).join('\n');
  const n = done.length + 1;
  return [{ role: 'user', content: `${done.length ? 'The test so far:\n' + lines + '\n\n' : ''}Write question ${n} of ${STEPS}.
- react: ${done.length ? "the host's quick reaction to the last answer, in their voice, up to 9 words (funny, never mean). Every reaction opens differently from your earlier ones; a catchphrase at most twice in the whole test, never in two reactions in a row" : 'empty string'}.
- q: the question, up to 14 words, about the visitor${done.length ? ', building on what they already answered' : ''}.
- a: exactly 4 answers, each up to 6 words, all funny and all tempting - no "correct" one, no "none of the above".${n === STEPS ? ' This is the last question: make it the most absurd one.' : ''}` }];
}

const rPrompt = (b) => `${GAME}

Now the test is over. Decide the result:
- score: an integer 0-100, how much this visitor lives in a simulation - your judgement from the answers, not a formula.
- cast: mix a simulation for THIS visitor from 2 or 3 residents below, from at least 2 different worlds, who fit their answers in a surprising, funny way. For each: id (exactly from the list), role - in Hebrew, up to 8 words, what they do in the visitor's simulation; scene - in English, what they physically do in ONE shared picture (action, prop, place in the frame).
- setting: in English, the one place where the picture happens (it mixes their worlds), one sentence.
- name: the simulation's name in Hebrew, up to 6 words (example of the tone: "מבחן פתע אצל השכן").
- verdict: two short Hebrew lines about the visitor, plural (אתם), funny, separated by a newline (example: "אתם מוקפים באנשים שמסבירים הכול.\\nחבל שאף אחד לא מסביר מה קורה פה.").
- share: one line the visitor posts on their story, first person, gender-neutral (past tense), up to 8 words (example: "קיבלתי סימולציה עם מכתב תלונה.").
- ask: the question to their friends, up to 4 words (example: "מי אצלכם?").

The residents (id | name | world | tagline | who):
${castList(b)}`;

const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const day = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
async function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { return null; }
}
const clip = (s, n) => String(s ?? '').slice(0, n);
const RID = /^[a-z0-9]{10,24}$/;

// what the page may see of a test: a tourist the score; the owner (signed in) or anyone once it was shared - all of it
function view(d, full) {
  const v = { rid: d.rid, host: d.host, score: d.result ? d.result.score : null, done: !!d.result, step: (d.steps || []).filter((s) => s.pick !== undefined).length };
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
    const host = C[b.host] || C[HOSTS[Math.floor(Math.random() * HOSTS.length)]];
    return { host: { id: host.id, name: host.name }, open: await opening(key, host) };
  }

  // a new test: the record + question 1
  if (op === 'start') {
    const br = await brainNow(), C = byId(br);
    const host = C[b.host] || C[HOSTS[0]];
    const ip = hash(ipOf(req)), rate = db().collection('simRate').doc(`${day()}_${ip}`);
    const n = await db().runTransaction(async (tx) => { const g = await tx.get(rate); const k = (g.exists ? g.data().n : 0) + 1; tx.set(rate, { n: k, exp: Timestamp.fromMillis(Date.now() + 2 * 864e5) }); return k; });
    if (n > STARTS_A_DAY) return { error: 'limit' };
    const rid = crypto.randomBytes(9).toString('hex').slice(0, 14);
    const first = await ask(key, qPrompt(host), qInput([]), Q_SCHEMA, 'q-' + host.id, 'none');
    const step = { q: clip(first.out.q, 200), a: first.out.a.map((x) => clip(x, 80)), react: '' };
    const user = await who(req);
    await sims.doc(rid).set({ rid, host: { id: host.id, name: host.name }, from: clip(b.from || '', 20), ref: RID.test(b.ref || '') ? b.ref : null,
      v: clip(String(b.v || '').replace(/[^a-z0-9]/gi, ''), 12), ip, uid: user ? user.uid : null, resident: !!user, own: !!b.own,
      steps: [step], u: first.u, created: FieldValue.serverTimestamp(), day: day() });
    return { rid, n: 1, of: STEPS, ...step, ms: first.ms };
  }

  // while the visitor reads question n, the next question is written for each of its 4 answers (one model call takes 3-4 s,
  // measured 2026-11-06 - with this the next question is there the moment they tap). The page asks for it right after
  // showing a question; the answer takes the ready branch, or writes its own when it isn't there yet.
  if (op === 'pre') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists) return { error: 'gone' };
    const d = got.data(), steps = d.steps || [], n = steps.length;
    if (d.result || n >= STEPS || Number(b.n) !== n || steps[n - 1].pick !== undefined || (d.pre && d.pre.n === n)) return { ok: true };
    await ref.update({ pre: { n, at: Date.now(), b: {} } });
    const br = await brainNow(), C = byId(br), host = C[d.host.id] || C[HOSTS[0]];
    const made = await Promise.all([0, 1, 2, 3].map(async (pick) => {
      try {
        const st = steps.map((x, i) => (i === n - 1 ? { ...x, pick } : x));
        const r = await ask(key, qPrompt(host), qInput(st), Q_SCHEMA, 'q-' + host.id, 'none');
        return { q: clip(r.out.q, 200), a: r.out.a.map((x) => clip(x, 80)), react: clip(r.out.react, 120) };
      } catch (e) { return null; }
    }));
    await ref.update({ pre: { n, at: Date.now(), b: Object.fromEntries(made.map((x, i) => [i, x]).filter(([, x]) => x)) } });
    return { ok: true };
  }

  // an answer: kept, then the next question - or, after the last one, the result
  if (op === 'answer') {
    if (!RID.test(b.rid || '')) return { error: 'rid' };
    const ref = sims.doc(b.rid), got = await ref.get();
    if (!got.exists) return { error: 'gone' };
    const d = got.data(), steps = d.steps || [], cur = steps[steps.length - 1];
    if (d.result) return { done: true, score: d.result.score };
    const pick = Number(b.pick);
    if (!(pick >= 0 && pick < 4) || cur.pick !== undefined || Number(b.n) !== steps.length) return { error: 'step' };
    cur.pick = pick;
    const br = await brainNow(), C = byId(br), host = C[d.host.id] || C[HOSTS[0]];
    const add = (u) => d.u.map((x, i) => x + (u[i] || 0));
    if (steps.length < STEPS) {
      // the branch written in advance (op pre) - waited for up to 6 s while it is still being written
      let pre = d.pre && d.pre.n === steps.length ? d.pre : null;
      for (let i = 0; pre && !pre.b[pick] && Date.now() - pre.at < 9000 && i < 15; i++) {
        await new Promise((r) => setTimeout(r, 400));
        const again = (await ref.get()).data().pre;
        pre = again && again.n === steps.length ? again : null;
      }
      let step = pre && pre.b[pick], u = [0, 0, 0];
      if (!step) {
        const next = await ask(key, qPrompt(host), qInput(steps), Q_SCHEMA, 'q-' + host.id, 'none');
        step = { q: clip(next.out.q, 200), a: next.out.a.map((x) => clip(x, 80)), react: clip(next.out.react, 120) }; u = next.u;
      }
      await ref.update({ steps: [...steps, step], u: add(u), pre: FieldValue.delete() });
      return { n: steps.length + 1, of: STEPS, ...step, ready: !!(pre && pre.b[pick]) };
    }
    const done = await ask(key, rPrompt(br), [{ role: 'user', content: 'The visitor\'s test:\n' + steps.map((s, i) => `${i + 1}. ${s.q}\n   answered: ${s.a[s.pick]}`).join('\n') }], RESULT_SCHEMA, 'result', 'low');
    const o = done.out;
    const cast = o.cast.filter((c, i, a) => C[c.id] && a.findIndex((x) => x.id === c.id) === i).slice(0, 3).map((c) => ({ id: c.id, role: clip(c.role, 80), scene: clip(c.scene, 300) }));
    if (cast.length < 2) for (const id of HOSTS) if (cast.length < 2 && !cast.some((c) => c.id === id) && C[id]) cast.push({ id, role: '', scene: 'stands in the scene looking suspicious' });
    const result = { score: Math.max(0, Math.min(100, Math.round(o.score))), name: clip(o.name, 60), verdict: clip(o.verdict, 200), cast, share: clip(o.share, 80), ask: clip(o.ask, 40), setting: clip(o.setting, 300) };
    await ref.update({ steps, result, u: add(done.u), finished: FieldValue.serverTimestamp() });
    return { done: true, score: result.score, ms: done.ms };
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
      await db().collection('fans').doc(user.uid).set({ sim: { rid: d.rid, name: d.result.name, score: d.result.score, t: Date.now() } }, { merge: true });
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
  const all = snap.docs.map((x) => x.data()).filter((d) => !d.own);
  const by = {}, drop = Array(STEPS + 1).fill(0);
  let finished = 0, residentsAtStart = 0, claimed = 0, shared = 0, fromShare = 0, imgs = 0;
  for (const d of all) {
    by[d.from || 'other'] = (by[d.from || 'other'] || 0) + 1;
    const n = (d.steps || []).filter((s) => s.pick !== undefined).length;
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
    .map((d) => ({ rid: d.rid, t: d.created?.toMillis?.() || 0, host: d.host?.name, from: d.from, score: d.result.score, name: d.result.name, cast: d.result.cast.map((c) => c.id), img: d.img || null, uid: !!d.uid, shared: !!d.shared }));
  return { days, started: all.length, finished, residentsAtStart, touristsStarted: all.length - residentsAtStart, becameResidents: claimed, shared, fromShare, imgs,
    by, drop, today: { n: cap.exists && cap.data().day === day() ? cap.data().n : 0, cap: (cap.exists && cap.data().cap) || IMG_CAP }, recent };
};

exports._test = { ask, qPrompt, qInput, rPrompt, opening, Q_SCHEMA, RESULT_SCHEMA, OPEN_SCHEMA, byId, hostText, picture, STEPS };
