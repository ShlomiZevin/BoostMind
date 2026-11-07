// The flight-in game's art (citizen.js step 5 - his idea 2026-11-07: "instead of the video, a short game: you are a spaceship
// flying to the Shlomiverse and you dodge the characters on the way; very fun, not that easy, not that hard").
//   node scripts/v2-design/fly-art.mjs <which> [n]   which = concept | ship | bg | spark   ->  scratchpad fly/art/<which>-<n>.(png|jpg)
// concept = the whole game screen as one picture (the look first); ship / spark = sprites on a transparent background;
// bg = the empty space the flight scrolls through, in the flight teaser's own colours (its frames are the references).
// The planet is not painted: it is cut from the teaser itself (fly-cut.py), so the hand-off to the turning-logo clip is one shot.
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/fly/art/';
const LOGO = 'C:/workspace/BoostMind/public/verse/logo-512.png';
const [which = 'concept', n = '1'] = process.argv.slice(2);
const JOB = {
  concept: { size: '1024x1536', refs: [S + 'ref-4s.jpg', LOGO], prompt: `A screenshot of a mobile arcade game, phone held upright, filling the whole frame. The first attached image is a frame
from the game's own teaser video - keep its world exactly: deep space in near-black and dark brown with warm orange nebula clouds, fine stars, and round
bubbles with real people's faces in them (photos of different men and women, each in a circle with a thin glowing orange rim). The player flies a
small sleek spaceship (navy and warm orange #ff6a1f with gold trim, a glowing engine flame) near the bottom of the screen, flying UP. The round face
bubbles drift down toward the ship as obstacles, some tumbling. A few small glowing gold stars to collect between them. At the top of the screen, far
away and small, the glowing orange ringed planet from the second attached logo (the ringed planet only). A thin game HUD across the very top: three
small shield icons on one side, a slim progress bar with a tiny planet at its end in the middle, a small round pill button on the other side. No words,
no letters, no numbers anywhere. Polished, cinematic, readable at a glance.` },
  ship: { size: '1024x1024', transparent: true, refs: [S + 'concept-1.jpg'], prompt: `The attached image is the approved look of the game. A game sprite of ITS spaceship: ONE small sleek spaceship seen from straight above (top-down view), its nose pointing UP, symmetric
left and right. Navy blue hull with warm orange (#ff6a1f) panels and thin gold trim, a small glowing cockpit, two short swept wings, a soft
orange-white engine glow at the bottom (tail). Painted, polished, like a premium mobile arcade game. The ship alone, centered, filling about 70% of the
picture, on a fully transparent background - no shadow, no space, no stars, no text.` },
  // round 2 (his note 2026-11-07: "the spaceship should carry the Shlomiverse logo"): the same ship, the logo's ringed planet on its hull
  ship2: { size: '1024x1024', transparent: true, refs: [S + 'ship-1.png', LOGO], prompt: `The first attached image is a game sprite of a small spaceship seen from straight above, nose UP. Paint the SAME ship
again - same shape, same navy blue hull with warm orange (#ff6a1f) panels and gold trim, same glowing engine flame at the tail - with ONE addition:
it carries the Shlomiverse emblem from the second attached logo: the glowing orange RINGED PLANET (the planet with its tilted ring, no lettering)
painted BIG and bold on the top of the hull between the wings, like a squadron insignia, bright orange and gold on the navy so it reads even when
the ship is shown tiny (about 50 pixels wide). Symmetric, top-down, the ship alone, centered, about 70% of the picture, fully transparent background -
no shadow, no space, no stars, no text, no letters.` },
  spark: { size: '1024x1024', transparent: true, prompt: `A game sprite: ONE small collectible star for a space arcade game - a plump five-pointed star of warm glowing gold
with a bright white-hot center and a soft orange glow around it, a tiny sparkle. Painted, polished. Alone, centered, filling about 60% of the picture,
on a fully transparent background - no text, nothing else.` },
  bg: { size: '1024x1536', refs: [S + 'ref-73.png'], prompt: `The attached image is a frame from a space teaser video. Paint the EMPTY deep space of that same world as a tall
background for a vertical-scrolling phone game: near-black and very dark brown-navy space, soft warm orange and rust nebula clouds drifting through
(more on the sides, the middle calmer and darker so things flying over it stay readable), a faint band of distant galaxy dust, many fine stars of
different sizes. NO planet, no ring, no faces, no bubbles, no ships, no text - only space. Cinematic, photographic, same colours as the reference.` },
};
const job = JOB[which];
let r;
if (job.refs) {
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', job.prompt); form.append('size', job.size); form.append('quality', 'medium');
  form.append('output_format', job.transparent ? 'png' : 'jpeg'); if (job.transparent) form.append('background', 'transparent');
  for (const p of job.refs) form.append('image[]', new Blob([fs.readFileSync(p)], { type: /png$/.test(p) ? 'image/png' : 'image/jpeg' }), p.split('/').pop());
  r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
} else {
  const body = { model: 'gpt-image-2.6-flare', prompt: job.prompt, size: job.size, quality: 'medium', output_format: 'png', ...(job.transparent ? { background: 'transparent' } : {}) };
  r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
const j = await r.json();
if (!r.ok) { console.log('FAILED', which, j.error?.message); process.exit(1); }
fs.mkdirSync(S, { recursive: true });
const out = S + `${which}-${n}.${job.refs && !job.transparent ? 'jpg' : 'png'}`;
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', out);
