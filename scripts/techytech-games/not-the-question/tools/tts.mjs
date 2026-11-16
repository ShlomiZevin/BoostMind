// Voice lines for לא זו השאלה (ElevenLabs text-to-speech, eleven_v3, Israeli voices on the studio's account).
//   node scripts/techytech-games/not-the-question/tools/tts.mjs [only-id]
// Key: ELEVENLABS_API_KEY from zoomcut/.env (the studio's own). Output: public/techytech-games/not-the-question/assets/vo/<id>.mp3
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const env = fs.readFileSync(path.join(ROOT, 'zoomcut/.env'), 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!KEY) { console.error('no ELEVENLABS_API_KEY in zoomcut/.env'); process.exit(1); }
const OUT = path.join(ROOT, 'public/techytech-games/not-the-question/assets/vo');
fs.mkdirSync(OUT, { recursive: true });

const V = { amir: 'ZiofZHcEBTn5sRySe5h8', ofer: 'PBHwEnXdzx0yfhIO2UCH', daniel: 'JIxTgeeS5w0UQyBxEnrl' };
const LINES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/techytech-games/not-the-question/tools/lines.json'), 'utf8'));
const only = process.argv[2];

for (const l of LINES) {
  if (only && l.id !== only) continue;
  const out = path.join(OUT, l.id + '.mp3');
  if (fs.existsSync(out) && !only) { console.log('have', l.id); continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${V[l.who]}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: l.text, model_id: 'eleven_v3', language_code: 'he', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!r.ok) { console.error('fail', l.id, r.status, (await r.text()).slice(0, 200)); continue; }
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('saved', l.id);
  try {
    execFileSync('node', [path.join(ROOT, 'zoomcut/tools/library_add.mjs'), out, '--about', `${l.who} says "${l.text}", voice line for the not-the-question game`,
      '--tags', `techytech, ${l.who}, voice, game, not-the-question`, '--project', 'game-not-the-question', '--kind', 'sound'], { stdio: 'ignore' });
  } catch {}
}
