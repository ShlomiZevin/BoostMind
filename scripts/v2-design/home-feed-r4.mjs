// Shlomiverse /new, round 4 (Shlomi, 2026-11-16): "if this is going to be our home screen it has to be much, much better, much
// cleaner, much easier to see. Maybe some darkness, and the video behind it. Use the image model to design." Round 3's lesson
// stays (never buttons laid over a busy video). This round the brief says WHAT the screen does and lets the model design the
// look (his rule: brief what we build, never the look). HIGH quality - this is a design exploration, not a layout check.
//   node scripts/v2-design/home-feed-r4.mjs <dir with posters> [only-key ...]  ->  Documents/shlomiverse-v2-design/home-feed-r4/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/home-feed-r4';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const POSTER = img(path.join(IN, 'haredit-5-dialogue.jpg'), 'video.jpg');
const FACES = ['hani', 'osnat', 'yotam'].map((id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`));

const BRIEF = `Design the HOME SCREEN of a phone web app, as a world-class product designer would for a top consumer app.
Deliver one flat, full-screen phone screenshot, 9:16, no device frame, no hand. Hebrew, right-to-left.

THE PRODUCT: "שלומיוורס" - a comedy universe. A comedian plays dozens of characters in short vertical comedy videos; the site
treats the characters as real people: you can watch their videos, chat with each character (they answer in character), comment,
and play games about them. Most visitors arrive from TikTok or Instagram on their phone, a few seconds after a video, and today
30% of them leave without tapping anything. This screen has to make the first tap obvious and inviting.

WHAT THE SCREEN DOES (all of it must be there, nothing more):
- It is a feed: one video per screen, swipe up for the next. The video plays (muted, "tap for sound").
- Three sections to switch between: "סרטונים", "משחקים", "צ'אט".
- For the video on screen: its title ("חני באה להחזיר שבעה שקלים ועשרים"), who is in it (the three attached faces: "חני פרידמן",
  "אסנת", "יותם"), ONE clear action to talk with the characters of this video ("לדבר עם הדמויות" - it opens a window to pick who),
  the comments ("12 תגובות" - where you can write to everyone or to one of the characters), games ("משחקים"), share.
- The app's navigation: בית, דמויות, סרטונים, קהילה, צ'אט.

MUST: very clean and calm, instantly readable, big touch targets, obvious what is a button and what is the video. Nothing
important may sit on top of busy video content where it can't be read. Brand: the attached logo (use it as is, small), warm
orange #ff6a1f as the single accent, a dark theme. The video picture is the attached image, used exactly as it is (a vertical
phone video with burned-in Hebrew subtitles). Faces are the attached portraits. No emoji, no hearts, no likes. Spell all Hebrew
exactly as given.`;

const JOBS = [
  ['1-cinematic', `${BRIEF}

DIRECTION FOR THIS CONCEPT (his own idea): darkness, with the video behind - a cinematic screen where the video is present behind
a dark veil / spotlight, and the few things to tap are calm and clear in front of it. You decide exactly how.`],
  ['2-calm-card', `${BRIEF}

DIRECTION FOR THIS CONCEPT: the calmest possible version - the video as a beautiful object of its own, with generous space, and
everything else quiet and secondary except the one main action. You decide exactly how.`],
  ['3-designer-choice', `${BRIEF}

DIRECTION FOR THIS CONCEPT: your own best idea - the layout you believe would make the most visitors tap within three seconds,
while staying clean. Surprise us, but keep every required element. You decide exactly how.`],
];
const only = process.argv.slice(3);
for (const [key, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of [LOGO, POSTER, ...FACES]) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key, j.usage ? `in ${j.usage.input_tokens} out ${j.usage.output_tokens}` : '');
}
