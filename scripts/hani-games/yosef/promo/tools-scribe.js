// word timestamps for narration files (ElevenLabs scribe) -> out/words-<id>.json, prints the words with start times
//   . ~/.plaxzy/eleven-env.sh; node promo/tools-scribe.js p01 p03 p04 p05
const fs = require('fs'), path = require('path');
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
if (!KEY) { console.error('no ElevenLabs key - run . ~/.plaxzy/eleven-env.sh'); process.exit(1); }
(async () => {
  for (const id of process.argv.slice(2)) {
    const f = new FormData();
    f.append('model_id', 'scribe_v1'); f.append('language_code', 'he'); f.append('timestamps_granularity', 'word');
    f.append('file', new Blob([fs.readFileSync(path.join(__dirname, '..', 'assets/audio', id + '.mp3'))], { type: 'audio/mpeg' }), id + '.mp3');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: f });
    const j = await r.json();
    if (!r.ok) { console.error(id, 'FAILED', r.status, JSON.stringify(j).slice(0, 300)); continue; }
    const words = (j.words || []).filter((w) => w.type === 'word').map((w) => ({ t: w.text, s: w.start, e: w.end }));
    fs.writeFileSync(path.join(__dirname, 'out', `words-${id}.json`), JSON.stringify(words), 'utf8');
    console.log('== ' + id + '\n' + words.map((w) => `${w.s.toFixed(2)} ${w.t}`).join(' | '));
  }
})();
