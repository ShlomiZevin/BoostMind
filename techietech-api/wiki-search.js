// The chat's video search (his idea 2026-11-08: "like RAG, but dedicated and smarter"). The map no longer carries every
// video's card - they were 70% of it, paid on every question, and grew with every video he adds; it lists the videos by title
// only. When a question is about a video by what happens in it, look_up's `search` runs ONE extra call here: Terra reads the
// index of all the videos (title, cast, card) and returns the ids that match. The index is the same text on every search, so
// OpenAI serves it from its cache (~0.4c a search at ~270 videos); small talk and questions about people never pay for it.
// Embeddings were measured first and lost: on Hebrew they ranked the right video 4th-126th ("חתונה" found the wedding video
// at 50-126 with text-embedding-3-small / -large), where reading the cards finds it - so no vector store, no Pinecone.
// When the index passes ~1,000 videos (~70K tokens), filter it first (by world / date / words) before this call.
const MODEL = 'gpt-5.6-terra', MAX = 6;

let cache = { md5: null, text: '' };
const indexOf = (cur) => {
  if (cache.md5 === cur.md5) return cache.text;
  const lines = Object.values(cur.videos).map((v) => [v.id, v.date || '', v.title, (v.cast || []).map((id) => cur.byId[id]?.name || id).join(', '),
    v.card || v.teaser || ''].join(' | '));
  cache = { md5: cur.md5, text: `You find videos of the Shlomiverse (a Hebrew comedy world) by what happens in them. Below is every video: id | date | title | cast | what happens.
Given the words a visitor's question is about, return the ids of the videos that match - by meaning, not only exact words (a wedding mentioned in passing counts; "the cashier" finds a supermarket scene). Best match first, at most ${MAX}; none when nothing matches - never a guess.

${lines.join('\n')}` };
  return cache.text;
};

// the ids of the videos `words` are about, best first (cur = wiki.js canonNow())
async function search(key, cur, words) {
  if (!words || !String(words).trim()) return [];
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, instructions: indexOf(cur), input: [{ role: 'user', content: String(words).slice(0, 300) }],
      reasoning: { effort: 'low' }, max_output_tokens: 600, store: false, prompt_cache_key: 'wiki-videos',
      text: { format: { type: 'json_schema', name: 'found', strict: true,
        schema: { type: 'object', additionalProperties: false, required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } } } } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`search ${r.status} ${j.error?.message || ''}`);
  const text = (j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '{}';
  const u = j.usage || {};
  console.log('wiki-search', JSON.stringify(String(words).slice(0, 60)), 'in', u.input_tokens, 'cached', u.input_tokens_details?.cached_tokens, 'out', u.output_tokens);
  return { ids: (JSON.parse(text).ids || []).filter((id) => cur.videos[id]).slice(0, MAX), usage: u };
}

module.exports = { search };
