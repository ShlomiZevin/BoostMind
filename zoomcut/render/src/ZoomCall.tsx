import React from 'react';
import { AbsoluteFill, Audio, continueRender, delayRender, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';

type Rect = { x: number; y: number; w: number; h: number; small?: boolean };
type Seg = { from: number; dur: number; clip: string; at: number; fade?: number };
type Clip = { src: string; preview?: string; fg?: string; w: number; h: number; char?: string; framing: { cx: number; top?: number; hw?: number; cy?: number; fh?: number; found: boolean } };
// a character's background as a layer: the photo (its size), pan x / y (-0.5..0.5) and zoom - placed by bgBox
type Bg = { image: string; w: number; h: number; x?: number; y?: number; zoom?: number };
type Look = { saturate?: number; contrast?: number; brightness?: number };
type Frame = { zoom?: number; y?: number; x?: number };
export type EditProps = {
  fps: number; width: number; height: number; durationInFrames: number;
  title: string; timerStart: number; subtitles: boolean; accent?: string; ui?: Record<string, string>;
  mediaBase?: string; audioSrc?: string;
  uiOnly?: boolean;  // fast export: draw only the interface, transparent where the videos go (ffmpeg fills them in)  // review screen only: where clips live, preview dialogue
  participants: { id: string; name: string; role: string; look?: Look | null; frame?: Frame | null; bg?: Bg | null; voice?: { volume?: number } | null }[];
  voices?: { id: string; src: string }[];  // one track per character (+ _sfx) - the editor plays them as layers
  clips: Record<string, Clip>;
  tiles: Record<string, Seg[]>;
  shots: { from: number; dur: number; layout: string; order: string[] }[];
  active: { from: number; dur: number; id: string }[];
  captions: { from: number; dur: number; name: string; text: string; side?: boolean; id?: string }[];
  events: { at: number; type: string; id: string; name: string }[];
  overlays?: { text: string; style: string; from: number; dur: number; font?: string; theme?: string; opacity?: number; y?: number | null; size?: number;
    image?: string; x?: number | null; w?: number; fade_in?: number }[];  // style 'image': a picture layer (an end card), x / y = its centre
  fonts?: { id: string; family: string; url: string; weight: number }[];
};

// ---- vertical Zoom geometry (1080×1920) --------------------------------------------
const TOP = 150;            // top bar
const POV_TOP = 300;        // stage starts lower when a POV caption sits between the bar and the tiles
const BAR = 1752;           // toolbar starts
const PAD = 16, GAP = 12;
const SW = 1080 - PAD * 2;
let ACCENT = '#2BD45E';     // Zoom active-speaker green (preset can override)
const FONT = '"Segoe UI", "Arial", sans-serif';

function layout(name: string, order: string[], TOP: number): Record<string, Rect> {
  const SH = BAR - TOP - 22;
  const r: Record<string, Rect> = {};
  const n = order.length;
  if (n === 1 || (name === 'speaker' && n === 1)) {
    r[order[0]] = { x: PAD, y: TOP, w: SW, h: SH };
  } else if (name === 'gallery' && n >= 3) {
    // Zoom's phone gallery: two columns (the first on the right), an odd last tile centred
    const rows = Math.ceil(n / 2), w = (SW - GAP) / 2, h = (SH - GAP * (rows - 1)) / rows;
    order.forEach((id, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const x = n % 2 && i === n - 1 ? PAD + (SW - w) / 2 : PAD + SW - (col + 1) * w - col * GAP;
      r[id] = { x, y: TOP + row * (h + GAP), w, h };
    });
  } else if (name === 'gallery' || (name === 'duo' && n === 2)) {
    const h = (SH - GAP * (n - 1)) / n;
    order.forEach((id, i) => (r[id] = { x: PAD, y: TOP + i * (h + GAP), w: SW, h }));
  } else if (name === 'duo') {
    const h = (SH - GAP) / 2;
    r[order[0]] = { x: PAD, y: TOP, w: SW, h };
    r[order[1]] = { x: PAD, y: TOP + h + GAP, w: SW, h };
    const pw = 270, ph = 360;
    r[order[2]] = { x: PAD + 22, y: TOP + SH - ph - 22, w: pw, h: ph, small: true };
  } else {
    // speaker: big tile + a strip of the others underneath
    const sh = TOP > 200 ? 380 : 430;
    const mh = SH - sh - GAP;
    r[order[0]] = { x: PAD, y: TOP, w: SW, h: mh };
    const rest = order.slice(1);
    const w = (SW - GAP * (rest.length - 1)) / rest.length;
    rest.forEach((id, i) => (r[id] = { x: PAD + SW - (i + 1) * w - i * GAP, y: TOP + mh + GAP, w, h: sh, small: true }));
  }
  return r;
}

// Frame the person: head top a little below the tile edge, head centred. Framing comes from the
// segmentation silhouette (robust to wigs, hats, face filters); a character can nudge it (frame.y, frame.zoom).
function videoBox(c: Clip, t: Rect, fr?: Frame | null) {
  const base = Math.max(t.w / c.w, t.h / c.h);
  const s = base * Math.max(1, fr?.zoom ?? 1);
  const vw = c.w * s, vh = c.h * s;
  const fx = c.framing.cx ?? 0.5;
  const headTop = c.framing.top ?? Math.max(0, (c.framing.cy ?? 0.4) - (c.framing.fh ?? 0.3) * 0.7);
  let left = t.w / 2 - fx * vw + (fr?.x ?? 0) * t.w;
  let top = t.h * ((t.small ? 0.06 : 0.09) + (fr?.y ?? 0)) - headTop * vh;
  left = Math.min(0, Math.max(t.w - vw, left));
  top = Math.min(0, Math.max(t.h - vh, top));
  return { left, top, width: vw, height: vh };
}

// where the photo sits inside the person's video box: cover, then pan and zoom (= pipeline/background.py bg_box)
export function bgBox(bg: Bg, vw: number, vh: number) {
  const s = Math.max(vw / bg.w, vh / bg.h) * Math.max(1, bg.zoom ?? 1);
  const sw = bg.w * s, sh = bg.h * s;
  return { left: (vw - sw) * (0.5 + (bg.x ?? 0)), top: (vh - sh) * (0.5 + (bg.y ?? 0)), width: sw, height: sh };
}

const lookFilter = (l?: Look | null) =>
  l ? `saturate(${l.saturate ?? 1}) contrast(${l.contrast ?? 1}) brightness(${l.brightness ?? 1})` : undefined;

// a listening tile that has to change source dissolves for a few frames instead of jumping
const FadeIn: React.FC<{ frames?: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  const o = frames ? interpolate(f, [0, frames], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  return <div style={{ position: 'absolute', inset: 0, opacity: o }}>{children}</div>;
};

const Mic: React.FC<{ on: boolean; size?: number }> = ({ on, size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? '#fff' : '#ff4b4b'} />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke={on ? '#fff' : '#ff4b4b'} strokeWidth="1.8" strokeLinecap="round" />
    {!on && <path d="M4 4l16 16" stroke="#ff4b4b" strokeWidth="2" strokeLinecap="round" />}
  </svg>
);

const Tile: React.FC<{ p: EditProps; id: string; name: string; rect: Rect; active: boolean; leaving?: number }> = ({ p, id, name, rect, active, leaving }) => {
  const segs = p.tiles[id] || [];
  const part = p.participants.find((x) => x.id === id);
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 14,
      overflow: 'hidden', background: p.uiOnly ? 'transparent' : '#232323', boxShadow: rect.small && !p.uiOnly ? '0 6px 18px rgba(0,0,0,0.55)' : undefined }}>
      {!p.uiOnly && segs.map((s, i) => {
        const c = p.clips[s.clip];
        if (!c) return null;
        const b = videoBox(c, rect, part?.frame);
        const bg = part?.bg && c.fg ? part.bg : null;
        const url = (rel: string) => (p.mediaBase ? p.mediaBase + rel : staticFile(rel));
        return (
          <Sequence key={i} from={s.from} durationInFrames={s.dur} premountFor={45}>
            <FadeIn frames={s.fade}>
              {bg ? (
                <div style={{ position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, overflow: 'hidden', filter: lookFilter(part?.look) }}>
                  {(() => { const g = bgBox(bg, b.width, b.height);
                    return <Img src={url(bg.image)} style={{ position: 'absolute', left: g.left, top: g.top, width: g.width, height: g.height, maxWidth: 'none' }} />; })()}
                  <OffthreadVideo src={url(c.fg!)} transparent startFrom={Math.round(s.at * p.fps)} muted
                    style={{ position: 'absolute', left: 0, top: 0, width: b.width, height: b.height, maxWidth: 'none' }} />
                </div>
              ) : (
                <OffthreadVideo src={p.mediaBase ? p.mediaBase + (c.preview || c.src) : staticFile(c.src)} startFrom={Math.round(s.at * p.fps)} muted
                  style={{ position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, maxWidth: 'none',
                    filter: lookFilter(part?.look) }} />
              )}
            </FadeIn>
          </Sequence>
        );
      })}
      <div style={{ position: 'absolute', right: 14, bottom: 14, display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: rect.small ? '4px 12px 4px 10px' : '6px 16px 6px 12px',
        direction: 'rtl', color: '#fff', fontFamily: FONT, fontSize: rect.small ? 26 : 32, fontWeight: 500 }}>
        <Mic on size={rect.small ? 24 : 30} />
        <span>{name}</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: active ? `5px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)' }} />
      {leaving !== undefined && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: '6px solid #ff3b3b', background: `rgba(160,0,0,${0.25 + 0.3 * leaving})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#e02828', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: rect.small ? 34 : 64, padding: '10px 28px',
            borderRadius: 12, direction: 'rtl', transform: `scale(${0.9 + 0.1 * leaving})` }}>הוסר מהפגישה</div>
        </div>
      )}
    </div>
  );
};

const Icon: React.FC<{ d: React.ReactNode; label: string; color?: string; badge?: number }> = ({ d, label, color = '#fff', badge }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 170, position: 'relative' }}>
    <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
    {badge !== undefined && <div style={{ position: 'absolute', top: -6, left: 104, fontSize: 24, color: '#fff', fontWeight: 600 }}>{badge}</div>}
    <div style={{ color: '#d0d0d0', fontSize: 25 }}>{label}</div>
  </div>
);

// load the overlay fonts before the first frame is captured
const loaded = new Set<string>();
function useFonts(p: EditProps) {
  const [handle] = React.useState(() => ((p.fonts || []).some((f) => !loaded.has(f.family)) ? delayRender('fonts') : null));
  React.useEffect(() => {
    const todo = (p.fonts || []).filter((f) => !loaded.has(f.family));
    Promise.all(todo.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url(${p.mediaBase ? p.mediaBase + f.url : staticFile(f.url)})`, { weight: '100 900' });
        await face.load();
        (document as any).fonts.add(face);
        loaded.add(f.family);
      } catch { /* a missing font falls back to the UI font */ }
    })).finally(() => handle !== null && continueRender(handle));
  }, []);
}

// one look for "text on video" in every template (the editor draws the same box live):
// light = white box / black text, dark = black box / white text, gold = yellow text in a black outline (religious look)
export const ovBoxStyle = (o: { theme?: string; opacity?: number; size?: number }, font: React.CSSProperties): React.CSSProperties => {
  const op = o.opacity ?? 1, size = o.size || 46, gold = o.theme === 'gold';
  return {
    background: o.theme === 'light' || !o.theme ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`,
    color: gold ? '#FFD60A' : o.theme === 'dark' ? '#fff' : '#000', fontSize: size, lineHeight: 1.25, padding: `${(o as any).padY ?? 12}px ${(o as any).padX ?? 24}px`,
    borderRadius: 14, direction: 'rtl', textAlign: 'center', maxWidth: 940, letterSpacing: gold ? '0.045em' : undefined, whiteSpace: 'pre-line', ...font,
    ...(gold ? { WebkitTextStroke: `${Math.round(size * 0.17)}px #000`, paintOrder: 'stroke fill' } as any : {}),
    textShadow: op < 0.6 ? (o.theme === 'light' || !o.theme ? '0 1px 4px rgba(255,255,255,0.7)' : '0 2px 6px rgba(0,0,0,0.8)') : undefined,
  };
};

export const OV_FONT = (p: { fonts?: any[] }, id?: string) => {
  const f = (p.fonts || []).find((x) => x.id === id);
  return f ? { fontFamily: `"${f.family}", ${FONT}`, fontWeight: f.weight >= 600 ? 800 : 400 } : { fontFamily: FONT, fontWeight: 700 };
};

export const ZoomCall: React.FC<EditProps> = (p) => {
  const frame = useCurrentFrame();
  useFonts(p);
  ACCENT = p.accent || ACCENT;
  const t = (k: string, d: string) => (p.ui && p.ui[k]) || d;
  const shot = p.shots.find((s) => frame >= s.from && frame < s.from + s.dur) || p.shots[p.shots.length - 1];
  // the POV band: a top caption that sits between the Zoom bar and the tiles pushes the call down
  const POV_Y = 270;  // below the app's own header (Reels / TikTok tabs cover the top ~250px)
  const ovY = (o: { style: string; y?: number | null }, i: number) => o.y ?? (o.style === 'label' ? 1180 : POV_Y + i * 150);
  const hasPov = (p.overlays || []).some((o, i) => o.style === 'pov' && ovY(o, i) < POV_TOP - 40);
  const rects = shot ? layout(shot.layout, shot.order, hasPov ? POV_TOP : TOP) : {};
  const activeId = p.active.find((a) => frame >= a.from && frame < a.from + a.dur)?.id;
  const removed = p.events.filter((e) => e.type === 'remove' && frame >= e.at);
  const count = p.participants.length - removed.length;
  const secs = p.timerStart + Math.floor(frame / p.fps);
  const timer = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const cap = p.subtitles ? p.captions.find((c) => !c.side && frame >= c.from && frame < c.from + c.dur) : undefined;
  const side = p.subtitles ? p.captions.find((c) => c.side && frame >= c.from && frame < c.from + c.dur) : undefined;  // said on the side
  const TOAST = Math.round(3.5 * p.fps);
  const LEAVE = Math.round(0.5 * p.fps); // the removed tile flashes red before it disappears
  const toast = p.events.find((e) => e.type === 'remove' && frame >= e.at && frame < e.at + TOAST);
  // the removal notice goes under the POV box, however many lines the POV wraps to (~36 chars a line at 46px)
  const povBottom = Math.max(0, ...(p.overlays || []).filter((o, i) => frame >= o.from && frame < o.from + o.dur && ovY(o, i) < POV_TOP)
    .map((o, i) => ovY(o, i) + Math.ceil(o.text.length / 36) * 58 + 24));
  const toastTop = Math.max((hasPov ? POV_TOP : TOP) + 40, povBottom + 28);
  // small tiles are drawn last so a floating pip sits on top
  const ids = Object.keys(rects).sort((a, b) => Number(!!rects[a].small) - Number(!!rects[b].small));

  return (
    <AbsoluteFill style={{ background: p.uiOnly ? 'transparent' : '#0b0b0b', fontFamily: FONT, direction: 'rtl' }}>
      {/* voices are layers: one track per character at his volume (live); else the single mixed dialogue */}
      {p.voices && p.mediaBase
        ? p.voices.map((v) => <Audio key={v.id} src={p.mediaBase + v.src}
            volume={Math.min(1, Math.max(0, p.participants.find((x) => x.id === v.id)?.voice?.volume ?? 1))} />)
        : p.audioSrc && <Audio src={p.audioSrc} />}
      {/* top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP - 14, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '24px 30px 0', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 30, fontWeight: 600 }}>
          <svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" fill={ACCENT} /></svg>
          <span>{t('app', 'Zoom')}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 600, direction: 'rtl' }}>{p.title}</div>
          <div style={{ fontSize: 24, color: '#a8a8a8', marginTop: 4, direction: 'ltr' }}>{timer}</div>
        </div>
        <div style={{ background: '#e02828', color: '#fff', fontSize: 28, fontWeight: 600, borderRadius: 10, padding: '10px 26px' }}>{t('end', 'סיום')}</div>
      </div>
      <div style={{ position: 'absolute', top: TOP - 16, right: 30, display: 'flex', alignItems: 'center', gap: 8,
        color: '#e0e0e0', fontSize: 22, zIndex: 5, transform: 'translateY(-50%)', opacity: 0.85 }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: '#ff3b3b' }} />
        <span>{t('recording', 'מקליט...')}</span>
      </div>

      {ids.map((id) => {
        const part = p.participants.find((x) => x.id === id);
        if (!part) return null;
        const ev = p.events.find((e) => e.type === 'remove' && e.id === id && frame < e.at && frame >= e.at - LEAVE);
        return <Tile key={id} p={p} id={id} name={part.name} rect={rects[id]} active={activeId === id && !ev}
          leaving={ev ? (frame - (ev.at - LEAVE)) / LEAVE : undefined} />;
      })}

      {(cap || side) && (() => {
        // subtitles live inside the main (big) tile, above its name tag - the thumbnails underneath stay clear, so the
        // others' reactions are always seen. Something said on the side sits on top of the main subtitle.
        const big = Object.values(rects).filter((r) => !r.small).sort((a, b) => b.w * b.h - a.w * a.h);
        const own = cap?.id && rects[cap.id] && !rects[cap.id].small ? rects[cap.id] : null;
        const r = shot?.layout === 'gallery' ? own : big[0] || own;
        const narrow = !!r && r.w < 600;
        const pos = r ? { left: r.x + 20, right: 1080 - (r.x + r.w) + 20, bottom: 1920 - (r.y + r.h) + (narrow ? 64 : 84) }
          : { left: 70, right: 70, bottom: 1920 - BAR + 96 };
        const fs = narrow ? 32 : 46;
        return (
          <div style={{ position: 'absolute', ...pos, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 10 }}>
            {side && <div style={{ background: 'rgba(14,14,14,0.88)', borderRadius: 12, padding: narrow ? '8px 14px' : '14px 26px', color: '#ffc94d',
              fontSize: fs, lineHeight: 1.3, fontWeight: 600, direction: 'rtl', textAlign: 'right', maxWidth: 900, border: '1px solid rgba(255,201,77,0.35)' }}>
              <span style={{ color: '#d9a93a', fontWeight: 700 }}>{side.name}: </span>{side.text}
            </div>}
            {cap && <div style={{ background: 'rgba(18,18,18,0.86)', borderRadius: 12, padding: narrow ? '10px 16px' : '16px 28px', color: '#fff', fontSize: fs,
              lineHeight: 1.3, fontWeight: 500, direction: 'rtl', textAlign: 'right', maxWidth: 900 }}>
              <span style={{ color: '#b9b9b9', fontWeight: 600 }}>{cap.name}: </span>{cap.text}
            </div>}
          </div>
        );
      })()}

      {toast && (
        <div style={{ position: 'absolute', top: toastTop, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 40,
          opacity: interpolate(frame - toast.at, [0, 4, TOAST - 10, TOAST], [0, 1, 1, 0], { extrapolateRight: 'clamp' }) }}>
          <div style={{ background: 'rgba(30,30,30,0.96)', color: '#fff', borderRadius: 16, padding: '24px 34px', fontSize: 44, fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.14)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: 18,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#ff5a5a" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5M16 9l5 5M21 9l-5 5" /></svg>
            {t('removed', 'המארח הסיר את {name} מהפגישה').replace('{name}', toast.name)}
          </div>
        </div>
      )}

      {/* TikTok-native text: POV hook / labels, above everything, clear of TikTok's own top UI */}
      {/* image layers (an end card): over everything, also in the interface-only export pass */}
      {(p.overlays || []).filter((o) => o.style === 'image' && o.image && frame >= o.from && frame < o.from + o.dur).map((o, i) => (
        <Img key={'img' + i} src={p.mediaBase ? p.mediaBase + o.image : staticFile(o.image!)}
          style={{ position: 'absolute', zIndex: 40, width: o.w || 960, left: (o.x ?? 540) - (o.w || 960) / 2, top: o.y ?? 960,
            transform: 'translateY(-50%)', opacity: interpolate(frame - o.from, [0, Math.max(1, (o.fade_in ?? 0.3) * p.fps)], [0, o.opacity ?? 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
      ))}

      {(p.overlays || []).filter((o) => o.style !== 'image' && frame >= o.from && frame < o.from + o.dur).map((o, i) => (
        <div key={i} style={{ position: 'absolute', top: ovY(o, i), left: 60, right: 60,
          display: 'flex', justifyContent: 'center', zIndex: 30 }}>
          <div style={ovBoxStyle(o, OV_FONT(p, o.font))}>
            {o.text}
          </div>
        </div>
      ))}

      {/* toolbar */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAR, bottom: 0, background: '#161616', borderTop: '1px solid #262626',
        display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 22 }}>
        <Icon label={t('mute', 'השתקה')} d={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></>} />
        <Icon label={t('video', 'עצירת וידאו')} d={<><rect x="3" y="7" width="12" height="10" rx="2" /><path d="M15 11l6-3v8l-6-3" /></>} />
        <Icon label={t('share', 'שיתוף')} color={ACCENT} d={<><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M12 15V9M9 11.5L12 9l3 2.5" /></>} />
        <Icon label={t('participants', 'משתתפים')} badge={count} d={<><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2 .2 3.7 1.5 4.4 4" /></>} />
        <Icon label={t('more', 'עוד')} d={<><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>} />
      </div>
    </AbsoluteFill>
  );
};
