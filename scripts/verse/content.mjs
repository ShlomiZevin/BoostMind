// The Shlomiverse's content door for a session on any computer (the shlomiverse-content skill): every change goes to the
// database through versePublish (techietech-api/content.js) and is live in seconds - nothing from git, no deploy.
//
//   node scripts/verse/content.mjs get <kind> <id> [--out f.json]       the record as it is live
//   node scripts/verse/content.mjs list <kind> [--full]                every id (kind: character | series | game | site | video); --full = whole records
//   node scripts/verse/content.mjs profile <id> --out p.md             a character's profile for a writing session (what profile.md was -
//                                                                      the database is the only copy of the characters since 2026-11-06)
//   node scripts/verse/content.mjs put <kind> <id> --file patch.json   set the fields in the file (Hebrew: ALWAYS through a file)
//   node scripts/verse/content.mjs put <kind> <id> --set color=#ff7a45 --set order=12   (ASCII values only)
//   node scripts/verse/content.mjs put <kind> <id> --clear site        empty a field on purpose (the only way to blank one)
//   node scripts/verse/content.mjs hide <kind> <id> | show <kind> <id>  take it off the site / bring it back
//   node scripts/verse/content.mjs portrait <id> <image>               a character's face: cropped 4:5 from the top, 480x600
//   node scripts/verse/content.mjs log [kind] [id] [--limit 50]        who changed what, when, the value before
//   node scripts/verse/content.mjs rebuild                             compose the site and the chat again
// Answers are written to --out (default: printed). Hebrew in the console turns into ????, so read Hebrew from --out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish';
const BY = `${os.hostname()} content.mjs${process.env.MIND_SESSION ? ' ' + process.env.MIND_SESSION.slice(0, 8) : ''}`;
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf('--' + n); return i < 0 ? undefined : argv[i + 1]; };
const flags = (n) => argv.flatMap((a, i) => (a === '--' + n ? [argv[i + 1]] : []));
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i && argv[i - 1].startsWith('--')));

function key() {
  const env = path.join(ROOT, 'zoomcut', '.env');
  const m = fs.existsSync(env) && fs.readFileSync(env, 'utf8').match(/^VERSE_PUBLISH_KEY=(.+)$/m);
  if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  return execSync('gcloud secrets versions access latest --secret=VERSE_PUBLISH_KEY --project=boostmind-b052c', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}
async function api(body) {
  const r = await fetch(API, { method: 'POST', headers: { authorization: 'Key ' + key(), 'content-type': 'application/json' }, body: JSON.stringify({ by: BY, ...body }) });
  const j = await r.json().catch(() => ({ error: 'http ' + r.status }));
  if (!r.ok || j.error) { console.error(`versePublish ${body.op}: ${j.error || r.status}${j.detail ? ' - ' + j.detail : ''}`); process.exit(1); }
  return j;
}
function out(j) {
  const f = flag('out');
  if (f) { fs.writeFileSync(f, JSON.stringify(j, null, 1), 'utf8'); console.log('written to', f); } else console.log(JSON.stringify(j, null, 1));
}

// every computer that sends content gets the Shlomiverse's skills (zoomcut/skill/*) linked into ~/.claude/skills, so its
// sessions know the rules (the shlomiverse-content skill) - travels by git, no installer
function linkSkills() {
  try {
    const home = path.join(os.homedir(), '.claude', 'skills'), from = path.join(ROOT, 'zoomcut', 'skill');
    fs.mkdirSync(home, { recursive: true });
    for (const s of fs.readdirSync(from)) {
      const to = path.join(home, s);
      if (!fs.existsSync(path.join(from, s, 'SKILL.md')) || fs.existsSync(to)) continue;
      fs.symlinkSync(path.join(from, s), to, process.platform === 'win32' ? 'junction' : 'dir');
      console.log(`  · skill ${s} linked on this computer`);
    }
  } catch (e) { console.log('  ! skills not linked: ' + e.message); }
}
linkSkills();

const [cmd, kind, id] = pos;
if (cmd === 'get') out(await api({ op: 'get', kind, id }));
else if (cmd === 'list') out(await api({ op: 'list', kind, full: argv.includes('--full') }));
else if (cmd === 'profile') {   // pos[1] is the id here
  const { profileText } = await import(pathToFileURL(path.join(ROOT, 'zoomcut', 'render', 'ui', 'character_profile.js')).href);
  const all = (await api({ op: 'list', kind: 'character', full: true })).items
    .map(({ site, site_notes, ...c }) => ({ ...c, ...(site || site_notes ? { site: { url: site || '', notes: site_notes || '' } } : {}) }));
  const c = all.find((x) => x.id === kind);
  if (!c) { console.error(`no character "${kind}"`); process.exit(1); }
  const text = profileText(c, all), f = flag('out');
  if (f) { fs.writeFileSync(f, text, 'utf8'); console.log('written to', f); } else console.log(text);
}
else if (cmd === 'rebuild') out(await api({ op: 'rebuild' }));
else if (cmd === 'log') out(await api({ op: 'log', kind, id, limit: +(flag('limit') || 30) }));
else if (cmd === 'hide' || cmd === 'show') out(await api({ op: 'hide', kind, id, hidden: cmd === 'hide' }));
else if (cmd === 'put') {
  const body = flag('file') ? JSON.parse(fs.readFileSync(flag('file'), 'utf8')) : {};
  for (const s of flags('set')) { const [k, ...v] = s.split('='); const val = v.join('='); body[k] = /^-?\d+(\.\d+)?$/.test(val) ? +val : val; }
  out(await api({ op: 'put', kind, id, ...body, ...(flags('clear').length ? { clear: flags('clear') } : {}) }));
} else if (cmd === 'portrait') {
  const [, cid, img] = pos;
  if (!cid || !img || !fs.existsSync(img)) { console.error('portrait <character id> <image file>'); process.exit(1); }
  const tmp = path.join(os.tmpdir(), `portrait-${cid}.jpg`);
  // the same crop as build.py's portrait(): 4:5 from the top (faces sit high in his frames), 480x600
  execFileSync('python', ['-c', `import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); w, h = im.size
im = im.crop(((w - int(h * .8)) // 2, 0, (w - int(h * .8)) // 2 + int(h * .8), h)) if w / h > .8 else im.crop((0, 0, w, int(w / .8)))
im.resize((480, 600), Image.LANCZOS).save(sys.argv[2], quality=84)`, img, tmp]);
  const { uri } = await api({ op: 'uploadUrl', id: cid, kind: 'portrait', contentType: 'image/jpeg' });
  const r = await fetch(uri, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: fs.readFileSync(tmp) });
  if (!r.ok) { console.error('upload failed', r.status); process.exit(1); }
  const c = await api({ op: 'rebuild' });
  console.log(`portrait of ${cid} is live (the site composed: ${c.characters} characters)`);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}
