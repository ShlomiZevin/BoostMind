// A text layer (the POV hook, labels, name tags, notices, stamps) and a subtitles layer - the words, their style
// (render/src/layers/styles.tsx), where they sit, when, and how they come in.
import React from 'react';
import { TEXT_STYLES, SUB_STYLES } from '../../../src/layers/styles';
import { InspectorProps, useSettings, Head, Sec, Row, Note, Ovr, Seg, Chips, Slider, ToggleRow, Num, Anchor, Swatches, ClipTiming, LayerState, Entrance, WholeVideo, Opacity, ICON, fmt } from './controls';
import { popAnim, blinkAnim, hasPop, hasBlink, mergeAnim } from '../../../src/layers/entrances_solo.js';

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

/** One word / number knob typed in (saved when the field is left; empty = the style's default). */
function Field({ S, k, label, ph, num, id }: { S: ReturnType<typeof useSettings>; k: string; label: string; ph?: string; num?: boolean; id: string }) {
  const v = S.get(k);
  return <Row label={label}><input className="ins-select he" key={`${id}.${k}.${v ?? ''}`} defaultValue={v ?? ''} placeholder={ph} dir="auto"
    onBlur={(e) => { const s = e.target.value.trim(); const nv = s === '' ? null : num && !isNaN(+s) ? +s : s; if (nv !== (v ?? null)) S.set(k, nv); }}
    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></Row>;
}

/** The one-camera engine's entrances, as the item's anim keyframes (entrances_solo.js): the spring pop and the blink. */
function OldEntrances({ P }: { P: InspectorProps }) {
  const S = useSettings(P);
  const it = P.item;
  if (!it) return null;
  const d = it.dur / P.fps;
  return <>
    <ToggleRow label="Springs in (and shrinks away)" on={hasPop(it.anim, d)} onChange={(on) => S.item({ anim: mergeAnim(it.anim, { scale: on ? popAnim(d).scale : null }) })} />
    <ToggleRow label="Blinks" on={hasBlink(it.anim, d)} onChange={(on) => S.item({ anim: mergeAnim(it.anim, { opacity: on ? blinkAnim(d).opacity : null }) })} />
  </>;
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
    <Slider label="Left / right" v={box.x ?? W / 2} min={0} max={W} step={1} def={W / 2} fmt={fmt.px} onChange={(v, c) => setBox({ x: v }, c)} />
    <Slider label="Up / down" v={box.y ?? 0} min={0} max={H} step={1} fmt={fmt.px} onChange={(v, c) => setBox({ y: v }, c)} />
    <Slider label="Wrap width" v={box.w ?? W} min={120} max={W} step={10} def={W} fmt={fmt.px} onChange={(v, c) => setBox({ w: v >= W ? null : v }, c)} />
  </Sec>;
}

export const TextInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer, item } = P;
  const S = useSettings(P);
  const style = S.get('style', 'plain');
  const fs = fonts(project);
  const fid = item?.id ?? layer.id, W = project.canvas.w;
  const setBox = (patch: any) => {  // (a null drops the key)
    const b: any = { ...((item ? item.box : null) || layer.props?.box || {}), ...patch };
    for (const k of Object.keys(b)) if (b[k] == null) delete b[k];
    return item ? S.item({ box: b }) : S.layer({ box: b });
  };
  const size = (d: number, max = 160) =><Slider label={<>Size <Ovr S={S} k="size" /></>} v={S.get('size', d)} min={12} max={max} step={1} def={d} fmt={fmt.px} onChange={(v, c) => S.set('size', v, c)} />;
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
      {style === 'thought' && <>
        {size(70)}
        <Row label="Motion"><Seg options={[['', 'Drift'], ['horror', 'Horror']]} value={S.get('motion', '') || ''} onPick={(v) => S.set('motion', v || null)} /></Row>
        {S.get('motion') === 'horror' && <Slider label={<>Stays after his voice <Ovr S={S} k="hold" /></>} v={S.get('hold', 0.35)} min={0} max={2} step={0.05} def={0.35} fmt={fmt.s} onChange={(v, c) => S.set('hold', v, c)} />}
        {S.get('motion') === 'horror' && <Slider label={<>Grows to <Ovr S={S} k="grow" /></>} v={S.get('grow', 1)} min={1} max={2} step={0.05} def={1} fmt={fmt.x} onChange={(v, c) => S.set('grow', v === 1 ? null : v, c)} />}
        <ToggleRow label="In its own spot (wanders less)" on={!!S.get('placed')} onChange={(on) => S.set('placed', on || null)} />
        <Note>The words come in one by one, the line floats up and blurs away at the clip's end. Horror: they slam in as he says them, the line grows, then turns to dust.</Note>
      </>}
      {style === 'market' && <>
        <Field S={S} id={fid} k="symbol" label="Coin" ph="LMTS" />
        <Field S={S} id={fid} k="name" label="Name" ph="מטבע קריפטו" />
        <Field S={S} id={fid} k="price" label="Price $" ph="0.0847" num />
        <Field S={S} id={fid} k="change" label="Change %" ph="95.4" num />
        <Field S={S} id={fid} k="tag" label="Tag" ph="מבזק" />
        <Field S={S} id={fid} k="updated" label="Updated" ph="עודכן: אתמול" />
        <Field S={S} id={fid} k="call" label="The call" ph="ההמלצה יצאה" />
        <Field S={S} id={fid} k="rise" label="Under the rise" ph="ביום אחד" />
        <Field S={S} id={fid} k="span" label="Beside the change" ph="24 שעות" />
        <Field S={S} id={fid} k="fine" label="Fine print" ph="אין לראות באמור ייעוץ השקעות" />
        <Slider label={<>Width <Ovr S={S} k="w" /></>} v={S.get('w', 960)} min={560} max={1040} step={10} def={960} fmt={fmt.px} onChange={(v, c) => S.set('w', v, c)} />
        <Slider label={<>Chart starts <Ovr S={S} k="draw" /></>} v={S.get('draw', 0.3)} min={0} max={8} step={0.1} def={0.3} fmt={(v) => `${v.toFixed(1)} s`} onChange={(v, c) => S.set('draw', v, c)} />
        <Slider label={<>After the call <Ovr S={S} k="dump" /></>} v={S.get('dump', 0.07)} min={0} max={0.3} step={0.01} def={0.07} fmt={(v) => `-${Math.round(v * 100)}%`} onChange={(v, c) => S.set('dump', v, c)} />
        <Note>The text above is the section's name. The chart draws in: the day before yesterday flat, yesterday the rise, today the call - after the rise.</Note>
      </>}
      {style === 'sticker' && <>
        <Row label="Moves"><Seg options={[['pop', 'Pops in'], ['rain', 'Rains down']]} value={S.get('motion') === 'rain' ? 'rain' : 'pop'}
          onPick={(v) => { S.set('motion', v); setBox(v === 'rain' ? { x: 0, y: 0, anchor: 'tl', w: null } : { x: W / 2, y: 700, anchor: 'c', w: null }); }} /></Row>
        <Row label="Picture"><button className="btn" onClick={() => P.pickAsset('image', (id) => S.set('image', id))}>{S.get('image') ? 'Replace picture' : 'Pick a picture'}</button>
          {S.get('image') && <button className="btn ghost" onClick={() => S.set('image', null)}>Use the text</button>}</Row>
        {S.get('motion') === 'rain'
          ? <>
            <Slider label={<>Bill size <Ovr S={S} k="w" /></>} v={S.get('w', 260)} min={120} max={1000} step={10} def={260} fmt={fmt.px} onChange={(v, c) => S.set('w', v, c)} />
            <Slider label={<>How many <Ovr S={S} k="count" /></>} v={S.get('count', 22)} min={4} max={60} step={1} def={22} onChange={(v, c) => S.set('count', v, c)} />
          </>
          : <>
            <Slider label={<>Size <Ovr S={S} k="w" /></>} v={S.get('w', 520)} min={120} max={1000} step={10} def={520} fmt={fmt.px} onChange={(v, c) => S.set('w', v, c)} />
            <Slider label={<>Tilt <Ovr S={S} k="rot" /></>} v={S.get('rot', -6)} min={-30} max={30} step={1} def={-6} fmt={(v) => `${v}°`} onChange={(v, c) => S.set('rot', v, c)} />
          </>}
        <Note>Without a picture the clip's text is the sticker (an emoji or a word).{S.get('image') ? ' A picture shows once the composition hands text styles its asset links.' : ''}</Note>
      </>}
      {style === 'card' && <>
        <Row label="Looks like"><Seg options={[['', 'Instagram'], ['tiktok', 'TikTok reply']]} value={S.get('variant', '') || ''} onPick={(v) => S.set('variant', v || null)} /></Row>
        {size(44, 90)}
        <Slider label={<>Width <Ovr S={S} k="w" /></>} v={S.get('w', 860)} min={400} max={1040} step={10} def={860} fmt={fmt.px} onChange={(v, c) => S.set('w', v, c)} />
        <Field S={S} id={fid} k="asker" label="Who asked" ph="@user" />
        {S.get('variant') === 'tiktok' ? <>
          <Field S={S} id={fid} k="user" label="Avatar letter from" ph="@user" />
          <Row label="Avatar"><Swatches value={S.get('avatar_color', '#c58b6b')} colors={['#c58b6b', '#6b8bc5', '#7bb36a', '#b36aa8']} onPick={(c) => S.set('avatar_color', c)} /></Row>
        </> : <>
          <Field S={S} id={fid} k="label" label="Prompt" ph="שאלו אותי שאלה" />
          <Slider label={<>Prompt size <Ovr S={S} k="label_size" /></>} v={S.get('label_size', Math.round(S.get('size', 44) * 0.85))} min={16} max={80} step={1} def={Math.round(S.get('size', 44) * 0.85)} fmt={fmt.px} onChange={(v, c) => S.set('label_size', v, c)} />
          <Row label="Prompt bar"><Swatches value={S.get('accent', '#262626')} colors={['#262626', '#8a3ab9', '#e1306c', '#0b3d91']} onPick={(c) => S.set('accent', c)} /></Row>
          <Slider label={<>Card <Ovr S={S} k="box_opacity" /></>} v={S.get('box_opacity', 1)} min={0} max={1} step={0.05} def={1} fmt={fmt.pct} onChange={(v, c) => S.set('box_opacity', v === 1 ? null : v, c)} />
        </>}
      </>}
      {style === 'lower3' && <>
        {size(46, 90)}
        <Slider label={<>Band <Ovr S={S} k="box_opacity" /></>} v={S.get('box_opacity', 0.94)} min={0} max={1} step={0.02} def={0.94} fmt={fmt.pct} onChange={(v, c) => S.set('box_opacity', v, c)} />
        <Row label="Tag"><Swatches value={S.get('tag_color', '#d0121b')} colors={['#d0121b', '#111111', '#f0b90b']} onPick={(c) => S.set('tag_color', c)} /></Row>
        <Row label="Band"><Swatches value={S.get('band_color', '#0a265c')} colors={['#0a265c', '#111111', '#3a3a3a']} onPick={(c) => S.set('band_color', c)} /></Row>
        <Note>Write "tag | text": the words before the bar go in the red tag.</Note>
      </>}
      {['pov', 'plain', 'ticker', 'thought', 'market', 'lower3'].includes(style) && fs.length > 0 &&<Row label="Font"><select className="ins-select" value={S.get('font', '')} onChange={(e) => S.set('font', e.target.value || null)}>
        <option value="">The app font</option>{fs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></Row>}
    </Sec>
    <Place P={P} />
    {item && <Sec title="Timing"><WholeVideo P={P} /><Entrance P={P} /><OldEntrances P={P} /><Opacity P={P} /></Sec>}
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
