// Writes zoomcut/characters/<id>/profile.md for every character - the same text as the Characters page's
// "Copy profile for a session" (render/ui/character_profile.js), so a session can read a character straight from disk.
//   node tools/character_profiles.mjs            (run after a profile changes; the page itself always builds it live)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { profileText } = await import(pathToFileURL(path.join(ROOT, 'render', 'ui', 'character_profile.js')).href);
const DIR = path.join(ROOT, 'characters'), EPS = path.join(ROOT, 'episodes');
const read = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const ids = fs.readdirSync(DIR).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(DIR, d, 'character.json')));
// a video lists its characters in its project.json (the builders fill it) - the same rule as the page
const inVideo = {};
for (const ep of fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(EPS, d, 'episode.json')))) {
  for (const c of read(path.join(EPS, ep, 'project.json'), {})?.characters || []) (inVideo[c] = inVideo[c] || new Set()).add(ep);
}
const all = ids.map((id) => ({ ...read(path.join(DIR, id, 'character.json'), {}), id }));
for (const c of all) {
  const vids = [...new Set([...(c.videos || []), ...(inVideo[c.id] || [])])].filter((v) => fs.existsSync(path.join(EPS, v)))
    .map((v) => ({ id: v, title: read(path.join(EPS, v, 'episode.json'), {})?.title || v }));
  fs.writeFileSync(path.join(DIR, c.id, 'profile.md'), profileText({ ...c, videos: vids }, all));
}
console.log(`profiles written: ${all.length}`);
