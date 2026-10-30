// the read-aloud teaser with sound: teaser.html frames (render.js) + narration p01-p05 + niggun-freilach ducked under the voice + page / wind / win sounds
//   node promo/render-teaser.js [--skip-video]   -> out/yosef-teaser.mp4
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const FF = 'C:/Users/shazb/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const OUT = path.join(__dirname, 'out'), Y = path.join(__dirname, '..'), HS = path.join(Y, '..', 'hani-sounds');
// same timeline as teaser.html
const DUR = [20.69, 17.4, 16.51, 20.43, 10.92];
const INTRO = 4.5, LEAD = 0.9, TAIL = 1.4, END = 7;
const TL = []; let t = INTRO;
for (let i = 0; i < DUR.length; i++) { TL.push({ start: t, voice: t + LEAD, end: t + LEAD + DUR[i] + TAIL }); t = TL[i].end; }
const END_AT = t, TOTAL = t + END;

if (!process.argv.includes('--skip-video')) execFileSync('node', [path.join(__dirname, 'render.js'), '--page', 'teaser.html', '--out', 'teaser-silent.mp4'], { stdio: 'inherit' });

// sounds: [file, start second, gain]
const S = [];
TL.forEach((p, i) => {
  S.push([path.join(Y, 'assets/audio', `p0${i + 1}.mp3`), p.voice, 1.0]);
  S.push([path.join(Y, 'assets/snd', `page-${(i % 2) + 1}.mp3`), p.start, 0.5]);
});
S.push([path.join(Y, 'assets/snd/gust-1.mp3'), TL[4].voice + 6.2, 0.7]); // "נשבה רוח חזקה"
S.push([path.join(Y, 'assets/snd/gust-2.mp3'), TL[4].voice + 8.4, 0.6]); // "והעיפה את כובעו!"
S.push([path.join(Y, 'assets/snd/whoosh.mp3'), END_AT, 0.6]);
S.push([path.join(Y, 'assets/snd/win-1.mp3'), END_AT + 0.6, 0.45]);

const args = ['-y', '-i', path.join(OUT, 'teaser-silent.mp4'), '-stream_loop', '-1', '-i', path.join(HS, 'niggun-freilach.mp3')];
S.forEach((s) => args.push('-i', s[0]));
const f = [];
S.forEach((s, k) => { const ms = Math.round(s[1] * 1000); f.push(`[${k + 2}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${s[2]},adelay=${ms}|${ms}[s${k}]`); });
f.push(`${S.map((_, k) => `[s${k}]`).join('')}amix=inputs=${S.length}:normalize=0:duration=longest,apad,atrim=0:${TOTAL.toFixed(2)}[fx]`);
f.push('[fx]asplit=2[fxa][fxb]');
// niggun: soft under everything, pressed down whenever someone talks; fade in/out
f.push(`[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${TOTAL.toFixed(2)},volume=0.32,afade=t=in:d=1.2,afade=t=out:st=${(TOTAL - 2).toFixed(2)}:d=2[mu]`);
f.push('[mu][fxa]sidechaincompress=threshold=0.03:ratio=8:attack=40:release=600[duck]');
f.push('[duck][fxb]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]');
args.push('-filter_complex', f.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(OUT, 'yosef-teaser.mp4'));
execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('teaser', path.join(OUT, 'yosef-teaser.mp4'), (fs.statSync(path.join(OUT, 'yosef-teaser.mp4')).size / 1e6).toFixed(1) + ' MB', TOTAL.toFixed(1) + ' s');
