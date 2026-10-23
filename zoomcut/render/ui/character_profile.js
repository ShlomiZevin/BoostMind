// A character's profile as text for a writing session: paste it, then say what we write ("now a script about...").
// One builder for the Characters page's "Copy profile for a session" button and for the profile.md written next to
// every character (tools/character_profiles.mjs) - so a session can also just read zoomcut/characters/<id>/profile.md.
// Only what a writer needs: who they are, how they behave and talk, their look, the rules, the people around them,
// their site and what their videos already did. No file paths, no ids.

const list = (xs) => (xs || []).filter(Boolean).map((x) => `- ${typeof x === 'string' ? x : x.text || JSON.stringify(x)}`).join('\n');
const sec = (title, body) => (body && String(body).trim() ? `## ${title}\n${String(body).trim()}\n` : '');

/** c: the character (with videos as [{id, title}] or ids), all: every character (for the relations' names / roles). */
export function profileText(c, all = []) {
  const byId = Object.fromEntries(all.map((x) => [x.id, x]));
  const name = c.name || c.id;
  const pace = c.pace?.wpm
    ? `${c.pace.wpm} words per minute (measured on a real script) - a 10-second line is about ${Math.round(c.pace.wpm / 6)} words; keep lines to what fits the moment.`
    : '';
  const voice = [c.voice?.preset && `Voice in the edit: ${c.voice.preset}`, c.voice?.notes].filter(Boolean).join(' - ');
  const rel = (c.relations || []).map((r) => {
    const o = byId[r.id];
    return `- ${o?.name || r.id}${o?.role ? ` (${o.role})` : ''}: ${r.relation}`;
  }).join('\n');
  const vids = (c.videos || []).map((v) => (typeof v === 'string' ? (byId.__videos?.[v] || v) : v.title || v.id));
  const site = c.site?.url ? `${c.site.url}${c.site.notes ? `\n${c.site.notes}` : ''}` : '';
  return [
    `# Character profile: ${name}${c.name_en ? ` (${c.name_en})` : ''}`,
    `Read this before you write anything for or about this character - it is who they are. Next I'll tell you what we're writing.`,
    '',
    `**${c.role || ''}**${c.world ? ` · ${c.world}` : ''}${c.aka?.length ? ` · also: ${c.aka.join(', ')}` : ''}`,
    '',
    sec('Who they are', c.brief),
    sec('Personality', list(c.personality)),
    sec('What they do', list(c.behavior)),
    sec('How they talk', [list(c.speech), c.catchphrases?.length ? `Catchphrases (use sparingly, only where they come naturally):\n${list(c.catchphrases)}` : '', pace].filter(Boolean).join('\n\n')),
    sec("What's funny about them", list(c.comedy)),
    sec('Look (on camera)', c.look),
    sec('Voice', voice),
    sec('Rules when writing them', list([...(c.writing_rules || []), ...(c.dont || []).map((d) => `Never: ${d}`)])),
    sec('People around them', rel),
    sec('Their website', site),
    sec('Already done - topics and storylines (don\'t repeat)', list([...(c.themes || []), ...(!(c.themes || []).length ? vids : [])])),
  ].filter((x) => x !== null && x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
