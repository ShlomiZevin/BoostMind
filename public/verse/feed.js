// shlomiverse.com/new - a new FIRST SCREEN to test, not the home (Shlomi, 2026-11-16, plan home-first-screen round 2):
// a full-screen vertical feed like the apps the visitors come from, with tabs - videos, games (a feed too), chat. On every video
// it is clear you can comment, comment TO the character (an @tag - verseOnComment has the character answer) and start a chat
// with the character (the site's own chat). A short tutorial on the first visit. Everything opens the site's real pages:
// the video page with its comments (/v/<id>?cm=1[&at=<char>]), the games (/play/<id>), the chat (openChat). Phone first.
// Why (14 days of data): 30% of new visitors tap nothing and leave in ~17 s; a video or a game as the first tap keeps them ~170 s.
import { $, $$, esc, abs, av, track, charColor, I, toast, sheet } from './ui.js';
import { paintFollow } from './player.js';
import { db, F } from './fb.js';

const TABS = [['videos', 'סרטונים'], ['games', 'משחקים'], ['chat', "צ'אט"]];
const TUT = 'fd-tut-1';
const BATCH = 6;
let S = null;   // the live feed: { el, tab, items, shown, io, muted }

const gword = (id, m, f, p) => (typeof gw === 'function' ? gw(id, m, f, p) : m);
const lead = (v) => v.cast?.find((c) => C[c]) || null;
const videos = () => (typeof fresh === 'function' ? fresh() : W.videos)
  .filter((v) => v.src && v.poster && !v.url && !String(v.id).startsWith('story-') && lead(v));
const games = () => [...(W.games || [])].filter((g) => g.url && g.img).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
const castOf = (v) => [...new Set(v.cast || [])].filter((c) => C[c]);
// games for this video: those with any of its characters first, then the newest (his note: games, not "his one game")
const gamesFor = (cast) => { const all = games(), mine = all.filter((g) => (g.chars || []).some((c) => cast.includes(c))); return [...mine, ...all.filter((g) => !mine.includes(g))]; };
const gamePath = (g) => '/play/' + g.id;
// the short name on the buttons: the first name, past a title ("הרב דמוקרטוביץ" -> "דמוקרטוביץ", "המורה רוזנבלום" -> "רוזנבלום")
const first = (id) => { const w = (C[id]?.name || '').replace(/\s*\(.*?\)/g, '').split(' ').filter(Boolean); return (/^(הרב|המורה|ד"ר|דוקטור|פרופ'|הגננת|הסבתא)$/.test(w[0]) && w[1] ? w[1] : w[0]) || ''; };

const ICN = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M7.5 10h9M7.5 13h5.5"/></svg>`,
  at: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.6"/><path d="M15.6 8.6v4.6a2.4 2.4 0 0 0 4.8 0V12a8.4 8.4 0 1 0-3.3 6.7"/></svg>`,
  muted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>`,
  up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg>`,
};

const CSS = `
body[data-page="new"] { overflow: hidden; }
body[data-page="new"] > footer, body[data-page="new"] #fab { display: none !important; }
body[data-page="new"] .top { background: linear-gradient(rgba(0,0,0,.62), rgba(0,0,0,0)) !important; border-color: transparent !important; }
body[data-page="new"] .top .brand span { display: none; }
@media (max-width: 760px) {
  body[data-page="new"] .nav { background: rgba(10,10,14,.55) !important; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-top-color: rgba(255,255,255,.08) !important; }
}
.fd { position: fixed; inset: 0; z-index: 5; background: #000; color: #fff; }
.fd-tabs { position: fixed; z-index: 31; top: calc(env(safe-area-inset-top) + 62px); inset-inline: 0; display: flex; justify-content: center; gap: 6px; pointer-events: none; }
.fd-tabs button { pointer-events: auto; font: 700 15px/1 inherit; font-family: inherit; color: rgba(255,255,255,.72); background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.14); padding: 9px 16px; border-radius: 999px; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.fd-tabs button.on { color: #fff; background: var(--vx-accent, #ff6a1f); border-color: transparent; }
.fd-list { position: absolute; inset: 0; overflow-y: auto; scroll-snap-type: y mandatory; overscroll-behavior: contain; scrollbar-width: none; }
.fd-list::-webkit-scrollbar { display: none; }
.fd-item { position: relative; height: 100dvh; height: 100svh; scroll-snap-align: start; scroll-snap-stop: always; overflow: hidden; background: #000; }
@supports (height: 100dvh) { .fd-item { height: 100dvh; } }
.fd-item video, .fd-item .fd-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fd-item video.wide { object-fit: contain; }
.fd-shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 52%, rgba(0,0,0,.78)); }
.fd-sound { position: relative; margin-bottom: 10px; display: inline-flex; align-items: center; gap: 6px; font: 600 13px/1 inherit; font-family: inherit; color: #fff; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.18); padding: 8px 12px; border-radius: 999px; }
.fd-sound svg { width: 18px; height: 18px; }
.fd-rail { position: absolute; z-index: 3; inset-inline-end: 6px; bottom: calc(env(safe-area-inset-bottom) + 84px); display: flex; flex-direction: column; align-items: center; gap: 9px; width: 70px; }
.fd-rail a, .fd-rail button { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #fff; background: none; border: 0; padding: 0; font: 700 11px/1.15 inherit; font-family: inherit; text-align: center; text-decoration: none; text-shadow: 0 1px 3px rgba(0,0,0,.9); max-width: 70px; white-space: normal; word-break: keep-all; }
.fd-rd { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(0,0,0,.42); border: 1px solid rgba(255,255,255,.2); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.fd-rd svg { width: 23px; height: 23px; }
.fd-rd.main { background: var(--vx-accent, #ff6a1f); border-color: rgba(255,255,255,.3); }
.fd-face .vx-av { width: 46px; height: 46px; }
.fd-face { position: relative; }
.fd-faces { display: flex; flex-direction: column; align-items: center; background: none; border: 0; padding: 0; }
.fd-faces .vx-av { width: 46px; height: 46px; }
.fd-faces.many .vx-av { width: 38px; height: 38px; margin-top: -12px; } .fd-faces.many .vx-av:first-child { margin-top: 0; }
.fd-faces.sm { flex-direction: row; } .fd-faces.sm .vx-av { width: 30px; height: 30px; margin: 0 0 0 -8px; outline: 2px solid #000; } .fd-faces.sm .vx-av:first-child { margin: 0; }
.fd-who { background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer; text-align: start; }
.fd-cast h3 { margin: 4px 4px 12px; font-size: 18px; font-weight: 900; }
.fd-cast-row { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-top: 1px solid rgba(255,255,255,.08); }
.fd-cast-row a { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.fd-cast-row .vx-av { width: 52px; height: 52px; flex: none; }
.fd-cast-row b { display: block; font-size: 16px; } .fd-cast-row small { display: block; color: rgba(255,255,255,.6); font-size: 13px; }
.fd-cast-row .vx-btn { flex: none; display: inline-flex; align-items: center; gap: 6px; } .fd-cast-row .vx-btn svg { width: 18px; height: 18px; }
.cm-to { display: flex; align-items: center; gap: 6px; overflow-x: auto; padding: 0 2px 10px; scrollbar-width: none; }
.cm-to::-webkit-scrollbar { display: none; }
.cm-to > span { flex: none; font-size: 13px; color: rgba(255,255,255,.6); font-weight: 700; }
.cm-to button { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 5px; padding-inline: 5px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); color: #fff; font: 700 13px/1 inherit; font-family: inherit; }
.cm-to button[data-to=""] { padding: 7px 14px; }
.cm-to button .vx-av { width: 26px; height: 26px; }
.cm-to button.on { background: var(--vx-accent, #ff6a1f); border-color: transparent; }
.fd-info { position: absolute; z-index: 3; inset-inline: 14px 86px; bottom: calc(env(safe-area-inset-bottom) + 84px); }
.fd-who { display: flex; align-items: center; gap: 8px; color: #fff; text-decoration: none; font-weight: 800; font-size: 16px; }
.fd-who .vx-av { width: 34px; height: 34px; }
.fd-info h2 { margin: 6px 0 3px; font-size: 18px; line-height: 1.3; font-weight: 800; text-shadow: 0 1px 4px rgba(0,0,0,.7); }
.fd-info p { margin: 0; font-size: 14px; line-height: 1.45; color: rgba(255,255,255,.82); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.fd-open { display: inline-block; margin-top: 8px; color: #fff; font-weight: 700; font-size: 13px; background: rgba(255,255,255,.14); padding: 6px 11px; border-radius: 999px; text-decoration: none; }
.fd-hint { position: absolute; z-index: 3; bottom: calc(env(safe-area-inset-bottom) + 66px); inset-inline: 0; display: flex; justify-content: center; align-items: center; gap: 4px; font-size: 12.5px; color: rgba(255,255,255,.75); pointer-events: none; }
.fd-hint svg { width: 16px; height: 16px; animation: fd-bob 1.4s ease-in-out infinite; }
@keyframes fd-bob { 50% { transform: translateY(-4px); } }
.fd-line { position: absolute; z-index: 3; bottom: calc(env(safe-area-inset-bottom) + 60px); inset-inline: 0; height: 2px; background: rgba(255,255,255,.18); }
.fd-line i { display: block; height: 100%; width: 0; background: var(--vx-accent, #ff6a1f); }
.fd-game .fd-poster { filter: saturate(1.05); }
.fd-chip { display: inline-block; font-size: 12px; font-weight: 800; background: var(--vx-accent, #ff6a1f); color: #fff; padding: 4px 10px; border-radius: 999px; }
.fd-play { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 14px; padding: 16px; border: 0; border-radius: 999px; background: var(--vx-accent, #ff6a1f); color: #fff; font: 900 21px/1 inherit; font-family: inherit; box-shadow: 0 8px 30px rgba(255,106,31,.45); text-decoration: none; }
.fd-play svg { width: 22px; height: 22px; }
.fd-game .fd-info { inset-inline: 14px 86px; } .fd-game .fd-info p { -webkit-line-clamp: 2; }
.fd-chat { position: absolute; inset: 0; overflow-y: auto; padding: calc(env(safe-area-inset-top) + 118px) 16px calc(env(safe-area-inset-bottom) + 90px); background: radial-gradient(circle at 50% 0, rgba(255,106,31,.16), transparent 55%), #0b0b0e; }
.fd-chat h2 { margin: 0 0 4px; font-size: 22px; font-weight: 900; }
.fd-chat > p { margin: 0 0 14px; color: rgba(255,255,255,.65); font-size: 14.5px; }
.fd-ask { display: flex; gap: 8px; margin-bottom: 20px; }
.fd-ask input { flex: 1; min-width: 0; font: 500 16px/1.2 inherit; font-family: inherit; color: #fff; background: #17171c; border: 1.5px solid var(--vx-accent, #ff6a1f); border-radius: 14px; padding: 13px 14px; }
.fd-ask button { flex: none; width: 50px; border: 0; border-radius: 14px; background: var(--vx-accent, #ff6a1f); color: #fff; display: grid; place-items: center; }
.fd-ask button svg { width: 22px; height: 22px; transform: scaleX(-1); }
.fd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 10px; }
.fd-grid button { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: 0; color: #fff; font: 700 13px/1.25 inherit; font-family: inherit; text-align: center; padding: 0; }
.fd-grid .vx-av { width: 74px; height: 74px; }
.fd-grid small { color: rgba(255,255,255,.55); font-weight: 500; font-size: 11.5px; }
.fd-tut { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.66); }
.fd-tut .spot { position: fixed; border-radius: 999px; box-shadow: 0 0 0 3px var(--vx-accent, #ff6a1f), 0 0 24px 6px rgba(255,106,31,.6); pointer-events: none; transition: all .25s; }
.fd-tut .say { position: fixed; inset-inline: 18px 96px; color: #fff; font: 800 19px/1.35 inherit; font-family: inherit; text-shadow: 0 2px 8px #000; transition: top .25s; }
.fd-tut .say b { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--vx-accent, #ff6a1f); font-size: 15px; margin-inline-end: 8px; vertical-align: middle; }
.fd-tut .go { position: fixed; inset-inline: 24px; bottom: calc(env(safe-area-inset-bottom) + 34px); padding: 15px; border: 0; border-radius: 999px; background: var(--vx-accent, #ff6a1f); color: #fff; font: 800 18px/1 inherit; font-family: inherit; }
.fd-tut .n { position: fixed; inset-inline: 0; bottom: calc(env(safe-area-inset-bottom) + 12px); text-align: center; font-size: 13px; color: rgba(255,255,255,.6); }
@media (min-width: 761px) {
  .fd-list, .fd-chat { inset-inline: calc(50% - 240px); }
  .fd-rail { inset-inline-end: calc(50% - 232px); } .fd-info { inset-inline: calc(50% - 226px) calc(50% - 148px); }
  .fd-hint, .fd-line { inset-inline: calc(50% - 240px); }
}`;

function shell(tab) {
  if (!document.getElementById('fd-css')) { const s = document.createElement('style'); s.id = 'fd-css'; s.textContent = CSS; document.head.append(s); }
  return `<div class="fd" data-tab="${tab}"><div class="fd-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-fd-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div class="fd-list"></div></div>`;
}

// ---------- items ----------
function videoItem(v) {
  const cast = castOf(v), ch = cast[0], many = cast.length > 1;
  const faces = cast.slice(0, 3).map((c) => av({ char: c, ring: true })).join('');
  const names = cast.slice(0, 3).map((c) => esc(C[c].name)).join(' · ') + (cast.length > 3 ? ` +${cast.length - 3}` : '');
  return `<section class="fd-item" data-kind="video" data-id="${esc(v.id)}">
    <img class="fd-poster" src="${abs(v.poster)}" alt="" loading="lazy">
    <video muted playsinline webkit-playsinline loop preload="none" poster="${abs(v.poster)}" data-src="${abs(v.src)}"></video>
    <div class="fd-shade"></div>
    <div class="fd-rail">
      <button class="fd-faces ${many ? 'many' : ''}" data-fd-cast aria-label="מי בסרטון">${faces}</button>
      <button ${many ? 'data-fd-pick' : `data-fd-talk="${ch}"`} data-tut="talk"><span class="fd-rd main">${ICN.chat}</span>${many ? 'לדבר איתם' : 'לדבר עם ' + esc(first(ch))}</button>
      <button data-fd-cm data-tut="cm"><span class="fd-rd">${I.comment}</span>תגובות<small data-fd-n></small></button>
      <button data-fd-games><span class="fd-rd">${I.game}</span>משחקים</button>
      <button data-fd-share><span class="fd-rd">${I.share}</span>שתפו</button>
    </div>
    <div class="fd-info">
      <button class="fd-sound" data-fd-sound>${ICN.muted}<span>הקישו לסאונד</span></button>
      <button class="fd-who" data-fd-cast><span class="fd-faces sm ${many ? 'many' : ''}">${cast.slice(0, 3).map((c) => av({ char: c })).join('')}</span><span>${names}</span></button>
      <h2>${esc(v.title)}</h2>${v.teaser ? `<p>${esc(v.teaser)}</p>` : ''}
      <a class="fd-open" href="/v/${esc(v.id)}">לסרטון המלא ←</a>
    </div>
    <div class="fd-line"><i></i></div>
    <div class="fd-hint">${ICN.up}החליקו לעוד</div>
  </section>`;
}
function gameItem(g) {
  const ch = (g.chars || []).find((c) => C[c]);
  return `<section class="fd-item fd-game" data-kind="game" data-id="${esc(g.id)}">
    <img class="fd-poster" src="${abs(g.img)}" alt="" loading="lazy">
    <div class="fd-shade"></div>
    ${ch ? `<div class="fd-rail">
      <div class="fd-face"><a href="/c/${ch}">${av({ char: ch, ring: true })}</a></div>
      <button data-fd-talk="${ch}"><span class="fd-rd">${ICN.chat}</span>לדבר עם ${esc(first(ch))}</button>
      <button data-fd-share><span class="fd-rd">${I.share}</span>שתפו</button>
    </div>` : ''}
    <div class="fd-info">
      <span class="fd-chip">משחק</span>
      <h2 style="font-size:28px;margin-top:10px">${esc(g.title)}</h2>
      ${g.tagline ? `<p>${esc(g.tagline)}</p>` : ''}
      ${ch ? `<a class="fd-who" href="/c/${ch}" style="margin-top:10px;font-size:14px">${av({ char: ch })}<span>של ${esc(C[ch].name)}</span></a>` : ''}
      <a class="fd-play" href="${gamePath(g)}" data-fd-game="${esc(g.id)}" data-tut="play">${I.play}לשחק עכשיו</a>
    </div>
    <div class="fd-hint">${ICN.up}החליקו לעוד משחק</div>
  </section>`;
}
function chatPage() {
  const list = W.characters.filter((c) => c.img).slice(0, 60);
  return `<div class="fd-chat">
    <h2>דברו עם הדמויות</h2><p>כל דמות עונה לכם בעצמה. בחרו מישהו, או שאלו את כולם.</p>
    <form class="fd-ask" data-fd-ask><input type="text" placeholder="שאלו משהו, או @ לדמות" aria-label="שאלה לדמויות"><button aria-label="שליחה">${I.send}</button></form>
    <div class="fd-grid">${list.map((c) => `<button data-fd-talk="${c.id}">${av({ char: c.id, ring: true })}<span>${esc(c.name)}</span>${c.tagline ? `<small>${esc(String(c.tagline).slice(0, 34))}</small>` : ''}</button>`).join('')}</div>
  </div>`;
}

// ---------- playback: the item on screen plays (muted until a tap), the others stop ----------
function onScreen(item) {
  if (!S) return;
  S.cur = item;
  $$('.fd-item video', S.el).forEach((v) => { if (v.closest('.fd-item') !== item) { v.pause(); } });
  const v = $('video', item);
  if (v) {
    if (!v.src) v.src = v.dataset.src;
    v.muted = S.muted;
    v.play().then(() => { $('.fd-poster', item)?.remove(); }).catch(() => { v.muted = true; S.muted = true; v.play().catch(() => {}); });
    paintSound();
    const next = item.nextElementSibling && $('video', item.nextElementSibling);
    if (next && !next.src) { next.preload = 'metadata'; next.src = next.dataset.src; }
    if (!item.dataset.seen) {
      item.dataset.seen = 1;
      track('feed', 'video:' + item.dataset.id);
      F.getDoc(F.doc(db, 'videoStats', item.dataset.id)).then((d) => { const n = d.data()?.comments; if (n) $('[data-fd-n]', item).textContent = ' ' + n; }).catch(() => {});
    }
  } else if (!item.dataset.seen) { item.dataset.seen = 1; track('feed', item.dataset.kind + ':' + item.dataset.id); }
  // the next batch, before they reach the end
  if (S.items && $$('.fd-item', S.el).indexOf(item) >= S.shown - 2) more();
}
function paintSound() { if (S) $$('[data-fd-sound]', S.el).forEach((b) => { b.style.display = S.muted ? '' : 'none'; }); }
function more() {
  if (!S || !S.items || S.shown >= S.items.length) return;
  const list = $('.fd-list', S.el), add = S.items.slice(S.shown, S.shown + BATCH);
  S.shown += add.length;
  list.insertAdjacentHTML('beforeend', add.map(S.tab === 'games' ? gameItem : videoItem).join(''));
  $$('.fd-item:not([data-io])', list).forEach((it) => { it.dataset.io = 1; S.io.observe(it); bindItem(it); });
  paintFollow(list);
}
function bindItem(it) {
  const v = $('video', it);
  if (!v) return;
  v.addEventListener('contextmenu', (e) => e.preventDefault());
  v.addEventListener('loadedmetadata', () => { if (v.videoWidth > v.videoHeight) v.classList.add('wide'); });
  v.addEventListener('timeupdate', () => { if (v.duration) $('.fd-line i', it).style.width = (v.currentTime / v.duration) * 100 + '%'; });
  // a tap on the picture: sound on / off (and play if the browser stopped it)
  v.addEventListener('click', () => { S.muted = !S.muted; $$('.fd-item video', S.el).forEach((x) => { x.muted = S.muted; }); if (v.paused) v.play().catch(() => {}); paintSound(); if (!S.muted) track('feed', 'sound'); });
}

function draw(tab, order = null) {
  if (!S) return;
  S.tab = tab;
  S.el.dataset.tab = tab;
  $$('[data-fd-tab]', S.el).forEach((b) => b.classList.toggle('on', b.dataset.fdTab === tab));
  const list = $('.fd-list', S.el);
  S.io?.disconnect();
  $$('video', list).forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
  list.innerHTML = '';
  list.scrollTop = 0;
  if (tab === 'chat') { S.items = null; list.innerHTML = chatPage(); return; }
  S.items = order || (tab === 'games' ? games() : videos());
  S.shown = 0;
  S.io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) onScreen(e.target); }), { root: list, threshold: [0.6] });
  more();
  if (tab === 'videos') setTimeout(() => tutorial('videos'), 1400);
  if (tab === 'games') setTimeout(() => tutorial('games'), 900);
}

// ---------- who is in the video: talk to one of them, or open their page ----------
function castSheet(id) {
  const cast = castOf(V[id]);
  pauseFeed();
  const h = sheet(`<div class="fd-cast"><h3>${cast.length > 1 ? 'מי בסרטון' : 'בסרטון'}</h3>${cast.map((c) => `<div class="fd-cast-row">
      <a href="/c/${c}" data-close>${av({ char: c, ring: true })}<span><b>${esc(C[c].name)}</b>${C[c].tagline ? `<small>${esc(C[c].tagline)}</small>` : ''}</span></a>
      <button class="vx-btn main" data-talk-to="${c}">${ICN.chat}לדבר</button></div>`).join('')}</div>`, { cls: 'fd-cast-sheet', onClose: () => setTimeout(resumeFeed, 0) });
  h.el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-talk-to]');
    if (t) { track('feed', 'talk:' + t.dataset.talkTo); h.close(); setTimeout(() => { pauseFeed(); if (typeof openChat === 'function') openChat(t.dataset.talkTo); }, 50); return; }
    if (e.target.closest('[data-close]')) h.close();
  });
}

// ---------- the first-visit tutorial: spotlights on the real buttons ----------
function tutorial(kind) {
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(TUT) || '{}'); } catch (e) {}
  if (seen[kind] || !S || S.tab !== kind || document.querySelector('.fd-tut')) return;
  const item = $('.fd-item', S.el);
  if (!item) return;
  const steps = kind === 'games'
    ? [{ sel: '[data-tut="play"]', say: 'משחקים כאן, בלי לצאת מהפיד. כל משחק מסביר את עצמו בחצי דקה.' }]
    : [{ sel: '[data-tut="talk"]', say: 'דברו עם הדמויות שבסרטון. כל אחת עונה לכם בעצמה.' },
      { sel: '[data-tut="cm"]', say: 'בתגובות אפשר לכתוב לכולם, או לאחת הדמויות, והיא תענה לכם שם.' },
      { sel: null, say: 'החליקו למעלה לסרטון הבא. למעלה יש גם משחקים וצ\'אט.' }];
  let i = 0;
  const o = document.createElement('div');
  o.className = 'fd-tut';
  o.innerHTML = `<div class="spot"></div><div class="say"></div><button class="go"></button><div class="n"></div>`;
  document.body.append(o);
  const show = () => {
    const s = steps[i], spot = $('.spot', o), say = $('.say', o);
    const t = s.sel && item.querySelector(s.sel), r = t && (t.querySelector('.fd-rd') || t).getBoundingClientRect();
    if (r) { Object.assign(spot.style, { display: '', left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); say.style.top = Math.max(120, Math.min(innerHeight - 260, r.top - 10)) + 'px'; }
    else { spot.style.display = 'none'; say.style.top = innerHeight * 0.42 + 'px'; }
    say.innerHTML = `<b>${i + 1}</b>${s.say}`;
    $('.go', o).textContent = i < steps.length - 1 ? 'הבא' : 'הבנתי, בואו נתחיל';
    $('.n', o).textContent = steps.length > 1 ? `${i + 1}/${steps.length}` : '';
  };
  const done = () => { o.remove(); seen[kind] = 1; try { localStorage.setItem(TUT, JSON.stringify(seen)); } catch (e) {} track('feed', 'tut_done:' + kind); };
  $('.go', o).onclick = (e) => { e.stopPropagation(); if (++i >= steps.length) done(); else show(); };
  o.onclick = (e) => { if (e.target === o) done(); };
  track('feed', 'tut:' + kind);
  show();
}

// ---------- the page ----------
export function feedPage(q = {}) {
  const tab = TABS.some(([k]) => k === q.tab) ? q.tab : 'videos';
  setTimeout(() => mount(tab), 0);
  return shell(tab);
}
function mount(tab) {
  const el = document.querySelector('#app .fd');
  if (!el) return;
  unmountFeed();
  S = { el, tab, muted: true };
  el.addEventListener('click', onClick);
  draw(tab);
}
export function unmountFeed() {
  if (!S) return;
  S.io?.disconnect();
  $$('video', S.el).forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
  document.querySelector('.fd-tut')?.remove();
  S = null;
}
// a layer (a video page, a game, the chat) opened over the feed: the feed's video stops; back on the feed it plays again
export function pauseFeed() { if (S) $$('.fd-item video', S.el).forEach((v) => v.pause()); }
export function resumeFeed() { if (S && S.cur && location.pathname === '/new') onScreen(S.cur); }

function onClick(e) {
  const tabB = e.target.closest('[data-fd-tab]');
  if (tabB) { if (tabB.dataset.fdTab !== S.tab) { track('feed', 'tab:' + tabB.dataset.fdTab); draw(tabB.dataset.fdTab); } return; }
  const item = e.target.closest('.fd-item');
  const id = item?.dataset.id;
  if (e.target.closest('[data-fd-sound]')) { S.muted = false; $$('.fd-item video', S.el).forEach((x) => { x.muted = false; }); const v = $('video', item); v && v.play().catch(() => {}); paintSound(); track('feed', 'sound'); return; }
  const talk = e.target.closest('[data-fd-talk]');
  if (talk) { pauseFeed(); track('feed', 'talk:' + talk.dataset.fdTalk); if (typeof openChat === 'function') openChat(talk.dataset.fdTalk); return; }
  if (e.target.closest('[data-fd-pick], [data-fd-cast]')) { track('feed', (e.target.closest('[data-fd-pick]') ? 'pick:' : 'cast:') + id); castSheet(id); return; }
  if (e.target.closest('[data-fd-games]')) { track('feed', 'games:' + id); draw('games', gamesFor(castOf(V[id]))); return; }
  if (e.target.closest('[data-fd-cm]')) { pauseFeed(); track('feed', 'comments:' + id); nav(`/v/${encodeURIComponent(id)}?cm=1`); return; }
  const g = e.target.closest('[data-fd-game]');
  if (g) { pauseFeed(); track('feed', 'game:' + g.dataset.fdGame); return; }   // the router opens /play/<id>
  if (e.target.closest('.fd-open')) { pauseFeed(); track('feed', 'open:' + id); return; }
  if (e.target.closest('[data-fd-share]')) {
    const kind = item.dataset.kind, url = location.origin + (kind === 'game' ? '/play/' : '/v/') + id;
    const title = kind === 'game' ? (W.games || []).find((x) => x.id === id)?.title : V[id]?.title;
    track('feed', 'share:' + id);
    if (navigator.share) navigator.share({ title: title || 'שלומיוורס', url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast('הקישור הועתק'), () => {});
    return;
  }
}
document.addEventListener('submit', (e) => {
  const f = e.target.closest && e.target.closest('[data-fd-ask]');
  if (!f) return;
  e.preventDefault();
  const q = $('input', f).value.trim();
  if (!q) return;
  track('feed', 'ask');
  if (typeof openChat === 'function') openChat('guide', q);
  $('input', f).value = '';
});
