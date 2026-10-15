"""Check the rendered file is what we claim it is, and pull stills to look at."""
import os
import re
import subprocess

from .common import FFMPEG, ffprobe, run


def validate(ep, mp4, expected_s, shots):
    problems = []
    info = ffprobe(mp4)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    dur = float(info["format"]["duration"])
    if not v or (int(v["width"]), int(v["height"])) != (1080, 1920):
        problems.append("video is not 1080×1920")
    if v and v.get("codec_name") != "h264":
        problems.append(f"codec is {v.get('codec_name')}, not h264")
    if not a:
        problems.append("no audio track")
    if abs(dur - expected_s) > 0.25:
        problems.append(f"duration {dur:.2f}s, expected {expected_s:.2f}s")
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", mp4, "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    m = re.findall(r"I:\s+(-?\d+\.\d) LUFS", r)
    lufs = float(m[-1]) if m else None
    if lufs is None or abs(lufs + 14) > 1.5:
        problems.append(f"loudness {lufs} LUFS (target -14)")
    stills = ep.work("stills", "x")[:-1]
    for fn in os.listdir(stills):
        os.remove(os.path.join(stills, fn))
    for i, s in enumerate(shots):
        t = (s["from"] + min(s["dur"] // 2, 20)) / 30
        run([FFMPEG, "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", mp4, "-frames:v", "1", "-vf", "scale=540:-1",
             os.path.join(stills, f"{i:02d}_{s['layout']}.jpg")])
    return {"duration": round(dur, 2), "lufs": lufs, "problems": problems, "stills": stills}
