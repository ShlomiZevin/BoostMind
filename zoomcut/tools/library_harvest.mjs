// The asset library (his ask, 2026-11-02): every background, piece of music, sound effect and picture made for any
// video, in ONE folder - zoomcut/library/<kind>/ - so nothing is made twice, with what kind of video each one served
// (searchable on the studio's Assets page). Gathered from every project's layers (how a file was USED decides what it
// is: a set layer = background, a music lane = music, other sound lanes = sound effects, image layers = pictures),
// its backgrounds/ folder, and episodes/_assets. His takes and voice recordings are not assets and stay out. Copies
// (the projects keep theirs); the same file twice is one entry. Run again any time: only new files are added.
//   node tools/library_harvest.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EPS, ROOT, readJson } from '../render/cloud/layout.mjs';

const LIB = path.join(ROOT, 'library');
const INDEX = path.join(LIB, 'index.json');
const KINDS = { background: 'backgrounds', music: 'music', sound: 'sounds', picture: 'pictures', video: 'videos' };
const AUDIO = /\.(mp3|wav|m4a|ogg)$/i, IMAGE = /\.(png|jpe?g|webp)$/i, VIDEO = /\.(mp4|mov|webm)$/i;
const DERIVED = /\.(mp3|m4a|ogg|wav)\..+$|\.phone\.|\.clean\.|^his_|_cut\.|_SOURCE|netanyahu|\.tempo/i;  // (processed copies; his own voice; a real person's likeness)

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const probe = (f) => {
  try {
    const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f], { windowsHide: true }).toString());
    const s = (j.streams || []).find((x) => x.width);
    return { ...(s ? { w: s.width, h: s.height } : {}), ...(j.format?.duration && !IMAGE.test(f) ? { dur: +(+j.format.duration).toFixed(2) } : {}) };
  } catch { return {}; }
};
// the kind of video a project is: its series (haredit-2 -> haredit) and how it's made
const seriesOf = (id, p, ep) => ep?.series || (p?.builder?.kind === 'zoom' ? 'zoom' : id.split('-')[0]);  // (every Zoom-call sketch is one series)
const typeOf = (p, ep) => p?.builder?.kind === 'zoom' || ep?.type === 'zoom' ? 'Zoom call' : p?.builder?.kind === 'solo' || ep?.type === 'lesson' ? 'one camera' : 'other';

const index = readJson(INDEX, { items: [] });
const byMd5 = new Map(index.items.map((x) => [x.md5, x]));
let added = 0, seen = 0;
function take(file, kind, ctx = {}) {
  if (!fs.existsSync(file) || DERIVED.test(path.basename(file))) return;
  // (a wav with an mp3 of the same sound next to it: the mp3 - small, the same sound)
  if (/\.wav$/i.test(file) && fs.existsSync(file.replace(/\.wav$/i, '.mp3'))) return;
  seen++;
  const h = md5(file);
  let it = byMd5.get(h);
  if (!it) {
    const base = path.basename(file), dir = path.join(LIB, KINDS[kind]);
    let name = base;
    if (fs.existsSync(path.join(dir, name))) name = base.replace(/(\.[^.]+)$/, `-${h.slice(0, 6)}$1`);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, path.join(dir, name));
    const sidecar = file.replace(/\.[^.]+$/, '.txt');  // (the prompt a generated picture / sound was made from)
    it = { id: h.slice(0, 12), md5: h, kind, file: `${KINDS[kind]}/${name}`, name: base.replace(/\.[^.]+$/, ''), size: fs.statSync(file).size, ...probe(file),
      from: [], series: [], types: [], labels: [], ...(fs.existsSync(sidecar) ? { prompt: fs.readFileSync(sidecar, 'utf8').trim().slice(0, 600) } : {}), added: Date.now() };
    index.items.push(it); byMd5.set(h, it); added++;
  }
  const add = (k, v) => { if (v && !it[k].includes(v)) it[k].push(v); };
  add('from', ctx.project); add('series', ctx.series); add('types', ctx.type); add('labels', ctx.label);
}

// 1. every project: what its layers used
for (const id of fs.readdirSync(EPS).filter((d) => !d.startsWith('_')).sort()) {
  const d = path.join(EPS, id), p = readJson(path.join(d, 'project.json')), ep = readJson(path.join(d, 'episode.json'));
  if (!ep) continue;
  const ctx = { project: id, series: seriesOf(id, p, ep), type: typeOf(p, ep) };
  for (const l of p?.layers || []) {
    const name = `${l.id} ${l.name || ''} ${l.group || ''}`.toLowerCase();
    if (/voice|קול|take|person|cutout|קהל|שירה|crowd|choir|^voc/.test(name) && l.kind !== 'image') continue;  // his takes, his voice lines, the crowd / choir voices made from them, family singing
    for (const it of l.items || []) {
      const a = p.assets?.[it.asset ?? l.props?.asset]; if (!a?.src || a.kind === 'font') continue;
      const f = path.resolve(d, a.src);
      if (/[\\/]work[\\/]/.test(f) && !/[\\/]_assets[\\/]/.test(f)) continue;  // (the studio's own renders of his takes)
      let kind = null;
      if (l.kind === 'audio' && AUDIO.test(f)) kind = /music|מוזיק|bed|beat/.test(name) ? 'music' : 'sound';
      else if ((l.kind === 'image' || l.kind === 'backdrop') && IMAGE.test(f)) kind = l.kind === 'backdrop' || /^set|backdrop|background|רקע|plaque/.test(name) ? 'background' : 'picture';
      else if (l.kind === 'video' && VIDEO.test(f) && /[\\/]_assets[\\/]/.test(f)) kind = 'video';
      if (kind) take(f, kind, { ...ctx, label: a.label });
    }
    if (l.kind === 'backdrop' && p.assets?.[l.props?.asset]?.src) take(path.resolve(d, p.assets[l.props.asset].src), 'background', ctx);
  }
  // a one-camera video's builder draws its set, music and sounds from a prepared copy in work/ - the originals are
  // named in its settings
  if (p?.layers?.length) {
    const at = (s) => s && path.resolve(d, s);
    if (ep.background) take(at(ep.background), 'background', ctx);
    if (ep.music?.sound) take(at(ep.music.sound), 'music', ctx);
    for (const x of [...(ep.sounds || []), ep.intro_sound].filter((x) => x?.sound)) take(at(x.sound), 'sound', ctx);
  }
}
index.at = Date.now();
fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
const count = (k) => index.items.filter((x) => x.kind === k).length;
console.log(`library: ${index.items.length} items (${added} new, from ${seen} files) - ${Object.keys(KINDS).map((k) => `${count(k)} ${KINDS[k]}`).join(', ')}; ${(index.items.reduce((s, x) => s + x.size, 0) / 1e6).toFixed(0)} MB`);
