"""Shared helpers: paths, ffmpeg discovery, json io, logging."""
import glob
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
W, H = 1080, 1920
SR = 48000


def _find_ff(name):
    p = shutil.which(name)
    if p:
        return p
    hits = glob.glob(os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages",
                                  "Gyan.FFmpeg*", "ffmpeg-*", "bin", name + ".exe"))
    if hits:
        return hits[0]
    sys.exit(f"✖ {name} not found. Install with: winget install Gyan.FFmpeg")


FFMPEG = _find_ff("ffmpeg")
FFPROBE = _find_ff("ffprobe")


def run(cmd, quiet=True):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        tail = (r.stderr or "")[-1500:]
        raise RuntimeError(f"command failed: {' '.join(map(str, cmd[:6]))} …\n{tail}")
    return r.stdout


def ffprobe(path):
    out = run([FFPROBE, "-v", "error", "-show_streams", "-show_format", "-of", "json", path])
    return json.loads(out)


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def log(msg):
    print(msg, flush=True)


class Episode:
    """Folder layout of one sketch:
        episode.json, script.txt, input/ (raw footage, any structure),
        corrections.json (optional, hand fixes), backgrounds/ (optional, <char>.jpg)
        work/ (generated; safe to delete), out/ (final mp4)
    """

    def __init__(self, path):
        self.dir = os.path.abspath(path)
        self.cfg = load_json(self.p("episode.json"), {})
        preset_name = self.cfg.get("preset", "zoom-he")
        self.preset = load_json(os.path.join(ROOT, "presets", preset_name + ".json"), {})
        self.id = os.path.basename(self.dir)

    def p(self, *parts):
        return os.path.join(self.dir, *parts)

    def work(self, *parts):
        d = self.p("work", *parts[:-1]) if len(parts) > 1 else self.p("work")
        os.makedirs(d, exist_ok=True)
        return self.p("work", *parts)

    @property
    def public(self):
        """Folder Remotion serves as its public dir."""
        d = self.p("work", "public")
        os.makedirs(d, exist_ok=True)
        return d

    @property
    def characters(self):
        return self.cfg["characters"]

    def char(self, cid):
        return next(c for c in self.characters if c["id"] == cid)
