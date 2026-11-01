// Round 2 after his notes on option A: it must OPEN with drums alone (a big solo timpani roll + pounding hits,
// the classic film-studio opening), then the brass fanfare and choir come in and build to the final hit -
// "we are presenting something great, for the first time", a grand premiere. No real studio named.
// node music-premiere.mjs [A2|A3|A4 ...]  -> music/take-<id>.mp3   (2 requests at once max on this plan)
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const KEY = env.ELEVENLABS_API_KEY;
const OUT = new URL('./music/', import.meta.url);

const NEG = ['vocals with lyrics', 'spoken words', 'pop', 'electronic', 'synth', 'dance beat', 'fade in slowly'];
const GLOBAL = ['grand film production company logo opening', 'majestic orchestral fanfare', 'triumphant premiere', 'timpani', 'brass',
  'full symphony orchestra', 'choir', 'instrumental', 'major key', 'huge concert hall', 'cinematic'];
const sec = (section_name, duration_ms, positive_local_styles, negative_local_styles = []) => ({ section_name, duration_ms, positive_local_styles, negative_local_styles, lines: [] });

const TAKES = {
  // plan: 4 s of drums alone, fanfare + choir build, hit at 13 s, tail
  A2: { composition_plan: { positive_global_styles: GLOBAL, negative_global_styles: NEG, sections: [
    sec('Solo timpani opening', 4000, ['solo timpani roll alone from the very first second, loud and growing', 'pounding timpani and big bass drum hits', 'drums only'],
      ['brass', 'strings', 'choir', 'melody']),
    sec('Fanfare enters', 6000, ['majestic heroic brass fanfare enters over the drums', 'french horns and trumpets', 'full orchestra builds', 'choir swells', 'grand premiere, presenting something great for the first time']),
    sec('Final hit', 3000, ['starts with ONE massive full-orchestra and drum hit with cymbal crash', 'triumphant major chord held fortissimo by brass and choir']),
    sec('Long tail', 3000, ['long shimmering tail of strings and choir ringing out', 'cymbal shimmer', 'decays to silence'], ['drums']),
  ] } },
  // free prompt, same direction (option A was a free prompt and he liked its sound best)
  A3: { prompt: 'Instrumental only. A 17-second grand film production-company logo opening for a cinema premiere. It OPENS with drums alone: ' +
      'a big solo timpani roll from the very first second, then pounding timpani and bass drum hits, nothing else for the first four seconds. ' +
      'Then a majestic heroic brass fanfare (french horns and trumpets) enters, the full orchestra and a choir join and build - the feeling of ' +
      'presenting something great for the first time, a triumphant premiere. At about 12 seconds one massive final hit with the whole orchestra, ' +
      'drums and cymbals on a triumphant major chord, then a long shimmering tail of strings and choir ringing out to silence. ' +
      'Huge concert hall reverb, polished Hollywood mix.', music_length_ms: 17000, force_instrumental: true },
  // plan: a longer drum solo (roll -> three pounding hits -> roll), 18 s
  A4: { composition_plan: { positive_global_styles: GLOBAL, negative_global_styles: NEG, sections: [
    sec('Drum roll and hits', 5000, ['solo timpani roll crescendo from the first second', 'then three pounding unison timpani and taiko hits', 'another rising timpani roll', 'percussion only, epic and loud'],
      ['brass', 'strings', 'choir', 'melody']),
    sec('Majestic fanfare', 6000, ['majestic brass fanfare melody bursts in', 'full orchestra and choir build together', 'snare and timpani driving', 'grand premiere, triumphant']),
    sec('Final hit', 3000, ['starts with ONE colossal hit: full orchestra, choir, timpani, bass drum and cymbals together', 'triumphant major chord held fortissimo']),
    sec('Long tail', 4000, ['long majestic shimmering tail', 'strings, choir and cymbal ringing out', 'decays to silence'], ['drums']),
  ] } },
};

// Round 3: A3 was closest. He hums the motif: "ta-tam, ta-tam, da-da-da-da-da-da, ta-TAM" - two short-long accented
// hits, again, a rapid run of six notes, then one massive accented final hit on the logo; brass and timpani together.
const MOTIF = 'The fanfare motif, played by brass and timpani together in strict unison rhythm: "ta-TAM ... ta-TAM" ' +
  '(a short pickup note into a strong accented long note, then the same short-long figure again), then a rapid run of exactly six fast ' +
  'notes "da-da-da-da-da-da" rising, then "ta-TAAAM": a short pickup into one massive accented final chord, held, with a huge timpani hit ' +
  'and cymbal crash. ';
const PRE = 'Instrumental only. A 16-second grand film production-company logo opening for a cinema premiere - presenting something great ' +
  'for the first time. Full symphony orchestra, heroic brass (trumpets, french horns, trombones), big timpani, choir. ';
const TAIL = 'After the final chord the choir and full orchestra swell and ring out in a long triumphant shimmering tail to silence. ' +
  'Huge concert hall reverb, polished Hollywood mix, major key.';
Object.assign(TAKES, {
  A5: { prompt: PRE + 'It opens with a short solo timpani roll (about 1.5 seconds). ' + MOTIF + TAIL, music_length_ms: 16000, force_instrumental: true },
  A6: { prompt: PRE + 'Opens straight away on the motif, no intro. ' + MOTIF + 'Then the whole motif is answered once more an octave higher by the full ' +
      'orchestra and choir, building, and ends on the same massive final accented hit (ta-TAM). ' + TAIL, music_length_ms: 17000, force_instrumental: true },
  A7: { composition_plan: { positive_global_styles: [...GLOBAL, 'fanfare motif in brass and timpani unison', 'strong accents', 'clear rhythm'],
    negative_global_styles: NEG, sections: [
      sec('Motif', 4000, ['brass and timpani unison fanfare motif: short-long accented hit "ta-TAM", then again "ta-TAM"', 'then a rapid run of six fast rising notes',
        'loud, accented, majestic'], ['choir', 'soft']),
      sec('Answer', 5000, ['the motif answered by full orchestra and choir, higher and bigger', 'timpani driving', 'building tension toward the final hit'], ['final chord']),
      sec('Final ta-TAM', 3000, ['a short pickup then ONE massive accented final chord "ta-TAAAM" by brass, timpani, choir and full orchestra with cymbal crash', 'held fortissimo']),
      sec('Tail', 4000, ['choir and orchestra swell and ring out', 'long triumphant shimmering tail', 'decays to silence'], ['drums']),
    ] } },
  A8: { prompt: PRE + 'Slow, heavy and majestic tempo. ' + MOTIF + 'The six-note run is like a drum fill played by timpani and snare with the trumpets. ' +
      'The final hit is the biggest moment of the whole piece. ' + TAIL, music_length_ms: 16000, force_instrumental: true },
});

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TAKES);
const run = async (k) => {
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model_id: 'music_v1', ...TAKES[k] }),
  });
  if (!res.ok) { console.log(k, 'FAILED', res.status, (await res.text()).slice(0, 400)); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(new URL(`take-${k}.mp3`, OUT), buf);
  console.log(k, 'ok', buf.length, 'bytes');
};
for (let i = 0; i < want.length; i += 2) await Promise.all(want.slice(i, i + 2).map(run));
