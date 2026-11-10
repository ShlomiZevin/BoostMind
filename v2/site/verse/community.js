// The community (Shlomi, 2026-11-01: "everything super convenient and shareable, a community that's involved"; the
// mockups in Documents/shlomiverse-v2-design/community): the ideas wall "what's next in the Shlomiverse" with +1 votes,
// asking a character, asking for a video, "something isn't working", and the business page. The forms reach Shlomi
// through the `request` op (signed out too); ideas and votes need an account.
import { db, F, call } from './fb.js';
import { T } from './copy.js';
import { I, esc, av, ago, sheet, toast, track, LIKE, ofc, abs, catchphrase, brand } from './ui.js';
import { storyFaces } from './stories.js';
import { waCard } from './player.js';
import { st, onState, needFan, signedIn, signInSheet } from './state.js';

// ---------- the ideas, live ----------
let ideas = [], myVotes = new Set(), sort = 'top', focusIdea = null, offVotes = null;
const subs = new Set();
export const onIdeas = (fn) => subs.add(fn);
const emit = () => subs.forEach((fn) => fn());
// the ready sticker pack (his ask 2026-11-02): the characters' classic lines, made by scripts/v2-design/sticker-pack.mjs
let PACK = [];
fetch('/verse/pack/pack.json').then((r) => (r.ok ? r.json() : [])).then((x) => { PACK = x; emit(); }).catch(() => {});
F.onSnapshot(F.query(F.collection(db, 'ideas'), F.where('hidden', '==', false), F.orderBy('votes', 'desc'), F.limit(60)),
  (s) => { ideas = s.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); }, (e) => console.error('ideas', e));
onState(() => {
  if (offVotes) { offVotes(); offVotes = null; }
  if (!st.user) { myVotes = new Set(); return; }
  offVotes = F.onSnapshot(F.collection(db, 'fans', st.user.uid, 'votes'), (s) => { myVotes = new Set(s.docs.map((d) => d.id)); emit(); }, () => {});
});
const sorted = () => (sort === 'new' ? [...ideas].sort((a, b) => (b.t?.toMillis?.() || Date.now()) - (a.t?.toMillis?.() || Date.now())) : ideas);

// where the idea is on its way (marked in /backstage/): the Shlomiverse liked it / on its way to the screen / out, with its video
const stepBadge = (x) => (!T.ideaStep[x.status] ? '' : `<div class="idea-step s-${x.status}">${LIKE}<b>${esc(T.ideaStep[x.status])}</b>${x.status === 'live' && x.videoId
  ? `<a href="/v/${encodeURIComponent(x.videoId)}">${esc(T.ideaWatch)} ←</a>` : ''}</div>`);
function ideaCard(x) {
  const on = myVotes.has(x.id);
  const faces = (x.chars || []).filter((id) => C[id]).slice(0, 2);
  return `<div class="idea ${focusIdea === x.id ? 'hl' : ''}" id="idea-${x.id}">
    ${faces.length ? `<div class="idea-faces">${faces.map((id) => `<a href="/c/${id}" title="${esc(C[id].name)}">${av({ char: id, ring: true })}</a>`).join('')}</div>` : ''}
    <div class="idea-body"><div class="idea-by">${av({ fan: x })}<span>${esc(x.nick || '')}</span>${ofc(x)}${x.t ? `<small>${ago(x.t)}</small>` : ''}</div>
      <p>${esc(x.text)}</p>
      ${stepBadge(x)}
      ${x.reply?.text ? `<div class="idea-reply"><img src="/verse/logo-160.png" alt=""><span><b>${esc(T.ideaReplyBy)}</b>${esc(x.reply.text)}</span></div>` : ''}
      <div class="idea-foot">${T.ideaKinds[x.kind] && x.kind !== 'other' ? `<span class="idea-kind">${esc(T.ideaKinds[x.kind])}</span>` : '<span></span>'}
        <span class="idea-acts"><button class="vote ${on ? 'on' : ''}" data-vote="${x.id}" aria-label="+1">${LIKE}<b dir="ltr">${x.votes ? x.votes : '+1'}</b></button>
        <button class="icon-btn" data-share-idea="${x.id}" aria-label="${esc(T.ideaShare)}">${I.share}</button></span></div></div></div>`;
}

// ---------- the community page (#/community) ----------
export function communityPage(q = {}) {
  if (q.idea) { focusIdea = q.idea; setTimeout(() => document.getElementById('idea-' + q.idea)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }
  const top = W.characters.filter((c) => c.img && !NOT_IN_HERO.has(c.id)).sort((a, b) => (b.videos?.length || 0) - (a.videos?.length || 0)).slice(0, 5);
  const list = sorted();
  return `<div class="cmy">
    <section class="cmy-hero"><div class="cmy-faces">${top.map((c) => `<img src="${esc(c.img)}" alt="${esc(c.name)}">`).join('')}</div>
      <h1>${esc(T.cmTitle)}</h1><p>${esc(T.cmSub)}</p></section>
    <section class="cmy-ideas">
      <div class="cmy-ideas-h"><div><h2>${esc(T.ideasTitle)}</h2><p>${esc(T.ideasSub)}</p></div><button class="vx-btn main" data-idea-new>${I.plus}${esc(T.ideaCta)}</button></div>
      <div class="chips nt-chips"><button class="chip ${sort === 'top' ? 'on' : ''}" data-idea-sort="top">${esc(T.ideasTop)}</button><button class="chip ${sort === 'new' ? 'on' : ''}" data-idea-sort="new">${esc(T.ideasNew)}</button></div>
      <div class="ideas">${list.length ? list.map(ideaCard).join('') : `<div class="empty">${esc(T.ideasEmpty)}</div>`}</div>
    </section>
    <div class="cando cmy-st">${stickerTiles()}</div>
    ${tiles()}
    <a class="cmy-biz" href="/business"><div><h3>${esc(T.bizCard)}</h3><p>${esc(T.bizCardSub)}</p><span class="vx-pill">${esc(T.bizCta)}</span></div><img src="/verse/logo-512.png" alt=""></a>
  </div>`;
}
const tiles = () => `<div class="cmy-tiles">
    <button class="cmy-tile" data-ask-char>${I.comment}<b>${esc(T.askTile)}</b><small>${esc(T.askSub)}</small></button>
    <button class="cmy-tile" data-form="video">${I.play.replace('<svg', '<svg class="flip"')}<b>${esc(T.reqTile)}</b><small>${esc(T.reqSub)}</small></button>
    <button class="cmy-tile" data-form="bug">${I.bug}<b>${esc(T.bugTile)}</b><small>${esc(T.bugSub)}</small></button>
  </div>`;

// ---------- the band on the home page (under their part / the sign-in card) ----------
// first WHAT YOU CAN DO here (his note 2026-11-02: visitors know it from the marketing, not from the site; mockup
// golive/X-cando-a), the sticker as the hero; then the ideas; business shrinks to a link
const STICKER_FACE = ['yotam', 'hani', 'savta'];
// "go" points left in Hebrew - drawn, because a text "‹" gets mirrored in right-to-left lines (his note: it was opposite)
const GO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6"/></svg>';
// the two sticker tiles - on the home band and on the community page (his note 2026-11-03: stickers there too)
function stickerTiles() {
  const face = STICKER_FACE.find((id) => C[id] && C[id].img) || W.characters.find((c) => c.img)?.id;
  const line = face ? catchphrase(face) : '';
  const hero = PACK.find((p) => p.char === face) || PACK[0];   // a real sticker from the pack, once it has loaded
  return `<button class="cd-hero" data-do="sticker"><span class="cd-ic">${I.sticker}</span>
        <span class="cd-txt"><b>${esc(T.can.sticker[0])}</b><small>${esc(T.can.sticker[1])}</small></span>
        ${hero ? `<span class="cd-st cut"><img src="${esc(hero.thumb || hero.img)}" alt="${esc(hero.text)}"></span>`
          : face ? `<span class="cd-st"><img src="${abs(C[face].img)}" alt="">${line ? `<em>${esc(line)}</em>` : ''}</span>` : ''}</button>
      <button class="cd-pack" data-do="pack"><span class="cd-pk">${PACK.slice(0, 3).map((p) => `<img src="${esc(p.thumb || p.img)}" alt="">`).join('')}</span>
        <span class="cd-txt"><b>${esc(T.can.pack[0])}</b><small>${esc(T.can.pack[1])}</small></span><i>${GO}</i></button>`;
}
// "מה הלאה בשלומיוורס?" round 3 (his note 2026-11-10: on a computer the tiles sat randomly, pictures in random corners, and
// "לעסקים" was a tiny line - "I want businesses to reach out to me, to offer them advertising"; mockups scripts/v2-design/band.mjs
// B1 desktop, B3 / B4 phone). ONE card for all seven - its icon, title, line and picture always in the same places: a computer =
// 4 columns (the sticker card wide), a phone = the sticker card full width + 2 columns. Then the ideas row, then a real strip
// that sells advertising (-> /business, its form reaches him).
export function homeBand() {
  const top = ideas[0];
  const faces = storyFaces();
  const withImg = W.characters.filter((c) => c.img && !['savta'].includes(c.id));
  const face = (c) => (c ? `<img class="cx-round" src="${esc(abs(c.img))}" alt="" loading="lazy">` : '');
  const game = (W.games || []).find((g) => g.img), site = (W.site_list || []).find((x) => x.img);
  const sticker = STICKER_FACE.find((id) => C[id] && C[id].img) || withImg[0]?.id;
  const hero = PACK.find((p) => p.char === sticker) || PACK[0];
  const art = {
    sticker: hero ? `<img class="cx-cut" src="${esc(hero.thumb || hero.img)}" alt="">` : face(C[sticker]),
    pack: PACK.length ? `<span class="cx-pk">${PACK.slice(0, 3).map((p) => `<img src="${esc(p.thumb || p.img)}" alt="">`).join('')}</span>` : '',
    chat: face(C.yotam || withImg[0]),
    follow: face(C.avram || withImg[1]),
    stories: faces.length === 1 ? `<img class="cx-round" src="${esc(faces[0].img)}" alt="">` : faces.length ? `<span class="cx-rings">${faces.slice(0, 3).map((f) => `<img src="${esc(f.img)}" alt="">`).join('')}</span>` : face(withImg[2]),
    games: game ? `<img class="cx-cover" src="${esc(abs(game.img))}" alt="" loading="lazy">` : '',
    sites: site ? `<img class="cx-cover" src="${esc(abs(site.img))}" alt="" loading="lazy">` : '',
  };
  const ICON = { sticker: I.sticker, pack: I.sticker, chat: I.comment, follow: I.bell, stories: I.play, games: I.game, sites: I.bag };
  const card = (key) => `<button class="cx-t${key === 'sticker' ? ' big' : ''}" data-do="${key}"><span class="cx-ic">${ICON[key]}</span>
      <span class="cx-txt"><b>${esc(T.can[key][0])}</b><small>${esc(T.can[key][1])}</small></span><span class="cx-art">${art[key]}</span></button>`;
  return `<section class="cmy-band cx-band">
    <div class="cmy-ideas-h"><div><h2>${brand(T.ideasTitle)}</h2><p>${esc(T.canSub)}</p></div></div>
    <div class="cxg">${['sticker', 'pack', 'chat', 'follow', 'stories', 'games', 'sites'].map(card).join('')}</div>
    <div class="cx-idea"><div class="cx-idea-h"><div><b>${esc(T.canIdea)}</b><small>${esc(T.canIdeaSub)}</small></div>
      <button class="vx-btn main" data-idea-new>${I.plus}${esc(T.ideaCta)}</button></div>
      ${top ? `<div class="cx-idea-top">${ideaCard(top)}<a class="cd-all" href="/community">${esc(T.ideasAll)} ←</a></div>` : ''}</div>
    <button class="cx-biz" data-biz>
      <span class="cx-biz-art" aria-hidden="true"><img src="/verse/art/biz-media.jpg" alt="" loading="lazy"></span>
      <span class="cx-biz-txt"><em>${esc(T.biz2.tag)}</em><b>${brand(T.biz2.title)}</b><small>${esc(T.biz2.line)}</small>
        <span class="cx-biz-row"><span class="vx-btn main">${esc(T.biz2.cta)}</span>
          <span class="cx-chips">${T.biz2.chips.map((c, i) => `<span>${[I.planet, I.play, I.people][i]}${esc(c)}</span>`).join('')}</span></span></span></button>
  </section>`;
}
// a tile: straight to the thing (the sticker one opens a video with the sticker button pointed out)
function canDo(key, faces) {
  track('cando', key);
  if (key === 'sticker') {
    const vids = W.videos.filter((v) => v.src && !v.url).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 12);   // one of the newest
    const v = vids[Math.floor(Math.random() * vids.length)];
    if (v) nav('/v/' + v.id + '?how=sticker');
  } else if (key === 'pack') packSheet();
  else if (key === 'chat') openChat('guide');
  else if (key === 'follow') nav('/characters');
  else if (key === 'stories') nav(faces.length ? '/story/' + faces[0].id : '/characters');
  else if (key === 'games') nav('/games');   // every character's games (Hani's playhouse is one of them)
  else if (key === 'sites') nav('/sites');
}

// ---------- the ready sticker pack: a grid; a tap -> (an account) -> the "add to WhatsApp" window ----------
function packSheet() {
  if (!PACK.length) return;
  const h = sheet(`<div class="in pk"><h2 class="vx-h">${esc(T.packTitle)}</h2><p class="vx-sub">${esc(T.packSub)}</p>
      <div class="pk-grid">${PACK.map((p) => `<button data-pk="${esc(p.id)}" aria-label="${esc(p.text)}"><img src="${esc(p.thumb || p.img)}" alt="${esc(p.text)}" loading="lazy"></button>`).join('')}</div>
      <button class="vx-link pk-note" data-pk-own>${I.sticker}<span>${esc(T.packNote)}</span></button></div>`, { cls: 'pk-sheet' });
  h.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-pk-own]')) { h.close('own'); canDo('sticker', []); return; }
    const b = e.target.closest('[data-pk]');
    if (!b) return;
    const p = PACK.find((x) => x.id === b.dataset.pk);
    if (!p || !(await needFan('pack', p.char, { img: p.img, cut: true }))) return;
    track('pack_get', p.id);
    waCard(p.img);
  });
}

// ---------- the ready stickers inside the chat: [[sticker:ID]] (the chat review, 2026-11-03 - the chat only explained
// how to make one, once it said Hani has none). ID = a character (all their ready stickers) or one sticker; a slip of
// the model's ("h ani", "hami") goes to the nearest real one, nothing near = no card ----------
export function stickerCard(ref) {
  if (!PACK.length) return '';
  const id = String(ref || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const keys = [...new Set(PACK.flatMap((p) => [p.id, p.char]))];
  const key = keys.includes(id) ? id : nearest(id, keys);
  const list = PACK.filter((p) => p.id === key || p.char === key);
  if (!list.length) return '';
  return `<div class="mk"><div class="mk-row">${list.map((p) => `<button data-pk-chat="${esc(p.id)}" aria-label="${esc(p.text)}"><img src="${esc(p.thumb || p.img)}" alt="${esc(p.text)}" loading="lazy"></button>`).join('')}</div>
    <small>${esc(T.gain.pack.sub)}</small></div>`;
}
// the closest id (one or two letters off; one for a short id), and only when no other id is as close - a tie goes to the
// same length and the same first letter ("hami" = hani, not ami)
export function nearest(id, keys) {
  const lev = (a, b) => {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let p = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; }
    }
    return d[b.length];
  };
  const far = id.length <= 5 ? 1 : 2;
  const score = (k, n) => n * 4 + (k.length === id.length ? 0 : 2) + (k[0] === id[0] ? 0 : 1);
  const by = keys.map((k) => [k, lev(id, k)]).filter(([, n]) => n <= far).map(([k, n]) => [k, score(k, n)]).sort((a, b) => a[1] - b[1]);
  return by.length && (by.length === 1 || by[0][1] < by[1][1]) ? by[0][0] : null;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-pk-chat]');
  if (!b) return;
  const p = PACK.find((x) => x.id === b.dataset.pkChat);
  if (!p || !(await needFan('pack', p.char, { img: p.img, cut: true }))) return;
  track('pack_get', p.id + '|chat');
  waCard(p.img);
});

// ---------- an idea a visitor came up with in the chat: [[idea:KIND|TEXT]] - the character hands it over written up, one
// tap opens the idea sheet filled in (his ask, 2026-11-06: "like a box already filled with their idea, and submit") ----------
export function chatIdeaCard(kind, text, mode) {
  const t = String(text || '').trim().slice(0, 300);
  if (t.length < 4) return '';
  const k = T.ideaKinds[kind] ? kind : 'other';
  return `<div class="mi"><small>${esc(T.ideaChatT)} · ${esc(T.ideaKinds[k])}</small><blockquote>${esc(t)}</blockquote>
    <button class="vx-btn main small" data-idea-chat data-ik="${k}" data-ic="${esc(C[mode] ? mode : '')}" data-it="${esc(t)}">${esc(T.ideaChatGo)}</button></div>`;
}

// ---------- suggest an idea (the sheet), then share it ----------
// pre = {kind, text, chars}: the sheet opens filled in (an idea from the chat); they can still change anything
async function ideaSheet(pre = {}) {
  if (!(await needFan('idea'))) return;
  let kind = T.ideaKinds[pre.kind] ? pre.kind : 'episode';
  const chosen = (pre.chars || []).filter((id) => C[id]).slice(0, 3);   // up to 3, in the order they were picked
  const all = W.characters.filter((c) => c.img || c.name);
  const h = sheet(`<div class="ids"><img class="ids-logo" src="/verse/logo-160.png" alt=""><h2 class="vx-h">${esc(T.ideaTitle)}</h2>
      <div class="ids-kinds">${Object.entries(T.ideaKinds).map(([k, l]) => `<button type="button" class="vx-pill ${k === kind ? 'on' : ''}" data-k="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="ids-field"><div class="ids-at" hidden></div><textarea maxlength="300" placeholder="${esc(T.ideaPh)}"></textarea><small><span data-n>0</span>/300</small></div>
      <div class="ids-who-h">${esc(T.ideaWho)} <small>${esc(T.ideaWhoHint)}</small></div>
      <div class="ids-who"></div>
      <button class="vx-btn main block" data-send>${esc(T.ideaSend)}</button><p class="ids-note">${esc(T.ideaNote)}</p></div>`, { cls: 'ids-sheet' });
  const ta = h.el.querySelector('textarea'), atBox = h.el.querySelector('.ids-at'), who = h.el.querySelector('.ids-who');
  if (pre.text) { ta.value = String(pre.text).slice(0, 300); h.el.querySelector('[data-n]').textContent = ta.value.length; }
  window.atMirror?.(ta);   // an @tag stays coloured while typing
  // the faces row: whoever they picked comes first (even if they're far down the list), then everyone else
  const drawWho = () => {
    const rest = all.filter((c) => c.img && !chosen.includes(c.id));
    who.innerHTML = [...chosen.map((id) => C[id]), ...rest].filter(Boolean)
      .map((c) => `<button type="button" data-c="${c.id}" class="${chosen.includes(c.id) ? 'on' : ''}">${av({ char: c.id })}<span>${esc(c.name)}</span></button>`).join('');
    who.scrollLeft = 0;
  };
  const pick = (id) => { if (chosen.includes(id)) return; if (chosen.length >= 3) chosen.shift(); chosen.push(id); drawWho(); };
  drawWho();
  // "@" + a few letters: the characters whose name matches, from all of them; picking one writes @name and tags them
  const atQuery = () => (ta.value.slice(0, ta.selectionStart).match(/@([^\s@]{0,20})$/) || [])[1];
  ta.oninput = () => {
    h.el.querySelector('[data-n]').textContent = ta.value.length;
    const q = atQuery();
    if (q === undefined) { atBox.hidden = true; return; }
    const ql = q.toLowerCase();
    const hits = all.filter((c) => !q || c.name.toLowerCase().includes(ql) || (c.aka || []).some((x) => String(x).toLowerCase().includes(ql))).slice(0, 8);
    atBox.hidden = !hits.length;
    atBox.innerHTML = hits.map((c) => `<button type="button" data-at="${c.id}">${av({ char: c.id })}<span>${esc(c.name)}</span></button>`).join('');
  };
  atBox.addEventListener('mousedown', (e) => e.preventDefault());   // keep the caret in the text
  setTimeout(() => ta.focus(), 250);
  h.el.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-k]'), c = e.target.closest('[data-c]'), at = e.target.closest('[data-at]'), send = e.target.closest('[data-send]');
    if (k) { kind = k.dataset.k; h.el.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b === k)); }
    else if (at) {
      const id = at.dataset.at, pos = ta.selectionStart;
      const before = ta.value.slice(0, pos).replace(/@([^\s@]{0,20})$/, '@' + C[id].name + ' ');
      ta.value = before + ta.value.slice(pos);
      ta.selectionStart = ta.selectionEnd = before.length;
      atBox.hidden = true; pick(id); ta.focus(); ta.oninput();
    }
    else if (c) { const id = c.dataset.c; const i = chosen.indexOf(id); if (i >= 0) { chosen.splice(i, 1); drawWho(); } else pick(id); }
    else if (send) {
      const text = ta.value.trim();
      if (text.length < 4) { ta.focus(); return; }
      // anyone @-named in the text counts as tagged too
      for (const ch of all) if (text.includes('@' + ch.name) && !chosen.includes(ch.id) && chosen.length < 3) chosen.push(ch.id);
      send.disabled = true; send.innerHTML = '<span class="vx-spin"></span>';
      try {
        const r = await call('idea', { text, kind, chars: chosen.slice(0, 3) });
        track('idea', kind);
        h.el.querySelector('.ids').innerHTML = shareCard(r.id, text);
      } catch (x) {
        send.disabled = false; send.textContent = T.ideaSend;
        toast(x.code === 'text_bad' ? T.cmBad : x.code === 'quota' ? T.ideaQuota : x.code === 'slow_down' ? T.cmSlow : T.errGeneric, 3500);
      }
    }
  });
}
const ideaUrl = (id) => `${location.origin}/community?idea=${id}`;
const shareCard = (id, text) => `<div class="ids-done"><img class="ids-logo" src="/verse/logo-160.png" alt=""><h2 class="vx-h">${esc(T.ideaDoneTitle)}</h2><p>${esc(T.ideaDoneSub)}</p>
    <blockquote>${esc(text)}</blockquote>
    <a class="vx-btn wa block" href="https://wa.me/?text=${encodeURIComponent(`${T.ideaShareText(text)}\n${ideaUrl(id)}`)}" target="_blank" rel="noopener">${I.whatsapp}${esc(T.ideaShareWa)}</a>
    <button class="vx-btn glass block" data-copy-idea="${id}">${I.copy}${esc(T.ideaCopy)}</button>
    <a class="vx-link" href="/community?idea=${id}" data-vx-close>${esc(T.ideaSee)}</a></div>`;
async function shareIdea(id) {
  const x = ideas.find((i) => i.id === id);
  const text = x ? T.ideaShareText(x.text) : T.ideasTitle;
  track('share', 'idea');
  if (navigator.share) { try { await navigator.share({ title: T.ideasTitle, text, url: ideaUrl(id) }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  sheet(`<div class="ids-done">${shareCard(id, x ? x.text : '').replace('<div class="ids-done">', '')}`, { cls: 'ids-sheet' });
}
async function vote(b) {
  if (!(await needFan('vote'))) return;
  const id = b.dataset.vote, on = !myVotes.has(id), x = ideas.find((i) => i.id === id);
  if (on) myVotes.add(id); else myVotes.delete(id);
  if (x) x.votes = (x.votes || 0) + (on ? 1 : -1);
  emit();
  track('vote', on ? 'on' : 'off');
  call('vote', { ideaId: id, on }).catch(() => toast(T.errGeneric));
}

// ---------- the small forms: ask for a video, something isn't working ----------
const recentErrors = [];
addEventListener('error', (e) => { recentErrors.push(String(e.message || e.error || '').slice(0, 200)); if (recentErrors.length > 5) recentErrors.shift(); });
addEventListener('unhandledrejection', (e) => { recentErrors.push(String(e.reason?.message || e.reason || '').slice(0, 200)); if (recentErrors.length > 5) recentErrors.shift(); });
function formSheet(kind) {
  const bug = kind === 'bug';
  const h = sheet(`<form class="rqs"><h2 class="vx-h">${esc(bug ? T.bugTitle : T.reqTitle)}</h2><p class="vx-sub">${esc(bug ? T.bugSub2 : T.reqSub2)}</p>
      <textarea name="text" maxlength="3000" required placeholder="${esc(bug ? T.bugPh : T.reqPh)}"></textarea>
      <input name="contact" maxlength="160" placeholder="${esc(T.reqContact)}">
      ${bug ? `<p class="rqs-note">${esc(T.bugNote)}</p>` : ''}
      <button class="vx-btn main block">${esc(T.reqSend)}</button></form>`, { cls: 'rqs-sheet' });
  setTimeout(() => h.el.querySelector('textarea').focus(), 250);
  h.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    const text = f.text.value.trim();
    if (text.length < 3) return;
    // sending anything needs an account (his rule, 2026-11-01) - the server refuses it signed out
    if (!(await needFan('contact'))) return;
    btn.disabled = true; btn.innerHTML = '<span class="vx-spin"></span>';
    // a bug report carries where it happened and on what, so it can be fixed without asking back
    const extra = bug ? { page: location.href.slice(0, 300), ua: navigator.userAgent.slice(0, 300), screen: `${innerWidth}x${innerHeight}`, errors: recentErrors.slice() } : {};
    try {
      await call('request', { kind, text, contact: f.contact.value.trim(), from: 'community', ...extra });
      track('request', kind);
      f.innerHTML = `<div class="rqs-done">${I.check}<h2 class="vx-h">${esc(bug ? T.bugDone : T.reqDone)}</h2></div>`;
      setTimeout(() => h.close(), 2200);
    } catch (x) { btn.disabled = false; btn.textContent = T.reqSend; toast(x.code === 'slow_down' ? T.cmSlow : T.errGeneric); }
  };
}

// ---------- the business page (#/business) ----------
// one business form for every way in (his ask 2026-11-10: "no business page for now - a form I get notified about"; the home's
// strip, "לעסקים" in the top bar and the footer all open it). A Google sign-in only - no resident profile needed for a business.
const bizForm = () => `<form class="biz-form"><h2>${esc(T.bizFormTitle)}</h2><p>${esc(T.bizFormSub)}</p>
      <div class="biz-topics">${T.bizTopics.map((t, i) => `<button type="button" class="vx-pill ${i === 0 ? 'on' : ''}" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <input name="name" maxlength="80" required placeholder="${esc(T.bizName)}" autocomplete="name">
      <input name="company" maxlength="120" placeholder="${esc(T.bizCompany)}" autocomplete="organization">
      <input name="email" type="email" maxlength="160" required placeholder="${esc(T.bizEmail)}" dir="ltr" autocomplete="email">
      <input name="phone" type="tel" maxlength="40" placeholder="${esc(T.bizPhone)}" dir="ltr" autocomplete="tel">
      <textarea name="text" maxlength="3000" required placeholder="${esc(T.bizMsg)}"></textarea>
      <button class="vx-btn main block">${esc(T.bizSend)}</button></form>`;
export function bizSheet() {
  track('click', 'biz_open');
  sheet(`<div class="in biz-sheet"><img class="biz-sheet-art" src="/verse/art/biz-media.jpg" alt="">${bizForm()}</div>`, { cls: 'biz-sh' });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-biz], a[href="/business"]');
  if (!b || e.target.closest('.biz')) return;
  e.preventDefault(); e.stopPropagation();
  bizSheet();
}, true);
async function bizSignIn() {
  if (st.user) return true;
  if (!(await signInSheet('business'))) return false;
  for (let i = 0; i < 60 && !st.user; i++) await new Promise((r) => setTimeout(r, 200));
  return !!st.user;
}
export function businessPage() {
  return `<div class="biz biz-only"><img class="biz-sheet-art" src="/verse/art/biz-media.jpg" alt="">${bizForm()}</div>`;
}
document.addEventListener('click', (e) => { const t = e.target.closest('[data-topic]'); if (t) t.parentElement.querySelectorAll('[data-topic]').forEach((b) => b.classList.toggle('on', b === t)); });
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('.biz-form');
  if (!f) return;
  e.preventDefault();
  const email = f.email.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast(T.bizBadEmail); f.email.focus(); return; }
  if (!(await bizSignIn())) return;
  const btn = f.querySelector('button:not([data-topic])');
  btn.disabled = true; btn.innerHTML = '<span class="vx-spin"></span>';
  try {
    const phone = f.phone ? f.phone.value.trim() : '';
    await call('request', { kind: 'business', name: f.name.value.trim(), company: f.company.value.trim(), contact: email, text: f.text.value.trim() + (phone ? `\n\nטלפון: ${phone}` : ''),
      topic: f.querySelector('[data-topic].on')?.dataset.topic || '' });
    track('request', 'business');
    f.innerHTML = `<div class="rqs-done">${I.check}<h2>${esc(T.bizDone)}</h2><p>${esc(T.bizDoneSub)}</p></div>`;
  } catch (x) { btn.disabled = false; btn.textContent = T.bizSend; toast(x.code === 'slow_down' ? T.cmSlow : T.errGeneric); }
});

// ---------- one place for the clicks ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-do], [data-idea-new], [data-idea-chat], [data-vote], [data-share-idea], [data-idea-sort], [data-form], [data-ask-char], [data-copy-idea]');
  if (!b) return;
  e.preventDefault();
  if (b.matches('[data-do]')) canDo(b.dataset.do, storyFaces());
  else if (b.matches('[data-idea-new]')) ideaSheet();
  else if (b.matches('[data-idea-chat]')) { track('idea_chat', b.dataset.ic || 'guide'); ideaSheet({ kind: b.dataset.ik, text: b.dataset.it, chars: b.dataset.ic ? [b.dataset.ic] : [] }); }
  else if (b.matches('[data-vote]')) vote(b);
  else if (b.matches('[data-share-idea]')) shareIdea(b.dataset.shareIdea);
  else if (b.matches('[data-idea-sort]')) { sort = b.dataset.ideaSort; emit(); }
  else if (b.matches('[data-form]')) formSheet(b.dataset.form);
  else if (b.matches('[data-ask-char]')) openChat('guide');
  else if (b.matches('[data-copy-idea]')) navigator.clipboard?.writeText(ideaUrl(b.dataset.copyIdea)).then(() => toast(T.ideaCopied));
});
export const signedInNow = signedIn;
