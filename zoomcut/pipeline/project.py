"""project.json - a layered project (skill/edit-video/layers.md). Read / write, and the one rule for builders:
a builder (the Zoom engine, the one-camera engine, any AI tool) hands over a whole project of its own layers, and
merge() folds it into what is there WITHOUT touching his work:
  * a layer he has stays where he put it, with his name / group / hidden / props (his settings are never overwritten);
  * a builder layer's items are replaced by the builder's new ones - except items he changed by hand (user: true),
    and items he deleted (their ref in layer.removed) never come back;
  * layers the builder doesn't know (his own) are untouched;
  * when the video's length changes, items pinned to the end move with it ("pin": "end"), and items that run to the
    end keep running to it ("pin": "span").
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


def merge(old, new):
    """Fold the builder's fresh project `new` into his `old` one (see the module doc)."""
    if not old:
        return new
    out = dict(old)
    out["format"] = FORMAT
    out["assets"] = {**old.get("assets", {}), **new.get("assets", {})}
    for k in ("script", "builder", "edit"):
        if k in new:
            out[k] = new[k]
    old_dur, new_dur = old.get("duration") or new["duration"], new["duration"]
    out["duration"] = new_dur
    olds = {l["id"]: l for l in old.get("layers", [])}
    news = {l["id"]: l for l in new.get("layers", [])}
    layers = []
    for l in old.get("layers", []):
        if l["id"] in news:
            n = news[l["id"]]
            mine = [it for it in l.get("items", []) if it.get("user")]
            gone = set(l.get("removed", []))
            taken = {ref_key(it["ref"]) for it in mine if it.get("ref")}
            fresh = [it for it in n.get("items", []) if not it.get("ref") or ref_key(it["ref"]) not in gone | taken]
            ids = {it["id"] for it in mine}
            for it in fresh:  # (a fresh item never takes the id of one he kept)
                k = 1
                while it["id"] in ids:
                    it["id"], k = f"{it['id'].split('~')[0]}~{k}", k + 1
                ids.add(it["id"])
            layers.append({**l, "items": sorted(mine + fresh, key=lambda it: it["from"]), "owner": "builder"})
        elif l.get("owner") == "builder":  # the builder no longer makes it: his hand-made items stay, the rest go
            layers.append({**l, "items": [it for it in l.get("items", []) if it.get("user")]})
        else:
            if old_dur != new_dur:
                repin(l.get("items", []), old_dur, new_dur)
            layers.append(l)
    # new builder layers go right after the builder layer that comes before them in the builder's order
    for k, n in enumerate(new.get("layers", [])):
        if n["id"] in olds:
            continue
        prev = next((new["layers"][j]["id"] for j in range(k - 1, -1, -1) if new["layers"][j]["id"] in {x["id"] for x in layers}), None)
        at = next((i + 1 for i, x in enumerate(layers) if x["id"] == prev), 0 if prev is None else len(layers))
        layers.insert(at, n)
    out["layers"] = layers
    return out
