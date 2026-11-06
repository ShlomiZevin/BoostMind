// Miriam's portrait, round 4b (2026-11-06, his pick: miriam-portrait-sunburst-2.jpg "the closest - turn her a bit older", then "now too old" - between the two, ~56,
// older"): that picture, ONLY older. GPT Image 2.6 sunburst, MEDIUM.
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `Edit the attached portrait. Change ONLY her age: make her a bit older - about 56 - with slightly deeper forehead and
eye lines, light crow's feet, real skin texture and pores (not smooth, not airbrushed) - but NOT elderly: no sagging jowls, no deep folds, no age spots
under the same makeup. Keep everything else exactly as it is: the same person and face shape, the same expression, the
heavy eyebrows, the glasses, the purple eyeshadow and smudged liner, the overdrawn pink lipstick, the spiky grey wig, the
clothes, the clinic background, the framing and the light. Clean-shaven, no beard or stubble. No text.`;
for (const n of [1, 2]) {
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(`${DIR}/miriam-portrait-sunburst-2.jpg`)], { type: 'image/jpeg' }), 'portrait.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', n, res.status, j.error?.message); continue; }
  fs.writeFileSync(`${DIR}/miriam-portrait-mid-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', n);
}
