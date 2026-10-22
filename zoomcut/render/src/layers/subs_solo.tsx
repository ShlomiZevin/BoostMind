// The one-camera engine's subtitles (tools/lesson_text.mjs .caption) as a subtitles style - spread into SUB_STYLES.
// Default: yellow Stam with a thick black outline and a soft drop shadow; a series' own look overrides font / size /
// weight / colour / outline (episode.json "captions_style" -> the layer's props). The box: x 540, w 980, anchor "t".
import React from 'react';

type P = { it: any; text: string; fonts: Record<string, string>; t: number };

export const SOLO_SUB_STYLES: Record<string, { label: string; render: React.FC<P> }> = {
  solo: { label: 'Outlined subtitles (one camera)', render: ({ it, text, fonts }) => {
    const fam = it.font && fonts[it.font] ? `"${fonts[it.font]}", "Segoe UI", sans-serif` : '"zc-stam-ashkenaz", Stam, "Segoe UI", sans-serif';
    return <div style={{ width: it.w ?? 980, textAlign: 'center', fontFamily: fam, fontSize: it.size || 84, lineHeight: 1.18,
      fontWeight: it.weight ?? 400, color: it.color || '#FFD60A', WebkitTextStroke: `${it.stroke ?? 14}px #000`, paintOrder: 'stroke fill',
      textShadow: '0 6px 14px rgba(0,0,0,0.55)', unicodeBidi: 'plaintext', letterSpacing: it.font ? 0 : '0.045em', whiteSpace: 'pre-line' } as any}>{text}</div>;
  } },
};
