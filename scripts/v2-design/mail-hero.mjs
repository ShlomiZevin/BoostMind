// The residents' mail hero, round 2 (his notes 2026-11-07: "like the previous one, Miriam and Demokratovich at the booth, and the passport
// too - more bureaucratic mess"; "suggest more images for the top"). References: the previous hero, both portraits, the passport cover.
//   node scripts/v2-design/mail-hero.mjs <a|b|c|d>  ->  scratchpad mail2/top-<x>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/mail2/';
const ART = 'C:/workspace/BoostMind/v2/site/verse/art/';
const REFS = [S + 'citizen-hero.jpg', S + 'p-miriam.jpg', S + 'p-demokratovich.jpg', ART + 'citizen-passport.jpg'];
const BASE = `Attached: (1) the previous picture of this scene - the Shlomiverse's airport check-in counter and passport-control booth, warm brass and
amber light, the orange neon ringed-planet sign; (2) Miriam, the check-in clerk - keep her face, wild grey spiky hair, glasses, magenta lipstick,
dark cardigan over a mustard top, exactly as in her portrait; (3) Rabbi Demokratovich, the border officer - keep his face, long grey beard,
black kippah, glasses, black suit; (4) the Shlomiverse passport - navy cover with the gold ringed planet and the Hebrew word "שלומיוורס" on its ring,
"דרכון" above it. Wide landscape photograph (3:2), photorealistic, cinematic, the same warm look as picture 1. The passport, wherever it appears,
looks exactly like picture 4 (gold letters readable, unmirrored). No other readable text anywhere - forms and signs are blurred or wordless.`;
const SHOTS = {
  a: `${BASE}\nThe scene: the same counter as picture 1, but the bureaucracy has exploded - towers of paper forms, overflowing in-trays, carbon copies,
paper clips, five rubber stamps, a ticket-number machine. Miriam holds up the Shlomiverse passport at arm's length, squinting at it, utterly
confused, her other hand raised mid-explanation. Behind her, in his glass booth, Demokratovich raises his heavy rubber stamp high, solemn,
waiting. Both clearly visible, faces sharp.`,
  b: `${BASE}\nThe scene: Demokratovich's passport-control booth seen through its window, from the traveller's side. He sits almost buried behind
teetering stacks of folders and forms, examining the open Shlomiverse passport closely through a magnifying glass, deadly serious, the rubber
stamp hovering in his other hand. Miriam leans into the frame from the side of the booth, whispering to him with a hand at her mouth and a
pile of boarding passes in her other hand. Papers everywhere, a "next" lamp glowing orange.`,
  c: `${BASE}\nThe scene: a slightly high angle over the counter. In the foreground the closed Shlomiverse passport lies on a mountain of forms,
receipts and boarding passes, lit by a brass desk lamp, sharp and hero-sized. Just behind it, a little out of focus but recognisable, Miriam
on the phone, shrugging, and Demokratovich in his booth slamming his stamp down onto a different page with great ceremony. The mess
is comic and abundant.`,
  d: `${BASE}\nThe scene: the two of them side by side behind the counter, facing the camera like an official portrait gone wrong: Demokratovich
holding the open Shlomiverse passport toward the viewer like evidence, stamp raised in his other hand; Miriam next to him holding a
form upside down, looking at it, lost. On the counter before them: piles of paper, stamps, a bell, a tangle of boarding passes.
The neon ringed planet glows on the wall behind them.`,
};
const x = process.argv[2] || 'a';
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', SHOTS[x]); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('output_format', 'jpeg');
for (const p of REFS) form.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), p.split('/').pop());
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', x, j.error?.message); process.exit(1); }
fs.writeFileSync(S + `top-${x}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', x);
