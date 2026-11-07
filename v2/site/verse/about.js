// "ספרו לנו עליכם" on the page side (plan cz-sim-r3, his yes 2026-11-07): the person's one profile (techietech-api/about.js).
// Here: the characters picker (Miriam's "את מי באתם לבקר?" and the edit sheet - search, round faces, up to 3), the card "מה סיפרתם
// לנו" on the אני page (mockup r3-me-1: a row per field, "שינוי" / "להוסיף", notifications as a switch) and its edit sheets - the
// site's sheet, never a panel that changes in place. Reads and writes through the verse function (aboutGet / aboutPut).
import { T } from './copy.js';
import { esc, av, sheet, toast, track } from './ui.js';
import { st, onState, signedIn } from './state.js';
import { call } from './fb.js';
import { aboutOpen } from './gates.js';
import { pushState, enablePush, swReady } from './push.js';

const A = () => T.about;
const line = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
// line icons in the site's style (ui.js I.*) - one per field, and the answers of "מאיפה" (no emoji anywhere)
export const AI = {
  search: line('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  fav: line('<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.3c2 .7 3.5 2.6 4 5.2"/>'),
  source: line('<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  bday: line('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke-width="2.4"/>'),
  push: line('<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
  world: line('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"/><path d="M9 9.8h.01M15 9.8h.01" stroke-width="2.6"/>'),
  wish: line('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.3A8.5 8.5 0 1 1 20.5 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.6"/>'),
  stage: line('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  first: line('<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>'),
  channel: line('<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  // the answers of "מאיפה טסתם אלינו?" (mockup r3-source-1)
  tiktok: line('<path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3.5c.4 2.6 2.2 4.4 5 4.6"/>'),
  instagram: line('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><path d="M17 7h.01" stroke-width="2.6"/>'),
  youtube: line('<rect x="2.5" y="5.5" width="19" height="13" rx="3.5"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>'),
  friend: line('<circle cx="12" cy="8" r="4"/><path d="M4 20.5c.9-4 4.1-6.5 8-6.5s7.1 2.5 8 6.5"/>'),
  other: line('<circle cx="12" cy="12" r="8.5"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.8"/>'),
  // the answers of "מה תעשו פה קודם?"
  videos: line('<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>'),
  chat: line('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.3A8.5 8.5 0 1 1 20.5 12z"/>'),
  games: line('<path d="M7.5 7h9a5 5 0 0 1 4.9 6l-.8 3.7a2.4 2.4 0 0 1-4.1 1.1L14.4 16H9.6l-2.1 1.8a2.4 2.4 0 0 1-4.1-1.1L2.6 13a5 5 0 0 1 4.9-6z"/><path d="M8 10v3M6.5 11.5h3"/>'),
  stickers: line('<path d="M20 12.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5"/><path d="M20 12.5 12.5 20c0-4.1 3.4-7.5 7.5-7.5z"/>'),
  check: line('<path d="m5 12.5 4.5 4.5L19 7.5"/>').replace('stroke-width="1.8"', 'stroke-width="3"'),
  x: line('<path d="M6 6l12 12M18 6 6 18"/>').replace('stroke-width="1.8"', 'stroke-width="2.2"'),
};
// "22 באוגוסט 1994" (a birthday without a year: "22 באוגוסט")
export const fmtDate = (x) => (x && x.d ? `${x.d} ${A().months[x.m - 1] || ''}${x.y ? ' ' + x.y : ''}` : '');
const first = (name) => String(name || '').split(' ')[0];

// ---------- the characters picker ----------
// every character with a face, the ones with the most videos first; search by name; up to `max` picked (orange ring + check),
// the picked ones also as chips with x. `onChange(ids)` after every change.
const people = () => Object.values(C).filter((c) => c && c.img && c.id !== 'guide').sort((a, b) => (b.videos ? b.videos.length : 0) - (a.videos ? a.videos.length : 0));
export function charsPicker(root, { max = 3, picked = [], onChange } = {}) {
  let ids = picked.filter((id) => C[id]).slice(0, max), q = '';
  root.innerHTML = `<div class="ab-pick">
    <label class="ab-search">${AI.search}<input type="search" placeholder="${esc(A().search)}" enterkeyhint="search"></label>
    <div class="ab-chips"></div><div class="ab-grid"></div></div>`;
  const chips = root.querySelector('.ab-chips'), grid = root.querySelector('.ab-grid');
  const paintChips = () => {
    chips.innerHTML = `<span class="ab-n">${esc(A().picked(ids.length, max))}</span>${ids.map((id) => `<button type="button" class="ab-chip" data-ab-x="${esc(id)}" aria-label="${esc(C[id].name)}">${av({ char: id })}${AI.x}</button>`).join('')}`;
  };
  const paintGrid = () => {
    const s = q.trim();
    const list = people().filter((c) => !s || c.name.includes(s) || (c.aka || []).some((x) => String(x).includes(s)) || c.id.includes(s.toLowerCase()));
    grid.innerHTML = list.length ? list.map((c) => `<button type="button" class="ab-c ${ids.includes(c.id) ? 'on' : ''}" data-ab-c="${esc(c.id)}">${av({ char: c.id })}<i>${AI.check}</i><b>${esc(c.name)}</b></button>`).join('')
      : `<p class="ab-none">${esc(A().none)}</p>`;
  };
  const changed = () => { paintChips(); grid.querySelectorAll('[data-ab-c]').forEach((b) => b.classList.toggle('on', ids.includes(b.dataset.abC))); if (onChange) onChange(ids.slice()); };
  root.querySelector('input').addEventListener('input', (e) => { q = e.target.value; paintGrid(); });
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-ab-c]'), x = e.target.closest('[data-ab-x]');
    if (c) {
      const id = c.dataset.abC;
      if (ids.includes(id)) ids = ids.filter((y) => y !== id);
      else if (ids.length < max) ids.push(id);
      else { c.classList.add('full'); setTimeout(() => c.classList.remove('full'), 400); return; }
      changed();
    } else if (x) { ids = ids.filter((y) => y !== x.dataset.abX); changed(); }
  });
  paintChips(); paintGrid();
  return { get: () => ids.slice() };
}

// ---------- the profile: loaded once per account, kept here ----------
let me = null, fields = null, forUid = null, loading = false;
const changed = () => window.dispatchEvent(new Event('vx-about'));   // pages.js draws the אני page again
export async function loadAbout(force) {
  if (!st.user || (loading && !force)) return;
  if (!force && forUid === st.user.uid && me) return;
  loading = true;
  try { const r = await call('aboutGet'); me = r.about; fields = r.fields; forUid = st.user.uid; }
  catch (e) { console.error('about', e); me = me || {}; }
  loading = false;
  changed();
}
onState(() => { if (st.user && forUid && forUid !== st.user.uid) { me = null; forUid = null; } });
async function put(patch, extra = {}) {
  const r = await call('aboutPut', { patch, ...extra });
  me = r.about; forUid = st.user.uid;
  changed();
  return me;
}
export const putAbout = put;

// what a field's answer looks like in its row
const optLabel = (k, v) => (fields && fields[k] && fields[k].opts && fields[k].opts[v]) || v;
function answer(k, x) {
  const v = x && x.v;
  if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return '';
  if (k === 'fav') return `<span class="ab-faces">${v.filter((id) => C[id]).map((id) => `<span>${av({ char: id })}<small>${esc(first(C[id].name))}</small></span>`).join('')}</span>`;
  if (k === 'bday') return esc(fmtDate(v));
  if (k === 'world') return esc((S[v] && S[v].title) || v);
  if (k === 'wish') return esc(v);
  return esc(optLabel(k, v));
}
const ORDER = ['fav', 'source', 'bday', 'push', 'world', 'wish', 'stage', 'first', 'channel'];

// the card on the אני page (mockup r3-me-1)
export function aboutCard() {
  if (!aboutOpen() || !signedIn()) return '';
  if (!me || forUid !== st.user.uid) { loadAbout(); return `<section class="ab-card"><h2>${esc(A().title)}</h2><div class="vx-spin"></div></section>`; }
  const row = (k) => {
    const x = me[k], ans = answer(k, x);
    const act = k === 'push' ? `<button class="vx-switch ab-sw ${x && x.v === 'yes' ? 'on' : ''}" data-ab-push role="switch" aria-checked="${x && x.v === 'yes'}" aria-label="${esc(A().labels.push)}"></button>`
      : `<button class="ab-act" data-ab-edit="${k}">${esc(ans ? A().change : A().add)}</button>`;
    return `<div class="ab-row ${ans || k === 'push' ? '' : 'no-ans'}"><span class="ab-ic">${AI[k]}</span><span class="ab-l">${esc(A().labels[k])}</span>
      <span class="ab-v">${k === 'push' ? '' : ans || esc(A().empty)}</span>${act}</div>`;
  };
  return `<section class="ab-card"><h2>${esc(A().title)}</h2><p>${esc(A().sub)}</p>${ORDER.map(row).join('')}</section>`;
}

// ---------- the edit sheets: one per kind of field ----------
function editSheet(k) {
  const f = fields && fields[k], x = me && me[k], cur = x ? x.v : null, L = A().labels[k];
  if (!f) return;
  const head = `<div class="in ab-sheet"><h2 class="vx-h">${esc(L)}</h2>`;
  const done = (h) => (p) => p.then(() => { toast(A().saved); track('about_edit', k); h.close('saved'); }).catch((e) => toast(e.code === 'date' ? T.cz.bdayBad : A().fail, 3200));
  if (f.kind === 'chars') {
    const h = sheet(`${head}<div data-ab-picker></div><div class="ab-dock"><button class="vx-btn main block" data-ab-save>${esc(A().save)}</button></div></div>`, { cls: 'ab' });
    const p = charsPicker(h.el.querySelector('[data-ab-picker]'), { max: f.max || 3, picked: cur || [] });
    h.el.querySelector('[data-ab-save]').onclick = (e) => { e.currentTarget.classList.add('wait'); const ids = p.get(); done(h)(put({ fav: ids.length ? ids : null })); };
    return;
  }
  if (f.kind === 'pick' || f.kind === 'series') {
    const opts = f.kind === 'pick' ? Object.entries(f.opts) : (W.series || []).filter((s) => s.characters && s.characters.length).map((s) => [s.id, s.title]);
    const h = sheet(`${head}<div class="ab-opts ${f.kind === 'series' ? 'series' : ''}">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-ab-v="${esc(v)}">${AI[v] || ''}<span>${esc(l)}</span></button>`).join('')}</div></div>`, { cls: 'ab' });
    h.el.querySelectorAll('[data-ab-v]').forEach((b) => (b.onclick = () => { b.classList.add('on', 'wait'); done(h)(put({ [k]: b.dataset.abV })); }));
    return;
  }
  if (f.kind === 'text') {
    const h = sheet(`${head}<textarea class="ab-text" rows="3" maxlength="${f.max || 200}" placeholder="${esc(A().wishPh)}">${esc(cur || '')}</textarea><button class="vx-btn main block" data-ab-save>${esc(A().save)}</button></div>`, { cls: 'ab' });
    h.el.querySelector('[data-ab-save]').onclick = (e) => { const v = h.el.querySelector('textarea').value.trim(); e.currentTarget.classList.add('wait'); done(h)(put({ wish: v || null })); };
    return;
  }
  if (f.kind === 'date') {
    const h = sheet(`${head}<form class="cz-ask ab-date"><input maxlength="80" placeholder="${esc(A().bdayPh)}" value="${esc(x && x.v ? fmtDate(x.v) : '')}"><button aria-label="${esc(A().save)}">←</button></form>
      <button class="vx-link" data-ab-none>${esc(A().bdayNo)}</button></div>`, { cls: 'ab' });
    h.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (!v) return; e.target.querySelector('button').classList.add('wait');
      put({ bday: v }).then((m) => { toast(`${T.cz.bdayGot} ${fmtDate(m.bday && m.bday.v)}`, 3200); h.close('saved'); }).catch((err) => { e.target.querySelector('button').classList.remove('wait'); toast(err.code === 'date' ? T.cz.bdayBad : A().fail, 3200); }); };
    h.el.querySelector('[data-ab-none]').onclick = () => done(h)(put({ bday: null }));
  }
}
// notifications as a switch: on = the site's real permission flow (push.js) and "yes"; off = "no" and this device stops getting them
async function togglePush(btn) {
  const on = !(me && me.push && me.push.v === 'yes');
  btn.classList.toggle('on', on);
  try {
    if (on) {
      const s = pushState();
      if (s === 'denied' || s === 'unsupported') { btn.classList.remove('on'); await enablePush(); return; }
      if (s === 'default' || s === 'ios') { const ok = await enablePush(); if (!ok && s === 'default') { btn.classList.remove('on'); return; } }
      await put({ push: 'yes' });
    } else {
      await put({ push: 'no' });
      try { const reg = await swReady; const sub = reg && (await reg.pushManager.getSubscription()); if (sub) { await call('pushUnsub', { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) { console.error('push off', e); }
    }
    track('about_push', on ? 'on' : 'off');
  } catch (e) { btn.classList.toggle('on', !on); toast(A().fail); }
}
document.addEventListener('click', (e) => {
  const ed = e.target.closest('[data-ab-edit]');
  if (ed) { e.preventDefault(); editSheet(ed.dataset.abEdit); return; }
  const sw = e.target.closest('[data-ab-push]');
  if (sw) { e.preventDefault(); togglePush(sw); }
});
