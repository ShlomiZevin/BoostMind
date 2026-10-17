"""Turn matched lines into a timed edit: line timing, Zoom layouts, tile footage, active-speaker
highlight, live captions and Zoom events. Produces the Remotion props and the audio mix plan.

Editing rules (Shlomi's notes, 14 Oct):
  * the view changes only when the speaker changes — one shot per speaker turn, on the speaker;
  * an interrupted line ("—") ends at the interruption: the next speaker starts on the cut and the
    interrupted voice keeps going underneath for a moment, then fades;
  * Daniel answers right when he is addressed (no hesitation gap);
  * when the two executives hand over, the next one starts a touch before the previous finishes;
  * a tile shows its person's own take continuously while they listen: the stretch of the take that
    ends exactly where their next line starts, so going from listening to talking never jumps;
  * silence is never trimmed inside a line; [שתיקה] directives add more.
"""
import json
import os

from .common import FPS, ROOT

FONTS = json.load(open(os.path.join(ROOT, "fonts", "fonts.json"), encoding="utf-8"))

XFADE = 6  # frames: soften the rare unavoidable jump inside a listening tile


def f(t):
    return int(round(t * FPS))


def default_gap(prev, cur, tm):
    if prev is None:
        return tm.get("first_line", 0.3)
    if prev["interrupted"]:
        # jump in on top of his last word, but on a one-second line never over more than its last quarter
        return -min(tm.get("interrupt_overlap", 0.3), 0.25 * (prev["cut_t"] - prev["start"]))
    if cur["role"] == "victim":
        return tm.get("victim_answer", -0.08)  # answers the moment he is asked, a hair early
    if prev["speaker"] != cur["speaker"]:
        overlap = tm.get("handover_overlap", 0.12)  # natural talk: the next one starts a touch early
        if prev["role"] == "exec" and cur["role"] == "exec" and                 min(prev["end_t"] - prev["start"], cur.get("dur", 9)) <= tm.get("quick_line", 1.8):
            # ping-pong ("היא תפיסתית." / "היא ארגונית."): they jump on each other's last syllable
            overlap = max(overlap, min(tm.get("quick_overlap", 0.4), 0.4 * (prev["end_t"] - prev["start"])))
        return -overlap
    return tm.get("same_speaker_gap", 0.15)


def build(ep, items, matches, attempts, idle_pools, clips, corrections, quiet=None):
    roles = {c["id"]: c.get("role", "exec") for c in ep.characters}
    fix = (corrections or {}).get("lines", {})
    tm = ep.preset.get("timing", {})
    quiet = quiet or {}

    # ---- 1. timing -------------------------------------------------------------
    beats, missing = [], []
    t = 0.0
    prev = None
    pending_pause, pending_overlap = 0.0, None
    removed = {}
    for it in items:
        if it["type"] == "pause":
            pending_pause += it["seconds"]
            continue
        if it["type"] == "overlap":
            pending_overlap = it["seconds"]
            continue
        if it["type"] == "remove":
            at = beats[-1]["cut_t"] if beats and beats[-1]["kind"] == "attempt" else t
            removed[it["char"]] = at
            continue
        if it["type"] == "reaction":
            att = attempts.get(it["char"])
            if prev is not None:
                # he starts talking over the last line, the view goes to him when it ends, then he is removed mid-word
                removal = prev["end_t"] + tm.get("attempt_after", 0.9)
                phrase = (att["out"] - att["in"]) if att else 1.5
                # start so that he is cut off about 85% into his sentence, overlapping the last line a bit
                start = max(prev["start"] + 0.5, prev["end_t"] - tm.get("attempt_overlap", 1.4), removal - 0.85 * phrase) + pending_pause
                removal = max(removal, start + 0.8)
            else:
                start, removal = 0.3, 1.8
            if att:
                cut_after = min(att["out"] - att["in"], removal - start)
                b = {"kind": "attempt", "speaker": it["char"], "role": roles[it["char"]], "clip": att["clip"],
                     "in": att["in"], "out": att["in"] + cut_after, "start": start, "interrupted": True,
                     "text": att["heard"] + "—", "show_text": True, "shot_at": prev["end_t"] if prev else start}
            else:
                b = {"kind": "attempt", "speaker": it["char"], "role": roles[it["char"]], "clip": None,
                     "in": 0, "out": it["seconds"], "start": start, "interrupted": False, "text": "", "show_text": False}
            b["end_t"] = b["start"] + (b["out"] - b["in"])
            b["cut_t"] = b["end_t"]
            beats.append(b)
            prev, t, pending_pause = b, b["cut_t"], 0.0
            continue
        if it["type"] != "line":
            continue
        n = str(it["n"])
        m = dict(matches.get(it["n"]) or {})
        fx = fix.get(n, {})
        if fx.get("skip"):
            continue
        for k in ("clip", "in", "out", "cut"):
            if k in fx:
                m[k] = fx[k]
        if not m.get("clip"):
            missing.append(it)
            continue
        if not it["interrupted"]:
            if "out" in fx or "clip" in fx:
                m["cut"] = m["out"]
        else:
            # an interruption is defined by its cut point; his voice keeps going at full level under the
            # interrupter for a moment, then stops (a stored "out" is ignored: it must not contradict the cut)
            if "clip" in fx and "cut" not in fx:
                m["cut"] = max(m["in"] + 0.2, m["out"] - 0.35)
            m["cut"] = max(m["cut"], m["in"] + 0.2)
            dur = clips.get(m["clip"], {}).get("duration", 1e9)
            m["out"] = min(dur, m["cut"] + fx.get("tail", tm.get("interrupted_tail", 0.6)))  # "tail": less mumbling after the cut
        cur = {**it, "role": roles[it["speaker"]], "dur": m["out"] - m["in"]}
        gap = fx["pause_before"] if "pause_before" in fx else default_gap(prev, cur, tm) + pending_pause
        if prev is None:
            start = gap
        elif pending_overlap is not None:
            start = prev["end_t"] - pending_overlap
        elif prev["interrupted"]:
            start = prev["cut_t"] + gap
        else:
            start = prev["end_t"] + gap
        if prev is not None:
            start = max(start, prev["start"] + 0.3)
        start += fx.get("shift", 0.0)  # moved by hand on the timeline
        b = {"kind": "line", "n": it["n"], "speaker": it["speaker"], "role": roles[it["speaker"]],
             "clip": m["clip"], "in": m["in"], "out": m["out"], "start": start,
             "interrupted": it["interrupted"], "text": it["text"], "show_text": True, "layout": fx.get("layout")}
        b["end_t"] = start + (m["out"] - m["in"])
        b["cut_t"] = start + (m.get("cut", m["out"]) - m["in"])
        beats.append(b)
        prev, t, pending_pause, pending_overlap = b, b["cut_t"], 0.0, None

    if not beats:
        raise RuntimeError("no script line could be matched to footage")
    tail = tm.get("tail_after_removal", 2.4) if removed else tm.get("tail", 1.0)
    total = max(b["end_t"] for b in beats) + tail
    for c, at in removed.items():
        total = max(total, at + tail)

    # ---- 2. shots: one per speaker turn ------------------------------------------------
    def present(at):
        return [c["id"] for c in ep.characters if not (c["id"] in removed and at >= removed[c["id"]])]

    def on(spk, at):
        return [spk] + [x for x in present(at) if x != spk]

    shots = []
    for k, b in enumerate(beats):
        at = 0.0 if k == 0 else b.get("shot_at", b["start"])
        spk = b["speaker"]
        if b.get("layout"):
            shots.append({"t": at, "layout": b["layout"], "order": on(spk, at)})
        elif k == 0 or spk != beats[k - 1]["speaker"]:
            shots.append({"t": at, "layout": "speaker", "order": on(spk, at)})
        elif shots and shots[-1]["layout"] != "speaker":  # back to auto after a forced layout
            shots.append({"t": at, "layout": "speaker", "order": on(spk, at)})
    for c, at in removed.items():
        rest = present(at + 0.01)
        shots.append({"t": at, "layout": "gallery" if len(rest) != 1 else "speaker", "order": rest})

    shots.sort(key=lambda s: s["t"])
    merged = []
    for s in shots:
        if merged and abs(s["t"] - merged[-1]["t"]) < 1e-6:
            merged[-1] = s
        elif merged and s["layout"] == merged[-1]["layout"] and s["order"] == merged[-1]["order"]:
            continue
        else:
            merged.append(s)
    shots_f = []
    for i, s in enumerate(merged):
        end = merged[i + 1]["t"] if i + 1 < len(merged) else total
        a, z = f(s["t"]), f(end)
        if z > a:
            shots_f.append({"from": a, "dur": z - a, "layout": s["layout"], "order": s["order"]})

    # ---- 3. tile footage -----------------------------------------------------------
    tiles = {}
    for c in ep.characters:
        cid = c["id"]
        end_c = removed.get(cid, total)
        speaking = sorted([b for b in beats if b["speaker"] == cid and b["clip"]], key=lambda b: b["start"])
        pool = Pool(idle_pools.get(cid, []))
        segs, cursor, last = [], 0.0, None
        for b in speaking + [None]:
            s0 = min(b["start"], end_c) if b else end_c
            if s0 - cursor > 1e-3:
                segs += _listening(cursor, s0, last, b, quiet, pool)
            if b and b["start"] < end_c:
                s1 = min(b["end_t"], end_c)
                segs.append({"from": f(b["start"]), "dur": max(1, f(s1) - f(b["start"])), "clip": b["clip"], "at": round(b["in"], 3)})
                cursor = max(cursor, s1)
                last = b
        tiles[cid] = _fix_overlaps(segs)

    # ---- 4. highlight, captions, events --------------------------------------------
    active = []
    for b in beats:
        if not b["clip"]:
            continue
        a = b["start"] + 0.15  # Zoom's highlight lags the voice a little
        z = b["cut_t"] if b["interrupted"] else b["end_t"]
        if z - a > 0.15:
            active.append({"from": f(a), "dur": f(z) - f(a), "id": b["speaker"]})

    names = {c["id"]: c["name"] for c in ep.characters}
    captions = []
    for b in beats:
        if not b["show_text"] or not b["text"]:
            continue
        a, z = b["start"], (b["cut_t"] if b["interrupted"] else b["end_t"])
        for chunk_text, c0, c1 in _chunks(b["text"], a, z, ep.preset.get("captions", {}).get("max_words", 7)):
            captions.append({"from": f(c0), "dur": max(1, f(c1) - f(c0)), "name": names[b["speaker"]], "text": chunk_text})
    # overlapping lines: the subtitle switches with the speaker, the previous one never stays on top
    captions.sort(key=lambda c: c["from"])
    for c, nxt in zip(captions, captions[1:]):
        c["dur"] = max(1, min(c["dur"], nxt["from"] - c["from"]))

    events = [{"at": f(at), "type": "remove", "id": cid, "name": names[cid]} for cid, at in removed.items()]

    used_clips = {s["clip"] for segs in tiles.values() for s in segs}
    props = {
        "fps": FPS, "width": 1080, "height": 1920, "durationInFrames": f(total),
        "title": ep.cfg.get("title", "Meeting"),
        "timerStart": ep.cfg.get("timer_start", 2232),
        "subtitles": ep.cfg.get("subtitles", True),
        "accent": ep.preset.get("accent", "#2BD45E"), "ui": ep.preset.get("ui", {}),
        "participants": [{"id": c["id"], "name": c["name"], "role": c.get("role", "exec"),
                          "look": c.get("look"), "frame": c.get("frame")} for c in ep.characters],
        "clips": {k: {"src": v["render_src"], "w": v["w"], "h": v["h"], "framing": v["framing"], "char": v["char"]}
                  for k, v in clips.items() if k in used_clips},
        "overlays": [{"text": o["text"], "style": o.get("style", "pov"), "from": f(o.get("start") or 0),
                      "dur": max(1, f(min(total, o["end"]) if o.get("end") else total) - f(o.get("start") or 0)),
                      "font": o.get("font", "system"), "theme": o.get("theme", "light"),
                      "opacity": o.get("opacity", 1.0), "y": o.get("y")}
                     for o in ep.cfg.get("overlays", []) if o.get("text", "").strip()],
        "fonts": [{"id": x["id"], "family": "zc-" + x["id"], "url": "fonts/" + x["file"], "weight": x["weight"]}
                  for x in FONTS if x["file"]],
        "tiles": tiles, "shots": shots_f, "active": active, "captions": captions, "events": events,
    }
    mix = []
    for b in beats:
        if not b["clip"]:
            continue
        hard = b["kind"] == "attempt"
        mix.append({"clip": b["clip"], "in": b["in"], "out": b["out"], "at": b["start"],
                    "fade_out": 0.012 if hard else (0.07 if b["interrupted"] else 0.12)})
    for cid, at in removed.items():
        mix.append({"sfx": "remove", "at": at})
    return props, mix, beats, missing, total


def _quiet_span(quiet, clip, t, direction):
    """The silent stretch of a take that touches time t: (start, end) or None."""
    for a, b in quiet.get(clip, []):
        if a - 0.15 <= t <= b + 0.15:
            return a, b
    return None


def _listening(t0, t1, last, nxt, quiet, pool):
    """Footage for a person while someone else talks, timeline t0..t1. Their tile keeps running on
    from where their last line ended and arrives exactly where their next line starts, so neither the
    end nor the start of a line ever jumps; if those are different moments of the take, they meet in
    the middle with a short dissolve while the person sits in the small strip."""
    d = t1 - t0
    after = before = 0.0
    if last is not None:
        span = _quiet_span(quiet, last["clip"], last["out"], 1)
        after = (span[1] - last["out"]) if span else 0.0
    if nxt is not None:
        span = _quiet_span(quiet, nxt["clip"], nxt["in"], -1)
        before = (nxt["in"] - max(span[0], 0.0)) if span else 0.0
    if last is not None and nxt is not None and last["clip"] == nxt["clip"] and abs((nxt["in"] - last["out"]) - d) < 0.08:
        return [{"from": f(t0), "dur": max(1, f(t1) - f(t0)), "clip": last["clip"], "at": round(last["out"], 3)}]
    if d < 1.2:  # too short for two pieces: arrive seamlessly into the next line
        if nxt is not None and before >= d:
            return [{"from": f(t0), "dur": max(1, f(t1) - f(t0)), "clip": nxt["clip"], "at": round(nxt["in"] - d, 3)}]
        if last is not None and after >= d:
            return [{"from": f(t0), "dur": max(1, f(t1) - f(t0)), "clip": last["clip"], "at": round(last["out"], 3)}]
    tail = min(before, max(d / 2, d - after)) if nxt is not None else 0.0
    tail = tail if tail > 0.3 else 0.0
    head = min(after, d - tail) if last is not None else 0.0
    head = head if head > 0.3 else 0.0
    mid = d - head - tail
    out = []
    if head:
        out.append({"from": f(t0), "dur": max(1, f(t0 + head) - f(t0)), "clip": last["clip"], "at": round(last["out"], 3)})
    if mid > 1e-3:
        out += _pooled(t0 + head, mid, pool, first_fade=bool(head))
    if tail:
        out.append({"from": f(t1 - tail), "dur": max(1, f(t1) - f(t1 - tail)), "clip": nxt["clip"],
                    "at": round(nxt["in"] - tail, 3), **({"fade": XFADE} if head or mid > 1e-3 else {})})
    return out


def _pooled(t0, d, pool, first_fade=False):
    out = []
    for k, (clip, at, use, start) in enumerate(pool.take(t0, d)):
        seg = {"from": f(start), "dur": max(1, f(start + use) - f(start)), "clip": clip, "at": round(at, 3)}
        if k or first_fade:
            seg["fade"] = XFADE
        out.append(seg)
    return out


class Pool:
    """Silent footage of one person, handed out in the longest pieces available so a listening
    tile changes source as rarely as possible."""

    def __init__(self, segs):
        self.segs = [[c, a, b] for c, a, b in segs if b - a > 0.8]
        self.pos = {i: s[1] for i, s in enumerate(self.segs)}

    def take(self, t0, d):
        out = []
        guard = 0
        while d > 1e-3 and self.segs and guard < 50:
            guard += 1
            left = {i: s[2] - self.pos[i] for i, s in enumerate(self.segs)}
            fits = [i for i in left if left[i] >= d]
            i = min(fits, key=lambda i: left[i]) if fits else max(left, key=left.get)
            if left[i] < 0.5:  # everything used up: start over
                self.pos = {k: s[1] for k, s in enumerate(self.segs)}
                continue
            use = min(d, left[i])
            out.append((self.segs[i][0], self.pos[i], use, t0))
            self.pos[i] += use
            t0 += use
            d -= use
        return out


def _fix_overlaps(segs):
    """Later segments win; a segment that fades in keeps the one under it alive for the fade."""
    segs.sort(key=lambda s: s["from"])
    out = []
    for s in segs:
        if out and out[-1]["from"] + out[-1]["dur"] > s["from"]:
            out[-1]["dur"] = s["from"] - out[-1]["from"]
            if out[-1]["dur"] <= 0:
                out.pop()
        if s.get("fade") and out:
            out[-1]["dur"] += s["fade"]  # overlap under the cross-fade
        out.append(s)
    return out


def _chunks(text, a, z, max_words=7):
    words = text.split()
    if not words:
        return []
    groups, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= max_words or (len(cur) >= 4 and w.endswith((".", "?", ","))):
            groups.append(cur)
            cur = []
    if cur:
        if groups and len(cur) <= 2:
            groups[-1] += cur
        else:
            groups.append(cur)
    total_chars = sum(len(" ".join(g)) for g in groups)
    out, t = [], a
    for g in groups:
        d = (z - a) * len(" ".join(g)) / total_chars
        out.append((" ".join(g), t, t + d))
        t += d
    return out
