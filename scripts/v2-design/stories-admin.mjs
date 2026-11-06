// /backstage/ פרסום → סטורי redesign (his note, 2026-11-02: "this page is a mess - should be easy to see past stories,
// how they look, and create story maybe should be a modal on top of this page"). GPT Image 2.5 (OpenAI direct, MEDIUM),
// the current page as the reference. Briefs say WHAT the screen does, not the look (feedback_concept_prompts).
//   node scripts/v2-design/stories-admin.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/admin/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'admin');
const SHOTS = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/7877d1ed-1ed2-4b1b-9b09-cc60652aee71/scratchpad/bio';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const NOW = img(`${SHOTS}/bs-story-desk.png`, 'current-page.png');
const STORY = img(`${SHOTS}/pilai-story.jpg`, 'a-real-story-picture.jpg', 'image/jpeg');

const BASE = `A desktop web app screenshot (no device frame), Hebrew right-to-left, of the private admin page "מאחורי הקלעים" of
"שלומיוורס" - a comedy universe where many characters post short Instagram-like stories (a picture or a short vertical clip,
one line of text, optionally a button with a link such as "לשחק עכשיו"). The first attached image is the CURRENT page: keep
its sidebar on the right, its dark theme and its orange accent exactly; everything else is yours to rethink. The second
attached image is one real story picture (tall 9:16) - use it for one of the stories shown. All Hebrew right-aligned, correctly
spelled, no emoji.`;

const JOBS = [
  ['S1-stories-page', `${BASE}
THE SCREEN: the "סטוריז" section of the admin. Its job: the owner sees at a glance every story that went out and what each
one looked like, and can start a new one. Content: a title "סטוריז" with a primary button "סטורי חדש"; a filter by character
(small faces) and "הכול / פעילים עכשיו (3 ימים) / ישנים / מוסתרים"; then the stories themselves shown AS STORIES - a grid of
tall 9:16 previews, newest first, each showing what a visitor saw (picture or clip, the line, the button if it had one), with
under it: the character's face + name, when it went out, who was notified ("לעוקבים" or "לכל השלומיוורס"), how many saw it,
and a small menu for hide. Stories still live (under 3 days) are marked as live; hidden ones are dimmed. Show ~8 stories of
different characters, a few with only text on a coloured background.`],
  ['S2-new-story-modal', `${BASE}
THE SCREEN: the same stories page dimmed behind a large MODAL window "סטורי חדש" open on top of it. Its job: write a story
and see exactly how it will look before posting. The modal has two parts: a big live phone-size 9:16 preview of the story as a
visitor will see it (the character's face and name at the top, the picture, the line, the orange button), and the form:
who posts it (a searchable row of character faces - there are ~40 characters, so a search box + a scrolling row, not a wall),
the line (one sentence in the character's voice), a picture or short clip (drop zone), an optional button (its text + link),
who hears about it (followers only / the whole Shlomiverse, with the number of people each reaches), and "לפרסם" + "ביטול".`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1536x1024');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of [NOW, STORY]) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
