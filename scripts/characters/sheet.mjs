// A character's sheet (Backstage → דמויות, his ask 2026-11-11: "describe the person, what's funny, the parody, the nuance, the
// dissonance, the nuances - like I brief ChatGPT before writing a script; personality, not examples - people, not replicas") + their life,
// one event per video. Terra writes a draft from the live record and their videos; --put writes it to the record (versePublish
// put, logged). The chat's chain answers from the sheet; he shapes it later with notes in Backstage.
//   node scripts/characters/sheet.mjs hani yotam            drafts into scripts/characters/work/<id>.json (read them)
//   node scripts/characters/sheet.mjs --all [--missing] [--skip=a,b] [--budget=2]   every visible character (--missing: only
//                                                            those without a sheet; --budget: no new call once the drafts cost $2)
//   node scripts/characters/sheet.mjs --put hani yotam       the drafts in work/ -> the records (--put --all: every draft there)
// The design key (scripts/design.env), so Backstage → הוצאות counts it as the verse's. Terra: ~3-5K tokens in, ~2K out a character.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = path.join(ROOT, 'scripts', 'characters', 'work');
const MODEL = 'gpt-5.6-terra', PRICE = { in: 2, out: 12 };   // $ per 1M tokens
const args = process.argv.slice(2), has = (f) => args.includes(f), ids = args.filter((a) => !a.startsWith('--'));
fs.mkdirSync(WORK, { recursive: true });

const env = (f, k) => (fs.readFileSync(f, 'utf8').match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const tmp = (n) => path.join(WORK, n);
function content(cmdArgs) { return execFileSync('node', [path.join(ROOT, 'scripts', 'verse', 'content.mjs'), ...cmdArgs], { encoding: 'utf8' }); }

// how central a character is, as a first guess he corrects with a click (videos made with them)
const loveGuess = (n) => (n >= 20 ? 8 : n >= 10 ? 7 : n >= 4 ? 6 : n >= 2 ? 5 : 4);

const BRIEF = `You write a character sheet, in Hebrew, for a recurring character from Shlomi Zevin's comedy universe (the Shlomiverse - short TikTok/Instagram sketches, the characters treated as real people). A chat on the site answers visitors in this character's voice from the sheet, so the sheet must make the model become a PERSON, not copy lines.

His rules:
- People, not replicas. Describe the person - who they are, their inner logic, what they want, how they see the world - so the model can react to anything in a new way. Personality, not examples: no lists of quotes or situations; at most one tiny example in a whole section, only if nothing else explains it.
- "funny" must really explain what is funny about THIS character - the comic mechanism (the gap, the blindness, the logic taken one step too far), why the audience laughs - not a list of jokes.
- Be precise (מדויק): short, dense, concrete. No generic praise ("charming", "hilarious"). Never name the actor or call them a character/sketch/parody inside person/speech.
- Keep every fact from the material (names, family, ages, job, places). Never invent big facts (family, deaths, scandals). Hebrew grammar in the character's gender.
- A child or a minor family member who isn't meant to be funny: "funny" says what makes them real and lovable in the story instead; parody may be "".

Sections (Hebrew strings):
- person: 4-7 sentences - who this person is.
- speech: 2-4 sentences - how they talk: register, rhythm, sentence length, the kind of words (not a list of their phrases).
- funny: 3-6 sentences - the comic mechanism.
- parody: 1-3 sentences - what in real life this mirrors and pokes at.
- dissonance: 1-3 sentences - the core gap/contradiction the comedy lives on.
- nuances: a list of 3-6 short items - the subtle details that make them real (a habit, a sensitivity, a small rule they live by), one line each, about who they are, not scenes.
- catchphrases: 0-5 catchphrases or signature lines (רפליקות). A catchphrase is what they say again and again: pick ONLY from REPEATING PHRASES below (said in several of their videos), written exactly as there, and only ones this character says (not someone else in the scene). None fits - return fewer, even none. Never invent, never take a line said once.
- life: their life, one event per video in VIDEOS (same order, every video, keep the id): what happened to them in it, one sentence, as an event in their life (not "in the video"). If they only appear briefly, say what their part was.

Answer JSON only: {"person": "...", "speech": "...", "funny": "...", "parody": "...", "dissonance": "...", "nuances": ["..."], "catchphrases": ["..."], "life": [{"v": "<video id>", "e": "..."}]}`;

// what they really say again and again (his note 2026-11-11: Hani's catchphrases were wrong - "it's the words and phrases that
// appear a lot in the scripts"): 2-5 word phrases in more than one of their videos (or 3+ times in their only one)
const norm = (t) => String(t).replace(/[^\p{L}\p{N}'"׳״\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
function repeating(vids) {
  const seen = new Map();
  for (const v of vids) {
    if (!v.transcript) continue;
    const w = norm(v.transcript).split(' ').filter(Boolean), here = new Map();
    for (let n = 2; n <= 5; n++) for (let i = 0; i + n <= w.length; i++) { const p = w.slice(i, i + n).join(' '); here.set(p, (here.get(p) || 0) + 1); }
    for (const [p, k] of here) { const x = seen.get(p) || { vids: 0, times: 0 }; x.vids++; x.times += k; seen.set(p, x); }
  }
  const many = vids.filter((v) => v.transcript).length > 1;
  const list = [...seen].filter(([p, x]) => (many ? x.vids >= 2 : x.times >= 3) && p.replace(/\s/g, '').length >= 5)
    .sort((a, b) => b[1].vids - a[1].vids || b[1].times - a[1].times || b[0].length - a[0].length);
  // the longest form wins ("חסדי השם" inside "איזה חסדי השם" is listed once)
  const out = [];
  for (const [p, x] of list) { if (out.some(([q]) => q.includes(p))) continue; out.push([p, x]); if (out.length >= 40) break; }
  return out;
}

async function draft(c, brain, key) {
  const vids = (brain.characters.find((x) => x.id === c.id)?.videos || []).map((id) => brain.videos.find((v) => v.id === id)).filter(Boolean)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const record = Object.fromEntries(['name', 'aka', 'world', 'role', 'tagline', 'brief', 'bio', 'personality', 'speech', 'behavior', 'comedy', 'catchphrases', 'themes', 'writing_rules', 'dont', 'look', 'relations']
    .filter((k) => c[k] != null && !(Array.isArray(c[k]) && !c[k].length)).map((k) => [k, c[k]]));
  let words = '', budget = 9000;   // their own words, newest first - for how they really talk
  for (const v of [...vids].reverse()) { if (!v.transcript || budget <= 0) continue; const t = v.transcript.slice(0, Math.min(2500, budget)); words += `\n--- ${v.title}\n${t}`; budget -= t.length; }
  const rep = repeating(vids);
  const input = `${BRIEF}\n\nREPEATING PHRASES (phrase | in how many of their videos | times):\n${rep.map(([p, x]) => `${p} | ${x.vids} | ${x.times}`).join('\n') || '(none - so no catchphrases)'}\n\nTHE RECORD (what we know):\n${JSON.stringify(record)}\n\nVIDEOS (id | date | title | what happens):\n${vids.map((v) => `${v.id} | ${v.date || ''} | ${v.title} | ${(v.card || v.teaser || '').replace(/\s+/g, ' ')}`).join('\n') || '(none yet)'}\n\nTHEIR OWN WORDS (transcripts, newest first):${words || ' (none)'}`;
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input, reasoning: { effort: 'low' }, text: { format: { type: 'json_object' } }, max_output_tokens: 6000, store: false }) });
  if (!r.ok) throw new Error(`${c.id}: openai ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text = (j.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content).find((x) => x.type === 'output_text')?.text || '{}';
  const a = JSON.parse(text);
  const dates = Object.fromEntries(vids.map((v) => [v.id, v.date || '']));
  const life = (a.life || []).filter((x) => dates[x.v] !== undefined && x.e).map((x) => ({ v: x.v, d: dates[x.v], e: x.e }));
  const u = j.usage || {};
  return { id: c.id, sheet: { person: a.person || '', speech: a.speech || '', funny: a.funny || '', parody: a.parody || '', dissonance: a.dissonance || '', nuances: (a.nuances || []).slice(0, 6), catchphrases: (a.catchphrases || []).filter((x) => !vids.some((v) => v.transcript) || vids.some((v) => norm(v.transcript).includes(norm(x)))).slice(0, 5) },   // only what is really in their scripts
    love: c.love || loveGuess(vids.length), life, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0 } };
}

if (has('--put')) {
  const files = (has('--all') ? fs.readdirSync(WORK).filter((f) => f.endsWith('.json')) : ids.map((i) => i + '.json'));
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'));
    const patch = tmp(`_patch-${d.id}.json`);
    fs.writeFileSync(patch, JSON.stringify({ sheet: d.sheet, love: d.love, life: d.life }), 'utf8');
    content(['put', 'character', d.id, '--file', patch]);
    fs.unlinkSync(patch);
    console.log('put', d.id);
  }
} else {
  const key = env(path.join(ROOT, 'scripts', 'design.env'), 'OPENAI_API_KEY');
  if (!key) { console.error('no design key - node scripts/design-env.mjs'); process.exit(1); }
  content(['list', 'character', '--full', '--out', tmp('_chars.json')]);
  const chars = JSON.parse(fs.readFileSync(tmp('_chars.json'), 'utf8')).items.filter((c) => !c.hidden);
  // the chat's own brain: the videos with their cards and transcripts
  execFileSync('gcloud', ['storage', 'cp', 'gs://shlomiverse-private/wiki-brain.json', tmp('_brain.json'), '--project=boostmind-b052c'], { stdio: 'ignore', shell: process.platform === 'win32' });   // gcloud.cmd on Windows
  const brain = JSON.parse(fs.readFileSync(tmp('_brain.json'), 'utf8'));
  const skip = new Set((args.find((a) => a.startsWith('--skip=')) || '').slice(7).split(',').filter(Boolean));
  const todo = chars.filter((c) => (has('--all') || ids.includes(c.id)) && !skip.has(c.id) && !(has('--missing') && c.sheet?.person));
  let tin = 0, tout = 0, done = 0;
  const cap = Number((args.find((a) => a.startsWith('--budget=')) || '').slice(9)) || Infinity;   // $: no new call once the drafts so far cost this
  const spent = () => (tin * PRICE.in + tout * PRICE.out) / 1e6;
  const queue = [...todo];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      if (spent() >= cap) { console.log(`budget $${cap} reached - stopping, ${queue.length} left`); queue.length = 0; break; }
      const c = queue.shift();
      try {
        const d = await draft(c, brain, key);
        fs.writeFileSync(path.join(WORK, c.id + '.json'), JSON.stringify(d, null, 1), 'utf8');
        tin += d.usage.in; tout += d.usage.out; done++;
        console.log(`${done}/${todo.length} ${c.id} - life ${d.life.length}`);
      } catch (e) { console.error('FAILED', c.id, e.message); }
    }
  }));
  for (const f of ['_chars.json', '_brain.json']) fs.rmSync(tmp(f), { force: true });
  console.log(`drafts in ${WORK} - tokens in ${tin}, out ${tout}, about $${((tin * PRICE.in + tout * PRICE.out) / 1e6).toFixed(2)}`);
}
