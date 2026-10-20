// The cut, played live over the takes' whole videos (work/public/takes). The edit is a list of parts of takes
// (edit.items, in frames); this clock is the video's time, and each take's video is moved to where its part is.
// Changing the list (an edge dragged, a split, a piece deleted, the end moved) changes what plays at once:
// the whole take is always there behind the cut, nothing is re-encoded.
// It stands in for the preview <video> (currentTime, paused, play, pause, playbackRate), so the sound, the
// subtitles and the film look follow it exactly as they followed the single video.

type Kind = 'cut' | 'plain' | 'raw';
type Part = { take?: string; slot: number; a: number; sp: number; still: boolean; hide: boolean; start: number; end: number };

export class LiveClock {
  fps = 30;
  total = 0;  // seconds
  paused = true;
  on: { time?: (t: number) => void; play?: () => void; pause?: () => void; seeked?: () => void } = {};
  private t = 0;
  private rate = 1;
  private t0 = 0;
  private w0 = 0;
  private raf = 0;
  private cur = -1;
  private parts: Part[] = [];
  // every take twice: the next part of the same take waits ready (seeked) in the other copy, so a cut is seamless
  private els: Record<string, Partial<Record<Kind, HTMLVideoElement>>[]> = {};
  // each copy sits in its own box, shown / hidden by its opacity: a hidden copy keeps its frame painted (visibility:hidden
  // lets the browser drop it - the flicker at a cut), so the switch to it is instant
  private boxes: Record<string, (HTMLDivElement | undefined)[]> = {};
  private shown = '';  // the copy on screen ("take|slot")
  private waiting = false;  // the part changed but its copy is still seeking: the last frame stays until it is ready

  get currentTime() { return this.t; }
  set currentTime(s: number) {
    this.t = Math.max(0, Math.min(this.total, s));
    this.t0 = this.t; this.w0 = performance.now();
    this.cur = -1;
    this.apply(!this.paused);
    this.on.time?.(this.t);
    this.on.seeked?.();
  }
  get playbackRate() { return this.rate; }
  set playbackRate(r: number) {
    if (r === this.rate) return;
    this.t0 = this.t; this.w0 = performance.now(); this.rate = r;
    if (!this.paused) this.apply(true);
  }

  setItems(items: any[], fps: number, total: number) {
    this.fps = fps; this.total = total;
    this.parts = [];
    for (const it of items || []) {
      const ins = it.insert || {}, start = it.out / fps, end = (it.out + it.n) / fps;
      let p: Part;
      if (it.kind === 'clip') p = { take: it.take, slot: 0, a: it.a, sp: it.sp ?? 1, still: false, hide: false, start, end };
      else if (ins.hide) p = { slot: 0, a: 0, sp: 1, still: true, hide: true, start, end };  // he is not in the picture
      else if (ins.footage) p = { take: ins.footage.take, slot: 0, a: ins.footage.from, sp: 1, still: false, hide: false, start, end };
      else p = { take: it.take, slot: 0, a: it.t, sp: 1, still: true, hide: false, start, end };  // a held frame
      const prev = this.parts.at(-1);
      if (prev && prev.take && prev.take === p.take) p.slot = 1 - prev.slot;
      this.parts.push(p);
    }
    if (this.t > total) this.t = total;
    this.cur = -1;
    this.apply(!this.paused);
  }

  box(take: string, slot: number, el: HTMLDivElement | null) {
    (this.boxes[take] ||= [])[slot] = el || undefined;
    if (el) el.style.opacity = this.shown === `${take}|${slot}` ? '1' : '0';
  }

  register(take: string, slot: number, kind: Kind, el: HTMLVideoElement | null) {
    const s = ((this.els[take] ||= [{}, {}])[slot] ||= {});
    if (s[kind] === el) return;
    if (!el) { delete s[kind]; return; }
    s[kind] = el;
    el.addEventListener('loadedmetadata', () => { this.cur = -1; this.apply(!this.paused); });
    el.addEventListener('seeked', () => { if (this.waiting) this.apply(!this.paused); });
    this.cur = -1;
    this.apply(!this.paused);
  }

  play() {
    if (!this.paused) return Promise.resolve();
    if (this.t >= this.total - 0.01) this.t = 0;
    this.paused = false;
    this.t0 = this.t; this.w0 = performance.now();
    this.cur = -1;
    this.apply(true);
    this.on.play?.();
    this.raf = requestAnimationFrame(this.loop);
    return Promise.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.cur = -1;
    this.apply(false);
    this.on.pause?.();
  }

  // while an edge is dragged: the frame of the take under the edge, from the whole take
  peek(take: string, s: number) {
    if (!this.paused) this.pause();
    const slot = this.els[take]?.[0];
    if (!slot) return;
    this.show(take, 0);
    this.cur = -1;  // the next move of the clock puts the cut back
    this.waiting = false;
    for (const el of Object.values(slot)) if (el && Math.abs(el.currentTime - s) > 0.01) el.currentTime = Math.max(0, s);
  }

  // a take's length (seconds), from its whole video: an edge can't be dragged past it
  takeLength(take: string) {
    const d = this.els[take]?.[0]?.cut?.duration;
    return d && Number.isFinite(d) ? d : Infinity;
  }

  dispose() { cancelAnimationFrame(this.raf); this.paused = true; }

  private at(t: number) {
    const ps = this.parts;
    for (let i = 0; i < ps.length; i++) if (t < ps[i].end - 1e-6) return i;
    return ps.length - 1;
  }

  private each(p: Part | undefined, fn: (el: HTMLVideoElement) => void) {
    if (!p?.take || p.hide) return;
    for (const el of Object.values(this.els[p.take]?.[p.slot] || {})) if (el) fn(el);
  }

  private show(take?: string, slot?: number) {
    this.shown = take == null ? '' : `${take}|${slot}`;
    for (const [tk, bs] of Object.entries(this.boxes))
      bs.forEach((b, i) => { if (b) b.style.opacity = tk === take && i === slot ? '1' : '0'; });
    for (const [tk, slots] of Object.entries(this.els))
      slots.forEach((s, i) => {
        if (tk === take && i === slot) return;
        for (const el of Object.values(s || {})) if (el && !el.paused) el.pause();  // only the part on screen plays
      });
  }

  private ready(p: Part) {
    let ok = true;
    this.each(p, (el) => { if (el.seeking || el.readyState < 2) ok = false; });
    return ok;
  }

  private loop = () => {
    if (this.paused) return;
    const now = performance.now();
    let t = this.t0 + ((now - this.w0) / 1000) * this.rate;
    const i = this.at(t), p = this.parts[i];
    if (i === this.cur && p && !p.still && !p.hide) {  // while his video plays smoothly, the picture is the clock
      const el = this.els[p.take!]?.[p.slot]?.cut;
      if (el && !el.paused && !el.seeking && el.readyState >= 3) {
        const et = p.start + (el.currentTime - p.a) / p.sp;
        if (Math.abs(et - t) < 0.25) { t = et; this.t0 = t; this.w0 = now; }
      }
    }
    if (t >= this.total) {
      this.t = this.total;
      this.pause();
      this.on.time?.(this.t);
      return;
    }
    this.t = t;
    this.apply(true);
    this.on.time?.(t);
    this.raf = requestAnimationFrame(this.loop);
  };

  private apply(playing: boolean) {
    const i = this.at(this.t), p = this.parts[i];
    if (i !== this.cur) {
      this.cur = i; this.waiting = true;
      const [tk, sl] = this.shown.split('|');  // the copy on screen stops on its last frame of the part (not past the cut)
      if (tk && (tk !== p?.take || +sl !== p?.slot)) for (const el of Object.values(this.els[tk]?.[+sl] || {})) if (el && !el.paused) el.pause();
    }
    if (!p) return;
    const want = Math.min(p.still ? p.a : p.a + (this.t - p.start) * p.sp, this.takeLength(p.take!) - 0.04);  // (never past its end)
    this.each(p, (el) => {
      if (el.playbackRate !== this.rate * p.sp) el.playbackRate = this.rate * p.sp;
      if (!el.seeking && Math.abs(el.currentTime - want) > (playing && !p.still ? 0.2 : 0.01)) el.currentTime = want;
      if (playing && !p.still) { if (el.paused) el.play().catch(() => {}); }
      else if (!el.paused) el.pause();
    });
    if (this.waiting && (p.hide || this.ready(p))) {  // its frame is there: switch now (no blank frame in between)
      this.waiting = false;
      if (this.shown !== (p.hide ? '' : `${p.take}|${p.slot}`)) this.show(p.hide ? undefined : p.take, p.slot);
    }
    // the next part waits ready at its first frame (in the other copy when it is the same take)
    const n = this.parts[i + 1];
    if (n && (n.take !== p.take || n.slot !== p.slot))
      this.each(n, (el) => { if (!el.paused) el.pause(); if (!el.seeking && Math.abs(el.currentTime - n.a) > 0.04) el.currentTime = n.a; });
  }
}
