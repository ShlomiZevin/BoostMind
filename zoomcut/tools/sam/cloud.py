"""keep.py track, done in the cloud (tools/sam/server.py - a Cloud Run JOB with an L4 in europe-west4): the take goes up
to the studio's bucket once (gs://shlomiverse-studio/sam/in/), the job follows the marked things on every frame at full
size and stops, the mask comes back. His gcloud login runs it. ~5-10 cents a take (billed only while it runs).
  python tools/sam/cloud.py <take.mp4> <objects.json> <out.mkv> <w> <h> <fps> <frames>      (same arguments as keep.py track)"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

PROJECT, REGION, SERVICE, BUCKET = "boostmind-b052c", "europe-west4", "keep-sam", "shlomiverse-studio"


def gc(*a):
    r = subprocess.run(["cmd", "/c", "gcloud", *a] if os.name == "nt" else ["gcloud", *a], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"gcloud {' '.join(a[:3])}: {r.stderr.strip()[-300:]}")
    return r.stdout.strip()


def api(method, path, body=None):
    """Cloud Run's API with his login (his gcloud is from 2024 - older than GPU jobs, so not `gcloud run jobs`)."""
    tok = gc("auth", "print-access-token")
    req = urllib.request.Request(f"https://run.googleapis.com/v2/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"authorization": f"Bearer {tok}", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def run_job(args):
    """One execution with these arguments; waits for it; raises with its message if it failed."""
    op = api("POST", f"projects/{PROJECT}/locations/{REGION}/jobs/{SERVICE}:run", {"overrides": {"containerOverrides": [{"args": args}]}})
    while not op.get("done"):
        time.sleep(10)
        op = api("GET", op["name"])
    if op.get("error"):
        raise SystemExit(f"the cloud job failed: {op['error'].get('message', op['error'])}")
    ex = op.get("response", {})
    if ex.get("failedCount"):
        raise SystemExit(f"the cloud job failed: {json.dumps(ex.get('conditions', []))[:400]}")
    return ex


def track(take, objects, out, w, h, fps, frames):
    st = os.stat(take)
    key = hashlib.md5(f"{os.path.basename(take)}|{st.st_size}".encode()).hexdigest()[:12]
    src = f"gs://{BUCKET}/sam/in/{key}.mp4"
    dst = f"gs://{BUCKET}/sam/out/{key}-{hashlib.md5(json.dumps(objects, sort_keys=True).encode()).hexdigest()[:8]}.mkv"
    t0 = time.time()
    if subprocess.run(["cmd", "/c", "gcloud", "storage", "ls", src] if os.name == "nt" else ["gcloud", "storage", "ls", src], capture_output=True).returncode:
        gc("storage", "cp", take, src)
    t1 = time.time()
    job = base64.b64encode(json.dumps({"take": src, "objects": objects, "w": w, "h": h, "fps": fps, "frames": frames, "out": dst}).encode()).decode()
    run_job([job])
    ans = json.loads(gc("storage", "cat", dst + ".json"))
    t2 = time.time()
    gc("storage", "cp", dst, out)
    print(f"cloud: upload {t1 - t0:.0f}s, job {t2 - t1:.0f}s (download {ans.get('download')}s, follow {ans.get('follow')}s on {ans.get('gpu')}), "
          f"back {time.time() - t2:.0f}s -> {out}", flush=True)
    return ans


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) != 7:
        raise SystemExit(__doc__)
    track(a[0], json.load(open(a[1], encoding="utf-8")), a[2], int(a[3]), int(a[4]), int(a[5]), int(a[6]))
