"""Preview a held prop's colour keep BEFORE a build (episode.json "prop_color"): what the cut-out will add, per frame.
   python tools/prop_color_preview.py <take.mp4> "<h,s,v>" "<h,s,v>" <x0,y0,x1,y1> <t1> [t2 ...]  -> <take>.propcolor.jpg
   The frames are the RAW take (before a mirror). Kept = bright, the rest dimmed. Look at it: the whole prop (label, bottom,
   the edge the hand holds) must be bright, no wall. Then put the same numbers in prop_color {take: {hsv, box, from, to}}."""
import subprocess
import sys

import cv2
import numpy as np

take, lo, hi, box = sys.argv[1], sys.argv[2], sys.argv[3], [float(v) for v in sys.argv[4].split(",")]
times = [float(t) for t in sys.argv[5:]]
lo, hi = (np.array([int(v) for v in s.split(",")], np.uint8) for s in (lo, hi))
W, H = 360, 640
tiles = []
for t in times:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", take, "-frames:v", "1", "-vf", f"scale={W}:{H}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    im = np.frombuffer(raw, np.uint8).reshape(H, W, 3).copy()
    c = cv2.inRange(cv2.cvtColor(im, cv2.COLOR_RGB2HSV), lo, hi)
    x0, y0, x1, y1 = box  # the same limits as lesson.prop_matte
    c[:, :int(x0 * W)] = 0
    c[:, int(x1 * W):] = 0
    c[:int(y0 * H)] = 0
    c[int(y1 * H):] = 0
    c = cv2.morphologyEx(c, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cnt, _ = cv2.findContours(c, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    keep = np.zeros_like(c)
    cv2.drawContours(keep, [x for x in cnt if cv2.contourArea(x) > 200], -1, 255, -1)
    im[keep == 0] = (im[keep == 0] * 0.25).astype(np.uint8)
    cv2.putText(im, f"{t:.2f}s", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
    tiles.append(im)
out = take.rsplit(".", 1)[0] + ".propcolor.jpg"
cv2.imwrite(out, cv2.cvtColor(np.hstack(tiles), cv2.COLOR_RGB2BGR))
print(out)
