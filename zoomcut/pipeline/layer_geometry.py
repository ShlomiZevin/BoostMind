"""Where things sit on the canvas - the same math as render/src/layers/geometry.js (the editor), for the export.
tools/geometry_parity.mjs runs both on random inputs and fails if they disagree. Boxes: {x, y, w, h}, top-left."""


def fit_box(asset, box, p=None):
    """A video inside its item box (a window): (left, top, width, height) relative to the box. See geometry.js fitBox."""
    p = p or {}
    fit = p.get("fit") or "cover"
    zoom = max(0.1 if fit == "contain" else 1, p.get("zoom", 1) if p.get("zoom") is not None else 1)
    if fit == "contain":
        base = min(box["w"] / asset["w"], box["h"] / asset["h"])
    else:
        base = max(box["w"] / asset["w"], box["h"] / asset["h"])
    s = base * zoom
    vw, vh = asset["w"] * s, asset["h"] * s
    x, y = p.get("x") or 0, p.get("y") or 0
    if fit == "face":
        fr = asset.get("framing") or {}
        fx = fr.get("cx", 0.5) if fr.get("cx") is not None else 0.5
        head = fr["top"] if fr.get("top") is not None else max(0, fr.get("cy", 0.4) - fr.get("fh", 0.3) * 0.7)
        hm = p.get("head") if p.get("head") is not None else 0.09
        left = box["w"] / 2 - fx * vw + x * box["w"]
        top = box["h"] * (hm + y) - head * vh
    else:
        left = (box["w"] - vw) / 2 + x * box["w"]
        top = (box["h"] - vh) / 2 + y * box["h"]
    if fit != "contain":
        left = min(0, max(box["w"] - vw, left))
        top = min(0, max(box["h"] - vh, top))
    return left, top, vw, vh


def backdrop_box(img, vw, vh, p=None, view=None):
    """A backdrop photo inside the video's box (vw x vh): cover, pan, zoom, never an empty edge in `view`
    (x0, y0, w, h). See geometry.js backdropBox."""
    p = p or {}
    s = max(vw / img["w"], vh / img["h"]) * max(0.3, p.get("zoom", 1) if p.get("zoom") is not None else 1)
    if view:
        s = max(s, view[2] / img["w"], view[3] / img["h"])
    sw, sh = img["w"] * s, img["h"] * s
    left = (vw - sw) * (0.5 + (p.get("x") or 0))
    top = (vh - sh) * (0.5 + (p.get("y") or 0))
    if view:
        x0, y0, w, h = view
        left = min(x0, max(x0 + w - sw, left))
        top = min(y0, max(y0 + h - sh, top))
    return left, top, sw, sh


def image_box(asset, box):
    w = box.get("w") if box.get("w") is not None else asset.get("w", 0)
    h = box.get("h") if box.get("h") is not None else (w * asset["h"] / asset["w"] if asset.get("w") else 0)
    if box.get("anchor") == "c":
        return box["x"] - w / 2, box["y"] - h / 2, w, h
    return box.get("x") or 0, box.get("y") or 0, w, h


def key_at(keys, t, d=1.0):
    if not keys:
        return d
    if t <= keys[0][0]:
        return keys[0][1]
    for i in range(1, len(keys)):
        t1, v1 = keys[i]
        if t <= t1:
            t0, v0 = keys[i - 1]
            return v1 if t1 == t0 else v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return keys[-1][1]
