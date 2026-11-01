// Post a character's story on the Shlomiverse from a Claude session (the same owner op /backstage/ uses).
// Hebrew never goes through the console here, so the story comes as a JSON file:
//   { "char": "hani", "text": "...", "file": "C:/path/cover.jpg", "link": "/hani-games/gan-run/", "label": "לשחק עכשיו",
//     "everyone": false, "notify": true }
//   OWNER_KEY=<his key> node scripts/story.mjs story.json
// file (picture or short clip, up to 30MB), link + label (the button) and everyone (every account hears, not only the
// character's followers - big news only) are optional. link: https://..., a page of this site (/...) or a wiki place (#/c/hani).
// --test posts it to nobody: notify off, and the story is hidden right away (check it in /backstage/ פרסום, then remove).
import fs from 'node:fs';
import path from 'node:path';

const [jsonPath, flag] = process.argv.slice(2);
const KEY = process.env.OWNER_KEY;
if (!jsonPath || !KEY) { console.error('usage: OWNER_KEY=... node scripts/story.mjs story.json [--test]'); process.exit(1); }
const s = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const test = flag === '--test';

const fd = new FormData();
fd.append('char', s.char);
fd.append('text', s.text || '');
fd.append('notify', s.notify === false || test ? 'no' : 'yes');
if (s.link) { fd.append('link', s.link); fd.append('linkLabel', s.label || ''); }
if (s.everyone && !test) fd.append('everyone', 'yes');
if (s.file) fd.append('file', new Blob([fs.readFileSync(s.file)], { type: TYPES[path.extname(s.file).toLowerCase()] }), path.basename(s.file));

const res = await fetch(`${API}?op=story`, { method: 'POST', headers: { authorization: 'Key ' + KEY }, body: fd });
const j = await res.json();
if (!res.ok) { console.error('failed', res.status, j.error, j.message || ''); process.exit(1); }
if (test) await fetch(`${API}?op=hide`, { method: 'POST', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'story', id: j.id, hidden: true }) });
console.log(`posted ${j.id}${test ? ' (test, hidden)' : ''}: ${j.fans} ${j.everyone ? 'accounts' : 'followers'} in the bell, ${j.sent} pushes`);
