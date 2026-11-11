// A sound's panel - ONE place (his note, 2026-11-03: "I can't find myself there... Voice style and Sounds like, two
// sections, I don't know the difference... volume very highlighted, then the simple ones, then the advanced - all
// visible, no hierarchy, but clear what's everyday and what's for special cases"). Structure from an OpenAI UX consult
// (gpt-5.6-terra): what it edits at the top (Whole row | This clip - the clip wins over its row, only volume adds up,
// ui/layergraph.ts soundOf), Volume big, "Sounds like" = the sound setups (src/layers/setups.js: one click sets the
// cleaning, the voice and the effects; a changed one asks once whether to save it), Pitch and the everyday switches,
// then "Special cases" - every fine control, visible, quieter. One Room (the voice chain's when there is one, else the
// effects'). Engine: cleaning = prepared files (pipeline/layers_audio.py), voice = sound.ts, effects = soundfx.ts -
// all live, the export runs the same graph. Timing and the row's own settings are windows (bottom).
import React, { useEffect, useState } from 'react';
import { VOICE_PRESETS } from '../../sound';
import { soundOf } from '../../layergraph';
import { allSetups, setupOps, soundNow, sameAsSetup, setupFrom } from '../../../src/layers/setups.js';
import { askText } from '../ask';
import { fmtT } from '../api';
import { InspectorProps, laneKind, useSettings, Head, Sec, Row, Note, Chips, Slider, ToggleRow, ClipTiming, LayerState, PanelEnd, ICON, fmt } from './controls';

const CLEAN: [string, string][] = [['off', 'Off'], ['mild', 'Mild'], ['fft', 'Standard'], ['strong', 'Strong'], ['nn', 'NN (best)']];
const CLEAN_NOTE: Record<string, string> = {
  off: '', mild: 'Light hiss and room tone out.', fft: 'Steady hiss and room tone out.',
  strong: 'Noisy rooms - can thin the voice.', nn: 'NN = RNNoise, the neural cleaner: takes out air-conditioner and fan hum and keeps the voice.',
};
const fxPatch = (fx: any, patch: any) => { const n = { ...(fx || {}), ...patch }; for (const k of Object.keys(n)) if (n[k] == null) delete n[k]; return Object.keys(n).length ? n : null; };
const sdb = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;
const pct0 = (v: number) => (v ? `${Math.round(v * 100)}%` : 'off');
const semis = (v: number) => (v ? `${v > 0 ? '+' : ''}${v}` : 'normal');
const OWN_KEYS = ['voice', 'fx', 'presence', 'clean', 'level', 'setup'];

export { laneKind };

// his saved setups (GET /api/setups), shared by every open panel
let savedCache: any[] | null = null;
const savedSubs = new Set<(s: any[]) => void>();
const loadSaved = () => fetch('/api/setups').then((r) => r.json()).then((j) => { savedCache = j.setups || []; savedSubs.forEach((f) => f(savedCache!)); }).catch(() => {});
const postSetup = (setup: any) => fetch('/api/setups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ setup }) })
  .then((r) => r.json()).then((j) => { savedCache = j.setups || []; savedSubs.forEach((f) => f(savedCache!)); return j.id as string; });
function useSaved() {
  const [s, setS] = useState<any[]>(savedCache || []);
  useEffect(() => { savedSubs.add(setS); if (!savedCache) loadSaved(); return () => { savedSubs.delete(setS); }; }, []);
  return s;
}

export const AudioInspector: React.FC<InspectorProps> = (P) => {
  const { layer, item, send } = P;
  const S = useSettings(P);
  const props = layer.props || {};
  const kind = laneKind(layer);
  // what the settings below change: this clip (picked on the timeline) or the whole row
  const onClip = !!item && P.scope !== 'row';  // (the bar on top - controls.tsx scoped)
  const own = onClip && OWN_KEYS.some((k) => item[k] !== undefined && item[k] !== null);
  const eff = onClip ? soundOf(props, item) : { fx: props.fx || {}, voice: props.voice || null, presence: +(props.presence || 0), clean: props.clean || 'off', level: props.level || null };
  // (a clip keeps real values - 0, '' and false mean "none for this clip"; the row drops what's off)
  const put = (patch: any, c = true) => (onClip ? S.item(patch, c) : S.layer(Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === false || v === 0 || v === '' ? null : v])), c));
  const voice = eff.voice;
  const v = (k: string, d: number) => voice?.[k] ?? d;
  const setVoice = (patch: any, c = true) => put({ voice: { ...(voice || { preset: 'natural', ...VOICE_PRESETS.natural }), ...patch, preset: 'custom' } }, c);
  const fx = eff.fx || {};
  const setFx = (patch: any, c: boolean) => (onClip ? S.item({ fx: { ...(item.fx || {}), ...patch } }, c) : S.layer({ fx: fxPatch(props.fx, patch) }, c));
  const roomInVoice = !!voice && !voice.raw;  // (one Room: the voice chain's when there is one, else the effects')
  const hold = (on: boolean) => {
    if (onClip && item.voice) send([{ op: 'item.update', layer: layer.id, id: item.id, set: { voice: { ...item.voice, bypass: on || null } } }], { commit: false });
    else if (props.voice) send([{ op: 'layer.update', id: layer.id, props: { voice: { ...props.voice, bypass: on || null } } }], { commit: false });
  };
  const dur = item ? item.dur / P.fps : 0;

  // ---- setups: what's on this row / clip, changed since?, save it
  const saved = useSaved();
  const setups = allSetups(saved);
  const tag = onClip ? item.setup : props.setup;
  const rowTag = onClip && !item.setup ? props.setup : null;
  const cur = tag && setups.find((s: any) => s.id === tag.id);
  const now = soundNow(layer, onClip ? item : null);
  const changed = !!cur && !sameAsSetup(now, cur);
  const apply = (s: any) => send(setupOps(layer, onClip ? item.id : null, s));
  const saveNew = async () => {
    const label = await askText({ title: 'Save as a new setup', text: 'A name for it - it will be a button in Sounds like, on every computer.', value: cur ? `${cur.label} 2` : '' });
    if (!label) return;
    const id = await postSetup(setupFrom(now, label, undefined));
    if (id) put({ setup: { id } });
  };
  const update = async () => { await postSetup({ ...setupFrom(now, cur.label, cur.id), about: cur.about }); put({ setup: { id: cur.id } }); };
  const rowCur = rowTag && setups.find((s: any) => s.id === rowTag.id);

  const sounds = kind !== 'music';
  return <div className="ins">
    <Head icon={ICON.audio} title={<>{layer.group ? `${layer.group} · ` : ''}{layer.name || 'Sound'}</>}
      sub={`${kind === 'voice' ? 'Voice' : kind === 'music' ? 'Music' : 'Sound effect'}${item ? ` · clip ${item.id}` : ` · ${layer.items?.length || 0} clips`}`}
      bar={kind !== 'music' && <SetupLine setups={setups} cur={cur} rowCur={rowCur} changed={changed} by={tag?.by} own={own} onClip={onClip}
        onPick={(x: any) => apply(x)} onReset={() => apply(cur)} onSave={saveNew} onUpdate={update}
        onRow={() => S.item(Object.fromEntries(OWN_KEYS.map((k) => [k, null])))} />} />
    <ClipTiming P={P} source speedCtl fades={false} />


    <div className="ins-vol"><Sec title="Volume">
      <Slider label="Whole row" v={props.volume ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(x, c) => S.layer({ volume: x }, c)} />
      {item && <Slider label="This clip" v={item.gain ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(g, c) => S.item({ gain: g === 1 ? null : g }, c)} />}
      <ToggleRow label="Sound on" on={!layer.muted} onChange={(on) => S.layerSet({ muted: !on })} />
    </Sec></div>

    <Sec title="Everyday">
      {sounds && <>
        <Row label="Sounds like" wide><Chips options={setups.map((s: any) => [s.id, s.label] as [string, string])} value={cur?.id} onPick={(id) => apply(setups.find((s: any) => s.id === id))} /></Row>
      </>}
      <Slider label="Pitch" v={fx.pitch || 0} min={-12} max={12} step={0.5} def={0} fmt={semis} onChange={(x, c) => setFx({ pitch: x || (onClip ? 0 : null) }, c)} />
      {kind === 'voice' && <ToggleRow label="Keep the speech even" on={eff.level === 'speech'} onChange={(on) => put({ level: on ? 'speech' : onClip ? 'off' : null })} />}
      {item && kind !== 'voice' && <Slider label="Lower the other sounds while it plays" v={-(item.duck || 0)} min={0} max={24} step={0.5} def={0} fmt={(x) => (x ? `−${x} dB` : 'off')}
        onChange={(x, c) => S.item({ duck: x ? -x : null }, c)} />}
      {kind === 'music' && <>
        <Slider label="Raise it after the talking ends" v={props.lift?.db || 0} min={0} max={14} step={0.5} def={0} fmt={(x) => (x ? `+${x} dB` : 'off')}
          onChange={(x, c) => S.layer({ lift: x ? { fade: 1.2, of: 'subs', ...(props.lift || {}), db: x } : null }, c)} />
        {props.lift?.db ? <Slider label="Over" v={props.lift.fade ?? 1.2} min={0.2} max={4} step={0.1} def={1.2} fmt={(x) => `${x.toFixed(1)} s`}
          onChange={(x, c) => S.layer({ lift: { ...props.lift, fade: x } }, c)} /> : null}
      </>}
      {item && <>
        <Slider label="Fade in" v={item.fade_in ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(x, c) => S.item({ fade_in: x || null }, c)} />
        <Slider label="Fade out" v={item.fade_out ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(x, c) => S.item({ fade_out: x || null }, c)} />
      </>}
    </Sec>

    <Sec title="Special cases">
      <div className="ins-quiet">
        {kind === 'voice' && <>
          <Row label="Clean the noise"><Chips options={CLEAN} value={eff.clean} onPick={(c) => put({ clean: c === 'off' && !onClip ? null : c })} /></Row>
        </>}
        <Slider label="Room" v={roomInVoice ? v('room', 0) : fx.room || 0} min={0} max={1} step={0.05} def={0} fmt={pct0}
          onChange={(x, c) => (roomInVoice ? setVoice({ room: x }, c) : setFx({ room: x || (onClip ? 0 : null) }, c))} />
        <Slider label="Room size" v={roomInVoice ? v('roomSize', 1.6) : fx.roomSize ?? 1.6} min={0.4} max={3} step={0.1} def={1.6} fmt={(x) => `${x.toFixed(1)} s`}
          onChange={(x, c) => (roomInVoice ? setVoice({ roomSize: x }, c) : setFx({ roomSize: x }, c))} disabled={!(roomInVoice ? v('room', 0) : fx.room)} />
        {fx.filter === 'echo' && <Slider label="Echo strength" v={fx.echo ?? 1} min={0} max={2} step={0.05} def={1} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(x, c) => setFx({ echo: x }, c)} />}
        {kind === 'voice' && <>
          <Slider label="Speaker echo" v={v('pa', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ pa: x }, c)} />
          <Slider label="Clearer words" v={voice ? v('presence', 0) : eff.presence} min={-6} max={8} step={0.5} def={0} fmt={sdb}
            onChange={(x, c) => (voice ? setVoice({ presence: x }, c) : put({ presence: x }, c))} />
          <Slider label="Warmth" v={v('warmth', 0)} min={-6} max={6} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ warmth: x }, c)} />
          <Slider label="Less boxy" v={-v('box', 0)} min={-3} max={6} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ box: -x }, c)} />
          <Slider label="Remove low rumble" v={v('lowcut', voice ? 60 : 0)} min={0} max={200} step={5} def={60} fmt={(x) => (x ? `${x} Hz` : 'off')} onChange={(x, c) => setVoice({ lowcut: x }, c)} />
          <Slider label="Softer s sounds" v={v('deess', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ deess: x }, c)} />
          <Slider label="Louder quiet parts" v={v('comp', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ comp: x }, c)} />
        </>}
        {item && onClip && <ToggleRow label="Soften a shout" on={!!item.soften} onChange={(on) => S.item({ soften: on || null })} />}
        {voice && <button className="btn ins-wide" onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)}
          title="Hold while it plays: the voice without its style">Hold to hear the original</button>}
      </div>
    </Sec>

    <PanelEnd P={P}
      lane={<LayerState P={P} sound>
        <ToggleRow label="Keep its own pace (not sped up with the video)" on={!!props.own_pace} onChange={(on) => S.layer({ own_pace: on || null })} />
        {/* the row's own speed, pitch kept (props.tempo - src/layers/clock.js tempoOf): set when the slider is let go -
            each value is one sped-up copy the studio makes */}
        <Slider label={props.own_pace ? 'Its speed (pitch kept)' : 'Extra speed (pitch kept)'} v={props.tempo ?? 1} min={0.5} max={2} step={0.05} def={1} fmt={fmt.x}
          onChange={(x, c) => { if (c) S.layer({ tempo: Math.abs(x - 1) < 1e-3 ? null : +x.toFixed(2) }); }} />
      </LayerState>} />
  </div>;
};

/** The sound's setup in the panel's sticky head: Setup [every setup to pick from], its state in words (exactly as set /
 *  set by a session / changed / from the row / none) and - only when there is one to take - the actions: changed ->
 *  Reset, Save as new, Update; a clip with its own settings -> Use the row's. */
function SetupLine({ setups, cur, rowCur, changed, by, own, onClip, onPick, onReset, onSave, onUpdate, onRow }: any) {
  const shown = cur || rowCur;
  const state = cur ? (changed ? ['warn', 'Changed'] : ['ok', by === 'session' ? 'Set by a session' : 'Exactly as set']) : rowCur ? ['row', 'From the row'] : ['none', 'No setup'];
  return <div className="ctx-setup">
    <div className="ctx-setup-r">
      <label>Setup</label>
      <select className="field" value={shown?.id || ''} onChange={(e) => { const x = setups.find((y: any) => y.id === e.target.value); if (x) onPick(x); }}
        title="Pick a setup - it sets the cleaning, the voice and the effects">
        {!shown && <option value="">Choose…</option>}
        {setups.map((x: any) => <option key={x.id} value={x.id}>{x.label}{x.saved ? ' (yours)' : ''}</option>)}
      </select>
      <span className={`ctx-state ${state[0]}`}>{state[1]}</span>
    </div>
    {(changed || (onClip && own)) && <div className="ctx-acts">
      {changed && <>
        <button className="btn" onClick={onReset} title={`Back to exactly "${cur.label}"`}>Reset</button>
        <button className="btn" onClick={onSave} title="Save what you hear now as a new setup">Save as new</button>
        <button className="btn primary" onClick={onUpdate} title={`"${cur.label}" becomes what you hear now`}>Update</button>
      </>}
      {onClip && own && <button className="btn" onClick={onRow} title="Remove this clip's own settings - it sounds like the rest of the row">Use the row's</button>}
    </div>}
  </div>;
}
