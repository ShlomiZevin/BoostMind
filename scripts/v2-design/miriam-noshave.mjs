// Miriam's portrait, round 2 (2026-11-06, his note: "she can't have a beard"): the same two pictures, ONLY the stubble
// removed - clean-shaven, smooth made-up skin; everything else stays. GPT Image 2.6, MEDIUM.
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const prompt = `Edit the attached portrait. Change ONLY one thing: she has no beard and no stubble at all - the chin, jaw, cheeks and
upper lip are completely clean-shaven and smooth, with a layer of foundation like a woman's made-up skin. Keep everything
else exactly as it is: the same face, age, wrinkles, eyebrows, glasses, eye makeup, overdrawn pink lipstick, expression,
the spiky grey wig, the clothes, the clinic background, the framing and the light. No text.`;
for (const name of ['sunburst', 'flare']) {
  const form = new FormData();
  form.append('model', `gpt-image-2.6-${name}`); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(`${DIR}/miriam-portrait-${name}.jpg`)], { type: 'image/jpeg' }), 'portrait.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', name, res.status, j.error?.message); continue; }
  fs.writeFileSync(`${DIR}/miriam-portrait-${name}-2.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', name);
}
