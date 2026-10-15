"""Find every script line inside the recorded takes.

Per character, all their 'lines' clips form one stream (clip order = file name order).
Each script line gets candidate windows scored by fuzzy text similarity; a monotonic
dynamic programme then picks one window per line so lines stay in script order, which
disambiguates short lines ("אנחנו.", "כן, אבל—") and prefers the later of two similar
takes (people re-say a line they fumbled). Lines the DP could not place fall back to
their best standalone window. Cut points are then refined on the audio envelope.
"""
import re

import numpy as np
from rapidfuzz import fuzz

from .media import envelope

MIN_SCORE = 0.58
GOOD_SCORE = 0.75
MAX_WORD_GAP = 1.8
FINALS = str.maketrans("ךםןףץ", "כמנפצ")


def norm(s):
    s = re.sub(r"[֑-ׇ]", "", s)
    s = s.replace("־", " ").replace("-", " ")
    s = re.sub(r"[׳״'\"`’]", "", s)
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s.translate(FINALS).lower()).strip()


def _candidates(line, stream):
    target = norm(line["match_text"])
    n = max(1, len(target.split()))
    lens = range(max(1, n - 1), n + 2) if line["interrupted"] else range(max(1, n - 2), n + 4)
    # brk[k] = number of long silences (or take changes) between word 0 and word k;
    # a window i..j is one utterance only if brk[j-1] == brk[i]
    brk = [0] * len(stream)
    for k in range(1, len(stream)):
        brk[k] = brk[k - 1] + (stream[k]["clip"] != stream[k - 1]["clip"] or stream[k]["s"] - stream[k - 1]["e"] > MAX_WORD_GAP)
    out = []
    for i in range(len(stream)):
        for L in lens:
            j = i + L
            if j > len(stream) or brk[j - 1] != brk[i]:
                break  # a line is one utterance: never join words across a long silence
            text = norm(" ".join(w["w"] for w in stream[i:j]))
            sc = fuzz.ratio(target, text) / 100
            if sc < MIN_SCORE - 0.1:
                continue
            prev = stream[i - 1] if i > 0 and stream[i - 1]["clip"] == stream[i]["clip"] else None
            nxt = stream[j] if j < len(stream) and stream[j]["clip"] == stream[i]["clip"] else None
            if prev is None or stream[i]["s"] - prev["e"] > 0.35:
                sc += 0.04
            if not line["interrupted"] and (nxt is None or nxt["s"] - stream[j - 1]["e"] > 0.35):
                sc += 0.04
            out.append({"i": i, "j": j, "score": sc, "raw": fuzz.ratio(target, text) / 100})
    out = [c for c in out if c["score"] >= MIN_SCORE]
    out.sort(key=lambda c: -c["score"])
    # Edge variants of one occurrence (±1 word) all stay in, so the DP can trim a window
    # that would otherwise swallow a neighbour's first word. Occurrences = overlap clusters.
    occ = []
    for c in out:
        home = next((o for o in occ if not (c["j"] <= o[0]["i"] or c["i"] >= o[0]["j"])), None)
        (home.append(c) if home else occ.append([c]))
    if occ:
        best = occ[0][0]["score"]
        near = [o for o in occ if o[0]["score"] >= best - 0.06]
        latest = max(near, key=lambda o: o[0]["i"])
        if len(near) > 1:
            for c in latest:
                c["score"] += 0.02  # a re-said line beats the fumbled one before it
    return sorted(out, key=lambda c: -c["score"])[:60]


def _monotonic(lines, cands):
    """Weighted longest chain: at most one window per line, windows strictly increasing."""
    states = [(-1, 0.0, {})]  # (end word index, total score, {line n: cand})
    for ln in lines:
        new = list(states)
        for c in cands[ln["n"]]:
            best = max((s for s in states if s[0] < c["i"]), key=lambda s: s[1], default=None)
            if best:
                new.append((c["j"] - 1, best[1] + c["score"], {**best[2], ln["n"]: c}))
        new.sort(key=lambda s: (s[0], -s[1]))
        pruned, top = [], -1.0
        for s in new:  # keep the Pareto front: smaller end ↔ higher score
            if s[1] > top + 1e-9:
                pruned.append(s)
                top = s[1]
        states = pruned
    return max(states, key=lambda s: s[1])[2]


def match_character(char_lines, stream):
    cands = {ln["n"]: _candidates(ln, stream) for ln in char_lines}
    chosen = _monotonic(char_lines, cands)
    used = [(c["i"], c["j"]) for c in chosen.values()]
    for ln in char_lines:
        if ln["n"] in chosen:
            continue
        for c in cands[ln["n"]]:
            if all(c["j"] <= a or c["i"] >= b for a, b in used):
                chosen[ln["n"]] = c
                used.append((c["i"], c["j"]))
                break
    _fill_by_position(char_lines, stream, chosen)
    return chosen, cands


def extend_to_utterance(chosen, stream, regions, no_tail=()):
    """A matched window covers the words that look like the script; the actor's utterance may run on
    past them in words the recogniser spelled differently (Multi-Agentic → מולטי איג'נטיק). Grow each
    window to the edges of its voice region, never into another line's window."""
    def reg(w):
        for a, b in regions.get(w["clip"], []):
            if a - 0.05 <= (w["s"] + w["e"]) / 2 <= b + 0.05:
                return (w["clip"], a)
        return None
    owner = {}
    for n, c in chosen.items():
        for k in range(c["i"], c["j"]):
            owner[k] = n
    for n, c in chosen.items():
        r = reg(stream[c["j"] - 1]) if n not in no_tail else None  # an interrupted line ends where it is cut
        while r and c["j"] < len(stream) and c["j"] not in owner and reg(stream[c["j"]]) == r:
            owner[c["j"]] = n
            c["j"] += 1
        r = reg(stream[c["i"]])
        while r and c["i"] > 0 and (c["i"] - 1) not in owner and reg(stream[c["i"] - 1]) == r:
            owner[c["i"] - 1] = n
            c["i"] -= 1


def _fill_by_position(char_lines, stream, chosen):
    """A line the recogniser mangled (English jargon, mumbling) but that sits between two
    matched neighbours in the same take: the unclaimed speech between them is that line.
    Accepted only with some text similarity, and always flagged for a check."""
    order = [ln["n"] for ln in char_lines]
    for k, ln in enumerate(char_lines):
        if ln["n"] in chosen:
            continue
        before = next((chosen[n] for n in reversed(order[:k]) if n in chosen), None)
        after = next((chosen[n] for n in order[k + 1:] if n in chosen), None)
        i = before["j"] if before else 0
        j = after["i"] if after else len(stream)
        if before and after and k + 1 < len(order) and order[k + 1] not in chosen:
            continue  # two lines in one gap: can't split them honestly
        if j <= i or stream[i]["clip"] != stream[j - 1]["clip"]:
            continue
        if not after and j - i > 3 * len(ln["match_text"].split()) + 4:
            continue  # open-ended tail with lots of extra speech: too ambiguous
        # the gap may hold several utterances (a stray word, a retake): take the one that reads most like the line
        best = None
        a = i
        for k in range(i + 1, j + 1):
            if k == j or stream[k]["s"] - stream[k - 1]["e"] > MAX_WORD_GAP:
                raw = fuzz.ratio(norm(ln["match_text"]), norm(" ".join(w["w"] for w in stream[a:k]))) / 100
                if best is None or raw > best[0]:
                    best = (raw, a, k)
                a = k
        if best and best[0] >= 0.35:
            chosen[ln["n"]] = {"i": best[1], "j": best[2], "score": best[0], "raw": best[0], "by_position": True}


class Env:
    def __init__(self, path):
        self.db, self.hop = envelope(path)
        lo, hi = np.percentile(self.db, 15), np.percentile(self.db, 97)
        self.thr = lo + max(6.0, (hi - lo) * 0.18)
        self.voice = lo + (hi - lo) * 0.45  # clearly a voice, not room noise or a breath

    def at(self, t):
        k = int(t / self.hop)
        return self.db[min(max(k, 0), len(self.db) - 1)]

    def onset_before(self, t, limit):
        x = t
        while x > limit and self.at(x - self.hop) > self.thr:
            x -= self.hop
        return x

    def first_sound(self, t, limit):
        """Whisper often starts a word a few hundred ms early (inside the silence before it).
        Walk forward to where the voice actually starts."""
        x = t
        while x < limit and self.at(x) <= self.thr:
            x += self.hop
        return x if x < limit else t

    def last_sound(self, t, limit):
        """Walk back from t over trailing silence to where the voice actually ends."""
        x = t
        while x > limit and self.at(x) <= self.thr:
            x -= self.hop
        return x if x > limit else t

    def sound_start(self, t, lo, max_back=1.5, gap=0.15):
        """Walk back from t over voice and short breaths until a real pause (>= gap) or lo.
        Catches the short loud bursts the voice detector misses ("רגע,", a quick "נכון")."""
        x, best, quiet = t, t, 0.0
        floor = max(lo, t - max_back)
        while x - self.hop > floor:
            x -= self.hop
            if self.at(x) > self.voice:
                best, quiet = x, 0.0
            else:
                quiet += self.hop
                if quiet >= gap:
                    break
        return best

    def offset_after(self, t, limit, hold=0.12):
        x = t
        quiet = 0.0
        while x < limit:
            quiet = quiet + self.hop if self.at(x) <= self.thr else 0.0
            if quiet >= hold:
                return x - hold
            x += self.hop
        return limit


def _region(regions, t):
    for a, b in regions or []:
        if a - 0.05 <= t <= b + 0.05:
            return a, b
    return None


def refine(win, stream, env, duration, interrupted, regions=None):
    """Cut points for one line. The voice regions decide where the utterance really starts and ends
    (so an untranscribed "נכון" at the start or "Multi-Agentic" at the end stays in); transcript
    neighbours make sure no word of another line leaks in."""
    w0, w1 = stream[win["i"]], stream[win["j"] - 1]
    prev = stream[win["i"] - 1] if win["i"] > 0 and stream[win["i"] - 1]["clip"] == w0["clip"] else None
    nxt = stream[win["j"]] if win["j"] < len(stream) and stream[win["j"]]["clip"] == w0["clip"] else None
    lo = prev["e"] + 0.04 if prev else 0.0
    hi = (nxt["s"] - 0.04) if nxt else duration

    r0 = _region(regions, w0["s"] + 0.03)
    if r0 and r0[0] >= lo and w0["s"] - r0[0] < 1.6:
        t_in = max(lo, min(r0[0], w0["s"]) - 0.08)  # just before the first sound, even if whisper missed the word
    else:
        sound = env.first_sound(max(lo, w0["s"] - 0.1), min(w0["e"], w0["s"] + 0.8))
        if sound <= w0["s"]:
            sound = env.onset_before(w0["s"], max(lo, w0["s"] - 0.15))
        t_in = max(lo, sound - 0.04)

    # never start mid-word: include any voice running straight into the start point
    t_in = max(lo, min(t_in, env.sound_start(t_in + 0.06, lo) - 0.05))

    cut = w1["e"]
    r1 = _region(regions, w1["e"] - 0.03)
    if r1 and r1[1] <= hi and r1[1] - w1["e"] < 2.5:
        end = r1[1]  # keep the tail the recogniser dropped ("...למה לא Multi-Agentic?")
    else:
        end = env.offset_after(w1["e"] - 0.05, min(hi, w1["e"] + 1.5), hold=0.2)
    if interrupted:
        t_out = min(duration, max(cut + 0.12, min(hi, end, cut + 0.9)))
    else:
        t_out = min(hi, max(end, w1["e"]) + 0.03)
        cut = t_out
    return round(t_in, 3), round(t_out, 3), round(cut, 3)
