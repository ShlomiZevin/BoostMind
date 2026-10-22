// Text styles from the one-camera engine, for every project (spread into TEXT_STYLES by styles.tsx). Each draws from the
// item and t (seconds since the item began) only - so the editor and the export (which renders the same frames) agree.
import React from 'react';

const UI = 'Assistant, Heebo, "Segoe UI", sans-serif';
let measurer: CanvasRenderingContext2D | null = null;
/** The text's width in px, measured the same way in the editor and in the export (both are Chrome). */
function widthOf(text: string, font: string, size: number) {
  try {
    measurer ??= document.createElement('canvas').getContext('2d');
    if (measurer) { measurer.font = font; return measurer.measureText(text).width; }
  } catch {}
  return text.length * size * 0.55;
}

type P = { it: any; text: string; fonts: Record<string, string>; t: number };

export const SOLO_TEXT_STYLES: Record<string, { label: string; animated?: boolean; render: React.FC<P> }> = {
  // a news ticker: one line crossing the frame at `speed` px/s, over and over (theme gold = yellow letters).
  // knobs: size (46), speed (120), theme, font, width (the strip, default the canvas width 1080), bg (a strip colour)
  ticker: { label: 'Ticker', animated: true, render: ({ it, text, fonts, t }) => {
    const size = it.size || 46, W = it.width || 1080, v = it.speed || 120;
    const fam = it.font && fonts[it.font] ? `"${fonts[it.font]}", ${UI}` : UI;
    const line = String(text).replace(/\n/g, '   ·   ');
    const tw = widthOf(line, `800 ${size}px ${fam}`, size) + 80;  // (+ its padding)
    const x = ((v * t) % (W + tw)) - tw;
    return <div style={{ width: W, overflow: 'hidden', background: it.bg || 'transparent', direction: 'ltr' }}>
      <div style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '10px 40px', transform: `translateX(${x}px)`, fontFamily: fam, fontWeight: 800,
        fontSize: size, lineHeight: 1.25, color: it.theme === 'gold' ? '#FFD60A' : it.color || '#fff', direction: 'rtl' }}>{line}</div>
    </div>;
  } },
};
