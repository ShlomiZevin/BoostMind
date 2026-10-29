"""A techno beat on the song's own grid: kick on every beat, hi-hat on the off-beats, clap on 2 and 4.
  python tools/song_beat.py <backing audio> <out.wav> [--at <clip time of the backing's second 0>] [--secs 30]
                            [--project <id>]      (--project: uploads it and adds a "ביט טכנו" layer, volume 0.9)
The tempo and the first beat come from the backing's onsets (autocorrelation, 70-180 BPM; numpy only). He liked it
under the "זוט חני" clip (2026-10-29) at ~6 dB under the music - mute the layer if a song doesn't want it."""
import json, subprocess, sys, urllib.request
import numpy as np

SR = 48000
def arg(k, d=None): return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d

def grid(x):
    """(seconds per beat, first beat) from the onset strength at 100 Hz."""
    e = np.array([np.sqrt(np.mean(x[i:i + 480] ** 2) + 1e-12) for i in range(0, len(x) - 480, 480)])
    o = np.maximum(0, np.diff(np.log(e + 1e-4), prepend=0)); o -= o.mean()
    lags = np.arange(int(100 * 60 / 180), int(100 * 60 / 70) + 1)
    ac = np.array([np.dot(o[:-l], o[l:]) for l in lags])
    # the beat's multiples count too (2, 4 beats later) - the long-run tempo wins over a lucky neighbour
    comb = np.array([ac[i] + sum(0.5 * np.dot(o[:-m * l], o[m * l:]) for m in (2, 4) if m * l < len(o) // 2) for i, l in enumerate(lags)])
    lag = lags[np.argmax(comb)]
    k = np.exp(-0.5 * (np.arange(-4, 5) / 1.5) ** 2); o = np.convolve(np.maximum(o, 0), k, 'same')   # a little slack per onset
    fine = np.linspace(lag - 1, lag + 1, 81)          # sub-frame tempo: the grid that lands on the most onsets
    def score(P, ph):
        idx = (ph + P * np.arange(int((len(o) - ph) / P))).astype(int); return o[idx].sum() / len(idx) ** 0.5 * len(idx) ** 0.5
    best = max(((score(P, ph), P, ph) for P in fine for ph in np.arange(0, P, 0.5)), key=lambda z: z[0])
    return best[1] / 100, best[2] / 100

def main():
    if len(sys.argv) < 3: print(__doc__); sys.exit(1)
    src, out = sys.argv[1], sys.argv[2]
    at, secs = float(arg('--at', 0)), float(arg('--secs', 30))
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f64le', '-'],
                                     capture_output=True).stdout, np.float64)
    P, b0 = grid(x); t0 = b0 + at
    print(f'{60 / P:.2f} BPM, first beat at {b0:.3f} s of the backing')
    n = int(secs * SR); y = np.zeros(n); rng = np.random.default_rng(3)
    def add(s, t, g):
        i = int(t * SR)
        if 0 <= i < n: y[i:i + len(s)] += g * s[:n - i]
    tk = np.arange(int(0.45 * SR)) / SR
    kick = np.sin(2 * np.pi * (45 * tk + 75 * 0.045 * (1 - np.exp(-tk / 0.045)))) * np.exp(-tk / 0.16); kick[:96] += np.linspace(1, 0, 96) * 0.6
    th = np.arange(int(0.05 * SR)) / SR; hat = np.diff(rng.standard_normal(len(th) + 1)) * np.exp(-th / 0.012) * 0.5
    tc = np.arange(int(0.18 * SR)) / SR
    clap = sum(np.pad(np.diff(rng.standard_normal(len(tc) + 1)) * np.exp(-tc / 0.05), (d, 0))[:len(tc)] for d in (0, 300, 650)) * 0.35
    j0 = int(np.ceil(-t0 / P))
    for j in range(j0, j0 + int(secs / P) + 2):
        t = t0 + j * P
        add(kick, t, 0.9); add(hat, t + P / 2, 0.35)
        if j % 2: add(clap, t, 0.55)
    y = y / np.abs(y).max() * 0.8
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'afade=t=in:d=0.02', out], input=y.tobytes(), check=True)
    ep = arg('--project')
    if ep:
        api = 'http://localhost:4747'
        req = urllib.request.Request(f'{api}/api/p/{ep}/assets?name=techno-beat.wav', data=open(out, 'rb').read())
        aid = json.load(urllib.request.urlopen(req))['id']
        v = json.load(urllib.request.urlopen(f'{api}/api/p/{ep}')); p = v.get('project', v)
        ops = [{'op': 'layer.add', 'layer': {'id': 'beat', 'kind': 'audio', 'name': 'ביט טכנו', 'props': {'volume': 0.9},
                'items': [{'id': 'b1', 'asset': aid, 'in': 0, 'from': 0, 'dur': min(p['duration'], int(secs * 30)), 'gain': 1, 'fade_out': 0.6}]}}]
        req = urllib.request.Request(f'{api}/api/p/{ep}/ops', data=json.dumps({'rev': p['rev'], 'ops': ops}).encode(), headers={'content-type': 'application/json'})
        print(json.load(urllib.request.urlopen(req)).get('ok'), '- layer "ביט טכנו" added')

if __name__ == '__main__':
    main()
