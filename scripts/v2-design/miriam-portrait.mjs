// Miriam's portrait, fixed (2026-11-06, his note: "she looks too young, too nice - she is much older"; his two clear
// photos of her). Edit THAT picture only: the clinic, the yellow shirt + black cardigan, the framing stay; the person
// becomes exactly the one in his photos. GPT Image 2.6 flare + sunburst, MEDIUM, square like the old one.
//   node scripts/v2-design/miriam-portrait.mjs  ->  Documents/shlomiverse-v2-design/conversion/miriam-portrait-<model>.jpg
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const UP = 'C:/Users/shazbak/.claude/uploads/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const prompt = `Edit the FIRST attached image (the portrait). Keep its composition, framing, camera, light, the background (a medical
clinic reception), and the clothes (mustard-yellow shirt, black cardigan) exactly as they are. Change ONLY the person: make
them exactly the person in the two other attached photos - a man in his late forties playing an older woman called Miriam.
His real face and age: deep forehead wrinkles, tired droopy eyes, heavy thick dark eyebrows, thin rectangular glasses,
smudged lilac-purple eyeshadow with dark smeared liner under the eyes, overdrawn glossy hot-pink lipstick, grey-and-dark
stubble on the chin and cheeks, the spiky messy grey wig. Expression: slow, a bit dazed, kind but lost. Photographic, sharp,
the same headshot style as the original. No text.`;
for (const model of ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']) {
  const form = new FormData();
  form.append('model', model); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync('C:/workspace/BoostMind/zoomcut/characters/miriam/portrait.jpg')], { type: 'image/jpeg' }), 'portrait.jpg');
  form.append('image[]', new Blob([fs.readFileSync(`${UP}/84735139-image.jpg`)], { type: 'image/jpeg' }), 'miriam-photo-1.jpg');
  form.append('image[]', new Blob([fs.readFileSync(`${UP}/b573865f-image.jpg`)], { type: 'image/jpeg' }), 'miriam-photo-2.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', model, res.status, j.error?.message); continue; }
  const name = model.split('-').pop();
  fs.writeFileSync(`${DIR}/miriam-portrait-${name}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', name, JSON.stringify(j.usage));
}
