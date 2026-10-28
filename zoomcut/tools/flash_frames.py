"""One-frame flashes in an exported video: a frame unlike both its neighbours while they match each other - e.g. a cut
where the person vanishes for a single frame and only the set shows (haredit-2, 2026-10-28: "a glitch of empty Hani
for a micro second" on some cuts). Run it on every full export before it goes out.
    python tools/flash_frames.py <episode | video.mp4>      (an episode: its out/<id>.mp4)
Prints each flash: frame, time in the file, and how far it is from its neighbours. Exit 1 when there is one."""
import os
import subprocess
import sys

import numpy as np

W, H = 108, 192


def frames(path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                         stdout=subprocess.PIPE)
    out = []
    while True:
        b = p.stdout.read(W * H)
        if len(b) < W * H:
            break
        out.append(np.frombuffer(b, np.uint8).astype(np.int16))
    return out


def fps_of(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", path],
                       capture_output=True, text=True).stdout.strip()
    a, b = (r.split("/") + ["1"])[:2]
    return float(a) / float(b or 1)


def main():
    arg = sys.argv[1]
    path = arg if arg.endswith(".mp4") else os.path.join(os.path.dirname(__file__), "..", "episodes", arg, "out", f"{arg}.mp4")
    fr, fps = frames(path), fps_of(path)
    diff = lambda a, b: float(np.mean(np.abs(a - b) > 25))  # share of pixels that changed
    found = []
    for i in range(1, len(fr) - 1):
        d_prev, d_next, d_around = diff(fr[i], fr[i - 1]), diff(fr[i], fr[i + 1]), diff(fr[i - 1], fr[i + 1])
        if d_prev > 0.25 and d_next > 0.25 and d_around < 0.5 * min(d_prev, d_next):
            found.append((i, d_prev, d_next, d_around))
    print(f"{os.path.basename(path)}: {len(fr)} frames, {len(found)} one-frame flash(es)")
    for i, a, b, c in found:
        print(f"   frame {i}  {i / fps:7.2f} s   changed {a:.0%} / {b:.0%} from its neighbours (they differ {c:.0%})")
    sys.exit(1 if found else 0)


if __name__ == "__main__":
    main()
