// ONE composition for every project: it draws project.json's layers, bottom to top (skill/edit-video/layers.md).
// The editor plays it live (Remotion Player); the export draws its picture / text layers with it (mode "graphics")
// and lets ffmpeg put the videos in between (pipeline/export_layers.py) - so what he sees is what exports.
import React from 'react';
import { AbsoluteFill, continueRender, delayRender, Img, staticFile, useCurrentFrame } from 'remotion';
import { imageBox, itemOpacity } from './layers/geometry.js';
import { TEXT_STYLES, SUB_STYLES, placeStyle, animTransform } from './layers/styles';
import { VideoTrack } from './layers/VideoTrack';
import { AudioTrack } from './layers/AudioTrack';

export type LayersProps = {
  project: any;
  urls: Record<string, string>;      // asset id (or "id:fg" / "id:preview") -> where to load it
  static?: boolean;                  // urls are staticFile() names (the export's renderer)
  mode?: 'full' | 'graphics';        // graphics: only picture / text / shape layers, transparent elsewhere (the export)
  only?: string[];                   // graphics: just these layers
  frameMap?: number[];               // graphics: output frame i draws project frame frameMap[i] (only the frames that change)
  stems?: { layer: string; src: string }[];  // the editor: one sound file per audio layer (the studio mixes them)
  playing?: boolean;                 // the editor: the Player is playing (video / sound copies follow it)
  playbackRate?: number;
  gainDb?: number;                   // the editor: the shared gain the sound was prepared at (the voice chain needs the track's own level)
};

const VIDEO_KINDS = new Set(['video', 'backdrop']);

const src = (p: LayersProps, key: string) => {
  const u = p.urls[key];
  return u ? (p.static ? staticFile(u) : u) : '';
};


// fonts: every font asset is loaded before the first frame
const loadedFonts = new Set<string>();
function useFonts(p: LayersProps) {
  const fonts = Object.entries(p.project.assets || {}).filter(([, a]: any) => a.kind === 'font') as [string, any][];
  const [handle] = React.useState(() => (fonts.some(([, a]) => !loadedFonts.has(a.family)) ? delayRender('fonts') : null));
  React.useEffect(() => {
    Promise.all(fonts.filter(([, a]) => !loadedFonts.has(a.family)).map(async ([id, a]) => {
      try {
        const face = new FontFace(a.family, `url("${src(p, id)}")`, { weight: '100 900' });
        await face.load();
        (document as any).fonts.add(face);
        loadedFonts.add(a.family);
      } catch { /* a missing font falls back to the UI font */ }
    })).finally(() => handle !== null && continueRender(handle));
  }, []);
  return Object.fromEntries(fonts.map(([id, a]) => [id, a.family]));
}

function Graphic({ p, layer, it, f, fonts }: { p: LayersProps; layer: any; it: any; f: number; fonts: Record<string, string> }) {
  const { w: W, h: H, fps } = p.project.canvas;
  const props = { ...(layer.props || {}), ...it, box: it.box || layer.props?.box };
  const t = (f - it.from) / fps;
  const op = itemOpacity(it, layer.props || {}, f, fps);
  if (layer.kind === 'image') {
    const asset = p.project.assets[props.asset];
    if (!asset) return null;
    const b = imageBox(asset, props.box || { x: 0, y: 0, w: W });
    return <Img src={src(p, props.asset)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, maxWidth: 'none',
      opacity: op, borderRadius: props.radius, transform: animTransform(it, t) }} />;
  }
  if (layer.kind === 'shape') {
    const b = props.box;
    return <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: 'border-box', borderRadius: props.radius ?? 0,
      background: props.fill || 'transparent', border: props.stroke ? `${props.width ?? 2}px solid ${props.stroke}` : undefined, opacity: op,
      transform: animTransform(it, t) }} />;
  }
  if (layer.kind === 'text') {
    const S = TEXT_STYLES[props.style] || TEXT_STYLES.plain;
    let text = String(props.text ?? '');
    if (text.includes('{clock}')) {
      const secs = (props.clock_start || 0) + Math.floor((f - it.from) / fps);
      text = text.replace('{clock}', `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`);
    }
    return <div style={{ ...placeStyle(props.box, W, H), opacity: op }}>
      <div style={{ transform: animTransform(it, t) }}><S.render it={props} text={text} fonts={fonts} t={t} /></div></div>;
  }
  return null;
}

// a subtitles layer: the items on screen that share a place stack in one column (said-on-the-side ones first)
function Subtitles({ p, layer, f, fonts }: { p: LayersProps; layer: any; f: number; fonts: Record<string, string> }) {
  const { w: W, h: H, fps } = p.project.canvas;
  const on = (layer.items || []).filter((i: any) => !i.hidden && f >= i.from && f < i.from + i.dur);
  if (!on.length || layer.hidden) return null;
  const groups = new Map<string, any[]>();
  for (const it of on) {
    const box = it.box || layer.props?.box || { x: W / 2, y: H - 300, anchor: 'b' };
    const k = JSON.stringify(box);
    groups.set(k, [...(groups.get(k) || []), it]);
  }
  const S = SUB_STYLES[layer.props?.style] || SUB_STYLES.zoom;
  return <>{[...groups.entries()].map(([k, items]) => (
    <div key={k} style={{ ...placeStyle(JSON.parse(k), W, H), gap: 12 }}>
      {items.sort((a, b) => Number(!!b.side) - Number(!!a.side)).map((it) => {
        const props = { ...(layer.props || {}), ...it };
        return <div key={it.id} style={{ opacity: itemOpacity(it, layer.props || {}, f, fps) }}><S.render it={props} text={props.text} fonts={fonts} t={(f - it.from) / fps} /></div>;
      })}
    </div>))}</>;
}

export const Layers: React.FC<LayersProps> = (p) => {
  const frame = useCurrentFrame();
  const fonts = useFonts(p);
  const pr = p.project;
  const f = p.frameMap ? p.frameMap[Math.min(frame, p.frameMap.length - 1)] : frame;
  const graphics = p.mode === 'graphics';
  const layers = (pr.layers || []).filter((l: any) => !l.hidden && (!p.only || p.only.includes(l.id)));
  // the stack in runs: consecutive video layers composite together (an item's z lifts it inside its run)
  const runs: { video: boolean; layers: any[] }[] = [];
  for (const l of layers) {
    if (l.kind === 'audio' || l.kind === 'effect') continue;
    const v = VIDEO_KINDS.has(l.kind);
    if (runs.length && runs.at(-1)!.video === v) runs.at(-1)!.layers.push(l); else runs.push({ video: v, layers: [l] });
  }
  return (
    <AbsoluteFill style={{ background: graphics ? 'transparent' : pr.canvas.color || '#000', overflow: 'hidden' }}>
      {/* sound: each audio layer plays item by item, live (render/src/layers/AudioTrack.tsx) - the export mixes the same */}
      {!graphics && (pr.layers || []).filter((l: any) => l.kind === 'audio').map((l: any) => <AudioTrack key={l.id} p={p} layer={l} />)}
      {runs.map((run, k) => run.video ? (graphics ? null : (
        <AbsoluteFill key={k}>
          {/* each video layer plays through VideoTrack (render/src/layers/VideoTrack.tsx): persistent copies per take,
              seamless cuts, dissolves; z / order stacking inside the run */}
          {run.layers.filter((l) => l.kind === 'video').map((l) => (
            <VideoTrack key={l.id} p={p} layer={l} backdrop={(pr.layers || []).find((x: any) => x.kind === 'backdrop' && !x.hidden && x.props?.target === l.id)} />
          ))}
        </AbsoluteFill>
      )) : (
        <AbsoluteFill key={k}>
          {run.layers.map((l) => l.kind === 'subtitles' ? <Subtitles key={l.id} p={p} layer={l} f={f} fonts={fonts} />
            : (l.items || []).filter((it: any) => !it.hidden && f >= it.from && f < it.from + it.dur)
                .map((it: any) => <Graphic key={l.id + it.id} p={p} layer={l} it={it} f={f} fonts={fonts} />))}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};
