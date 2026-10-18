"""Eye contact on the cloud GPU (the eye-gpu Cloud Run service: LivePortrait on an NVIDIA L4).

  python tools/eyes_cloud.py SRC OUT [--seconds N] [--k 180] [--y 0] [--preview]

Uploads the take to the eyes bucket (files there delete themselves after a day), calls the service with your gcloud
login, downloads the result. Costs a few cents a video; the service sleeps (and costs nothing) between videos.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

PROJECT, REGION, SERVICE, BUCKET = "boostmind-b052c", "europe-west4", "eye-gpu", "boostmind-b052c-eyes"


def gcloud(*args):
    exe = shutil.which("gcloud") or shutil.which("gcloud.cmd")
    return subprocess.run([exe, *args, "--project", PROJECT], capture_output=True, text=True, check=True).stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--seconds", type=float)
    ap.add_argument("--k", type=float, default=180.0)
    ap.add_argument("--y", type=float, default=0.0)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    t0 = time.time()
    h = hashlib.sha1(open(a.src, "rb").read()).hexdigest()[:12]
    src_uri = f"gs://{BUCKET}/in/{h}.mp4"
    dst_uri = f"gs://{BUCKET}/out/{h}-{int(t0)}.mp4"
    gcloud("storage", "cp", a.src, src_uri)
    print(f"  · uploaded ({time.time() - t0:.0f}s)", flush=True)
    url = gcloud("run", "services", "describe", SERVICE, "--region", REGION, "--format", "value(status.url)")
    token = gcloud("auth", "print-identity-token")
    body = json.dumps({"src": src_uri, "dst": dst_uri, "k": a.k, "y": a.y, "seconds": a.seconds, "preview": a.preview}).encode()
    req = urllib.request.Request(url + "/eyes", data=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=3600) as r:
        stats = json.loads(r.read())
    print(f"  · processed: {stats} ({time.time() - t0:.0f}s)", flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    gcloud("storage", "cp", dst_uri, a.out)
    print(f"✔ {a.out}  ({time.time() - t0:.0f}s total)")


if __name__ == "__main__":
    main()
