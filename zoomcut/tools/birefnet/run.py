"""args[0] = base64 JSON {"takes": [{"src": "gs://b/x.mov", "out": "gs://b/x.mkv"}], "w": 432, "h": 768, "fps": 30}
Every frame (decoded exactly as the studio's matte(): scale (area) then fps) -> BiRefNet-portrait at 1024 -> gray ffv1 mask."""
import base64, json, subprocess, sys, time
import numpy as np, torch, torch.nn.functional as F
from google.cloud import storage
from transformers import AutoModelForImageSegmentation

cfg = json.loads(base64.b64decode(sys.argv[1]))
W, H, FPS = cfg.get("w", 432), cfg.get("h", 768), cfg.get("fps", 30)
gcs = storage.Client()
def blob(u):
    b, p = u[5:].split("/", 1)
    return gcs.bucket(b).blob(p)

t0 = time.time()
model = AutoModelForImageSegmentation.from_pretrained("ZhengPeng7/BiRefNet-portrait", trust_remote_code=True).cuda().eval().half()
torch.set_float32_matmul_precision("high")
mean = torch.tensor([0.485, 0.456, 0.406], device="cuda").view(1, 3, 1, 1)
std = torch.tensor([0.229, 0.224, 0.225], device="cuda").view(1, 3, 1, 1)
print(f"model {time.time()-t0:.0f}s on {torch.cuda.get_device_name(0)}", flush=True)

def dims(path):
    """the picture's size as shown (a phone's rotate flag: older ffprobe keeps it in tags.rotate, newer in side data)"""
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", path],
                                  capture_output=True, text=True).stdout)["streams"][0]
    w, h = j["width"], j["height"]
    rot = abs(int(j.get("tags", {}).get("rotate", 0) or 0))
    for sd in j.get("side_data_list", []):
        rot = abs(int(sd.get("rotation", rot) or rot))
    return (h, w) if rot % 180 == 90 else (w, h)

report = []
for tk in cfg["takes"]:
    t1 = time.time()
    local = "/tmp/in" + tk["src"][tk["src"].rfind("."):]
    blob(tk["src"]).download_to_filename(local)
    dw, dh = dims(local)
    s = min(1.0, 1280 / max(dw, dh)); dw, dh = int(dw * s) // 2 * 2, int(dh * s) // 2 * 2
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", local, "-vf", f"scale={dw}:{dh}:flags=area,fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "/tmp/out.mkv"], stdin=subprocess.PIPE)
    size, n, batch = dw * dh * 3, 0, []
    def flush():
        x = torch.from_numpy(np.stack(batch)).cuda().permute(0, 3, 1, 2).float() / 255
        x = F.interpolate(x, (1024, 1024), mode="bilinear", align_corners=False)
        with torch.no_grad():
            y = model(((x - mean) / std).half())[-1].sigmoid().float()
        y = F.interpolate(y, (H, W), mode="bilinear", align_corners=False)
        enc.stdin.write((y.clamp(0, 1) * 255).round().byte().cpu().numpy().tobytes())
        batch.clear()
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size: break
        batch.append(np.frombuffer(buf, np.uint8).reshape(dh, dw, 3)); n += 1
        if len(batch) == 8: flush()
    if batch: flush()
    enc.stdin.close(); enc.wait(); dec.wait()
    blob(tk["out"]).upload_from_filename("/tmp/out.mkv")
    report.append({"src": tk["src"], "frames": n, "secs": round(time.time() - t1, 1)})
    print(report[-1], flush=True)
blob(cfg["takes"][0]["out"].rsplit("/", 1)[0] + "/report.json").upload_from_string(json.dumps(report))
