// The citizenship journey's stills (stage 3, plan conversion-next v6): Miriam at the check-in counter, Rabbi Demokratovich
// in his border booth - in the same look as the sign-in sheet's Miriam (public/verse/art/miriam-counter.jpg), their real
// portraits as references. His filmed clips replace these later in the same places.
//   node scripts/v2-design/citizen-stills.mjs [checkin|booth]  ->  public/verse/art/citizen-*.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/stills/';
const ref = (f) => [new Blob([fs.readFileSync(f)], { type: 'image/jpeg' }), f.split('/').pop()];
const STYLE = ref('C:/workspace/BoostMind/public/verse/art/miriam-counter.jpg');
const JOBS = {
  checkin: [[ref(S + 'p-miriam.jpg'), STYLE], `A wide cinematic comedy still, the same style, light and art direction as the second attached image (warm lamp light, wood, dark
background, glowing orange Shlomiverse planet logo). Miriam - EXACTLY the woman in the first attached portrait (spiky grey hair, heavy dark eyebrows, thin
glasses, purple eyeshadow, overdrawn pink lipstick, yellow shirt, black cardigan) - stands behind an AIRPORT CHECK-IN COUNTER for flights to the Shlomiverse,
confused and mid-sentence, holding a boarding pass upside down, a luggage scale and a tangle of luggage tags on the counter, a departures board behind her
glowing with the planet logo. One small sign above the counter with the Hebrew words "צ׳ק־אין לשלומיוורס" spelled exactly. No other text. Leave the
bottom fifth calmer.`],
  booth: [[ref(S + 'p-demokratovich.jpg'), STYLE], `A wide cinematic comedy still, the same style, light and art direction as the second attached image (warm lamp light, wood, dark
background, glowing orange Shlomiverse planet logo). Rabbi Demokratovich - EXACTLY the man in the first attached portrait (long grey beard, black kippah,
glasses, black suit) - sits inside a small PASSPORT-CONTROL BOOTH behind a glass window, very serious, one hand raised as if quoting the Talmud, the
other resting on a big rubber stamp; a thick law book, a tiny flag with a plain orange ringed planet (no letters on it) and a stack of passports beside him. Any planet logo in the scene is the ringed planet only, with NO letters or words on it. One small sign on the booth
with the Hebrew words "ביקורת גבולות" spelled exactly. No other text. Leave the bottom fifth calmer.`],
};
const only = process.argv.slice(2);
await Promise.all(Object.entries(JOBS).filter(([k]) => !only.length || only.includes(k)).map(async ([k, [imgs, prompt]]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'medium'); form.append('output_format', 'jpeg');
  for (const [b, n] of imgs) form.append('image[]', b, n);
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
  const j = await r.json();
  if (!r.ok) return console.log('FAILED', k, j.error?.message);
  fs.writeFileSync(`${S}citizen-${k}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', k);
}));
