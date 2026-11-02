// Into the asset library (zoomcut/library/ + index.json - the studio's Assets page) the moment something is MADE - his
// rule (2026-11-02): every background, music, sound effect, picture, icon, emoji, sticker a session creates goes into
// the editor's assets right away, labelled with everything relevant, so nothing is ever tagged in bulk again.
// Used by tools/leonardo.mjs, tools/elevenlabs_music.mjs and tools/library_add.mjs. The same file twice = one item
// (its labels merged). With the studio online switched on, the file and the index go to the cloud at once.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, EPS, readJson } from '../render/cloud/layout.mjs';

export const LIB = path.join(ROOT, 'library');
export const INDEX = path.join(LIB, 'index.json');
export const KINDS = { background: 'backgrounds', music: 'music', sound: 'sounds', picture: 'pictures', icon: 'icons', video: 'videos' };
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i, AUDIO = /\.(mp3|wav|m4a|ogg)$/i, VIDEO = /\.(mp4|mov|webm)$/i;

const probe = (f) => {
  try {
    const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f], { windowsHide: true }).toString());
    const s = (j.streams || []).find((x) => x.width);
    return { ...(s ? { w: s.width, h: s.height } : {}), ...(j.format?.duration && !IMAGE.test(f) ? { dur: +(+j.format.duration).toFixed(2) } : {}) };
  } catch { return {}; }
};
// what kind of thing a file is, when the maker didn't say: an upright picture = a background, a sound = a sound effect
export function kindOf(file, m = probe(file)) {
  if (AUDIO.test(file)) return 'sound';
  if (VIDEO.test(file)) return 'video';
  if (IMAGE.test(file)) return m.h && m.w && m.h > m.w * 1.3 ? 'background' : 'picture';
  return null;
}
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
// the series of a project (its episode.json, else zoom for a Zoom call, else the id's first word)
const seriesOf = (project) => {
  if (!project) return null;
  const ep = readJson(path.join(EPS, project, 'episode.json')), p = readJson(path.join(EPS, project, 'project.json'));
  return ep?.series || (p?.builder?.kind === 'zoom' || ep?.type === 'zoom' ? 'zoom' : project.split('-')[0]);
};

// labels: {kind, tags, about, series, project, prompt, made: 'leonardo' | 'elevenlabs' | ...}
export async function addToLibrary(file, labels = {}) {
  if (!fs.existsSync(file)) throw new Error('no such file: ' + file);
  const m = probe(file);
  const kind = labels.kind && KINDS[labels.kind] ? labels.kind : kindOf(file, m);
  if (!kind) throw new Error('not a picture / sound / video: ' + file);
  const h = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
  const ix = readJson(INDEX, { items: [] });
  let it = ix.items.find((x) => x.md5 === h), fresh = false;
  if (!it) {
    const base = path.basename(file), dir = path.join(LIB, KINDS[kind]);
    let name = base;
    if (fs.existsSync(path.join(dir, name))) name = base.replace(/(\.[^.]+)$/, `-${h.slice(0, 6)}$1`);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, path.join(dir, name));
    it = { id: h.slice(0, 12), md5: h, kind, file: `${KINDS[kind]}/${name}`, name: base.replace(/\.[^.]+$/, ''), size: fs.statSync(file).size, ...m,
      from: [], series: [], types: [], labels: [], tags: [], added: Date.now() };
    ix.items.push(it); fresh = true;
  }
  const add = (k, vs) => { it[k] = it[k] || []; for (const v of list(vs)) if (!it[k].includes(v)) it[k].push(v); };
  add('tags', labels.tags); add('from', labels.project); add('series', labels.series || seriesOf(labels.project));
  if (labels.about) it.about = String(labels.about).slice(0, 300);
  if (labels.prompt && !it.prompt) it.prompt = String(labels.prompt).trim().slice(0, 600);
  if (labels.made) it.made = labels.made;
  it.unlabelled = !it.tags.length || !it.about;
  ix.at = Date.now();
  fs.mkdirSync(LIB, { recursive: true });
  fs.writeFileSync(INDEX, JSON.stringify(ix, null, 1));
  // the studio online, switched on: the file + the index up now (else the studio sends them once it's on)
  if (readJson(path.join(EPS, '_cloud', 'config.json'), {})?.sync === 'on') {
    try {
      const store = await import('../render/cloud/store.mjs');
      if (fresh) await store.upload(path.join(LIB, it.file), 'library/' + it.file);
      for (let k = 0; k < 3; k++) {
        const c = await store.getJson('library/index.json');
        const by = new Map((c?.v.items || []).map((x) => [x.id, x]));
        by.set(it.id, { ...(by.get(it.id) || {}), ...it });
        if (await store.putJson('library/index.json', { items: [...by.values()], at: Date.now() }, c ? c.gen : '0')) break;
      }
    } catch (e) { console.log('library: not in the cloud yet (' + e.message + ') - the studio sends it later'); }
  }
  return { item: it, fresh };
}

// the line every maker prints: where it went, and - if it has no labels - how to give it some
export function report({ item, fresh }) {
  const where = `library ${fresh ? '+' : '='} ${item.file} (id ${item.id})`;
  if (!item.unlabelled) return `${where} - ${item.about} [${item.tags.join(', ')}]`;
  return `${where} - NO LABELS YET. Label it now (his rule):\n  node tools/library_add.mjs --label ${item.id} --about "<what it is, for which video>" --tags "<mood, place, use, ...>"`;
}

// a maker's own flags: --tags "a, b" --about "..." --project <id> --series <s> --kind <k> --no-library
export function labelFlags(argv) {
  const out = { labels: {}, rest: [], skip: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-library') { out.skip = true; continue; }
    const m = /^--(tags|about|project|series|kind)$/.exec(a);
    if (m) { out.labels[m[1]] = argv[++i]; continue; }
    out.rest.push(a);
  }
  return out;
}
