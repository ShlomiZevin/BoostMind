// Check the mic of /mind/: a spoken Hebrew line (OpenAI TTS) -> the mind function's `transcribe` -> text.
//   node scripts/mind/test_transcribe.mjs <owner key>
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const tts = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'onyx', input: 'רעיון חדש: לבנות דמות של נהג מונית פילוסוף, ולבדוק את זה עם Claude מחר בבוקר.', response_format: 'opus' }) });
if (!tts.ok) { console.log('tts failed', tts.status, await tts.text()); process.exit(1); }
const audio = Buffer.from(await tts.arrayBuffer()).toString('base64');
const t0 = Date.now();
const r = await fetch('https://shlomiverse.com/mind/api', { method: 'POST', headers: { authorization: 'Key ' + process.argv[2], 'content-type': 'application/json' },
  body: JSON.stringify({ op: 'transcribe', audio, mime: 'audio/ogg' }) });
console.log(r.status, await r.text(), `${Date.now() - t0}ms`);
