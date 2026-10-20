import { allKeys, autotune, buildSession, clapLatency, denoise, detectKey, detectSync, keyName, mono, mp3, renderSession, trackPitch, vocalLevel, wav } from './dsp.js';
import { KNOBS, STYLES, STYLE_GRID, defaultFx, icon } from './fx.js';

// Karaoke Booth — a home studio for turning a karaoke recording into a song.
// Tracks: the music + vocal tracks. Every vocal track is stored song-aligned (sample 0 = the song's
// start); a recording is written into the selected track at the playhead, shifted by this phone /
// computer + headphones' measured delay, so it lands on the beat. Each vocal track has a voice style.

const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s * 10) % 10)}`;
const S = {
  ctx: null, song: null, songMono: null, songName: '', songKey: '', songBlob: null, isVideo: false, key: null,
  inst: null, instMono: null, guide: null,
  stream: null, src: null, cap: null, mon: null, deviceId: localStorage.getItem('kb-mic') || '', micLabel: 'mic',
  proj: null, activeId: null, playhead: 0, mode: 'idle', session: null, t0: 0, startPos: 0, rec: null,
};
const SPLIT_URL = new URLSearchParams(location.search).get('split') || 'https://vocal-split-463727469066.me-west1.run.app';
const backing = () => S.inst || S.song;
const backingMono = () => S.instMono || S.songMono;
const LANE_COLORS = ['--v0', '--v1', '--v2', '--v3'];
const laneColor = (i) => LANE_COLORS[i % LANE_COLORS.length];

// ---------- small UI helpers ----------
let toastTimer = 0;
function toast(msg, ms = 4500) { const t = $('toast'); t.innerHTML = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms); }
function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
const setToggle = (el, on) => el.setAttribute('aria-checked', on ? 'true' : 'false');
const isOn = (el) => el.getAttribute('aria-checked') === 'true';
function openPanel(id) { $('scrim').classList.remove('hidden'); $(id).classList.remove('hidden'); }
function closePanels() { ['drawer-setup', 'drawer-projects', 'dialog-export'].forEach((i) => $(i).classList.add('hidden')); $('scrim').classList.add('hidden'); $('lane-menu').classList.add('hidden'); }
$('scrim').onclick = closePanels;
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closePanels));

// ---------- theme ----------
try { const t = localStorage.getItem('kb-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
$('theme').onclick = () => {
  const dark = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#121110';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('kb-theme', document.documentElement.dataset.theme); } catch {}
  drawAll();
};

// ---------- audio context ----------
async function audio() {
  if (!S.ctx) {
    S.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await S.ctx.audioWorklet.addModule('./worklet.js');
  }
  if (S.ctx.state !== 'running') await S.ctx.resume();
  return S.ctx;
}

// ---------- storage ----------
const db = new Promise((res, rej) => {
  const r = indexedDB.open('karaoke-booth', 2);
  r.onupgradeneeded = () => {
    const d = r.result;
    for (const [n, k] of [['songs', 'key'], ['takes', 'id'], ['projects', 'id']]) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: k });
  };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function store(name, mode, fn) {
  const d = await db;
  return new Promise((res, rej) => { const tx = d.transaction(name, mode); const r = fn(tx.objectStore(name)); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); });
}

// ---------- sync: this device + headphones' delay ----------
const latKey = () => 'kb-latency:' + S.micLabel;
function latency() {
  const v = parseFloat(localStorage.getItem(latKey()));
  return isFinite(v) ? v : (S.ctx.outputLatency || 0) + (S.ctx.baseLatency || 0) + 0.02;
}
function setLatency(v, how) { try { localStorage.setItem(latKey(), String(v)); localStorage.setItem(latKey() + ':how', how); } catch {} showSync(); }
function showSync() {
  const v = parseFloat(localStorage.getItem(latKey())), how = localStorage.getItem(latKey() + ':how');
  $('sync-dot').className = isFinite(v) ? 'dot-ok' : 'dot-warn';
  $('sync-text').textContent = isFinite(v) ? `Sync calibrated — ${Math.round(v * 1000)} ms ${how === 'leak' ? '(measured from the headphones)' : ''}` : 'Sync not calibrated yet — tap Calibrate once';
}

// ---------- steps ----------
function updateSteps() {
  const hasSong = !!S.song, hasVoice = !!(S.proj && S.proj.layers.some((l) => l.data.length));
  const cur = !hasSong ? 1 : !hasVoice ? 2 : 3;
  document.querySelectorAll('#steps button').forEach((b) => {
    const n = +b.dataset.step;
    b.classList.toggle('on', n === cur);
    b.classList.toggle('done', n < cur || (n === 3 && S.proj && S.proj.mixed));
  });
  $('open-export').disabled = !hasVoice;
}
document.querySelectorAll('#steps button').forEach((b) => (b.onclick = () => {
  const n = +b.dataset.step;
  if (n === 1) { if (!S.song) $('file').click(); else flash($('song-card')); }
  else if (n === 2) flash(S.cap ? $('tracks-card') : $('setup-card'));
  else flash($('style-card'));
}));

// ---------- song ----------
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  closePanels();
  if (!(await loadSong(f, f.name))) return;
  store('songs', 'readwrite', (s) => s.put({ key: S.songKey, name: f.name, blob: f })).catch(() => {});
  S.proj = { id: Date.now(), songKey: S.songKey, songName: f.name, created: Date.now(), settings: { sng: 80, guide: 100, guidePlay: false }, layers: [] };
  addLayer();
  openStudio();
  save();
  e.target.value = '';
};
async function loadSong(blob, name) {
  const ctx = await audio();
  $('song-name').textContent = 'Loading…'; $('song-kind').textContent = ''; $('song-len').textContent = '';
  try { S.song = await ctx.decodeAudioData(await blob.arrayBuffer()); }
  catch {
    $('song-name').textContent = 'Could not read this file';
    $('song-kind').textContent = /\.(mp4|mov|m4v|webm)$/i.test(name) || (blob.type || '').startsWith('video') ? 'Try another video, or its MP3' : 'Try an MP3 or M4A';
    return false;
  }
  S.songMono = mono(S.song); S.songName = name; S.songKey = `${name}|${blob.size}`; S.songBlob = blob; S.key = null;
  S.inst = S.instMono = S.guide = null;
  const title = name.replace(/\.[^.]+$/, '');
  $('song-name').textContent = title; $('song-title').textContent = title;
  $('song-len').textContent = fmt(S.song.duration);
  setVideo(blob, name);
  $('song-kind').textContent = S.isVideo ? 'Video — lyrics play on screen' : 'Audio';
  // the "singers removed" state of this song
  setToggle($('split-go'), false); $('split-go').disabled = false;
  $('split-sub').textContent = 'Removes the original singers from the music (AI, ~2 min)';
  $('split-ctl').classList.add('hidden'); $('split-note').classList.add('hidden'); $('split-bar').classList.add('hidden');
  const cached = await store('songs', 'readonly', (st) => st.get(S.songKey)).catch(() => null);
  if (cached && cached.stems) await useStems(cached.stems.inst, cached.stems.voc, true);
  setTimeout(() => { S.key = detectKey(backingMono(), S.song.sampleRate); showStyle(); }, 50);
  updateSteps();
  return true;
}

// ---------- remove the singers (Demucs on Cloud Run) ----------
async function useStems(instBlob, vocBlob, fromCache) {
  const ctx = await audio();
  S.inst = await ctx.decodeAudioData(await instBlob.arrayBuffer());
  S.guide = await ctx.decodeAudioData(await vocBlob.arrayBuffer());
  S.instMono = mono(S.inst);
  S.key = detectKey(S.instMono, S.inst.sampleRate);
  setToggle($('split-go'), true);
  $('split-sub').textContent = fromCache ? 'Done earlier for this song — the music plays without them' : 'Done — the music now plays without them';
  $('split-ctl').classList.remove('hidden');
  showGuide(); drawAll();
}
function showGuide() {
  const s = (S.proj && S.proj.settings) || {};
  $('m-guide').value = s.guide ?? 100; $('v-guide').textContent = `${s.guide ?? 100}%`;
  setToggle($('m-guide-play'), !!s.guidePlay);
  $('m-sng').value = s.sng ?? 80; $('v-sng').textContent = `${s.sng ?? 80}%`;
}
$('m-guide').oninput = (e) => { if (!S.proj) return; S.proj.settings.guide = +e.target.value; showGuide(); };
$('m-guide').onchange = () => save();
$('m-guide-play').onclick = () => { if (!S.proj) return; S.proj.settings.guidePlay = !S.proj.settings.guidePlay; showGuide(); save(); replay(); };
$('m-sng').oninput = (e) => { if (!S.proj) return; S.proj.settings.sng = +e.target.value; showGuide(); };
$('m-sng').onchange = () => { save(); replay(); };
$('split-go').onclick = async () => {
  if (!S.song || isOn($('split-go'))) return;
  const note = $('split-note'), bar = $('split-bar'), fill = $('split-fill'), btn = $('split-go');
  const say = (t, cls = '') => { note.className = `note ${cls}`; note.textContent = t; note.classList.remove('hidden'); };
  btn.disabled = true; setToggle(btn, true); bar.classList.remove('hidden'); fill.style.width = '3%';
  try {
    let clip = S.songBlob;
    if (!clip || clip.size > 28 * 1024 * 1024) { say('Preparing the audio…'); clip = await mp3(S.song, 160); }
    say('Uploading…'); fill.style.width = '8%';
    const fd = new FormData(); fd.append('file', clip, clip === S.songBlob ? (S.songName || 'song') : 'song.mp3');
    const r = await fetch(`${SPLIT_URL}/separate`, { method: 'POST', body: fd });
    if (!r.ok) throw new Error(`the server said ${r.status}`);
    const { job } = await r.json();
    say('Removing the singers — about 2 minutes. You can set up the microphone meanwhile.');
    let j;
    for (;;) {
      await new Promise((res) => setTimeout(res, 2000));
      j = await (await fetch(`${SPLIT_URL}/jobs/${job}`)).json();
      fill.style.width = `${Math.round(8 + 88 * (j.progress || 0))}%`;
      if (j.status === 'done' || j.status === 'error') break;
    }
    if (j.status === 'error') throw new Error(j.stage || 'separation failed');
    say('Downloading…'); fill.style.width = '98%';
    const [inst, voc] = await Promise.all([fetch(SPLIT_URL + j.files.instrumental).then((x) => x.blob()), fetch(SPLIT_URL + j.files.vocals).then((x) => x.blob())]);
    await useStems(inst, voc, false);
    note.classList.add('hidden'); bar.classList.add('hidden');
    const rec = await store('songs', 'readonly', (st) => st.get(S.songKey)).catch(() => null);
    await store('songs', 'readwrite', (st) => st.put({ ...(rec || { key: S.songKey, name: S.songName, blob: S.songBlob }), stems: { inst, voc } })).catch(() => {});
    toast('Singers removed — you\'ll hear them while recording, and only the music with your voice in the song.');
  } catch (e) {
    say(`Couldn't remove the singers: ${e.message}. Check the connection and try again.`, 'warn');
    setToggle(btn, false); btn.disabled = false; bar.classList.add('hidden');
  }
};

// ---------- tracks ----------
let layerSeq = 1;
const TRACK_NAMES = ['Lead vocal', 'Harmony', 'Vocal 3', 'Vocal 4', 'Vocal 5', 'Vocal 6'];
function addLayer() {
  const n = S.proj.layers.length;
  const l = { id: Date.now() + Math.random(), name: TRACK_NAMES[n] || `Vocal ${n + 1}`, data: new Float32Array(0), sr: S.ctx.sampleRate,
    vol: 100, shift: 0, mute: false, clean: true, fx: defaultFx('natural'), parts: [], v: layerSeq++ };
  S.proj.layers.push(l);
  S.activeId = l.id;
  return l;
}
const active = () => S.proj.layers.find((l) => l.id === S.activeId) || S.proj.layers[0];
function openStudio() {
  S.playhead = 0;
  renderLanes(); showStyle(); showGuide(); showPos(); updateSteps(); drawAll();
}
const projEnd = () => Math.max(S.song ? S.song.duration : 0, S.inst ? S.inst.duration : 0, ...(S.proj ? S.proj.layers.map((l) => l.data.length / l.sr + l.shift / 1000) : [0]), 1);

const MIC_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/></svg>';
const MUSIC_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
function renderLanes() {
  const has = !!(S.song && S.proj);
  $('empty-tracks').classList.toggle('hidden', has);
  $('add-layer').classList.toggle('hidden', !has);
  if (!has) { $('lanes').innerHTML = ''; return; }
  const music = `<div class="lane music"><div class="lane-head"><div class="lane-name">${MUSIC_SVG}<span>Music</span></div>
    <div class="lane-chips">${S.inst ? '<span class="chip">Singers removed</span>' : ''}</div></div><canvas data-lane="music"></canvas></div>`;
  const vocals = S.proj.layers.map((l, i) => `
    <div class="lane ${l.id === S.activeId ? 'sel' : ''}" data-id="${l.id}" style="background:var(${laneColor(i)}-bg)">
      <div class="lane-head" data-sel="${l.id}" style="${l.id === S.activeId ? `box-shadow: inset 3px 0 0 var(${laneColor(i)})` : ''}">
        <div class="lane-name" style="color:var(${laneColor(i)})">${MIC_SVG}<span style="color:var(--text)">${l.name}</span>
          <div class="lane-tools">
            <button class="${l.mute ? 'on' : ''}" data-mute="${l.id}" title="Mute this track">M</button>
            <button data-menu="${l.id}" title="More: volume, sync, rename, export, delete">•••</button>
          </div>
        </div>
        <div class="lane-chips">
          <button class="chip style" data-style="${l.id}" title="This track's voice style — change it on the right">${STYLES[l.fx.style].name}${l._busy ? ' <span class="spinner"></span>' : ''}</button>
          <button class="chip ${l.clean ? '' : 'off'}" data-clean="${l.id}" title="Clean noise: removes fan, hum and room hiss">${l.clean ? '✓ ' : ''}Clean</button>
        </div>
      </div>
      <canvas data-lane="${l.id}"></canvas>
    </div>`).join('');
  $('lanes').innerHTML = music + vocals;
  const sel = (id) => { if (S.mode === 'recording') return; S.activeId = id; renderLanes(); showStyle(); updateRecLabel(); };
  $('lanes').querySelectorAll('[data-sel]').forEach((el) => (el.onclick = (e) => { if (!e.target.closest('button')) sel(+el.dataset.sel); }));
  $('lanes').querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => { sel(+b.dataset.style); flash($('style-card')); }));
  $('lanes').querySelectorAll('[data-clean]').forEach((b) => (b.onclick = () => {
    const l = S.proj.layers.find((x) => x.id === +b.dataset.clean); l.clean = !l.clean; process(l); save();
    toast(l.clean ? `Noise cleaning on for ${l.name}.` : `Noise cleaning off for ${l.name} — the raw recording.`, 2500);
  }));
  $('lanes').querySelectorAll('[data-mute]').forEach((b) => (b.onclick = () => {
    const l = S.proj.layers.find((x) => x.id === +b.dataset.mute); l.mute = !l.mute; renderLanes(); save(); replay();
  }));
  $('lanes').querySelectorAll('[data-menu]').forEach((b) => (b.onclick = (e) => laneMenu(+b.dataset.menu, e.currentTarget)));
  $('lanes').querySelectorAll('canvas').forEach((c) => attachSeek(c));
  updateRecLabel(); drawAll();
}
function updateRecLabel() {
  if (!S.proj) return;
  $('rec-sub').textContent = `into ${active().name}`;
  $('rec-title').textContent = S.mode === 'recording' ? 'Stop' : 'Record';
}
$('add-layer').onclick = () => {
  if (!S.proj || S.mode !== 'idle') return;
  const l = addLayer(); S.playhead = 0;
  l.fx = { ...S.proj.layers[0].fx };   // a new part starts in the lead's style
  renderLanes(); showStyle(); showPos(); save(); parkVideo();
  toast(`${l.name} added — the playhead went back to the start. Press Record when ready.`);
};

// lane "•••" menu: volume, sync nudge, sync check, rename, export, delete
function laneMenu(id, anchor) {
  const l = S.proj.layers.find((x) => x.id === id), m = $('lane-menu'), r = anchor.getBoundingClientRect();
  m.innerHTML = `
    <div class="mk"><div class="knob-h"><b>Volume</b><span id="mm-vol-v">${l.vol}%</span></div><input type="range" id="mm-vol" min="0" max="200" value="${l.vol}"></div>
    <div class="mk"><div class="knob-h"><b>Sync nudge</b><span id="mm-sh-v">${l.shift ? (l.shift > 0 ? '+' : '') + l.shift + ' ms' : 'in sync'}</span></div><input type="range" id="mm-sh" min="-300" max="300" step="5" value="${l.shift}"></div>
    <hr>
    <button id="mm-mute">${l.mute ? 'Unmute' : 'Mute'} this track</button>
    <button id="mm-sync">Check sync of every part</button>
    <button id="mm-rename">Rename</button>
    <button id="mm-export">Export this track (WAV)</button>
    <button id="mm-del" style="color:var(--bad)">Delete track</button>`;
  m.style.left = `${Math.min(window.innerWidth - 240, r.left)}px`; m.style.top = `${Math.min(window.innerHeight - 320, r.bottom + 6)}px`;
  m.classList.remove('hidden');
  $('mm-vol').oninput = (e) => { l.vol = +e.target.value; $('mm-vol-v').textContent = `${l.vol}%`; };
  $('mm-vol').onchange = () => { save(); replay(); };
  $('mm-sh').oninput = (e) => { l.shift = +e.target.value; $('mm-sh-v').textContent = l.shift ? `${l.shift > 0 ? '+' : ''}${l.shift} ms` : 'in sync'; drawAll(); };
  $('mm-sh').onchange = () => { save(); replay(); };
  $('mm-mute').onclick = () => { m.classList.add('hidden'); l.mute = !l.mute; renderLanes(); save(); replay(); };
  $('mm-sync').onclick = () => { m.classList.add('hidden'); toast(syncCheck(l).join('<br>'), 9000); };
  $('mm-rename').onclick = () => { const n = prompt('Track name', l.name); if (n) { l.name = n.trim(); renderLanes(); save(); } m.classList.add('hidden'); };
  $('mm-export').onclick = () => { m.classList.add('hidden'); exportTrack(l); };
  $('mm-del').onclick = () => {
    m.classList.add('hidden');
    if (S.mode !== 'idle') return;
    if (l.data.length && !confirm(`Delete ${l.name} and its recording?`)) return;
    S.proj.layers = S.proj.layers.filter((x) => x !== l);
    if (!S.proj.layers.length) addLayer();
    S.activeId = S.proj.layers[0].id;
    renderLanes(); showStyle(); save(); updateSteps();
  };
}
document.addEventListener('pointerdown', (e) => { const m = $('lane-menu'); if (!m.classList.contains('hidden') && !m.contains(e.target) && !e.target.closest('[data-menu]')) m.classList.add('hidden'); });

// ---------- karaoke video, locked to the playhead ----------
const vid = $('kv');
let vidUrl = null, follow = 0, lastSeek = 0;
function setVideo(blob, name) {
  S.isVideo = (blob.type || '').startsWith('video') || /\.(mp4|mov|m4v|webm)$/i.test(name);
  if (vidUrl) URL.revokeObjectURL(vidUrl);
  vidUrl = null;
  $('empty-video').classList.toggle('hidden', S.isVideo);
  vid.classList.toggle('hidden', !S.isVideo);
  $('thumb').style.backgroundImage = '';
  $('thumb').innerHTML = MUSIC_SVG.replace(/16/g, '22');
  if (!S.isVideo) {
    vid.removeAttribute('src'); vid.load();
    $('empty-video').innerHTML = `<div class="big-note">${MUSIC_SVG.replace(/16/g, '34')}</div><b>${S.songName.replace(/\.[^.]+$/, '')}</b><span>An audio song — no lyrics video. Choose a karaoke video to see the words while you sing.</span>`;
    return;
  }
  vidUrl = URL.createObjectURL(blob);
  vid.src = vidUrl; vid.currentTime = 0;
  // a frame from the video as the song's picture
  vid.addEventListener('loadeddata', function grab() {
    vid.removeEventListener('loadeddata', grab);
    const t = Math.min(20, (vid.duration || 10) * 0.15);
    const done = () => {
      try { const c = document.createElement('canvas'); c.width = 160; c.height = 160 * vid.videoHeight / vid.videoWidth || 90;
        c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
        $('thumb').innerHTML = ''; $('thumb').style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.7)})`; } catch {}
      vid.removeEventListener('seeked', done); vid.currentTime = 0;
    };
    vid.addEventListener('seeked', done); vid.currentTime = t;
  });
}
/** iPhone/desktop video needs time to start and seek: jump only when far off and never while a jump is in
 * progress (that loop freezes the picture); small drift is absorbed by a slightly faster/slower rate. */
function followVideo(getPos) {
  clearInterval(follow);
  if (!vidUrl) return;
  const seekTo = (t) => { lastSeek = performance.now(); vid.currentTime = t; };
  const step = () => {
    const pos = getPos();
    if (pos === null) { clearInterval(follow); vid.pause(); vid.playbackRate = 1; return; }
    if (pos < 0) { if (!vid.paused) vid.pause(); if (Math.abs(vid.currentTime) > 0.3 && !vid.seeking) seekTo(0); return; }
    if (pos >= vid.duration - 0.05) { vid.pause(); return; }
    if (vid.paused) { if (Math.abs(vid.currentTime - pos) > 0.5 && !vid.seeking) seekTo(pos + 0.15); vid.play().catch(() => {}); return; }
    if (vid.seeking || vid.readyState < 3 || performance.now() - lastSeek < 1500) return;
    const drift = vid.currentTime - pos;
    if (Math.abs(drift) > 1) { seekTo(pos + 0.3); vid.playbackRate = 1; }
    else vid.playbackRate = Math.abs(drift) > 0.05 ? Math.max(0.85, Math.min(1.15, 1 - drift * 0.8)) : 1;
  };
  step();
  follow = setInterval(step, 250);
}
function stopVideo() { clearInterval(follow); vid.pause(); vid.playbackRate = 1; }
function parkVideo() { if (vidUrl && !vid.seeking && Math.abs(vid.currentTime - S.playhead) > 0.2) { lastSeek = performance.now(); vid.currentTime = Math.min(S.playhead, (vid.duration || 1) - 0.05); } }

// ---------- microphone ----------
const BT = /airpods|bluetooth|headset|hands-?free|beats|buds|bose|sony|jabra/i;
async function openMic(deviceId) {
  const ctx = await audio();
  closeMic();
  S.stream = await navigator.mediaDevices.getUserMedia({ audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    channelCount: 1, sampleRate: { ideal: 48000 }, sampleSize: { ideal: 24 } } });
  const track = S.stream.getAudioTracks()[0];
  S.deviceId = track.getSettings().deviceId || deviceId || '';
  S.micLabel = track.label || 'mic';
  try { localStorage.setItem('kb-mic', S.deviceId); } catch {}
  S.src = ctx.createMediaStreamSource(S.stream);
  S.cap = new AudioWorkletNode(ctx, 'capture');
  const sink = ctx.createGain(); sink.gain.value = 0;
  S.src.connect(S.cap).connect(sink).connect(ctx.destination);
  S.mon = ctx.createGain(); S.mon.gain.value = isOn($('monitor')) ? 1 : 0;
  S.src.connect(S.mon).connect(ctx.destination);
  S.cap.port.onmessage = (m) => {
    if (m.data.level !== undefined) {
      const clip = m.data.peak > 0.97;
      $('meter').style.width = `${Math.min(100, m.data.level * 400)}%`;
      $('meter').style.background = clip ? 'var(--bad)' : m.data.peak > 0.7 ? 'var(--warn)' : 'var(--ok)';
      if (clip) { $('meter-note').innerHTML = '<span class="clip-warn">Too loud — the mic is clipping.</span> Move back a little or lower the input level.'; clipSeen = performance.now(); }
      else if (performance.now() - clipSeen > 3000) $('meter-note').textContent = 'Sing at full voice: the bar should move well, and never turn red.';
    } else if (capturing && m.data.data) chunks.push(m.data);
  };
  $('mic-name').textContent = track.label || 'Microphone';
  await listMics(track.label); await listOutputs();
  $('mic-on').classList.add('hidden'); $('mic-ui').classList.remove('hidden');
  showSync(); updateSteps();
}
function closeMic() {
  if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
  try { S.src && S.src.disconnect(); S.cap && S.cap.disconnect(); S.mon && S.mon.disconnect(); } catch {}
  S.stream = S.src = S.cap = S.mon = null;
}
async function listMics(currentLabel) {
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  $('mic-list').innerHTML = devs.map((d) => `<option value="${d.deviceId}" ${d.deviceId === S.deviceId ? 'selected' : ''}>${d.label || 'Microphone'}</option>`).join('');
  const w = $('mic-warn'), builtIn = devs.find((d) => /iphone|built-?in|internal/i.test(d.label));
  if (BT.test(currentLabel || '')) {
    w.className = 'note warn';
    w.innerHTML = `Recording through <b>${currentLabel}</b> — Bluetooth headset mics record in phone-call quality.` + (builtIn ? ` Pick <b>${builtIn.label}</b> above.` : ' A wired or USB mic sounds far better.');
    w.classList.remove('hidden');
  } else w.classList.add('hidden');
}
async function listOutputs() {
  if (!S.ctx || typeof S.ctx.setSinkId !== 'function') return;
  const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
  if (!outs.length) return;
  const saved = localStorage.getItem('kb-out') || '';
  $('out-list').innerHTML = outs.map((d) => `<option value="${d.deviceId}" ${d.deviceId === saved ? 'selected' : ''}>${d.label || (d.deviceId === 'default' ? 'System default' : 'Output')}</option>`).join('');
  $('out-ctl').classList.remove('hidden');
  if (saved && outs.some((d) => d.deviceId === saved)) await S.ctx.setSinkId(saved).catch(() => {});
}
$('out-list').onchange = async (e) => { try { await S.ctx.setSinkId(e.target.value); localStorage.setItem('kb-out', e.target.value); } catch (err) { alert('Could not switch output: ' + err.message); } };
$('mic-on').onclick = () => openMic(S.deviceId).catch((e) => alert('Microphone blocked: ' + e.message));
$('mic-list').onchange = (e) => openMic(e.target.value).catch((err) => alert(err.message));
$('monitor').onclick = () => { setToggle($('monitor'), !isOn($('monitor'))); if (S.mon) S.mon.gain.value = isOn($('monitor')) ? 1 : 0; };
$('open-setup').onclick = $('setup-more').onclick = async () => { if (!S.cap) await openMic(S.deviceId).catch(() => {}); openPanel('drawer-setup'); };

let chunks = [], capturing = false, clipSeen = 0;
function startCapture() { chunks = []; capturing = true; S.cap.port.postMessage('start'); }
function endCapture() {
  capturing = false; S.cap.port.postMessage('stop');
  if (!chunks.length) return { data: new Float32Array(0), first: 0 };
  const first = chunks[0].frame, last = chunks[chunks.length - 1];
  const out = new Float32Array(last.frame - first + last.data.length);
  for (const c of chunks) out.set(c.data, c.frame - first);  // by audio-clock frame: a dropped block is a gap, never a shift
  return { data: out, first };
}
$('test').onclick = async () => {
  if (!S.cap) return;
  const ctx = await audio();
  startCapture(); $('test').textContent = 'Recording…';
  await new Promise((r) => setTimeout(r, 3000));
  const { data } = endCapture();
  const b = ctx.createBuffer(1, Math.max(1, data.length), ctx.sampleRate); b.copyToChannel(data, 0);
  const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start();
  $('test').textContent = 'Playing back…';
  s.onended = () => ($('test').textContent = 'Test 3 s');
};
$('calib').onclick = async () => {
  if (!S.cap || S.mode !== 'idle') return;
  const ctx = await audio(), sr = ctx.sampleRate, n = 8, gap = 0.5, lead = 1.2;
  const buf = ctx.createBuffer(1, Math.ceil((lead + n * gap + 0.5) * sr), sr), d = buf.getChannelData(0);
  for (let k = 0; k < n; k++) { const o = Math.round((lead + k * gap) * sr); for (let i = 0; i < sr * 0.03; i++) d[o + i] = Math.sin((2 * Math.PI * 1500 * i) / sr) * Math.exp(-i / (sr * 0.006)) * 0.8; }
  const note = $('calib-note'), btn = $('calib');
  note.className = 'note ok'; note.classList.remove('hidden'); note.textContent = 'Headphones on — clap once on every click you hear (8 clicks)…';
  btn.disabled = true;
  startCapture();
  const t0 = ctx.currentTime + 0.3;
  const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start(t0);
  await new Promise((r) => setTimeout(r, (0.3 + lead + n * gap + 0.7) * 1000));
  const { data, first } = endCapture();
  btn.disabled = false;
  const r = clapLatency(data, sr, [...Array(n)].map((_, k) => t0 + lead + k * gap - first / sr));
  if (r && r.spread < 0.08) { setLatency(r.latency, 'calibrated'); note.textContent = `Calibrated: ${Math.round(r.latency * 1000)} ms. Every recording is now placed on the beat.`; }
  else { note.className = 'note warn'; note.textContent = 'Couldn\'t hear clean claps on the clicks — try again in a quiet room, one firm clap per click.'; }
};

// ---------- what each vocal track sounds like: cleaned, tuned, then its voice style ----------
function cleaned(l) {
  if (!l.clean || !l.data.length) return l.data;
  if (!l._clean || l._cleanV !== l.v) { l._clean = denoise(l.data, l.sr, 0.8); l._cleanV = l.v; }
  return l._clean;
}
const layerKey = () => (S.proj && S.proj.settings.key ? (([t, m]) => ({ tonic: +t, mode: m }))(S.proj.settings.key.split(':')) : S.key || { tonic: 0, mode: 'chromatic' });
const procSig = (l) => `${l.v}|${l.clean}|${l.fx.tune.toFixed(2)}|${STYLES[l.fx.style].tuneSpeed}|${JSON.stringify(layerKey())}`;
function layerBuf(l) {
  if (l._proc && l._procSig === procSig(l)) return l._proc;
  // not processed yet: the raw recording plays meanwhile
  if (!l._raw || l._rawV !== l.v) { l._raw = S.ctx.createBuffer(1, Math.max(1, l.data.length), l.sr); l._raw.copyToChannel(l.data, 0); l._rawV = l.v; }
  return l._raw;
}
const procTimers = {};
function process(l, delay = 60) {
  clearTimeout(procTimers[l.id]);
  if (!l.data.length) return Promise.resolve();
  l._busy = true; renderLanes(); showStyle();
  return new Promise((done) => {
    procTimers[l.id] = setTimeout(() => {
      const sig = procSig(l);
      let y = cleaned(l);
      if (l.fx.tune > 0.01) {
        if (!l._pitch || l._pitchV !== `${l.v}|${l.clean}`) { l._pitch = trackPitch(y, l.sr); l._pitchV = `${l.v}|${l.clean}`; }
        y = autotune(y, l.sr, l._pitch, { key: layerKey(), strength: Math.min(1, l.fx.tune), speed: STYLES[l.fx.style].tuneSpeed * (1.4 - l.fx.tune) });
      }
      l._proc = S.ctx.createBuffer(1, Math.max(1, y.length), l.sr); l._proc.copyToChannel(y, 0); l._procSig = sig;
      l._gain = null; l._busy = false;
      renderLanes(); showStyle(); replay(); done();
    }, delay);
  });
}
function autoGain(l) {
  if (l._gain == null) { const y = cleaned(l); l._gain = y.length > l.sr * 0.5 ? Math.min(8, Math.max(0.3, Math.pow(10, (-18 - vocalLevel(y, l.sr)) / 20))) : 1; }
  return l._gain;
}
function trackList(except, recording = false) {
  const out = S.proj.layers.filter((l) => !l.mute && l.data.length && l !== except)
    .map((l) => ({ buf: layerBuf(l), gain: (l.vol / 100) * autoGain(l) * Math.pow(10, (l.mixDb || 0) / 20), shift: l.shift / 1000, fx: l.fx }));
  // the singers: in your ears while recording, in the song only if asked for
  const s = S.proj.settings, g = recording ? (s.guide ?? 100) / 100 : s.guidePlay ? (s.guide ?? 100) / 100 : 0;
  if (S.guide && g > 0) out.push({ buf: S.guide, gain: g * ((s.sng ?? 80) / 100), shift: 0, raw: true });
  return out;
}
const mixOpts = () => ({ songGain: (S.proj.settings.sng ?? 80) / 100, reverb: 0, auto: false });

// ---------- transport ----------
const curPos = () => S.startPos + (S.ctx.currentTime - S.t0);
async function play(from = S.playhead) {
  if (!S.proj) return;
  const ctx = await audio();
  stopSession();
  const when = ctx.currentTime + 0.06;
  S.session = buildSession(ctx, backing(), trackList(), mixOpts(), when, from);
  S.t0 = when; S.startPos = from; S.mode = 'playing';
  followVideo(() => (S.mode === 'playing' ? curPos() : null));
  setPlayIcon(); loop();
}
let replayTimer = 0;
function replay() { if (S.mode !== 'playing') return; clearTimeout(replayTimer); replayTimer = setTimeout(() => S.mode === 'playing' && play(curPos()), 120); }
function stopSession() { if (S.session) { S.session.stop(); S.session = null; } }
function pause() {
  if (S.mode !== 'playing') return;
  S.playhead = Math.max(0, Math.min(projEnd(), curPos()));
  stopSession(); S.mode = 'idle'; stopVideo(); setPlayIcon(); drawAll(); showPos();
}
function seek(t) {
  S.playhead = Math.max(0, Math.min(projEnd(), t));
  if (S.mode === 'playing') play(S.playhead); else { showPos(); drawAll(); parkVideo(); }
}
function setPlayIcon() {
  $('t-play').innerHTML = S.mode === 'playing'
    ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>'
    : '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const busy = S.mode === 'recording';
  for (const id of ['t-start', 't-back', 't-play', 't-fwd', 'add-layer', 'calib', 'magic']) $(id).disabled = busy;
  updateRecLabel();
}
$('t-play').onclick = () => (S.mode === 'playing' ? pause() : S.mode === 'idle' && play(S.playhead >= projEnd() - 0.1 ? 0 : S.playhead));
$('t-start').onclick = () => seek(0);
$('t-back').onclick = () => seek((S.mode === 'playing' ? curPos() : S.playhead) - 5);
$('t-fwd').onclick = () => seek((S.mode === 'playing' ? curPos() : S.playhead) + 5);
function showPos() { $('pos').textContent = fmtT(S.playhead); $('dur').textContent = `/ ${fmt(S.song ? projEnd() : 0)}`; placePlayhead(); }
let raf = 0, lastDraw = 0;
function loop() {
  cancelAnimationFrame(raf);
  const step = (ts) => {
    if (S.mode === 'idle') return;
    const p = curPos();
    S.playhead = Math.max(0, p);
    if (S.mode === 'playing' && p >= projEnd()) { pause(); S.playhead = projEnd(); showPos(); return; }
    if (S.mode === 'recording' && p >= backing().duration + 0.5) { stopRecord(); return; }
    showPos();
    if (S.mode === 'recording' && ts - lastDraw > 120) { drawLane(S.rec.layer); lastDraw = ts; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

// ---------- recording: into the selected track, from the playhead ----------
$('t-rec').onclick = () => (S.mode === 'recording' ? stopRecord() : startRecord().catch((e) => alert(e.message)));
async function startRecord() {
  if (!S.proj) { $('file').click(); return; }
  if (S.mode === 'playing') pause();
  if (!S.cap) { await openMic(S.deviceId); }
  const ctx = await audio(), layer = active();
  const P = S.playhead, pre = Math.min(2, P), lead = P < 0.05 ? 3 : 0;   // music from 2 s before the punch-in; a count-in from the top
  const t0 = ctx.currentTime + 0.25 + lead;
  startCapture();
  S.session = buildSession(ctx, backing(), trackList(layer, true), mixOpts(), t0, P - pre);
  S.rec = { layer, P, t0, from: P - pre };
  S.t0 = t0; S.startPos = P - pre; S.mode = 'recording';
  $('t-rec').classList.add('live');
  $('rec-hint').textContent = lead ? 'Get ready…' : `Recording into ${layer.name} from ${fmtT(P)} — press Stop (or R) when done`;
  if (lead) {
    let k = lead; $('vcount').textContent = k;
    S.rec.iv = setInterval(() => { k -= 1; $('vcount').textContent = k > 0 ? k : ''; $('rec-hint').textContent = k > 0 ? `${k}…` : `Recording into ${layer.name} — press Stop (or R) when done`; if (k <= 0) clearInterval(S.rec.iv); }, 1000);
  }
  followVideo(() => (S.mode === 'recording' ? curPos() : null));
  setPlayIcon(); loop();
}
async function stopRecord() {
  const r = S.rec; if (!r || S.mode !== 'recording') return;
  const ctx = S.ctx, sr = ctx.sampleRate, stopAt = curPos();
  S.mode = 'idle'; clearInterval(r.iv); $('vcount').textContent = '';
  stopSession(); stopVideo();
  await new Promise((res) => setTimeout(res, 200));
  const { data, first } = endCapture();
  $('t-rec').classList.remove('live');
  $('rec-hint').textContent = 'Recording starts at the playhead and goes into the selected track. Stop, then press Record again to carry on.';
  S.playhead = Math.max(r.P, Math.min(projEnd(), stopAt));
  setPlayIcon();
  if (!data.length || stopAt <= r.P + 0.2) { showPos(); drawAll(); return; }
  // place the take: clocks + the measured delay, refined by the headphone leak when it's audible
  const clockLag = r.t0 - first / sr;
  let lat = latency();
  if (stopAt - r.P > 3) {
    const res = detectSync(data, backingMono().subarray(Math.floor(r.from * S.song.sampleRate)), sr, clockLag + lat);
    const leak = res.lag - clockLag;
    if (res.confidence > 1.6 && leak > -0.05 && leak < 0.6) { lat = leak; setLatency(leak, 'leak'); }
  }
  const l = r.layer;
  const d0 = Math.round((r.from + first / sr - r.t0 - lat) * sr);
  const i0 = Math.max(0, Math.ceil(r.P * sr) - d0, -d0);
  const i1 = Math.min(data.length, Math.round((stopAt - r.from + clockLag) * sr));
  if (i1 > i0) {
    const end = d0 + i1;
    if (end > l.data.length) { const grown = new Float32Array(end); grown.set(l.data); l.data = grown; }
    const fade = Math.round(sr * 0.008);
    for (let i = i0; i < i1; i++) { let v = data[i]; if (i - i0 < fade) v *= (i - i0) / fade; if (i1 - i < fade) v *= (i1 - i) / fade; l.data[d0 + i] = v; }
    const a = d0 + i0, b = d0 + i1;
    l.parts = (l.parts || []).flatMap((p) => (p.b <= a || p.a >= b ? [p] : [...(p.a < a ? [{ a: p.a, b: a }] : []), ...(p.b > b ? [{ a: b, b: p.b }] : [])]));
    l.parts.push({ a, b }); l.parts.sort((x, y) => x.a - y.a);
    l.sr = sr; l.v = layerSeq++; l._clean = l._raw = l._proc = l._pitch = l._gain = null;
    S.proj.mixed = false;
    process(l);
  }
  renderLanes(); showPos(); save(); updateSteps();
}

// sync check: every part of a track against the music; parts that are off are moved
function syncCheck(l, minConf = 1.6, maxMove = 0.35) {
  if (!l.parts || !l.parts.length) return [`${l.name}: nothing recorded yet.`];
  const sr = l.sr, rate = S.song.sampleRate, lines = [];
  let moved = false;
  for (const [k, p] of l.parts.entries()) {
    const label = `Part ${k + 1} (${fmt(p.a / sr)}–${fmt(p.b / sr)})`;
    if ((p.b - p.a) / sr < 3) { lines.push(`${label}: too short to check`); continue; }
    const res = detectSync(l.data.subarray(p.a, p.b), backingMono().subarray(Math.floor((p.a / sr) * rate)), sr, 0, 0.35, 0.35);
    if (res.confidence <= minConf) { lines.push(`${label}: kept (the music wasn't audible in the mic — calibrated sync applies)`); continue; }
    const off = Math.round(res.lag * sr);
    if (Math.abs(res.lag) < 0.012) { lines.push(`${label}: in sync`); continue; }
    if (Math.abs(res.lag) > maxMove) { lines.push(`${label}: kept (unclear — check by ear)`); continue; }
    const copy = l.data.slice(p.a, p.b); l.data.fill(0, p.a, p.b);
    for (let i = 0; i < copy.length; i++) { const j = p.a + i - off; if (j >= 0 && j < l.data.length) l.data[j] = copy[i]; }
    p.a = Math.max(0, p.a - off); p.b = Math.max(p.a, p.b - off);
    lines.push(`${label}: moved ${off > 0 ? 'earlier' : 'later'} by ${Math.abs(Math.round(res.lag * 1000))} ms`);
    moved = true;
  }
  if (moved) { l.v = layerSeq++; l._clean = l._raw = l._proc = l._pitch = null; process(l); save(); }
  return [`<b>${l.name}</b>`, ...lines];
}

// ---------- voice style panel ----------
function showStyle() {
  const has = !!(S.proj && S.song);
  const l = has ? active() : null, fx = l ? l.fx : defaultFx('natural');
  $('style-for').textContent = l ? `— ${l.name}` : '';
  $('styles').innerHTML = STYLE_GRID.map((k) => `<button class="style ${fx.style === k ? 'on' : ''}" data-k="${k}" ${has ? '' : 'disabled'} title="${STYLES[k].hint}">${icon(STYLES[k].icon)}<span>${STYLES[k].name}</span></button>`).join('');
  $('style-hint').innerHTML = l && l._busy ? '<span class="spinner"></span> Applying to your voice…' : STYLES[fx.style].hint;
  $('knobs').innerHTML = KNOBS.map(([k, name, expl]) => `
    <div class="knob k"><div class="knob-h"><b>${name}</b><span id="kv-${k}">${Math.round(fx[k] * 100)}%</span></div>
      <span class="sub">${expl}</span><input type="range" min="0" max="100" value="${Math.round(fx[k] * 100)}" data-knob="${k}" ${has ? '' : 'disabled'}></div>`).join('');
  $('styles').querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => setStyle(active(), b.dataset.k)));
  $('knobs').querySelectorAll('[data-knob]').forEach((inp) => {
    const k = inp.dataset.knob;
    inp.oninput = () => { const l2 = active(); l2.fx[k] = +inp.value / 100; $(`kv-${k}`).textContent = `${inp.value}%`; if (k !== 'tune') replay(); };
    inp.onchange = () => { const l2 = active(); if (k === 'tune') process(l2, 300); S.proj.mixed = false; save(); };
  });
  $('l-key').innerHTML = `<option value="">Auto${S.key ? ' — ' + keyName(S.key) : ' (detecting…)'}</option>` + allKeys().map((k) => `<option value="${k.tonic}:${k.mode}">${keyName(k)}</option>`).join('');
  $('l-key').value = (S.proj && S.proj.settings.key) || '';
  $('key-row').classList.toggle('hidden', !l || fx.tune < 0.01);
  $('magic').disabled = !(S.proj && S.proj.layers.some((x) => x.data.length));
  $('style-reset').disabled = $('style-all').disabled = !has;
}
function setStyle(l, k) {
  l.fx = defaultFx(k); S.proj.mixed = false;
  showStyle(); renderLanes(); process(l); save();
}
$('l-key').onchange = (e) => { S.proj.settings.key = e.target.value; S.proj.layers.forEach((l) => l.fx.tune > 0.01 && process(l)); save(); };
$('style-reset').onclick = () => S.proj && setStyle(active(), 'natural');
$('style-all').onclick = () => {
  if (!S.proj) return;
  const fx = active().fx;
  S.proj.layers.forEach((l, i) => { if (l !== active()) { l.fx = { ...fx }; if (i > 0 && fx.double < 0.3) l.fx.double = 0.3; process(l); } });
  renderLanes(); save(); toast(`${STYLES[fx.style].name} on every track.`, 2500);
};

// ---------- make it a song (auto mix) ----------
function loud(buf) {
  // loudness of the busy parts (top 30% of 50 ms windows), both channels
  const sr = buf.sampleRate, w = Math.floor(sr * 0.05), vals = [];
  const chs = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  for (let i = 0; i + w < buf.length; i += w) { let s = 0; for (const d of chs) for (let k = i; k < i + w; k += 4) s += d[k] * d[k]; vals.push(s / (w / 4) / chs.length); }
  vals.sort((a, b) => b - a);
  const top = vals.slice(0, Math.max(1, Math.floor(vals.length * 0.3)));
  return 10 * Math.log10(top.reduce((a, b) => a + b, 0) / top.length + 1e-12);
}
$('magic').onclick = async () => {
  if (!S.proj || S.mode !== 'idle') return;
  const btn = $('magic'), note = $('magic-note'), old = btn.innerHTML;
  const vox = S.proj.layers.filter((l) => l.data.length && !l.mute);
  if (!vox.length) return toast('Record something first — then this button turns it into a song.');
  btn.disabled = true;
  const step = async (t) => { btn.innerHTML = `<span class="spinner"></span> ${t}`; await new Promise((r) => setTimeout(r, 30)); };
  try {
    // 1. a style on every track (the lead's, or Modern Pop if nothing was chosen); noise cleaned
    const lead = vox[0], styleKey = lead.fx.style === 'natural' ? 'pop' : lead.fx.style;
    await step('Choosing the sound…');
    vox.forEach((l, i) => {
      if (l.fx.style === 'natural') l.fx = defaultFx(styleKey);
      if (i > 0) l.fx.double = Math.max(l.fx.double, 0.3);          // harmonies sit wider
      l.clean = true; l.mixDb = 0;
    });
    // 2. sync check on every part
    await step('Checking sync…');
    const syncLines = vox.map((l) => syncCheck(l, 3, 0.15).slice(1).filter((x) => /moved/.test(x)).length);   // automatic: only on strong evidence
    await step('Cleaning and tuning…');
    await Promise.all(vox.map((l) => process(l, 0)));
    // 3. levels: the lead about 2 dB over the music, harmonies 5 dB under the lead
    await step('Balancing your voice and the music…');
    const vocalsOnly = await renderSession(backing(), [{ buf: layerBuf(lead), gain: (lead.vol / 100) * autoGain(lead), shift: lead.shift / 1000, fx: lead.fx }], { ...mixOpts(), songGain: 0 }, 0.2, false);
    const musicOnly = await renderSession(backing(), [], { ...mixOpts(), songGain: 1 }, 0.2, false);
    const lv = loud(vocalsOnly), lm = loud(musicOnly);
    const sng = Math.max(25, Math.min(150, Math.round(100 * Math.pow(10, (lv - 2 - lm) / 20))));
    S.proj.settings.sng = sng;
    vox.forEach((l, i) => { l.mixDb = i === 0 ? 0 : -5; });
    S.proj.mixed = true;
    showGuide(); renderLanes(); showStyle(); save(); updateSteps();
    const moved = syncLines.reduce((a, b) => a + b, 0);
    note.className = 'note ok'; note.classList.remove('hidden');
    note.innerHTML = `<b>Done.</b> ${STYLES[vox[0].fx.style].name} on ${vox.length > 1 ? 'all ' + vox.length + ' tracks' : 'your voice'} · noise cleaned · music set to ${sng}% so your voice sits on top · ${moved ? moved + ' part' + (moved > 1 ? 's' : '') + ' re-synced' : 'sync checked'}. Press Play to hear it, then Export song.`;
    flash($('open-export'));
  } catch (e) { toast('Auto mix failed: ' + e.message); }
  finally { btn.disabled = false; btn.innerHTML = old; }
};

// ---------- timeline drawing ----------
function peaks(data, sr, W, pps, offset = 0) {
  const out = new Float32Array(W), step = Math.max(1, Math.floor(sr / pps / 40));
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x / pps - offset) * sr), b = Math.floor(((x + 1) / pps - offset) * sr);
    let m = 0;
    for (let i = Math.max(0, a); i < Math.min(data.length, b); i += step) m = Math.max(m, Math.abs(data[i]));
    out[x] = m;
  }
  return out;
}
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function fitCanvas(c) {
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 300, h = c.clientHeight || 80;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function wave(g, pk, h, color) {
  g.fillStyle = color;
  const mid = h / 2;
  for (let x = 0; x < pk.length; x++) { const a = Math.min(1, pk[x] * 1.7) * (h / 2 - 6); if (a > 0.4) g.fillRect(x, mid - a, 1, a * 2); }
}
let musicPeaks = null, musicKey = '';
function drawLane(id) {
  const lane = typeof id === 'object' ? id : id;
  const c = $('lanes').querySelector(`canvas[data-lane="${typeof lane === 'object' ? lane.id : lane}"]`); if (!c || !S.song) return;
  const { g, w, h } = fitCanvas(c), end = projEnd(), pps = w / end;
  if (lane === 'music') {
    const k = `${w}|${end}|${!!S.inst}`;
    if (!musicPeaks || musicKey !== k) { musicPeaks = peaks(backingMono(), S.song.sampleRate, Math.round(w), pps); musicKey = k; }
    wave(g, musicPeaks, h, cssVar('--music'));
    return;
  }
  const l = lane, i = S.proj.layers.indexOf(l);
  const k = `${l.v}|${w}|${end}|${l.shift}`;
  if (!l._peaks || l._peaksKey !== k) { l._peaks = peaks(l.data, l.sr, Math.round(w), pps, l.shift / 1000); l._peaksKey = k; }
  g.globalAlpha = l.mute ? 0.3 : 1;
  wave(g, l._peaks, h, cssVar(laneColor(i)));
  g.globalAlpha = 1;
  if (!l.data.length) { g.fillStyle = cssVar('--faint'); g.font = '12.5px Inter, sans-serif'; g.fillText(l.id === S.activeId ? 'Empty — press Record to sing into this track' : 'Empty', 12, h / 2 + 4); }
  if (S.mode === 'recording' && S.rec && S.rec.layer === l) {
    g.fillStyle = 'rgba(255,80,80,.22)'; g.fillRect(S.rec.P * pps, 4, Math.max(0, (S.playhead - S.rec.P) * pps), h - 8);
  }
}
function drawRuler() {
  const c = $('ruler'); if (!S.song) { fitCanvas(c); return; }
  const { g, w, h } = fitCanvas(c), end = projEnd(), pps = w / end;
  g.fillStyle = cssVar('--faint'); g.font = '11px ui-monospace, Menlo, monospace';
  const stepS = end > 240 ? 30 : end > 90 ? 15 : end > 30 ? 10 : 5;
  for (let t = 0; t <= end; t += stepS) { const x = t * pps; g.fillRect(x, h - 8, 1, 8); if (x < w - 30) g.fillText(fmt(t), x + 4, 14); }
  for (let t = 0; t <= end; t += stepS / 5) g.fillRect(t * pps, h - 4, 1, 4);
}
function placePlayhead() {
  const ph = $('playhead'), c = $('ruler');
  if (!S.song || !S.proj) { ph.classList.add('hidden'); return; }
  const card = $('tracks-card').getBoundingClientRect(), r = c.getBoundingClientRect();
  const x = r.left - card.left + (S.playhead / projEnd()) * r.width;
  const lanes = $('lanes').getBoundingClientRect();
  ph.classList.remove('hidden');
  ph.style.left = `${x - 1}px`; ph.style.top = `${r.top - card.top}px`; ph.style.height = `${lanes.bottom - r.top}px`;
}
function drawAll() {
  drawRuler();
  if (S.song && S.proj) { drawLane('music'); S.proj.layers.forEach((l) => drawLane(l)); }
  placePlayhead();
}
function attachSeek(c) {
  let drag = false;
  const at = (e) => { const r = c.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * projEnd(); };
  c.onpointerdown = (e) => {
    if (S.mode === 'recording' || !S.song) return;
    drag = true; c.setPointerCapture(e.pointerId);
    const id = c.dataset.lane;
    if (id && id !== 'music' && +id !== S.activeId) { S.activeId = +id; renderLanes(); showStyle(); }
    seek(at(e));
  };
  c.onpointermove = (e) => { if (drag && S.mode !== 'recording') { S.playhead = Math.max(0, Math.min(projEnd(), at(e))); showPos(); } };
  c.onpointerup = (e) => { if (drag) { drag = false; seek(at(e)); } };
}
attachSeek($('ruler'));
window.addEventListener('resize', () => { musicPeaks = null; drawAll(); });

// ---------- export ----------
const base = () => `${(S.songName || 'karaoke').replace(/\.[^.]+$/, '')} - ${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}`;
async function share(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iphone|ipad|android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function busy(btn, label, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<b><span class="spinner"></span> ${label}</b>`;
  try { await fn(); } catch (e) { alert(e.message); } finally { btn.disabled = false; btn.innerHTML = old; }
}
$('open-export').onclick = () => {
  if (!S.proj) return;
  const vox = S.proj.layers.filter((l) => l.data.length && !l.mute);
  $('export-sum').textContent = `${vox.length} vocal track${vox.length > 1 ? 's' : ''} · ${vox.map((l) => STYLES[l.fx.style].name).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · ${fmt(projEnd())}` + (S.proj.mixed ? ' · auto-mixed' : ' — tip: press "Make it a song" first');
  openPanel('dialog-export');
};
$('exp-mp3').onclick = (e) => busy(e.currentTarget, 'Mixing…', async () => share(await mp3(await renderSession(backing(), trackList(), mixOpts())), `${base()}.mp3`));
$('exp-wav').onclick = (e) => busy(e.currentTarget, 'Mixing…', async () => share(wav(await renderSession(backing(), trackList(), mixOpts())), `${base()}.wav`));
$('exp-voc').onclick = (e) => busy(e.currentTarget, 'Rendering…', async () => share(wav(await renderSession(backing(), trackList().filter((t) => !t.raw), { ...mixOpts(), songGain: 0 })), `${base()} - vocals.wav`));
async function exportTrack(l) {
  if (!l.data.length) return toast('This track is empty.');
  toast(`Rendering ${l.name}…`, 2000);
  share(wav(await renderSession(backing(), [{ buf: layerBuf(l), gain: (l.vol / 100) * autoGain(l), shift: l.shift / 1000, fx: l.fx }], { ...mixOpts(), songGain: 0 })), `${base()} - ${l.name}.wav`);
}

// ---------- projects ----------
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const p = S.proj; if (!p) return;
    const rec = { ...p, updated: Date.now(), layers: p.layers.map((l) => ({ id: l.id, name: l.name, sr: l.sr, vol: l.vol, shift: l.shift, mute: l.mute, clean: l.clean, fx: l.fx, mixDb: l.mixDb || 0, parts: l.parts || [], data: l.data.buffer.slice(0) })) };
    await store('projects', 'readwrite', (s) => s.put(rec)).catch(() => {});
    listProjects();
  }, 600);
}
function migrate(l, i) {
  // projects from earlier versions: autotune/tune settings become the new voice style
  const fx = l.fx || defaultFx('natural');
  if (!l.fx && l.tune && l.tune.on) fx.tune = (l.tune.str ?? 80) / 100;
  return { ...l, name: l.name && !/^Vocal \d$/.test(l.name) ? l.name : TRACK_NAMES[i] || l.name, fx, clean: l.clean !== false };
}
async function openProject(rec) {
  if (S.mode !== 'idle') return;
  closePanels();
  await audio();
  if (rec.songKey !== S.songKey) {
    const s = await store('songs', 'readonly', (st) => st.get(rec.songKey));
    if (!s) { alert('The song for this project is no longer on this device.'); return; }
    if (!(await loadSong(s.blob, s.name))) return;
  }
  S.proj = { ...rec, settings: { sng: 80, guide: 100, guidePlay: false, ...rec.settings }, layers: rec.layers.map((l, i) => {
    const data = new Float32Array(l.data);
    return { ...migrate(l, i), data, parts: l.parts && l.parts.length ? l.parts : data.length ? [{ a: 0, b: data.length }] : [], v: layerSeq++ };
  }) };
  S.activeId = S.proj.layers[0].id;
  openStudio();
  S.proj.layers.forEach((l) => process(l));
}
async function listProjects() {
  const all = ((await store('projects', 'readonly', (s) => s.getAll()).catch(() => [])) || []).sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
  const el = $('projects');
  // the studio's project menu (the same one as the video editor and the Reader) lists them too
  const pk = $('kb-proj');
  if (pk) {
    const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    pk.innerHTML = '<option value="">—</option>' + all.map((p) => `<option value="${p.id}" data-del="1" data-sub="${p.layers.length} track${p.layers.length > 1 ? 's' : ''}"
      data-meta="${new Date(p.updated || p.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}">${esc((p.songName || 'Song').replace(/\.[^.]+$/, ''))}</option>`).join('');
    pk.value = S.proj ? String(S.proj.id) : '';
    pk.onchange = () => { const rec = all.find((x) => String(x.id) === pk.value); if (rec && (!S.proj || S.proj.id !== rec.id)) openProject(rec); };
    pk.onstudiodelete = null;
  }
  if (!all.length) { el.innerHTML = '<div class="sub" style="padding:12px 0">No projects yet — choose a song to start one.</div>'; return; }
  el.innerHTML = all.map((p) => `<div class="proj"><div class="grow"><b>${(p.songName || '').replace(/\.[^.]+$/, '')}</b>
    <span class="sub">${new Date(p.updated || p.created).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })} · ${p.layers.length} track${p.layers.length > 1 ? 's' : ''}</span></div>
    <button class="chip" data-open="${p.id}">Open</button><button class="chip" data-del="${p.id}" title="Delete">✕</button></div>`).join('');
  el.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openProject(all.find((x) => x.id === +b.dataset.open))));
  el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this project and all its tracks?')) return;
    await store('projects', 'readwrite', (s) => s.delete(+b.dataset.del));
    if (S.proj && S.proj.id === +b.dataset.del) { S.proj = null; renderLanes(); showStyle(); updateSteps(); }
    listProjects();
  }));
}
$('open-projects').onclick = () => { listProjects(); openPanel('drawer-projects'); };
$('kb-proj')?.addEventListener('studio-delete', async (e) => {  // the menu's ✕
  if (!confirm('Delete this project and all its tracks?')) return;
  const id = +e.detail.value;
  await store('projects', 'readwrite', (s) => s.delete(id));
  if (S.proj && S.proj.id === id) { S.proj = null; renderLanes(); showStyle(); updateSteps(); }
  listProjects();
});
listProjects();  // fills the studio's project menu on load

// ---------- keys ----------
window.addEventListener('keydown', (e) => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') return closePanels();
  if (!S.proj) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); $('t-play').click(); }
  else if (k === 'r') { e.preventDefault(); $('t-rec').click(); }
  else if (k === 'home') { e.preventDefault(); $('t-start').click(); }
  else if (k === 'arrowleft') { e.preventDefault(); $('t-back').click(); }
  else if (k === 'arrowright') { e.preventDefault(); $('t-fwd').click(); }
  else if (k === 'n') { e.preventDefault(); $('add-layer').click(); }
});

// ---------- start ----------
if (location.port === '4747') $('app-editor').href = '/';
renderLanes(); showStyle(); updateSteps(); listProjects(); placePlayhead();
