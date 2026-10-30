// Hebrew narration per page with ElevenLabs v4 (rules: zoomcut skill "ElevenLabs - the whole toolbox"):
// audio tags in brackets, niqqud names, every file transcribed back (scribe) before use.
//   . ~/.plaxzy/eleven-env.sh; node tools/narrate.js [--voice <id>] [--out dir] [--force] [page ...]
//   node tools/narrate.js --test p01      -> the page in all 8 Hebrew men's voices, art/voicetest/<name>.mp3
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), KEY = process.env.ELEVENLABS_API_KEY;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const VOICES = { nimrod: 'ZiofZHcEBTn5sRySe5h8', itamar: 'l7Q9rbdCC6j3J5dNlOOg', viktor: '8sZ9Z3Jy28CGLLCmKEHn', dorian: 'PBHwEnXdzx0yfhIO2UCH',
  itai: 'JIxTgeeS5w0UQyBxEnrl', omer: 'k77ZRVqAFg9Hd0ltAuON', tomer: 'yGpVFXFoImvRvaURKypy', amit: 'uwHajH4FhtzVp6X17pr7' };
const VOICE = VOICES[arg('voice', 'nimrod')] || arg('voice'), TEST = arg('test'), FORCE = process.argv.includes('--force');
const OUT = path.join(root, arg('out', 'assets/audio'));
const only = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').match(/^--(voice|out|test)$/));
const story = JSON.parse(fs.readFileSync(path.join(root, 'story.json'), 'utf8'));
// how the narrator says what the page shows
const SAY = [[/ב\.ס\.ר\./g, 'בֶּסֶר'], [/\(לֹא מְמֻמָּן\)/g, '[whispers, a quick funny aside] לֹא מְמֻמָּן.']];
const OPEN = '[warm, gentle, a storyteller reading to little children, unhurried] ';
const text = (p) => OPEN + SAY.reduce((s, [a, b]) => s.replace(a, b), (p.say || p.lines).join('\n'));
async function tts(t, file, voice) {
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: t, model_id: 'eleven_v4', language_code: 'he', voice_settings: { stability: 0.3, similarity_boost: 0.75 } }) });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 300));
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}
async function stt(file) {
  const f = new FormData(); f.append('model_id', 'scribe_v1'); f.append('language_code', 'he');
  f.append('file', new Blob([fs.readFileSync(file)]), 'a.mp3');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: f });
  return (await r.json()).text;
}
(async () => {
  let jobs;
  if (TEST) {
    const p = story.pages.find((x) => x.id === TEST), dir = path.join(root, 'art/voicetest');
    fs.mkdirSync(dir, { recursive: true });
    jobs = Object.entries(VOICES).map(([n, v]) => ({ name: n, file: path.join(dir, TEST + '-' + n + '.mp3'), voice: v, t: text(p) }));
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    jobs = story.pages.filter((p) => !only.length || only.includes(p.id)).map((p) => ({ name: p.id, file: path.join(OUT, p.id + '.mp3'), voice: VOICE, t: text(p) }));
  }
  const one = async (j) => {
    if (FORCE || !fs.existsSync(j.file)) await tts(j.t, j.file, j.voice);
    console.log(j.name, (fs.statSync(j.file).size / 1024).toFixed(0) + ' KB\n  heard: ' + await stt(j.file));
  };
  const work = [...jobs];   // the plan allows 5 at once
  await Promise.all([0, 1, 2, 3].map(async () => { while (work.length) await one(work.shift()); }));
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
