"""Two exports of the same video, side by side: length, picture likeness (SSIM, per second and the worst moments),
loudness, and a strip of frames from the worst moments to look at.
  python tools/compare_exports.py OLD.mp4 NEW.mp4 OUTDIR"""
import json
import os
import re
import subprocess
import sys


def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout or 0)


def lufs(f):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def main():
    a, b, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    log = os.path.join(out, "ssim.log")
    subprocess.run(["ffmpeg", "-v", "error", "-i", a, "-i", b, "-filter_complex",
                    "[0:v]scale=540:960,format=yuv420p[x];[1:v]scale=540:960,format=yuv420p[y];[x][y]ssim=stats_file=" + log.replace("\\", "/").replace(":", "\\:"),
                    "-f", "null", "-"], check=True)
    per = []
    for line in open(log):
        m = re.search(r"n:(\d+).*All:([\d.]+)", line)
        if m:
            per.append((int(m.group(1)), float(m.group(2))))
    fps = 30
    secs = {}
    for n, s in per:
        secs.setdefault((n - 1) // fps, []).append(s)
    by_sec = [(k, sum(v) / len(v)) for k, v in sorted(secs.items())]
    worst = sorted(per, key=lambda x: x[1])[:5]
    res = {"old_s": round(dur(a), 2), "new_s": round(dur(b), 2), "ssim_mean": round(sum(s for _, s in per) / max(1, len(per)), 4),
           "worst_seconds": [(k, round(v, 3)) for k, v in sorted(by_sec, key=lambda x: x[1])[:6]],
           "worst_frames": [(n, round(s, 3)) for n, s in worst], "lufs_old": lufs(a), "lufs_new": lufs(b)}
    for n, _ in worst[:3]:
        t = (n - 1) / fps
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", a, "-ss", f"{t:.3f}", "-i", b, "-filter_complex",
                        "[0:v]scale=405:720[x];[1:v]scale=405:720[y];[x][y]hstack", "-frames:v", "1", os.path.join(out, f"f{n:05d}.png")])
    json.dump(res, open(os.path.join(out, "result.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
