// A character's full material, as the chat gets it (wiki-chain.js material): the whole profile + the transcripts of their own
// videos, newest first, within the chat's limit. His rule (2026-11-07): Miriam, Demokratovich and the simulation test's Yotam must
// be as funny as the chat - so they get the same material, even if it costs more (it is the same text every call of that
// character, so OpenAI serves most of it from its cache).
const MAX = 30000;   // = wiki-chain.js MAX_MATERIAL

module.exports = function material(brain, id, max = MAX) {
  const c = (brain.characters || []).find((x) => x.id === id);
  if (!c) return '';
  const vids = new Map((brain.videos || []).map((v) => [v.id, v]));
  const own = (c.videos || []).map((v) => vids.get(v)).filter((v) => v && v.transcript)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  let out = `### ${c.name} (id ${c.id}) - full profile\n` + JSON.stringify(c).replaceAll('https://boostmind-b052c.web.app', 'https://shlomiverse.com');
  if (own.length) out += '\n\n## Their own videos (their real words - use their phrases, references and rhythm; never retell these scenes)';
  for (const v of own) {
    const s = `\n\n### "${v.title}" (${v.date || ''})\n${v.transcript}`;
    if (out.length + s.length > max) break;
    out += s;
  }
  return out;
};
