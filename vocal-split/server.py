"""Vocal split — strips the singers from a song (Demucs htdemucs), for Karaoke Booth.

POST /separate      multipart "file" (audio or video) → {job, hash}
GET  /jobs/{job}    → {status: queued|running|done|error, progress 0..1, files?: {instrumental, vocals}}
GET  /files/{hash}/{instrumental|vocals}.mp3

Results are cached by the file's SHA-1, so a song is separated once. Runs the same locally and on
Cloud Run (PORT env). CPU only.
"""
import glob
import hashlib
import os
import re
import shutil
import subprocess
import sys
import threading
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("CACHE_DIR", os.path.join(ROOT, "cache"))
MODEL = os.environ.get("DEMUCS_MODEL", "htdemucs")
os.makedirs(CACHE, exist_ok=True)


def _ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    hits = glob.glob(os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages", "Gyan.FFmpeg*", "ffmpeg-*", "bin", "ffmpeg.exe"))
    if hits:
        return hits[0]
    raise RuntimeError("ffmpeg not found")


FFMPEG = _ffmpeg()
app = FastAPI(title="vocal-split")
app.add_middleware(CORSMiddleware, allow_origin_regex=r"https://boostmind-b052c(--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)|http://localhost(:\d+)?",
                   allow_methods=["*"], allow_headers=["*"])
jobs = {}
lock = threading.Lock()  # one separation at a time: Demucs already uses every core


def _done(h):
    d = os.path.join(CACHE, h)
    return all(os.path.exists(os.path.join(d, f"{s}.mp3")) for s in ("instrumental", "vocals"))


def _files(h):
    return {"instrumental": f"/files/{h}/instrumental.mp3", "vocals": f"/files/{h}/vocals.mp3"}


def _run(job_id, h, src):
    job = jobs[job_id]
    with lock:
        try:
            d = os.path.join(CACHE, h)
            wav = os.path.join(d, "input.wav")
            job.update(status="running", stage="reading the song", progress=0.02)
            subprocess.run([FFMPEG, "-y", "-v", "error", "-i", src, "-vn", "-ac", "2", "-ar", "44100", wav], check=True)
            job.update(stage="separating the singers", progress=0.05)
            out = os.path.join(d, "demucs")
            p = subprocess.Popen([sys.executable, "-m", "demucs", "-n", MODEL, "--two-stems", "vocals", "--mp3", "--mp3-bitrate", "256",
                                  "-o", out, wav], stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace")
            buf = ""
            while True:
                ch = p.stderr.read(1)
                if not ch:
                    break
                buf += ch
                if ch in "\r\n":
                    m = re.search(r"(\d+)%\|", buf)
                    if m:
                        job["progress"] = 0.05 + 0.9 * int(m.group(1)) / 100
                    buf = ""
            if p.wait():
                raise RuntimeError("demucs failed")
            stem_dir = os.path.join(out, MODEL, "input")
            shutil.move(os.path.join(stem_dir, "no_vocals.mp3"), os.path.join(d, "instrumental.mp3"))
            shutil.move(os.path.join(stem_dir, "vocals.mp3"), os.path.join(d, "vocals.mp3"))
            shutil.rmtree(out, ignore_errors=True)
            os.remove(wav)
            os.remove(src)
            job.update(status="done", stage="done", progress=1.0, files=_files(h))
        except Exception as e:  # noqa: BLE001
            job.update(status="error", stage=str(e))


@app.post("/separate")
async def separate(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "empty file")
    h = hashlib.sha1(data).hexdigest()[:20]
    job_id = uuid.uuid4().hex[:12]
    if _done(h):
        jobs[job_id] = {"status": "done", "stage": "done (cached)", "progress": 1.0, "files": _files(h)}
        return {"job": job_id, "hash": h}
    d = os.path.join(CACHE, h)
    os.makedirs(d, exist_ok=True)
    src = os.path.join(d, "upload" + os.path.splitext(file.filename or "")[1].lower())
    with open(src, "wb") as f:
        f.write(data)
    jobs[job_id] = {"status": "queued", "stage": "waiting", "progress": 0.0}
    threading.Thread(target=_run, args=(job_id, h, src), daemon=True).start()
    return {"job": job_id, "hash": h}


@app.get("/jobs/{job_id}")
def job(job_id: str):
    j = jobs.get(job_id)
    if not j:
        raise HTTPException(404, "no such job")
    return j


@app.get("/files/{h}/{name}.mp3")
def files(h: str, name: str):
    if name not in ("instrumental", "vocals") or not re.fullmatch(r"[0-9a-f]{20}", h):
        raise HTTPException(404)
    p = os.path.join(CACHE, h, f"{name}.mp3")
    if not os.path.exists(p):
        raise HTTPException(404)
    return FileResponse(p, media_type="audio/mpeg")


@app.get("/")
def health():
    return {"ok": True, "model": MODEL}
