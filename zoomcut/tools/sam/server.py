"""keep.py track in the cloud - a Cloud Run JOB with an NVIDIA L4 (his ask, 2026-11-04: "let's try it once in Google Cloud";
a job, not a service: it starts, follows the marked things, stops - billed only while it runs, ~3-5 min a take, no idle
GPU minutes after it). The take comes from the studio's bucket, the kept objects' mask goes back there.
  python server.py <base64 of {"take": "gs://.../take.mp4", "objects": [...], "w", "h", "fps", "frames", "out": "gs://..."}>
  (tools/sam/cloud.py runs it: gcloud run jobs execute keep-sam --args=<that> --wait)"""
import base64
import json
import os
import sys
import tempfile
import time

os.environ.setdefault("KEEP_DEVICE", "cuda")
import keep  # noqa: E402  (after KEEP_DEVICE: it picks the model and size from it)


def gs(uri):
    from google.cloud import storage
    b, _, name = uri[5:].partition("/")
    return storage.Client().bucket(b).blob(name)


if __name__ == "__main__":
    import torch
    q = json.loads(base64.b64decode(sys.argv[1]))
    t0 = time.time()
    d = tempfile.mkdtemp()
    take, out = os.path.join(d, "take.mp4"), os.path.join(d, "objs.mkv")
    gs(q["take"]).download_to_filename(take)
    t1 = time.time()
    keep.track(take, q["objects"], out, int(q["w"]), int(q["h"]), int(q["fps"]), int(q["frames"]))
    t2 = time.time()
    gs(q["out"]).upload_from_filename(out)
    stats = {"download": round(t1 - t0, 1), "follow": round(t2 - t1, 1), "upload": round(time.time() - t2, 1),
             "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none"}
    gs(q["out"] + ".json").upload_from_string(json.dumps(stats))  # (the studio reads the times from here)
    print(json.dumps(stats), flush=True)
