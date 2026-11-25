// The home's live strip (his ask + OK 2026-11-18, mockup Documents/shlomiverse-v2-design/live-strip/3-drop-strip-r2.jpg): a
// "drop" video (its socials version loses the reception before the end - signal-lost.js) is pushed on the home for 7 days from
// its date: a strip between the hero's line and the question box, "the full broadcast only in the Shlomiverse". Behind the words
// frames of the video slowly change and drift (one ~60 KB picture, scripts/verse/drop-frames.mjs; no picture = the poster
// drifts) with faint scanlines and a glitch band - the reception is shaky. While it shows, the simulation strip steps aside.
// Nothing to set: it shows by itself when such a video is published, and goes by itself after 7 days.
import { T } from './copy.js';
import { esc, abs, track } from './ui.js';
import { SYNCS_PANEL, syncsPanel } from './syncspanel.js';

const DAYS = 7;
const MEDIA = 'https://storage.googleapis.com/shlomiverse-media/wiki/';
const NOSIG = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="16" width="3.2" height="5" rx=".8"/><rect x="7" y="12.5" width="3.2" height="8.5" rx=".8"/><rect x="12" y="9" width="3.2" height="12" rx=".8" opacity=".35"/><rect x="17" y="5" width="3.2" height="16" rx=".8" opacity=".35"/><path d="M17.2 1.6l4.6 4.6M21.8 1.6l-4.6 4.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>';

// the band is taken (the Syncs panel, or a drop video this week) - the simulation band steps aside
export const bandTaken = () => SYNCS_PANEL || !!liveVideo();

// the newest drop video from the last 7 days (the list is newest first), or null
export function liveVideo() {
  if (typeof W === 'undefined' || !W.videos) return null;
  const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
  return W.videos.find((v) => v.drop && v.drop.at > 0 && !v.archive && v.src && (v.date || '') >= since) || null;
}

const seen = new Set();
export function mountLive() {
  const el = document.getElementById('live-band');
  if (!el) return false;
  // the Syncs panel has the band (his ask 2026-11-25) - syncspanel.js; SYNCS_PANEL = false gives it back to the drop video
  if (SYNCS_PANEL) { if (el.dataset.v !== 'syncs' || !el.firstElementChild) { el.dataset.v = 'syncs'; el.innerHTML = syncsPanel(); } return true; }
  const v = liveVideo();
  if (!v) { el.innerHTML = ''; return false; }
  if (el.dataset.v === v.id && el.firstElementChild) return true;
  el.dataset.v = v.id;
  const ser = typeof S !== 'undefined' && S[v.series] ? S[v.series].title : '';
  const name = ser ? `${ser} | ${v.title}` : v.title;
  const poster = abs(v.poster || '');
  el.innerHTML = `<a class="live" href="/v/${esc(v.id)}" data-live="${esc(v.id)}" aria-label="${esc(T.shell.liveGo + ' - ' + name)}">
      <span class="live-bg poster" style="--pic:url('${esc(poster)}')"><i></i></span>
      <i class="live-scan"></i><i class="live-glitch"></i><i class="live-shade"></i>
      <span class="live-txt"><span class="live-head"><span class="live-chip">${esc(T.shell.liveChip)}<i class="live-dot"></i></span><span class="live-sig">${NOSIG}</span></span>
        <b>${esc(T.shell.liveTitle)}</b><small>${esc(name)}</small></span>
      <span class="live-go">${PLAY}</span></a>`;
  // the frames picture, when it's there (a drop video published before the tool ran has none - the poster drifts)
  const pic = MEDIA + 'v/' + v.id + '.frames.jpg';
  const im = new Image();
  im.onload = () => {
    const bg = el.querySelector('.live-bg');
    if (bg && el.dataset.v === v.id) { bg.className = 'live-bg frames'; bg.style.setProperty('--pic', `url('${pic}')`); bg.innerHTML = '<i></i><i></i><i></i><i></i>'; }
  };
  im.src = pic;
  if (!seen.has(v.id)) { seen.add(v.id); track('live_view', v.id); }
  return true;
}

document.addEventListener('click', (e) => { const a = e.target.closest('[data-live]'); if (a) track('live_open', a.dataset.live); }, true);
