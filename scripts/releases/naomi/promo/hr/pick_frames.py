"""Pull candidate frames from the raw Naomi footage and lay them out as one labelled sheet.
usage: python pick_frames.py <video> <t1> <t2> ...   -> frames/f_<t>.png + frames/cands.jpg"""
import subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont

video, times = sys.argv[1], [float(t) for t in sys.argv[2:]]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "frames")
os.makedirs(out, exist_ok=True)
tiles = []
for t in times:
    p = os.path.join(out, f"f_{t:g}.png")
    if not os.path.exists(p):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", p], check=True)
    tiles.append((t, Image.open(p).convert("RGB")))
cols = 6
tw, th = 300, 533
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), "black")
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 34)
d = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate(tiles):
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im.resize((tw, th)), (x, y))
    d.rectangle([x, y, x + 110, y + 44], fill="black")
    d.text((x + 6, y + 4), f"{t:g}", fill="yellow", font=font)
sheet.save(os.path.join(out, "cands.jpg"), quality=85)
