// Terra writes the name screen's new lines: the profile-photo step (upload + crop) and a bigger pool of name ideas.
//   node scripts/v2-design/copy-photo.mjs <out.json>
import fs from 'node:fs';
const envKey = (file, name) => { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, ''); } catch { return undefined; } };
const KEY = envKey('C:/workspace/BoostMind/zoomcut/.env', 'OPENAI_API_KEY') || envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const wiki = JSON.parse(fs.readFileSync('C:/workspace/BoostMind/public/wiki/data/wiki.json', 'utf8'));
const cast = wiki.characters.map((c) => `${c.name} - ${c.role || ''}`).join('\n');
const brief = `You write Hebrew interface copy for שלומיוורס (the Shlomiverse): Shlomi Zevin's comedy universe, where his recurring
characters are treated as real people with their own lives. A viewer just signed in and picks the name (and photo) the characters
and other viewers will see. The look is calm and premium; copy is natural spoken Israeli Hebrew, short, a little witty, never cute.
Address the viewer in plural (no gender guessed). No emoji. Never the word מעריצים.

Return ONLY JSON with these keys:
- "photoUpload": pill button label to upload your own photo (2-3 words)
- "photoGoogle": pill button label to use the photo from your Google account (keep the word Google)
- "photoNone": small link label for "no photo" (2 words max)
- "cropTitle": title of the crop screen, telling them to drag and zoom to fit the circle (max 4 words)
- "cropHint": one short line under it (max 7 words)
- "cropSave": the save button (1-2 words)
- "cropCancel": cancel (1 word)
- "photoBad": short line when the photo is rejected by the safety check (polite, light, max 7 words)
- "photoBig": short line when the file is not an image or can't be read (max 7 words)
- "nickIdeas": 24 name ideas a viewer could take as a playful nickname in this universe. Mix: viewer-life jokes
  (like "צופה מהספה", "חיים בסימולציה") and nods to the characters below (like "השכן של חני") - a relation or a place in their
  world, never pretending to BE a character, never a real public person. Each at most 14 characters, gender-neutral,
  no punctuation, all different.

The characters:
${cast}`;
const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-5.6-terra', instructions: brief, input: 'Write it as JSON.', reasoning: { effort: 'medium' }, max_output_tokens: 6000, store: false, text: { format: { type: 'json_object' } } }),
});
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
const text = (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
fs.writeFileSync(process.argv[2], text);
console.log('ok', process.argv[2], j.usage?.output_tokens);
