// The citizenship journey's page (/citizenship; stage 3 of the conversion plan, plan conversion-next v6 - mockups C1-C6):
// the boarding pass, check-in with Miriam (an AI agent in her voice - techietech-api/citizen.js), border control at Rabbi
// Demokratovich's booth (his lines; between them the AI reacts in his voice to what they tapped or typed), the stamp with the citizen number,
// the flight in (teaser 1, with its music) and the ID card, drawn here on a canvas to share. Saved as it goes on the server:
// leave and come back to the same station. The stills (art/citizen-*.jpg) are replaced by his filmed clips later.
import { T } from './copy.js';
import { esc, track, sheet, toast } from './ui.js';
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

// 1. the boarding pass (C2)
function boarding() {
  box().innerHTML = `${stepTag(1)}<section class="cz-pass">
    <div class="cz-pass-top"><img src="/verse/logo-160.png" alt=""><b>${esc(Z().pass.title)}</b></div>
    <div class="cz-pass-name"><small>${esc(Z().pass.passenger)}</small><b>${esc(S.nick)}</b></div>
    <ul>${Z().pass.rows.map((r) => { const [k, v] = r.split(': '); return `<li><small>${esc(k)}</small><b>${esc(v || '')}</b></li>`; }).join('')}</ul>
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
const askBox = (place, max = 160) => `<form class="cz-ask"><input maxlength="${max}" placeholder="${esc(place)}" enterkeyhint="send"><button aria-label="שליחה">←</button></form>`;
// the answers: plain buttons, or (a profile question - plan cz-sim-r3 mockups source / wish) rows with a line icon per answer
function optsHtml(opts, field, after = '') {
  if (!opts.length) return after;
  const icon = (i) => (field === 'source' ? AI[['tiktok', 'instagram', 'youtube', 'friend', 'other'][i]] : field === 'first' ? AI[['videos', 'chat', 'games', 'stickers'][i]] : '') || '';
  const cls = field === 'source' ? 'rows' : field === 'first' ? 'grid' : opts.length === 2 ? 'two' : '';
  return `<div class="cz-opts ${cls}">${opts.map((o, i) => `<button data-cz-a="${i}">${icon(i)}<span>${esc(o)}</span></button>`).join('')}</div>${after}`;
}
function desk(n, img, bubble, opts, place, extra = '', field = null, after = '') {
  return scene(n, img, bubble, optsHtml(opts, field, after), askBox(place) + extra);
}
// the answer is in: the tapped button lit, the bubble turns to dots until the next screen
function waiting(b) {
  const el = box(); if (!el) return;
  if (b) b.classList.add(b.classList.contains('vx-btn') ? 'wait' : 'on');
  el.querySelectorAll('.cz-opts button, .cz-ask button, .cz-skip, .cz-sugg button').forEach((x) => (x.disabled = true));
  const say = el.querySelector('.cz-say2'); if (say) say.innerHTML = '<span class="cz-dots"><i></i><i></i><i></i></span>';
}
function answers(el, go) {
  el.querySelectorAll('[data-cz-a]').forEach((b) => (b.onclick = () => go({ pick: +b.dataset.czA }, b.textContent, b)));
  const f = el.querySelector('.cz-ask');
  if (!f) return;
  const field = f.querySelector('input, textarea');
  f.onsubmit = (e) => { e.preventDefault(); const v = field.value.trim(); if (v) { field.blur(); go({ text: v }, v); } };
  // a two-line box: Enter sends, Shift+Enter is a new line
  if (field.tagName === 'TEXTAREA') field.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
}

// 2. check-in with Miriam (C3): her words + the registry's question - its own answer UI per kind (plan cz-sim-r3): 'pick' = buttons
// (the profile's fixed answers, or 3 of hers), 'chars' = the characters picker, 'text' = a two-line box + suggestions; skip / skip it all
let busy = false;
async function talk(data, b) {
  if (busy) return;
  busy = true;
  waiting(b);
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
    // "ומה הייתם רוצים לעשות כאן?" (mockup r3-wish-1): suggestions fill the two-line box, they send it
    el.innerHTML = scene(2, 'citizen-checkin.jpg', bubble,
      (p.sugg || []).length ? `<div class="cz-sugg">${p.sugg.map((x) => `<button type="button" data-cz-sugg>${esc(x)}</button>`).join('')}</div>` : '',
      `<form class="cz-ask cz-ask2"><textarea rows="2" maxlength="200" placeholder="${esc(Z().wishType)}" enterkeyhint="send"></textarea><button aria-label="שליחה">←</button></form>${skips}`);
    el.querySelectorAll('[data-cz-sugg]').forEach((b) => (b.onclick = () => { const t = el.querySelector('.cz-ask textarea'); t.value = b.textContent; t.focus(); el.querySelectorAll('[data-cz-sugg]').forEach((x) => x.classList.toggle('on', x === b)); }));
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
  el.innerHTML = desk(3, 'citizen-booth.jpg', bubble, opts, opts.length ? Z().boothType : Z().boothOpen, '', null, L.note ? `<p class="cz-note">${esc(L.note)}</p>` : '');
  if (opts.length) api('boothPre', { i }).catch(() => {});   // his reaction to each button, written while they read
  answers(el, async (data, label, b) => {
    if (busy) return;
    // "מסכים/ה" to the authorities' orders = the site's real notifications: the browser asks now, inside the tap (iPhone outside
    // the home-screen app can't - push.js shows the way there later, never in the middle of the journey)
    if (L.kind === 'push' && data.pick === 0 && pushState() === 'default') enablePush().catch(() => {});
    boothStep(i, data, b);
  });
  window.scrollTo(0, 0);
}
async function boothStep(i, data, b) {
  if (busy) return;
  busy = true;
  waiting(b);
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
    `${askBox(Z().boothBday, 80)}<div class="cz-skips"><button class="cz-skip" data-cz-nobday>${esc(Z().bdayNo)}</button></div>`);
  const input = el.querySelector('.cz-ask input');
  el.querySelector('.cz-ask').onsubmit = async (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v || busy) return;
    busy = true; input.blur();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.classList.add('wait');
    try { S = await api('bday', { i, text: v }); } catch (err) { toast(Z().fail, 3000); }
    busy = false;
    boothBday(i, bubble);
  };
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
    try { localStorage.removeItem('vx-sim'); } catch (x) {}   // the simulation test can be taken again too
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
// The page uses cqw units and the share picture the same geometry (u = 1% of the page's width), so both look the same.
const P = () => Z().id.pp;
const issued = () => new Date(S.issued || Date.now());
const ddmmyy = (d) => [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map((x) => String(x).padStart(2, '0')).join('.');
function mrz() {
  const d = issued(), ymd = ddmmyy(d).split('.').reverse().join('');
  const fill = (t) => (t + '<'.repeat(44)).slice(0, 44);
  return [fill(`P<SLVSHLOMIVERSE<<CITIZEN<${pad(S.n)}`), fill(`${String(S.n || 0).padStart(9, '0')}0SLV${ymd}0${S.founding ? 'F' : 'C'}`).slice(0, 43) + '0'];
}
const ppFields = () => [
  [[P().type, 'P', 2], [P().code, 'SLV', 3], [P().no, pad(S.n), 7, 'n']],
  [[P().name, S.nick || '-', 12]],
  // only fields a real passport has, filled in deadpan (his note 2026-11-07: no 'סיווג', no 'סימנים מיוחדים')
  [[P().nat, P().natV, 5], [P().birth, P().birthV, 7]],
  [[P().issued, ddmmyy(issued()), 4], [P().exp, P().expV, 8]],
  [[P().auth, P().authV, 8], [P().status, S.founding ? Z().id.founding : Z().id.citizen, 4]],
];
function idCard() {
  const sim = S.sim;
  box().innerHTML = `<section class="cz-id">
    <h1 class="cz-id-h">${esc(Z().id.title)}</h1>
    <div class="cz-pp">
      <div class="cz-pp-top"><b>${esc(P().head)}</b><span>${esc(P().issuer)}</span></div>
      <div class="cz-pp-photo">${S.photo ? `<img src="${esc(S.photo)}" alt="">` : `<span>${esc((S.nick || '?').slice(0, 1))}</span>`}</div>
      <div class="cz-pp-f">${ppFields().map((row) => row.map(([k, v, span, cls]) => `<div class="c${span}"><small>${esc(k)}</small><b class="${cls || ''}">${esc(v)}</b></div>`).join('')).join('')}</div>
      <div class="cz-pp-mrz" dir="ltr">${mrz().map(esc).join('<br>')}</div>
    </div>
    ${visaPage()}
    ${(sim && sim.name) || !simOpen() ? '' : `<a class="cz-id-sim" href="/simulation">${esc(Z().id.noSim)} · ${esc(Z().id.noSimGo)}</a>`}
    <a class="vx-btn main block" href="/">${esc(Z().id.home)}</a>${czTools()}</section>`;
  // no "share the passport" for now (his note 2026-11-07: it gives nothing yet) - shareId() + drawId() stay ready
  box().querySelector('[data-cz-share]')?.addEventListener('click', () => shareId());
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
const ell = (x, t, max) => { let s = String(t); if (x.measureText(s).width <= max) return s; while (s.length > 2 && x.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
// the passport, drawn at (X, Y), W wide - the same geometry as .cz-pp
async function drawPassport(x, X, Y, W) {
  const u = W / 100, H = W * 2 / 3;
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 40; x.shadowOffsetY = 18;
  try { const pg = await loadImg('/verse/art/citizen-datapage.jpg'); x.drawImage(pg, X, Y, W, H); } catch (e) { x.fillStyle = '#f3ece2'; x.fillRect(X, Y, W, H); }
  x.restore();
  x.globalCompositeOperation = 'multiply';   // ink printed into the paper
  x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = '#262b55';
  x.font = `900 ${2.9 * u}px Arial, "Noto Sans Hebrew", sans-serif`; x.fillText(P().head, X + W - 4 * u, Y + 4.6 * u);
  x.direction = 'ltr'; x.textAlign = 'left'; x.font = `700 ${2.3 * u}px Arial, "Noto Sans Hebrew", sans-serif`; x.fillText(P().issuer, X + 4 * u, Y + 4.4 * u);
  // the photo
  const px = X + 3.7 * u, py = Y + 11.7 * u, pw = 24.7 * u, ph = 36.7 * u;
  let drew = false;
  if (S.photo) { try { const im = await loadImg(S.photo); const sc = Math.max(pw / im.width, ph / im.height); x.save(); x.beginPath(); x.rect(px, py, pw, ph); x.clip(); x.drawImage(im, px + (pw - im.width * sc) / 2, py + (ph - im.height * sc) / 2, im.width * sc, im.height * sc); x.restore(); drew = true; } catch (e) {} }
  if (!drew) { x.fillStyle = '#dcd6ce'; x.fillRect(px, py, pw, ph); x.fillStyle = '#7a7f9a'; x.font = `900 ${14 * u}px Arial, "Noto Sans Hebrew", sans-serif`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText((S.nick || '?').slice(0, 1), px + pw / 2, py + ph * 0.64); }
  // the fields: 6 columns, from the right edge (4u) to the photo (31.5u), 5 rows of 8u from 11u
  const R = X + W - 4 * u, colW = (100 - 4 - 31.5) / 12 * u;
  x.direction = 'rtl'; x.textAlign = 'right';
  ppFields().forEach((row, r) => {
    let at = 0;
    for (const [k, v, span, cls] of row) {
      const rx = R - at * colW, top = Y + 11 * u + r * 8 * u, w = span * colW - 1 * u;
      x.fillStyle = '#5b607c'; x.font = `600 ${2 * u}px Arial, "Noto Sans Hebrew", sans-serif`; x.fillText(ell(x, k, w), rx, top + 2.2 * u);
      x.fillStyle = cls === 'n' ? '#b3261e' : '#14162a'; x.font = `800 ${3.7 * u}px Arial, "Noto Sans Hebrew", sans-serif`; x.fillText(ell(x, v, w), rx, top + 6.2 * u);
      at += span;
    }
  });
  // the machine-readable lines
  x.direction = 'ltr'; x.textAlign = 'left'; x.fillStyle = '#1c1d26'; x.font = `700 ${3.4 * u}px "OCR B", "OCR-B", "Courier New", monospace`;
  mrz().forEach((l, k) => x.fillText(l, X + 4 * u, Y + (59.2 + k * 4.6) * u));
  x.globalCompositeOperation = 'source-over';
}
async function drawId() {
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0f08'); g.addColorStop(1, '#0b0b0e'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  await document.fonts.load('900 80px Heebo').catch(() => {});
  try { const logo = await loadImg('/verse/logo-512.png'); x.drawImage(logo, W / 2 - 170, 230, 340, 340); } catch (e) {}
  x.save(); x.translate(W / 2, 960); x.rotate(-0.035); await drawPassport(x, -500, -333, 1000); x.restore();
  x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '900 64px Heebo'; x.fillText(Z().id.title, W / 2, 1460);
  x.direction = 'ltr'; x.fillStyle = '#d8d2cc'; x.font = '500 40px Heebo'; x.fillText('shlomiverse.com', W / 2, H - 170);
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
}
async function shareId() {
  const url = 'https://shlomiverse.com/';
  const mark = (via) => { track('cz_share', via); api('shared', { via }).catch(() => {}); };
  let blob = null;
  try { blob = await drawId(); } catch (e) { console.error(e); }
  const file = blob && new File([blob], 'shlomiverse-id.jpg', { type: 'image/jpeg' });
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    mark('native');
    try { await navigator.share({ files: [file], text: url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const pic = blob ? URL.createObjectURL(blob) : '';
  sheet(`<div class="sim-sh">${pic ? `<img src="${pic}" alt="">` : ''}
    <a class="vx-btn main block" data-x-wa href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" rel="noopener">${esc(T.sim.wa)}</a>
    ${pic ? `<a class="vx-btn block" data-x-save href="${pic}" download="shlomiverse-id.jpg">${esc(T.sim.save)}</a>` : ''}</div>`, { cls: 'sim-sheet' });
  const root = [...document.querySelectorAll('.vx-sheet.sim-sheet')].pop() || document;
  root.querySelector('[data-x-wa]')?.addEventListener('click', () => mark('whatsapp'));
  root.querySelector('[data-x-save]')?.addEventListener('click', () => mark('save'));
}

onState(() => { if (location.pathname === '/citizenship' && box() && !S && signedIn()) boot(); });
