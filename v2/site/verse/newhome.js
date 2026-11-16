// shlomiverse.com/new - the new home, being tested (not the home yet). Shlomi, 2026-11-16, plan home-first-screen round 5:
// no feed; the chat first (the most used thing: 29% of new visitors start with it, 86% of them write), and right under it the
// things that keep visitors longest - games (finishing one: 261 s), videos (169 s), the simulation (184 s), the characters'
// stories. Very ordered, one clear action per section. It is an APP (his note): the site's own top bar and bottom bar stay as
// they are, and every door opens the app's real screens - the chat, the video, the game, the stories - with the way back to here.
import { $, $$, esc, abs, av, track } from './ui.js';
import { ringsHtml, onStories } from './stories.js';
import { mountBand } from './sim.js';
import { onState } from './state.js';

const N_FACES = 12;
const t = (x) => track('feed', x);   // the /new test's own event (analytics.js EVENTS 'feed')

// the characters with the newest videos first (as the home orders them), then the rest of the canon, faces only
function faces() {
  const seen = new Set(), out = [];
  const add = (id) => { const c = C[id]; if (c && c.img && !seen.has(id)) { seen.add(id); out.push(c); } };
  (typeof fresh === 'function' ? fresh() : W.videos).forEach((v) => (v.cast || []).forEach(add));
  W.characters.forEach((c) => add(c.id));
  return out.slice(0, N_FACES);
}
const games = () => [...(W.games || [])].filter((g) => g.url && g.img).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
const videos = () => (typeof fresh === 'function' ? fresh() : W.videos).filter((v) => v.poster && !v.url && !String(v.id).startsWith('story-'));
const lead = (v) => (v.cast || []).find((c) => C[c]);

const ICN = {
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4 9.5 14.5"/><path d="M20 4 13.5 20l-4-5.5L4 10.5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 7h9a5 5 0 0 1 4.9 6l-.8 3.7a2.4 2.4 0 0 1-4.1 1.1L14.4 16H9.6l-2.1 1.8a2.4 2.4 0 0 1-4.1-1.1L2.6 13a5 5 0 0 1 4.9-6z"/><path d="M8 10v3M6.5 11.5h3"/><circle cx="15.5" cy="10.5" r=".6" fill="currentColor"/><circle cx="17" cy="12.5" r=".6" fill="currentColor"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.5h18M8 5l-1.5 4.5M13 5l-1.5 4.5M18 5l-1.5 4.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  rings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5" stroke-dasharray="4 2.2"/><circle cx="12" cy="12" r="4.5"/></svg>',
};

const CSS = `
body[data-page="new"] #fab { display: none !important; }
.nh { max-width: 640px; margin: 0 auto; padding: 14px 16px 28px; display: flex; flex-direction: column; gap: 14px; }
.nh-sec { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 16px; }
.nh-head { display: flex; align-items: center; gap: 8px; min-height: 32px; margin-bottom: 12px; }
.nh-head h2 { font-size: 1.2rem; font-weight: 900; line-height: 1.2; letter-spacing: -.01em; display: flex; align-items: center; gap: 8px; }
.nh-head h2 svg { width: 22px; height: 22px; color: var(--accent); flex: none; }
.nh-head h2 em { font-style: normal; color: var(--accent); }
.nh-more { margin-inline-start: auto; display: inline-flex; align-items: center; gap: 2px; height: 38px; padding-inline: 14px 10px; border-radius: 99px; border: 1px solid rgba(255,106,31,.35); font-size: .8rem; font-weight: 700; color: var(--text); text-decoration: none; white-space: nowrap; }
.nh-more svg { width: 14px; height: 14px; color: var(--accent); }
/* 1. the chat */
.nh-chat { position: relative; overflow: hidden; border-color: rgba(255,106,31,.45); box-shadow: 0 0 0 1px rgba(255,106,31,.08), 0 10px 40px -18px rgba(255,106,31,.55); }
.nh-chat::before { content: ''; position: absolute; inset: -40% -30% auto auto; width: 70%; height: 120%; background: radial-gradient(closest-side, rgba(255,106,31,.22), transparent); pointer-events: none; }
.nh-chat > * { position: relative; }
.nh-chat h2 { font-size: 1.5rem; font-weight: 900; line-height: 1.15; letter-spacing: -.01em; margin: 0; }
.nh-chat h2 em { font-style: normal; color: var(--accent); }
.nh-chat > p { color: var(--dim); font-size: .92rem; line-height: 1.4; margin: 2px 0 12px; }
.nh-ask { display: flex; align-items: center; gap: 8px; height: 54px; padding: 4px; padding-inline-start: 16px; background: var(--bg); border: 1.5px solid var(--accent); border-radius: 18px; box-shadow: 0 0 0 4px rgba(255,106,31,.10); transition: box-shadow .15s; }
.nh-ask:focus-within { box-shadow: 0 0 0 4px rgba(255,106,31,.24); }
.nh-ask input { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; background: none; outline: none; font-family: inherit; font-size: 16px; font-weight: 500; color: var(--text); }
.nh-ask input::placeholder { color: var(--dim); opacity: 1; }
.nh-ask button { flex: none; width: 44px; height: 44px; border: 0; border-radius: 13px; background: var(--accent); color: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 4px 14px -4px rgba(255,106,31,.7); }
.nh-ask button svg { width: 22px; height: 22px; transform: scaleX(-1); }
.nh-ask button:active { transform: scale(.94); }
.nh-faces { display: flex; align-items: flex-start; gap: 10px; overflow-x: auto; margin: 12px -16px -6px; padding: 2px 16px 6px; scroll-padding-inline: 16px; scrollbar-width: none; scroll-snap-type: x proximity; }
.nh-faces::-webkit-scrollbar { display: none; }
.nh-face { flex: none; width: 62px; display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: 0; padding: 0; color: var(--text); font-family: inherit; font-size: .76rem; font-weight: 700; line-height: 1.2; text-align: center; cursor: pointer; scroll-snap-align: start; text-decoration: none; -webkit-tap-highlight-color: transparent; }
.nh-face .vx-av { width: 62px; height: 74px; border-radius: 14px; background: var(--card2); box-shadow: inset 0 0 0 1px var(--line2); transition: transform .12s; }
.nh-face .vx-av img { object-position: center 25%; }
.nh-face:active .vx-av { transform: scale(.95); }
.nh-face span:last-child { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nh-face.all .nh-all { width: 62px; height: 74px; border-radius: 14px; display: grid; place-items: center; border: 1.5px dashed var(--line2); color: var(--accent); }
.nh-face.all .nh-all svg { width: 22px; height: 22px; }
/* 2. games - the card is the section */
.nh-games { position: relative; padding: 0; overflow: hidden; }
.nh-game { display: block; position: relative; min-height: 192px; text-decoration: none; color: #fff; background: #111 center / cover no-repeat; }
.nh-game::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to left, rgba(10,10,14,.94) 0%, rgba(10,10,14,.82) 40%, rgba(10,10,14,.2) 72%, rgba(10,10,14,0) 100%); }
.nh-game-in { position: relative; z-index: 1; padding: 16px 18px; max-width: 64%; min-height: 192px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
.nh-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: .82rem; font-weight: 800; color: var(--accent); }
.nh-eyebrow svg { width: 18px; height: 18px; }
.nh-game-in b { font-size: 1.55rem; font-weight: 900; line-height: 1.12; text-shadow: 0 2px 14px rgba(0,0,0,.6); }
.nh-game-in small { font-size: .84rem; color: rgba(255,255,255,.8); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nh-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; height: 44px; padding: 0 18px; border-radius: 99px; background: var(--accent); color: #fff; font-weight: 800; font-size: .98rem; box-shadow: 0 6px 18px -6px rgba(255,106,31,.7); }
.nh-btn svg { width: 18px; height: 18px; }
.nh-game-more { position: absolute; z-index: 2; inset-inline-end: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 2px; height: 38px; padding-inline: 14px 10px; border-radius: 99px; background: rgba(10,10,14,.62); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.2); color: #fff; font-size: .8rem; font-weight: 700; text-decoration: none; }
.nh-game-more svg { width: 14px; height: 14px; }
/* 3. videos - picture, then title, then who (as on /videos) */
.nh-videos { padding: 14px 12px 14px; }
.nh-videos .nh-head { padding-inline: 4px; }
.nh-vids { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nh-vid { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: var(--text); text-decoration: none; }
.nh-vid-pic { position: relative; display: block; aspect-ratio: 1 / 1; border-radius: 14px; overflow: hidden; background: var(--card2); }
.nh-vid-pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 22%; }
.nh-vid-play { position: absolute; inset-inline-end: 8px; bottom: 8px; width: 34px; height: 34px; border-radius: 50%; background: rgba(0,0,0,.55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: #fff; display: grid; place-items: center; }
.nh-vid-play svg { width: 16px; height: 16px; }
.nh-vid-t { margin-top: 2px; font-weight: 800; font-size: .9rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nh-vid-who { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: .76rem; font-weight: 600; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nh-vid-who .vx-av { width: 20px; height: 20px; }
/* 4. the simulation band, fitted to this page's cards */
.nh #sim-band:empty { display: none; }
.nh .sim-band { margin: 0; border-radius: 20px; padding: 14px; padding-inline-end: 16px; box-shadow: none; border-color: rgba(178,120,255,.4); }
.nh .sim-band::after { display: none; }
.nh .sim-band-h { animation: none; text-shadow: none; font-size: 1.12rem; }
.nh .sim-band-l { -webkit-line-clamp: 2; }
.nh .sim-band-face { width: 56px; height: 56px; box-shadow: none; }
.nh .sim-band-go { height: 40px; padding: 0 16px; box-shadow: none; }
/* 5. stories */
.nh-stories { padding-bottom: 8px; }
.nh-stories .nh-head { margin-bottom: 6px; }
.nh-stories .rings { padding: 4px 0 8px; }
.nh-stories .ring .rim > span { border-color: var(--card); }
.nh-stories-empty { color: var(--dim); font-size: .92rem; padding-bottom: 8px; }
:root[data-theme="light"] .nh-ask button, :root[data-theme="light"] .nh-btn { color: #fff; }
:root[data-theme="light"] .nh-chat { box-shadow: 0 8px 28px -18px rgba(255,106,31,.5); }
:root[data-theme="light"] .nh-ask { background: var(--card2); box-shadow: none; }
:root[data-theme="light"] .nh-ask:focus-within { box-shadow: 0 0 0 4px rgba(255,106,31,.16); }
/* the last section clears the fixed bottom bar (QA) - last, so it wins over .nh's padding */
@media (max-width: 760px) { .nh { padding-bottom: calc(24px + 64px + env(safe-area-inset-bottom)); } }
`;

function css() { if (!document.getElementById('nh-css')) { const s = document.createElement('style'); s.id = 'nh-css'; s.textContent = CSS; document.head.append(s); } }

const sec = (cls, head, body) => `<section class="nh-sec ${cls}">${head}${body}</section>`;
const head = (icon, title, more) => `<div class="nh-head"><h2>${icon}${title}</h2>${more || ''}</div>`;
const moreLink = (href, label, key) => `<a class="nh-more" href="${href}" data-nh="${key}">${esc(label)}${ICN.more}</a>`;

function chatSec() {
  return `<section class="nh-sec nh-chat">
    <h2>דברו עם <em>הדמויות</em></h2>
    <p>שאלו כל דבר. כל דמות עונה לכם בעצמה.</p>
    <form class="nh-ask" data-nh-ask autocomplete="off"><input type="text" enterkeyhint="send" placeholder="שאלו משהו, או @ לדמות" aria-label="שאלה לדמויות"><button type="submit" aria-label="שליחה">${ICN.send}</button></form>
    <div class="nh-faces" role="list">${faces().map((c) => `<button class="nh-face" role="listitem" data-talk="${c.id}" data-nh="talk:${c.id}" aria-label="לדבר עם ${esc(c.name)}">${av({ char: c.id })}<span>${esc(c.name)}</span></button>`).join('')}
      <a class="nh-face all" href="/characters" data-nh="more:characters"><span class="nh-all">${ICN.more}</span><span>כל הדמויות</span></a></div>
  </section>`;
}
function gameSec() {
  const list = games(), g = list[0];
  if (!g) return '';
  const ch = (g.chars || []).find((c) => C[c]);
  const sub = g.tagline ? `<small>${esc(g.tagline)}</small>` : ch ? `<small>של ${esc(C[ch].name)}</small>` : '';
  return `<section class="nh-sec nh-games">
    <a class="nh-game" href="/play/${esc(g.id)}" data-nh="game:${esc(g.id)}" style="background-image:url('${abs(g.img)}')">
      <span class="nh-game-in"><span class="nh-eyebrow">${ICN.game}משחקים</span><b>${esc(g.title)}</b>${sub}
      <span class="nh-btn">${ICN.play}שחקו עכשיו</span></span></a>
    ${list.length > 1 ? `<a class="nh-game-more" href="/games" data-nh="more:games">עוד משחקים${ICN.more}</a>` : ''}
  </section>`;
}
function videoSec() {
  const list = videos().slice(0, 2);
  if (!list.length) return '';
  return sec('nh-videos', head(ICN.film, 'סרטונים <em>חדשים</em>', moreLink('/videos', 'לכל הסרטונים', 'more:videos')),
    `<div class="nh-vids">${list.map((v) => { const c = lead(v); return `<a class="nh-vid" href="/v/${esc(v.id)}" data-nh="video:${esc(v.id)}">
      <span class="nh-vid-pic"><img src="${abs(v.poster)}" alt="" loading="lazy"><span class="nh-vid-play">${ICN.play}</span></span>
      <span class="nh-vid-t">${esc(v.title)}</span>${c ? `<span class="nh-vid-who">${av({ char: c })}${esc(C[c].name)}</span>` : ''}</a>`; }).join('')}</div>`);
}
function storiesSec() {
  const rings = ringsHtml();
  return sec('nh-stories', head(ICN.rings, '<em>הסטוריז</em> של הדמויות', ''), `<div data-nh-rings>${rings || '<div class="nh-stories-empty">טוענים...</div>'}</div>`);
}

export function newHomePage() {
  css();
  setTimeout(mount, 0);
  return `<div class="nh">${chatSec()}${gameSec()}${videoSec()}<div id="sim-band"></div>${storiesSec()}</div>`;
}
function mount() {
  const el = document.querySelector('#app .nh');
  if (!el) return;
  document.querySelector('.nav [data-nav=""]')?.classList.add('on');
  mountBand();   // the simulation band, gated and drawn by sim.js exactly as on the home (gone after the test)
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', (e) => { const a = e.target.closest('[data-nh]'); if (a) t(a.dataset.nh); }, true);   // counted; the app's own handlers do the rest (data-talk opens the chat, links route)
    el.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-nh-ask]');
      if (!f) return;
      e.preventDefault();
      const input = $('input', f), q = input.value.trim();
      if (!q) { input.focus(); return; }
      t('ask');
      input.value = '';
      input.blur();
      if (typeof openChat === 'function') openChat('guide', q);   // the guide hands an @character over, as in the chat itself
    });
  }
}
// while on /new, the bottom bar's "צ'אט" opens the chat over this page instead of going to the old home
document.addEventListener('click', (e) => {
  const a = location.pathname === '/new' && e.target.closest('.nav a[data-nav="chat"], .nav a[href="/chat"]');
  if (!a || typeof openChat !== 'function') return;
  e.preventDefault(); e.stopPropagation();
  t('nav:chat');
  openChat('guide');
}, true);
// the stories arrive after the page is drawn: fill the row in place
onStories(() => { const box = document.querySelector('#app .nh [data-nh-rings]'); if (box) box.innerHTML = ringsHtml() || '<div class="nh-stories-empty">אין סטוריז חדשים כרגע.</div>'; });
// signed in / out after the page was drawn: the simulation band is redrawn (it hides after the test, small for residents)
onState(() => { if (location.pathname === '/new') mountBand(); });
