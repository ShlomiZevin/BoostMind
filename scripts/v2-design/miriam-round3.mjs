// Miriam's portrait, round 3 (2026-11-06, his notes: "she should look dumb, like she can't understand - but she always
// talks a lot" and "she is super heavily made up"). From round 2 (no beard); the person, clothes and clinic stay.
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `Edit the attached portrait of Miriam. Keep the same person (face, age, wrinkles, glasses, the spiky grey wig), the
clothes, the clinic background, the framing and the light. Change two things only:
1. Her expression: she looks dumb and completely lost, as if she doesn't understand what is going on - eyebrows raised
and puzzled, eyes a little too wide behind the glasses, head slightly tilted - and she is in the middle of talking, as
she always talks a lot: mouth open mid-word, chatty, like she is explaining something she herself doesn't understand.
2. Her makeup is super heavy, overdone: thick visible foundation, bright purple-lilac eyeshadow painted all the way up to
the eyebrows, thick black eyeliner and smudged mascara, strong pink blush circles on the cheeks, and the glossy hot-pink
lipstick painted far beyond the lip line. Clean-shaven, no beard or stubble at all. Photographic. No text.`;
for (const name of ['sunburst', 'flare']) {
  const form = new FormData();
  form.append('model', `gpt-image-2.6-${name}`); form.append('prompt', prompt);
  form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([fs.readFileSync(`${DIR}/miriam-portrait-${name}-2.jpg`)], { type: 'image/jpeg' }), 'portrait.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', name, res.status, j.error?.message); continue; }
  fs.writeFileSync(`${DIR}/miriam-portrait-${name}-3.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', name);
}
