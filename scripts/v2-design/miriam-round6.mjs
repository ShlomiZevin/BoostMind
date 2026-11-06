// Miriam's portrait, round 6 (2026-11-06, his note on thin-1: "too thin in the body, and too smooth in the face"):
// a slim-but-normal body, and real skin texture on the face. Two starts: mid-2 (good texture, broad body) and thin-1.
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const prompt = `Edit the attached portrait so it is ONE believable real person, photographed, not retouched. Two changes:
1. Body: a slim but normal woman in her late fifties - not bony, not skinny, not broad: average slim shoulders, a normal neck
that fits the face, the black cardigan fitting naturally; natural head-to-body proportions, the same skin tone on face, neck
and chest.
2. Face skin: real, unretouched skin texture visible through the heavy foundation - fine lines around the mouth and eyes,
smile lines (nasolabial folds), pores, slight unevenness and a little dryness; NOT smooth, NOT airbrushed, NOT plastic.
Keep the face itself, its age, the dazed expression, the heavy dark eyebrows, the glasses, the purple eyeshadow and smudged
liner, the overdrawn pink lipstick, the spiky grey wig, the yellow shirt, the clinic background and the light.
Clean-shaven, no beard or stubble. No text.`;
for (const [base, out] of [['mid-2', 'r6-a'], ['thin-1', 'r6-b']]) {
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(`${DIR}/miriam-portrait-${base}.jpg`)], { type: 'image/jpeg' }), 'portrait.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', out, res.status, j.error?.message); continue; }
  fs.writeFileSync(`${DIR}/miriam-portrait-${out}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', out);
}
