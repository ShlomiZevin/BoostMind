// Time to the first word + cost of the wiki chat, on this machine (the local wiki.js, the brain from the bucket).
//   node scripts/wiki/speed_test.cjs        (local Google credentials, the OpenAI key in scripts/design.env)
// Written for the look_up change (2026-11-01, his "היי" took a while): small talk = one call, a question = two.
const fs = require('fs');
const path = require('path');
const API = path.resolve(__dirname, '..', '..', 'techietech-api');
const env = Object.fromEntries(fs.readFileSync(((f) => (fs.existsSync(f) ? f : path.resolve(__dirname, '..', '..', 'zoomcut', '.env')))(path.resolve(__dirname, '..', 'design.env')), 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const admin = require(path.join(API, 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'boostmind-b052c' });
const w = require(path.join(API, 'wiki.js'));
const price = (u) => (((u.input_tokens || 0) - (u.input_tokens_details?.cached_tokens || 0)) * 2 + (u.input_tokens_details?.cached_tokens || 0) * 0.2 + (u.output_tokens || 0) * 12) / 1e6;
const TESTS = (process.argv[2] ? JSON.parse(process.argv[2]) : [
  ['guide', 'היי'], ['guide', 'יו מה הולך אחי'], ['guide', 'מי זה עמי?'], ['guide', 'יש סרטון על חתונה?'],
  ['rosenblum', 'היי'], ['rosenblum', 'מה דעתך על המנהלת אסתר?'], ['yotam', 'מה אתה חושב על וובה?'],
]);
(async () => {
  await w._canon();  // load the brain first, so its download doesn't count
  for (const [mode, q] of TESTS) {
    const t0 = Date.now(); let first = 0, text = '';
    const u = await w._stream(env.OPENAI_API_KEY, mode, [{ role: 'user', content: q }], (t) => { if (!first) first = Date.now() - t0; text += t; });
    console.log(`${mode} | ${q} | first word ${(first / 1000).toFixed(1)}s, all ${((Date.now() - t0) / 1000).toFixed(1)}s | $${price(u).toFixed(4)}\n   ${text.replace(/\n+/g, ' ').slice(0, 220)}`);
  }
  process.exit(0);
})();
