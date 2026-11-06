// Miriam's portrait, round 8 (2026-11-06, "now too much - in between"; was round 7, his note: "here she doesn't look old - her skin has all these wrinkles and spots
// because of her smoking ... very very close"). ONLY the skin of the neck, chest and face: a smoker's skin.
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const prompt = `Edit the attached portrait. Change ONLY her skin: she smokes, and it shows a LITTLE - half as much as a heavy smoker: her neck, throat and chest
(the décolletage in the shirt's neckline) have a smoker's skin - lightly crepey, a few fine neck lines, a few
spots, small brown spots, slightly uneven tone - and her face matches it under the heavy makeup: smoker's
lines around the mouth (above the upper lip), fine wrinkles, a few spots. Natural photographic skin, not exaggerated into a
very old woman - she is in her late fifties. Keep everything else exactly: the face, the expression, the eyebrows, the
glasses, the eye makeup, the overdrawn pink lipstick, the spiky grey wig, the body and its build, the clothes, the clinic
background, the framing and the light. Clean-shaven, no beard or stubble. No text.`;
for (const base of ['r6-b']) {
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(`${DIR}/miriam-portrait-${base}.jpg`)], { type: 'image/jpeg' }), 'portrait.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', base, res.status, j.error?.message); continue; }
  fs.writeFileSync(`${DIR}/miriam-portrait-${base}-light.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', base);
}
