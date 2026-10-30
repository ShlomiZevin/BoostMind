// trailer voice-over lines for the teaser (ElevenLabs v4, Hebrew, every file transcribed back before use)
//   . ~/.plaxzy/eleven-env.sh
//   node promo/vo.js --test            -> the intro line in all 8 men's voices -> out/vo-test/<n>-<name>.mp3 + out/vo-test/all.mp3
//   node promo/vo.js --voice viktor    -> every line -> out/vo/<id>.mp3
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const FF = 'C:/Users/shazb/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const KEY = process.env.ELEVENLABS_API_KEY, OUT = path.join(__dirname, 'out');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const VOICES = { nimrod: 'ZiofZHcEBTn5sRySe5h8', itamar: 'l7Q9rbdCC6j3J5dNlOOg', viktor: '8sZ9Z3Jy28CGLLCmKEHn', dorian: 'PBHwEnXdzx0yfhIO2UCH',
  itai: 'JIxTgeeS5w0UQyBxEnrl', omer: 'k77ZRVqAFg9Hd0ltAuON', tomer: 'yGpVFXFoImvRvaURKypy', amit: 'uwHajH4FhtzVp6X17pr7' };
const TONE = '[deep movie-trailer announcer, dramatic, slow and big] ';
const LINES = {
  intro: 'הַמִּשְׂחָקִיָּה שֶׁל חָנִי... מַצִּיגָה:',
  new: 'חָדָשׁ!',
  title: 'יוֹסֵף מוֹקִיר שַׁבָּת!',
  millionaire: 'מִילְיוֹנֶר אֶחָד.',
  diamond: 'יַהֲלוֹם אֶחָד.',
  book: 'סֵפֶר מֻקְרָא.',
  games: 'עֲשָׂרָה מִשְׂחָקִים!',
  now: 'עַכְשָׁו בָּאֲתָר!',
  end: 'יוֹסֵף מוֹקִיר שַׁבָּת. עַכְשָׁו, בַּמִּשְׂחָקִיָּה שֶׁל חָנִי!',
  disclaimer: '[very fast, rushed, flat radio-commercial disclaimer voice] הַמִּשְׂחָק כָּשֵׁר לַמְהַדְּרִין, בְּפִקּוּחַ רַבָּנִי. אֵינוֹ פּוֹעֵל בְּשַׁבָּתוֹת וּבְחַגִּים. נִגּוּנִים בִּלְבַד, לְלֹא שִׁירַת נָשִׁים. לְלֹא צְ׳אט וּלְלֹא פִּרְסוֹמוֹת. פֻּתַּח עַל יְדֵי שֵׁינְדִּי מַלְכָּה פְרִידְמַן, בּוֹגֶרֶת סֶמִינָר הָרַב ווֹלְף, מַסְלוּל בִּינָה יְתֵרָה. הַתְּמוּנוֹת לְהַמְחָשָׁה בִּלְבַד.',
};
async function tts(t, file, voice) {
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: (t.startsWith('[') ? '' : TONE) + t, model_id: 'eleven_v4', language_code: 'he', voice_settings: { stability: 0.3, similarity_boost: 0.75 } }) });
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
  if (process.argv.includes('--test')) {
    const dir = path.join(OUT, 'vo-test'); fs.mkdirSync(dir, { recursive: true });
    const names = Object.keys(VOICES);
    for (let i = 0; i < names.length; i += 4) await Promise.all(names.slice(i, i + 4).map((n, j) => tts(LINES.intro, path.join(dir, `${i + j + 1}-${n}.mp3`), VOICES[n])));   // max 5 at once on this plan
    // one file to listen to: each voice, 0.8 s gap, in order 1..8
    const files = names.map((n, i) => path.join(dir, `${i + 1}-${n}.mp3`));
    const a = []; files.forEach((f) => a.push('-i', f));
    const fc = files.map((_, i) => `[${i}:a]aformat=sample_rates=44100:channel_layouts=mono,apad=pad_dur=0.8[a${i}]`).join(';') + ';' + files.map((_, i) => `[a${i}]`).join('') + `concat=n=${files.length}:v=0:a=1[o]`;
    execFileSync(FF, ['-y', ...a, '-filter_complex', fc, '-map', '[o]', path.join(dir, 'all.mp3')], { stdio: 'ignore' });
    names.forEach((n, i) => console.log(i + 1, n));
    return;
  }
  const voice = VOICES[arg('voice', 'viktor')] || arg('voice'), dir = path.join(OUT, 'vo'); fs.mkdirSync(dir, { recursive: true });
  const only = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--voice');
  const work = Object.entries(LINES).filter(([id]) => !only.length || only.includes(id));
  await Promise.all([0, 1, 2, 3].map(async () => { while (work.length) { const [id, t] = work.shift(); const f = path.join(dir, id + '.mp3'); await tts(t, f, voice); console.log(id, '| heard:', await stt(f)); } }));
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
