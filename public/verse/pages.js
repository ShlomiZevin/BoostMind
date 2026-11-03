// The pages a fan lives in: the top bar (bell + me), "your verse" (the signed-in home), the bell (#/notes, mockup E),
// me (#/me), and the guide's contact card in the chat ("can't find a video?", collaborations).
import { db, F, call } from './fb.js';
import { T } from './copy.js';
import { I, $, esc, av, ago, abs, toast, track, wordmark, sheet, LIKE } from './ui.js';
import { st, needFan, signedIn, nameScreen, signOut, cachedMe, follow } from './state.js';
import { ringsHtml, storyRing } from './stories.js';
import { watched } from './player.js';
import { pushState, enablePush } from './push.js';

// ---------- top bar ----------
export function renderTop() {
  const box = $('#vx-top');
  if (!box) return;
  const bell = `<button class="icon-btn" data-bell aria-label="${esc(T.notesTitle)}">${I.bell}${st.unread ? '<span class="vx-dot"></span>' : ''}</button>`;
  // before Firebase answers: the last signed-in look (or nothing), never a "sign in" button that flips a second later
  const me = signedIn() ? st.fan : !st.ready ? cachedMe() : null;
  box.innerHTML = me
    ? `${bell}<button class="me-btn" data-me-menu aria-label="${esc(T.mmProfile)}">${av({ fan: me })}</button>`
    : st.ready ? `${bell}<button class="in-btn" data-signin>כניסה</button>` : '';
  const nav = document.querySelector('.nav-me');
  if (nav) nav.innerHTML = st.unread ? `אני <span class="vx-dot" style="display:inline-block;width:7px;height:7px;vertical-align:middle"></span>` : 'אני';
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-signin]')) { e.preventDefault(); needFan(); } });

// ---------- home ----------
const vrow = (list) => `<div class="row">${list.map(vcard).join('')}</div>`;
function continueRow() {
  const w = watched();
  const list = Object.entries(w).filter(([id, x]) => V[id] && !V[id].url && x.d && x.t / x.d > 0.04 && x.t / x.d < 0.94).sort((a, b) => b[1].at - a[1].at).slice(0, 12);
  if (!list.length) return '';
  return `<section class="yv-sec"><div class="sec-h"><h2>${esc(T.yvContinue)}</h2></div><div class="row cw">${list.map(([id, x]) =>
    vcard(V[id]).replace('<div class="play">', `<span class="bar"><i style="width:${Math.round((x.t / x.d) * 100)}%"></i></span><div class="play">`)).join('')}</div></section>`;
}
// the hero's greeting (signed in, or was last time and Firebase hasn't answered yet)
export const heroHi = () => (signedIn() ? T.hi(st.fan.nick) : !st.ready && cachedMe() ? T.hi(cachedMe().nick) : null);
// signed in, under the hero: their characters, what's new from them, characters to pick, the fans' stickers
function yourBlock() {
  const theirs = (list) => list.filter((v) => v.cast.some((c) => st.follows.has(c)));
  const mine = st.follows.size ? [...theirs(fresh()), ...theirs(W.videos.filter((v) => v.archive))].slice(0, 14) : [];
  const rings = ringsHtml();
  const followed = [...st.follows].filter((id) => C[id]);
  const faces = followed.length ? `<div class="yv-faces">${followed.map((id) => `<a class="yv-face" href="/c/${id}"${storyRing(id).replace(/ style="[^"]*"/, '')}>${av({ char: id, ring: true })}<span>${esc(C[id].name)}</span></a>`).join('')}
      <a class="yv-face add" href="/characters"><span class="vx-av">${I.plus}</span><span>${esc(T.yvMore)}</span></a></div>` : '';
  const pick = followed.length < 3 ? W.characters.filter((c) => c.img && !st.follows.has(c.id) && !NOT_IN_HERO.has(c.id))
    .sort((a, b) => (b.videos?.length || 0) - (a.videos?.length || 0)).slice(0, 8) : [];
  const picks = pick.length ? `<section class="yv-sec"><div class="sec-h"><h2>${esc(followed.length ? T.yvSuggest : T.yvStart)}</h2><a href="/characters">${esc(T.yvMore)} ←</a></div>
      <div class="yv-picks">${pick.map((c) => `<div class="yv-pick" style="--c:${color(c)}"><a href="/c/${c.id}"><img src="${esc(abs(c.img))}" alt="" loading="lazy"><b>${esc(c.name)}</b><small>${esc(c.tagline || c.role || '')}</small></a>
        <button class="vx-pill" data-yv-follow="${c.id}">${I.plus}${esc(T.follow)}</button></div>`).join('')}</div></section>` : '';
  const hot = hotStickers();
  return `<section class="yv-me">
      ${faces}
      ${rings ? `<div class="yv-sec">${rings}</div>` : ''}
      ${mine.length ? `<section class="yv-sec"><div class="sec-h"><h2>${esc(T.yvNew)}</h2></div>${vrow(mine)}</section>` : ''}
      ${picks}
      ${hot.length ? `<section class="yv-sec"><div class="sec-h"><h2>${esc(T.yvStickers)}</h2></div><div class="yv-st">${hot.map((s) => `<button class="yv-stk" data-wa-img="${esc(s.img)}" data-wa-v="${esc(s.videoId)}"><img src="${esc(s.img)}" alt="${esc(s.text)}" loading="lazy"><span>${LIKE}${s.stampCount || ''}</span></button>`).join('')}</div></section>` : ''}
      ${continueRow()}
    </section>`;
}
export const yourVerse = () => null; // the hero stays for everyone now (kept so the page's hook stays harmless)
// the fans' best stickers across the verse, read once a visit (tapping one = the WhatsApp sticker card)
let hotList = null;
function hotStickers() {
  if (hotList === null) {
    hotList = [];
    F.getDocs(F.query(F.collection(db, 'stickers'), F.where('status', '==', 'live'), F.where('hidden', '==', false), F.orderBy('stampCount', 'desc'), F.limit(12)))
      .then((s) => { hotList = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (hotList.length) refresh(true); }).catch((e) => console.error('hot stickers', e));
  }
  return hotList;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-yv-follow]');
  if (!b) return;
  b.disabled = true;
  if (await follow(b.dataset.yvFollow, true)) refresh(true); else b.disabled = false;
});
// signed out: today's wiki home, with stories and a clear reason to sign in
export function homeSlot() {
  if (signedIn()) return yourBlock() + band();
  if (!st.ready && cachedMe()) return '<div class="yv-wait"></div>';
  const rings = ringsHtml();
  return `${rings ? `<section class="sec"><div class="sec-h"><h2>${esc(T.storiesTitle)}</h2></div>${rings}</section>` : ''}
    <div class="signin-card"><div><h2>${esc(T.signinCardTitle)}</h2><p>${esc(T.signinCardText)}</p></div>
      <button class="vx-btn white" data-signin>${I.google}${esc(T.signinCardBtn)}</button></div>
    ${continueRow()}${band()}`;
}

// the community band (ideas wall + ask / business) - lives in community.js, imported lazily to avoid a cycle
let band = () => '';
import('./community.js').then((m) => { band = m.homeBand; refresh(); });

// ---------- the bell (E) ----------
let filter = 'all', readTimer = 0;
function noteRow(n) {
  const unread = !n.read ? 'unread' : '';
  let face, name, line, thumb = '', href;
  if (n.kind === 'video') { face = n.char ? av({ char: n.char, ring: true }) : av({ planet: true }); name = n.from || 'השלומיוורס'; line = T.note.video(n.text); href = `${itemLink(n.videoId)}`;
    const v = V[n.videoId]; if (v && v.poster) thumb = `<img class="thumb" src="${abs(v.poster)}" alt="">`; }
  else if (n.kind === 'story') { face = n.char === 'verse' ? av({ planet: true }) : av({ char: n.char, ring: true }); name = n.from; line = T.note.story(n.text); href = `/story/${n.char}`; }
  else if (n.kind === 'reply') { face = n.char ? av({ char: n.char, ring: true }) : av({ fan: { nick: n.from, photo: n.photo } }); name = n.from; line = T.note.reply(n.text); href = `${itemLink(n.videoId)}?c=${n.commentId}`; }
  else if (n.kind === 'like') { face = n.n > 1 || !n.from ? av({ planet: true }) : av({ fan: { nick: n.from, photo: n.photo } }); name = T.note.like(n.n || 1, n.from); line = `"${n.text}"`; href = `${itemLink(n.videoId)}?c=${n.focus || n.commentId}`; }
  else if (n.kind === 'stamp') { face = n.char ? av({ char: n.char }) : av({ planet: true }); name = T.note.stamp(n.n || 1); line = `"${n.text}"`; href = `${itemLink(n.videoId)}?sticker=${n.stickerId}`;
    if (n.img) thumb = `<img class="thumb sq" src="${esc(n.img)}" alt="">`; }
  else if (n.kind === 'record') { face = av({ fan: { nick: n.from, photo: n.photo } }); name = n.from; line = T.rec.noteLine.replace('{nick}', n.from).replace('{game}', n.text); href = `/play/${n.game}?records=1`; }
  else { face = av({ planet: true }); name = T.note.welcome(n.text || st.fan?.nick || ''); line = T.note.welcomeLine; href = '/characters'; }
  return `<a class="nt-row ${unread}" href="${href}">${!n.read ? '<span class="vx-dot"></span>' : ''}${face}
    <span class="body"><b>${esc(name)}</b><span class="line">${esc(line)}</span><small>${n.t ? ago(n.t) : T.now}</small></span>${thumb}</a>`;
}
function pushCard() {
  const s = pushState();
  if (s === 'granted' || s === 'unsupported' || s === 'denied') return '';
  return `<div class="nt-push"><span class="vx-round" style="color:var(--vx-accent);background:var(--card2);border-color:var(--line)">${I.bell}</span>
    <p><b>${esc(T.notesPushCard[0])}</b>${esc(T.notesPushCard[1])}</p><button class="vx-btn main small" data-push-on>${esc(s === 'ios' ? T.pushIos : T.pushOn)}</button></div>`;
}
export function notesPage() {
  return `<div class="nt-page"><div class="nt-h"><h1>${esc(T.notesTitle)}</h1></div>${notesBody()}</div>`;
}
// the bell's list: the page (#/notes, where a push opens) and the dropdown / sheet behind the bell show the same thing
function notesBody() {
  if (!signedIn()) return `<div class="signin-card" style="margin-top:16px"><div><p style="color:var(--text);font-size:1.05rem">${esc(T.notesSignedOut)}</p></div>
    <button class="vx-btn white" data-signin>${I.google}${esc(T.signinGoogle)}</button></div>`;
  const list = st.notes.filter((n) => filter === 'all' || n.kind === filter || (filter === 'reply' && n.kind === 'like'));
  const day = 864e5, now = Date.now(), today = new Date().toDateString();
  const ms = (n) => n.t?.toMillis?.() || now;
  const groups = [[T.notesToday, list.filter((n) => new Date(ms(n)).toDateString() === today)],
    [T.notesWeek, list.filter((n) => new Date(ms(n)).toDateString() !== today && now - ms(n) < 7 * day)],
    [T.notesOlder, list.filter((n) => now - ms(n) >= 7 * day)]];
  clearTimeout(readTimer);
  if (st.unread) readTimer = setTimeout(() => call('readNotes').catch(() => {}), 1500);
  return `<div class="chips nt-chips">${Object.entries(T.notesFilters).map(([k, label]) => `<button class="chip ${k === filter ? 'on' : ''}" data-nfilter="${k}">${esc(label)}</button>`).join('')}</div>
    ${list.length ? groups.filter(([, g]) => g.length).map(([h, g]) => `<div class="nt-sec">${esc(h)}</div>${g.map(noteRow).join('')}`).join('') : `<div class="empty" style="margin-top:16px">${esc(T.notesEmpty)}</div>`}
    ${pushCard()}`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-nfilter]'); if (b) { filter = b.dataset.nfilter; redrawBell(); refresh(true); } });

// ---------- saved: their own place ----------
// a video's page or a game's (the bell, the saved page): comments, likes and saves keep the game's id where a video's goes
const gameOf = (id) => (W.games || []).find((g) => g.id === id);
const itemLink = (id) => (gameOf(id) ? '/play/' : '/v/') + id;
export function savedPage() {
  const head = pageHead(T.savedTitle, T.savedSub);
  if (!signedIn()) return `<div class="nt-page sv-page">${head}<div class="signin-card" style="margin-top:16px"><div><p style="color:var(--text);font-size:1.05rem">${esc(T.meNone.saved)}</p></div>
    <button class="vx-btn white" data-signin>${I.google}${esc(T.signinGoogle)}</button></div></div>`;
  const ids = [...st.saves.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const saves = ids.map((id) => V[id]).filter(Boolean), games = ids.map(gameOf).filter(Boolean);
  if (!saves.length && !games.length) return `<div class="nt-page sv-page">${head}<div class="empty" style="margin-top:16px">${esc(T.savedEmpty)}</div></div>`;
  return `<div class="nt-page sv-page">${head}${saves.length ? `<div class="vgrid">${saves.map(vcard).join('')}</div>` : ''}
    ${games.length ? `<h2 class="sv-h">${esc(T.savedGames)}</h2><div class="ggrid">${games.map((g) => gcard(g)).join('')}</div>` : ''}</div>`;
}

// ---------- me ----------
let myStickers = null, myStickersFor = null;
async function loadMyStickers() {
  if (!st.user || myStickersFor === st.user.uid) return;
  myStickersFor = st.user.uid;
  try {
    const s = await F.getDocs(F.query(F.collection(db, 'stickers'), F.where('uid', '==', st.user.uid), F.orderBy('t', 'desc'), F.limit(60)));
    myStickers = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error('my stickers', e); myStickers = []; }
  refresh(true);
}
// ---------- their pages: each shows one thing (Shlomi: "isolated and clear") ----------
const signedOutPage = (title, line) => `<div class="nt-page"><div class="nt-h"><h1>${esc(title)}</h1></div><div class="signin-card" style="margin-top:16px"><div><p style="color:var(--text);font-size:1.05rem">${esc(line)}</p></div>
    <button class="vx-btn white" data-signin>${I.google}${esc(T.signinGoogle)}</button></div></div>`;
const pageHead = (title, sub) => `<div class="nt-h"><a class="pg-back" href="/me">${I.back}${esc(T.mmProfile)}</a><h1>${esc(title)}</h1>${sub ? `<p class="pg-sub">${esc(sub)}</p>` : ''}</div>`;
// the profile: who they are, and a door to each of their places
export function mePage() {
  if (!signedIn()) return signedOutPage(T.mmProfile, T.meSignedOut);
  loadMyStickers();
  const follows = [...st.follows].filter((id) => C[id]).length;
  const tile = (href, icon, label, n) => `<a class="me-tile" href="${href}">${icon}<b>${esc(label)}</b>${n != null ? `<span>${n}</span>` : ''}${I.next}</a>`;
  return `<div class="me-page">
    <div class="me-hero">${av({ fan: st.fan })}<h1>${esc(st.fan.nick)}</h1>
      <button class="vx-pill" data-rename>${I.edit}${esc(T.meName)}</button></div>
    <div class="me-tiles">
      ${tile('/my-characters', I.people, T.mmFollows, follows)}
      ${tile('/saved', I.save, T.mmSaved, st.saves.size)}
      ${tile('/my-stickers', I.sticker, T.mmStickers, myStickers ? myStickers.length : null)}
      ${tile('/notes', I.bell, T.mmBell, st.unread || null)}
    </div>
  </div>`;
}
export function myCharactersPage() {
  if (!signedIn()) return signedOutPage(T.mmFollows, T.meNone.follows);
  const follows = [...st.follows].filter((id) => C[id]);
  return `<div class="nt-page">${pageHead(T.mmFollows, T.myCharsSub)}
    ${follows.length ? `<div class="me-chars">${follows.map((id) => `<a class="me-char" href="/c/${id}">${av({ char: id, ring: true })}<b>${esc(C[id].name)}</b><small>${esc(C[id].tagline || C[id].role || '')}</small></a>`).join('')}
      <a class="me-char add" href="/characters"><span class="vx-av">${I.plus}</span><b>${esc(T.yvMore)}</b></a></div>`
      : `<div class="empty" style="margin-top:16px">${esc(T.meNone.follows)} <a href="/characters" style="color:var(--accent)">${esc(T.yvPick)}</a></div>`}</div>`;
}
export function myStickersPage() {
  if (!signedIn()) return signedOutPage(T.mmStickers, T.meNone.stickers);
  loadMyStickers();
  return `<div class="nt-page">${pageHead(T.mmStickers, T.myStickersSub)}
    ${myStickers === null ? '<div class="vx-spin"></div>' : myStickers.length
      ? `<div class="stg me">${myStickers.map((s) => `<div class="stc"><img src="${esc(s.img)}" alt="${esc(s.text)}" loading="lazy" data-wa-img="${esc(s.img)}" data-wa-v="${esc(s.videoId)}"><span class="by">${s.status === 'live' ? `${LIKE} ${s.stampCount || 0}` : esc(T.myStickerDraft)}</span></div>`).join('')}</div>`
      : `<div class="empty" style="margin-top:16px">${esc(T.meNone.stickers)}</div>`}</div>`;
}
// ---------- the menu behind their face (top bar; "אני" on the phone): the usual things, the profile page one tap on ----------
const isLight = () => document.documentElement.dataset.theme === 'light';
function toggleTheme() {
  const next = isLight() ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('wiki-theme', next); } catch (e) { /* private mode */ }
  document.querySelectorAll('[data-theme-toggle] .vx-switch').forEach((s) => s.classList.toggle('on', next === 'light'));
}
// one dropdown at a time (desktop) / a bottom sheet (phone). The same button again closes it; another button swaps it.
let menu = null;
function pop(kind, anchor, html, cls) {
  const again = menu && menu.kind === kind;
  if (menu) menu.close();
  if (again) return null;
  const wide = matchMedia('(min-width: 821px)').matches && anchor;
  if (!wide) menu = sheet(html, { cls: `${cls}-sheet`, onClose: () => { menu = null; } });
  else {
    const el = Object.assign(document.createElement('div'), { className: `mm-pop ${cls}-pop`, innerHTML: html });
    const r = anchor.getBoundingClientRect();
    const w = cls === 'nt' ? 400 : 300;
    Object.assign(el.style, { top: `${r.bottom + 10}px`, left: `${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`, width: `${w}px` });
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('open'));
    // a click anywhere outside closes it (no backdrop, so the bell / face under the finger still gets its own click = toggle)
    const outside = (e) => { if (!el.contains(e.target) && !e.target.closest('[data-bell], [data-me-menu]')) close(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { el.remove(); document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside, true); if (menu && menu.el === el) menu = null; };
    document.addEventListener('keydown', key);
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    menu = { el, close };
  }
  menu.kind = kind;
  menu.el.addEventListener('click', (e) => { const a = e.target.closest('a, [data-rename], [data-signout], [data-signin]'); if (a && menu) menu.close(); });
  return menu;
}
function bellMenu(anchor) {
  if (!pop('bell', anchor, `<div class="ntm"><div class="ntm-h"><b>${esc(T.notesTitle)}</b></div><div class="ntm-body">${notesBody()}</div></div>`, 'nt')) return;
  clearTimeout(readTimer);
  if (st.unread) readTimer = setTimeout(() => call('readNotes').catch(() => {}), 1500);
}
function redrawBell() { const b = menu && menu.kind === 'bell' && menu.el.querySelector('.ntm-body'); if (b) b.innerHTML = notesBody(); }
function meMenu(anchor) {
  const follows = [...st.follows].filter((id) => C[id]).length;
  const ps = pushState();
  const row = (tag, attrs, icon, label, hint = '') => `<${tag} ${attrs}>${icon}<span class="mm-l">${esc(label)}</span>${hint}</${tag}>`;
  const n = (x) => (x ? `<small>${x}</small>` : '');
  const html = `<div class="mm">
    <a class="mm-head" href="/me">${av({ fan: st.fan })}<span class="mm-who"><b>${esc(st.fan.nick)}</b><small>${esc(T.mmProfile)}</small></span>${I.next}</a>
    <div class="mm-g">${esc(T.mmMine)}</div>
    <div class="mm-list">
      ${row('a', 'href="/my-characters"', I.people, T.mmFollows, n(follows))}
      ${row('a', 'href="/saved"', I.save, T.mmSaved, n(st.saves.size))}
      ${row('a', 'href="/my-stickers"', I.sticker, T.mmStickers)}
      ${row('a', 'href="/notes"', I.bell, T.mmBell, st.unread ? `<em>${st.unread}</em>` : '')}
    </div>
    <div class="mm-g">${esc(T.mmSettings)}</div>
    <div class="mm-list">
      ${row('button', 'data-rename', I.edit, T.meName)}
      ${row('button', 'data-push-on', I.bell, T.mmPhone, `<small>${esc(T.mePushState[ps] || '')}</small>`)}
      ${row('button', 'data-theme-toggle', I.moon, T.mmLight, `<span class="vx-switch ${isLight() ? 'on' : ''}"></span>`)}
      ${row('a', 'href="/install"', I.install, T.meInstall)}
      ${row('button', 'data-form="bug"', I.bug, T.mmBug)}
      ${row('button', 'data-signout', I.out, T.meOut)}
    </div></div>`;
  pop('me', anchor, html, 'mm');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-me-menu]');
  if (b) { e.preventDefault(); if (signedIn()) meMenu(b); return; }
  const bell = e.target.closest('[data-bell]');
  if (bell) { e.preventDefault(); bellMenu(bell); return; }
  const nav = e.target.closest('.nav-me');
  if (nav && signedIn() && !matchMedia('(min-width: 821px)').matches) { e.preventDefault(); meMenu(null); return; }
  if (e.target.closest('[data-theme-toggle]')) { e.preventDefault(); toggleTheme(); }
});
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-rename]')) { e.preventDefault(); if (await nameScreen()) refresh(true); }
  else if (e.target.closest('[data-signout]')) { e.preventDefault(); await signOut(); myStickersFor = null; myStickers = null; nav('/'); }
  else if (e.target.closest('[data-push-test]')) { e.preventDefault(); call('pushTest').then((r) => toast(r.sent ? T.pushDone : T.errGeneric)).catch(() => toast(T.errGeneric)); }
});

// ---------- the guide's contact card ----------
// With a text (his ask, 2026-11-01): the guide offered a request, the visitor said yes and the guide wrote it - the card
// shows exactly that, to edit and approve. Without one (older replies): their last messages. One already sent stays
// "sent" when the chat is drawn again (kept by its text, on this device).
const rqKey = (kind, text) => 'rq-sent:' + kind + ':' + [...String(text)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
export function requestCard(kind, mode, text) {
  if (mode !== 'guide') return '';
  kind = kind === 'video' ? 'video' : 'contact';
  const said = text ? text.trim() : (threads.guide || []).filter((m) => m.role === 'user').slice(-3).map((m) => m.content).join('\n');
  const key = rqKey(kind, said);
  try { if (localStorage.getItem(key)) return `<div class="rq sent"><b>${esc(T.rqSent)}</b></div>`; } catch (e) {}
  // a note to Shlomi inside the reply, not a form (designed with GPT Image, 2026-11-01): the text as a quote he can edit,
  // an underline field for the way back, one button
  return `<form class="rq" data-rq="${kind}" data-key="${key}">
    <div class="rq-h">${I.mail}<span>${esc(kind === 'video' ? T.rqVideoTitle : T.rqContactTitle)}</span></div>
    <label class="rq-q"><textarea name="text" maxlength="3000" rows="4" placeholder="${esc(T.rqText)}">${esc(said)}</textarea>${I.edit}</label>
    <input name="contact" maxlength="160" placeholder="${esc(T.rqContact)}" value="">
    <button class="rq-go">${I.plane}<span>${esc(text ? T.rqApprove : T.rqSend)}</span></button>
    <small>${esc(T.rqNote)}</small></form>`;
}
// a character asks the visitor to sign in, in their own voice, when the 3 free questions are used (wiki.js puts
// [[signin]] under that reply): one Google button inside the bubble. Signed in already = nothing.
export function signinCard(again) {
  if (st.user) return '';
  return `<div class="si"><button data-chat-signin="${again ? 'again' : 'box'}">${I.google}<span>${esc(T.signinGoogle)}</span></button><small>${esc(T.chatFree)}</small></div>`;
}
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-rq]');
  if (!f) return;
  e.preventDefault();
  // sending anything needs an account (his rule, 2026-11-01) - the server refuses it signed out
  if (!(await needFan('contact'))) return;
  const btn = f.querySelector('button');
  btn.disabled = true;
  try {
    await call('request', { kind: f.dataset.rq, text: f.text.value, contact: f.contact.value });
    track('request', f.dataset.rq);
    try { localStorage.setItem(f.dataset.key, '1'); } catch (e) {}
    f.classList.add('sent');
    f.innerHTML = `<b>${esc(T.rqSent)}</b>`;
  } catch (x) { btn.disabled = false; toast(T.rqFailed); }
});

// ---------- keeping the open page current when the account / data changes ----------
let cur = { page: '', id: '' }, pending = 0, lastSlot = null;
export const setCurrent = (page, id) => { cur = { page: page || '', id: id || '' }; };
export function refresh(now) {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    if (typeof W === 'undefined' || !W) return;            // the wiki's data isn't here yet - its own first draw comes after
    if (document.querySelector('.vp, .sv, .nk')) return;   // never under the video, the stories or the name screen
    if (!['', 'notes', 'me', 'install', 'saved', 'my-characters', 'my-stickers', 'community'].includes(cur.page)) return;
    if (cur.page === '' && !now && document.activeElement && document.activeElement.id === 'ask-in') return;
    if (!cur.page && $('#home-slot') && $('section.hero')) {
      // the home is already drawn: only its two account-dependent pieces change, the wall of faces stays as it is
      const slot = HOOK.homeSlot ? HOOK.homeSlot() : '';
      if (slot !== lastSlot) { $('#home-slot').innerHTML = slot; lastSlot = slot; }
      const line = $('section.hero .hero-logo small'), fresh = heroLine();
      if (line && line.outerHTML !== fresh) line.outerHTML = fresh;
      return;
    }
    const qs = location.search.slice(1);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    $('#app').innerHTML = pages[cur.page || 'home'](q, cur.id);
    if (!cur.page) { bindHero(); document.body.classList.add('at-home'); }
  });
}
