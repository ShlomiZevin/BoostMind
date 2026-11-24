"""Naomi's real frame on the video's own set (guest studio B, the editor's guest-2.jpg) - the frame as it reads in the video.
usage: python plate.py <cutout.png> <out.png> [W H scale dy dx]
Writes out.png (the plate), out-person.png (her alone on transparent, plate-sized - pasted back over every model edit)
and out-mask.png (for /images/edits: opaque over her = kept, transparent elsewhere = the model may paint)."""
import sys, os
from PIL import Image, ImageFilter

here = os.path.dirname(os.path.abspath(__file__))
cut, out = sys.argv[1], sys.argv[2]
W, H = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1088, 1920)
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.5
dy = int(sys.argv[6]) if len(sys.argv) > 6 else None
bg = Image.open(os.path.join(here, "..", "..", "..", "..", "..", "zoomcut", "episodes", "_assets", "naomi", "guest", "guest-2.jpg")).convert("RGB")
k = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * k), round(bg.height * k)), Image.LANCZOS)
bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
p = Image.open(cut).convert("RGBA")
p = p.resize((round(p.width * scale), round(p.height * scale)), Image.LANCZOS)
bbox = p.getchannel("A").getbbox()
if dy is None:
    dy = H - bbox[3]  # her cut bottom (above the keyboard) sits on the plate's bottom edge
dx = int(sys.argv[7]) if len(sys.argv) > 7 else (W - p.width) // 2
person = Image.new("RGBA", (W, H), (0, 0, 0, 0))
person.alpha_composite(p, (dx, dy))
plate = bg.convert("RGBA")
plate.alpha_composite(person)
plate.convert("RGB").save(out)
person.save(out.replace(".png", "-person.png"))
a = person.getchannel("A").filter(ImageFilter.MaxFilter(9))  # a little bigger than her, so the model leaves her edge alone
mask = Image.new("RGBA", (W, H), (0, 0, 0, 0))
mask.putalpha(a)
mask.save(out.replace(".png", "-mask.png"))
print("dx", dx, "dy", dy)
