// Daily records (his ask, 2026-11-03; mockups scripts/v2-design/records.mjs): every game that reports a score
// (game-frame.js VerseFrame.score + game.json "record") gets a table that starts fresh each Israeli day. The verse
// function keeps it (op score / rank, records/<game>_<day>.top = the top 10); this file shows it - the home's "שיאי
// היום", the table on a game's page, and the moment a player takes first place. Names: the nickname they chose, big,
// and their Google first name, small - never more of their Google name.
import { db, F, call } from './fb.js';
import { T } from './copy.js';
import { I, $, esc, av, sheet, toast, track } from './ui.js';
import { st, needFan, signedIn } from './state.js';

const R = () => T.rec;
export const dayIL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
export const recGames = () => (W.games || []).filter((g) => g.record);
const fmt = (v) => String(Math.round(v * 100) / 100);
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
const docOf = (g) => F.doc(db, 'records', `${g.id}_${dayIL()}`);
const CROWN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8z"/></svg>';
export const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/></svg>';
const who = (x) => `<span class="rc-who"><b>${esc(x.nick)}</b>${x.first && x.first !== x.nick ? `<small>${esc(x.first)}</small>` : ''}</span>`;
const myFirst = () => String(st.user?.displayName || '').trim().split(/\s+/)[0] || '';

// ---------- the home: "שיאי היום" - one slim row per game, the leader only (round 2, his approval 2026-11-09:
// scripts/v2-design/records-2.mjs R6 / R7 - the tall stacked cards were "ugly"); a phone shows 4 then the page, a computer
// all of them in two columns. The full board is a page of its own: /records ----------
let homeOff = [];
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
// the boards of every scoring game, live; draw() runs on each change while its slot is on the page
function live(slot, draw) {
  homeOff.forEach((u) => u()); homeOff = [];
  const games = recGames(), boards = {};
  const paint = () => { if (document.body.contains(slot)) draw(games.slice().sort((a, b) => ((boards[b.id]?.players || 0) - (boards[a.id]?.players || 0))), boards); };
  paint();
  for (const g of games) homeOff.push(F.onSnapshot(docOf(g), (s) => { boards[g.id] = s.data() || null; paint(); }, () => {}));
  return paint;
}
const playersToday = (boards) => Object.values(boards).reduce((n, b) => n + (b?.players || 0), 0);
const unitOf = (g) => esc(g.record.unit);
export function mountHome() {
  const slot = document.getElementById('rec-slot');
  if (!slot || !recGames().length) { homeOff.forEach((u) => u()); homeOff = []; return; }
  live(slot, (games, boards) => {
    const n = playersToday(boards);
    slot.innerHTML = `<section class="sec rec-home"><div class="sec-h"><div><h2>${esc(R().title)}</h2><p class="rec-sub">${esc(R().sub)}${n ? ` · ${esc(fill(R().players, { n }))}` : ''}</p></div><a href="/records">${esc(R().all)} ←</a></div>
      <div class="rec-rows">${games.map((g) => {
        const top = boards[g.id]?.top?.[0];
        return `<a class="rec-row" href="/play/${g.id}">
          <span class="rr-pic">${g.img ? `<img src="${esc(g.img)}" alt="" loading="lazy">` : ''}</span>
          <span class="rr-game">${esc(g.title)}</span>
          ${top ? `<span class="rr-lead">${av({ fan: top })}<span class="rr-who"><b>${esc(top.nick)}</b><span><i>${fmt(top.value)}</i> ${unitOf(g)}</span></span></span>`
            : `<span class="rr-lead rr-none">${esc(R().empty)}</span>`}
          <span class="rr-go" aria-label="${esc(R().beat)}">${PLAY}</span></a>`;
      }).join('')}</div>
      ${games.length > 4 ? `<a class="vx-btn ghost-o block rec-all" href="/records">${esc(fill(R().allN, { n: games.length }))} ←</a>` : ''}</section>`;
  });
}
export function unmountHome() { homeOff.forEach((u) => u()); homeOff = []; }

// ---------- the page: /records - every game, today's top 3, how many played, your place (R3 on a phone, R7 on a computer) ----------
export function recordsPage() {
  setTimeout(mountPage, 0);   // live once it is on the page (it is drawn again when the account changes)
  return `<div class="rec-page"><div class="rp-head"><h1>${esc(R().title)}</h1><p class="rec-sub">${esc(R().pageSub)}</p><p class="rp-live" data-live></p></div><div id="rec-page-list" class="rp-list"></div></div>`;
}
export function mountPage() {
  const slot = document.getElementById('rec-page-list');
  if (!slot) return;
  const mine = {};
  const paint = live(slot, (games, boards) => {
    const n = playersToday(boards), lv = document.querySelector('.rec-page [data-live]');
    if (lv) lv.innerHTML = n ? `<i></i>${esc(fill(R().players, { n }))}` : '';
    slot.innerHTML = games.map((g) => {
      const b = boards[g.id], top = (b?.top || []).slice(0, 3), me = mine[g.id];
      return `<article class="rp-card">
        <a class="rp-pic" href="/play/${g.id}">${g.img ? `<img src="${esc(g.img)}" alt="" loading="lazy">` : ''}<b>${esc(g.title)}</b></a>
        <ol class="rp-top">${top.length ? top.map((x, i) => `<li class="${st.user && x.uid === st.user.uid ? 'me' : ''}"><span class="rp-place p${i + 1}">${i ? i + 1 : `<i>${CROWN}</i>`}</span>${av({ fan: x })}<span class="rp-who"><b>${esc(x.nick)}</b><span><i>${fmt(x.value)}</i> ${unitOf(g)}</span></span></li>`).join('')
          : `<li class="rp-empty">${esc(R().tableEmpty)}</li>`}</ol>
        <div class="rp-side">${b?.players ? `<span class="rp-n">${esc(fill(R().played, { n: b.players }))}</span>` : ''}
          ${me && me.value ? `<span class="rp-me"><small>${esc(R().youAt)}</small><b>${me.place}</b><small>${esc(fill(R().youWith, { n: fmt(me.value), unit: g.record.unit }))}</small></span>` : ''}
          <a class="vx-btn ${top.length ? 'ghost-o' : 'main'} rp-go" href="/play/${g.id}">${esc(top.length ? R().beat : R().first)}</a></div></article>`;
    }).join('');
  });
  // the visitor's own place in each game (signed in) - asked once a visit to the page
  if (signedIn()) recGames().forEach((g) => call('rank', { game: g.id }).then((r) => { if (r && r.value) { mine[g.id] = r; paint(); } }).catch(() => {}));
  track('records', 'page');
}

// ---------- the table on a game's page ----------
export function openBoard(g, { onAgain } = {}) {
  if (document.querySelector('.rb')) return;
  let board = null, mine = null;
  const h = sheet(`<div class="rb-head">${g.img ? `<img src="${esc(g.img)}" alt="">` : ''}<div><h3>${esc(g.title)}</h3><p>${esc(R().sheet)}</p></div>
      <button class="vx-x" data-vx-close style="position:static;margin-inline-start:auto">${I.x}</button></div>
    <div class="rb-list"></div><div class="rb-me"></div>`, { cls: 'rb', onClose: () => off() });
  const list = $('.rb-list', h.el), me = $('.rb-me', h.el);
  const draw = () => {
    const top = board?.top || [];
    list.innerHTML = top.length ? top.map((x, i) => `<div class="rb-row ${i < 3 ? 'p' + (i + 1) : ''} ${st.user && x.uid === st.user.uid ? 'me' : ''}">
        <span class="rb-place">${i < 3 ? `<i>${CROWN}</i>` : ''}<b>${i + 1}</b></span>${av({ fan: x })}${who(x)}
        <span class="rb-n"><b>${fmt(x.value)}</b><small>${esc(g.record.unit)}</small></span></div>`).join('')
      : `<div class="rb-empty">${esc(R().tableEmpty)}</div>`;
    if (!signedIn()) me.innerHTML = `<div class="rb-mine"><span>${esc(R().signRow)}</span><button class="vx-btn main" data-in>${esc(T.rec.gateBtn)}</button></div>`;
    else me.innerHTML = `<div class="rb-mine">${av({ fan: st.fan })}<span>${mine && mine.value ? esc(fill(R().mine, { place: mine.place, n: fmt(mine.value), unit: g.record.unit })) : ''}</span>
      <button class="vx-btn main" data-again>${esc(R().again)}</button></div>`;
  };
  const off = F.onSnapshot(docOf(g), (s) => { board = s.data() || null; draw(); }, () => {});
  if (signedIn()) call('rank', { game: g.id }).then((r) => { mine = r; draw(); }).catch(() => {});
  draw();
  h.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-again]')) { h.close('again'); onAgain && onAgain(); }
    else if (b.matches('[data-in]') && (await needFan('record'))) { call('rank', { game: g.id }).then((r) => { mine = r; draw(); }).catch(() => {}); draw(); }
  });
  track('records', g.id);
}

// ---------- a game ended: its score goes on today's table ----------
// signed in: send it - first place gets the moment, a personal best of the day a toast. Signed out: offer to sign in
// and send the score they just made.
export async function onScore(g, value, { reopen } = {}) {
  if (!g.record || !(value > 0)) return;
  if (!signedIn()) {
    await wait(1500);
    const h = sheet(`<div class="rm-out"><div class="rm-n">${fmt(value)}<small>${esc(g.record.unit)}</small></div><h3>${esc(R().outTitle)}</h3>
      <button class="vx-btn main block" data-in>${esc(R().outBtn)}</button></div>`, { cls: 'rm' });
    h.el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-in]')) return;
      if (!(await needFan('record'))) return;
      h.close('in');
      send(g, value, reopen);
    });
    return;
  }
  send(g, value, reopen);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function send(g, value, reopen) {
  let r;
  try { r = await call('score', { game: g.id, value }); } catch (e) { console.warn('score', e); return; }
  if (!r || !r.best) return;
  await wait(1200);
  if (r.first) moment(g, r, reopen);
  else toast(fill(R().bestToast, { n: fmt(r.value), unit: g.record.unit, place: r.place }));
}
function moment(g, r, reopen) {
  track('record', g.id);
  const h = sheet(`<div class="rm-card"><i class="rm-crown">${CROWN}</i><h2>${esc(R().momentTitle)}</h2>
      <div class="rm-face">${av({ fan: st.fan })}</div>${who({ nick: st.fan?.nick || '', first: myFirst() })}
      <div class="rm-n">${fmt(r.value)}<small>${esc(g.record.unit)}</small></div>
      <p class="rm-line">${r.passed ? `${av({ fan: r.passed })}<span>${esc(fill(R().momentPassed, { nick: r.passed.nick }))}</span>` : `<span>${esc(R().momentFirst)}</span>`}</p>
      <div class="rm-btns"><button class="vx-btn main" data-table>${esc(R().momentTable)}</button><button class="vx-btn glass" data-share>${I.share}${esc(R().momentShare)}</button></div></div>`, { cls: 'rm' });
  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-table]')) { h.close('table'); setTimeout(() => openBoard(g, { onAgain: reopen }), 250); }
    else if (b.matches('[data-share]')) {
      const url = `${location.origin}/play/${g.id}`, text = fill(R().shareText, { game: g.title, n: fmt(r.value), unit: g.record.unit });
      track('share', g.id);
      if (navigator.share) navigator.share({ title: g.title, text, url }).catch(() => {});
      else { navigator.clipboard?.writeText(`${text} ${url}`); toast(T.linkCopied); }
    }
  });
}
