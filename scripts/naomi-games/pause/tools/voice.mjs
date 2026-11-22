// The coach's voice lines: a very calm, very comforting therapist voice (his note: "it doesn't have to be her voice ... a
// therapist voice, very calm, very, very comfort. It will be funny."). ElevenLabs text-to-speech, key from zoomcut/.env.
// Reads SAY from the game, writes public/naomi-games/pause/assets/vo/<key>-<i>.mp3 (the game plays them when present).
//   node scripts/naomi-games/pause/tools/voice.mjs [--voice <id>] [--only start,hit] [--dry]
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../..');
const env = fs.readFileSync(path.join(root, 'zoomcut/.env'), 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim();
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const VOICE = arg('voice', 's0T0DT6EAPeX57MQpn3I');   // "Danit - Natural Israeli Hebrew" (female) on the account
const only = arg('only', '') ? arg('only').split(',') : null, dry = args.includes('--dry');
const game = fs.readFileSync(path.join(root, 'public/naomi-games/pause/game.js'), 'utf8');
const SAY = Function('return ' + game.slice(game.indexOf('const SAY = {') + 12, game.indexOf('};', game.indexOf('const SAY = {')) + 1))();
const OUT = path.join(root, 'public/naomi-games/pause/assets/vo'); fs.mkdirSync(OUT, { recursive: true });
// spoken spelling where the voice misreads the written line (vowel marks); checked by speech-to-text
const SPOKEN = { 'bond-0': 'זה סְקִין טוּ סְקִין רִגְשִׁי.', 'nu-0': 'הַנּוּ שלא כתבתם – הוא עדיין שם.', 'start-1': 'בְּכָל פעם שעולה הדחף לשלוח – קודם כול לעצור.' };
const redo = args.includes('--redo');
let n = 0;
for (const [k, lines] of Object.entries(SAY)) {
  if (only && !only.includes(k)) continue;
  for (let i = 0; i < lines.length; i++) {
    const out = path.join(OUT, `${k}-${i}.mp3`); n++;
    if (dry) { console.log(k, i, lines[i]); continue; }
    if (fs.existsSync(out) && !(redo && SPOKEN[`${k}-${i}`])) continue;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_96`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text: SPOKEN[`${k}-${i}`] || lines[i], model_id: 'eleven_v3', language_code: 'he',
        voice_settings: { stability: 0.85, similarity_boost: 0.75, style: 0.05, use_speaker_boost: true, speed: 0.85 } }),
    });
    if (!r.ok) { console.error('FAIL', k, i, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log('ok', k, i, lines[i]);
  }
}
console.log(n, 'lines');
