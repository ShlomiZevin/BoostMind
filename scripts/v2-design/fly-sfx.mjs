// The flight game's sound effects (verse/fly.js, round 3 of his notes 2026-11-07: "the sounds are terrible - different sounds for
// shooting, exploding and everything; it should be immersive"). Real effects instead of the synthesized ones: Leonardo's sound
// effects (ElevenLabs resold - his ask: the ElevenLabs credits are used up this month), one call at a time, through the studio's
// own tool and key (zoomcut/tools/leonardo.mjs --leonardo). Raw files land in the scratchpad; each is then trimmed and
// compressed here (ffmpeg: silence cut, its game length, mono, 40-48 kbps) into v2/site/verse/art/fly-*.mp3.
//   node scripts/v2-design/fly-sfx.mjs [name ...]      (no names = all)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const RAW = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/fly/sfx-raw/';
const ART = 'C:/workspace/BoostMind/v2/site/verse/art/';
const TOOL = 'C:/workspace/BoostMind/zoomcut/tools/leonardo.mjs';
// name: [seconds (Leonardo takes whole seconds), loop?, what it is] - prompts say WHAT the sound is, for a phone game in space
// then each is cut to the length it plays in the game (KEEP, seconds, with a short fade out)
// and levelled (dB, measured with ffmpeg volumedetect): every effect sits together, the shots well under the rest - they play
// three times a second
const GAIN = { 'laser-4': 0, 'laser-5': 0, 'boom-3': 0, 'laser-1': -14, 'laser-2': -6.5, 'laser-3': -12.5, 'boom-1': 0, 'boom-2': -6, hit: -1, life: 7, star: 19, engine: -12, whoosh: -3 };
const KEEP = { 'laser-4': 0.42, 'laser-5': 0.42, 'boom-3': 1.2, 'laser-1': 0.38, 'laser-2': 0.38, 'laser-3': 0.38, 'boom-1': 1.1, 'boom-2': 1.1, hit: 0.9, life: 1.3, star: 0.6, whoosh: 2.0 };
const SFX = {
  'laser-1': [1, false, 'A single short punchy sci-fi blaster shot from a small fighter spaceship, a tight bright "pew" with a quick zap tail, clean, no reverb tail, no music. One shot only.'],
  'laser-2': [1, false, 'One short soft energy laser pulse fired from a spaceship cannon, a crisp electric zip, light and pleasant to hear many times in a row, no music, one shot only.'],
  'laser-3': [1, false, 'One quick plasma bolt shot, a short bright synth zap with a tiny low thump under it, cinematic sci-fi game, no music, one shot only.'],
  // round 4 ("fire and blast are okay, not great"): deeper, more cinematic takes - measured as almost all sub-bass (gone on a
  // phone's speaker), so the game kept laser-2, laser-3 and boom-1; star and life are drawn in code again (his ear, round 4)
  'laser-4': [1, false, 'A deep punchy cinematic sci-fi blaster shot: a heavy bass thump with a bright crisp laser crack on top, like a starfighter cannon in a space movie, very short, dry, no music, one shot only.'],
  'laser-5': [1, false, 'A powerful short space-fighter laser cannon blast, chunky low punch and a sharp electric snap, modern sci-fi movie sound design, no reverb tail, no music, one shot only.'],
  'boom-3': [2, false, 'A chunky cinematic sci-fi explosion: a deep sub-bass boom, a punchy blast and metal debris crackling and scattering, big but short, space battle, no music.'],
  'boom-1': [2, false, 'A satisfying cartoon-cinematic space explosion pop: a balloon-like pop and a punchy burst with sparkly debris crackle, short and fun, arcade game, no music.'],
  'boom-2': [2, false, 'A punchy small sci-fi explosion: a deep thump, a bright crackling burst and glittering sparks fading fast, satisfying arcade space shooter, no music.'],
  'hit': [1, false, 'A heavy metallic impact on a spaceship hull: a hard crunching hit, an energy shield cracking with an electric fizz and a low rumble, alarming, no music.'],
  'life': [2, false, 'A bright magical power-up pickup in a space game: a rising shimmering chime with a soft energy hum, rewarding shield restore sound, no music.'],
  'star': [1, false, 'A tiny sparkling coin-like star pickup chime, a clean high bell twinkle, short and sweet, arcade space game, no music.'],
  'engine': [6, true, 'A smooth low spaceship engine hum, steady deep rumble with a soft airy whoosh, seamless loop, cinematic sci-fi, no music, no beeps.'],
  'whoosh': [2.0, false, 'A big cinematic whoosh of a spaceship accelerating and flying into a planet, rising air rush and a soft deep boom at the end, no music.'],
};
fs.mkdirSync(RAW, { recursive: true });
const only = process.argv.slice(2);
for (const [name, [secs, loop, prompt]] of Object.entries(SFX)) {
  if (only.length && !only.includes(name)) continue;
  const p = RAW + name + '.txt', raw = RAW + name + '.mp3';
  if (!fs.existsSync(raw)) {
    fs.writeFileSync(p, prompt);
    console.log('making', name);
    execFileSync('node', [TOOL, loop ? 'loop' : 'sfx', p, raw, String(secs), '--leonardo', '--no-library'], { stdio: 'inherit' });
  }
  // trim the silence at the start (and the end for one-shots), mono, small
  const k = KEEP[name];
  const af = (loop ? 'aformat=channel_layouts=mono' : `silenceremove=start_periods=1:start_threshold=-45dB,atrim=end=${k},afade=t=out:st=${Math.max(0, k - 0.12).toFixed(2)}:d=0.12,aformat=channel_layouts=mono`) + `,volume=${GAIN[name]}dB,alimiter=limit=0.95`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', af, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', loop ? '40k' : '48k', ART + `fly-${name}.mp3`]);
  console.log('ok', name, fs.statSync(ART + `fly-${name}.mp3`).size);
}
