"""project.json - a layered project (skill/edit-video/layers.md). Read / write, and the one rule for builders:
a builder (the Zoom engine, the one-camera engine, any AI tool) hands over a whole project of its own layers, and
merge() folds it into what is there WITHOUT touching his work:
  * a layer he has stays where he put it, with his name / group / hidden / props (his settings are never overwritten);
  * a builder layer's items are replaced by the builder's new ones - except items he changed by hand (user: true),
    and items he deleted (their ref in layer.removed) never come back;
  * layers the builder doesn't know (his own) are untouched;
  * when the video's length changes, items pinned to the end move with it ("pin": "end"), and items that run to the
    end keep running to it ("pin": "span").
  * his items (his own layers, his hand-changed ones) stay with what plays under them: a piece of the cut made
    longer pushes them later, a shorter one pulls them earlier, one that spans it grows / shrinks (timemap).
The same ops as render/src/layers/ops.js for anything smaller."""
import json
import os
import time

from .common import load_json, save_json

FORMAT = "sketch-studio/1"


def path_of(ep):
    return ep.p("project.json")


def load(ep):
    return load_json(path_of(ep))


def save(ep, project, note=""):
    project["rev"] = int(project.get("rev") or 0) + 1
    project["saved"] = int(time.time() * 1000)
    save_json(path_of(ep), project)
    hist = ep.work("history", "log.jsonl")
    with open(hist, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"rev": project["rev"], "t": project["saved"], "by": "builder", "note": note}, ensure_ascii=False) + "\n")
    return project


def ref_key(ref):
    return json.dumps(ref, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def repin(items, old_dur, new_dur):
    """The length changed: items pinned to the end keep their distance to it, items that ran to the end still do."""
    d = new_dur - old_dur
    for it in items:
        if it.get("pin") == "end":
            it["from"] = max(0, it["from"] + d)
            it["dur"] = max(1, min(it["dur"], new_dur - it["from"]))
        elif it.get("pin") == "span":
            it["dur"] = max(1, new_dur - it["from"])


def pieces(p, ids):
    """The cut as (start, end, take, in, rate) - the builder's video items that play a stretch of a take."""
    out = []
    for l in p.get("layers", []):
        if l.get("kind") != "video" or l["id"] not in ids:
            continue
        for it in l.get("items", []):
            r = it.get("ref") or {}
            if r.get("take") and it.get("in") is not None and (it.get("rate") or 1) > 0 and not it.get("user"):
                out.append((it["from"], it["from"] + it["dur"], r["take"], it["in"], it.get("rate") or 1))
    return sorted(out)


def timemap(old, new):
    """Where a moment of the old video is in the new one, by what plays there: a piece made longer pushes everything
    after it later, a shorter one pulls it earlier (his rule, 2026-10-28: "everything goes with whatever was pushed").
    None when the builder has no one-camera cut to follow (the grid of people keeps its own timing)."""
    if (new.get("builder") or {}).get("kind") != "solo":
        return None
    ids = {l["id"] for l in old.get("layers", [])} & {l["id"] for l in new.get("layers", [])}
    fps = new["canvas"]["fps"]
    po, pn = pieces(old, ids), pieces(new, ids)
    if not po or not pn:
        return None

    def at_source(take, s):  # the new moment that plays this second of the take (gone: the nearest edge of it)
        best = None
        for t0, t1, tk, i, r in pn:
            if tk != take:
                continue
            e = i + (t1 - t0) / fps * r
            if i - 1e-6 <= s <= e + 1e-6:
                return t0 + (s - i) * fps / r
            gap, edge = (i - s, t0) if s < i else (s - e, t1)
            if best is None or gap < best[0]:
                best = (gap, edge)
        return best and best[1]

    def at_end(take, s):  # where the new piece that holds this second of the take ENDS (a piece made longer at its end
        # pushes what came after it - by where the piece now ends, not where its old last second plays now)
        for t0, t1, tk, i, r in pn:
            if tk == take and i - 1e-6 <= s <= i + (t1 - t0) / fps * r + 1e-6:
                return t1
        return at_source(take, s)

    def m(t):
        inside = [p for p in po if p[0] <= t < p[1]]
        if inside:
            t0, _, tk, i, r = inside[-1]
            x = at_source(tk, i + (t - t0) / fps * r)
            if x is not None:
                return x
        before = [p for p in po if p[1] <= t]  # (a gap, or after the cut: from the end of the piece before)
        for t0, t1, tk, i, r in reversed(before):
            x = at_end(tk, i + (t1 - t0) / fps * r)
            if x is not None:
                return x + (t - t1)
        return t
    return m


def follow(items, m, old_dur, new_dur):
    """His items keep their place in what plays: start and end go where their moment went (pinned ones as before)."""
    if m is None:
        if old_dur != new_dur:
            repin(items, old_dur, new_dur)
        return
    for it in items:
        if it.get("pin"):
            repin([it], old_dur, new_dur)
            continue
        a0, e0 = it["from"], it["from"] + it["dur"]
        a = m(a0)
        e = new_dur if e0 >= old_dur - 0.5 else m(e0)
        if abs(a - a0) > 0.01:
            it["from"] = round(max(0, a), 3)
        if abs((e - it["from"]) - it["dur"]) > 0.01:
            it["dur"] = round(max(1, e - it["from"]), 3)


def _overlap(a, b):
    return max(0.0, min(a["from"] + a["dur"], b["from"] + b["dur"]) - max(a["from"], b["from"]))


def _same_sub(r, q):
    """Two subtitle refs are the same words: the same take and first-word second (new refs), or - an older project's
    {cap, k} - the same text."""
    if not isinstance(r, dict) or not isinstance(q, dict):
        return False
    if r.get("sub") is not None and q.get("sub") is not None:
        return r["sub"] == q["sub"] and abs(float(r.get("t", -9)) - float(q.get("t", 9))) < 0.15
    return bool(r.get("cap")) and r.get("cap") == q.get("cap")


def drop_replaced(l, mine, fresh, m):
    """Subtitles: a fresh builder item he already replaced or deleted never comes back next to his.
    (asaf-1, 2026-11-03: the subtitles' refs held a running index; a drag changed the number of chunks, every later
    index shifted, and all 28 hand-fixed subtitles stayed next to the builder's fresh copies of the same words - 80
    subtitles became 113.) In order:
      1. overlap - a fresh item covered more than half by one of his items on this layer is his (also catches what has
         no matching ref: the right half of an editor Split, a hand-added or hand-merged subtitle);
      2. the same words as one of his - same take + first-word second, or an older project's same text close by;
      3. deleted - his removed refs (the same words), the spans he deleted (layer.removedSpans, moved with the cut),
         an older project's {cap, k} key: the same text at the nearest place, within 3."""
    out = []
    gone = []
    for key in l.get("removed", []):
        try:
            gone.append(json.loads(key))
        except (TypeError, ValueError):
            pass
    spans = []
    for sp in l.get("removedSpans", []) or []:
        a, e = float(sp.get("from", 0)), float(sp.get("from", 0)) + float(sp.get("dur", 0))
        if m is not None:
            a, e = m(a), m(e)
        if e - a > 0.5:  # (a span the new cut leaves out entirely goes)
            spans.append({"from": round(a, 3), "dur": round(e - a, 3)})
    if "removedSpans" in l:  # kept in the NEW time - the next re-plan maps them from here, not from where they were deleted
        l["removedSpans"] = spans
    legacy = [g for g in gone if isinstance(g, dict) and g.get("cap") and g.get("sub") is None and "k" in g]
    for k, it in enumerate(fresh):
        dur = max(1.0, float(it.get("dur") or 1))
        r = it.get("ref")
        if any(_overlap(it, x) > 0.5 * dur for x in mine):
            continue
        if r and any(x.get("ref") and _same_sub(r, x["ref"]) and abs(x["from"] - it["from"]) < 90 for x in mine):
            continue
        if r and any(isinstance(g, dict) and g.get("sub") is not None and _same_sub(r, g) for g in gone):
            continue
        if any(_overlap(it, sp) > 0.5 * dur for sp in spans):
            continue
        if r and legacy:
            same = [g for g in legacy if g["cap"] == r.get("cap")]
            if any(abs(int(g["k"]) - k) <= 3 for g in same):
                legacy.remove(next(g for g in same if abs(int(g["k"]) - k) <= 3))
                continue
        for x in mine:  # a smaller overlap with one of his: it gives way (ends where his starts / starts where his ends)
            if _overlap(it, x) > 0:
                if it["from"] < x["from"]:
                    it["dur"] = max(1, x["from"] - it["from"])
                else:
                    e = it["from"] + it["dur"]
                    it["from"] = x["from"] + x["dur"]
                    it["dur"] = max(1, e - it["from"])
        out.append(it)
    return out


def check_subtitles(project):
    """Subtitles that a person would see as broken: two at once on one layer (a copy next to his), a flash under 12
    frames. Lines to print; empty = fine."""
    bad = []
    for l in project.get("layers", []):
        if l.get("kind") != "subtitles" or l.get("hidden"):
            continue
        its = sorted([i for i in l.get("items", []) if not i.get("hidden")], key=lambda i: i["from"])
        for a, b in zip(its, its[1:]):
            if a["from"] + a["dur"] > b["from"] + 1:
                bad.append(f"{l['id']}: '{a.get('text')}' and '{b.get('text')}' on screen together at frame {b['from']:.0f}")
        for i in its:
            if i["dur"] < 12 and not i.get("user"):  # (a short one he made himself is his call)
                bad.append(f"{l['id']}: '{i.get('text')}' shows only {i['dur']:.0f} frames at frame {i['from']:.0f}")
    return bad


def merge(old, new):
    """Fold the builder's fresh project `new` into his `old` one (see the module doc)."""
    if not old:
        return new
    out = dict(old)
    out["format"] = FORMAT
    out["assets"] = {**old.get("assets", {}), **new.get("assets", {})}
    for aid, a in out["assets"].items():  # his marks on a take (Media: Use / Don't use + a note) outlive a rebuild
        for k in ("mark", "note"):
            if k in old.get("assets", {}).get(aid, {}) and k not in a:
                out["assets"][aid] = a = {**a, k: old["assets"][aid][k]}
    for k in ("script", "builder", "edit", "characters"):
        if k in new:
            out[k] = new[k]
    old_dur, new_dur = old.get("duration") or new["duration"], new["duration"]
    out["duration"] = new_dur
    m = timemap(old, new)
    if m and old.get("notes"):  # his notes for Claude stay on the moment they are about
        out["notes"] = [{**n, "at": round(m(n["at"]))} if isinstance(n.get("at"), (int, float)) else n for n in old["notes"]]
    olds ={l["id"]: l for l in old.get("layers", [])}
    news = {l["id"]: l for l in new.get("layers", [])}
    layers = []
    for l in old.get("layers", []):
        if l["id"] in news:
            n = news[l["id"]]
            mine = [it for it in l.get("items", []) if it.get("user")]
            follow(mine, m, old_dur, new_dur)
            gone = set(l.get("removed", []))
            taken = {ref_key(it["ref"]) for it in mine if it.get("ref")}
            fresh = [it for it in n.get("items", []) if not it.get("ref") or ref_key(it["ref"]) not in gone | taken]
            if l.get("kind") == "subtitles":
                fresh = drop_replaced(l, mine, fresh, m)
            ids = {it["id"] for it in mine}
            for it in fresh:  # (a fresh item never takes the id of one he kept)
                k = 1
                while it["id"] in ids:
                    it["id"], k = f"{it['id'].split('~')[0]}~{k}", k + 1
                ids.add(it["id"])
            layers.append({**l, "items": sorted(mine + fresh, key=lambda it: it["from"]), "owner": "builder"})
        elif l.get("owner") == "builder":  # the builder no longer makes it: his hand-made items stay, the rest go
            mine = [it for it in l.get("items", []) if it.get("user")]
            follow(mine, m, old_dur, new_dur)
            if mine:  # (nothing of his left in it: the lane goes too - no empty lanes after the builder regroups)
                layers.append({**l, "items": mine})
        else:
            follow(l.get("items", []), m, old_dur, new_dur)
            layers.append(l)
    # new builder layers go right after the builder layer that comes before them in the builder's order
    for k, n in enumerate(new.get("layers", [])):
        if n["id"] in olds:
            continue
        prev = next((new["layers"][j]["id"] for j in range(k - 1, -1, -1) if new["layers"][j]["id"] in {x["id"] for x in layers}), None)
        at = next((i + 1 for i, x in enumerate(layers) if x["id"] == prev), 0 if prev is None else len(layers))
        layers.insert(at, n)
    relink(layers)
    out["layers"] = layers
    return out


def relink(layers):
    """A kept item whose `link` names a cut piece the new cut no longer has (the piece starts elsewhere in the take now -
    sagi-1's s17 still said cut-...-18.99 after the piece became ...-19.05) joins the piece it plays over; over none of
    them: no link. (The link is what moves an item with its piece.)"""
    vids = [it for l in layers if l.get("kind") == "video" for it in l.get("items", []) if it.get("link")]
    have = {it["link"] for it in vids}
    for l in layers:
        if l.get("kind") == "video":
            continue
        for it in l.get("items", []):
            if it.get("link") and it["link"].startswith("cut-") and it["link"] not in have:
                under = next((v for v in vids if v["from"] <= it["from"] < v["from"] + v["dur"]), None)
                if under:
                    it["link"] = under["link"]
                else:
                    it.pop("link")
