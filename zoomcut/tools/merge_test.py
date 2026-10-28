"""A rebuild folds the builder's new layers into his project (pipeline/project.py merge): his own items keep their
place in what plays under them (timemap), a no-change rebuild moves nothing.      python tools/merge_test.py"""
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline import project as P  # noqa: E402

FPS = 30


def solo(longer=0, piece=1, side="r"):
    """A made-up one-camera project: 4 pieces of 200 frames from one take; piece `piece` made `longer` frames longer
    at its end (side r) or start (side l: more of the take before it)."""
    items, t, src = [], 0, 0.0
    for k in range(4):
        dur, start = 200, src
        if k == piece and longer:
            dur += longer
            if side == "l":
                start -= longer / FPS
        items.append({"id": f"c{k}", "from": t, "dur": dur, "in": round(start, 4), "ref": {"take": "T", "a": k}, "asset": "take"})
        t += dur
        src += 200 / FPS + 1.0  # (a second of the take cut out between pieces)
    subs = [{"id": f"s{k}", "from": it["from"] + 20, "dur": 100, "text": str(k), "ref": {"cap": k}} for k, it in enumerate(items)]
    return {
        "format": "sketch-studio/1", "canvas": {"w": 1080, "h": 1920, "fps": FPS}, "duration": t, "builder": {"kind": "solo"},
        "layers": [
            {"id": "set", "kind": "backdrop", "owner": "builder", "items": [{"id": "bg", "from": 0, "dur": t, "pin": "span", "ref": {"set": 1}}]},
            {"id": "person", "kind": "video", "owner": "builder", "items": items},
            {"id": "subs", "kind": "subtitles", "owner": "builder", "items": subs},
        ],
    }


def his(project):
    """His own layer and a hand-changed caption, the way he leaves them in the editor."""
    p = copy.deepcopy(project)
    p["layers"].append({"id": "mine", "kind": "audio", "items": [
        {"id": "before", "from": 50, "dur": 100},     # ends before piece 1's end (frame 400)
        {"id": "after", "from": 500, "dur": 80},      # after it
        {"id": "across", "from": 300, "dur": 300},    # across its end
        {"id": "tail", "from": 0, "dur": p["duration"]},  # to the end of the video, not pinned
    ]})
    p["layers"][2]["items"][3]["user"] = True  # (a caption he fixed: s3 at frame 620)
    return p


def item(p, layer, i):
    return next(x for l in p["layers"] if l["id"] == layer for x in l["items"] if x["id"] == i)


fails = 0


def check(name, cond, got=""):
    global fails
    print(("ok   " if cond else "FAIL ") + name + (f"  ({got})" if not cond else ""))
    fails += 0 if cond else 1


# 1. nothing changed: nothing moves
old = his(solo())
out = P.merge(copy.deepcopy(old), solo())
check("no-change rebuild moves nothing", all(item(out, l, i) == item(old, l, i) for l, i in
      [("mine", "before"), ("mine", "after"), ("mine", "across"), ("mine", "tail"), ("subs", "s3"), ("set", "bg")]))

# 2. piece 1 longer by 30 at its end
for d in (30, -45):
    old = his(solo())
    out = P.merge(copy.deepcopy(old), solo(d))
    word = "longer" if d > 0 else "shorter"
    check(f"{word}: his item before the edge stays", item(out, "mine", "before") == item(old, "mine", "before"))
    a = item(out, "mine", "after")
    check(f"{word}: his item after it moves {d:+}", (a["from"], a["dur"]) == (500 + d, 80), (a["from"], a["dur"]))
    x = item(out, "mine", "across")
    check(f"{word}: one across the edge grows / shrinks {d:+}", (x["from"], x["dur"]) == (300, 300 + d), (x["from"], x["dur"]))
    t = item(out, "mine", "tail")
    check(f"{word}: one to the end still runs to the new end", t["from"] + t["dur"] == out["duration"] == 800 + d, (t, out["duration"]))
    s = item(out, "subs", "s3")
    check(f"{word}: his fixed caption follows its words {d:+}", s["from"] == 620 + d, s["from"])

# 3. piece 1 longer at its start (more of the take before it): what plays later moves by the same amount
old = his(solo())
out = P.merge(copy.deepcopy(old), solo(30, side="l"))
a = item(out, "mine", "after")
check("start pulled back 30: his item after moves +30", a["from"] == 530, a["from"])

# 4. a Zoom-call project keeps its own timing (no timemap): his items stay
z = his(solo()); z["builder"] = {"kind": "zoom"}
nz = solo(30); nz["builder"] = {"kind": "zoom"}
out = P.merge(copy.deepcopy(z), nz)
check("zoom: his items stay (only pins follow the length)", item(out, "mine", "after")["from"] == 500)

print("FAIL" if fails else "ok: merge keeps his items with what plays")
sys.exit(1 if fails else 0)
