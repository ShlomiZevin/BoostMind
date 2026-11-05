// A clip made ready for a story (his ask, 2026-11-05 - Hani's comic-book teaser is the first video story):
//   node scripts/stories/video.mjs <clip> [--at <seconds>] [--out <dir>]
// writes next to it (or into --out):
//   <name>.story.mp4   H.264 + AAC, at most 1080x1920 and 30 fps, the moov atom first (it starts playing at once), under
//                      25 MB (the upload's ceiling is 30) - plays on every phone, also an iPhone .mov (HEVC) that Android
//                      can't play
//   <name>.poster.jpg  its cover: the clip's first real moment (not a black fade-in frame), or the moment --at gives -
//                      shown while it loads, blurred around it, and the picture in the push
// and prints what it made as JSON. scripts/story.mjs runs it by itself for a clip that isn't ready yet.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 25 * 1024 * 1024;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString();

export function probe(file) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]));
  const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio');
  const rot = Math.abs(Number(v?.tags?.rotate || v?.side_data_list?.find((d) => d.rotation != null)?.rotation || 0)) % 180 === 90;
  return { duration: Number(j.format.duration) || 0, bytes: Number(j.format.size) || fs.statSync(file).size, w: rot ? v?.height : v?.width, h: rot ? v?.width : v?.height,
    vcodec: v?.codec_name, acodec: a?.codec_name || null, fps: v?.avg_frame_rate };
}

// already story-ready: our own output, or an H.264/AAC mp4 small enough and not bigger than 1080x1920
const ready = (file, p) => /\.story\.mp4$/i.test(file) || (/\.mp4$/i.test(file) && p.vcodec === 'h264' && (!p.acodec || p.acodec === 'aac') && p.bytes <= MAX_BYTES && Math.max(p.w, p.h) <= 1920 && Math.min(p.w, p.h) <= 1080);

export function prepare(input, { at = null, out = null } = {}) {
  const dir = out || path.dirname(input), stem = path.basename(input).replace(/(\.story)?\.[^.]+$/, '');
  fs.mkdirSync(dir, { recursive: true });
  const src = probe(input);
  if (!src.duration) throw new Error('not a video: ' + input);
  const mp4 = path.join(dir, stem + '.story.mp4'), poster = path.join(dir, stem + '.poster.jpg');
  // made already (preview.mjs, then story.mjs): the same files, unless the clip or the cover moment changed
  const fresh = (f) => fs.existsSync(f) && fs.statSync(f).mtimeMs >= fs.statSync(input).mtimeMs;
  if (path.resolve(mp4) !== path.resolve(input) && at == null && fresh(mp4) && fresh(poster)) return made(mp4, poster, src);
  const fit = "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p";
  const audio = src.acodec ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : ['-an'];
  const encode = (rate) => run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vf', fit, '-fpsmax', '30', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow',
    ...(rate ? ['-b:v', rate + 'k', '-maxrate', rate + 'k', '-bufsize', 2 * rate + 'k'] : ['-crf', '22', '-maxrate', '5000k', '-bufsize', '10000k']),
    ...audio, '-movflags', '+faststart', mp4]);
  if (ready(input, src)) fs.copyFileSync(input, mp4);
  else {
    encode(null);
    // still too big for the upload: the bitrate that fits 25 MB over its length (a little under, for the container)
    if (fs.statSync(mp4).size > MAX_BYTES) encode(Math.max(400, Math.floor((MAX_BYTES * 8 * 0.92) / src.duration / 1000) - (src.acodec ? 128 : 0)));
  }
  // the cover: the moment asked for, else the most typical frame of the first seconds after any black fade-in
  const t = at != null ? Math.min(Number(at), Math.max(0, src.duration - 0.1)) : Math.min(0.4, src.duration / 4);
  const pick = at != null ? ['-frames:v', '1'] : ['-vf', 'thumbnail=' + Math.max(2, Math.round(Math.min(4, src.duration) * 25)), '-frames:v', '1'];
  try { run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, ...pick, '-q:v', '3', poster]); }
  catch (e) { run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-q:v', '3', poster]); }
  return made(mp4, poster, src);
}
function made(mp4, poster, src) {
  const m = probe(mp4);
  return { file: mp4, poster, duration: Math.round(m.duration * 10) / 10, mb: Math.round((m.bytes / 1048576) * 10) / 10, w: m.w, h: m.h, audio: !!m.acodec,
    from: { w: src.w, h: src.h, codec: src.vcodec, mb: Math.round((src.bytes / 1048576) * 10) / 10 } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const at = opt('--at'), out = opt('--out'), input = args[0];
  if (!input) { console.error('usage: node scripts/stories/video.mjs <clip> [--at <seconds>] [--out <dir>]'); process.exit(1); }
  const r = prepare(input, { at, out });
  console.log(JSON.stringify(r, null, 1));
  if (r.mb > 28) { console.error('still over 28 MB - shorten the clip'); process.exit(1); }
  const ratio = r.h / r.w;
  if (ratio < 1.6) console.error(`note: ${r.w}x${r.h} is not tall - it shows with the blurred cover around it (9:16 fills the screen)`);
}
