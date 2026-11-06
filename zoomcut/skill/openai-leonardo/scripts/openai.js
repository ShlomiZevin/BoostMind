#!/usr/bin/env node
/**
 * The OpenAI helper: ask any GPT model (Terra, SOL, Luna, pro...) and write the answer to a UTF-8 file.
 *
 * FILE IN, FILE OUT — ON PURPOSE. The Windows console mangles Hebrew in both
 * directions: a Hebrew prompt typed into a shell heredoc arrives as broken
 * bytes and the API rejects the JSON, and a Hebrew answer printed to stdout
 * comes back as question marks even when the response itself is fine. Both
 * were hit for real. Passing files sidesteps the console entirely.
 *
 * Usage:
 *   node openai.js --in brief.txt --out answer.md
 *   node openai.js --in brief.txt --out answer.md --model gpt-5.6-terra
 *   node openai.js --prompt "short ascii question" --out answer.md
 *   node openai.js --models          # list what this key can actually reach
 */

const fs = require('fs');
const path = require('path');

const API = 'https://api.openai.com/v1';

/** Where to look for a key, in order. The last entry is this machine's default. */
const ENV_CANDIDATES = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', '.env'),
  'C:\\workspace\\aspect\\aspect-agent-server\\.env',
];

// Inside the Shlomiverse (c:/workspace/BoostMind) its design key always wins, so Backstage -> הוצאות counts the call
// as the verse's (node scripts/design-env.mjs writes it). Anywhere else: the order below.
const VERSE = 'c:\\workspace\\boostmind';
function readKey(explicitEnv) {
  if (process.cwd().toLowerCase().startsWith(VERSE)) {
    try {
      const m = fs.readFileSync(path.join(VERSE, 'scripts', 'design.env'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m);
      if (m) return m[1].trim();
    } catch { /* not written on this computer yet */ }
    throw new Error('Inside the Shlomiverse: run  node scripts/design-env.mjs  once (the design key), then again.');
  }
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const files = explicitEnv ? [explicitEnv, ...ENV_CANDIDATES] : ENV_CANDIDATES;
  for (const file of files) {
    try {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (line.startsWith('OPENAI_API_KEY=')) return line.slice(15).trim();
      }
    } catch { /* try the next candidate */ }
  }
  throw new Error(`No OPENAI_API_KEY found. Looked in: ${files.join(', ')}`);
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = flag => process.argv.includes(flag);

async function listModels(key) {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json();
  const ids = (data.data || []).map(m => m.id).sort();
  const interesting = ids.filter(id => /gpt-5\.[4-9]|gpt-image-2|pro$/.test(id));
  console.log(interesting.join('\n'));
  console.log(`\n(${ids.length} total models on this key)`);
}

async function main() {
  const key = readKey(arg('--env'));

  if (has('--models')) return listModels(key);

  const model = arg('--model', 'gpt-5.6-sol');
  const inFile = arg('--in');
  const outFile = arg('--out');
  const systemFile = arg('--system');
  const effort = arg('--effort'); // low | medium | high

  if (!outFile) throw new Error('--out <file> is required (Hebrew must not go through stdout)');

  let prompt = arg('--prompt');
  if (inFile) prompt = fs.readFileSync(inFile, 'utf8');
  if (!prompt) throw new Error('Give either --in <file> (preferred) or --prompt "<ascii text>"');

  // Screenshots or drafts for SOL to look at: --image a.png --image b.jpg
  const images = process.argv.flatMap((a, i) => (a === '--image' && process.argv[i + 1] ? [process.argv[i + 1]] : []));
  const mime = p => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(p).toLowerCase()] || 'image/png';

  const input = images.length === 0 ? prompt : [{
    role: 'user',
    content: [
      { type: 'input_text', text: prompt },
      ...images.map(p => ({ type: 'input_image', image_url: `data:${mime(p)};base64,${fs.readFileSync(p).toString('base64')}` })),
    ],
  }];

  const body = { model, input };
  if (systemFile) body.instructions = fs.readFileSync(systemFile, 'utf8');
  if (effort) body.reasoning = { effort };

  // --schema file.json: the answer must be JSON matching this schema (strict
  // structured output), for content a program will render verbatim.
  const schemaFile = arg('--schema');
  if (schemaFile) {
    body.text = { format: { type: 'json_schema', name: 'output', strict: true, schema: JSON.parse(fs.readFileSync(schemaFile, 'utf8')) } };
  }

  // --background: long generations can outlast the HTTP client's header timeout
  // (Node's fetch gives up after 300s), so queue the job and poll for it.
  const background = has('--background');
  if (background) Object.assign(body, { background: true, store: true });

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${API}/responses`, { method: 'POST', headers, body: JSON.stringify(body) });

  let data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI refused (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  }

  const started = Date.now();
  while (background && (data.status === 'queued' || data.status === 'in_progress')) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = await fetch(`${API}/responses/${data.id}`, { headers });
    data = await poll.json();
    if (!poll.ok) throw new Error(`Polling failed (${poll.status}): ${JSON.stringify(data).slice(0, 500)}`);
    console.log(`  ${data.status} ${Math.round((Date.now() - started) / 1000)}s`);
  }
  if (data.status && data.status !== 'completed') {
    throw new Error(`Response ${data.status}: ${JSON.stringify(data.error || data.incomplete_details || {}).slice(0, 500)}`);
  }

  // The Responses API nests text under output[].content[].type === 'output_text',
  // interleaved with reasoning items that carry no content. Collect only the text.
  const text = (data.output || [])
    .flatMap(item => item.content || [])
    .filter(c => c.type === 'output_text')
    .map(c => c.text)
    .join('\n');

  if (!text.trim()) {
    throw new Error(`No text came back. Raw: ${JSON.stringify(data).slice(0, 500)}`);
  }

  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, text, 'utf8');

  const usage = data.usage || {};
  const reasoning = usage.output_tokens_details?.reasoning_tokens;
  console.log(`OK -> ${outFile}  (${text.length} chars, ${model}, ${usage.total_tokens || '?'} tokens)`);
  console.log(`  input ${usage.input_tokens ?? '?'} · output ${usage.output_tokens ?? '?'}${reasoning != null ? ` (reasoning ${reasoning})` : ''}`);
  console.log('Read it with the Read tool — printing Hebrew to this console will mangle it.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
