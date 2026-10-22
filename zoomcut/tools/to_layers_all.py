"""Move one-camera projects to the one layered editor: pipeline/to_layers_solo.py --keep-settings on each, one at a time,
at low priority, only while the studio runs no job. Writes only project.json (+ work/): episode.json, captions.txt and
corrections.json are checked to be byte-identical after; deleting project.json is the way back.
  python tools/to_layers_all.py crypto-1 tadar-5 ...      -> a line per project: ok / skipped (why) / failed (why)"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = os.path.join(ROOT, ".venv", "Scripts", "python.exe")
LOW = 0x00004000  # BELOW_NORMAL_PRIORITY_CLASS (his PC: never heavy at normal priority)
SETTINGS = ("episode.json", "captions.txt", "corrections.json")


def busy():
    try:
        return json.load(urllib.request.urlopen("http://localhost:4747/api/jobs", timeout=5)).get("busy") or []
    except Exception as e:
        return [{"error": str(e)}]


def sums(d):
    return {f: hashlib.md5(open(os.path.join(d, f), "rb").read()).hexdigest() for f in SETTINGS if os.path.exists(os.path.join(d, f))}


def validate(path):
    js = ("import('./render/src/layers/ops.js').then(({validate}) => { const p = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));"
          " const e = validate(p); console.log(JSON.stringify({errors: e.slice(0, 5), layers: p.layers.length, seconds: p.duration / p.canvas.fps})); })")
    r = subprocess.run(["node", "-e", js, path], cwd=ROOT, capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {"errors": [r.stderr[-300:]]}


def main():
    for pid in sys.argv[1:]:
        d = os.path.join(ROOT, "episodes", pid)
        pj = os.path.join(d, "project.json")
        if os.path.exists(pj):
            print(f"{pid}: skipped (already layered)", flush=True)
            continue
        b = busy()
        if b:
            print(f"{pid}: skipped (the studio is busy: {b})", flush=True)
            continue
        before = sums(d)
        r = subprocess.run([PY, "-m", "pipeline.to_layers_solo", f"episodes/{pid}", "--keep-settings"], cwd=ROOT, capture_output=True,
                           text=True, encoding="utf-8", errors="replace", env={**os.environ, "PYTHONIOENCODING": "utf-8"}, creationflags=LOW)
        after = sums(d)
        if before != after:
            print(f"{pid}: FAILED - a settings file changed: {[f for f in after if before.get(f) != after[f]]}", flush=True)
            continue
        if r.returncode or not os.path.exists(pj):
            if os.path.exists(pj):
                os.remove(pj)
            print(f"{pid}: failed - {(r.stdout + r.stderr).strip()[-400:]}", flush=True)
            continue
        v = validate(pj)
        if v.get("errors"):
            os.remove(pj)
            print(f"{pid}: failed validation (project.json removed) - {v['errors']}", flush=True)
            continue
        last = [l for l in r.stdout.splitlines() if l.strip()][-1:] or [""]
        print(f"{pid}: ok - {v['layers']} layers, {v['seconds']:.1f}s - {last[0].strip()}", flush=True)


if __name__ == "__main__":
    main()
