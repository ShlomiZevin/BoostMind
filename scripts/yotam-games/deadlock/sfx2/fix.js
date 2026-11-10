// raw/*.mp3 -> out/*.mp3: cut the silence before the sound, trim to the length the game needs, fade out, peak -1.5 dB
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const D = __dirname, LEN = { slide: 0.95, bump: 0.5, honk: 0.6, window: 0.85, gate: 3.6, pick: 0.5, start: 3.2, win: 2.0 };
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const vol = (f) => { let e = ''; try { execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (x) { e = String(x.stderr); }
  try { e = e || ''; } catch (x) {} return e; };
const detect = (f) => {
  const r = require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr; return { peak: +(s.match(/max_volume: ([-\d.]+)/) || [])[1], mean: +(s.match(/mean_volume: ([-\d.]+)/) || [])[1] };
};
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
const tmp = path.join(D, 'tmp.wav');
for (const f of fs.readdirSync(path.join(D, 'raw')).filter((f) => f.endsWith('.mp3'))) {
  const n = f.replace('.mp3', ''), base = n.replace(/\d*-[ab]$/, ''), L = LEN[base];
  ff(['-i', path.join(D, 'raw', f), '-af', `silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,atrim=0:${L},afade=t=in:d=0.005,afade=t=out:st=${(L - 0.18).toFixed(2)}:d=0.18`, '-ac', '1', '-ar', '44100', tmp]);
  const v = detect(tmp), g = (-1.5 - v.peak).toFixed(1);
  ff(['-i', tmp, '-af', `volume=${g}dB`, '-b:a', '96k', path.join(D, 'out', f)]);
  const dur = +require('child_process').spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(D, 'out', f)], { encoding: 'utf8' }).stdout;
  console.log(`${n.padEnd(10)} ${dur.toFixed(2)}s peak ${v.peak} mean ${v.mean} -> gain ${g}  (crest ${(v.peak - v.mean).toFixed(1)})`);
}
fs.unlinkSync(tmp);
