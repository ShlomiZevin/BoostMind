// Design concepts for Shoot (2026-11-03) - his filming app: the iPhone page on the Drop + a tab in Sketch Studio.
// He: "if you need design for it, use OpenAI to design". The brief says WHAT we build (who, jobs, data, moments), never
// how it looks - his rule, or every call returns the same concept. GPT Image 2.5, MEDIUM.
//   node scripts/shoot-design/concepts.mjs [only-key ...]  ->  Documents/shoot-design/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shoot-design';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');

const PRODUCT = `A UI design concept for an app screen, shown as a flat full-screen screenshot (no device frame, no hands).
The product: "Shoot" - a comedian's own filming app. He makes short vertical comedy sketches where he plays many
characters, and every character is a face filter (people say they don't even know what he really looks like). He
films himself with the front camera, reading his script while he films, and each take goes straight to his video
editor's project for that sketch. One person, no social features, no likes, no feed. The UI language is English; the
scripts are Hebrew (right-to-left). Design it the way you think is best for this job.`;

const PHONE_SHOOT = `${PRODUCT}
PHONE screen, the moment of filming: the live camera picture of him with a character filter on his face fills the
screen. He must be able to: see the script lines he is about to say (a teleprompter that scrolls while recording, its
speed and text size adjustable, pause by tapping it) placed so his eyes stay close to the lens; switch between about a
dozen filters quickly (some change his face - big eyes, a mustache, glasses, an alien; some change the colour - noir,
1970s, old TV, comic); start/stop recording with a 3-second countdown; see which project the take will go to; see that
earlier takes are still uploading in the background (e.g. "Sending 2 · 45%"). Show it while recording, at 0:07.
Sample script lines (Hebrew): "מה? שלחו אותך אליי? נו, בסדר." / "זה לא פשוט. מה זה פשוט?" / "לא כל דבר זה פרומפט וגמרנו."`;

const JOBS = [
  ['A-phone-shoot', '1024x1536', 'gpt-image-2.5-sunburst', PHONE_SHOOT],
  ['B-phone-shoot', '1024x1536', 'gpt-image-2.5-flare', PHONE_SHOOT],
  ['C-phone-take', '1024x1536', 'gpt-image-2.5-sunburst', `${PRODUCT}
PHONE screen, the moment right after a take: the take he just filmed plays back (with its filter, about 0:24 long,
file name "shot-112659.mp4", filter "The uncle"). He decides in one tap: send it to the project "tzvika-2" in his
editor (the main choice, it uploads in the background so he can film the next take at once), save it to the phone's
Photos, or throw it away and shoot again (the script goes back to where this take started). Also visible somewhere:
the takes of this session so far for this project (3 sent, 1 uploading).`],
  ['D-desktop-tab', '1536x1024', 'gpt-image-2.5-flare', `${PRODUCT}
DESKTOP screen (16:10): the same Shoot tool as one tab of his video editing studio, a desktop app for editing his
sketches - its other tools are "Video editor", "Reader" (scripts), "Karaoke" and "Assets"; Shoot is selected. Here he
films with the computer's webcam. The picture he records is vertical (9:16) even though the screen is wide. Needed: the
live webcam picture with the filter; the teleprompter close to where the webcam sits; the filter choice; record with
countdown; the project the takes go to and the script it uses (picked from his saved scripts); the list of takes filmed
for this project today with their length and state (in the project / saving), each can be played or deleted; the camera
and microphone picked from a list, with a microphone level.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, size, model, prompt]) => {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, quality: 'medium', n: 1, output_format: 'jpeg' }) });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
