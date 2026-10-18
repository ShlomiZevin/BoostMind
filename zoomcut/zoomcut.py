"""zoomcut — raw takes + script → finished vertical Zoom-call comedy MP4.

    python zoomcut.py build episodes/<name>            full run (everything cached between runs)
    python zoomcut.py build episodes/<name> --no-render   analysis + edit plan + report only
    python zoomcut.py new episodes/<name>              scaffold a new episode folder

Corrections go in episodes/<name>/corrections.json and are applied on the next build.
"""
import argparse
import os
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

from pipeline import audio, background, compose, media, transcribe
from pipeline.common import FFMPEG, ROOT, Episode, load_json, log, run, save_json
from pipeline.match import GOOD_SCORE, Env, extend_to_utterance, match_character, refine
from pipeline.plan import build as build_plan
from pipeline.script_parse import parse_script
from pipeline.validate import validate

REMOTION = os.path.join(ROOT, "render", "node_modules", "@remotion", "cli", "remotion-cli.js")


def _alive(pid):
    """Is this process still running? (Never os.kill on Windows — signal 0 terminates it there.)"""
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    import ctypes
    k = ctypes.windll.kernel32
    h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return False
    code = ctypes.c_ulong()
    k.GetExitCodeProcess(h, ctypes.byref(code))
    k.CloseHandle(h)
    return code.value == 259  # STILL_ACTIVE


def lock(ep):
    """One run per episode. A second run (CLI or screen) is refused while the first is alive."""
    path = ep.work(".lock")
    if os.path.exists(path):
        try:
            pid = int(open(path).read().strip())
        except ValueError:
            pid = 0
        if pid and _alive(pid):
            sys.exit(f"✖ another run is already working on {ep.id} (pid {pid}) — wait for it to finish")
    open(path, "w").write(str(os.getpid()))
    import atexit
    atexit.register(lambda: os.path.exists(path) and open(path).read().strip() == str(os.getpid()) and os.remove(path))


def cmd_build(ep, args):
    lock(ep)
    log(f"▶ {ep.id}")
    items = parse_script(open(ep.p("script.txt"), encoding="utf-8").read(), ep.characters)
    lines = [i for i in items if i["type"] == "line"]
    log(f"  script: {len(lines)} lines, {len(items) - len(lines)} directives")

    clips, unassigned = media.scan(ep)
    save_json(ep.work("footage.json"), {"clips": [{k: c[k] for k in ("rel", "char", "kind")} for c in clips],
                                       "unassigned": unassigned})
    if unassigned:
        log("✖ can't tell whose footage these are — add them to \"files\" in episode.json:")
        for u in unassigned:
            log(f'    "{u}": "amir" | "ofer" | "daniel"')
        sys.exit(2)
    if not clips:
        sys.exit("✖ no video files in input/")
    log(f"  footage: " + ", ".join(f"{c['rel']}→{c['char']}/{c['kind']}" for c in clips))

    log("① preparing footage")
    for c in clips:
        media.prepare(ep, c)
        c["render_src"] = c["proxy"]

    log("② transcribing")
    prompt = transcribe.vocab_prompt(items)
    words = {c["id"]: transcribe.transcribe(ep, c, prompt) for c in clips}
    envs = {c["id"]: Env(ep.work("audio16", c["id"] + ".wav")) for c in clips}
    vad = {c["id"]: transcribe.voice_regions(ep, c) for c in clips}
    byid = {c["id"]: c for c in clips}

    log("③ matching script lines to takes")
    matches, report_rows, used_ranges = {}, [], {c["id"]: [] for c in clips}
    for ch in ep.characters:
        cid = ch["id"]
        mine = [ln for ln in lines if ln["speaker"] == cid]
        stream = []
        for c in sorted([c for c in clips if c["char"] == cid and c["kind"] == "lines"], key=lambda c: c["rel"]):
            stream += [{**w, "clip": c["id"]} for w in words[c["id"]]]
        chosen, cands = match_character(mine, stream) if stream else ({}, {})
        extend_to_utterance(chosen, stream, vad, no_tail={ln["n"] for ln in mine if ln["interrupted"]})
        for ln in mine:
            win = chosen.get(ln["n"])
            if not win:
                matches[ln["n"]] = None
                continue
            clip_id = stream[win["i"]]["clip"]
            t_in, t_out, cut = refine(win, stream, envs[clip_id], byid[clip_id]["duration"], ln["interrupted"], vad[clip_id])
            alts, taken = [], [(win["i"], win["j"])]
            for c in cands.get(ln["n"], []):
                if len(alts) >= 3 or any(c["i"] < b and c["j"] > a for a, b in taken):
                    continue  # same occurrence as one already listed
                taken.append((c["i"], c["j"]))
                a_clip = stream[c["i"]]["clip"]
                a_in, a_out, a_cut = refine(c, stream, envs[a_clip], byid[a_clip]["duration"], ln["interrupted"], vad[a_clip])
                alts.append({"clip": byid[a_clip]["rel"], "in": a_in, "out": a_out, "cut": a_cut, "score": round(c["raw"], 2),
                             "heard": " ".join(w["w"] for w in stream[c["i"]:c["j"]])})
            matches[ln["n"]] = {"clip": clip_id, "in": t_in, "out": t_out, "cut": cut, "score": round(win["raw"], 2), "by_position": bool(win.get("by_position")),
                                "heard": " ".join(w["w"] for w in stream[win["i"]:win["j"]]), "alternatives": alts[:3]}
            used_ranges[clip_id].append((t_in, t_out))
    save_json(ep.work("matches.json"), {str(k): v for k, v in matches.items()})

    attempts = find_attempts(ep, items, clips, words, envs, used_ranges)
    pools = idle_pools(ep, clips, words, used_ranges)

    corrections = load_json(ep.p("corrections.json"), {}) or {}
    rel2id = {c["rel"]: c["id"] for c in clips}
    for v in (corrections.get("lines") or {}).values():
        if "clip" in v and v["clip"] in rel2id:
            v["clip"] = rel2id[v["clip"]]
    # no unscripted last try at the end of his take → point the attempt at another bit of it
    for cid, a in (corrections.get("attempts") or {}).items():
        attempts[cid] = {**a, "clip": rel2id.get(a["clip"], a["clip"]), "heard": a.get("heard", "")}

    log("④ planning the edit")
    props, mixplan, beats, missing, total = build_plan(ep, items, matches, attempts, pools,
                                                       {c["id"]: c for c in clips}, corrections,
                                                       quiet=quiet_spans(clips, words))
    if ep.cfg.get("background_replace", True):
        for c in clips:
            bg = background.find_background(ep, c["char"])
            segs = [s for t in props["tiles"].values() for s in t if s["clip"] == c["id"]]
            if bg and segs:
                ranges = [(s["at"], s["at"] + s["dur"] / props["fps"]) for s in segs]
                c["render_src"] = background.replace(ep, c, bg, ranges, reuse=args.preview,
                                                     engine=ep.cfg.get("background_engine", "fast"))
                props["clips"][c["id"]]["src"] = c["render_src"]
    for k, c in props["clips"].items():  # light copies for the editor's live preview
        c["preview"] = media.preview_copy(ep, c["src"])
    os.makedirs(os.path.join(ep.public, "fonts"), exist_ok=True)
    for fnt in props["fonts"]:  # the renderer and the editor load fonts from the episode's public dir
        dst = os.path.join(ep.public, fnt["url"])
        if not os.path.exists(dst):
            shutil.copy(os.path.join(ROOT, fnt["url"]), dst)
    save_json(ep.work("edit.json"), props)
    save_json(ep.work("mix.json"), mixplan)
    write_report(ep, lines, matches, byid, missing, attempts, items, total, props)
    write_state(ep, lines, matches, byid, beats, corrections, total)

    if args.preview:
        audio.mix(ep, mixplan, total, ep.work("public", "dialogue.wav"))
        log(f"✔ preview ready ({total:.1f}s)")
        return
    if args.no_render:
        log(f"✔ plan ready ({total:.1f}s). Report: {ep.work('report.md')}")
        return
    log("⑤ mixing dialogue")
    wav = audio.mix(ep, mixplan, total, ep.work("dialogue.wav"))
    log(f"⑥ rendering {props['durationInFrames']} frames")
    silent = ep.work("video.mp4")
    if args.slow:  # everything in the browser: ~1 fps, kept as a reference
        r = subprocess.run(["node", REMOTION, "render", "src/index.ts", "ZoomCall", silent,
                            f"--props={ep.work('edit.json')}", f"--public-dir={ep.public}", "--muted",
                            "--codec=h264", "--crf=17", "--pixel-format=yuv420p", f"--concurrency={args.concurrency}",
                            "--log=error"], cwd=os.path.join(ROOT, "render"))
        if r.returncode:
            sys.exit("✖ render failed")
    else:  # browser draws the interface only, ffmpeg composites the videos in parallel chunks
        compose.export(ep, props, ep.work("edit.json"), silent, concurrency=min(args.concurrency, 8))
    os.makedirs(ep.p("out"), exist_ok=True)
    final = ep.p("out", f"{ep.id}.mp4")
    run([FFMPEG, "-y", "-v", "error", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final])
    spd = float(ep.cfg.get("speed") or 1)
    if abs(spd - 1) > 1e-3:  # the editor's Speed: the whole video, every layer together
        fast = final[:-4] + ".speed.mp4"
        run([FFMPEG, "-y", "-v", "error", "-i", final, "-filter_complex", f"[0:v]setpts=PTS/{spd},fps={props['fps']}[v];[0:a]atempo={spd}[a]",
             "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", fast])
        os.replace(fast, final)
        log(f"  · speed x{spd}")
    log("⑦ validating")
    v = validate(ep, final, props["durationInFrames"] / props["fps"] / spd, props["shots"], spd)
    if v["problems"]:
        log("⚠ problems: " + "; ".join(v["problems"]))
    log(f"✔ {final}  ({v['duration']}s, {v['lufs']} LUFS)  stills: {v['stills']}")


def find_attempts(ep, items, clips, words, envs, used):
    """For a [X מנסה לדבר] beat: X's last bit of unscripted speech — the 'one more try' recorded at the end."""
    out = {}
    for it in items:
        if it["type"] != "reaction":
            continue
        cid = it["char"]
        mine = sorted([c for c in clips if c["char"] == cid], key=lambda c: (c["kind"] != "lines", c["rel"]))
        for c in mine:
            last_used = max((b for a, b in used[c["id"]]), default=0.0)
            free = [w for w in words[c["id"]] if w["s"] >= last_used and
                    all(not (a - 0.1 <= w["s"] <= b + 0.1) for a, b in used[c["id"]])]
            phrases, cur = [], []
            for w in free:
                if cur and w["s"] - cur[-1]["e"] > 0.7:
                    phrases.append(cur)
                    cur = []
                cur.append(w)
            if cur:
                phrases.append(cur)
            phrases = [p for p in phrases if p[-1]["e"] - p[0]["s"] > 0.5]
            if phrases:
                p = phrases[-1]
                env = envs[c["id"]]
                t_in = max(0, env.onset_before(p[0]["s"], p[0]["s"] - 0.4) - 0.07)
                out[cid] = {"clip": c["id"], "in": round(t_in, 3), "out": round(p[-1]["e"] + 0.1, 3),
                            "heard": " ".join(w["w"] for w in p)}
                break
    return out


def quiet_spans(clips, words):
    """Per take: the stretches where nobody is talking (between words, with a small margin)."""
    out = {}
    for c in clips:
        spans, t = [], 0.0
        for w in words[c["id"]]:
            if w["s"] - 0.1 - t > 0.25:
                spans.append((round(t, 3), round(w["s"] - 0.1, 3)))
            t = max(t, w["e"] + 0.15)
        if c["duration"] - 0.1 - t > 0.25:
            spans.append((round(t, 3), round(c["duration"] - 0.1, 3)))
        out[c["id"]] = spans
    return out


def idle_pools(ep, clips, words, used):
    """Footage of each character not talking: listen takes first, then long pauses in line takes."""
    pools = {}
    for ch in ep.characters:
        segs = []
        for kind in ("listen", "lines"):
            for c in sorted([c for c in clips if c["char"] == ch["id"] and c["kind"] == kind], key=lambda c: c["rel"]):
                busy = sorted([(w["s"] - 0.35, w["e"] + 0.35) for w in words[c["id"]]] + used[c["id"]])
                t, dur = 0.3, c["duration"] - 0.3
                min_len = 0.8 if kind == "listen" else 1.8
                shrink = 0.0 if kind == "listen" else 0.25
                for a, b in busy + [(dur, dur)]:
                    if a - t >= min_len:
                        segs.append((c["id"], t + shrink, min(a, dur) - shrink))
                    t = max(t, b)
        pools[ch["id"]] = segs
    return pools


def write_report(ep, lines, matches, byid, missing, attempts, items, total, props):
    names = {c["id"]: c["name"] for c in ep.characters}
    rows = ["# zoomcut report — " + ep.id, "", f"Length: **{total:.1f}s** · shots: {len(props['shots'])}", "",
            "| # | who | status | score | take | in→out | script | heard |", "|---|---|---|---|---|---|---|---|"]
    weak = 0
    for ln in lines:
        m = matches.get(ln["n"])
        if not m:
            rows.append(f"| {ln['n']} | {names[ln['speaker']]} | ❌ missing | | | | {ln['text']} | |")
            continue
        ok = m["score"] >= GOOD_SCORE and not m.get("by_position")
        weak += not ok
        rows.append(f"| {ln['n']} | {names[ln['speaker']]} | {'✅' if ok else '⚠️ check'} | {m['score']} | "
                    f"{byid[m['clip']]['rel']} | {m['in']:.2f}→{m['out']:.2f} | {ln['text']} | {m['heard']} |")
    for cid, a in attempts.items():
        rows.append(f"| – | {names[cid]} | attempt | | {byid[a['clip']]['rel']} | {a['in']:.2f}→{a['out']:.2f} | (last try) | {a['heard']} |")
    for it in items:
        if it["type"] == "reaction" and it["char"] not in attempts:
            rows.append(f"| – | {names[it['char']]} | silent beat | | | | (no extra speech found — uses listening footage) | |")
    empty = [c["name"] for c in ep.characters if not props["tiles"].get(c["id"])]
    rows += ["", f"Missing lines: **{len(missing)}** · lines to check: **{weak}**"]
    if empty:
        rows.append("No footage at all for: " + ", ".join(empty))
    open(ep.work("report.md"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
    log(f"  matched {len(lines) - len(missing)}/{len(lines)} lines · {weak} to check · {len(missing)} missing")
    for ln in missing:
        log(f"    ❌ missing #{ln['n']} {names[ln['speaker']]}: {ln['text']}")


def write_state(ep, lines, matches, byid, beats, corrections, total):
    """Everything the review screen needs, per script line."""
    names = {c["id"]: c["name"] for c in ep.characters}
    placed = {b["n"]: b for b in beats if b.get("n")}
    fixes = (corrections or {}).get("lines", {})
    out = []
    for ln in lines:
        m = matches.get(ln["n"]) or {}
        b = placed.get(ln["n"])
        fx = dict(fixes.get(str(ln["n"]), {}))
        if fx.get("clip") in byid:
            fx["clip"] = byid[fx["clip"]]["rel"]
        status = "missing" if not m else ("check" if m["score"] < GOOD_SCORE or m.get("by_position") else "ok")
        out.append({
            "n": ln["n"], "speaker": ln["speaker"], "name": names[ln["speaker"]], "text": ln["text"],
            "interrupted": ln["interrupted"], "status": "skipped" if fx.get("skip") else status,
            "score": m.get("score"), "heard": m.get("heard", ""),
            "auto": {"clip": byid[m["clip"]]["rel"], "in": m["in"], "out": m["out"], "cut": m["cut"]} if m else None,
            "alternatives": m.get("alternatives", []),
            "clip": byid[b["clip"]]["rel"] if b else None, "in": b["in"] if b else None, "out": b["out"] if b else None,
            "cut": round(b["in"] + b["cut_t"] - b["start"], 3) if b else None,
            "start": round(b["start"], 3) if b else None, "fix": fx,
        })
    save_json(ep.work("state.json"), {"lines": out, "total": round(total, 2),
                                      "takes": sorted({c["rel"] for c in byid.values() if c["kind"] == "lines"})})


def cmd_audit(ep):
    """Self-review before Shlomi sees a preview: the things he catches by ear, checked from the audio."""
    import numpy as np
    from pipeline.media import read_wav
    state = load_json(ep.work("state.json"))
    if not state:
        sys.exit("✖ no analysis yet — run build --preview first")
    clips, _ = media.scan(ep)
    rel2id = {c["rel"]: c["id"] for c in clips}
    roles = {c["id"]: c.get("role", "exec") for c in ep.characters}
    wavs, envs = {}, {}

    def level(cid, a, b):
        if cid not in wavs:
            wavs[cid] = read_wav(ep.work("audio16", cid + ".wav"))
            envs[cid] = Env(ep.work("audio16", cid + ".wav"))
        x, sr = wavs[cid]
        seg = x[max(0, int(a * sr)): max(0, int(b * sr))]
        return 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9) if len(seg) else -99, envs[cid].voice

    rows, flags = [], 0
    lines = [l for l in state["lines"] if l["start"] is not None]
    for k, l in enumerate(lines):
        notes = []
        cid = rel2id.get(l["clip"])
        dur = l["out"] - l["in"]
        expect = max(0.6, len(l["text"].replace(" ", "")) / 14)  # ~14 Hebrew characters a second
        if l["status"] in ("check", "missing"):
            notes.append(f"{l['status']} (heard: {l['heard'][:40]})")
        if dur > 2.2 * expect + 1:
            notes.append(f"too long for its text ({dur:.1f}s vs ~{expect:.1f}s) — wrong window?")
        if dur < 0.4 * expect:
            notes.append(f"too short ({dur:.1f}s vs ~{expect:.1f}s) — clipped?")
        if roles.get(l["speaker"]) == "victim" and dur > 3:
            notes.append("victim line over 3s")
        if cid:
            before, voice = level(cid, l["in"] - 0.12, l["in"])
            if before > voice and "in" not in (l.get("fix") or {}):  # a start set by hand is his call
                notes.append(f"starts mid-word (voice {before:.0f} dB just before the start)")
            if not l["interrupted"]:
                after, voice = level(cid, l["out"], l["out"] + 0.12)
                if after > voice:
                    notes.append(f"cut off at the end ({after:.0f} dB right after)")
        if k:
            p = lines[k - 1]
            gap = l["start"] - (p["start"] + (p["out"] - p["in"]))
            if gap > 0.6 and not l.get("fix", {}).get("pause_before"):
                notes.append(f"{gap:.1f}s of silence before it")
        flags += bool(notes)
        t = f"{int(l['start'] // 60)}:{l['start'] % 60:04.1f}"
        rows.append(f"| {t} | #{l['n']} | {l['name']} | {l['text'][:38]} | {'; '.join(notes) or 'ok'} |")
    out = [f"# Audit — {ep.id}", "", f"Length {state['total']:.1f}s · {len(lines)} lines placed · **{flags} to look at**", "",
           "| time | # | who | line | finding |", "|---|---|---|---|---|", *rows]
    open(ep.work("audit.md"), "w", encoding="utf-8").write(chr(10).join(out) + chr(10))
    for r in rows:
        if not r.endswith("| ok |"):
            log(r)
    log(f"✔ audit: {flags} of {len(lines)} lines to look at · {ep.work('audit.md')}")


def cmd_new(path):
    """Scaffold an episode: clean template, plus the office backgrounds from the last episode (same characters)."""
    os.makedirs(os.path.join(path, "input"), exist_ok=True)
    os.makedirs(os.path.join(path, "backgrounds"), exist_ok=True)
    if not os.path.exists(os.path.join(path, "episode.json")):
        shutil.copy(os.path.join(ROOT, "presets", "episode-template.json"), os.path.join(path, "episode.json"))
    prev = os.path.join(ROOT, "episodes", "agentic-sync", "backgrounds")
    for fn in os.listdir(prev) if os.path.isdir(prev) else []:
        dst = os.path.join(path, "backgrounds", fn)
        if fn.endswith((".jpg", ".png")) and not os.path.exists(dst):
            shutil.copy(os.path.join(prev, fn), dst)
    if not os.path.exists(os.path.join(path, "script.txt")):
        open(os.path.join(path, "script.txt"), "w", encoding="utf-8").write("**אמיר:** ...\n")
    log(f"✔ new episode at {path} — put footage in input/, the script in script.txt")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "new", "audit"])
    ap.add_argument("episode")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--preview", action="store_true", help="plan + preview audio for the review screen")
    ap.add_argument("--slow", action="store_true", help="render everything in the browser (old exporter)")
    ap.add_argument("--concurrency", type=int, default=8)
    a = ap.parse_args()
    if a.cmd == "new":
        cmd_new(a.episode)
    elif a.cmd == "audit":
        cmd_audit(Episode(a.episode))
    else:
        cmd_build(Episode(a.episode), a)
