// Version 2 of the three stings: ElevenLabs composition plans, so the final hit lands at a fixed second (9.0 s)
// instead of the free-prompt swells (v1 peaked mid-track and faded without a clear hit).
// node music-plan.mjs [a|b|c ...]  -> music/plan-<x>.mp3   (max 2 requests at once on this plan)
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const KEY = env.ELEVENLABS_API_KEY;
const OUT = new URL('./music/', import.meta.url);
export const HIT_S = 9.0;

const NEG = ['vocals with lyrics', 'spoken words', 'pop beat', 'electronic dance', 'lo-fi', 'fade out early'];
const sec = (section_name, duration_ms, positive_local_styles, negative_local_styles = []) => ({ section_name, duration_ms, positive_local_styles, negative_local_styles, lines: [] });
const PLANS = {
  a: { positive_global_styles: ['epic orchestral film studio logo fanfare', 'cinematic', 'huge hall reverb', 'timpani', 'taiko', 'brass', 'choir', 'instrumental', 'major key', 'triumphant'],
    sections: [
      sec('Rumble', 3000, ['soft rolling timpani rumble from silence', 'low strings tremolo', 'anticipation']),
      sec('Build', 6000, ['timpani and taiko rolls crescendo hard', 'heroic french horn and trumpet fanfare melody rising', 'choir swell ah', 'snare roll', 'accelerating'], ['final hit']),
      sec('Final hit', 3000, ['starts with ONE massive full-orchestra hit and giant drum and cymbal crash on the first beat', 'triumphant major chord held by brass and choir', 'fortissimo']),
      sec('Tail', 4000, ['long shimmering sustained strings and choir ringing out', 'cymbal shimmer', 'gentle decay to silence'], ['drums']),
    ] },
  b: { positive_global_styles: ['dark modern movie trailer logo sting', 'cinematic sound design', 'sub booms', 'braams', 'risers', 'instrumental', 'huge', 'massive impact'],
    sections: [
      sec('Tension', 3000, ['deep sub drone from silence', 'distant metallic impacts', 'dark atmosphere']),
      sec('Riser', 6000, ['pulsing low strings ostinato', 'taiko hits accelerating', 'heavy braams', 'rising synth and orchestral riser', 'reverse swell sucking in at the very end'], ['final hit']),
      sec('Impact', 3000, ['starts with ONE enormous braam and sub boom impact on the first beat', 'earth shaking', 'fortissimo low brass held']),
      sec('Tail', 4000, ['low rumbling tail', 'high glassy shimmer', 'decays to silence'], ['drums', 'braams']),
    ] },
  c: { positive_global_styles: ['cosmic wonder', 'space epic orchestral logo sting', 'celesta and bells', 'soaring strings', 'wordless choir', 'instrumental', 'awe', 'radiant'],
    sections: [
      sec('Stars', 3000, ['twinkling celesta and bells from silence', 'airy pads', 'wonder']),
      sec('Flight', 6000, ['soaring legato strings rising', 'wordless choir swelling', 'timpani roll crescendo', 'flying through the stars toward a glowing planet'], ['final hit']),
      sec('Arrival hit', 3000, ['starts with ONE radiant full-orchestra hit with gong, choir and bells on the first beat', 'triumphant major chord', 'fortissimo']),
      sec('Sparkle', 4000, ['long sparkling reverberating tail', 'bells and choir ringing out', 'decays to silence'], ['drums']),
    ] },
};
for (const p of Object.values(PLANS)) p.negative_global_styles = NEG;

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PLANS);
  const run = async (k) => {
    const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ composition_plan: PLANS[k], model_id: 'music_v1' }),
    });
    if (!res.ok) { console.log(k, 'FAILED', res.status, (await res.text()).slice(0, 400)); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(new URL(`plan-${k}.mp3`, OUT), buf);
    console.log(k, 'ok', buf.length, 'bytes');
  };
  for (let i = 0; i < want.length; i += 2) await Promise.all(want.slice(i, i + 2).map(run));
}
