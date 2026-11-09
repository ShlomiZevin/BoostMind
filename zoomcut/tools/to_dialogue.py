"""A dialogue project from a one-row cut (layers.md -> "Dialogue"): a COPY of the project in the dialogue format, the
original untouched. For a dialogue that was cut the older way - every picture shot on ONE video row (+ its background
on one picture row, one item per shot) and a voice row per character - like haredit-5.

    python tools/to_dialogue.py <project> <new id> [--picture person] [--set set] [--handles 1.5]

What the copy gets:
  - a video row per character (group = the character's name), each clip = its shot + its own background (item `bg`,
    the set item's picture and box) + HANDLES: more of the take before / after (up to --handles s, never over the row's
    next clip, never the recording's first 0.7 s / last 0.45 s) - the strip decides what is seen, so a cut can move;
  - the voice rows moved into their character's group, each voice linked to the clip of the same take it overlaps most;
    each subtitle linked to the voice under it;
  - a "What we see" strip = who was on screen, shot by shot (a jump cut inside one person is not a strip cut);
  - every other layer as it was; `edit.ripple` off (nothing pushes); notes left behind (they belong to the original).
Who is who: a take is the character whose voice row plays it; a take never heard (a reaction, chewing) is the
character whose clips share its background most. The picture is checked frame by frame against the original before
anything is written (same take, same moment, same box, same background) - it stops if one frame differs.
Files: the new folder gets hard links to the original's media and work files (no extra space; every tool writes a new
file and renames it, so the original's files are never changed through the copy); project.json is new."""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPS = os.environ.get("ZC_EPISODES") or os.path.join(ROOT, "episodes")
SAFE_HEAD, SAFE_TAIL = 0.70, 0.45
LINKED = ("public", "audio", "audio16", "matte", "stems", "words", "transcripts", "text")


def overlap(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def convert(p, picture="person", sets="set", handles=1.5):
    fps = p["canvas"]["fps"]
    L = {l["id"]: l for l in p["layers"]}
    person, setl = L[picture], L.get(sets)
    # the voice rows: audio rows named "<something> - <character>" or grouped, that play takes
    takes = {k for k, a in p["assets"].items() if a.get("kind") == "video"}
    voices = [l for l in p["layers"] if l["kind"] == "audio" and any(i.get("asset") in takes for i in l.get("items", []))
              and (l.get("group") or re.search(r"[-–]\s*\S", l.get("name", "")) or l["id"].startswith("voice"))]
    name_of = lambda l: l.get("group") or re.split(r"\s+[-–]\s+", l.get("name", l["id"]))[-1].strip()
    who = {}
    for l in voices:
        for i in l.get("items", []):
            who.setdefault(i["asset"], name_of(l))
    shots = sorted([i for i in person["items"] if not i.get("hidden")], key=lambda x: x["from"])
    bg_of = {}
    for i in shots:
        b = next((b for b in (setl or {}).get("items", []) if b["from"] <= i["from"] < b["from"] + b["dur"]), None) if setl else None
        bg_of[i["id"]] = b
    # a take nobody hears: the character whose clips share its background most
    for i in shots:
        if i["asset"] in who:
            continue
        b = bg_of[i["id"]]
        votes = {}
        for j in shots:
            if j["asset"] in who and b and bg_of[j["id"]] and bg_of[j["id"]]["asset"] == b["asset"]:
                votes[who[j["asset"]]] = votes.get(who[j["asset"]], 0) + 1
        if not votes:
            sys.exit(f"✖ who is in {i['asset']} (at {i['from'] / fps:.1f} s)? Nobody's voice plays it and its background is nobody's.")
        who[i["asset"]] = max(votes, key=votes.get)
    names = list(dict.fromkeys(who[i["asset"]] for i in shots))
    slug = {n: f"c{k}" for k, n in enumerate(names)}
    mirror_row = {n: bool(person["props"].get("mirror")) for n in names}
    for n in names:  # (the row's mirror = what most of that character's shots use)
        ms = [i.get("mirror", person["props"].get("mirror", False)) for i in shots if who[i["asset"]] == n]
        mirror_row[n] = sum(map(bool, ms)) * 2 > len(ms)
    rows = {n: [] for n in names}
    for i in shots:
        n = who[i["asset"]]
        c = {k: v for k, v in i.items() if k not in ("user",)}
        if bool(c.get("mirror", mirror_row[n])) == mirror_row[n]:
            c.pop("mirror", None)
        b = bg_of[i["id"]]
        if b:
            c["bg"] = {k: b[k] for k in ("asset", "box", "blur", "brightness", "saturate") if k in b}
        rows[n].append(c)
    strip = []
    for i in shots:
        show = f"{slug[who[i['asset']]]}.video"
        if strip and strip[-1]["show"] == show and abs(strip[-1]["from"] + strip[-1]["dur"] - i["from"]) <= 1:
            strip[-1]["dur"] = i["from"] + i["dur"] - strip[-1]["from"]
        else:
            strip.append({"id": f"w{len(strip)}", "from": i["from"], "dur": i["dur"], "show": show})
    # where the strip says something (a person is seen): a handle never reaches past it - where the strip is silent
    # (a poster after the last clip, a picture before the first) every row draws (view.js shownSpans)
    seen = []
    for s in strip:
        if seen and s["from"] <= seen[-1][1] + 1:
            seen[-1][1] = max(seen[-1][1], s["from"] + s["dur"])
        else:
            seen.append([s["from"], s["from"] + s["dur"]])
    span_of = lambda f: next((sp for sp in seen if sp[0] <= f < sp[1]), (f, f))
    for n, items in rows.items():
        for k, it in enumerate(items):
            if it.get("in") is None or (it.get("rate") or 1) != 1:
                continue
            length = p["assets"][it["asset"]].get("duration") or 0
            sp = span_of(it["from"])
            prev_end = max(items[k - 1]["from"] + items[k - 1]["dur"] if k else 0, sp[0])
            nxt = min(items[k + 1]["from"] if k + 1 < len(items) else 10 ** 9, sp[1])
            rl = int(max(0, min(handles * fps, it["from"] - prev_end, (it["in"] - SAFE_HEAD) * fps)))
            rr = int(max(0, min(handles * fps, nxt - (it["from"] + it["dur"]), (length - SAFE_TAIL - it["in"] - it["dur"] / fps) * fps)))
            it["from"] -= rl
            it["in"] = round(it["in"] - rl / fps, 4)
            it["dur"] += rl + rr
            it["link"] = f"k.{slug[n]}.{k}"
    linked = []
    for l in voices:
        n = name_of(l)
        l["group"] = n
        for v in l.get("items", []):
            cand = [c for c in rows.get(n, []) if c["asset"] == v.get("asset") and c.get("link")]
            best = max(cand, default=None, key=lambda c: overlap(c["from"], c["from"] + c["dur"], v["from"], v["from"] + v["dur"]))
            if best and overlap(best["from"], best["from"] + best["dur"], v["from"], v["from"] + v["dur"]) > 0:
                v["link"] = best["link"]
                linked.append(v)
    for l in p["layers"]:
        if l["kind"] != "subtitles":
            continue
        for s in l.get("items", []):
            best = max(linked, default=None, key=lambda v: overlap(v["from"], v["from"] + v["dur"], s["from"], s["from"] + s["dur"]))
            if best and overlap(best["from"], best["from"] + best["dur"], s["from"], s["from"] + s["dur"]) > 0:
                s["link"] = best["link"]
    props = {k: v for k, v in person["props"].items() if k != "mirror"}
    bgdef = {k: setl["props"][k] for k in ("blur", "brightness", "saturate") if setl and k in (setl.get("props") or {})}
    out, vids = [], {id(l) for l in voices}
    for l in p["layers"]:
        if (setl and l["id"] == setl["id"]) or id(l) in vids:
            continue
        if l["id"] == person["id"]:
            for n in reversed(names):  # (the first to speak on top of the list; each voice row right with its clips)
                out.append({"id": f"{slug[n]}.video", "kind": "video", "name": "וידאו", "group": n,
                            "props": dict(props, mirror=mirror_row[n], **({"bg": bgdef} if bgdef else {})), "items": rows[n]})
                out += [v for v in voices if name_of(v) == n]
            continue
        out.append(l)
    out.append({"id": "view", "kind": "view", "name": "What we see", "props": {}, "items": strip})
    q = dict(p, layers=out, edit={"ripple": False}, notes=[])
    q.pop("builder", None)
    q.pop("rev", None)
    return q, {n: len(r) for n, r in rows.items()}, len(strip), len(linked)


def same_frames(orig, new, picture, sets):
    """Every frame: the original's shot + background vs the copy flattened (render/src/layers/view.js)."""
    tmp = os.path.join(EPS, "_to_dialogue_check.json")
    json.dump(new, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
    try:
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "flatten_view.mjs"), tmp], capture_output=True, text=True, encoding="utf-8")
    finally:
        os.remove(tmp)
    if r.returncode:
        sys.exit("✖ flatten: " + r.stderr[-400:])
    f = json.loads(r.stdout)
    fps = orig["canvas"]["fps"]
    at = lambda items, t: [i for i in items if not i.get("hidden") and i["from"] <= t < i["from"] + i["dur"]]
    O = {l["id"]: l for l in orig["layers"]}
    rows = [l for l in f["layers"] if l["kind"] == "video" and re.fullmatch(r"c\d+\.video", l["id"])]
    bgs = [l for l in f["layers"] if l["id"].endswith("~bg")]
    key = lambda i, t: i and (i["asset"], round((i.get("in") or 0) + (t - i["from"]) / fps * (i.get("rate") or 1), 3), json.dumps(i.get("box")), i.get("zoom"))
    bk = lambda i: i and (i["asset"], json.dumps(i.get("box")))
    bad = []
    for t in range(int(orig["duration"])):
        op, ob = at(O[picture]["items"], t), at(O[sets]["items"], t) if sets in O else []
        np_ = [i for l in rows for i in at(l["items"], t)]
        nb = [i for l in bgs for i in at(l["items"], t)]
        if len(op) != len(np_) or key(op[0] if op else None, t) != key(np_[0] if np_ else None, t) or (ob and bk(ob[0]) != bk(nb[0] if nb else None)):
            bad.append(t)
    return bad


def link_tree(a, b):
    for root, _dirs, files in os.walk(a):
        d = os.path.join(b, os.path.relpath(root, a))
        os.makedirs(d, exist_ok=True)
        for fn in files:
            if not os.path.exists(os.path.join(d, fn)):
                try:
                    os.link(os.path.join(root, fn), os.path.join(d, fn))
                except OSError:
                    shutil.copy2(os.path.join(root, fn), os.path.join(d, fn))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("new_id")
    ap.add_argument("--picture", default="person")
    ap.add_argument("--set", default="set")
    ap.add_argument("--handles", type=float, default=1.5)
    a = ap.parse_args()
    src, dst = os.path.join(EPS, a.project), os.path.join(EPS, a.new_id)
    if os.path.exists(dst):
        sys.exit(f"✖ {dst} exists - pick another id")
    orig = json.load(open(os.path.join(src, "project.json"), encoding="utf-8"))
    new, rows, strip, linked = convert(json.loads(json.dumps(orig)), a.picture, a.set, a.handles)
    bad = same_frames(orig, new, a.picture, a.set)
    if bad:
        sys.exit(f"✖ the copy would show something else on {len(bad)} frames (first {bad[:5]}) - nothing written")
    os.makedirs(dst)
    for fn in ("episode.json", "captions.txt"):
        if os.path.exists(os.path.join(src, fn)):
            shutil.copy2(os.path.join(src, fn), dst)
    if os.path.isdir(os.path.join(src, "media")):
        link_tree(os.path.join(src, "media"), os.path.join(dst, "media"))
    for d in LINKED:
        if os.path.isdir(os.path.join(src, "work", d)):
            link_tree(os.path.join(src, "work", d), os.path.join(dst, "work", d))
    new["title"] = (orig.get("title") or a.project) + " · דיאלוג"
    json.dump(new, open(os.path.join(dst, "project.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✔ {a.new_id}: rows {rows}, {strip} strip blocks, {linked} voices linked; every frame checked against {a.project}")


if __name__ == "__main__":
    main()
