// Side by side: the wiki chat's OLD answer (the whole brain on every question) vs the chain (techietech-api/wiki-chain.js).
//   node scripts/wiki/chain_test.cjs [out.html]     (local Google credentials for the brain, the OpenAI key in zoomcut/.env)
// Writes an RTL page with both answers per question + cost and time, for Shlomi to judge. ~$3 (the old way is ~80K tokens a call).
const fs = require('fs');
const path = require('path');
const API = path.resolve(__dirname, '..', '..', 'techietech-api');
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname, '..', '..', 'zoomcut', '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const admin = require(path.join(API, 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'boostmind-b052c' });
const w = require(path.join(API, 'wiki.js'));
const KEY = env.OPENAI_API_KEY;
const price = (u) => (((u.input_tokens || 0) - (u.input_tokens_details?.cached_tokens || 0)) * 2 + (u.input_tokens_details?.cached_tokens || 0) * 0.2 + (u.output_tokens || 0) * 12) / 1e6;

// conversations: [mode, [user messages]] - each later message sees the earlier answers of the same way
const TESTS = [
  ['guide', ['מי זה המורה רוזנבלום?', 'ומי זה יותם?', 'מי מהשניים יותר מצחיק לדעתך?']],
  ['guide', ['יש סרטון על מעלית?']],
  ['guide', ['יש סרטון על חתונה?']],
  ['guide', ['מי בשלומיוורס מדבר על AI?']],
  ['guide', ['מה הסרטון הכי מצחיק באתר?']],
  ['guide', ['תכיר לי את האנשים של טקי-טק']],
  ['guide', ['יש משהו על איראן?']],
  ['rosenblum', ['מה אתה חושב על יותם?']],
  ['yotam', ['מה אתה חושב על וובה?', 'ומה עם עידו?']],
  ['vova', ['מה דעתך על אסנת?']],
  ['nephew', ['אתה מכיר את ליאור סליים?']],
  ['demokratovich', ['מה דעתך על הרבנית?']],
  ['oded', ['מה דעתך על נהור?']],
  ['ayelet', ['איזה תדר יש לי היום?']],
];

async function oldWay(mode, turns) {
  const cur = await w._canon();
  const brain = JSON.parse(fs.readFileSync(path.join(API, 'wiki-brain.json'), 'utf8'));  // the same build that was pushed
  const system = w._test.RULES + '\n\n' + w._test.canon(brain);
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5.6-terra', instructions: system, input: [{ role: 'developer', content: w._test.modeText(mode, cur.byId, false) }, ...turns],
      reasoning: { effort: 'low' }, max_output_tokens: 2500, store: false }),
  });
  const r = await res.json();
  const text = (r.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content).find((c) => c.type === 'output_text')?.text || JSON.stringify(r).slice(0, 300);
  return { text, usd: price(r.usage || {}) };
}

async function newWay(mode, turns) {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => { if (String(a[0]).startsWith('wikiChat picked')) logs.push(a.join(' ')); else orig(...a); };
  let text = '';
  const u = await w._stream(KEY, mode, turns, (t) => { text += t; });
  console.log = orig;
  const pk = logs.pop() || '';
  const m = pk.match(/router in (\d+) cached (\d+) out (\d+)/);
  const ru = m ? { input_tokens: +m[1], input_tokens_details: { cached_tokens: +m[2] }, output_tokens: +m[3] } : {};
  const picked = (pk.match(/\{"c".*?\}(?= material)/) || [''])[0];
  return { text, usd: price(u) + price(ru), picked };
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
(async () => {
  const cur = await w._canon();
  const rows = [];
  let tOld = 0, tNew = 0;
  for (const [mode, msgs] of TESTS) {
    const oldT = [], newT = [];
    for (const q of msgs) {
      oldT.push({ role: 'user', content: q }); newT.push({ role: 'user', content: q });
      const t0 = Date.now(); const a = await oldWay(mode, oldT); const s1 = (Date.now() - t0) / 1000;
      const t1 = Date.now(); const b = await newWay(mode, newT); const s2 = (Date.now() - t1) / 1000;
      oldT.push({ role: 'assistant', content: a.text }); newT.push({ role: 'assistant', content: b.text });
      tOld += a.usd; tNew += b.usd;
      rows.push({ who: mode === 'guide' ? 'המדריך' : cur.byId[mode]?.name || mode, q, a, b, s1, s2 });
      console.log(`${mode} | ${q} | old $${a.usd.toFixed(3)} ${s1.toFixed(1)}s | new $${b.usd.toFixed(3)} ${s2.toFixed(1)}s ${b.picked}`);
    }
  }
  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>הצ'אט: הדרך הישנה מול החדשה</title>
<style>body{font-family:Assistant,Arial,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;background:#14110f;color:#f3ece6}
h1{font-size:22px}.q{margin:22px 0 6px;font-weight:700}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{background:#221d1a;border-radius:10px;padding:12px;white-space:pre-wrap;line-height:1.5}.box b{display:block;color:#ff9a62;margin-bottom:6px}
.meta{font-size:12px;color:#a99;margin-top:8px}.sum{background:#2a2420;padding:12px;border-radius:10px}</style></head><body>
<h1>הצ'אט של השלומיוורס: הדרך הישנה מול החדשה</h1>
<div class="sum">אותן שאלות, אותו מודל (Terra). ישנה = כל הוויקי בכל שאלה. חדשה = מפה קצרה + רק מה שהשאלה צריכה.<br>
סה"כ: ישנה $${tOld.toFixed(2)} · חדשה $${tNew.toFixed(2)} (בבדיקה הזאת בלי מטמון - באתר שתיהן זולות יותר, החדשה הרבה יותר).</div>
${rows.map((r) => `<div class="q">${esc(r.who)}: ${esc(r.q)}</div><div class="pair">
<div class="box"><b>ישנה</b>${esc(r.a.text)}<div class="meta">$${r.a.usd.toFixed(3)} · ${r.s1.toFixed(1)} שניות</div></div>
<div class="box"><b>חדשה</b>${esc(r.b.text)}<div class="meta">$${r.b.usd.toFixed(3)} · ${r.s2.toFixed(1)} שניות · ${esc(r.b.picked)}</div></div></div>`).join('\n')}
</body></html>`;
  const out = process.argv[2] || path.join(__dirname, 'work', 'chain-test.html');
  fs.writeFileSync(out, html);
  console.log(`\nold $${tOld.toFixed(2)} vs new $${tNew.toFixed(2)} -> ${out}`);
  process.exit(0);
})();
