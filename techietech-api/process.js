// A process run by a character of the Shlomiverse (Miriam's check-in, Demokratovich's booth, Yotam's simulation test): the SAME
// chat the residents speak in (wiki.js persona - the map, their voice, who they know, their full material), told that this is not
// a normal chat but a process with its own steps, and answering in a JSON schema. His ask (2026-11-07): the jokes at the level
// of the chat, whatever it costs. The key is the caller's (the site's key: Backstage → הוצאות counts it under "site").
const { persona } = require('./wiki');
const MODEL = 'gpt-5.6-terra';

const FRAME = (task) => `THIS IS NOT A NORMAL CHAT. Right now you are running a process on the Shlomiverse site, in your own voice - exactly as funny, specific and in character as you are in the chat, but you follow the process below and you answer only in the JSON fields asked for (no cards like [[video:...]], no links, no sign-in talk, nothing outside the fields). The visitor taps answers or types short ones; your words are shown on one phone screen, so keep each field short.

THE PROCESS:
${task}`;

// history: [{ role: 'assistant' | 'user', content }] - what was said so far in the process
async function run(key, mode, history, task, schema, name, effort = 'low') {
  const p = await persona(mode);
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, instructions: p.instructions, input: [...history, { role: 'developer', content: p.dev + '\n\n' + FRAME(task) }],
      reasoning: { effort }, max_output_tokens: 1600, store: false, prompt_cache_key: 'wiki-map',
      text: { format: { type: 'json_schema', name, strict: true, schema } } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`openai ${r.status} ${j.error?.message || ''}`);
  const text = (j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '{}';
  const u = j.usage || {};
  return { out: JSON.parse(text), u: [u.input_tokens || 0, u.input_tokens_details?.cached_tokens || 0, u.output_tokens || 0] };
}
module.exports = { run };
