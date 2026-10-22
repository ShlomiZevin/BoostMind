// Picture-like layers: image (a logo, a sticker, a story picture), backdrop (the photo behind a cut-out person),
// shape (borders, highlights, flashes) and effect (film effects - their knobs arrive with the solo builder).
import React from 'react';
import { imageBox } from '../../../src/layers/geometry.js';
import { FILTERS } from '../../../src/layers/effect_curve.js';
import { InspectorProps, useSettings, Head, Sec, Row, Note, Ovr, Slider, Anchor, Swatches, ClipTiming, LayerState, Entrance, WholeVideo, Opacity, ICON, fmt } from './controls';

function Thumb({ P, asset, onReplace }: { P: InspectorProps; asset?: string; onReplace: () => void }) {
  const url = asset ? P.urls[asset] : '';
  const a = asset ? P.project.assets?.[asset] : null;
  return <div className="ins-media">
    <div className="ins-thumb" style={url ? { backgroundImage: `url("${url}")` } : undefined} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div className="ins-note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset || 'No picture'}{a?.w ? ` · ${a.w}×${a.h}` : ''}</div>
      <button className="btn" onClick={onReplace}>{asset ? 'Replace' : 'Choose'}</button>
    </div></div>;
}

const M = 48;  // the margin a placed picture keeps from the frame's edge
const SPOT: Record<string, (W: number, H: number, w: number, h: number) => [number, number]> = {
  tl: () => [M, M], t: (W, H, w) => [(W - w) / 2, M], tr: (W, H, w) => [W - w - M, M],
  l: (W, H, w, h) => [M, (H - h) / 2], c: (W, H, w, h) => [(W - w) / 2, (H - h) / 2], r: (W, H, w, h) => [W - w - M, (H - h) / 2],
  bl: (W, H, w, h) => [M, H - h - M], b: (W, H, w, h) => [(W - w) / 2, H - h - M], br: (W, H, w, h) => [W - w - M, H - h - M],
};

export const ImageInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer, item } = P;
  const S = useSettings(P);
  const W = project.canvas.w, H = project.canvas.h;
  const assetId = S.get('asset');
  const asset = project.assets?.[assetId];
  const box = S.get('box', { x: 0, y: 0, w: W / 3 }) || {};
  const b = asset ? imageBox(asset, box) : { x: box.x, y: box.y, w: box.w, h: box.h ?? box.w };
  const spot = Object.keys(SPOT).find((k) => { const [x, y] = SPOT[k](W, H, b.w, b.h); return Math.abs(x - b.x) < 2 && Math.abs(y - b.y) < 2; }) || '';
  const setBox = (patch: any, commit = true) => (item ? S.item({ box: { ...(item.box || {}), ...patch } }, commit) : S.layer({ box: { ...box, ...patch } }, commit));
  const place = (k: string) => { const [x, y] = SPOT[k](W, H, b.w, b.h); setBox({ x: Math.round(x), y: Math.round(y), anchor: null }); };
  const resize = (w: number, commit: boolean) => {  // keeps its centre where it is
    const h = asset ? (w * asset.h) / asset.w : w;
    setBox({ w: Math.round(w), x: Math.round(b.x + (b.w - w) / 2), y: Math.round(b.y + (b.h - h) / 2), anchor: null, h: null }, commit);
  };
  return <div className="ins">
    <Head icon={ICON.image} title={layer.name || 'Picture'} sub={item ? `Picture ${item.id}` : `Image layer · ${layer.items?.length || 0} items`} />
    <Sec title="Picture">
      <Thumb P={P} asset={assetId} onReplace={() => P.pickAsset('image', (id) => S.set('asset', id))} />
      <Opacity P={P} />
      <Slider label={<>Corners <Ovr S={S} k="radius" /></>} v={S.get('radius', 0)} min={0} max={200} step={1} def={0} fmt={fmt.px} onChange={(v, c) => S.set('radius', v || null, c)} />
    </Sec>
    <Sec title="Look" end={<span className="ins-state ok">live</span>}>
      <Slider label={<>Blur <Ovr S={S} k="blur" /></>} v={S.get('blur', 0)} min={0} max={20} step={0.1} def={0} fmt={(v) => (v ? `${v.toFixed(1)} px` : 'sharp')} onChange={(v, c) => S.set('blur', v || null, c)} />
      <Slider label={<>Brightness <Ovr S={S} k="brightness" /></>} v={S.get('brightness', 1)} min={0.3} max={1.5} step={0.01} def={1} fmt={fmt.pct} onChange={(v, c) => S.set('brightness', v === 1 ? null : v, c)} />
      <Slider label={<>Colour <Ovr S={S} k="saturate" /></>} v={S.get('saturate', 1)} min={0} max={2} step={0.01} def={1} fmt={fmt.pct} onChange={(v, c) => S.set('saturate', v === 1 ? null : v, c)} />
      <Note>A set behind him: a little blur and a touch darker sits him in the room. Drag the picture on the video to move it; its corner zooms.</Note>
    </Sec>
    <Sec title="Size and place" end={<Ovr S={S} k="box" />}>
      <Slider label="Size" v={b.w} min={24} max={W * 1.5} step={1} fmt={(v) => fmt.pct(v / W)} onChange={resize} />
      <Row label="Place"><Anchor value={spot} allowed={Object.keys(SPOT)} onPick={place} /></Row>
      <Slider label="Across" v={b.x} min={-b.w} max={W} step={1} fmt={fmt.px} onChange={(v, c) => setBox({ x: Math.round(v), anchor: null }, c)} />
      <Slider label="Down" v={b.y} min={-b.h} max={H} step={1} fmt={fmt.px} onChange={(v, c) => setBox({ y: Math.round(v), anchor: null }, c)} />
    </Sec>
    {item && <Sec title="Timing"><WholeVideo P={P} /><Entrance P={P} /></Sec>}
    <ClipTiming P={P} />
    <LayerState P={P} />
  </div>;
};

export const BackdropInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer } = P;
  const S = useSettings(P);
  const props = layer.props || {};
  const videos = (project.layers || []).filter((l: any) => l.kind === 'video');
  return <div className="ins">
    <Head icon={ICON.backdrop} title={<>{layer.group ? `${layer.group} · ` : ''}{layer.name || 'Background'}</>} sub="Backdrop - behind the cut-out person" />
    <Sec title="Background">
      <Thumb P={P} asset={props.asset} onReplace={() => P.pickAsset('image', (id) => S.layer({ asset: id }))} />
      <Slider label="Zoom" v={props.zoom ?? 1} min={0.3} max={3} step={0.01} def={1} fmt={fmt.x} onChange={(v, c) => S.layer({ zoom: v }, c)} />
      <Slider label="Left / right" v={props.x ?? 0} min={-0.5} max={0.5} step={0.005} def={0} fmt={fmt.pct} onChange={(v, c) => S.layer({ x: v }, c)} />
      <Slider label="Up / down" v={props.y ?? 0} min={-0.5} max={0.5} step={0.005} def={0} fmt={fmt.pct} onChange={(v, c) => S.layer({ y: v }, c)} />
      <Note>Below 1× it zooms out only until the photo still covers the window - never an empty edge.</Note>
    </Sec>
    <Sec title="Behind">
      <Row label="Person"><select className="ins-select" value={props.target || ''} onChange={(e) => S.layer({ target: e.target.value })}>
        {videos.map((l: any) => <option key={l.id} value={l.id}>{l.group ? `${l.group} · ` : ''}{l.name || l.id}</option>)}</select></Row>
      <Note>Shows only where that layer's cut-out is on.</Note>
    </Sec>
    <LayerState P={P} />
  </div>;
};

export const ShapeInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer, item } = P;
  const S = useSettings(P);
  const W = project.canvas.w, H = project.canvas.h;
  const box = S.get('box', { x: 0, y: 0, w: W, h: H }) || {};
  const setBox = (patch: any, commit = true) => (item ? S.item({ box: { ...(item.box || {}), ...patch } }, commit) : S.layer({ box: { ...box, ...patch } }, commit));
  return <div className="ins">
    <Head icon={ICON.shape} title={layer.name || 'Shape'} sub={item ? `Shape ${item.id}` : 'Shape layer'} />
    <Sec title="Look">
      <Row label={<>Fill <Ovr S={S} k="fill" /></>}><Swatches value={S.get('fill', '')} colors={['#ffffff', '#000000', '#ff6b57', '#ffd23f']} onPick={(c) => S.set('fill', c)} /></Row>
      <Row label={<>Border <Ovr S={S} k="stroke" /></>}><Swatches value={S.get('stroke', '')} colors={['#ffffff', '#000000', '#ff6b57', '#4cc38a']} onPick={(c) => S.set('stroke', c)} /></Row>
      <Slider label="Border width" v={S.get('width', 2)} min={0} max={40} step={1} def={2} fmt={fmt.px} onChange={(v, c) => S.set('width', v, c)} />
      <Slider label="Corners" v={S.get('radius', 0)} min={0} max={200} step={1} def={0} fmt={fmt.px} onChange={(v, c) => S.set('radius', v || null, c)} />
      <Opacity P={P} />
    </Sec>
    <Sec title="Box" end={<Ovr S={S} k="box" />}>
      {(['x', 'y', 'w', 'h'] as const).map((k) => <Slider key={k} label={{ x: 'Across', y: 'Down', w: 'Width', h: 'Height' }[k]} v={box[k] ?? 0} min={0} max={k === 'x' || k === 'w' ? W : H} step={1} fmt={fmt.px} onChange={(v, c) => setBox({ [k]: Math.round(v) }, c)} />)}
    </Sec>
    {item && <Sec title="Timing"><WholeVideo P={P} /><Entrance P={P} /></Sec>}
    <ClipTiming P={P} />
    <LayerState P={P} />
  </div>;
};

/** A film-effect layer: which filter, how strong, and (a clip) when it plays - fades at its ends. All the effect layers
 *  act together on everything below the top-most one (render/src/layers/effect_curve.js); texts above stay clean. */
export const EffectInspector: React.FC<InspectorProps> = (P) => {
  const { layer, item } = P;
  const S = useSettings(P);
  const kind = layer.props?.filter || 'grade';
  const F = FILTERS[kind] || { label: 'Effect', def: 0 };
  const strength = kind !== 'hits' && kind !== 'black';
  return <div className="ins">
    <Head icon={ICON.effect} title={layer.name || F.label} sub={item ? `${F.label} · clip ${item.id}` : `Effect layer · ${layer.items?.length || 0} clips`} />
    <Sec title="Effect">
      <Row label="Filter"><select className="ins-select" value={kind} onChange={(e) => S.layer({ filter: e.target.value, amount: null })}>
        {Object.entries(FILTERS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></Row>
      {strength && <Slider label={<>Strength <Ovr S={S} k="amount" /></>} v={S.get('amount', F.def)} min={0} max={1} step={0.01} def={F.def} fmt={fmt.pct} onChange={(v, c) => S.set('amount', v, c)} />}
      {kind === 'ghost' && <Slider label="Trail behind" v={layer.props?.ghost_lag ?? 0.2} min={0.05} max={0.6} step={0.01} def={0.2} fmt={fmt.s} onChange={(v, c) => S.layer({ ghost_lag: v }, c)} />}
      {(kind === 'zoom' || kind === 'hits' || kind === 'drift') && <>
        <Slider label="Centre across" v={(layer.props?.center || [0.5, 0.36])[0]} min={0} max={1} step={0.01} def={0.5} fmt={fmt.pct} onChange={(v, c) => S.layer({ center: [v, (layer.props?.center || [0.5, 0.36])[1]] }, c)} />
        <Slider label="Centre down" v={(layer.props?.center || [0.5, 0.36])[1]} min={0} max={1} step={0.01} def={0.36} fmt={fmt.pct} onChange={(v, c) => S.layer({ center: [(layer.props?.center || [0.5, 0.36])[0], v] }, c)} />
      </>}
      <Note>{kind === 'zoom' ? 'Zooms in over each clip and holds there.' : kind === 'hits' ? 'Each clip is an impact at its start: a punch-in, a shake, a flash.'
        : kind === 'black' ? 'Each clip is black.' : 'Fades in and out at the ends of each clip.'} Everything below the top effect layer is filtered; layers above it (texts, subtitles) stay clean. Live - the export uses the same curve.</Note>
    </Sec>
    {item && kind === 'hits' && <Sec title="This hit">
      <Slider label="Punch-in" v={item.kick ?? layer.props?.kick ?? 0.04} min={0} max={0.2} step={0.005} def={0.04} fmt={fmt.pct} onChange={(v, c) => S.item({ kick: v }, c)} />
      <Slider label="Shake" v={item.shake ?? layer.props?.shake ?? 0.3} min={0} max={1} step={0.01} def={0.3} fmt={fmt.pct} onChange={(v, c) => S.item({ shake: v }, c)} />
      <Slider label="Flash" v={item.flash ?? layer.props?.flash ?? 0} min={0} max={1} step={0.01} def={0} fmt={fmt.pct} onChange={(v, c) => S.item({ flash: v }, c)} />
    </Sec>}
    {item && strength && kind !== 'zoom' && <Sec title="Fades">
      <Slider label="Fade in" v={item.fade_in ?? 1.5} min={0} max={4} step={0.05} def={1.5} fmt={fmt.s} onChange={(v, c) => S.item({ fade_in: v }, c)} />
      <Slider label="Fade out" v={item.fade_out ?? 0.6} min={0} max={4} step={0.05} def={0.6} fmt={fmt.s} onChange={(v, c) => S.item({ fade_out: v }, c)} />
    </Sec>}
    <ClipTiming P={P} fades={false} />
    <LayerState P={P} />
  </div>;
};
