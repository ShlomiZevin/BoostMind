// Text styles from the one-camera engine, for every project (spread into TEXT_STYLES by styles.tsx). Each draws from the
// item and t (seconds since the item began) only - so the editor and the export (which renders the same frames) agree.
// The animated ones reuse the old engine's own motion code (render/ui/thought_anim.js, market_anim.js, sticker_anim.js) -
// the same functions its editor and its export drew with - so a ported overlay moves exactly as it did.
// From an old overlay to an item: start / end -> from / dur (frames); the place goes into `box` (each style says how);
// every other field is copied as it is (except `opacity` = the box's see-through -> `box_opacity`, since an item's
// `opacity` fades the whole item).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Img } from 'remotion';
import { thoughtWords, wordState, lineDrift, wordDust, dustState, THOUGHT_STYLE } from '../../ui/thought_anim.js';
import { drawMarket, MARKET_H } from '../../ui/market_anim.js';
import { stickerPop, rainBills } from '../../ui/sticker_anim.js';

const UI = 'Assistant, Heebo, "Segoe UI", sans-serif';
// the old engine's text font (fontCss('assistant')): the project's font asset with family "zc-assistant" when it has one
const ASSISTANT = '"zc-assistant", "Segoe UI", sans-serif';
const FPS = 30;  // the canvas fps (layers.md): an item's dur is in frames at 1x
let measurer: CanvasRenderingContext2D | null = null;
/** The text's width in px, measured the same way in the editor and in the export (both are Chrome). */
function widthOf(text: string, font: string, size: number) {
  try {
    measurer ??= document.createElement('canvas').getContext('2d');
    if (measurer) { measurer.font = font; return measurer.measureText(text).width; }
  } catch {}
  return text.length * size * 0.55;
}

/** url: the composition's asset id -> url (when it hands one to text styles; the sticker's picture needs it). */
type P = { it: any; text: string; fonts: Record<string, string>; t: number; url?: (asset: string) => string };

const famOf = (it: any, fonts: Record<string, string>, def = ASSISTANT) => (it.font && fonts[it.font] ? `"${fonts[it.font]}", ${def}` : def);
/** The item's length in seconds (null: no end - it stays). */
const secsOf = (it: any, def: number | null = null): number | null => (it.dur != null ? it.dur / FPS : def);
const hexA = (c: string, a: number) => { const n = parseInt(String(c).replace('#', ''), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

/** Re-render once a web font finishes loading (a canvas has to draw its letters again; the export loads them first). */
function useFontsLoaded() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = (document as any).fonts;
    if (!f?.addEventListener) return;
    const on = () => bump((n) => n + 1);
    f.addEventListener('loadingdone', on);
    return () => f.removeEventListener('loadingdone', on);
  }, []);
}

// ---- thought ----------------------------------------------------------------------------------------------------
// The movie-style thought (thought_anim.js): the words drift in one by one, the line floats up, then it all blurs away;
// motion "horror": they slam in, shiver, the line grows to `grow` once he has said it, and dissolve into atoms.
const Thought: React.FC<P> = ({ it, text, fonts, t }) => {
  const end = secsOf(it, 3)!;
  const words = React.useMemo(() => thoughtWords(text, it.size || 70), [text, it.size]);
  const dust = React.useMemo(() => words.map((w: any, i: number) => wordDust(i, w.w)), [words]);
  if (t < 0 || t > end) return null;
  const n = words.length;
  return <div style={{ width: it.box?.w ?? 960, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', gap: '4px 20px',
    direction: 'rtl', fontFamily: famOf(it, fonts), ...(THOUGHT_STYLE as any), transform: lineDrift(t, 0, text, it.motion, !!it.placed, end, it.hold, it.grow) }}>
    {words.map((w: any, i: number) => {
      const s = wordState(i, n, t, 0, end, it.motion, it.hold);
      // the word, and its atoms beside it (not inside: they must not fade with it)
      return <span key={i} style={{ display: 'inline-block', position: 'relative', whiteSpace: 'nowrap', fontSize: w.size, marginTop: w.dy, transform: `rotate(${w.rot.toFixed(2)}deg)` }}>
        <span style={{ display: 'inline-block', opacity: s.opacity, filter: s.filter, transform: s.transform }}>{w.w}</span>
        {it.motion === 'horror' && dust[i].map((p: any, k: number) => {
          const d = dustState(p, i, n, t, 0, end, it.motion);
          return d.opacity > 0 ? <span key={k} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%',
            background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.9)', opacity: d.opacity, transform: d.transform, WebkitTextStroke: 0 } as any} /> : null;
        })}
      </span>;
    })}
  </div>;
};

// ---- market -----------------------------------------------------------------------------------------------------
// The finance-news panel (market_anim.js) on a canvas of its own: the card slides in, the chart draws in (`draw` s
// after the start), the change counts up, "the call" drops in, it slides out at the end.
const Market: React.FC<P> = ({ it, text, fonts, t }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useFontsLoaded();
  const w = Math.max(500, Math.min(1080, it.w || 960)), s = w / 960, h = Math.round(MARKET_H * s);
  const px = Math.ceil(4 * s), py = Math.ceil(32 * s);  // room for the border and the slide in / out
  const fam = famOf(it, fonts);
  useLayoutEffect(() => {
    const c = ref.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawMarket(ctx, { ...it, text, w, x: px + w / 2, y: py, start: 0, end: secsOf(it) }, t, fam);
  });
  return <canvas ref={ref} width={w + 2 * px} height={h + 2 * py}
    style={{ display: 'block', width: w + 2 * px, height: h + 2 * py, margin: `${-py}px ${-px}px` }} />;
};

// ---- sticker ----------------------------------------------------------------------------------------------------
// sticker_anim.js: "pop" - pops in tilted, floats, shrinks away; "rain" - copies falling across the whole frame.
const Sticker: React.FC<P> = ({ it, text, t, url }) => {
  const o = { ...it, start: 0, end: secsOf(it) };
  const src = it.image && url ? url(it.image) : '';
  const face = (w: number) => src
    ? <Img src={src} draggable={false} style={{ display: 'block', width: w, maxWidth: 'none' }} />  // (Remotion's: the export's frame waits for it)
    : <div style={{ width: w, textAlign: 'center', fontSize: it.size || Math.round(w * 0.6), lineHeight: 1, fontFamily: `${UI}, "Segoe UI Emoji"`, fontWeight: 800,
        color: it.color || '#fff', direction: 'rtl', whiteSpace: 'pre-line' }}>{text}</div>;
  if (it.motion === 'rain') {
    // in the frame's own pixels: the box is the frame's corner (box {x: 0, y: 0})
    const bills = rainBills(o, t);
    return <div style={{ position: 'relative', left: -(it.box?.x ?? 540), top: -(it.box?.y ?? 0), width: it.width || 1080, height: it.height || 1920, pointerEvents: 'none' }}>
      {bills.map((q: any, i: number) => <div key={i} style={{ position: 'absolute', left: q.x, top: q.y, opacity: q.opacity, transform: q.transform, transformOrigin: '50% 50%' }}>{face(q.w)}</div>)}
    </div>;
  }
  const q = stickerPop(o, t);
  // (the box centres it - anchor "c" on the old x / y - so the old "translate(-50%, -50%)" is the box's job)
  return <div style={{ opacity: q.opacity, transform: q.transform.replace(/^translate\(-50%, -50%\)\s*/, ''), transformOrigin: '50% 50%' }}>{face(it.w || 520)}</div>;
};

// ---- question card ----------------------------------------------------------------------------------------------
// A follower's question as Instagram's question sticker (a dark bar with the prompt, a white body), or `variant:
// "tiktok"` - TikTok's reply-to-comment bubble. As the old export drew it (tools/lesson_text.mjs).
const Card: React.FC<P> = ({ it, text }) => {
  const w = it.w || 860, size = it.size || 44, op = it.box_opacity ?? 1;
  const font = '"Segoe UI", "zc-assistant", "Segoe UI Emoji", sans-serif';
  if (it.variant === 'tiktok') return <div style={{ width: w, boxSizing: 'border-box', background: '#fff', borderRadius: Math.round(size * 0.6), textAlign: 'right', direction: 'rtl',
    padding: `${Math.round(size * 0.55)}px ${Math.round(size * 0.7)}px ${Math.round(size * 0.65)}px`, boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: font }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.35), marginBottom: Math.round(size * 0.35) }}>
      <div style={{ width: Math.round(size * 1.5), height: Math.round(size * 1.5), borderRadius: '50%', flex: 'none', background: it.avatar_color || '#c58b6b', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.75) }}>{String(it.user || 'ש').replace('@', '').slice(0, 1).toUpperCase()}</div>
      <div style={{ color: '#8a8b91', fontWeight: 500, fontSize: Math.round(size * 0.72) }}>השבה לתגובה של {it.asker || it.user || '@user'}</div>
    </div>
    <div style={{ color: '#161823', fontWeight: 600, fontSize: size, lineHeight: 1.32 }}>{text}</div>
  </div>;
  const ls = it.label_size || Math.round(size * 0.85);
  return <div style={{ width: w, borderRadius: Math.round(size * 0.5), overflow: 'hidden', textAlign: 'center', direction: 'rtl', fontFamily: font,
    boxShadow: op < 1 ? undefined : '0 6px 18px rgba(0,0,0,0.18)' }}>
    <div style={{ background: hexA(it.accent || '#262626', op), color: '#fff', fontWeight: 600, fontSize: ls, padding: `${Math.round(ls * 0.62)}px ${Math.round(ls * 0.7)}px` }}>
      {it.label || 'שאלו אותי שאלה'}</div>
    <div style={{ background: `rgba(255,255,255,${op})`, color: '#262626', fontWeight: 500, fontSize: size, lineHeight: 1.32,
      textShadow: op < 0.6 ? '0 0 6px rgba(255,255,255,0.9)' : undefined, padding: `${Math.round(size * 0.85)}px ${Math.round(size * 1.0)}px ${Math.round(size * 0.95)}px` }}>
      {it.asker && <div style={{ fontWeight: 700, fontSize: Math.round(size * 0.8), color: '#8e8e8e', marginBottom: Math.round(size * 0.25) }}>{it.asker} שואלת:</div>}
      {text}</div>
  </div>;
};

// ---- lower third ------------------------------------------------------------------------------------------------
// The news lower third ("band"): a red tag (the words before "|") and a deep-blue band (after it), across the frame.
const Lower3: React.FC<P> = ({ it, text, fonts }) => {
  const [tag, ...rest] = String(text).split('|'), size = it.size || 46;
  return <div style={{ width: it.width || 1080, height: Math.round(size * 1.9), display: 'flex', direction: 'rtl', fontFamily: famOf(it, fonts), fontWeight: 800,
    fontSize: size, color: '#fff', borderTop: '4px solid #fff' }}>
    {rest.length > 0 && <div style={{ background: it.tag_color || '#d0121b', padding: `0 ${Math.round(size * 0.6)}px`, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{tag.trim()}</div>}
    <div style={{ background: hexA(it.band_color || '#0a265c', it.box_opacity ?? 0.94), flex: 1, padding: `0 ${Math.round(size * 0.55)}px`, display: 'flex', alignItems: 'center',
      whiteSpace: 'nowrap', overflow: 'hidden' }}>{(rest.length ? rest.join('|') : tag).trim()}</div>
  </div>;
};

export const SOLO_TEXT_STYLES: Record<string, { label: string; animated?: boolean; render: React.FC<P> }> = {
  // a news ticker: one line crossing the frame at `speed` px/s, over and over (theme gold = yellow letters).
  // knobs: size (46), speed (120), theme, font, width (the strip, default the canvas width 1080), bg (a strip colour)
  ticker: { label: 'Ticker', animated: true, render: ({ it, text, fonts, t }) => {
    const size = it.size || 46, W = it.width || 1080, v = it.speed || 120;
    const fam = it.font && fonts[it.font] ? `"${fonts[it.font]}", ${UI}` : UI;
    const line = String(text).replace(/\n/g, '   ·   ');
    const tw = widthOf(line, `800 ${size}px ${fam}`, size) + 80;  // (+ its padding)
    const x = ((v * (t + (it.t0 || 0))) % (W + tw)) - tw;  // (t0: the item's start on the video - the strip runs by the video's clock)
    return <div style={{ width: W, overflow: 'hidden', background: it.bg || 'transparent', direction: 'ltr' }}>
      <div style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '10px 40px', transform: `translateX(${x}px)`, fontFamily: fam, fontWeight: 800,
        fontSize: size, lineHeight: 1.25, color: it.theme === 'gold' ? '#FFD60A' : it.color || '#fff', direction: 'rtl' }}>{line}</div>
    </div>;
  } },
  // the animated thought. knobs: size (70), motion ("" drift | "horror"), hold (s the line stays after his voice, 0.35),
  // grow (horror: the line's size once said, 1), placed (true: it sits in its own spot - the old overlay had a `w`),
  // font. box: {x: old x ?? 540, y: old y ?? 1150, w: old w ?? 960, anchor: "t"}
  thought: { label: 'Thought', animated: true, render: Thought },
  // the crypto market panel. knobs (the old overlay's): text (the section), symbol, pair, name, price, change (%), tag,
  // updated, span, rise, call, fine, days, w (960), draw (s, 0.3), dump (0.07), font. box: {x: old x ?? 540, y: old y ?? 300, anchor: "t"}
  market: { label: 'Market panel', animated: true, render: Market },
  // a sticker. knobs: motion "pop" | "rain", image (a picture asset; without one - or until the composition hands styles
  // a url - the item's text is the sticker, an emoji / a word: size, color), w (pop 520 / rain: a bill 260), rot (pop: -6),
  // count (rain: 22). box: pop {x: old x ?? 540, y: old y ?? 700, anchor: "c"}; rain {x: 0, y: 0} (the whole frame)
  sticker: { label: 'Sticker', animated: true, render: Sticker },
  // the question card. knobs: variant ("" Instagram | "tiktok"), size (44), w (860), label, label_size, accent (#262626),
  // box_opacity (old `opacity`), asker; tiktok: user, avatar_color. box: {x: old x != null ? old x + w / 2 : 540, y: old y ?? 300, anchor: "t"}
  card: { label: 'Question card', render: Card },
  // the lower third: "tag | text". knobs: size (46), box_opacity (old `opacity`, 0.94), font, width (1080), tag_color,
  // band_color. box: {x: 0, y: old y ?? 1450}
  lower3: { label: 'Lower third', render: Lower3 },
};
