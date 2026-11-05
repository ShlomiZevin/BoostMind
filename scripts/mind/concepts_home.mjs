// Home of "המוח השני" v2 (his ask, 2026-11-04): ONE list of everything on his table, each kind recognisable at a glance.
// Brief = what it shows and does, not the look. GPT Image 2.5 on OpenAI direct, MEDIUM.
//   node scripts/mind/concepts_home.mjs <out-dir>
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const brief = `PRODUCT: the home screen of a private "second brain" app for ONE busy person (a CTO of two companies who also makes
comedy videos and runs many AI coding agents at once). He found the old dashboard (stat tiles + four boxes) too much.
The new home is radically simple: a greeting, one quick "what's on your mind?" capture line (type or tap a mic), and
then ONE single list of everything currently on his table. Nothing else on the screen.
THE LIST mixes different kinds of things, and each kind must be recognisable at a glance by its own row design (not
just a colour tag), while the list still reads as one calm list:
- an AI agent session ASKING him something (shows the agent's project and its question; the most urgent),
- a to-do / reminder he set himself (can be ticked off; may have a due date like "מחר"),
- an idea (a raw idea for later),
- a thought / note (just something to remember, no action),
- something he waits for from another person,
- a job or agent that is running right now (live, with which project and since when).
Order: what needs him first, then what's running, then ideas and notes. Small filter chips above the list
(all / to-dos / ideas / notes / agents). The interface is HEBREW, right-to-left, all text in Hebrew, realistic
content (projects: Aspect, Lybi, Shlomiverse). A real buildable production UI screenshot, crisp readable text.`;
const shots = [
  ['home-desktop', '1536x1024', `${brief}\nSCREEN: desktop web app, full browser width, dark theme.`],
  ['home-mobile', '1024x1536', `${brief}\nSCREEN: the iPhone version, one phone screen centered on a plain background, dark theme.`],
];
await Promise.all(shots.map(async ([name, size, prompt]) => {
  const res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2.5-sunburst', prompt, size, quality: 'medium', n: 1, output_format: 'jpeg' }) });
  const j = await res.json();
  if (!res.ok) return console.log(name, 'FAILED', res.status, j.error?.message);
  fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(j.data[0].b64_json, 'base64')); console.log(name, 'ok');
}));
