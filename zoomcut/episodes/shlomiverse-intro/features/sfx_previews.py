# sound-effect choices for trailer 2, heard in place: each star sound on the title's falling star, each whoosh on the
# panel changes, mixed onto the current render (no re-render). -> out/sfx-page/ (mp3 alone + mp4 in context, 540 px)
#   python features/sfx_previews.py out/shlomiverse-features-f19-story.mp4
import os, sys, subprocess, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else 'out/shlomiverse-features-f19-story.mp4')
PICK = os.path.join(HERE, 'music/sfx-pick')
OUT = os.path.join(HERE, 'out/sfx-page'); os.makedirs(OUT, exist_ok=True)
HK = json.load(open(os.path.join(HERE, 'features/hook-float.json'), encoding='utf8'))
STAR_T = HK['title_at'] + HK.get('star_at', 0.62) - 0.17          # the swell starts a beat before the star shows
SLOTS = [5.15, 6.4, 7.65, 8.9, 10.15]
WHOOSH_T = [SLOTS[0] - 0.4] + [s - 0.35 for s in SLOTS[1:]]        # into the first panel, then every change
def run(*a): subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
def shaped(k, fade_in, vol):
    return f"[1:a]aformat=channel_layouts=mono,afade=t=in:d={fade_in},volume={vol}"
for k in ('s1', 's2', 's3', 's4', 's5', 's6'):
    src = os.path.join(PICK, k + '.mp3')
    run('-i', src, '-af', 'afade=t=in:d=0.25', os.path.join(OUT, f'{k}.mp3'))
    ms = int(STAR_T * 1000)
    fc = (shaped(k, 0.25, 0.55) + ",asplit=2[a][b];[a]volume='0.35+0.65*min(1,t/0.9)':eval=frame[l];"
          "[b]volume='1-0.65*min(1,t/0.9)':eval=frame[r];[l][r]join=inputs=2:channel_layout=stereo,"
          f"adelay={ms}|{ms}[s];[0:a][s]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[m]")
    run('-i', SRC, '-i', src, '-filter_complex', fc, '-map', '0:v', '-map', '[m]', '-ss', '1.5', '-t', '3.4',
        '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-c:a', 'aac', '-b:a', '160k', os.path.join(OUT, f'{k}-in-trailer.mp4'))
    print(k)
for k in ('t1', 't2', 't3', 't4'):
    src = os.path.join(PICK, k + '.mp3')
    run('-i', src, '-af', 'afade=t=in:d=0.1', os.path.join(OUT, f'{k}.mp3'))
    ins, fc = [], []
    for i, t in enumerate(WHOOSH_T):
        ms = int(t * 1000)
        fc.append(f"[1:a]aformat=channel_layouts=stereo,afade=t=in:d=0.1,volume=0.45,adelay={ms}|{ms}[w{i}]")
    fc.append('[0:a]' + ''.join(f'[w{i}]' for i in range(len(WHOOSH_T))) + f'amix=inputs={len(WHOOSH_T) + 1}:duration=first:normalize=0,alimiter=limit=0.95[m]')
    run('-i', SRC, '-i', src, '-filter_complex', ';'.join(fc), '-map', '0:v', '-map', '[m]', '-ss', '4.3', '-t', '6.3',
        '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-c:a', 'aac', '-b:a', '160k', os.path.join(OUT, f'{k}-in-trailer.mp4'))
    print(k)
print(OUT)
