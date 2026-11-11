// The kupat holim recorded phone-menu voice (ElevenLabs TTS, Danit - Israeli Hebrew), phone-line filtered.
//   node tools/voice.mjs            makes every line in LINES that is missing -> public/lola-games/pills/assets/sfx/vo-<id>.mp3
// Key: ELEVENLABS_API_KEY in zoomcut/.env (never printed). Each result goes into the editor's library, labelled.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const BM = path.resolve(HERE, '../../../..');
const KEY = fs.readFileSync(path.join(BM, 'zoomcut/.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('ELEVENLABS_API_KEY=')).slice(19).trim();
const VOICE = 's0T0DT6EAPeX57MQpn3I';
const OUT = path.join(BM, 'public/lola-games/pills/assets/sfx');
export const LINES = {
  hello: 'שלום, הגעתם לקופת החולים. שיחתך חשובה לנו.',
  wait: 'אָנָּא, הַמְתִּינוּ על הקו. נציג יענה לכם בהקדם.',
  queue7: 'מקומך בתור הוא: שבע.',
  queue42: 'מקומך בתור הוא: ארבעים ושתיים.',
  time: 'זמן ההמתנה המשוער: שעתיים.',
  rec: 'השיחה עשויה להיות מוקלטת, לצורך שיפור השירות.',
  star: 'לחזרה לתפריט הראשי, הקישו כוכבית.',
  menu: 'לקופסת השבוע, הקישו אחת. לבקבוקים, הקישו שתיים. לַמַּגָּשׁ של סבתא, הקישו שלוש.',
  busy: 'כרגע, כל הנציגים שלנו עסוקים.',
  bye: 'תודה שפניתם אלינו. נשמח לחוות את דעתכם על השירות.',
};
const only = process.argv.slice(2);
for (const [id, text] of Object.entries(LINES)) {
  if (only.length && !only.includes(id)) continue;
  const out = path.join(OUT, `vo-${id}.mp3`), raw = out.replace(/\.mp3$/, '.raw.mp3');
  if (fs.existsSync(out) && !only.length) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: 'he', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!r.ok) { console.error(id, 'HTTP', r.status, (await r.text()).slice(0, 300)); continue; }
  fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  // a phone line: 300-3400 Hz, a little compression, trimmed silence
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=320,lowpass=f=3400,acompressor=threshold=-18dB:ratio=3,volume=1.4', '-ac', '1', '-b:a', '96k', out]);
  fs.rmSync(raw);
  execFileSync('node', [path.join(BM, 'zoomcut/tools/library_add.mjs'), out, '--about', `Kupat holim phone-menu voice: "${text}", for the Lola pills game`, '--tags', 'lola, savta, voice, kupat holim, phone menu, pills', '--project', 'game-pills'], { stdio: 'inherit' });
  console.log('OK', id);
}
