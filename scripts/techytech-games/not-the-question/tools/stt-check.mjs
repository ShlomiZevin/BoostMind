// speech-to-text every voice line (ElevenLabs scribe) to be sure each says its words
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const KEY = fs.readFileSync(path.join(ROOT, 'zoomcut/.env'), 'utf8').match(/^ELEVENLABS_API_KEY=(.*)$/m)[1].trim();
const lines = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/techytech-games/not-the-question/tools/lines.json'), 'utf8'));
const out = [];
for (const l of lines) {
  const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'he');
  fd.append('file', new Blob([fs.readFileSync(path.join(ROOT, 'public/techytech-games/not-the-question/assets/vo', l.id + '.mp3'))]), l.id + '.mp3');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
  const j = await r.json(); out.push(`${l.id}\t${l.text}\t=>\t${j.text || JSON.stringify(j).slice(0, 120)}`);
}
fs.writeFileSync(path.join(ROOT, 'scripts/techytech-games/not-the-question/tools/stt.txt'), out.join('\n'), 'utf8');
console.log('done', out.length);
