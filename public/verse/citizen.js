// The citizenship journey's page (/citizenship; stage 3 of the conversion plan, plan conversion-next v6 - mockups C1-C6):
// the boarding pass, check-in with Miriam (an AI agent in her voice - techietech-api/citizen.js), border control at Rabbi
// Demokratovich's booth (his script; the visitor taps an answer at every "(מקשיב)"), the stamp with the citizen number,
// the flight in (teaser 1, with its music) and the ID card, drawn here on a canvas to share. Saved as it goes on the server:
// leave and come back to the same station. The stills (art/citizen-*.jpg) are replaced by his filmed clips later.
import { T } from './copy.js';
import { esc, track, sheet, toast } from './ui.js';
import { st, onState, needFan, signedIn } from './state.js';
import { LOCAL } from './fb.js';

const API = LOCAL ? '/api/verseCitizen' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseCitizen';
const Z = () => T.cz;
const own = () => { try { return !!localStorage.getItem('t-ignore'); } catch (e) { return false; } };
const ready = () => new Promise((res) => { const t0 = Date.now(); (function w() { if (st.ready || Date.now() - t0 > 5000) res(); else setTimeout(w, 80); })(); });
const pad = (n) => String(n || 0).padStart(4, '0');
const face = (id) => (C[id] && C[id].img) || '';

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
  if (!signedIn() || isCitizen()) return '';
  return `<a class="cz-banner" href="/citizenship" onclick="window.track&&window.track('cz_banner','home')">
    <span class="cz-banner-pic"><img src="/verse/art/citizen-checkin.jpg" alt=""><span class="cz-say">${esc(Z().bannerSay)}</span></span>
    <span class="cz-banner-t"><b>${esc(Z().bannerTitle)}</b><small>${esc(Z().bannerLine)}</small><span class="vx-btn main small">${esc(Z().bannerGo)}</span></span>
    <span class="cz-pass-peek">${esc(Z().pass.title)}</span></a>`;
}

// ---------- the page ----------
let S = null;   // the journey as the server has it
export function citizenPage() {
  setTimeout(boot, 0);
  return '<div class="cz" id="cz"><div class="sim-load"><span class="sim-planet"></span></div></div>';
}
const box = () => document.getElementById('cz');
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
  if (S.step === 'booth') return S.booth.length >= 5 ? stamp() : booth();
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

// 2. check-in with Miriam (C3): her turn, 3 quick answers, a text box, skip / skip it all
let busy = false;
async function talk(data) {
  if (busy) return;
  busy = true;
  const el = box(), typing = el.querySelector('.cz-typing');
  if (typing) typing.hidden = false;
  el.querySelectorAll('.cz-opts button, .cz-ask button, .cz-skip').forEach((b) => (b.disabled = true));
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
  el.innerHTML = `${stepTag(2)}<section class="cz-desk">
    <div class="cz-scene"><img src="/verse/art/citizen-checkin.jpg" alt=""></div>
    <div class="cz-chat">${S.turns.map((t) => `<p class="cz-b her">${esc(t.say)} <b>${esc(t.q)}</b></p>${t.a ? `<p class="cz-b me">${esc(t.a)}</p>` : ''}`).join('')}
      <p class="cz-b her now">${esc(p.say)} <b>${esc(p.q)}</b></p><p class="cz-typing" hidden><i></i><i></i><i></i></p></div>
    <div class="cz-opts">${(p.opts || []).map((o, i) => `<button data-cz-pick="${i}">${esc(o)}</button>`).join('')}</div>
    <form class="cz-ask"><input maxlength="200" placeholder="${esc(Z().checkin.type)}"><button aria-label="שליחה">←</button></form>
    <div class="cz-skips"><button class="cz-skip" data-cz-skip>${esc(Z().checkin.skip)}</button><button class="cz-skip" data-cz-all>${esc(Z().checkin.skipAll)}</button></div></section>`;
  el.querySelectorAll('[data-cz-pick]').forEach((b) => (b.onclick = () => { b.classList.add('on'); talk({ pick: +b.dataset.czPick }); }));
  el.querySelector('.cz-ask').onsubmit = (e) => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v) talk({ text: v }); };
  el.querySelector('[data-cz-skip]').onclick = () => talk({ skip: true });
  el.querySelector('[data-cz-all]').onclick = () => talk({ all: true });
  const chat = el.querySelector('.cz-chat'); chat.scrollTop = chat.scrollHeight;
  showOpts();
}
// the answers in view, above the bottom menu (a phone screen is short)
const showOpts = () => requestAnimationFrame(() => { const o = box()?.querySelector('.cz-skips, .cz-opts'); if (o) o.scrollIntoView({ block: 'end', behavior: 'smooth' }); });
function checkinDone(closing) {
  box().innerHTML = `${stepTag(2)}<section class="cz-desk"><div class="cz-scene"><img src="/verse/art/citizen-checkin.jpg" alt=""></div>
    <div class="cz-chat"><p class="cz-b her now">${esc(closing || Z().checkin.done)}</p></div>
    <button class="vx-btn main block" data-cz-go>${esc(Z().checkin.toBooth)}</button></section>`;
  box().querySelector('[data-cz-go]').onclick = () => draw();
}

// 3. border control at the booth (C4): his script, an answer tapped at every "(מקשיב)"
function booth() {
  const i = S.booth.length, beat = Z().booth[i], prev = i > 0 ? Z().booth[i - 1] : null;
  box().innerHTML = `${stepTag(3)}<section class="cz-desk booth">
    <div class="cz-scene"><img src="/verse/art/citizen-booth.jpg" alt=""></div>
    <div class="cz-chat">${prev && prev.after ? `<p class="cz-b rabbi past">${esc(prev.after)}</p>` : ''}<p class="cz-b rabbi now">${esc(beat.say)}</p></div>
    <div class="cz-opts">${beat.a.map((o, k) => `<button data-cz-a="${k}">${esc(o)}</button>`).join('')}</div></section>`;
  showOpts();
  box().querySelectorAll('[data-cz-a]').forEach((b) => (b.onclick = async () => {
    if (busy) return;
    busy = true; b.classList.add('on');
    try { S = await api('booth', { i, a: b.textContent }); busy = false; if (S.booth.length >= 5) { track('cz_stamp', String(S.n)); stamp(true); } else booth(); }
    catch (e) { busy = false; toast(Z().fail, 3000); booth(); }
  }));
}

// 4. the stamp and the number (C5) + his blessing; "טסים פנימה" closes the booth (the script's last beat)
function stamp(fresh) {
  box().innerHTML = `${stepTag(4)}<section class="cz-stamp ${fresh ? 'fresh' : ''}">
    <div class="cz-passport"><img class="cz-planet" src="/verse/logo-160.png" alt=""><div class="cz-ink"><span>${pad(S.n)}</span></div></div>
    <p class="cz-b rabbi now">${esc(Z().stamped)}</p>
    <h1>${esc(Z().stamp.title)}</h1>
    <div class="cz-num"><small>${esc(Z().stamp.number)}</small><b>${pad(S.n)}</b><em>${esc(S.founding ? Z().stamp.founding(S.n) : Z().stamp.regular)}</em></div>
    <p class="cz-bless">${esc(Z().blessing)}</p>
    <button class="vx-btn main block" data-cz-go>${esc(Z().stamp.go)}</button></section>`;
  box().querySelector('[data-cz-go]').onclick = async (e) => {
    e.currentTarget.classList.add('wait');
    try { S = await api('booth', { i: 5, a: Z().stamp.go }); flight(true); } catch (err) { toast(Z().fail, 3000); }
  };
}

// 5. the flight in: the first Shlomiverse teaser with its music (his choice), skippable; then the landing
function flight(played) {
  const el = box();
  el.innerHTML = `<section class="cz-flight"><video src="/verse/art/flight.mp4" poster="/verse/art/flight-poster.jpg" playsinline preload="auto"></video>
    <button class="cz-fskip" data-cz-skip>${esc(Z().flight.skip)}</button></section>`;
  const v = el.querySelector('video');
  const land = () => { v.pause(); landing(); };
  v.onended = land;
  el.querySelector('[data-cz-skip]').onclick = () => { track('cz_flight', 'skip'); land(); };
  // played straight from a tap ("טסים פנימה") the music may play; after a reload it starts muted, a tap brings the sound
  v.muted = !played;
  v.play().catch(() => { v.muted = true; v.play().catch(() => land()); });
  v.onclick = () => { v.muted = false; };
}
async function landing() {
  box().innerHTML = `<section class="cz-land"><img src="/verse/logo-512.png" alt=""><h1>${esc(Z().flight.landing)}</h1><p>${esc(Z().flight.landing2)}</p>
    <button class="vx-btn main block" data-cz-go>${esc(Z().flight.toId)}</button></section>`;
  box().querySelector('[data-cz-go]').onclick = async () => { try { S = await api('landed'); } catch (e) {} track('cz_done', String(S.n)); idCard(); };
}

// 6. the ID card (C6), drawn for sharing
function idCard() {
  const sim = S.sim;
  box().innerHTML = `<section class="cz-id">
    <div class="cz-card"><div class="cz-card-h"><img src="/verse/logo-160.png" alt=""><b>${esc(Z().id.title)}</b></div>
      <div class="cz-card-b"><div class="cz-side"><div class="cz-photo">${S.photo ? `<img src="${esc(S.photo)}" alt="">` : `<span>${esc((S.nick || '?').slice(0, 1))}</span>`}</div><div class="cz-card-stamp">${pad(S.n)}</div></div>
        <dl><dt>${esc(T.cz.pass.passenger)}</dt><dd>${esc(S.nick)}</dd><dt>${esc(Z().id.number)}</dt><dd class="n">${pad(S.n)}</dd>
          <dt>${esc(Z().id.dept)}</dt><dd>${esc(S.dept || '-')}</dd><dt>${esc(Z().id.cls)}</dt><dd>${esc(S.cls || '-')}</dd>
          <dt>${esc(Z().id.status)}</dt><dd>${esc(S.founding ? Z().id.founding : Z().id.citizen)}</dd>
          <dt>${esc(Z().id.sim)}</dt><dd>${sim && sim.name ? esc(sim.name) : `${esc(Z().id.noSim)} · <a href="/simulation">${esc(Z().id.noSimGo)}</a>`}</dd></dl></div></div>
    <button class="vx-btn main block" data-cz-share>${esc(Z().id.share)}</button>
    <a class="vx-btn block" href="/">${esc(Z().id.home)}</a></section>`;
  box().querySelector('[data-cz-share]').onclick = () => shareId();
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function drawId() {
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0f08'); g.addColorStop(1, '#0b0b0e'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  await document.fonts.load('900 80px Heebo').catch(() => {});
  try { const bg = await loadImg('/verse/art/citizen-booth.jpg'); x.globalAlpha = 0.35; x.drawImage(bg, -300, 0, bg.width * (H * 0.45 / bg.height), H * 0.45); x.globalAlpha = 1; } catch (e) {}
  // the card
  const cx = 70, cy = 520, cw = W - 140, ch = 1000;
  x.fillStyle = 'rgba(20,16,14,.94)'; x.strokeStyle = 'rgba(255,106,31,.7)'; x.lineWidth = 4;
  x.beginPath(); x.roundRect(cx, cy, cw, ch, 40); x.fill(); x.stroke();
  x.direction = 'rtl'; x.textAlign = 'right';
  const R = cx + cw - 50;
  try { const logo = await loadImg('/verse/logo-160.png'); x.drawImage(logo, cx + 40, cy + 30, 120, 120); } catch (e) {}
  x.fillStyle = '#fff'; x.font = '900 58px Heebo'; x.fillText(Z().id.title, R, cy + 110);
  // photo
  const px = cx + 50, py = cy + 200, ps = 300;
  x.save(); x.beginPath(); x.roundRect(px, py, ps, ps * 1.25, 24); x.clip();
  let drew = false;
  if (S.photo) { try { const im = await loadImg(S.photo); x.drawImage(im, px, py, ps, ps * 1.25); drew = true; } catch (e) {} }
  if (!drew) { x.fillStyle = '#2a2018'; x.fillRect(px, py, ps, ps * 1.25); x.fillStyle = '#ff6a1f'; x.font = '900 160px Heebo'; x.textAlign = 'center'; x.fillText((S.nick || '?').slice(0, 1), px + ps / 2, py + ps * 0.8); x.textAlign = 'right'; }
  x.restore();
  const rows = [[T.cz.pass.passenger, S.nick], [Z().id.number, pad(S.n)], [Z().id.dept, S.dept || '-'], [Z().id.cls, S.cls || '-'],
    [Z().id.status, S.founding ? Z().id.founding : Z().id.citizen], [Z().id.sim, S.sim && S.sim.name ? S.sim.name : Z().id.noSim]];
  let y = cy + 230;
  for (const [k, v] of rows) {
    x.fillStyle = '#b9b2ab'; x.font = '500 34px Heebo'; x.fillText(k, R, y);
    const big = k === Z().id.number;
    x.fillStyle = big ? '#ff6a1f' : '#fff'; x.font = big ? '900 60px Heebo' : '800 42px Heebo';
    const n = wrap2(x, String(v), R, y + 56, cw - ps - 150, 50);
    y += 118 + (n - 1) * 50;
  }
  // the stamp
  x.save(); x.translate(cx + 220, cy + ch - 120); x.rotate(-0.25); x.strokeStyle = 'rgba(255,106,31,.85)'; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 105, 0, Math.PI * 2); x.stroke();
  x.fillStyle = 'rgba(255,106,31,.9)'; x.textAlign = 'center'; x.font = '900 52px Heebo'; x.fillText(pad(S.n), 0, 18); x.restore();
  x.textAlign = 'right'; x.font = '900 70px Heebo'; x.fillStyle = '#fdf6ef'; const sw = x.measureText('שלומי').width; x.fillText('שלומי', W - 70, H - 150); x.fillStyle = '#fc7211'; x.fillText('וורס', W - 70 - sw, H - 150);
  x.direction = 'ltr'; x.textAlign = 'left'; x.fillStyle = '#d8d2cc'; x.font = '500 38px Heebo'; x.fillText('shlomiverse.com', 70, H - 160);
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
}
// up to 2 lines (a long classification was cut with "...")
function wrap2(x, t, right, y, max, lh) {
  const words = t.split(/\s+/); let line = '', lines = [];
  for (const w of words) { const tryL = line ? line + ' ' + w : w; if (x.measureText(tryL).width > max && line) { lines.push(line); line = w; } else line = tryL; }
  if (line) lines.push(line);
  if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
  lines.forEach((l, i) => (i === 1 ? fit(x, l, right, y + lh, max) : x.fillText(l, right, y)));
  return lines.length;
}
function fit(x, t, right, y, max) { let s = t; while (x.measureText(s).width > max && s.length > 3) s = s.slice(0, -2); if (s !== t) s += '…'; x.fillText(s, right, y); }
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
