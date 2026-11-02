// A sound clip's panel - designed with an OpenAI UX consult (gpt-5.6-terra, 2026-11-02) after his note "unclear - it has
// to be super simple and most convenient; no folding inside folding". The first screen = what he does most: loudness,
// fades, cleaning, voice style, hearing the lane. Groups always open and NOTHING folded (his note: "no more levels,
// everything super easy and clear"); a voice style is one click and sets every slider below it, which he then
// adjusts (the way he liked it). Plain words (no audio jargon). The panel knows the lane: a VOICE gets Voice; MUSIC and SOUND EFFECTS skip it and show "Lower the voices"
// up front (music also "Raise after the talking"). Timing, split, delete and the lane's own settings are windows
// (Timing / Lane at the bottom). Engine: cleaning = pipeline/layers_audio.py (prepared), voice style = sound.ts
// (live), fun sound = soundfx.ts (live) - the export renders the same.
import React, { useState } from 'react';
import { VOICE_PRESETS } from '../../sound';
import { FILTERS } from '../../soundfx';
import { InspectorProps, useSettings, Head, Sec, Row, Note, Chips, Slider, ToggleRow, ClipTiming, LayerState, PanelEnd, ICON, fmt } from './controls';

const CLEAN: [string, string][] = [['off', 'Off'], ['mild', 'Mild'], ['fft', 'Standard'], ['strong', 'Strong'], ['nn', 'Best']];
const CLEAN_NOTE: Record<string, string> = {
  off: '', mild: 'Light hiss and room tone out.', fft: 'Steady hiss and room tone out.',
  strong: 'Noisy rooms - can thin the voice.', nn: 'Takes out air-conditioner and fan hum, keeps the voice.',
};
// the voice styles, plain: "Plain" = no style (raw is the same to him - shown only on a lane that has it)
const STYLES = ['natural', 'podcast', 'warm', 'bright', 'news', 'radio', 'hall', 'stage'];
const fxPatch = (fx: any, patch: any) => { const n = { ...(fx || {}), ...patch }; for (const k of Object.keys(n)) if (n[k] == null) delete n[k]; return Object.keys(n).length ? n : null; };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const sdb = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;
const pct0 = (v: number) => (v ? `${Math.round(v * 100)}%` : 'off');
const semis = (v: number) => (v ? `${v > 0 ? '+' : ''}${v}` : 'normal');

/** voice / music / effect - from what the lane holds (a voice chain or his takes = a voice; a bed's name = music) */
export function laneKind(layer: any): 'voice' | 'music' | 'effect' {
  const name = `${layer.id} ${layer.name || ''} ${layer.group || ''}`.toLowerCase();
  if (layer.props?.voice || (layer.items || []).some((i: any) => i.ref?.take != null || i.ref?.line != null) || /voice|קול/.test(name)) return 'voice';
  if (layer.props?.lift || /music|מוזיק|bed|beat|song|שיר/.test(name)) return 'music';
  return 'effect';
}

export const AudioInspector: React.FC<InspectorProps> = (P) => {
  const { layer, item, send } = P;
  const S = useSettings(P);
  const props = layer.props || {};
  const kind = laneKind(layer);
  const voice = props.voice || null;
  const v = (k: string, d: number) => voice?.[k] ?? d;
  const setVoice = (patch: any, commit = true) => S.layer({ voice: { ...(voice || { preset: 'natural', ...VOICE_PRESETS.natural }), ...patch, preset: patch.preset ?? 'custom' } }, commit);
  const pickStyle = (k: string) => (k === 'plain' ? S.layer({ voice: null }) : S.layer({ voice: { preset: k, ...VOICE_PRESETS[k] } }));
  const hold = (on: boolean) => voice && send([{ op: 'layer.update', id: layer.id, props: { voice: { ...voice, bypass: on || null } } }], { commit: false });
  const clean = props.clean || 'off';
  const style = voice ? voice.preset || 'custom' : 'plain';
  const styles = [...STYLES, ...(['raw', 'custom'].includes(style) ? [style] : [])];
  // fun sound: on this clip or the whole lane - one set of controls, one switch
  const [scope, setScope] = useState<'clip' | 'lane'>('clip');
  const onClip = !!item && scope === 'clip';
  const fx = (onClip ? item.fx : props.fx) || {};
  const setFx = (patch: any, c: boolean) => (onClip ? S.item({ fx: fxPatch(item.fx, patch) }, c) : S.layer({ fx: fxPatch(props.fx, patch) }, c));
  const dur = item ? item.dur / P.fps : 0;
  const lower = item && <Slider label="Lower the voices while it plays" v={-(item.duck || 0)} min={0} max={24} step={0.5} def={0} fmt={(x) => (x ? `−${x} dB` : 'off')}
    onChange={(x, c) => S.item({ duck: x ? -x : null }, c)} />;
  const rise = <>
    <Slider label="Raise it after the talking ends" v={props.lift?.db || 0} min={0} max={14} step={0.5} def={0} fmt={(x) => (x ? `+${x} dB` : 'off')}
      onChange={(x, c) => S.layer({ lift: x ? { fade: 1.2, of: 'subs', ...(props.lift || {}), db: x } : null }, c)} />
    {props.lift?.db ? <Slider label="Over" v={props.lift.fade ?? 1.2} min={0.2} max={4} step={0.1} def={1.2} fmt={(x) => `${x.toFixed(1)} s`}
      onChange={(x, c) => S.layer({ lift: { ...props.lift, fade: x } }, c)} /> : null}
  </>;

  return <div className="ins">
    <Head icon={ICON.audio} title={<>{layer.group ? `${layer.group} · ` : ''}{layer.name || 'Sound'}</>}
      sub={`${kind === 'voice' ? 'Voice' : kind === 'music' ? 'Music' : 'Sound effect'}${item ? ` · clip ${item.id}` : ` · ${layer.items?.length || 0} clips`}`} />

    <Sec title="Loudness">
      {item && <Slider label="This clip only" v={item.gain ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(g, c) => S.item({ gain: g === 1 ? null : g }, c)} />}
      <Slider label="All clips in this row" v={props.volume ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(x, c) => S.layer({ volume: x }, c)} />
      {item && <>
        <Slider label="Fade in" v={item.fade_in ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(x, c) => S.item({ fade_in: x || null }, c)} />
        <Slider label="Fade out" v={item.fade_out ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(x, c) => S.item({ fade_out: x || null }, c)} />
      </>}
      <ToggleRow label="Sound on" on={!layer.muted} onChange={(on) => S.layerSet({ muted: !on })} />
      {lower}
      {kind === 'music' && rise}
    </Sec>

    {kind === 'voice' && <Sec title="Voice" end={<span className="ins-state">all of this row</span>}>
      <Row label="Clean the noise"><Chips options={CLEAN} value={clean} onPick={(c) => S.layer({ clean: c === 'off' ? null : c })} /></Row>
      {CLEAN_NOTE[clean] && <Note>{CLEAN_NOTE[clean]}</Note>}
      <Row label="Voice style"><Chips options={[['plain', 'Plain'] as [string, string], ...styles.map((k) => [k, cap(k)] as [string, string])]} value={style} onPick={pickStyle} /></Row>
      <Note>A style sets the sliders below - then adjust any of them.</Note>
      <Slider label="Clearer words" v={voice ? v('presence', 0) : props.presence ?? 0} min={-6} max={8} step={0.5} def={0} fmt={sdb}
        onChange={(x, c) => (voice ? setVoice({ presence: x }, c) : S.layer({ presence: x || null }, c))} />
      <Slider label="Room around the voice" v={v('room', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ room: x }, c)} />
      <Slider label="Room size" v={v('roomSize', 1.6)} min={0.4} max={3} step={0.1} def={1.6} fmt={(x) => `${x.toFixed(1)} s`} onChange={(x, c) => setVoice({ roomSize: x }, c)} disabled={!v('room', 0)} />
      <Slider label="Speaker echo" v={v('pa', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ pa: x }, c)} />
      <Slider label="Remove low rumble" v={v('lowcut', voice ? 60 : 0)} min={0} max={200} step={5} def={60} fmt={(x) => (x ? `${x} Hz` : 'off')} onChange={(x, c) => setVoice({ lowcut: x }, c)} />
      <Slider label="Warmth" v={v('warmth', 0)} min={-6} max={6} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ warmth: x }, c)} />
      <Slider label="Less boxy" v={-v('box', 0)} min={-3} max={6} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ box: -x }, c)} />
      <Slider label="Softer s sounds" v={v('deess', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ deess: x }, c)} />
      <Slider label="Louder quiet parts" v={v('comp', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ comp: x }, c)} />
      <ToggleRow label="Keep the speech even" on={props.level === 'speech'} onChange={(on) => S.layer({ level: on ? 'speech' : null })} />
      {voice && <button className="btn" onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)}
        title="Hold while it plays: the voice without its style">Hold to hear the original</button>}
    </Sec>}

    <Sec title="Fun sound" end={item ? <span className="ins-scope-sw">
      <button className={scope === 'clip' ? 'on' : ''} onClick={() => setScope('clip')}>This clip only</button>
      <button className={scope === 'lane' ? 'on' : ''} onClick={() => setScope('lane')}>All in this row</button></span> : <span className="ins-state">all of this row</span>}>
      <Row label="Sounds like"><Chips options={[['', 'Itself'] as [string, string], ...Object.entries(FILTERS).map(([k, x]) => [k, x.label] as [string, string])]} value={fx.filter || ''}
        onPick={(k) => setFx({ filter: k || null }, true)} /></Row>
      {fx.filter === 'echo' && <Slider label="Echo strength" v={fx.echo ?? 1} min={0} max={2} step={0.05} def={1} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(x, c) => setFx({ echo: x }, c)} />}
      <Slider label="Higher / lower" v={fx.pitch || 0} min={-12} max={12} step={0.5} def={0} fmt={semis} onChange={(x, c) => setFx({ pitch: x || null }, c)} />
      <Slider label="Room sound" v={fx.room || 0} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setFx({ room: x || null }, c)} />
      <Slider label="Room size" v={fx.roomSize ?? 1.6} min={0.4} max={3} step={0.1} def={1.6} fmt={(x) => `${x.toFixed(1)} s`} onChange={(x, c) => setFx({ roomSize: x }, c)} disabled={!fx.room} />
      {onClip && <ToggleRow label="Soften a shout" on={!!item.soften} onChange={(on) => S.item({ soften: on || null })} />}
    </Sec>

    <PanelEnd P={P} timing={<ClipTiming P={P} source speedCtl fades={false} />}
      lane={<LayerState P={P} sound><ToggleRow label="Keep its own pace (not sped up with the video)" on={!!props.own_pace} onChange={(on) => S.layer({ own_pace: on || null })} /></LayerState>} />
  </div>;
};
