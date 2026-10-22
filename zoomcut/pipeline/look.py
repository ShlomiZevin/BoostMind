"""A video layer's look in the export, the part beyond CSS saturate / contrast / brightness: `warm` (the one-camera
engine's R/G/B gains) and `smooth` (its soft focus) - the same math as lesson.py look_matrix / look_soft and the
editor's SVG filter (render/src/layers/VideoTrack.tsx LookDefs). Appended after the colour steps; alpha untouched."""


def extra(look, scale=1.0, tag="0"):
    """',<ffmpeg filters>' for look.warm / look.smooth ('' when neither). scale: output size / canvas size;
    tag: unique per use in one filter graph (the labels of the soft-focus split)."""
    if not look:
        return ""
    w, sm = float(look.get("warm") or 0), float(look.get("smooth") or 0)
    out = ""
    if abs(w) > 1e-4:
        out += f",colorchannelmixer=rr={1 + w:.5f}:gg={1 + w / 3:.5f}:bb={1 - w:.5f}"
    if sm > 0.01:
        sigma, amt = 4.0 * sm * scale, 0.65 * sm
        # the sharp picture at (1 - amt) over the blurred one (lesson.py person_chain); alpha stays the sharp one's
        out += (f",format=gbrap,split[lka{tag}][lkb{tag}];[lkb{tag}]gblur=sigma={sigma:.3f}:planes=7[lkbb{tag}];"
                f"[lka{tag}][lkbb{tag}]blend=all_mode=normal:all_opacity={1 - amt:.4f}:c3_opacity=1")
    return out
