// A video layer (footage in a window): eye contact, cut-out, framing, look - and the selected clip's timing.
// Eye contact: an asset prepared with it has `eyes` (+ `eyes_fg` for the cut-out) - the same frames with the eyes
// brought to the lens (NVIDIA Maxine + our blink blend, v6 if NVIDIA failed, or his CapCut file); props.eyes picks
// it live (VideoTrack plays that variant), so Original / Corrected is a switch, never a job.
import React from 'react';
import { InspectorProps, useSettings, Head, Sec, Row, Note, Ovr, Seg, Chips, Slider, ToggleRow, Num, ClipTiming, LayerState, Opacity, ICON, fmt } from './controls';


/** Make (or redo) the corrected copies: NVIDIA (the best; our own v6 if it fails) or our own v6 with its strength,
 *  or - for one take - his CapCut eye-contact export of it. A job; the editor reloads the project when it ends. */
function EyesMake({ P, assets, made }: { P: InspectorProps; assets: string[]; made: boolean }) {
  const [mode, setMode] = React.useState<'nvidia' | 'neural'>('nvidia');
  const [strength, setStrength] = React.useState(1);
  const [dy, setDy] = React.useState(0.6);
  const [busy, setBusy] = React.useState(false);
  const go = async (args: any) => { if (!P.build) return; setBusy(true); try { await P.build('eyes', { assets, ...args }); } finally { setBusy(false); } };
  const secs = assets.reduce((t, a) => t + (P.project.assets?.[a]?.duration || 0), 0);
  return <>
    <Row label="Engine"><Seg options={[['nvidia', 'NVIDIA (best)'], ['neural', 'Our own (free)']]} value={mode} onPick={(v) => setMode(v as 'nvidia' | 'neural')} /></Row>
    {mode === 'neural' && <>
      <Slider label="Strength" v={strength} min={0} max={1} step={0.05} def={1} fmt={fmt.pct} onChange={(v) => setStrength(v)} />
      <Slider label="Up / down share" v={dy} min={0} max={1} step={0.05} def={0.6} fmt={fmt.pct} onChange={(v) => setDy(v)} />
    </>}
    <button className="btn primary" disabled={busy || !P.build || !assets.length} onClick={() => go({ mode, ...(mode === 'neural' ? { strength, dy } : {}) })}>
      {made ? 'Redo eye contact' : 'Make eye contact'}{assets.length > 1 ? ` · ${assets.length} takes` : ''}</button>
    {P.item && <button className="btn" disabled={busy || !P.build} onClick={() => P.pickAsset('video', (id) => go({ assets: [P.item.asset], files: { [P.item.asset]: `asset:${id}` } }))}>
      Use a CapCut eye-contact export…</button>}
    <Note>{mode === 'nvidia' ? 'NVIDIA Maxine + our blink blend - "better than CapCut". ' : 'Local and free, a little weaker on filter-drawn eyes. '}
      About {Math.max(1, Math.round(secs / 60))} min for {Math.round(secs)} s of footage; it runs in Jobs.{P.item ? ' A CapCut export must be the whole take, untrimmed.' : ''}</Note>
  </>;
}

const ENGINE: Record<string, string> = { nvidia: 'NVIDIA Maxine + blink blend', v6: 'Our own (v6)', capcut: "CapCut's export", file: 'From a file' };

const LOOKS: Record<string, { label: string; look: any }> = {
  none: { label: 'None', look: {} },
  punch: { label: 'Punch', look: { saturate: 1.2, contrast: 1.12 } },
  soft: { label: 'Soft', look: { contrast: 0.92, brightness: 1.04 } },
  bright: { label: 'Bright', look: { brightness: 1.1, saturate: 1.05 } },
  mono: { label: 'Mono', look: { saturate: 0 } },
};
const LOOK_KEYS = ['saturate', 'contrast', 'brightness'];
const same = (a: any, b: any) => LOOK_KEYS.every((k) => (a?.[k] ?? 1) === (b?.[k] ?? 1));

export const VideoInspector: React.FC<InspectorProps> = (P) => {
  const { project, layer, item } = P;
  const S = useSettings(P);
  const assetsUsed = [...new Set((item ? [item] : layer.items || []).map((i: any) => i.asset).filter(Boolean))] as string[];
  const A = (id: string) => project.assets?.[id] || {};
  const withEyes = assetsUsed.filter((id) => A(id).eyes);
  const engines = [...new Set(withEyes.map((id) => A(id).eyes_engine || 'file'))];
  const canCut = assetsUsed.some((id) => A(id).fg || A(id).matte);
  const eyes = S.get('eyes', withEyes.length > 0) !== false && withEyes.length > 0;
  const fit = S.get('fit', 'cover');
  const look = S.get('look', {}) || {};
  const lookName = Object.keys(LOOKS).find((k) => same(look, LOOKS[k].look)) || 'custom';
  const setLook = (patch: any, commit = true) => {
    const next = { ...look, ...patch };
    for (const k of LOOK_KEYS) if (next[k] === 1 || next[k] == null) next[k] = null;  // 1 = untouched: no key
    S.set('look', next, commit);
  };
  return <div className="ins">
    <Head icon={ICON.video} title={<>{layer.group ? `${layer.group} · ` : ''}{layer.name || 'Video'}</>} sub={item ? `Clip ${item.id} · video` : `Video layer · ${layer.items?.length || 0} clips`} />
    <ClipTiming P={P} source speedCtl />

    <Sec title="Eye contact" end={withEyes.length ? <span className="ins-state ok">{engines.map((e) => ENGINE[e] || e).join(' / ')}</span> : <span className="ins-state">not prepared</span>}>
      <Seg options={[[false, 'Original'], [true, 'Looking at the lens']]} value={eyes} disabled={!withEyes.length} onPick={(v) => S.set('eyes', v)} />
      {withEyes.length > 0 && withEyes.length < assetsUsed.length && <Note warn>Prepared for {withEyes.length} of {assetsUsed.length} takes - the others play as filmed.</Note>}
      {withEyes.length > 0 && <Note>Same frames, the eyes brought to the lens; closed and narrowed eyes stay as filmed. Switches live - the export uses the same choice.</Note>}
      <EyesMake P={P} assets={assetsUsed} made={withEyes.length > 0} />
    </Sec>

    <Sec title="Person">
      <ToggleRow label={<>Cut-out (person on the background) <Ovr S={S} k="cutout" /></>} on={!!S.get('cutout', false)} disabled={!canCut} onChange={(v) => S.set('cutout', v)} />
      {!canCut && <Note>No cut-out mask for these takes yet.</Note>}
    </Sec>

    <Sec title="Framing">
      <Row label={<>Fit <Ovr S={S} k="fit" /></>}><Seg options={[['cover', 'Fill'], ['face', 'Face'], ['contain', 'Whole']]} value={fit} onPick={(v) => S.set('fit', v)} /></Row>
      <Slider label={<>Zoom <Ovr S={S} k="zoom" /></>} v={S.get('zoom', 1)} min={fit === 'contain' ? 0.3 : 1} max={3} step={0.01} def={1} fmt={fmt.x} onChange={(v, c) => S.set('zoom', v, c)} />
      <Slider label={<>Left / right <Ovr S={S} k="x" /></>} v={S.get('x', 0)} min={-0.5} max={0.5} step={0.005} def={0} fmt={fmt.pct} onChange={(v, c) => S.set('x', v, c)} />
      <Slider label={<>Up / down <Ovr S={S} k="y" /></>} v={S.get('y', 0)} min={-0.5} max={0.5} step={0.005} def={0} fmt={fmt.pct} onChange={(v, c) => S.set('y', v, c)} />
      {fit === 'face' && <Slider label={<>Head at <Ovr S={S} k="head" /></>} v={S.get('head', 0.09)} min={0} max={0.45} step={0.005} def={0.09} fmt={fmt.pct} onChange={(v, c) => S.set('head', v, c)} />}
      <Slider label={<>Corners <Ovr S={S} k="radius" /></>} v={S.get('radius', 0)} min={0} max={80} step={1} def={0} fmt={fmt.px} onChange={(v, c) => S.set('radius', v || null, c)} />
      {item && <Row label="Above others"><Num value={item.z ?? 0} step={1} min={0} max={9} digits={0} onCommit={(v) => S.item({ z: v || null })} /></Row>}
    </Sec>

    <Sec title="Look" end={<Ovr S={S} k="look" />}>
      <Chips options={[...Object.entries(LOOKS).map(([k, l]) => [k, l.label] as [string, string]), ...(lookName === 'custom' ? [['custom', 'Custom'] as [string, string]] : [])]}
        value={lookName} onPick={(k) => k !== 'custom' && S.set('look', Object.fromEntries(LOOK_KEYS.map((x) => [x, LOOKS[k].look[x] ?? null])))} />
      <Slider label="Colour" v={look.saturate ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.pct} onChange={(v, c) => setLook({ saturate: v }, c)} />
      <Slider label="Contrast" v={look.contrast ?? 1} min={0.5} max={1.5} step={0.01} def={1} fmt={fmt.pct} onChange={(v, c) => setLook({ contrast: v }, c)} />
      <Slider label="Brightness" v={look.brightness ?? 1} min={0.5} max={1.5} step={0.01} def={1} fmt={fmt.pct} onChange={(v, c) => setLook({ brightness: v }, c)} />
      <Opacity P={P} />
    </Sec>
    <LayerState P={P} />
  </div>;
};
