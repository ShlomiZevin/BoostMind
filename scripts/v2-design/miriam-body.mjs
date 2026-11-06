// Miriam's portrait, round 5 (2026-11-06, his notes on older-2: "a bit too old, something doesn't connect between the head
// and the body ... make it make sense as a real character, she is a bit thinner"). From mid-2 (the in-between age).
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const prompt = `Edit the attached portrait so it is ONE believable real person photographed in a real clinic - the head and the
body must belong to each other. She is a thin, slightly bony woman in her late fifties: narrower shoulders, a thinner neck
with visible tendons and collarbones that match the face, the black cardigan hanging a little loose on her thin frame,
natural head-to-body proportions (the head not too big for the body), the same skin tone, texture and light on the face,
neck and chest. Keep the face, its age and real skin texture, the expression, the heavy dark eyebrows, the glasses, the
purple eyeshadow and smudged liner, the overdrawn pink lipstick, the spiky grey wig, the yellow shirt, the clinic background
and the framing. Clean-shaven, no beard or stubble. Photographic, natural, not a composite. No text.`;
for (const n of [1, 2]) {
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(`${DIR}/miriam-portrait-mid-2.jpg`)], { type: 'image/jpeg' }), 'portrait.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', n, res.status, j.error?.message); continue; }
  fs.writeFileSync(`${DIR}/miriam-portrait-thin-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', n);
}
