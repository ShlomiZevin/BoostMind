"""SYNTHETIC TEST MATERIAL — not real footage.
Builds fake takes for an episode from its script using Hebrew TTS, recorded the way the real
actors are asked to: one take per character, lines in order with pauses, interrupted lines
carried on past the dash, one fumbled-then-retaken line, a final 'one more try', and a silent
listening take. Every frame says TEST and shows the source timecode.

    python tools/make_test_footage.py episodes/<name> [--out episodes/<name>-test]
"""
import argparse
import asyncio
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")
import edge_tts  # noqa: E402

from pipeline.common import FFMPEG, Episode  # noqa: E402
from pipeline.script_parse import parse_script  # noqa: E402

VOICES = {"amir": ("he-IL-AvriNeural", "-6%", "-4Hz"), "ofer": ("he-IL-AvriNeural", "+10%", "+10Hz"),
          "daniel": ("he-IL-HilaNeural", "+0%", "-14Hz")}
COLORS = {"amir": "0x24324a", "ofer": "0x3a2a40", "daniel": "0x23402f"}
CONTINUE = " אני רק רוצה להסביר רגע את הנקודה הזאת"
FONT = "C\\:/Windows/Fonts/arialbd.ttf"


async def tts(text, voice, out):
    v, rate, pitch = voice
    await edge_tts.Communicate(text, v, rate=rate, pitch=pitch).save(out)


def build_take(cid, utterances, tmp, out, voice, label):
    parts = []
    for k, text in enumerate(utterances):
        p = os.path.join(tmp, f"{cid}_{k}.mp3")
        asyncio.run(tts(text, voice, p))
        parts.append(p)
    lst = os.path.join(tmp, f"{cid}_list.txt")
    sil = os.path.join(tmp, "sil.wav")
    subprocess.run([FFMPEG, "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "1.1", sil], check=True)
    wavs = []
    for k, p in enumerate(parts):
        w = p.replace(".mp3", ".wav")
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", p, "-ar", "48000", "-ac", "1", w], check=True)
        wavs += [sil, w]
    wavs.append(sil)
    with open(lst, "w", encoding="utf-8") as fh:
        fh.writelines(f"file '{w}'\n" for w in wavs)
    audio = os.path.join(tmp, f"{cid}_take.wav")
    subprocess.run([FFMPEG, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, audio], check=True)
    video(cid, audio, out, label)


def video(cid, audio, out, label, seconds=None):
    vf = (f"drawtext=fontfile='{FONT}':text='TEST MATERIAL':x=40:y=40:fontsize=44:fontcolor=white@0.6,"
          f"drawtext=fontfile='{FONT}':text='{label}':x=(w-tw)/2:y=(h-th)/2-60:fontsize=120:fontcolor=white,"
          f"drawtext=fontfile='{FONT}':text='%{{pts\\:hms}}':x=(w-tw)/2:y=(h/2)+80:fontsize=72:fontcolor=white@0.85")
    src = ["-f", "lavfi", "-i", f"color=c={COLORS[cid]}:s=1920x1080:r=30"]
    cmd = [FFMPEG, "-y", "-v", "error", *src]
    if audio:
        cmd += ["-i", audio, "-shortest"]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", str(seconds)]
    cmd += ["-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-pix_fmt", "yuv420p", out]
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--out")
    a = ap.parse_args()
    ep = Episode(a.episode)
    out_dir = a.out or ep.dir + "-test"
    os.makedirs(os.path.join(out_dir, "input"), exist_ok=True)
    for fn in ("episode.json", "script.txt"):
        shutil.copy(ep.p(fn), os.path.join(out_dir, fn))
    tmp = os.path.join(out_dir, "_tts")
    os.makedirs(tmp, exist_ok=True)
    items = parse_script(open(ep.p("script.txt"), encoding="utf-8").read(), ep.characters)
    for ch in ep.characters:
        cid = ch["id"]
        utt = []
        for it in items:
            if it["type"] != "line" or it["speaker"] != cid:
                continue
            text = it["match_text"] + (CONTINUE if it["interrupted"] else "")
            if cid == "amir" and it["n"] == 3:
                utt.append(" ".join(text.split()[:5]) + " רגע, שנייה, מההתחלה")  # fumbled first try
            utt.append(text)
        if ch.get("role") == "victim":
            utt.append("רגע, אפשר רק להגיד משהו אחד קטן")
        print(f"  {cid}: {len(utt)} utterances")
        build_take(cid, utt, tmp, os.path.join(out_dir, "input", f"{cid}.mp4"), VOICES[cid], f"TEST  {cid.upper()}")
        video(cid, None, os.path.join(out_dir, "input", f"{cid}-listen.mp4"), f"TEST  {cid.upper()}  LISTEN", seconds=45)
    shutil.rmtree(tmp)
    print("✔ test footage in", os.path.join(out_dir, "input"))


if __name__ == "__main__":
    main()
