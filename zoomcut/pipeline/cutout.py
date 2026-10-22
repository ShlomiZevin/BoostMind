"""The cut-out in the export, the same three LIVE steps the editor draws (render/src/layers/VideoTrack.tsx):
  matte_cut   the halo threshold: a' = clip((a - c) * 255 / (255 - c))  (the editor: an SVG feFuncA, the same line)
  keep        the desk: the band of the take below keep.below (a fraction of the take's height) + the asset's still
              mask of the objects on it (keep_static), kept in front - OR-ed into his alpha
  side fade   his picture smaller than the frame: its sides fade over 7% of its width (the editor: a CSS mask)
The take files carry his matte as it is, so changing any of these is instant in the editor; the export applies them
here, on the matte stream after its fit (scale / crop to the window) and blur.

  post(tag, idx, ep, props, asset, box, canvas_w, vw, vh, w, h, cx, cy, n_frames, fps, scale)
    -> (input args, how many inputs they add, filtergraph text from [al<tag>] to [ak<tag>])"""
import os


def post(tag, idx, ep, props, asset, box, canvas_w, vw, vh, w, h, cx, cy, n_frames, fps, scale=1.0):
    args, n, f = [], 0, []
    last = f"[al{tag}]"
    c = int(props.get("matte_cut") or 0)
    if 0 < c < 255:
        f.append(f"{last}lut=c0='clip((val-{c})*255/{255 - c},0,255)'[mc{tag}]")
        last = f"[mc{tag}]"
    keep = props.get("keep") or {}
    below = keep.get("below")
    if below is not None and float(below) < 1:
        yb = int(round(float(below) * vh - cy))
        if yb < h:
            yb = max(0, yb)
            f.append(f"{last}drawbox=x=0:y={yb}:w=iw:h={h - yb}:color=white:t=fill[kb{tag}]")
            last = f"[kb{tag}]"
    still = asset.get("keep_static")
    if still and os.path.exists(ep.p(still)):
        args += ["-loop", "1", "-framerate", str(fps), "-t", f"{n_frames / fps + 0.1:.4f}", "-i", os.path.normpath(ep.p(still))]
        n += 1
        f.append(f"[{idx}:v]setpts=PTS-STARTPTS,trim=end_frame={n_frames},format=gray,scale={vw}:{vh}:flags=bicubic,crop={w}:{h}:{cx}:{cy}[ks{tag}]")
        f.append(f"{last}[ks{tag}]blend=all_mode=lighten:shortest=1,format=gray[kl{tag}]")
        last = f"[kl{tag}]"
    # the side ramp only where the layer asks for it (props.side_ramp - a one-camera person narrower than the frame);
    # never on tiles that are small by design
    if props.get("side_ramp") and (box.get("x", 0) > 0.5 or box.get("x", 0) + box.get("w", canvas_w) < canvas_w - 0.5):
        r = max(1.0, vw * 0.07)
        f.append(f"{last}geq=lum='p(X,Y)*clip(min(X+{cx},{vw}-1-X-{cx})/{r:.3f},0,1)'[rp{tag}]")
        last = f"[rp{tag}]"
    f.append(f"{last}null[ak{tag}]")
    return args, n, ";".join(f)
