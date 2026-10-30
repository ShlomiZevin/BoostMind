// the launch teaser with sound: teaser.html frames (render.js) + narration snippets + niggun-freilach ducked under the voice + hits/sounds.
// Everything timed from teaser-tl.json (the page reads the same file).
//   node promo/render-teaser.js [--skip-video]   -> out/yosef-teaser.mp4
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const FF = 'C:/Users/shazb/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const OUT = path.join(__dirname, 'out'), Y = path.join(__dirname, '..'), HS = path.join(Y, '..', 'hani-sounds');
const TL = JSON.parse(fs.readFileSync(path.join(__dirname, 'teaser-tl.json'), 'utf8')), TOTAL = TL.total;

const DRAFT = process.argv.includes('--draft'), NAME = DRAFT ? 'yosef-teaser-draft.mp4' : 'yosef-teaser.mp4';   // --draft: 12 fps, half size - for review first
if (!process.argv.includes('--skip-video')) execFileSync('node', [path.join(__dirname, 'render.js'), '--page', 'teaser.html', '--out', 'teaser-silent.mp4', ...(DRAFT ? ['--fps', '12', '--draft'] : [])], { stdio: 'inherit' });

const args = ['-y', '-i', path.join(OUT, 'teaser-silent.mp4'), '-stream_loop', '-1', '-i', path.join(HS, 'niggun-freilach.mp3')];
const f = [], lab = [];
let k = 2;
for (const c of TL.clips) {   // { f (under yosef/), from?, to?, at, tempo?, gain? }
  args.push('-i', path.join(Y, c.f)); const ms = Math.round(c.at * 1000), chain = [];
  if (c.raw) {}   // already cut by build-teaser.js
  else if (c.to != null) chain.push(`atrim=${c.from || 0}:${c.to}`, 'asetpts=PTS-STARTPTS', `afade=t=out:st=${(c.to - (c.from || 0) - 0.08).toFixed(2)}:d=0.08`);
  else chain.push('silenceremove=start_periods=1:start_threshold=-45dB');
  if (c.tempo) chain.push(`atempo=${c.tempo}`);
  chain.push('aformat=sample_rates=44100:channel_layouts=stereo', `volume=${c.gain || 1}`, `adelay=${ms}|${ms}`);
  f.push(`[${k}:a]${chain.join(',')}[c${k}]`); lab.push(`[c${k}]`); k++;
}
for (const [name, at, g] of TL.sfx) {
  args.push('-i', path.join(Y, 'assets/snd', name + '.mp3')); const ms = Math.round(at * 1000);
  f.push(`[${k}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${g},adelay=${ms}|${ms}[c${k}]`); lab.push(`[c${k}]`); k++;
}
f.push(`${lab.join('')}amix=inputs=${lab.length}:normalize=0:duration=longest,apad,atrim=0:${TOTAL}[fx]`);
f.push('[fx]asplit=2[fxa][fxb]');
// niggun: present (it's a trailer), pressed down under the voice and the hits; fade out at the end
f.push(`[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${TOTAL},volume=0.45,afade=t=in:d=0.4,afade=t=out:st=${(TOTAL - 1.5).toFixed(2)}:d=1.5[mu]`);
f.push('[mu][fxa]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=400[duck]');
f.push('[duck][fxb]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]');
args.push('-filter_complex', f.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', path.join(OUT, NAME));
execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('teaser', path.join(OUT, NAME), (fs.statSync(path.join(OUT, NAME)).size / 1e6).toFixed(1) + ' MB', TOTAL + ' s');
