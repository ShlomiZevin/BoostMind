"""A project opened on another computer: every file its project.json points at must be there, or the editor shows empty
previews (his note, 2026-11-02 - tzvika-1 came over with its set picture and take previews missing: they were never
made on the computer it came from). Run after the cloud brings a project (render/cloud/sync.mjs pull): the cheap ones
are made again from the originals - the set picture from the background photo, each take's preview copy from the take -
and whatever can't be made quickly is named (never a silent blank).
    python -m pipeline.heal episodes/<id>      -> one JSON line {missing, fixed, left}"""
import json
import os
import sys

from pipeline.common import local_path


def main(d):
    d = os.path.abspath(d)
    try:
        p = json.load(open(os.path.join(d, "project.json"), encoding="utf-8"))
    except Exception:
        print(json.dumps({"missing": 0, "fixed": [], "left": [], "note": "no project.json"}))
        return
    missing = []
    for aid, a in (p.get("assets") or {}).items():
        for f in ("src", "preview", "eyes", "audio"):
            v = a.get(f)
            if isinstance(v, str) and v and not os.path.exists(local_path(os.path.join(d, v))):
                missing.append((aid, f, v))
    fixed, left = [], []
    ls = None
    if missing:
        try:
            import lesson
            ls = lesson.Lesson(d)  # (a one-camera project: its takes and background are known)
        except BaseException:
            ls = None
    for aid, f, v in missing:
        name = os.path.basename(v)
        try:
            if ls is None:
                left.append(v)
            elif name == "scene.png":
                lesson.scene_png(ls)
                fixed.append(v)
            elif name.endswith(".plain.mp4") and aid.startswith("t."):
                lesson.take_proxy(ls, aid[2:], False, "plain")
                fixed.append(v)
            elif name.endswith(".orig.mp4") and aid.startswith("t."):
                from pipeline import to_layers_solo
                to_layers_solo.orig_preview(ls, aid[2:])
                fixed.append(v)
            elif v.replace("\\", "/").startswith("work/audio/") and name.endswith(".wav") and name[:-4] in {lesson.name(t) for t in ls.takes}:
                take = next(t for t in ls.takes if lesson.name(t) == name[:-4])  # (the take's own sound, as Analyze extracts it)
                out = os.path.join(d, v)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                lesson.ff("-i", take, "-ac", "1", "-ar", str(lesson.SR), out)
                a16 = ls.work("audio16", name)
                if not os.path.exists(a16):
                    lesson.ff("-i", take, "-ac", "1", "-ar", "16000", a16)
                fixed.append(v)
            elif "/takes/" in v.replace("\\", "/") and name.endswith(".webm") and aid.startswith("t."):
                out = lesson.take_proxy(ls, aid[2:], False, "cut")  # (needs the take's cut-out mask - else it's named)
                (fixed if out and os.path.exists(out) else left).append(v)
            else:
                left.append(v)
        except Exception:
            left.append(v)
        if v in fixed and not os.path.exists(local_path(os.path.join(d, v))):
            fixed.remove(v)
            left.append(v)
    print(json.dumps({"missing": len(missing), "fixed": fixed, "left": left}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
