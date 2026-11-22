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
const only = arg('only', '') ? arg('only').split(',') : null, dry = args.includes('--dry'), redo = args.includes('--redo');
const game = fs.readFileSync(path.join(root, 'public/naomi-games/pause/game.js'), 'utf8');
const SAY = Function('return ' + game.slice(game.indexOf('const SAY = {') + 12, game.indexOf('};', game.indexOf('const SAY = {')) + 1))();
const OUT = path.join(root, 'public/naomi-games/pause/assets/vo'); fs.mkdirSync(OUT, { recursive: true });

// the delivery of each kind of moment - natural-language audio tags (English inside the brackets)
const TAG = {
  start: '[warm, gentle, soothing, like a therapist opening a session]',
  streak: '[softly, warmly proud, quietly moved]',
  hit: '[gently concerned, compassionate, soft]',
  cutBond: '[tender, kindly disappointed, soft]',
  bond: '[warm, delighted, tender]',
  nu: '[softly, knowing, almost whispering]',
  gold: '[urgent but gentle whisper]',
  goldIn: '[deeply moved, emotional, proud]',
  cutGold: '[sad, compassionate, soft]',
  breath: '[slowly, breathy, very calm]',
  rush: '[calm, slow, grounding, unhurried]',
};
// whole spoken lines where a sigh / pause / spelling makes it human (the screen keeps the written line)
const SPOKEN = {
  'start-0': '[warm, gentle, soothing] מה עולה אצלך... ברגע הזה?',
  'start-1': '[warm, gentle] בְּכָל פעם שעולה הדחף לשלוח — [pause] קודם כול, לעצור.',
  'streak-1': '[exhales, deeply moved] המממ... זה מרגש. [softly] וזה גם אמיץ.',
  'bond-0': '[warm, tender] זה סְקִין טוּ סְקִין... רִגְשִׁי.',
  'nu-0': '[softly, knowing] ה״נוּ״ שלא כתבתם — הוא עדיין שם.',
  'hit-2': '[sighs, compassionate] ילד מרגיש — הכול.',
  'goldIn-0': '[deeply moved, emotional] הוא כתב לכם — מיוזמתו. [softly] זו הצלחה אדירה.',
  'cutGold-0': '[sighs, sad, soft] הוא ניסה לבטא קושי... ונחסם.',
  'breath-0': '[exhales slowly] לעצור. [pause] לזהות... מה עולה.',
  'rush-0': '[calm, slow, grounding] הלקוח מחכה. [pause] ודווקא עכשיו — לעצור.',
};
let n = 0;
for (const [k, lines] of Object.entries(SAY)) {
  if (only && !only.includes(k)) continue;
  for (let i = 0; i < lines.length; i++) {
    const id = `${k}-${i}`, out = path.join(OUT, `${id}.mp3`), text = SPOKEN[id] || `${TAG[k] || ''} ${lines[i]}`.trim(); n++;
    if (dry) { console.log(id, '|', text); continue; }
    if (fs.existsSync(out) && !redo) continue;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, language_code: 'he', voice_settings: { stability: 0.35, similarity_boost: 0.75 } }),
    });
    if (!r.ok) { console.error('FAIL', id, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log('ok', id, '|', text);
  }
}
console.log(n, 'lines');
