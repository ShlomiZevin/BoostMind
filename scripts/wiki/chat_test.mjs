// Run the wiki chat locally against the real API with the same request the function sends.
//   node scripts/wiki/chat_test.mjs scripts/wiki/work/chat-cases.json scripts/wiki/work/chat-out.md
// cases: [{ "mode": "guide" | "<character id>", "messages": [{ "role": "user", "content": "..." }] }]
// The key: WIKI_OPENAI_KEY, else the aspect server's .env (the working one, see MARKETING.md).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ENV = 'C:/workspace/aspect/aspect-agent-server/.env';
const KEY = process.env.WIKI_OPENAI_KEY || fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim().replace(/^"|"$/g, '');
const api = '../../techietech-api/';
const { _stream } = require(api + 'wiki.js');

const [casesFile, outFile] = process.argv.slice(2);
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
const out = [];
for (const c of cases) {
  const t0 = Date.now();
  let first = 0, text = '';
  const u = await _stream(KEY, c.mode, c.messages, (t) => { first ||= Date.now() - t0; text += t; });
  out.push(`## ${c.mode}: ${c.messages.at(-1).content}

${text}

_first token ${first} ms · total ${Date.now() - t0} ms · in ${u.input_tokens} · cached ${u.input_tokens_details?.cached_tokens} · out ${u.output_tokens}_
`);
  console.log(c.mode, 'first', first, 'ms; in', u.input_tokens, 'cached', u.input_tokens_details?.cached_tokens, 'out', u.output_tokens);
}
fs.writeFileSync(outFile, out.join('\n'));
