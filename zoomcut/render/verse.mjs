// A finished video -> the Shlomiverse (shlomiverse.com/v/<id>, the wiki, the links page, the chat), through its publish
// API (techietech-api/publish.js, versePublish - his rule 2026-11-05: the list of videos lives in the database, the files
// in storage; nothing depends on what one computer has - a rebuild on a PC missing 20 exports took them off the site).
//   1. the project is marked done
//   2. the web copy + poster from the full export (720p H.264 faststart, a poster at 1.5 s - the old encode.sh's
//      settings), made here into episodes/<id>/work/web/ (free, no cloud)
//   3. both files up through upload sessions the API opens (the studio never writes the media bucket itself)
//   4. the record: cast (the characters who list the video + the project's own), the words (captions.txt, else the
//      script), the series. No title / teaser sent - the API's Terra writes them the first time and keeps them after
//      (a new cut of a published video keeps its title, its date and anything fixed in /backstage/). A character
//      born in this video (no copy in scripts/wiki/copy.json yet) first gets its page: publish_site.py --characters
//      (Terra's copy, build, push)
// Key: VERSE_PUBLISH_KEY (studio-keys -> zoomcut/.env), sent as 'authorization: Key <key>' (a Bearer is taken by
// Google's front door for its own token and refused before the function). Only /backstage/'s hide takes a video off the site.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as verseDb from './verse_db.mjs';

export const VERSE_API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish';

const ffmpeg = (args) => new Promise((ok, fail) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { windowsHide: true });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  p.on('close', (c) => (c ? fail(new Error('ffmpeg: ' + err.trim().slice(-200))) : ok()));
  p.on('error', fail);
});
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

// the spoken words: captions.txt without the '== take' headers, else the script (as scripts/wiki/canon.py reads them)
export function wordsOf(dir) {
  for (const n of ['captions.txt', 'script.txt']) {
    const f = path.join(dir, n);
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => !l.startsWith('==') && !l.startsWith('#')).map((l) => l.trimEnd()).join('\n');
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }
  return '';
}

// the words on the screen (the text layers - a POV hook, labels; not the subtitles, those are the transcript): they
// often carry the joke, so the API's Terra and the chat read them too
export function onScreenOf(dir) {
  const p = readJson(path.join(dir, 'project.json'), {});
  const t = (p.layers || []).filter((l) => l.kind === 'text' && !l.hidden).flatMap((l) => (l.items || []).filter((i) => !i.hidden && i.text).map((i) => String(i.text).replace(/\{clock\}/g, '').trim()));
  return [...new Set(t.filter(Boolean))].join('\n');
}

// the cast: characters whose profile lists the video + the project's own list + who he picked in Send ("On the
// Shlomiverse" - publish.json cast: kept with the post, never written into the project he edits). Known characters only.
// Every video on the Shlomiverse has at least one (his rule, 2026-11-05 - 12 videos with none were on nobody's page).
// detail=true: [{id, name, fixed}] - fixed = listed by a profile / the project (changed there, not in Send)
// (the characters: the database - verse_db.mjs, since 2026-11-06)
export async function castOf(ROOT, id, dir, detail = false) {
  const all = await verseDb.characters(), order = all.map((c) => c.id), ch = Object.fromEntries(all.map((c) => [c.id, c]));
  const listed = order.filter((c) => (ch[c].videos || []).includes(id));
  const own = (readJson(path.join(dir, 'project.json'), {}).characters || []).filter((c) => ch[c]);
  const picked = (readJson(path.join(dir, 'publish.json'), {}).cast || []).filter((c) => ch[c]);
  const ids = [...new Set([...listed, ...own, ...picked])];
  return detail ? ids.map((c) => ({ id: c, name: ch[c].name || c, fixed: listed.includes(c) || own.includes(c) })) : ids;
}

export async function namesOf(ROOT, ids) {
  const all = await verseDb.characters().catch(() => []);
  return ids.map((c) => all.find((x) => x.id === c)?.name || c);
}
// the last trip to the Shlomiverse, kept with the post (publish.json site): Send shows it (where, who - and how the cast was chosen)
export function saveSite(dir, site) {
  const f = path.join(dir, 'publish.json');
  fs.writeFileSync(f, JSON.stringify({ ...readJson(f, {}), site }, null, 2));
}

export function verseApi(key) {
  return async (body) => {
    const r = await fetch(process.env.VERSE_PUBLISH_URL || VERSE_API, { method: 'POST', headers: { authorization: 'Key ' + key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && !j.error) { const e = new Error('the Shlomiverse publish API is not live yet'); e.notLive = true; throw e; }
    if (!r.ok || j.error) throw new Error(`versePublish ${body.op}: ${j.error || r.status}${j.detail ? ' - ' + j.detail : ''}`);
    return j;
  };
}

// one video up. log(line) for the job's log; dryRun = everything but writing the record (the files do go up)
export async function toVerse({ id, dir, ROOT, key, port, log = () => {}, dryRun = false }) {
  const api = verseApi(key);
  const master = path.join(dir, 'out', `${id}.mp4`);
  if (!fs.existsSync(master)) throw new Error(`no full export (out/${id}.mp4) - export it first`);
  if (!dryRun) {
    const cfg = readJson(path.join(dir, 'episode.json'), {});
    if (!cfg.done) {
      await fetch(`http://127.0.0.1:${port}/api/ep/${id}/done`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"done": true}' }).catch(() => {});
      log(`  · ${id} marked done`);
    }
  }
  const web = path.join(dir, 'work', 'web'), mp4 = path.join(web, `${id}.mp4`), jpg = path.join(web, `${id}.jpg`);
  fs.mkdirSync(web, { recursive: true });
  if (!fs.existsSync(mp4) || fs.statSync(mp4).mtimeMs < fs.statSync(master).mtimeMs) {
    const tmp = mp4.replace(/\.mp4$/, '.part.mp4');
    await ffmpeg(['-i', master, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', tmp]);
    fs.renameSync(tmp, mp4);
  }
  await ffmpeg(['-ss', '1.5', '-i', mp4, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', jpg]);
  log(`  · web copy + poster (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB)`);
  for (const [kind, f, type] of [['video', mp4, 'video/mp4'], ['poster', jpg, 'image/jpeg']]) {
    const { uri } = await api({ op: 'uploadUrl', id, kind, contentType: type });
    const r = await fetch(uri, { method: 'PUT', headers: { 'content-type': type }, body: fs.readFileSync(f) });
    if (!r.ok) throw new Error(`upload ${kind}: ${r.status} ${(await r.text()).slice(0, 150)}`);
  }
  log('  · uploaded to the Shlomiverse');
  const cfg = readJson(path.join(dir, 'episode.json'), {});
  const cast = await castOf(ROOT, id, dir);
  const BM = path.resolve(ROOT, '..'), known = readJson(path.join(BM, 'scripts', 'wiki', 'copy.json'), {}).characters || {};
  const born = cast.filter((c) => !known[c]);
  // publish_site.py's characters part (--characters) and its checks of the places it can't reach (--check): python, from BoostMind
  const py = (args) => new Promise((ok, fail) => {
    const ch = spawn('python', ['scripts/wiki/publish_site.py', ...args], { cwd: BM, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    let o = '';
    ch.stdout.on('data', (d) => (o += d)); ch.stderr.on('data', (d) => (o += d));
    ch.on('close', (c) => { const ls = o.split(/\r?\n/).filter((l) => l.trim()); ls.forEach((l) => log(l.trimEnd())); c ? fail(new Error(ls.at(-1) || `failed (${c})`)) : ok(); });
    ch.on('error', fail);
  });
  if (born.length && !dryRun) {
    log(`  · new on the Shlomiverse: ${born.join(', ')} - their page first`);
    await py(['--characters', ...born]).catch((e) => { throw new Error('the new character page failed: ' + e.message); });
  }
  // (no cast here = none sent: the record keeps the one it has, else the API's AI picks it from the words - castBy 'ai')
  const out = await api({ op: 'video', id, ...(cast.length ? { cast } : {}), transcript: wordsOf(dir), ...(onScreenOf(dir) ? { onScreen: onScreenOf(dir) } : {}), ...(cfg.series ? { series: cfg.series } : {}), source: 'studio', ...(dryRun ? { dryRun: true } : {}) });
  if (dryRun) { log(`✔ dry run: "${out.video?.title || ''}" - cast ${out.castBy || '?'}: ${(out.video?.cast || []).join(', ') || 'nobody'} - nothing written`); return out; }
  const live = await api({ op: 'get', id });
  if (!live.live) throw new Error(`written, but ${id} is hidden on the site (/backstage/ סרטונים shows it)`);
  log(`  · "${live.title}"${out.wrote ? ' (title by Terra)' : ''}`);
  const names = await namesOf(ROOT, live.cast || []), by = out.castBy || (cast.length ? 'sent' : 'kept');
  saveSite(dir, { at: Date.now(), url: out.url, title: live.title, cast: live.cast || [], castBy: by });
  if (!names.length) log(`  ! ${id} is on nobody's page - nobody found in it: pick who's in it in Send (On the Shlomiverse)`);
  else if (by === 'ai') log(`  ! the cast was picked by AI from the words: ${names.join(', ')} - check it in Send (On the Shlomiverse)`);
  else log(`  · on the pages of: ${names.join(', ')}`);
  await py(['--check', id]).catch((e) => log('  ! the places check failed: ' + e.message));  // (a portrait, a company card, a character site - '  !' lines)
  log(`✔ on the Shlomiverse: ${out.url}`);
  return out;
}

// node render/verse.mjs <id> [--dry]   - one video up by hand (the studio does it by itself after a Publish; this is
// for one that missed it - the same as POST /api/ep/<id>/site)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.slice(1))) {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
  const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const id = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!id) { console.log('node render/verse.mjs <id> [--dry]'); process.exit(1); }
  if (!env.VERSE_PUBLISH_KEY) { console.log('no VERSE_PUBLISH_KEY in zoomcut/.env (node render/cloud/keys.mjs pull)'); process.exit(1); }
  await toVerse({ id, dir: path.join(process.env.ZC_EPISODES || path.join(ROOT, 'episodes'), id), ROOT, key: env.VERSE_PUBLISH_KEY, port: Number(process.env.PORT || 4747), log: console.log, dryRun: process.argv.includes('--dry') })
    .catch((e) => { console.log('failed: ' + e.message); process.exit(1); });
}
