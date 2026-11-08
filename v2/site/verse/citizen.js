// The citizenship journey's page (/citizenship; stage 3 of the conversion plan, plan conversion-next v6 - mockups C1-C6):
// the boarding pass, check-in with Miriam (an AI agent in her voice - techietech-api/citizen.js), border control at Rabbi
// Demokratovich's booth (his lines; between them the AI reacts in his voice to what they tapped or typed), the stamp with the citizen number,
// the flight in (teaser 1, with its music) and the passport. Saved as it goes on the server:
// leave and come back to the same station. The stills (art/citizen-*.jpg) are replaced by his filmed clips later.
import { T } from './copy.js';
import { esc, track, toast } from './ui.js';
import { st, onState, needFan, signedIn } from './state.js';
import { LOCAL, db, F, call } from './fb.js';
import { dayIL } from './records.js';
import { simOpen, czOpen, flyOpen, him } from './gates.js';
import { charsPicker, AI, fmtDate } from './about.js';
import { pushState, enablePush } from './push.js';

const API = LOCAL ? '/api/verseCitizen' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseCitizen';
const Z = () => T.cz;
const own = () => { try { return !!localStorage.getItem('t-ignore'); } catch (e) { return false; } };
const ready = () => new Promise((res) => { const t0 = Date.now(); (function w() { if (st.ready || Date.now() - t0 > 5000) res(); else setTimeout(w, 80); })(); });
const pad = (n) => String(n || 0).padStart(4, '0');

async function api(op, data = {}) {
  const headers = { 'content-type': 'application/json' };
  if (st.user) headers.authorization = 'Bearer ' + (await st.user.getIdToken());
  const r = await fetch(API, { method: 'POST', headers, body: JSON.stringify({ op, ...data }) });
  const j = await r.json().catch(() => ({ error: 'server' }));
  if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
  return j;
}
export const isCitizen = () => !!(st.fan && st.fan.citizen && st.fan.citizen.n);

// ---------- the resident's home banner (C1): until they finish the journey ----------
export function citizenBanner() {
  if (!czOpen() || !signedIn() || isCitizen()) return '';   // no way in for now (gates.js)
  return `<a class="cz-banner" href="/citizenship" onclick="window.track&&window.track('cz_banner','home')">
    <span class="cz-banner-pic"><img src="/verse/art/citizen-checkin.jpg" alt=""><span class="cz-say">${esc(Z().bannerSay)}</span></span>
    <span class="cz-banner-t"><b>${esc(Z().bannerTitle)}</b><small>${esc(Z().bannerLine)}</small><span class="vx-btn main small">${esc(Z().bannerGo)}</span></span>
    <span class="cz-pass-peek">${esc(Z().pass.title)}</span></a>`;
}

// ---------- the page ----------
let S = null;   // the journey as the server has it
export function citizenPage() {
  setTimeout(boot, 0);
  return `<div class="cz" id="cz">${loader()}</div>`;
}
const box = () => document.getElementById('cz');
// while it loads: the moment from the first teaser where the word turns onto the planet's ring (his ask, 2026-11-07)
const loader = () => '<div class="cz-load"><video src="/verse/art/logo-turn.mp4" poster="/verse/art/logo-turn.jpg" autoplay muted loop playsinline></video></div>';
async function boot() {
  if (!box()) return;
  document.title = `${Z().bannerGo} · שלומיוורס`;
  const fab = document.getElementById('fab'); if (fab) fab.style.display = 'none';
  await ready();
  if (!signedIn()) return gate();
  try { S = await api('start', { own: own() }); } catch (e) { return fail(e); }
  track('cz_open', S.step);
  draw();
}
function fail(e) { const el = box(); if (el) el.innerHTML = `<div class="empty">${esc(Z().fail)}</div>`; console.error('citizen', e); }
function gate() {
  box().innerHTML = `<section class="cz-gate"><img src="/verse/art/citizen-booth.jpg" alt=""><h1>${esc(Z().gate.title)}</h1><p>${esc(Z().gate.line)}</p>
    <button class="vx-btn main block" data-cz-join>${esc(T.status.go)}</button></section>`;
  box().querySelector('[data-cz-join]').onclick = async () => { if (await needFan('status')) boot(); };
}
function draw() {
  if (!box()) return;
  window.scrollTo(0, 0);
  if (S.step === 'boarding') return boarding();
  if (S.step === 'checkin') return checkin();
  if (S.step === 'booth') return S.booth.length >= S.script.length ? stamp() : booth();
  if (S.step === 'flight') return flight();
  return idCard();
}
const stepTag = (n) => `<div class="cz-step"><span style="width:${n * 25}%"></span><em>${esc(Z().step(n))}</em></div>`;

// 1. the boarding pass (C2). The gate and seat: one pair of copy.js cz.pass.seats per person, by a hash of the account, so a
// refresh or a second visit shows the same pass (round 5, his note 2026-11-08: "every pass says the same")
const seatFor = (uid) => { const L = Z().pass.seats; let h = 0; for (const ch of String(uid || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return L[h % L.length]; };
function boarding() {
  const [gate, seat] = seatFor(st.user && st.user.uid), P0 = Z().pass;
  const rows = [...P0.rows.map((r) => r.split(': ')), [P0.gate, gate], [P0.seat, seat]];
  box().innerHTML = `${stepTag(1)}<section class="cz-pass">
    <div class="cz-pass-top"><img src="/verse/logo-160.png" alt=""><b>${esc(P0.title)}</b></div>
    <div class="cz-pass-name"><small>${esc(P0.passenger)}</small><b>${esc(S.nick)}</b></div>
    <ul>${rows.map(([k, v]) => `<li><small>${esc(k)}</small><b>${esc(v || '')}</b></li>`).join('')}</ul>
    <div class="cz-bar"></div></section>
    <button class="vx-btn main block" data-cz-go>${esc(Z().pass.go)}</button>`;
  box().querySelector('[data-cz-go]').onclick = (e) => { e.currentTarget.classList.add('wait'); talk({}); };
}

// one question per screen (his notes 2026-11-07): the scene, their speech bubble under it, the answers - all in one phone
// screen; an answer moves on to the next screen (no running chat). "Write something" + skip sit pinned to the bottom of
// the screen (his note on plan open-cz-sim)
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const scene = (n, img, bubble, body, dock) => `${stepTag(n)}<section class="cz-desk">
    <div class="cz-scene"><img src="/verse/art/${img}" alt=""></div>
    <div class="cz-say2">${bubble}</div>${body}
    <div class="cz-dock">${dock}</div></section>`;

// ONE writing bar for every question of Yotam, Miriam and the rabbi (plan cz-sim-r4 mockup input, his notes 2026-11-07): a rounded
// field with a pencil and a send button of exactly its height; it grows to two lines and the button grows with it (no border
// jump, no Windows scrollbar line on the empty field). sim.js uses it too.
const PENCIL = '<svg class="vx-write-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
export const writeBar = (place, max = 160) => `<form class="vx-write"><label class="vx-write-f"><textarea rows="1" maxlength="${max}" placeholder="${esc(place)}" enterkeyhint="send" aria-label="${esc(place)}"></textarea>${PENCIL}</label><button class="vx-write-go" aria-label="${esc(Z().send)}">${ARROW}</button></form>`;
export function wireWrite(form, send) {
  const t = form.querySelector('textarea');
  const fit = () => {
    t.style.height = '';
    if (!t.value) return;   // empty: one line, whatever the placeholder does
    const cs = getComputedStyle(t), one = t.offsetHeight, two = one + parseFloat(cs.lineHeight);
    if (t.scrollHeight > one + 2) t.style.height = Math.min(t.scrollHeight, two) + 'px';   // up to two lines, then it scrolls (no scrollbar)
  };
  t.addEventListener('input', fit);
  t.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };   // Enter sends, Shift+Enter = a new line
  form.onsubmit = (e) => { e.preventDefault(); const v = t.value.trim(); if (v) { t.blur(); send(v, form.querySelector('.vx-write-go')); } };
  return t;
}
// the answers: plain buttons, or (a profile question - plan cz-sim-r3 mockups source / wish) rows with a line icon per answer
const hint = () => `<p class="vx-pick-hint">${esc(Z().pickHint)}</p>`;
function optsHtml(opts, field, after = '') {
  if (!opts.length) return after;
  const icon = (i) => (field === 'source' ? AI[['tiktok', 'instagram', 'youtube', 'friend', 'other'][i]] : field === 'first' ? AI[['videos', 'chat', 'games', 'stickers'][i]] : '') || '';
  const cls = field === 'source' ? 'rows' : field === 'first' ? 'grid' : opts.length === 2 ? 'two' : '';
  return `${hint()}<div class="cz-opts ${cls}">${opts.map((o, i) => `<button data-cz-a="${i}">${icon(i)}<span>${esc(o)}</span></button>`).join('')}</div>${after}`;
}
function desk(n, img, bubble, opts, place, extra = '', field = null, after = '') {
  return scene(n, img, bubble, optsHtml(opts, field, after), writeBar(place) + extra);
}
// the answer is in: the tapped button stays lit and the bubble - at the height it had, so nothing under it moves (his note
// 2026-11-07) - shows a short line of theirs typed with a caret, a new one every couple of seconds (Terra's; mockup think)
let thinkT = 0;
function think(say, lines) {
  clearTimeout(thinkT);
  say.style.height = say.offsetHeight + 'px';
  say.classList.add('thinking');
  say.innerHTML = '<span class="cz-think"><em></em><i></i></span>';
  const em = say.querySelector('em');
  let k = Math.floor(Math.random() * lines.length), c = 0;
  (function type() {
    if (!say.isConnected) return;
    const line = lines[k % lines.length];
    if (c <= line.length) { em.textContent = line.slice(0, c++); thinkT = setTimeout(type, 32); return; }
    thinkT = setTimeout(() => { k++; c = 0; type(); }, 1500);
  })();
}
function waiting(b, lines) {
  const el = box(); if (!el) return;
  if (b) b.classList.add(b.classList.contains('vx-btn') || b.classList.contains('vx-write-go') ? 'wait' : 'on');
  el.querySelectorAll('.cz-opts button, .vx-write button, .vx-write textarea, .cz-skip, .cz-sugg button').forEach((x) => (x.disabled = true));
  el.querySelector('.cz-desk')?.classList.add('thinking');
  const say = el.querySelector('.cz-say2'); if (say) think(say, lines);
}
function answers(el, go) {
  el.querySelectorAll('[data-cz-a]').forEach((b) => (b.onclick = () => go({ pick: +b.dataset.czA }, b.textContent, b)));
  const f = el.querySelector('.vx-write');
  if (f) wireWrite(f, (v, btn) => go({ text: v }, v, btn));
}

// 2. check-in with Miriam (C3): her words + the registry's question - its own answer UI per kind (plan cz-sim-r3): 'pick' = buttons
// (the profile's fixed answers, or 3 of hers), 'chars' = the characters picker, 'text' = a two-line box + suggestions; skip / skip it all
let busy = false;
async function talk(data, b) {
  if (busy) return;
  busy = true;
  waiting(b, Z().thinkM);
  try {
    S = await api('checkin', data);
    busy = false;
    if (S.step !== 'checkin') { track('cz_checkin', data.all ? 'skipped' : 'done'); return checkinDone(S.closing); }
    checkin();
  } catch (e) { busy = false; toast(Z().fail, 3000); checkin(); }
}
function checkin() {
  const p = S.pending, el = box();
  if (!p) return talk({});
  const bubble = `${esc(p.say)}<b>${esc(p.q)}</b>`;
  const skip = `<button class="cz-skip" data-cz-skip>${esc(Z().checkin.skip)}</button>`;
  const skips = `<div class="cz-skips">${skip}<button class="cz-skip" data-cz-all>${esc(Z().checkin.skipAll)}</button></div>`;
  if (p.kind === 'chars') {
    // "את מי באתם לבקר?" (mockup r3-visit-1): search, round faces, up to 3; "המשך" + "דלגו" pinned
    el.innerHTML = scene(2, 'citizen-checkin.jpg', bubble, '<div class="cz-chars" data-cz-chars></div>',
      `<div class="cz-go">${skip}<button class="vx-btn main" data-cz-next disabled>${esc(Z().go)}${ARROW}</button></div>`);
    const pk = charsPicker(el.querySelector('[data-cz-chars]'), { max: 3, onChange: (ids) => { el.querySelector('[data-cz-next]').disabled = !ids.length; } });
    el.querySelector('[data-cz-next]').onclick = (e) => talk({ chars: pk.get() }, e.currentTarget);
  } else if (p.kind === 'text') {
    // "ומה הייתם רוצים לעשות כאן?" (mockup r3-wish-1): a suggestion is an answer - a tap chooses it and moves on (his note
    // 2026-11-07: it only filled the box), or they write their own in the bar
    el.innerHTML = scene(2, 'citizen-checkin.jpg', bubble,
      (p.sugg || []).length ? `${hint()}<div class="cz-sugg">${p.sugg.map((x) => `<button type="button" data-cz-sugg>${esc(x)}</button>`).join('')}</div>` : '',
      `${writeBar(Z().checkin.type, 200)}${skips}`);
    el.querySelectorAll('[data-cz-sugg]').forEach((b) => (b.onclick = () => talk({ text: b.textContent.trim() }, b)));
    answers(el, (data, label, b) => talk(data, b));
  } else {
    el.innerHTML = desk(2, 'citizen-checkin.jpg', bubble, p.opts || [], Z().checkin.type, skips, p.field);
    answers(el, (data, label, b) => talk(data, b));
  }
  el.querySelector('[data-cz-skip]').onclick = () => talk({ skip: true });
  el.querySelector('[data-cz-all]')?.addEventListener('click', () => talk({ all: true }));
  window.scrollTo(0, 0);
}
function checkinDone(closing) {
  box().innerHTML = `${stepTag(2)}<section class="cz-desk"><div class="cz-scene"><img src="/verse/art/citizen-checkin.jpg" alt=""></div>
    <div class="cz-say2">${esc(closing || Z().checkin.done)}</div>
    <button class="vx-btn main block" data-cz-go>${esc(Z().checkin.toBooth)}</button></section>`;
  box().querySelector('[data-cz-go]').onclick = () => draw();
  window.scrollTo(0, 0);
}

// 3. border control at the booth (C4): HIS lines in order, one per screen; above each, his short reaction (AI, in his voice) to
// what they answered; simple fixed answers on the yes/no lines, their own words always (line 2: only their own words).
// Two lines come only when the profile misses them (plan cz-sim-r3): the birthday (free words -> a date) and the notifications.
function booth() {
  const i = S.booth.length, el = box(), prev = i > 0 ? (S.bt || [])[i - 1] : null, opts = (S.opts || [])[i] || [], L = (S.lines || [])[i] || { kind: 'line' };
  const bubble = `${prev && prev.react ? `<span class="cz-re">${esc(prev.react)}</span>` : ''}${L.pre ? `<span class="cz-re cz-pre">${esc(L.pre)}</span>` : ''}<b>${esc((S.script || [])[i] || '')}</b>`;
  if (L.kind === 'bday') return boothBday(i, bubble);
  if (i === 0 && opts.length === 1) return boothPass(bubble);
  el.innerHTML = desk(3, 'citizen-booth.jpg', bubble, opts, opts.length ? Z().boothType : Z().boothOpen, '', null, L.note ? `<p class="cz-note">${esc(L.note)}</p>` : '');
  answers(el, async (data, label, b) => {
    if (busy) return;
    // "מסכים/ה" to the authorities' orders = the site's real notifications: the browser asks now, inside the tap (iPhone outside
    // the home-screen app can't - push.js shows the way there later, never in the middle of the journey)
    if (L.kind === 'push' && data.pick === 0 && pushState() === 'default') enablePush().catch(() => {});
    boothStep(i, data, b);
  });
  window.scrollTo(0, 0);
}
// "דרכון בבקשה" (round 5, his note 2026-11-08: "maybe something else than a button? though it's good"): their passport lies
// at the bottom like a card; they slide it up into his window, or tap it (a tap, Enter or a short drag all hand it over -
// nobody gets stuck), and it slides in under the glass. The writing bar stays for anyone who'd rather say something.
const PP_EMBLEM = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="20" cy="20" r="13"/><ellipse cx="20" cy="20" rx="6" ry="13"/><path d="M7 20h26M9.5 13h21M9.5 27h21"/></svg>';
function boothPass(bubble) {
  const el = box(), H = Z().hand;
  el.innerHTML = scene(3, 'citizen-booth.jpg', bubble,
    `<div class="cz-hand"><button type="button" class="cz-handpp" aria-label="${esc(H.label)}"><b>${esc(H.word)}</b>${PP_EMBLEM}<small>PASSPORT</small></button>
      <p class="cz-hand-hint">${esc(H.hint)}</p></div>`, writeBar(Z().boothType));
  answers(el, (data, label, b) => boothStep(0, data, b));   // their own words, in the bar
  const card = el.querySelector('.cz-handpp');
  let y0 = null, dy = 0, moved = false, done = false;
  const give = (how) => {
    if (done || busy) return;
    done = true; track('cz_hand', how);
    const sc = el.querySelector('.cz-scene').getBoundingClientRect(), r = card.getBoundingClientRect();
    const tx = sc.left + sc.width / 2 - (r.left + r.width / 2), ty = dy + sc.top + sc.height * 0.7 - (r.top + r.height / 2);
    card.classList.add('in');
    card.style.transform = `translate(${tx}px, ${ty}px) scale(.32)`;
    el.querySelector('.cz-hand-hint').classList.add('gone');
    setTimeout(() => boothStep(0, { pick: 0 }, null), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480);
  };
  card.addEventListener('pointerdown', (e) => { if (done) return; y0 = e.clientY; dy = 0; moved = false; card.classList.add('drag'); try { card.setPointerCapture(e.pointerId); } catch (x) {} });
  card.addEventListener('pointermove', (e) => {
    if (y0 === null) return;
    if (Math.abs(e.clientY - y0) > 6) moved = true;
    dy = Math.min(0, e.clientY - y0);
    card.style.transform = `translateY(${dy}px) rotate(${Math.max(-4, -4 - dy / 30)}deg)`;   // up only; it straightens as it rises
  });
  card.addEventListener('pointerup', () => {
    if (y0 === null) return;
    y0 = null; card.classList.remove('drag');
    if (!moved) give('tap'); else if (dy < -44) give('slide'); else { dy = 0; card.style.transform = ''; }
  });
  card.addEventListener('pointercancel', () => { y0 = null; dy = 0; card.classList.remove('drag'); card.style.transform = ''; });
  card.addEventListener('click', (e) => { if (e.detail === 0) give('key'); });   // the keyboard; a finger or mouse was handled on pointerup
  window.scrollTo(0, 0);
}
async function boothStep(i, data, b) {
  if (busy) return;
  busy = true;
  waiting(b, Z().thinkR);
  try { S = await api('booth', { i, ...data }); busy = false; if (S.booth.length >= S.script.length) { track('cz_stamp', String(S.n)); stamp(true); } else booth(); }
  catch (e) { busy = false; toast(Z().fail, 3000); booth(); }
}
// the birthday line (mockup r3-bday-1): they write it as they like, the AI reads a date - "נרשם: 3 במרץ 1990" + "לא נכון? כתבו שוב"
function boothBday(i, bubble) {
  const el = box(), B = S.bday && S.bday.raw ? S.bday : null;
  const got = !B ? '' : `<div class="cz-mine">${esc(B.raw)}</div>${B.date
    ? `<div class="cz-got">${AI.check}<span>${esc(Z().bdayGot)} ${esc(fmtDate(B.date))}</span></div><button class="cz-skip cz-again" data-cz-again>${esc(Z().bdayAgain)}</button>
       <button class="vx-btn main block" data-cz-ok>${esc(Z().go)}${ARROW}</button>`
    : `<div class="cz-got bad"><span>${esc(Z().bdayBad)}</span></div>`}`;
  el.innerHTML = scene(3, 'citizen-booth.jpg', bubble, got,
    `${writeBar(Z().boothBday, 80)}<div class="cz-skips"><button class="cz-skip" data-cz-nobday>${esc(Z().bdayNo)}</button></div>`);
  const input = wireWrite(el.querySelector('.vx-write'), async (v, btn) => {
    if (busy) return;
    busy = true;
    btn.disabled = true; btn.classList.add('wait');
    try { S = await api('bday', { i, text: v }); } catch (err) { toast(Z().fail, 3000); }
    busy = false;
    boothBday(i, bubble);
  });
  el.querySelector('[data-cz-again]')?.addEventListener('click', () => { input.focus(); });
  el.querySelector('[data-cz-ok]')?.addEventListener('click', (e) => boothStep(i, { date: true }, e.currentTarget));
  el.querySelector('[data-cz-nobday]').onclick = () => boothStep(i, { skip: true });
  if (!B) window.scrollTo(0, 0);
}

// start over (his ask 2026-11-07): the journey from zero for HIS account (and test accounts) without touching his real citizen
// number or profile - the server keeps them aside (citizen.js reset / restore). On the passport page and in the status sheet.
export const czTools = () => (him() && signedIn() ? `<div class="cz-tools"><button class="cz-skip" data-cz-reset>${esc(Z().reset)}</button><button class="cz-skip" data-cz-restore>${esc(Z().restore)}</button></div>` : '');
document.addEventListener('click', async (e) => {
  const r = e.target.closest('[data-cz-reset], [data-cz-restore]');
  if (!r) return;
  e.preventDefault();
  const reset = r.matches('[data-cz-reset]');
  if (reset && !confirm(Z().resetAsk)) return;
  r.disabled = true;
  try {
    await api(reset ? 'reset' : 'restore');
    try { localStorage.removeItem('vx-sim'); localStorage.removeItem('vx-sim-pre'); } catch (x) {}   // the simulation test can be taken again too
    track('cz_test', reset ? 'reset' : 'restore');
    if (reset) location.href = '/citizenship';
    else { toast(Z().restored); setTimeout(() => location.reload(), 600); }
  } catch (x) { r.disabled = false; toast(Z().fail, 3000); }
});

// the passport's visa page with the entry stamp and his signature (his note on plan open-cz-sim: "show the inner pages with a
// stamp, like a real passport; the logo flattened onto the page like a watermark" - art/citizen-visa.jpg). The stamp is drawn in
// code: the number and the date are live.
const SIGN = '<svg class="cz-sign" viewBox="0 0 200 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 42c10-26 26-34 26-12 0 16-12 18-6 2 5-12 16-16 18 0 1 10 8 10 14-4 4-10 10-8 9 4-1 9 7 9 12-1 4-8 9-7 8 3 0 8 9 7 15-4l8-12c-2 14 4 18 12 6 6-9 14-10 22-6"/><path d="M24 54c46-8 104-2 160-10"/></svg>';
function visaPage(fresh) {
  const d = issued().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }), V = Z().visa;
  return `<div class="cz-visa ${fresh ? 'fresh' : ''}" aria-label="${esc(V.page)}">
    <div class="cz-es"><small>${esc(V.office)}</small><b>${esc(V.entry)}</b><span>${pad(S.n)}</span><small>${d}</small><small>${esc(V.status)}</small></div>
    <div class="cz-visa-sign">${SIGN}<small>${esc(V.by)}</small></div></div>`;
}

// 4. the stamp and the number (C5) + his blessing; "טסים פנימה" closes the booth (the script's last beat)
function stamp(fresh) {
  box().innerHTML = `${stepTag(4)}<section class="cz-stamp ${fresh ? 'fresh' : ''}">
    ${visaPage(fresh)}
    <div class="cz-say2"><b>${esc(Z().stamped)}</b><span class="cz-re">${esc(Z().blessing)}</span></div>
    <div class="cz-num"><em>${esc(S.founding ? Z().stamp.founding(S.n) : Z().stamp.regular)}</em></div>
    <div class="cz-dock"><button class="vx-btn main block" data-cz-go>${esc(Z().stamp.go)}</button></div></section>`;
  if (flyOpen()) import('./fly.js').then((m) => m.prefetch()).catch(() => {});   // the game's first screen loads while they read the stamp
  box().querySelector('[data-cz-go]').onclick = async (e) => {
    e.currentTarget.classList.add('wait');
    try { S = await api('booth', { i: S.script.length, a: Z().stamp.go }); flight(true); } catch (err) { toast(Z().fail, 3000); }
  };
}

// 5. the flight in: the first Shlomiverse teaser with its music (his choice), skippable; then the landing
function flight(played) {
  if (flyOpen()) return flyGame();
  const el = box();
  el.innerHTML = `<section class="cz-flight"><video src="/verse/art/flight.mp4" poster="/verse/art/flight-poster.jpg" playsinline preload="auto"></video>
    <button class="cz-fskip" data-cz-skip>${esc(Z().flight.skip)}</button></section>`;
  const v = el.querySelector('video');
  const land = () => { v.pause(); landing(); };
  v.onended = land;
  el.querySelector('[data-cz-skip]').onclick = () => { track('cz_flight', 'skip'); land(); };
  // played straight from a tap ("טסים פנימה") the music may play; after a reload it starts muted, a tap brings the sound
  v.muted = !played;
  v.defaultPlaybackRate = v.playbackRate = 1.5;   // his note 2026-11-07: much faster
  v.play().catch(() => { v.muted = true; v.play().catch(() => land()); });
  v.onclick = () => { v.muted = false; };
}
// 5b. ...or the flight as a game (his idea 2026-11-07: "a spaceship flying to the Shlomiverse, dodge the characters on the way" -
// gates.js FLY_OPEN, his eyes only for now): verse/fly.js, loaded only here. Its stats (time, stars, shields...) wait in `flown`
// for the entry stamp later. Its score goes on a daily table like the games' (round 2) - records/fly_<day>, the verse function's
// score op (techietech-api/verse.js EXTRA_RECORDS: the flight is not a catalog game, so it never shows in the home's "שיאי היום").
let flown = null;
const flyRecords = {
  submit: (value) => (signedIn() && value > 0 ? call('score', { game: 'fly', value }) : null),
  top: () => F.getDoc(F.doc(db, 'records', `fly_${dayIL()}`)).then((d) => (d.data() || {}).top || []),
  me: () => st.user && st.user.uid,
};
async function flyGame() {
  const el = box();
  el.innerHTML = loader();
  let fly;
  try { fly = await import('./fly.js'); } catch (e) { return landing(); }
  el.innerHTML = '';
  // landed in the game = its own "נחתתם בשלומיוורס" was the landing, so straight on to the passport (no second landing screen)
  const end = (how) => (s) => { flown = s; track('cz_flight', how); if (how === 'done') toPassport(); else landing(); };
  fly.play(el, { onDone: end('done'), onSkip: end('skip'), records: flyRecords });
}
async function landing() {
  box().innerHTML = `<section class="cz-land"><img src="/verse/logo-512.png" alt=""><h1>${esc(Z().flight.landing)}</h1><p>${esc(Z().flight.landing2)}</p>
    <button class="vx-btn main block" data-cz-go>${esc(Z().flight.toId)}</button></section>`;
  box().querySelector('[data-cz-go]').onclick = toPassport;
}
async function toPassport() { box().innerHTML = loader(); try { S = await api('landed'); } catch (e) {} track('cz_done', String(S.n)); idCard(); }

// 6. the citizen's passport (his note 2026-11-07: "a passport, no 'שלומיוורסית', sounds and looks real"): a real data page
// (GPT Image, art/citizen-datapage.jpg - no text in it) with the fields, the photo and the machine-readable lines laid over it.
// The page uses cqw units (1% of the page's width), so it looks the same on every phone.
const P = () => Z().id.pp;
const issued = () => new Date(S.issued || Date.now());
const ddmmyy = (d) => [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map((x) => String(x).padStart(2, '0')).join('.');
function mrz() {
  const d = issued(), ymd = ddmmyy(d).split('.').reverse().join('');
  const fill = (t) => (t + '<'.repeat(44)).slice(0, 44);
  return [fill(`P<SLVSHLOMIVERSE<<CITIZEN<${pad(S.n)}`), fill(`${String(S.n || 0).padStart(9, '0')}0SLV${ymd}0${S.founding ? 'F' : 'C'}`).slice(0, 43) + '0'];
}
// the department: the one Yotam gave in the simulation test, else the registry's from the check-in (plan cz-sim-r4)
const ppDept = () => (S.sim && S.sim.dept) || S.dept || '';
const ppFields = () => [
  [[P().type, 'P', 2], [P().code, 'SLV', 3], [P().no, pad(S.n), 7, 'n']],
  ppDept() ? [[P().name, S.nick || '-', 4], [P().dept, ppDept(), 8, 'd']] : [[P().name, S.nick || '-', 12]],
  // only fields a real passport has, filled in deadpan (his note 2026-11-07: no 'סיווג', no 'סימנים מיוחדים')
  [[P().nat, P().natV, 5], [P().birth, P().birthV, 7]],
  [[P().issued, ddmmyy(issued()), 4], [P().exp, P().expV, 8]],
  [[P().auth, P().authV, 8], [P().status, S.founding ? Z().id.founding : Z().id.citizen, 4]],
];
// the passport on ONE screen (plan cz-sim-r4 mockup passport, his note 2026-11-07: "why both the upper and the lower - one screen,
// the button included"): the data page with the border-control stamp pressed over its lower corner and the rabbi's signature,
// no visa page under it; a not-yet-classified citizen gets one small row to the simulation (Terra's line), a classified one the
// same row with their simulation and department, opening their result (his note 2026-11-08: "they can't go to the void")
const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>';
// round 5 (his notes 2026-11-08 on the passport): the entry stamp moved off the data page - it covered the status and the
// machine-readable lines - onto the facing page of the open booklet, under the fold (.cz-pp-next); the photo is laminated:
// a holographic film with a gloss over it, and a small ghost copy of the photo on the page, as on real passports
function ppStamp() {
  const d = issued().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }), V = Z().visa;
  return `<div class="cz-pp-stamp"><small>${esc(V.office)}</small><b>${esc(V.entry)}</b><span>${pad(S.n)}</span><small>${d}</small></div>`;
}
const ppSign = () => `<div class="cz-pp-sign">${SIGN}<small>${esc(Z().visa.by)}</small></div>`;
function idCard() {
  const sim = S.sim;
  box().innerHTML = `<section class="cz-id">
    <h1 class="cz-id-h">${esc(Z().id.title)}</h1>
    <div class="cz-book">
    <div class="cz-pp">
      <div class="cz-pp-top"><b>${esc(P().head)}</b><span>${esc(P().issuer)}</span></div>
      <div class="cz-pp-photo">${S.photo ? `<img src="${esc(S.photo)}" alt="">` : `<span>${esc((S.nick || '?').slice(0, 1))}</span>`}</div>
      ${S.photo ? `<div class="cz-pp-ghost"><img src="${esc(S.photo)}" alt=""></div>` : ''}
      <div class="cz-pp-f">${ppFields().map((row) => row.map(([k, v, span, cls]) => `<div class="c${span}"><small>${esc(k)}</small><b class="${cls || ''}">${esc(v)}</b></div>`).join('')).join('')}</div>
      <div class="cz-pp-mrz" dir="ltr">${mrz().map(esc).join('<br>')}</div>
      ${ppSign()}
    </div>
    <div class="cz-pp-next">${ppStamp()}</div>
    </div>
    ${sim && sim.name ? `<a class="cz-id-sim done" href="/simulation?r=${esc(sim.rid)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="5.2"/><ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-18 12 12)"/></svg><span><small>${esc(T.sim.yours)}${sim.dept ? ` · ${esc(sim.dept)}` : ''}</small><b>${esc(sim.name)}</b></span>${CHEV}</a>`
      : !simOpen() ? '' : `<a class="cz-id-sim" href="/simulation">${CLOCK}<span>${esc(Z().id.noSim)} · ${esc(Z().id.noSimGo)}</span>${CHEV}</a>`}
    <a class="vx-btn main block" href="/">${esc(Z().id.home)}</a>
    ${czTools()}</section>`;   // no share button any more (round 5, his note 2026-11-08: "no need for share my passport")
}

onState(() => { if (location.pathname === '/citizenship' && box() && !S && signedIn()) boot(); });
