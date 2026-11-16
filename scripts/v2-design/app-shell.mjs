// Shlomiverse as an APP (Shlomi, 2026-11-16): "the bottom bar on every page and every tab, looking like an app's bottom bar,
// and an app's top bar; the current homepage is okay - keep it; add games to the bottom; videos = a feed of videos where we still
// see the bottom bar and all the video features; games = a feed too; very clear that you can move between tabs". /new removed.
// Brief = WHAT each screen does (his rule); the model designs the look. Phone only, RTL. gpt-image-2.6-sunburst, high.
//   node scripts/v2-design/app-shell.mjs <dir with live.png + posters> [only-key ...]  ->  Documents/shlomiverse-v2-design/app-shell/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const HOME = img(path.join(IN, 'live.png'), 'current-home.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`);

const APP = `Design for a PHONE app (a web app that must feel exactly like a native mobile app). Deliver one flat full-screen phone
screenshot, portrait, no device frame, no hand. Hebrew, right-to-left (start = right).
THE PRODUCT: "שלומיוורס" - a comedy universe: a comedian plays dozens of characters in short vertical comedy videos; the app treats
the characters as real people - you watch their videos, chat with them (they answer in character), play games about them.
THE APP SHELL, the same on EVERY screen (this is the heart of the brief):
- a TOP BAR like a real app's: the attached logo small on the right, then compact icon buttons (search, notifications bell) and the
  account (an orange "כניסה" pill for visitors). Slim, solid, calm.
- a BOTTOM TAB BAR like a real app's (think of the best native apps): five tabs, each an icon above a short label, the active one
  clearly highlighted in orange: "בית", "סרטונים", "משחקים", "צ'אט", "דמויות" (right to left in that order). It must be obvious at a
  glance that these are tabs you can move between. Safe-area padding at the bottom.
Brand: the attached logo, a dark theme, warm orange #ff6a1f as the single accent. Faces are the attached portraits. No emoji, no
hearts, no likes. Spell all Hebrew exactly as given. Everything a button must look tappable; nothing important may sit unreadable
on top of busy video content.`;

const JOBS = [
  ['1-home-shell', [HOME, LOGO], `${APP}

THIS SCREEN: the HOME tab ("בית" active). Keep the home EXACTLY as in the attached screenshot "current-home" (the owner likes it:
the big logo card, the line "כל הדמויות. כל הסרטונים. ואפשר לדבר עם כולן.", the question box "שאלו משהו, או @ לדמות", the purple
simulation card "בואו לבדוק באיזו סימולציה אתם חיים?", the row "מי עונה?" with faces) - only REPLACE its top bar and bottom bar with
the new app shell described above. Show how the shell makes it look and feel like a native app.`],
  ['2-videos-feed', [LOGO, img(path.join(IN, 'haredit-5-dialogue.jpg'), 'video.jpg'), face('hani'), face('osnat'), face('yotam')], `${APP}

THIS SCREEN: the VIDEOS tab ("סרטונים" active) - a vertical FEED: one video per screen, swipe up for the next, between the top bar and
the bottom tab bar (both stay visible). The video (the attached image, used exactly as it is - a vertical phone video with burned-in
Hebrew subtitles) plays muted until tapped. The video's own features must be there as clear real buttons, readable, not lost on the
picture: comments ("12" - you can write to everyone or to one of the characters, who answers), a sticker of the moment ("סטיקר"),
save ("שמירה"), share ("שיתוף"), download ("הורדה"), follow the character, and talk to the characters of this video ("לדבר עם
הדמויות" - opens a window to pick who). Also the title "חני באה להחזיר שבעה שקלים ועשרים" and who is in it (the three attached faces:
"חני פרידמן", "אסנת", "יותם"). Make it clean and calm - a strong hierarchy, the video stays the hero.`],
  ['3-games-feed', [LOGO, img(path.join(IN, 'game.jpg'), 'game.jpg'), face('hani')], `${APP}

THIS SCREEN: the GAMES tab ("משחקים" active) - a vertical FEED of games: one game per screen, swipe up for the next, between the top
bar and the bottom tab bar (both visible). The game on screen: its art (the attached image "game.jpg", used as it is), the title
"דלת של שבת", one line "חני צריכה להספיק להיכנס לפני שהדלת נסגרת", whose game it is (Hani's attached face, "חני פרידמן"), a very
clear big "לשחק" button, and today's best score line "השיא היום: 2,340". A hint that more games are one swipe away.`],
  ['4-chat-tab', [LOGO, face('yotam'), face('hani'), face('savta'), face('demokratovich'), face('rosenblum')], `${APP}

THIS SCREEN: the CHAT tab ("צ'אט" active) - a conversation with a character, between the top bar and the bottom tab bar (both stay
visible, so you can always move to another tab). At the top of the chat area a row of the characters' faces to switch who you talk
to (the attached faces: "יותם", "חני פרידמן", "סבתא", "הרב דמוקרטוביץ", "המורה רוזנבלום"; Yotam selected). The conversation: the
visitor asked "יותם, מה אתה עושה בחיים?" and Yotam (his face by the bubble) answered "אני System Architect של החיים. כרגע אני
מארכט את ארוחת הצהריים שלי, ויש בעיה בסקיילינג.". At the bottom, above the tab bar, the message box "כתבו ליותם..." with a send button
and a small line "נשארו 3 שאלות לתיירים".`],
];
const only = process.argv.slice(3);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
