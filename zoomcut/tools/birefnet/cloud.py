"""A better cut-out for a one-camera project, made in the cloud: BiRefNet-portrait on every frame (a Cloud Run JOB with an L4
in europe-west4, project boostmind-b052c - image europe-west4-docker.pkg.dev/boostmind-b052c/studio-jobs/birefnet).
For when the studio's own cut-out (fast / quality / hybrid) is bad: a white wall or ceiling behind the head, something
round behind it (a clock), fast hands, a face filter. Offered to him, run only when he says yes (his rule, 2026-11-26).
Cost: ~4 frames a second on the L4, ~$1 an hour of job time -> ~30 cents for 2 minutes of takes (only billed while it runs).

  python tools/birefnet/cloud.py <episode id>            every take of the project -> work/matte/<take>.birefnet.mkv
  python tools/birefnet/cloud.py <episode id> <take> ... only these takes (names without extension)
  python tools/birefnet/cloud.py --build                  rebuild the image from this folder (after changing run.py), point the job at it
  python tools/birefnet/cloud.py --create                 make the job (once per project - it exists since 2026-11-26)

Then: episode.json "matte_engine": "birefnet" -> Analyze (the studio finds the mattes, remakes the cut-out previews; it
never makes a birefnet matte itself). Analyze rebuilds project.json - re-apply what was changed by ops since the last build.
His gcloud login runs everything (REST for the job: his gcloud is from 2024, older than GPU jobs)."""
import base64
import glob
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

P, R, J, BUCKET = "boostmind-b052c", "europe-west4", "matte-birefnet", "shlomiverse-studio"
REPO = f"europe-west4-docker.pkg.dev/{P}/studio-jobs/birefnet"
HERE = os.path.dirname(os.path.abspath(__file__))
EPISODES = os.path.join(HERE, "..", "..", "episodes")
TAG_FILE = os.path.join(HERE, "image-tag.txt")


def gc(*a, check=True):
    r = subprocess.run(["cmd", "/c", "gcloud", *a] if os.name == "nt" else ["gcloud", *a], capture_output=True, text=True)
    if check and r.returncode:
        raise SystemExit(f"gcloud {' '.join(a[:3])}: {r.stderr.strip()[-400:]}")
    return r


def api(method, path, body=None):
    tok = gc("auth", "print-access-token").stdout.strip()
    req = urllib.request.Request(f"https://run.googleapis.com/v2/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"authorization": f"Bearer {tok}", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Cloud Run {e.code}: {e.read().decode()[:600]}")


def wait(op, every=5):
    while not op.get("done"):
        time.sleep(every)
        op = api("GET", op["name"])
    return op


def image():
    return f"{REPO}:{open(TAG_FILE).read().strip()}"


def spec():
    return {"template": {"taskCount": 1, "template": {
        "timeout": "3600s", "maxRetries": 0, "gpuZonalRedundancyDisabled": True, "nodeSelector": {"accelerator": "nvidia-l4"},
        "containers": [{"image": image(), "resources": {"limits": {"cpu": "4", "memory": "16Gi", "nvidia.com/gpu": "1"}}}]}}}


def build():
    tag = str(int(open(TAG_FILE).read().strip()) + 1)
    print(f"building {REPO}:{tag} (Cloud Build, ~5-10 min)...", flush=True)
    gc("builds", "submit", "--project", P, "--region", R, "--tag", f"{REPO}:{tag}", "--timeout=3600", HERE)
    open(TAG_FILE, "w").write(tag + "\n")
    op = wait(api("PATCH", f"projects/{P}/locations/{R}/jobs/{J}", spec()))
    print("job updated:", op.get("error") or image())


def create():
    op = wait(api("POST", f"projects/{P}/locations/{R}/jobs?jobId={J}", spec()))
    print("job created:", op.get("error") or J)


def run(ep, only):
    d = os.path.join(EPISODES, ep)
    cfg = json.load(open(os.path.join(d, "episode.json"), encoding="utf-8"))
    takes = sorted(glob.glob(os.path.join(cfg["input_dir"], cfg.get("takes", "*.MP4"))))
    if only:
        takes = [t for t in takes if os.path.splitext(os.path.basename(t))[0] in only]
    if not takes:
        raise SystemExit(f"no takes found in {cfg['input_dir']}")
    jobs = []
    for t in takes:
        n = os.path.splitext(os.path.basename(t))[0]
        key = f"{n}-{os.path.getsize(t)}"  # (the same name filmed again = a new file)
        src, out = f"gs://{BUCKET}/matte/in/{key}{os.path.splitext(t)[1]}", f"gs://{BUCKET}/matte/out/{key}.birefnet.mkv"
        if gc("storage", "ls", src, check=False).returncode:
            print(f"  up: {n}", flush=True)
            gc("storage", "cp", t, src)
        jobs.append((n, src, out))
    t0 = time.time()
    print(f"cloud job on {len(jobs)} takes...", flush=True)
    arg = base64.b64encode(json.dumps({"takes": [{"src": s, "out": o} for _, s, o in jobs]}).encode()).decode()
    op = wait(api("POST", f"projects/{P}/locations/{R}/jobs/{J}:run", {"overrides": {"containerOverrides": [{"args": [arg]}]}}), 15)
    if op.get("error") or op.get("response", {}).get("failedCount"):
        raise SystemExit(f"the job failed: {json.dumps(op.get('error') or op.get('response', {}).get('conditions'))[:500]}\n"
                         f"logs: gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name={J}\" --project {P} --limit 30")
    os.makedirs(os.path.join(d, "work", "matte"), exist_ok=True)
    for n, _, o in jobs:
        gc("storage", "cp", o, os.path.join(d, "work", "matte", f"{n}.birefnet.mkv"))
    print(f"done in {time.time() - t0:.0f}s -> {ep}/work/matte/*.birefnet.mkv\n"
          f"next: episode.json \"matte_engine\": \"birefnet\", then Analyze (and re-apply changes made by ops since the last build)")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        raise SystemExit(__doc__)
    if a[0] == "--build":
        build()
    elif a[0] == "--create":
        create()
    else:
        run(a[0], set(a[1:]))
