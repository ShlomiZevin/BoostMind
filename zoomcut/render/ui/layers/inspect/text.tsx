// A text layer (the POV hook, labels, name tags, notices, stamps) and a subtitles layer - the words, their style
// (render/src/layers/styles.tsx), where they sit, when, and how they come in.
import React from 'react';
import { TEXT_STYLES, SUB_STYLES } from '../../../src/layers/styles';
import { InspectorProps, useSettings, Head, Sec, Row, Note, Ovr, Seg, Chips, Slider, ToggleRow, Num, Anchor, Swatches, ClipTiming, LayerState, Entrance, WholeVideo, Opacity, ICON, fmt } from './controls';

const WHITE_ETC = ['#ffffff', '#ffd23f', '#ff6b57', '#111111'];
const TEXT_ANCHORS = ['tl', 't', 'tr', 'c', 'bl', 'b', 'br'];

/** The words of the selected item (Enter = a new line, saved when the field is left). */
function Words({ P, rows = 3 }: { P: InspectorProps; rows?: number }) {
  const it = P.item;
  const S = useSettings(P);
  if (!it) return null;
  return <textarea className="ins-text he" rows={rows} key={it.id} defaultValue={it.text ?? ''} dir="auto"
    onBlur={(e) => e.target.value !== (it.text ?? '') && S.item({ text: e.target.value })} />;
}

function fonts(project: any) {
  return Object.entries<any>(project.assets || {}).filter(([, a]) => a.kind === 'font').map(([id, a]) => [id, a.family || id] as [string, string]);
}

function Place({ P }: { P: InspectorProps }) {
  const { project, item } = P;
  const S = useSettings(P);
  const box = S.get('box', {}) || {};
  const W = project.canvas.w, H = project.canvas.h;
  const setBox = (patch: any, commit = true) => (item ? S.item({ box: { ...(item.box || {}), ...patch } }, commit) : S.layer({ box: { ...box, ...patch } }, commit));
  return <Sec title="Position" end={<Ovr S={S} k="box" />}>
    <Row label="Hangs from"><Anchor value={box.anchor || 'tl'} allowed={TEXT_ANCHORS} onPick={(a) => setBox({ anchor: a })} /></Row>
    <Slider label="Across" v={box.x ?? W / 2} min={0} max={W} step={1} def={W / 2} fmt={fmt.px} onChange={(v, c) => setBox({ x: v }, c)} />
    <Slider label="Down" v={box.y ?? 0} min={0} max={H} step={1} fmt={fmt.px} onChange={(v, c) => setBox({ y: v }, c)} />
    <Slider label="Wrap width" v={box.w ?? W} min={120} max={W} step={10} def={W} fmt={fmt.px} onChange={(v, c) => setBox({ w: v >= W ? null : v }, c)} />
  </Sec>;
}

export const TextInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer, item } = P;
  const S = useSettings(P);
  const style = S.get('style', 'plain');
  const fs = fonts(project);
  const size = (d: number, max = 160) => <Slider label={<>Size <Ovr S={S} k="size" /></>} v={S.get('size', d)} min={12} max={max} step={1} def={d} fmt={fmt.px} onChange={(v, c) => S.set('size', v, c)} />;
  return <div className="ins">
    <Head icon={ICON.text} title={layer.name || 'Text'} sub={item ? `Text ${item.id}` : `Text layer · ${layer.items?.length || 0} items`} />
    {item && <Sec title="Text"><Words P={P} />
      <Note>{'{clock}'} = a running mm:ss timer.</Note></Sec>}
    <Sec title="Style" end={<Ovr S={S} k="style" />}>
      <Chips options={Object.entries(TEXT_STYLES).map(([k, s]) => [k, s.label] as [string, string])} value={style} onPick={(k) => S.set('style', k)} />
      {style === 'pov' && <>
        <Row label="Theme"><Seg options={[['light', 'Light'], ['dark', 'Dark'], ['gold', 'Gold']]} value={S.get('theme', 'light')} onPick={(v) => S.set('theme', v)} /></Row>
        {size(48)}
      </>}
      {style === 'plain' && <>
        {size(30)}
        <Row label="Colour"><Swatches value={S.get('color', '#ffffff')} colors={WHITE_ETC} onPick={(c) => S.set('color', c)} /></Row>
        <Row label="Weight"><Seg options={[[400, 'Regular'], [600, 'Bold'], [800, 'Heavy']]} value={S.get('weight', 600)} onPick={(v) => S.set('weight', v)} /></Row>
        <Slider label="Outline" v={S.get('stroke', 0)} min={0} max={20} step={1} def={0} fmt={(v) => (v ? `${v} px` : 'off')} onChange={(v, c) => S.set('stroke', v || null, c)} />
        <Row label="Align"><Seg options={[['right', 'Right'], ['center', 'Centre'], ['left', 'Left']]} value={S.get('align', 'center')} onPick={(v) => S.set('align', v)} /></Row>
      </>}
      {style === 'tag' && <Row label="Size"><Seg options={[[32, 'Big tile'], [26, 'Small tile']]} value={S.get('size', 32)} onPick={(v) => S.set('size', v)} /></Row>}
      {style === 'toast' && <>{size(44)}<ToggleRow label="Icon" on={S.get('icon') !== 'none'} onChange={(on) => S.set('icon', on ? null : 'none')} /></>}
      {style === 'pill' && <>
        {size(64)}
        <Row label="Fill"><Swatches value={S.get('bg', '#e02828')} colors={['#e02828', '#111111', '#ffffff', '#ffd23f']} onPick={(c) => S.set('bg', c)} /></Row>
        <Row label="Letters"><Swatches value={S.get('color', '#ffffff')} colors={WHITE_ETC} onPick={(c) => S.set('color', c)} /></Row>
      </>}
      {style === 'ticker' && <>
        {size(46)}
        <Slider label={<>Speed <Ovr S={S} k="speed" /></>} v={S.get('speed', 120)} min={20} max={400} step={5} def={120} fmt={(v) => `${v} px/s`} onChange={(v, c) => S.set('speed', v, c)} />
        <Row label="Letters"><Seg options={[['white', 'White'], ['gold', 'Gold']]} value={S.get('theme') === 'gold' ? 'gold' : 'white'} onPick={(v) => S.set('theme', v === 'gold' ? 'gold' : null)} /></Row>
        <Row label="Strip"><Swatches value={S.get('bg', '')} colors={['#000000', '#b3001b', '#0b3d91']} onPick={(c) => S.set('bg', c)} /></Row>
        {S.get('bg') && <button className="btn ghost" onClick={() => S.set('bg', null)}>No strip</button>}
      </>}
      {['pov', 'plain', 'ticker'].includes(style) && fs.length > 0 && <Row label="Font"><select className="ins-select" value={S.get('font', '')} onChange={(e) => S.set('font', e.target.value || null)}>
        <option value="">The app font</option>{fs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></Row>}
    </Sec>
    <Place P={P} />
    {item && <Sec title="Timing"><WholeVideo P={P} /><Entrance P={P} /><Opacity P={P} /></Sec>}
    <ClipTiming P={P} />
    <LayerState P={P} />
  </div>;
};

export const SubtitlesInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer, item } = P;
  const S = useSettings(P);
  const style = layer.props?.style || 'zoom';
  const H = project.canvas.h;
  const box = layer.props?.box || { x: project.canvas.w / 2, y: H - 300, anchor: 'b' };
  return <div className="ins">
    <Head icon={ICON.subtitles} title={layer.name || 'Subtitles'} sub={item ? `Line ${item.id}${item.who ? ' · ' + item.who : ''}` : `Subtitles · ${layer.items?.length || 0} lines`} />
    {item && <Sec title="Line">
      <Words P={P} rows={2} />
      <Row label="Who"><input className="ins-select he" key={item.id} defaultValue={item.who || ''} dir="auto" onBlur={(e) => e.target.value !== (item.who || '') && S.item({ who: e.target.value || null })} /></Row>
      <ToggleRow label="Said on the side (amber, above)" on={!!item.side} onChange={(on) => S.item({ side: on || null })} />
    </Sec>}
    <Sec title="Style">
      <Seg options={Object.entries(SUB_STYLES).map(([k, s]) => [k, s.label.split(' (')[0]] as [string, string])} value={style} onPick={(k) => S.layer({ style: k })} />
      <Slider label="Size" v={layer.props?.size ?? (style === 'outline' ? 64 : 46)} min={20} max={110} step={1} def={style === 'outline' ? 64 : 46} fmt={fmt.px} onChange={(v, c) => S.layer({ size: v }, c)} />
      <Row label="Colour"><Swatches value={layer.props?.color || '#ffffff'} colors={WHITE_ETC} onPick={(c) => S.layer({ color: c })} /></Row>
      {style === 'zoom' && <ToggleRow label="Speaker's name first" on={layer.props?.label !== false} onChange={(on) => S.layer({ label: on ? null : false })} />}
    </Sec>
    <Sec title="Position">
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        <div style={{ width: 54, aspectRatio: '9 / 16', border: '1px solid var(--edge-2)', borderRadius: 6, position: 'relative', background: 'var(--app)', flex: 'none' }}>
          <div style={{ position: 'absolute', left: 6, right: 6, height: 5, borderRadius: 2, background: 'var(--accent)', top: `calc(${(box.y / H) * 100}% - 5px)` }} />
        </div>
        <div style={{ flex: 1 }}>
          <Slider label="Bottom at" v={box.y} min={H * 0.3} max={H} step={1} def={H - 300} fmt={(v) => fmt.pct(v / H)} onChange={(v, c) => S.layer({ box: { ...box, y: Math.round(v) } }, c)} />
          <Note>Lines on screen together stack upwards from here.</Note>
        </div>
      </div>
    </Sec>
    {item && <ClipTiming P={P} fades={false} />}
    <LayerState P={P} />
  </div>;
};
