// The looks a text / subtitles / shape item can have. Each style is a small component; a project names it
// ("style": "pov") and sets its knobs. A new look is added HERE once and every project can use it - never a
// per-project hack. `animated: true` = the style moves by itself every frame (the export draws every frame of it).
import React from 'react';
import { keyAt } from './geometry.js';
import { SOLO_TEXT_STYLES } from './styles_solo';
import { SOLO_SUB_STYLES } from './subs_solo';

export const UI_FONT = '"Segoe UI", "Arial", sans-serif';

// where a text box goes: x / y and the anchor ("tl" top-left, "t" top-centre, "c" centre, "b" bottom-centre,
// "br" bottom-right, "bl", "tr"); w = the width it wraps in (centred on x for t / c / b)
export function placeStyle(box: any, W: number, H: number): React.CSSProperties {
  const a = box?.anchor || 'tl', x = box?.x ?? W / 2, y = box?.y ?? 0, w = box?.w;
  const s: React.CSSProperties = { position: 'absolute', display: 'flex' };
  const vert = a === 'c' ? 'center' : a.startsWith('b') ? 'flex-end' : 'flex-start';
  s.flexDirection = 'column';
  if (a === 't' || a === 'c' || a === 'b') {
    const ww = w ?? W;
    Object.assign(s, { left: x - ww / 2, width: ww, alignItems: 'center' });
  } else if (a.endsWith('r')) Object.assign(s, { right: W - x, alignItems: 'flex-end', ...(w ? { width: w } : {}) });
  else Object.assign(s, { left: x, alignItems: 'flex-start', ...(w ? { width: w } : {}) });
  if (a === 'c') Object.assign(s, { top: y, transform: 'translateY(-50%)' });
  else if (a.startsWith('b')) Object.assign(s, { bottom: H - y });
  else Object.assign(s, { top: y });
  s.justifyContent = vert;
  return s;
}

const fontOf = (it: any, fonts: Record<string, string>, fallbackWeight = 700): React.CSSProperties => {
  const fam = it.font && it.font !== 'system' ? fonts[it.font] : null;
  return fam ? { fontFamily: `"${fam}", ${UI_FONT}`, fontWeight: it.weight ?? (it.fontWeight || 800) } : { fontFamily: UI_FONT, fontWeight: it.weight ?? fallbackWeight };
};

const Mic: React.FC<{ on: boolean; size?: number }> = ({ on, size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? '#fff' : '#ff4b4b'} />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke={on ? '#fff' : '#ff4b4b'} strokeWidth="1.8" strokeLinecap="round" />
    {!on && <path d="M4 4l16 16" stroke="#ff4b4b" strokeWidth="2" strokeLinecap="round" />}
  </svg>
);

// "text on video": light = white box / black text, dark = black box / white text, gold = yellow in a black outline
export const boxStyle = (o: any, font: React.CSSProperties): React.CSSProperties => {
  const op = o.box_opacity ?? o.opacity ?? 1, size = o.size || 46, gold = o.theme === 'gold';  // (box_opacity: the box alone - an item's opacity fades all of it)
  return {
    background: o.theme === 'light' || !o.theme ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`,
    color: gold ? '#FFD60A' : o.theme === 'dark' ? '#fff' : '#000', fontSize: size, lineHeight: 1.25, padding: `${o.padY ?? 12}px ${o.padX ?? 24}px`,
    borderRadius: 14, direction: 'rtl', textAlign: 'center', maxWidth: o.maxw ?? 940, letterSpacing: gold ? '0.045em' : undefined, whiteSpace: 'pre-line', ...font,
    ...(gold ? { WebkitTextStroke: `${Math.round(size * 0.17)}px #000`, paintOrder: 'stroke fill' } as any : {}),
    textShadow: op < 0.6 ? (o.theme === 'light' || !o.theme ? '0 1px 4px rgba(255,255,255,0.7)' : '0 2px 6px rgba(0,0,0,0.8)') : undefined,
  };
};

type StyleProps = { it: any; text: string; fonts: Record<string, string>; t: number; url?: (assetId: string) => string };  // url: where an asset (a sticker's picture) loads
export const TEXT_STYLES: Record<string, { label: string; animated?: boolean; render: React.FC<StyleProps> }> = {
  // the TikTok hook / a label: a box with the text (theme light / dark / gold, opacity, size)
  pov: { label: 'Text box (POV / label)', render: ({ it, text, fonts }) => <div style={boxStyle(it, fontOf(it, fonts))}>{text}</div> },
  // just the letters: size, color, weight, font, align
  plain: { label: 'Plain text', render: ({ it, text, fonts }) => (
    <div style={{ ...fontOf(it, fonts, it.weight ?? 600), fontSize: it.size || 30, color: it.color || '#fff', direction: it.dir || 'rtl',
      textAlign: it.align || 'center', whiteSpace: 'pre-line', lineHeight: it.lineHeight ?? 1.25, letterSpacing: it.letterSpacing,
      ...(it.stroke ? { WebkitTextStroke: `${it.stroke}px ${it.strokeColor || '#000'}`, paintOrder: 'stroke fill' } as any : {}) }}>{text}</div>) },
  // a video-call name tag with a microphone (size 32 big tile, 26 small)
  tag: { label: 'Name tag', render: ({ it, text }) => {
    const small = (it.size || 32) < 30;
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: it.bg || 'rgba(0,0,0,0.6)', borderRadius: 8,
      padding: small ? '4px 12px 4px 10px' : '6px 16px 6px 12px', direction: 'rtl', color: '#fff', fontFamily: UI_FONT,
      fontSize: it.size || 32, fontWeight: 500, whiteSpace: 'nowrap' }}><Mic on={!it.muted} size={small ? 24 : 30} /><span>{text}</span></div>;
  } },
  // a notice in the middle of the call (the host removed someone)
  toast: { label: 'Notice', render: ({ it, text }) => (
    <div style={{ background: 'rgba(30,30,30,0.96)', color: '#fff', borderRadius: 16, padding: '24px 34px', fontSize: it.size || 44, fontWeight: 600,
      border: '1px solid rgba(255,255,255,0.14)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: 18, fontFamily: UI_FONT,
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
      {it.icon !== 'none' && <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#ff5a5a" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5M16 9l5 5M21 9l-5 5" /></svg>}
      {text}</div>) },
  // a solid pill (the red "removed" stamp, a button)
  pill: { label: 'Pill', render: ({ it, text }) => (
    <div style={{ background: it.bg || '#e02828', color: it.color || '#fff', fontFamily: UI_FONT, fontWeight: it.weight ?? 700, fontSize: it.size || 64,
      padding: it.pad || '10px 28px', borderRadius: it.radius ?? 12, direction: 'rtl', whiteSpace: 'nowrap' }}>{text}</div>) },
  // a sing-along line: each word fills with `fill` while it's sung (right to left), the sung word pops a little, the
  // line rises in and fades out, the next line waits dimmed under it. item: text (one line), words [[a, b], ...] = when
  // each word (split on spaces) is sung, seconds since the item began; next (the line after it). knobs: size (84),
  // color (#fff), fill (#ff2d95), stroke (9), strokeColor (#1b0a24), nextSize (0.58 of size), font, weight (800)
  karaoke: { label: 'Karaoke line', animated: true, render: ({ it, text, fonts, t }) => <Karaoke it={it} text={text} fonts={fonts} t={t} /> },
  // a lyric-video line ("a word here, a word there"): each word pops in when it's sung - from big and blurred to sharp,
  // a little tilt - and stays; the line drifts up and fades out at the item's end. text: rows by \n, *word* = accent
  // (fill colour, bigger; "*a b*" marks a run). words [[a, b], ...] like karaoke (counted without the *). knobs: size
  // (96), color (#fff), fill (#ff3ea5), accent (1.35 x size), stroke (8), strokeColor, tilt (deg, rows alternate),
  // align (center | right | left), font, weight
  lyric: { label: 'Lyric video words', animated: true, render: ({ it, text, fonts, t }) => <Lyric it={it} text={text} fonts={fonts} t={t} /> },
  ...SOLO_TEXT_STYLES,  // the one-camera engine's styles (styles_solo.tsx): ticker, ...
};

function Lyric({ it, text, fonts, t }: StyleProps) {
  const size = it.size || 96, end = it.dur != null ? it.dur / 30 : 1e9, times: number[][] = it.words || [];
  const font = fontOf({ ...it, weight: it.weight ?? 800 }, fonts, 800);
  const ink: any = { WebkitTextStroke: `${it.stroke ?? 8}px ${it.strokeColor || '#1b0a24'}`, paintOrder: 'stroke fill' };
  // rows of words; "*" opens / closes the accent
  let on = false, n = 0;
  const rows = String(text).split('\n').map((r) => r.split(/\s+/).filter(Boolean).map((tok) => {
    if (tok.startsWith('*')) on = true;
    const w = { w: tok.replace(/\*/g, ''), acc: on, i: n++ };
    if (tok.endsWith('*')) on = false;
    return w;
  }));
  const seed = String(it.id || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const rnd = (i: number) => { const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const out = clamp01((end - t) / 0.3), tilt = it.tilt ?? 3;
  const justify = it.align === 'right' ? 'flex-start' : it.align === 'left' ? 'flex-end' : 'center';  // (rtl: start = right)
  return <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: it.box?.w ?? 960,
    opacity: out, transform: `translateY(${-t * 7}px) scale(${1 + (1 - out) * 0.08})`, ...font }}>
    {rows.map((row, r) => <div key={r} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify, gap: `0 ${Math.round(size * 0.24)}px`,
      transform: `rotate(${(r % 2 ? 1 : -1) * tilt}deg)`, marginTop: r ? -Math.round(size * 0.12) : 0 }}>
      {row.map(({ w, acc, i }) => {
        const [a] = times[i] || [0];
        const k = clamp01((t - a + 0.04) / 0.22), e = ease(k);
        return <span key={i} style={{ display: 'inline-block', fontSize: Math.round(size * (acc ? it.accent ?? 1.35 : 1)), lineHeight: 1.12,
          color: acc ? it.fill || '#ff3ea5' : it.color || '#fff', opacity: e, filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined,
          transform: `translateY(${(1 - e) * -26}px) scale(${1.55 - 0.55 * e}) rotate(${(rnd(i) - 0.5) * 7}deg)`, ...ink }}>{w}</span>;
      })}
    </div>)}
  </div>;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
function Karaoke({ it, text, fonts, t }: StyleProps) {
  const size = it.size || 84, end = it.dur != null ? it.dur / 30 : 1e9;
  const font = fontOf({ ...it, weight: it.weight ?? 800 }, fonts, 800);
  // rows = the line's own breaks (\n); words are counted across rows, so `words` stays one list
  const rows = String(text).split('\n').map((r) => r.split(/\s+/).filter(Boolean)), times: number[][] = it.words || [];
  const firstOf = rows.map((_, r) => rows.slice(0, r).reduce((n, x) => n + x.length, 0));
  const stroke = it.stroke ?? 9, sc = it.strokeColor || '#1b0a24';
  const ink: any = { WebkitTextStroke: `${stroke}px ${sc}`, paintOrder: 'stroke fill' };
  const inA = ease(t / 0.28), out = clamp01((end - t) / 0.22);  // rises in, fades out at the item's end
  return <div style={{ direction: 'rtl', textAlign: 'center', opacity: Math.min(inA, out), transform: `translateY(${(1 - inA) * 40}px)`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(size * 0.28) }}>
    {rows.map((row, r) => <div key={r} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${Math.round(size * 0.26)}px`, maxWidth: it.box?.w ?? 980,
      fontSize: size, lineHeight: 1.18, marginTop: r ? -Math.round(size * 0.2) : 0, ...font }}>
      {row.map((w, j) => {
        const i = firstOf[r] + j, [a, b] = times[i] || [0, 0.001];
        const p = clamp01((t - a) / Math.max(0.05, b - a));
        const pop = t >= a && t < a + 0.35 ? 1 + 0.09 * Math.sin(Math.PI * clamp01((t - a) / 0.35)) : 1;
        return <span key={i} style={{ position: 'relative', display: 'inline-block', transform: `scale(${pop})`, transformOrigin: '50% 70%' }}>
          <span style={{ color: it.color || '#fff', ...ink }}>{w}</span>
          {/* the sung part: the same word in the fill colour, revealed from the right (Hebrew reads right to left) */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, color: it.fill || '#ff2d95', ...ink, clipPath: `inset(-20% 0 -20% ${(1 - p) * 100}%)` }}>{w}</span>
        </span>;
      })}
    </div>)}
    {it.next && <div style={{ fontSize: Math.round(size * (it.nextSize ?? 0.58)), lineHeight: 1.2, color: 'rgba(255,255,255,0.62)', maxWidth: it.box?.w ?? 980,
      ...font, WebkitTextStroke: `${Math.max(3, Math.round(stroke * 0.6))}px ${sc}`, paintOrder: 'stroke fill' } as any}>{String(it.next).replace(/\n/g, ' ')}</div>}
  </div>;
}

// subtitles: "zoom" = a dark box with the speaker's name first ("side" items: said on the side, amber)
export const SUB_STYLES: Record<string, { label: string; render: React.FC<StyleProps> }> = {
  zoom: { label: 'Call subtitles (name: text)', render: ({ it, text }) => {
    const narrow = !!it.compact, fs = it.size || (narrow ? 32 : 46);
    return it.side ? (
      <div style={{ background: 'rgba(14,14,14,0.88)', borderRadius: 12, padding: narrow ? '8px 14px' : '14px 26px', color: '#ffc94d', fontFamily: UI_FONT,
        fontSize: fs, lineHeight: 1.3, fontWeight: 600, direction: 'rtl', textAlign: 'right', maxWidth: 900, border: '1px solid rgba(255,201,77,0.35)' }}>
        {it.who && it.label !== false && <span style={{ color: '#d9a93a', fontWeight: 700 }}>{it.who}: </span>}{text}</div>
    ) : (
      <div style={{ background: it.bg || 'rgba(18,18,18,0.86)', borderRadius: 12, padding: narrow ? '10px 16px' : '16px 28px', color: it.color || '#fff', fontFamily: UI_FONT,
        fontSize: fs, lineHeight: 1.3, fontWeight: 500, direction: 'rtl', textAlign: 'right', maxWidth: 900 }}>
        {it.who && it.label !== false && <span style={{ color: '#b9b9b9', fontWeight: 600 }}>{it.who}: </span>}{text}</div>
    );
  } },
  // big centred words with an outline (one-camera videos)
  outline: { label: 'Outlined words', render: ({ it, text, fonts }) => (
    <div style={{ ...fontOf(it, fonts, it.weight ?? 800), fontSize: it.size || 64, color: it.color || '#fff', direction: 'rtl', textAlign: 'center',
      lineHeight: 1.2, maxWidth: it.maxw ?? 980, WebkitTextStroke: `${it.stroke ?? 10}px ${it.strokeColor || '#000'}`, paintOrder: 'stroke fill' } as any}>{text}</div>) },
  ...SOLO_SUB_STYLES,  // the one-camera engine's subtitles (subs_solo.tsx)
};

/** A text item's scale / x / y keyframes as a CSS transform (t = seconds since the item began). */
export const animTransform = (it: any, t: number) => {
  const a = it.anim || {};
  const parts = [];
  if (a.x || a.y) parts.push(`translate(${keyAt(a.x, t, 0)}px, ${keyAt(a.y, t, 0)}px)`);
  if (a.scale) parts.push(`scale(${keyAt(a.scale, t)})`);
  return parts.join(' ') || undefined;
};
