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
  const op = o.opacity ?? 1, size = o.size || 46, gold = o.theme === 'gold';
  return {
    background: o.theme === 'light' || !o.theme ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`,
    color: gold ? '#FFD60A' : o.theme === 'dark' ? '#fff' : '#000', fontSize: size, lineHeight: 1.25, padding: `${o.padY ?? 12}px ${o.padX ?? 24}px`,
    borderRadius: 14, direction: 'rtl', textAlign: 'center', maxWidth: o.maxw ?? 940, letterSpacing: gold ? '0.045em' : undefined, whiteSpace: 'pre-line', ...font,
    ...(gold ? { WebkitTextStroke: `${Math.round(size * 0.17)}px #000`, paintOrder: 'stroke fill' } as any : {}),
    textShadow: op < 0.6 ? (o.theme === 'light' || !o.theme ? '0 1px 4px rgba(255,255,255,0.7)' : '0 2px 6px rgba(0,0,0,0.8)') : undefined,
  };
};

type StyleProps = { it: any; text: string; fonts: Record<string, string>; t: number };
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
  ...SOLO_TEXT_STYLES,  // the one-camera engine's styles (styles_solo.tsx): ticker, ...
};

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
