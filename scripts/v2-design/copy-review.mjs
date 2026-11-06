// Terra writes the Shlomiverse v2 copy: sends v2/site/verse/copy.js, gets the same file back with better Hebrew.
//   node scripts/v2-design/copy-review.mjs <out.js>
import fs from 'node:fs';
const envKey = (file, name) => { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, ''); } catch { return undefined; } };
const KEY = envKey('C:/workspace/BoostMind/zoomcut/.env', 'OPENAI_API_KEY') || envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const src = fs.readFileSync('C:/workspace/BoostMind/v2/site/verse/copy.js', 'utf8');
const brief = `You write the Hebrew interface copy for שלומיוורס (the Shlomiverse): Shlomi Zevin's comedy universe, where his recurring
characters are treated as real people with their own lives. Fans sign in, follow characters, comment (characters answer when
tagged), make a "sticker from the moment" from a video frame, and get notifications when something happens to a character.
Fans keep commenting "אנחנו חיים בסימולציה" - the world feels real. The look is calm and premium, like a boutique streaming app,
not TikTok. Tagline idea from Shlomi: "שלומיוורס. אנשים אמיתיים. יקום מקביל."

Rewrite the strings in this JavaScript file so they read like a great Israeli product: natural spoken Hebrew, short, warm,
a little witty where it fits (the empty states, the welcome, the sticker progress lines), never cute or salesy. Rules:
- Address the fan in plural (עקבו, תגובה שלכם) so no gender is guessed. Characters' actions: phrase them without a gendered
  verb when the character is a variable (e.g. "סרטון חדש מ\${n}" not "\${n} העלה").
- Keep every key, every function and its parameters, and the exact JavaScript structure. Only change the text inside quotes and
  template literals. Keep \${...} placeholders exactly. Keep "Google", "WhatsApp" spellings. No emoji. Keep button labels short
  (the approved designs: "סטיקר מהרגע", "פרסם בשלומיוורס", "לוואטסאפ", "תגובות", "שמירה", "שיתוף", "כניסה עם Google",
  "להפעיל התראות", "אולי אחר כך", "נכנסים לשלומיוורס", "הצג הכל" stay as they are).
- Never promise anything on Shlomi's behalf; the contact lines must say it reaches Shlomi and nothing is promised.
Return ONLY the full JavaScript file, nothing before or after it.`;
const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-5.6-terra', instructions: brief, input: src, reasoning: { effort: 'medium' }, max_output_tokens: 20000, store: false }),
});
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
const text = (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('').replace(/^```(?:js|javascript)?\n|```\s*$/g, '');
fs.writeFileSync(process.argv[2], text);
console.log('ok', process.argv[2], j.usage?.output_tokens);
