"""Eye contact on a GPU (Cloud Run, NVIDIA L4) - for Sketch Studio.

POST /eyes {src: gs://..., dst: gs://..., k?, y?, seconds?, preview?, batch?} -> {frames, redrawn, seconds, gpu_seconds}
The video goes through Cloud Storage both ways (Cloud Run caps a request body at 32 MB). One video at a time.
"""
import os
import tempfile
import threading
import time
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import eyes

app = FastAPI()
LOCK = threading.Lock()

# Shut down soon after the last video: with a GPU, Google bills a warm-but-idle instance (it would keep it up to
# ~15 min). Exiting ends the instance; the next video simply starts a fresh one.
IDLE_EXIT = float(os.environ.get("IDLE_EXIT", "90"))
_last = [time.time()]


def _watchdog():
    while True:
        time.sleep(10)
        if not LOCK.locked() and time.time() - _last[0] > IDLE_EXIT:
            os._exit(0)


threading.Thread(target=_watchdog, daemon=True).start()


class Job(BaseModel):
    src: str
    dst: str
    k: float = 180.0
    y: float = 0.0
    seconds: Optional[float] = None
    preview: bool = False
    batch: int = 16


def _blob(uri):
    from google.cloud import storage
    if not uri.startswith("gs://"):
        raise HTTPException(400, f"not a gs:// path: {uri}")
    bucket, _, name = uri[5:].partition("/")
    return storage.Client().bucket(bucket).blob(name)


@app.get("/")
def health():
    import torch
    return {"ok": True, "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}


@app.post("/eyes")
def fix(j: Job):
    _last[0] = time.time()
    with LOCK, tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, "in.mp4"), os.path.join(tmp, "out.mp4")
        _blob(j.src).download_to_filename(src)
        stats = eyes.run(src, out, j.seconds, j.k, j.y, j.batch, j.preview)
        _blob(j.dst).upload_from_filename(out, content_type="video/mp4")
        _last[0] = time.time()
        return stats
