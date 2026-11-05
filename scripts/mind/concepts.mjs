// Design concepts for "Mind" - Shlomi's one place for everything in his head and every Claude session working for him
// (his ask, 2026-11-04). GPT Image 2.5 on OpenAI direct, MEDIUM. The brief says WHAT we build, never the look
// (feedback: brief the product, or every call returns the same concept).
//   node scripts/mind/concepts.mjs <out-dir>
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });

const product = `PRODUCT: a private personal "second brain" web app for ONE person - a busy CTO who runs two companies' tech and a
comedy studio at the same time, and who works all day with many AI coding agents (Claude Code sessions) running in
parallel on two computers. Everything running through his head lands here, and every AI session reports here, so he
always knows what is going on and nothing is forgotten.
THE DATA IT SHOWS:
- Items he captures in one second (typed or by voice): each has a TYPE he controls (Idea, To-do, Running job, Thought,
  Waiting-on-someone - he can add his own types, each with its own colour), a STATUS (Open / In progress / Waiting for
  you / Done / Parked), a PROJECT (e.g. "Shlomiverse", "Aspect", "Lybi", "Wholos"), optional pin, and a timeline of
  updates. An item can be "being handled by" an AI session - shown with the session's name and live state.
- AI SESSIONS: a live roster of every coding agent: project, computer (Desktop / Laptop), what it was asked, its last
  words, state (Working now / Your turn - waiting for you / Stuck / Finished), how long ago, which items it handles.
  The most important signal on the whole screen: which sessions and items are WAITING FOR HIM right now.
THE JOBS: capture a thought instantly; see at a glance what needs him now; filter by type, project, status; open an
item to read its history; jump back to a session that did something for him days ago and he forgot about.
The interface language is HEBREW (right-to-left) - all UI text in Hebrew. A real, buildable, production UI screenshot,
not a poster, no device frame unless stated, crisp readable text, realistic content.`;

const shots = [
  ['desktop-a', '1536x1024', `${product}\nSCREEN: the desktop web app home, full browser-width screenshot.`],
  ['desktop-b', '1536x1024', `${product}\nSCREEN: the desktop web app home with an item opened in a side panel showing its timeline of session updates. Full browser-width screenshot.`],
  ['mobile-a', '1024x1536', `${product}\nSCREEN: the iPhone version, two phone screens side by side on a plain background: the home screen, and the quick-capture sheet open with the keyboard / voice button.`],
  ['mobile-b', '1024x1536', `${product}\nSCREEN: the iPhone version, two phone screens side by side on a plain background: the AI sessions roster, and one item's detail.`],
];
await Promise.all(shots.map(async ([name, size, prompt]) => {
  const res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST',
    headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2.5-sunburst', prompt, size, quality: 'medium', n: 1, output_format: 'jpeg' }) });
  const j = await res.json();
  if (!res.ok) return console.log(name, 'FAILED', res.status, j.error?.message);
  fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(name, 'ok');
}));
