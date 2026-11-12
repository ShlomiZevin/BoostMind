// Post a character's story on the Shlomiverse from a Claude session (the same owner op /backstage/ uses) - or fix one
// that is already up. Read zoomcut/skill/verse-story/SKILL.md first: the words go in boxes, checked with
// scripts/stories/preview.mjs before anything is posted.
// Hebrew never goes through the console here, so the story comes as a JSON file:
//   { "char": "hani", "text": "the line in the bell / push", "boxes": [ { "t": "...", "x": 50, "y": 78, ... } ],
//     "file": "C:/path/story.jpg", "link": "/hani-games/gan-run/", "label": "לשחק עכשיו", "everyone": false, "notify": true }
//   OWNER_KEY=<his key> node scripts/story.mjs story.json            post it (followers hear; everyone = every account)
//   OWNER_KEY=<his key> node scripts/story.mjs story.json --test     post it to nobody, hidden at once (check, then remove)
//   OWNER_KEY=<his key> node scripts/story.mjs story.json --edit <id> fix a story that is up, nobody is told again:
//     only the keys the JSON has change - boxes ([] = no words on it), text, link + label ("link": "" = no button), file
// file (picture or short clip, up to 30MB), link + label (the button) and everyone (every account hears, not only the
// character's followers - big news only) are optional. link: https://..., a page of this site (/...) or a wiki place.
// A clip: made story-ready first if it isn't (scripts/stories/video.mjs - H.264, under 25 MB, its cover picture), and its
// cover goes with it ("poster": "C:/path/cover.jpg" to choose another; with --edit, "poster" alone replaces the cover).
// A clip is also a video: it joins the latest videos and the character's page (Terra titles it from the words; "videoTitle"
// to choose). "videoId": "<id>" = the clip is already a video on the site (published from the studio, or another cut):
// the character joins its cast instead of a second copy. "toVideos": false = a story only. --test never makes a video.
import fs from 'node:fs';
import path from 'node:path';
import { prepare } from './stories/video.mjs';

const [jsonPath, flag, editId] = process.argv.slice(2);
const KEY = process.env.OWNER_KEY;
if (!jsonPath || !KEY || (flag === '--edit' && !editId)) { console.error('usage: OWNER_KEY=... node scripts/story.mjs story.json [--test | --edit <id>]'); process.exit(1); }
const s = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const test = flag === '--test', edit = flag === '--edit';

// A button to a game ALWAYS opens the game's own page (/<folder>/<slug>/) - never the verse's play address
// (/play/<id>, #/play/<id>): from inside a story that address loaded the game BEHIND the story, which stayed open, so
// the button looked dead (Techy-Tech meetings stories, 12 Nov 2026 - his "this is important, make sure it won't happen
// again"). The verse opens a game page in its own play view by itself.
if (s.link) {
  const m = String(s.link).match(/^(?:https?:\/\/(?:www\.)?shlomiverse\.com)?\/?#?\/?play\/([^/?#]+)/i);
  if (m) {
    const wiki = await (await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json?cb=' + Date.now())).json();
    const g = (wiki.games || []).find((x) => x.id === m[1]);
    if (!g || !g.url) { console.error(`link ${s.link}: no live game "${m[1]}" in the verse - give the game page (/<folder>/<slug>/)`); process.exit(1); }
    const to = new URL(g.url).pathname;
    console.log(`link ${s.link} -> ${to} (a game button opens the game page, never /play/)`);
    s.link = to;
  }
}

const fd = new FormData();
const blob = (p) => new Blob([fs.readFileSync(p)], { type: TYPES[path.extname(p).toLowerCase()] });
if (s.file && /\.(mp4|mov|m4v|webm)$/i.test(s.file)) {
  const r = prepare(s.file);
  console.log(`clip: ${r.duration}s, ${r.w}x${r.h}, ${r.mb} MB, ${r.audio ? 'with sound' : 'no sound'} (from ${r.from.codec} ${r.from.mb} MB)`);
  s.file = r.file;
  s.poster ||= r.poster;
}
const file = () => {
  if (s.file) fd.append('file', blob(s.file), path.basename(s.file));
  if (s.poster) fd.append('poster', blob(s.poster), path.basename(s.poster));
};
if (edit) {
  fd.append('id', editId);
  if ('boxes' in s) fd.append('boxes', JSON.stringify(s.boxes || []));
  if ('text' in s) fd.append('text', s.text || '');
  if ('keepClear' in s) fd.append('keepClear', JSON.stringify(s.keepClear || []));
  if ('link' in s) { if (s.link) { fd.append('link', s.link); fd.append('linkLabel', s.label || ''); } else fd.append('noLink', 'yes'); }
  file();
  const res = await fetch(`${API}?op=storyEdit`, { method: 'POST', headers: { authorization: 'Key ' + KEY }, body: fd });
  const j = await res.json();
  if (!res.ok) { console.error('failed', res.status, j.error, j.message || ''); process.exit(1); }
  console.log(`fixed ${j.id}: ${j.changed.join(', ')} (nobody was told again)`);
  process.exit(0);
}
fd.append('char', s.char);
fd.append('text', s.text || '');
if (s.boxes) fd.append('boxes', JSON.stringify(s.boxes));
if (s.keepClear) fd.append('keepClear', JSON.stringify(s.keepClear));   // the viewer keeps the name bar / button off them
fd.append('notify', s.notify === false || test ? 'no' : 'yes');
if (s.link) { fd.append('link', s.link); fd.append('linkLabel', s.label || ''); }
if (s.everyone && !test) fd.append('everyone', 'yes');
if (test || s.toVideos === false) fd.append('toVideos', 'no');
if (s.videoId) fd.append('videoId', s.videoId);
if (s.videoTitle) fd.append('videoTitle', s.videoTitle);
file();

const res = await fetch(`${API}?op=story`, { method: 'POST', headers: { authorization: 'Key ' + KEY }, body: fd });
const j = await res.json();
if (!res.ok) { console.error('failed', res.status, j.error, j.message || ''); process.exit(1); }
if (test) await fetch(`${API}?op=hide`, { method: 'POST', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'story', id: j.id, hidden: true }) });
console.log(`posted ${j.id}${test ? ' (test, hidden)' : ''}: ${j.fans} ${j.everyone ? 'accounts' : 'followers'} in the bell, ${j.sent} pushes`);
if (j.video) console.log(j.video.error ? `the video did not go to the catalog: ${j.video.error}` : `video ${j.video.made ? 'made' : 'joined'}: https://shlomiverse.com/v/${j.video.id} - "${j.video.title}" (${(j.video.cast || []).join(', ')})`);
