// The coach's voice lines: a warm, empathic, very calm therapist (his notes: "a therapist voice, very calm, very, very
// comforting. It will be funny." / round 2: "the voice is terrible, robotic ... read the ElevenLabs annotation, do it with
// emotions"). ElevenLabs Eleven v4 (Hebrew) with AUDIO TAGS - a bracketed delivery note before each line ([warm, gentle],
// [sighs], [exhales], [softly], [pause]) - and LOW stability for emotional range (high stability = monotone/robotic).
// Reads SAY from the game, writes public/naomi-games/pause/assets/vo/<key>-<i>.mp3 (the game plays them when present).
//   node scripts/naomi-games/pause/tools/voice.mjs [--voice <id>] [--model eleven_v4] [--only start,hit] [--redo] [--dry]
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../..');
const env = fs.readFileSync(path.join(root, 'zoomcut/.env'), 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim();
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const VOICE = arg('voice', 's0T0DT6EAPeX57MQpn3I');   // "Danit - Natural Israeli Hebrew" (female) on the account
const MODEL = arg('model', 'eleven_v4');
const ids = arg('ids', '') ? arg('ids').split(',') : null, seed = Number(arg('seed', 0)) || undefined;
const only = arg('only', '') ? arg('only').split(',') : null, dry = args.includes('--dry'), redo = args.includes('--redo');
const game = fs.readFileSync(path.join(root, 'public/naomi-games/pause/game.js'), 'utf8');
const SAY = Function('return ' + game.slice(game.indexOf('const SAY = {') + 12, game.indexOf('};', game.indexOf('const SAY = {')) + 1))();
const OUT = path.join(root, 'public/naomi-games/pause/assets/vo'); fs.mkdirSync(OUT, { recursive: true });

// the delivery of each kind of moment - natural-language audio tags (English inside the brackets).
// Round 3 (his note): breathy / whispery / exhaling tags sounded "erotic" and the added pauses broke words ("סקין טו סקין ... רגשי")
// -> a clear, warm, PROFESSIONAL voice (a radio psychologist), full voice, natural pace, no breath sounds, no added pauses.
// Round 4 (his note): "a therapist full of herself" - self-important, pleased with her own wisdom, smug but warm. One pass,
// one STT check, at most one re-take of a failed line ("don't waste credit on loops").
// keep tags SHORT - a tag longer than the line makes v4 repeat the line (12 of 25 repeated with a long tag)
const BASE = 'smug, self-satisfied';
const TAG = {
  start: `[${BASE}, welcoming]`,
  streak: `[${BASE}, pleased]`,
  hit: `[${BASE}, concerned]`,
  cutBond: `[${BASE}, gently correcting]`,
  bond: `[${BASE}, pleased]`,
  nu: `[${BASE}, knowing]`,
  gold: `[${BASE}, alert]`,
  goldIn: `[${BASE}, genuinely moved]`,
  cutGold: `[${BASE}, disappointed]`,
  breath: `[${BASE}, calm]`,
  rush: `[${BASE}, calm]`,
};
// spoken spelling only where the voice misreads a word (nikud on that word, or a reworded line) - no added pauses
const SPOKEN = {
  'start-1': 'בְּכָל פעם שעולה הדחף לשלוח, קודם כול לעצור.',
  'bond-0': 'זה סְקִין טוּ סְקִין רִגְשִׁי.',
  'nu-0': 'ה״נוּ״ שלא כתבתם, הוא עדיין שם.',
  'hit-4': 'כל ״נוּ״ כזה הוא צִיר.',
};
let n = 0;
for (const [k, lines] of Object.entries(SAY)) {
  if (only && !only.includes(k)) continue;
  for (let i = 0; i < lines.length; i++) {
    const id = `${k}-${i}`, out = path.join(OUT, `${id}.mp3`), text = `${TAG[k] || ''} ${(SPOKEN[id] || lines[i]).replace(/\.\.\./g, ',').replace(/ – /g, ', ')}`.trim(); n++;
    if (ids && !ids.includes(id)) continue;
    if (dry) { console.log(id, '|', text); continue; }
    if (fs.existsSync(out) && !redo && !ids) continue;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, language_code: 'he', ...(seed ? { seed } : {}), voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) { console.error('FAIL', id, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log('ok', id, '|', text);
  }
}
console.log(n, 'lines');
