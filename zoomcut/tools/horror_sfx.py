"""Horror-scene sound kit, synthesized (no samples, no licences): a drone bed, a reverse riser, a braam impact,
a screech stinger, an accelerating heartbeat, a tinnitus whine, a soft sub pulse and a final boom.

    .venv\\Scripts\\python tools/horror_sfx.py episodes/_assets/genz/horror
"""
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def save(path, x, peak=0.89):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"{os.path.basename(path)}  {len(x) / SR:.1f}s")


def band(x, lo, hi):
    """Band-pass by FFT (smooth 1/6-octave edges)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def conv(x, h):
    n = len(x) + len(h) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:n]


def reverb(x, sec=2.5, mix=0.35, dark=6000):
    ir = band(rng.standard_normal(int(sec * SR)), 120, dark) * np.exp(-t_(sec) * 6.9 / sec)
    ir[: int(0.012 * SR)] = 0  # pre-delay
    wet = conv(x, ir)
    wet /= np.max(np.abs(wet)) + 1e-9
    out = np.zeros(len(wet))
    out[: len(x)] += x / (np.max(np.abs(x)) + 1e-9) * (1 - mix)
    return out + wet * mix


def saw(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR)
    return 2 * (ph - np.floor(ph + 0.5))


def env(t, a, d):
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)


def drone(sec=75):
    t = t_(sec)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * t / 11.0)
    x = (np.sin(2 * np.pi * 55 * t) + np.sin(2 * np.pi * 55.35 * t)) * 0.5
    x += np.sin(2 * np.pi * 82.6 * t + 0.3 * np.sin(2 * np.pi * 0.07 * t)) * 0.28 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 17))
    x += np.sin(2 * np.pi * 110.4 * t) * 0.1
    wind = band(rng.standard_normal(len(t)), 180, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 7.3 + 1)) * 0.5
    glass = np.sin(2 * np.pi * 1661 * t) * 0.025 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 5.1)) ** 2
    x = x * lfo + wind / (np.max(np.abs(wind)) + 1e-9) * 0.22 + glass
    return reverb(x, 3.0, 0.3, 3000)[: len(t)]


def braam(sec=6.0):
    t = t_(sec)
    x = np.zeros(len(t))
    for f0, g in ((49.0, 1.0), (73.4, 0.6), (98.0, 0.45), (58.3, 0.35)):  # a dark cluster
        for d in (-0.008, -0.003, 0.0, 0.004, 0.009):
            x += saw(f0 * (1 + d), t) * g
    # a falling low-pass: the bright attack fading into the dark body (a crossfade - no steps, no clicks)
    e = env(t, 0.05, 0.6)
    y = band(x, 0, 1800) * e + band(x, 0, 280) * (1 - e) * 1.6
    y = np.tanh(y / (np.max(np.abs(y)) + 1e-9) * 2.2) * env(t, 0.03, 1.6)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-t / 0.25)) / SR) * env(t, 0.005, 1.4) * 0.9
    crack = band(rng.standard_normal(len(t)), 300, 6000) * env(t, 0.001, 0.05) * 0.5
    return reverb(y * 0.8 + sub + crack, 3.5, 0.32, 4000)[: len(t)]


def riser(sec=2.6):
    t = t_(sec)
    k = t / sec
    swell = k ** 3
    noise = band(rng.standard_normal(len(t)), 800, 9000) * swell
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * (1 + 3 * k ** 2)) / SR) for f0 in (220, 233, 330)) * swell * 0.25
    # a reversed reverb tail of a hit: the classic suck-in before an impact
    hit = band(rng.standard_normal(int(0.08 * SR)), 200, 7000)
    rev = reverb(np.concatenate([hit, np.zeros(int(sec * SR))]), 2.4, 0.9, 6000)[::-1][-len(t):]
    x = noise / (np.max(np.abs(noise)) + 1e-9) * 0.5 + tone + rev / (np.max(np.abs(rev)) + 1e-9) * 0.7
    x[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return x


def stinger(sec=4.0):
    t = t_(sec)
    vib = 1 + 0.012 * np.sin(2 * np.pi * 7.5 * t)
    screech = sum(saw(f * vib * (1 + 0.04 * np.exp(-t / 0.15)), t) * g for f, g in ((1396, 1), (1480, 0.8), (2093, 0.4), (987, 0.5)))
    screech = band(screech, 600, 7000) * env(t, 0.01, 0.55) * (0.8 + 0.2 * np.sin(2 * np.pi * 13 * t))
    boom = braam(sec)[: len(t)]
    return reverb(screech / (np.max(np.abs(screech)) + 1e-9) * 0.45 + boom / (np.max(np.abs(boom)) + 1e-9), 2.8, 0.3)[: len(t)]


def heartbeat(sec=24.0, bpm0=62, bpm1=128):
    t_all = t_(sec)
    x = np.zeros(len(t_all))
    beat = t_(0.35)

    def thump(f0, g):
        return np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.6 * np.exp(-beat / 0.03))) / SR) * env(beat, 0.004, 0.075) * g
    lub, dub = thump(52, 1.0), thump(60, 0.7)
    pos = 0.0
    while pos < sec - 0.4:
        k = pos / sec
        bpm = bpm0 + (bpm1 - bpm0) * k ** 1.6
        i = int(pos * SR)
        loud = 0.45 + 0.55 * min(1, k * 1.6)
        x[i: i + len(lub)] += lub[: len(x) - i] * loud
        j = i + int(0.27 * 60 / bpm * SR)
        x[j: j + len(dub)] += dub[: max(0, len(x) - j)] * loud
        pos += 60 / bpm
    return band(x, 0, 400)


def heartbeat_climax(sec=24.0):
    """The ending's heartbeat: 70 -> 155 bpm, deeper, and swelling over its last seconds into the final boom."""
    x = heartbeat(sec, 70, 155)
    t = t_(sec)[: len(x)]
    swell = 0.55 + 0.45 * (t / sec) ** 2 + 0.6 * np.clip((t - (sec - 4)) / 4, 0, 1) ** 2
    sub = band(x, 0, 120) * 0.8  # more chest in it
    return (x + sub) * swell


def whine(sec=5.0):
    t = t_(sec)
    k = t / sec
    x = np.sin(2 * np.pi * 7400 * t) * 0.6 + np.sin(2 * np.pi * 5920 * t) * 0.25
    return x * k ** 1.5 * (1 - np.exp(-(sec - t) / 0.05))


def pulse(sec=1.6):
    t = t_(sec)
    sub = np.sin(2 * np.pi * np.cumsum(46 + 25 * np.exp(-t / 0.05)) / SR) * env(t, 0.004, 0.35)
    air = band(rng.standard_normal(len(t)), 400, 3000) * env(t, 0.12, 0.25) * 0.15
    return reverb(sub + air, 1.6, 0.25, 2500)[: len(t)]


def hum(sec=60.0):
    """A store's fluorescent tubes: the 100 Hz buzz and its harmonics, a ballast whine, a crackle now and then."""
    t = t_(sec)
    x = sum(np.sin(2 * np.pi * 100 * k * t + k) / k ** 1.3 for k in range(1, 9))
    x = np.tanh(x * 1.5) * (0.85 + 0.15 * np.sin(2 * np.pi * t / 9.0))
    x += np.sin(2 * np.pi * 9600 * t) * 0.02
    crackle = band(rng.standard_normal(len(t)), 1500, 8000) * (rng.random(len(t)) > 0.99995).astype(float)
    crackle = conv(crackle, np.exp(-t_(0.04) / 0.006))[: len(t)] * 3
    return band(x, 90, 6000) * 0.5 + crackle


def phone_drop(sec=1.0):
    """A phone dropped onto someone's lap, clear: each impact has the case's plastic click on top of a short, tight
    thud (no low mud, almost no room), then two smaller bounces and a short slide on the fabric."""
    t = t_(sec)
    x = np.zeros(len(t))

    def hit(at, g):
        i = int(at * SR)
        u = t_(0.08)
        thud = band(rng.standard_normal(len(u)), 140, 900) * env(u, 0.001, 0.018)
        body = np.sin(2 * np.pi * 190 * u) * env(u, 0.0008, 0.022) * 0.5
        click = band(rng.standard_normal(len(u)), 2200, 9000) * env(u, 0.0003, 0.004)
        case = (np.sin(2 * np.pi * 2350 * u) + 0.7 * np.sin(2 * np.pi * 3480 * u) + 0.4 * np.sin(2 * np.pi * 5100 * u)) * env(u, 0.0003, 0.012)
        h = thud / (np.max(np.abs(thud)) + 1e-9) * 0.7 + body + click / (np.max(np.abs(click)) + 1e-9) * 0.75 + case * 0.3
        x[i:i + len(h)] += h[: len(x) - i] * g
    hit(0.0, 1.0)
    hit(0.15, 0.5)
    hit(0.25, 0.26)
    slide = band(rng.standard_normal(len(t)), 1500, 6000) * np.clip((t - 0.27) / 0.02, 0, 1) * np.exp(-np.maximum(0, t - 0.27) / 0.07) * 0.1
    return reverb(x + slide, 0.3, 0.05, 8000)[: len(t)]


def typing(sec=4.0):
    """Typing on an iPhone keyboard: each key the system's short crisp "tock" (a damped ~2 kHz click, nearly the same
    every time), the space bar a touch lower, an uneven human rhythm with little pauses."""
    t = t_(sec)
    x = np.zeros(len(t))
    pos = 0.05
    u = t_(0.04)
    while pos < sec - 0.1:
        i = int(pos * SR)
        space = rng.random() < 0.15
        f0 = (1650 if space else 2050) * (1 + (rng.random() - 0.5) * 0.02)
        tock = np.sin(2 * np.pi * f0 * u) * np.exp(-u / 0.0028) + 0.3 * np.sin(2 * np.pi * 2.03 * f0 * u) * np.exp(-u / 0.0015)
        snap = band(rng.standard_normal(len(u)), 3000, 12000) * np.exp(-u / 0.0006) * 0.25
        h = (tock + snap) * (0.92 + 0.08 * rng.random())
        x[i:i + len(h)] += h[: len(x) - i]
        pos += 0.11 + 0.09 * rng.random() + (0.3 * rng.random() if rng.random() < 0.1 else 0)
    return x


def impact(sec=4.5):
    """A superhero landing: a short falling whoosh, then at 0.30 s a deep boom - sub drop, a punchy slam, a low rumble
    rolling outward - and a long dark tail spreading through the place."""
    t = t_(sec)
    at = 0.30
    x = np.zeros(len(t))
    w = t_(at)
    whoosh = band(rng.standard_normal(len(w)), 300, 4000) * (w / at) ** 3 * 0.35
    x[:len(w)] += whoosh
    u = t_(sec - at)
    sub = np.sin(2 * np.pi * np.cumsum(28 + 50 * np.exp(-u / 0.12)) / SR) * np.exp(-u / 0.7)
    slam = band(rng.standard_normal(len(u)), 50, 400) * env(u, 0.002, 0.11)
    crack = band(rng.standard_normal(len(u)), 400, 3000) * env(u, 0.0008, 0.025) * 0.6  # the hit itself, short
    # the shock spreading through the place: a smooth low rumble rolling out (no crackle - that read as TV static)
    rumble = band(rng.standard_normal(len(u)), 40, 320) * env(u, 0.04, 0.9) * (1 + 0.3 * np.sin(2 * np.pi * 3.1 * u))
    body = slam / (np.max(np.abs(slam)) + 1e-9) * 0.9 + sub * 1.1 + crack / (np.max(np.abs(crack)) + 1e-9) * 0.35 + \
        rumble / (np.max(np.abs(rumble)) + 1e-9) * 0.45
    i = int(at * SR)
    x[i:i + len(body)] += np.tanh(body * 1.4)[: len(x) - i]
    return reverb(x, 3.2, 0.38, 3500)[: len(t)]


def end_boom(sec=7.0):
    b = braam(sec)
    t = t_(sec)
    ring = np.sin(2 * np.pi * 7400 * t) * 0.05 * np.exp(-t / 3)  # the ears ring after it
    return b / (np.max(np.abs(b)) + 1e-9) + ring


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    only = sys.argv[2:]  # names to make (default: all)
    for name_, fn, pk in (("drone", drone, 0.7), ("braam", braam, 0.89), ("riser", riser, 0.8), ("stinger", stinger, 0.89),
                          ("heartbeat", heartbeat, 0.89), ("whine", whine, 0.5), ("pulse", pulse, 0.85), ("end_boom", end_boom, 0.89),
                          ("hum", hum, 0.5), ("phone_drop", phone_drop, 0.8),
                          ("typing", typing, 0.7), ("impact", impact, 0.95),
                          ("heartbeat_climax", heartbeat_climax, 0.95)):
        if only and name_ not in only:
            continue
        wav = os.path.join(out, name_ + ".wav")
        save(wav, fn(), pk)
        # kept as mp3 (in git, in the editor's library); the .wav is only the intermediate
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", wav[:-4] + ".mp3"], check=True)
        os.remove(wav)
