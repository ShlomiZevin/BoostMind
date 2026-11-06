import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const q = process.argv[2] || 'low', model = process.argv[3] || 'gpt-image-2.6-flare';
const form = new FormData();
form.append('model', model); form.append('size', '1024x1536'); form.append('quality', q); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('prompt', `A tall 9:16 comedic illustrated scene, no text, no letters, no logos. "The simulation you live in": an absurd mash-up of three
comedy characters' worlds, each person EXACTLY as in their attached portrait (same face, hair, glasses, clothes):
The attached images in order: image 1 = Yotam (black bob wig, galaxy t-shirt), image 2 = the neighbor (bald, grey beard, angry, white tank top),
image 3 = teacher Rosenblum (messy grey-blond hair, thin glasses, black polo). Keep each role on the right person:
1) Yotam - an overconfident tech "system architect" - stands at a whiteboard full of nonsense diagrams in an open-space office,
2) the annoying neighbor (image 2, bald, tank top) - leans in through the office window from a residential balcony, eavesdropping, holding a complaint letter,
3) the strict teacher Rosenblum (image 3, grey-blond hair, polo) - sits at the head of the meeting table grading everyone's work with a red pen.
One coherent scene, warm cinematic light, dark background with orange glow accents, playful, the faces clear and recognisable.
Leave the top 25% and bottom 20% calm and darker for text that will be laid over later.`);
for (const f of ['p-yotam.jpg', 'p-neighbor.jpg', 'p-rosenblum.jpg']) form.append('image[]', new Blob([fs.readFileSync(f)], { type: 'image/jpeg' }), f);
const t0 = Date.now();
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(`mix-${q}${process.argv[4]||''}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
const u = j.usage || {}, d = u.input_tokens_details || {};
console.log(q, ((Date.now() - t0) / 1000).toFixed(1) + 's', '$' + (((d.text_tokens || 0) * 5 + (d.image_tokens || 0) * 8 + (u.output_tokens || 0) * 30) / 1e6).toFixed(4), JSON.stringify(u));
