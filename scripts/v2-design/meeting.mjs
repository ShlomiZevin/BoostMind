// ישיבת זום - mockups for the plan (Shlomi, 2026-11-20): a visitor holds a Zoom meeting with the Techy-Tech team inside the app.
// The engine exists (techietech-api/meeting.js); this is the DESIGN round: 2-3 concepts per screen, published as one plan in
// Backstage (plan id meeting-design). Phone first. Where it lives is open (his note 2026-11-20) - screen 1 explores the way in.
// Concept prompts = WHAT we build (jobs, data, moments, constraints), never how it looks; the emphasis varies between calls.
// gpt-image-2.6 (sunburst / flare), quality MEDIUM, 1024x1536, the design key (scripts/design.env).
//   node scripts/v2-design/meeting.mjs <refs dir> [job-prefix] [--force]
//   refs: amir.jpg ofer.jpg daniel.jpg ronit.jpg gilad.jpg (storage.googleapis.com/shlomiverse-media/wiki/img/c/<id>.jpg),
//         chat.png + amir-page.png (shlomiverse.com/chat and /c/amir at 390x844, the cookie sheet removed)
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/meeting';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
if (!OAI) { console.error('no OPENAI_API_KEY in scripts/design.env (node scripts/design-env.mjs)'); process.exit(1); }
const R = process.argv[2], only = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null, force = process.argv.includes('--force');
const PRICE = { text: 5, image: 8, out: 30 };   // $ per 1M tokens (OpenAI list price, as in scripts/image-cost)
const img = (f) => new Blob([fs.readFileSync(path.join(R, f))], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' });

// the shared brief: the product, the people, the rules - no look words
const BASE = `Design ONE screen of a phone app: portrait, the screen only, edge to edge (no device frame, no hands, no background around it).

The app: the Shlomiverse (שלומיוורס) - a Hebrew, right-to-left phone web app of a comedy world whose residents are played as real people with real lives. Visitors watch their videos, play their games and chat one-on-one with any resident. The attached app screenshot shows the app this lives in (its top bar and its bottom tabs: בית, סרטונים, משחקים, צ'אט, תושבים, קהילה) - the new thing belongs to that same app.

The new feature - "ישיבת זום": a visitor holds a Zoom meeting with several residents at once - the team of טקי-טק, a tech company in this world. Only these five can be in a meeting together; the attached portraits are their REAL faces - show each with exactly his or her own face (never swap faces, never invent other people):
- אמיר - CSO. He runs every meeting and always opens it.
- עופר - VP BD. Agrees with Amir on everything ("חד משמעית").
- דניאל - the tech guy. Gets talked over.
- רונית - COO. Corrects Ofer, checks with the boss.
- גלעד - CEO, the boss. Cuts people off mid-sentence ("מה הביזנס?"). When he is in the meeting he is the one who ends it.
The meeting is text only (no voice, no real video - the residents are on camera as their portraits). The visitor is a guest the team doesn't know. Lines come one at a time; each takes a few seconds to be made, so there is a waiting moment before a resident speaks ("מבטל השתקה…"). The visitor can type any time - typing is a raised hand: the line being said finishes, then the visitor speaks. Nobody but Amir (or Gilad when he is in it) can end the meeting - there is no end button for the visitor.

Text rules: every Hebrew word exactly as given here, right to left, big enough to read. Use only the texts given in this brief (names, labels, lines) - no other words, no placeholder text, no emoji, no English except the job titles CSO, VP BD, COO, CEO.

THIS SCREEN:
`;
const ALL5 = ['amir.jpg', 'ofer.jpg', 'daniel.jpg', 'ronit.jpg', 'gilad.jpg'];
// which attached image is who (round 1 swapped faces when the brief only named files): a legend in the order they are attached
const WHO = { 'amir.jpg': 'אמיר (brown hair, thin glasses)', 'ofer.jpg': 'עופר (grey hair, glasses)', 'daniel.jpg': 'דניאל (black cap, glasses, beard)',
  'ronit.jpg': 'רונית (black bob, big black glasses)', 'gilad.jpg': 'גלעד (bald, glasses)',
  'chat.png': "the app's chat tab today (context only)", 'amir-page.png': "Amir's page in the app today", 'home.png': "the app's home today (context only)" };
// round 1 also invented team members who were not in the room (with someone else's face): each meeting screen names its room
const NAMES = { amir: 'אמיר', ofer: 'עופר', daniel: 'דניאל', ronit: 'רונית', gilad: 'גלעד' };
const legend = (refs, room) => `

The attached images, in order: ${refs.map((r, i) => `${i + 1}) ${WHO[r]}`).join('; ')}.${room ? `
On this call there are exactly ${room.length} team members: ${room.map((id) => NAMES[id]).join(', ')} - plus the guest's own place ("אתם", no photo). No other team member appears anywhere on this screen; each face only with its own name.` : ''}`;
const faces = (room) => room.map((id) => id + '.jpg');

const JOBS = [
  // ---------- 1 · the way in (open: his note - it can be its own tool, not the chat tab) ----------
  // round 2 (2026-11-20, his note "where it lives is open - it can be its own tool"): round 1's 1a landed in the chat tab again
  // (the chat screenshot anchored it) - so 1a gets the home as context and says it is NOT the chat tab
  { name: '1a-own-tool.jpg', refs: ['home.png', ...ALL5], prompt: `The way in. ישיבת זום is its own tool in the app - "the Zoom of the Shlomiverse": NOT inside the one-on-one chat tab and not on a resident's page, a separate thing with its own entry in the app and its own identity. Where that entry lives in the app is yours to propose. This screen is the visitor opening that tool: what it is in one line, the five team members who can be in a meeting, and one action to set up a meeting.
Texts: "ישיבת זום", "פגישה עם כל הצוות של טקי-טק", the five names, the action "לקבוע ישיבה".` },
  { name: '1d-invite.jpg', model: 'gpt-image-2.6-flare', refs: ['home.png', 'amir.jpg', 'ofer.jpg', 'ronit.jpg', 'gilad.jpg'], prompt: `The way in, where the meeting comes to the visitor: Amir invites the visitor to a meeting. An invitation arrives while the visitor is somewhere in the app - the moment of being invited by a resident, who will be on the call, and joining right now or not.
Texts: "אמיר מזמין אותך לישיבת זום", "עם עופר, רונית וגלעד", the actions "להצטרף" and "לא עכשיו".`, room: ['amir', 'ofer', 'ronit', 'gilad'] },
  { name: '1b-team-live.jpg', refs: ['chat.png', ...ALL5], prompt: `The way in, from inside the world. The visitor is browsing the app and finds that the Techy-Tech team is "in a meeting right now" - the company as a place in the world that has meetings going on, and the visitor can walk in as a guest. The moment: noticing the meeting and joining it. Show who is in the room, that Amir runs it, and one action to join.
Texts: "טקי-טק בישיבה עכשיו", "אמיר מנהל את הישיבה", the five names, the action "להצטרף לישיבה".` },
  { name: '1c-amir-page.jpg', refs: ['amir-page.png', 'amir.jpg', 'ofer.jpg', 'ronit.jpg', 'gilad.jpg'], prompt: `The way in from a resident's own page. The attached page is Amir's page in the app (his portrait, name, job, bio, and the action to chat with him one-on-one). Next to chatting one-on-one, his page now offers a second, different thing: joining a meeting he runs with his team. The visitor must see the difference between talking to Amir alone and a meeting with the team.
Texts: "אמיר", "סמנכ\"ל אסטרטגיה וחדשנות (CSO) בטקי-טק", the one-on-one action "לדבר עם אמיר", the new action "להצטרף לישיבה", under it "אמיר, עופר, רונית וגלעד".` },

  // ---------- 2 · choosing who joins ----------
  { name: '2a-pick-roles.jpg', refs: ['chat.png', ...ALL5], prompt: `Choosing who joins the meeting, then starting it. Amir is always in (he runs it) and can't be removed; the visitor picks any of the other four. The job here is knowing what each one brings into the room, so the choice is about the meeting you will get.
Data per person: name, job title, what they do in a meeting:
אמיר · CSO · "מנהל את הישיבה" (always in, fixed)
עופר · VP BD · "מסכים עם אמיר"
דניאל · "הטכנולוגי" · "מנסה להגיד משהו טכני"
רונית · COO · "מתקנת את עופר"
גלעד · CEO · "קוטע ומסיים את הישיבה"
Texts also: the title "מי בישיבה?", the start action "להתחיל את הישיבה".` },
  { name: '2b-pick-room.jpg', model: 'gpt-image-2.6-flare', refs: ['chat.png', ...ALL5], prompt: `The moments before a meeting starts: the visitor puts the room together. Amir is already there waiting (he always runs the meeting); the visitor adds or removes the other four, and sees the meeting as it will be - who will be on the call with them, how many people, and the visitor's own place among them as the guest. Then they start.
Texts: "ישיבת זום · טקי-טק", "אמיר כבר בפנים", the names אמיר, עופר, דניאל, רונית, גלעד, the visitor's own place "אתם", the start action "להתחיל את הישיבה".` },
  { name: '2c-pick-boss.jpg', refs: ['chat.png', ...ALL5], prompt: `Choosing who joins, where the big decision is the boss. Amir is always in. The visitor picks from Ofer, Daniel, Ronit and Gilad - and adding Gilad changes the whole meeting: he cuts people off and he is the one who ends it. The screen makes that choice felt: a meeting with the boss or without him.
Texts: "מי מצטרף?", "אמיר מנהל את הישיבה", the names עופר, דניאל, רונית, גלעד, for Gilad "עם גלעד: הוא קוטע, והוא מסיים", the start action "להתחיל את הישיבה".` },

  // ---------- 3 · the meeting live: Amir speaking, Gilad cutting him off ----------
  // round 2: a line shows up ON the speaker's own tile (his rule) - round 1 drew three chat lists
  { name: '3a-live-tiles.jpg', refs: ['chat.png', ...faces(['amir', 'ofer', 'ronit', 'gilad'])], room: ['amir', 'ofer', 'ronit', 'gilad'], prompt: `The meeting, live. The emphasis: the people are the stage. Each line appears on the tile of the person saying it, one line at a time, and the visitor watches the faces talk to each other. The moment: Amir's line was cut off in the middle and Gilad has just started talking.
On Amir's tile, stopped: "בואו נבין איך אנחנו מייצרים סינרגיה—"
On Gilad's tile, now: "רגע. מה הביזנס?"
The visitor can type at any time: the field "לכתוב לישיבה…". The meeting name "ישיבת זום · טקי-טק".` },
  { name: '3b-live-transcript.jpg', model: 'gpt-image-2.6-flare', refs: ['chat.png', 'amir.jpg', 'ofer.jpg', 'ronit.jpg', 'gilad.jpg'], prompt: `The meeting, live. In the room: Amir, Ofer, Ronit, Gilad and the visitor (the guest, "אתם"). The emphasis: reading. The meeting moves fast and people come in mid-way through, so what everyone said so far must be easy to follow and scroll back, while it stays clear it is a call with people on camera and who is talking right now.
What was said so far:
אמיר: "טוב, שמח שכולם פה. ברוך הבא לאורח שלנו."
עופר: "חד משמעית."
רונית: "עופר, הוא עוד לא אמר כלום."
אמיר: "אז בואו נבין איך אנחנו מייצרים סינרגיה—" (cut off mid-sentence)
גלעד: "רגע. מה הביזנס?" (talking now)
The visitor's field "לכתוב לישיבה…". The meeting name "ישיבת זום · טקי-טק".` },
  // round 3: without the app screenshot round 2 drew another app (and a wrong title on Daniel) - back with it, the floor-holder big
  { name: '3c-live-speaker.jpg', refs: ['chat.png', ...faces(['amir', 'daniel', 'ronit', 'gilad'])], room: ['amir', 'daniel', 'ronit', 'gilad'], prompt: `The meeting, live, in "speaker view": whoever has the floor fills the screen; everyone else on the call, the visitor included, stays visible but small. The emphasis: the interruption is the moment - the floor is being taken right now: Amir was in the middle of a sentence and Gilad cut in, so the big place has just passed from Amir to Gilad. The visitor should feel the cut: whose words stopped where, and who grabbed the floor.
Amir's line, stopped: "בואו נבין איך אנחנו מייצרים סינרגיה—"
Gilad, now (the big one): "רגע. מה הביזנס?"
The notice of the cut: "גלעד קטע את אמיר". Job titles: אמיר CSO, רונית COO, גלעד CEO, דניאל without a title. The visitor's field "לכתוב לישיבה…". The meeting name "ישיבת זום · טקי-טק".` },
  // ---------- 4 · the guest's turn: raised hand, and a resident unmuting ----------
  { name: '4a-raised-hand.jpg', refs: ['chat.png', ...faces(['amir', 'ofer', 'ronit', 'gilad'])], room: ['amir', 'ofer', 'ronit', 'gilad'], prompt: `The meeting, live: the visitor raises a hand. Ronit is in the middle of her line; the visitor has started typing, which raises their hand - the line being said finishes, then it is the visitor's turn. The visitor must know their hand is up and that they are next, without losing what Ronit is saying. Each line appears on the tile of the person saying it.
Ronit, now: "עופר, זה לא מה שגלעד אמר. אני אבדוק איתו."
What the visitor is typing: "רגע, אפשר שאלה?"
Status: "היד שלכם מורמת - אתם הבאים אחרי רונית". The meeting name "ישיבת זום · טקי-טק".` },
  { name: '4b-unmuting.jpg', model: 'gpt-image-2.6-flare', refs: ['chat.png', ...faces(['amir', 'ofer', 'daniel'])], room: ['amir', 'ofer', 'daniel'], prompt: `The meeting, live: the visitor just spoke, and Daniel is about to answer. His line takes several seconds to be made, so this waiting moment is a real moment of the meeting - the call is alive and everyone sees Daniel is about to talk. Each line appears on the tile of the person saying it.
The visitor just said: "דניאל, אתה יכול להסביר מה המוצר עושה?"
On Daniel's tile: "מבטל השתקה…"
The field "לכתוב לישיבה…". The meeting name "ישיבת זום · טקי-טק".` },
  // ---------- 5 · the meeting ended ----------
  { name: '5a-ended.jpg', refs: ['chat.png', ...faces(['amir', 'ofer', 'ronit', 'gilad'])], room: ['amir', 'ofer', 'ronit', 'gilad'], prompt: `The meeting just ended - the boss ended it, not the visitor. Gilad's last line closed it, and the call is over. The moment should land as the end of the joke; then the visitor's next steps.
Gilad's last line: "טוב, סיימנו. אין פה ביזנס."
The notice: "גלעד סיים את הפגישה". Next actions: "ישיבה חדשה", "לדבר עם גלעד", "לשתף את הישיבה".` },
  // round 3: round 2 misspelled סיים and ביזנס and invented a heading - fewer, bigger words
  { name: '5b-ended-recap.jpg', model: 'gpt-image-2.6-flare', refs: ['chat.png', ...faces(['amir', 'ofer', 'ronit', 'gilad'])], room: ['amir', 'ofer', 'ronit', 'gilad'], prompt: `After the meeting: Gilad ended it. The emphasis: what the visitor takes away - who was in the meeting, how long it lasted, the line of the meeting worth remembering, and what to do next.
Texts, exactly and only these: "גלעד סיים את הפגישה"; the names with their titles; "12 דקות"; "השורה של הישיבה"; the line: "רגע. מה הביזנס?" with "גלעד" under it; the actions "ישיבה חדשה", "לדבר עם אחד מהם", "לשתף".` },
];

const costFile = path.join(OUT, 'cost.json');
const spent = fs.existsSync(costFile) ? JSON.parse(fs.readFileSync(costFile, 'utf8')) : {};
async function run(j) {
  const file = path.join(OUT, j.name);
  if (!force && fs.existsSync(file)) return console.log(j.name, 'exists');
  const f = new FormData();
  const model = j.model || 'gpt-image-2.6-sunburst';
  f.append('model', model); f.append('prompt', BASE + j.prompt + legend(j.refs, j.room)); f.append('size', '1024x1536');
  f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg');
  for (const r of j.refs) f.append('image[]', img(r), r);
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const r = await res.json();
  if (!res.ok) return console.log(j.name, 'FAILED', res.status, r.error?.message);
  const u = r.usage || {}, d = u.input_tokens_details || {};
  const usd = ((d.text_tokens || 0) * PRICE.text + (d.image_tokens || 0) * PRICE.image + (u.output_tokens || 0) * PRICE.out) / 1e6;
  fs.writeFileSync(file, Buffer.from(r.data[0].b64_json, 'base64'));
  spent[j.name] = (spent[j.name] || 0) + usd;
  fs.writeFileSync(costFile, JSON.stringify(spent, null, 1));
  console.log(j.name, 'ok', model, `${Math.round((Date.now() - t0) / 1000)}s`, '$' + usd.toFixed(3));
}
const todo = JOBS.filter((j) => !only || j.name.startsWith(only));
for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(run));
console.log('total so far $' + Object.values(spent).reduce((a, b) => a + b, 0).toFixed(3));
