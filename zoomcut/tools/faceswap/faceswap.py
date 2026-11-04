# Face swap on his PC - any image's face onto his videos, sound kept (his ask, 2026-11-03).
#   faceswap.cmd "<video>" "<image>" [a|c|ai|ai-best]
#   faceswap.cmd "<folder>" [a|c|ai|ai-best]     a Drop folder: every video in it, with the one image in it
#     (a folder name alone is looked up in Downloads\drop, e.g. faceswap.cmd "החלפת פנים")
# a  (default) the quick Snapchat way, the face takes his light           -> <video>.a.mp4
# c  the same + Poisson blending, the most blended, a little slower       -> <video>.c.mp4
# ai / ai-best  the FaceFusion AI face (~25 min per 1 min of video)       -> <video>.swap.mp4
# Runs at low priority: the PC stays usable.
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = os.path.join(os.path.expanduser('~'), 'Downloads', 'drop')
VIDEO = ('.mov', '.mp4', '.m4v')
IMAGE = ('.jpg', '.jpeg', '.png', '.webp', '.heic')
AI = r'C:\tmp\faceswap\swap.py'  # the FaceFusion AI face (its install stays in c:\tmp - big, and he found it too slow)
LOW = getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)

def ours(name):  # a result of this script, not a take
    return name.lower().endswith(('.a.mp4', '.c.mp4', '.swap.mp4', '.quick.mp4'))

def readable(image):
    """an image the swap can open: iPhone HEIC photos become a jpg next to it first"""
    if not image.lower().endswith('.heic'): return image
    jpg = os.path.splitext(image)[0] + '.jpg'
    if not os.path.exists(jpg):
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', image, '-frames:v', '1', jpg], check=True)
    return jpg

def swap(video, image, mode):
    image = readable(image)
    if mode in ('a', 'c'):
        out = os.path.splitext(video)[0] + f'.{mode}.mp4'
        env = dict(os.environ, QS_BLEND='light' if mode == 'a' else 'light+poisson')
        subprocess.run([os.path.join(HERE, '.venv', 'Scripts', 'python.exe'), os.path.join(HERE, 'quick.py'), video, image, out],
                       check=True, env=env, creationflags=LOW)
    else:
        subprocess.run([sys.executable, AI, video, image, 'best' if mode == 'ai-best' else 'fast'], check=True)

def main():
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    mode = args.pop().lower() if args[-1].lower() in ('a', 'c', 'ai', 'ai-best') else 'a'
    first = args[0]
    if not os.path.exists(first) and os.path.isdir(os.path.join(DROP, first)): first = os.path.join(DROP, first)
    if os.path.isdir(first):
        names = sorted(os.listdir(first))
        images = [n for n in names if n.lower().endswith(IMAGE) and not n.startswith('.')]
        videos = [n for n in names if n.lower().endswith(VIDEO) and not ours(n)]
        if len(args) > 1: images = [args[1]]  # an image named after the folder
        if not images: sys.exit(f'no image in {first} - put the face picture in the folder')
        if len(images) > 1 and len(args) == 1:
            sys.exit(f'more than one image in {first}: ' + ', '.join(images) + ' - name the one to use after the folder')
        if not videos: sys.exit(f'no video in {first}')
        image = images[0] if os.path.isabs(images[0]) else os.path.join(first, images[0])
        for v in videos:
            print(f'--- {v} with {os.path.basename(image)}'); swap(os.path.join(first, v), image, mode)
    else:
        if len(args) < 2: sys.exit(__doc__)
        swap(os.path.abspath(first), os.path.abspath(args[1]), mode)

if __name__ == '__main__':
    main()
