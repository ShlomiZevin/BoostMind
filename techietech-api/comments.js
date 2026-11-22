// The residents in the comments under a video (his ask 2026-11-22): whoever comments - tagged or not - the residents in the video
// answer back, and when a video goes up everyone in it comments at once, so no video is ever empty. They speak exactly as in
// the chat: the same chain (wiki-deep.js post(), where 'comments' - the director on their page + the writer); the only thing
// added is where they are and the video itself.
//   answerer()  who answers a fan's new comment - verse.js comment() asks it before saving (so the page shows "writing...")
//   reply()     that resident's answer in the thread
//   debut()     a new video: each resident in it writes a comment, in cast order, each seeing the ones before
// Plain functions with the keys passed in, so a session runs them locally (scripts/verse/debut-comments.cjs) with the same code.
const deep = require('./wiki-deep');

// who answers: a tagged resident; a fan answering a resident (or continuing their own thread a resident is in) gets that
// resident back; a fan answering another fan is theirs - nobody jumps in. A new comment on a video: the one in the video it is
// for - one resident in it = them; several = the model reads the comment and picks (judgement, never a rule)
async function answerer({ db, key, video, mention, parentId, replyTo, uid, text, byId }) {
  if (mention) return mention;
  const cast = ((video && video.cast) || []).filter((c) => byId[c]);
  if (parentId) {
    const to = (await db.collection('comments').doc(replyTo || parentId).get()).data();
    if (!to) return null;
    if (to.char) return byId[to.char] ? to.char : null;
    if (to.uid !== uid) return null;
    const thread = await db.collection('comments').where('parentId', '==', parentId).orderBy('t', 'desc').limit(12).get().catch(() => null);
    const last = thread && thread.docs.map((d) => d.data()).find((x) => x.char && byId[x.char]);
    return last ? last.char : null;
  }
  if (!cast.length) return null;
  if (cast.length === 1) return cast[0];
  return pick(key, video, cast.map((c) => byId[c]), text).catch((e) => { console.error('comments pick', e.message); return cast[0]; });
}

async function pick(key, video, people, text) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-6.1-terra', reasoning: { effort: 'low' }, max_output_tokens: 300, store: false,
      input: `A comment under the video "${video.title}"${video.teaser ? ` (${video.teaser})` : ''}: "${text}"
In the video: ${people.map((c) => `${c.id} = ${c.name}`).join(', ')}.
Which one of them would answer this comment - the one it is about or for (if it is for all of them, the first)? Answer only the id.`,
    }),
  });
  if (!res.ok) throw new Error('openai ' + res.status);
  const j = await res.json();
  const out = (j.output || []).flatMap((o) => o.content || []).map((x) => x.text || '').join('').trim();
  return (people.find((c) => out.includes(c.id)) || people[0]).id;
}

// what is said in the video: its transcript, or - when it came without one (the studio's uploads of 2026-11-18/19 had only the
// on-screen line) - its sound heard once (gpt-4o-mini-transcribe, ~0.3c a minute; the file must be under OpenAI's 25 MB)
const heard = new Map();
async function wordsOf(key, video, words) {
  if (String(words || '').trim()) return words;
  const src = video.src && String(video.src).split('?')[0];
  if (!src) return '';
  if (!heard.has(src)) heard.set(src, (async () => {
    const r = await fetch(src);
    if (!r.ok) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 25e6) return '';
    const fd = new FormData();
    fd.append('model', 'gpt-4o-mini-transcribe'); fd.append('language', 'he');
    fd.append('file', new Blob([buf], { type: 'video/mp4' }), 'v.mp4');
    const t = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd });
    return t.ok ? String((await t.json()).text || '') : '';
  })().catch((e) => { console.error('comments hear', e.message); return ''; }));
  return heard.get(src);
}

const said = (byId, x) => `${x.char ? (byId[x.char] && byId[x.char].name) || x.nick : x.nick}: ${x.text}`;
// a resident in the video: it is THEIR video - what happens in it happened to them, it is them on the screen (his note 2026-11-22:
// Night Guy commented "I do exactly the same at home" under his own video)
const inIt = (video, c) => {
  if (!(video.cast || []).includes(c.id)) return '';
  const others = (video.cast || []).filter((x) => x !== c.id);
  return ` This is ${c.name}'s own video: ${c.name} is the one in it${others.length ? ' (with others from their life)' : ''} - what happens in it is ${c.name}'s own life, and ${c.name} knows it is them people are watching.`;
};
const theVideo = (video, words, onScreen, c) => `The video: "${video.title}"${video.teaser ? ` - ${video.teaser}` : ''}.${inIt(video, c)}${onScreen ? `
Written on the screen: ${String(onScreen).replace(/\s+/g, ' ').trim()}` : ''}
What is said in it:
${String(words || '').slice(0, 6000) || '(no words)'}`;

// the answer to a fan's comment; thread = the comments before it in the same thread (oldest first), comment = the new one;
// mine = this resident's own last comments
async function reply({ key, akey, cur, who, video, words, onScreen = '', thread = [], comment, mine = [] }) {
  const c = cur.byId[who];
  words = await wordsOf(key, video, words);
  const scene = `${theVideo(video, words, onScreen, c)}
${thread.length ? `\nThe comments in this thread so far:\n${thread.map((x) => said(cur.byId, x)).join('\n')}\n` : ''}
${comment.nick} just wrote${thread.length ? '' : ' a comment'}: "${comment.text}"
${c.name} answers ${comment.nick} there.`;
  return deep.post({ key, akey, cur, mode: who, scene, last: mine, where: 'comments' });
}

// a new video: each resident in it comments, in cast order; out(id, text, r) saves one (or prints it, in a dry run);
// mineOf(id) = that resident's own last comments
async function debut({ key, akey, cur, video, words, onScreen = '', out, mineOf = async () => [] }) {
  const done = [];
  let cost = 0;
  words = await wordsOf(key, video, words);
  for (const id of (video.cast || []).filter((x) => cur.byId[x])) {
    const c = cur.byId[id];
    const scene = `${theVideo(video, words, onScreen, c)}

The video just went up.${done.length ? ` The comments under it so far:\n${done.map((x) => said(cur.byId, x)).join('\n')}` : ' Nobody has commented yet.'}
${c.name} writes a comment under it.`;
    const r = await deep.post({ key, akey, cur, mode: id, scene, last: await mineOf(id), where: 'comments' });
    cost += r.cost || 0;
    if (!r.text) continue;
    done.push({ char: id, nick: c.name, text: r.text });
    await out(id, r.text, r);
  }
  return { comments: done, cost };
}

// a resident's own last comments anywhere (so a new one isn't the same take again) - sorted here, no index needed
async function mine(db, id, n = 5) {
  const s = await db.collection('comments').where('char', '==', id).select('text', 't').get().catch(() => null);
  return s ? s.docs.map((d) => d.data()).sort((a, b) => (b.t?.toMillis?.() || 0) - (a.t?.toMillis?.() || 0)).slice(0, n).map((x) => x.text) : [];
}

module.exports = { answerer, reply, debut, mine };
