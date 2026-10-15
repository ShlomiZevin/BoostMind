"""Hebrew ASR with word timestamps (faster-whisper + ivrit-ai turbo), cached per clip."""
import os
import re

from .common import ROOT, load_json, log, save_json

_model = None
MODEL_DIR = os.path.join(ROOT, "models", "he-turbo")


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        log("  · loading Hebrew speech model (first run takes ~20s)")
        _model = WhisperModel(MODEL_DIR, device="cpu", compute_type="int8", cpu_threads=max(4, os.cpu_count() - 2))
    return _model


def vocab_prompt(items):
    """Bias the recogniser towards the script's names and English jargon — not the whole script,
    which would make it hallucinate script lines into silence."""
    words = set()
    for it in items:
        if it["type"] != "line":
            continue
        words.update(re.findall(r"[A-Za-z][A-Za-z\-]+", it["text"]))
    return ", ".join(sorted(words))


CACHE_VERSION = 2  # 2: per-utterance transcription (word times stay inside their own speech)


def _chunks(samples, sr=16000):
    """Speech regions from Silero VAD, merged into chunks of nearby speech (≤20s).
    Transcribing each chunk on its own keeps whisper from pinning the first word of a line
    to the end of the previous one across a long silence."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    regs = get_speech_timestamps(samples, VadOptions(min_silence_duration_ms=350, speech_pad_ms=120))
    out = []
    for r in regs:
        a, b = r["start"] / sr, r["end"] / sr
        if out and a - out[-1][1] < 0.6 and b - out[-1][0] < 20:
            out[-1][1] = b
        else:
            out.append([a, b])
    return out


def transcribe(ep, clip, prompt):
    out = ep.work("transcripts", clip["id"] + ".json")
    wav = ep.work("audio16", clip["id"] + ".wav")
    cached = load_json(out)
    if cached and cached.get("wav_mtime") == os.path.getmtime(wav) and cached.get("v") == CACHE_VERSION:
        return cached["words"]
    log(f"  · transcribing {clip['rel']}")
    from .media import read_wav
    samples, sr = read_wav(wav)  # 16 kHz mono; avoids faster-whisper's PyAV decoder
    model = _get_model()
    words = []
    for a, b in _chunks(samples, sr):
        pad_a, pad_b = max(0.0, a - 0.15), min(len(samples) / sr, b + 0.15)
        segs, _ = model.transcribe(
            samples[int(pad_a * sr): int(pad_b * sr)], language="he", word_timestamps=True, beam_size=5,
            vad_filter=False, condition_on_previous_text=False, initial_prompt=prompt or None)
        for s in segs:
            for w in s.words or []:
                t = w.word.strip()
                if t:
                    ws = min(max(pad_a + w.start, a), b)
                    we = min(max(pad_a + w.end, ws + 0.05), b + 0.1)
                    words.append({"w": t, "s": round(ws, 3), "e": round(we, 3), "p": round(w.probability, 3)})
    save_json(out, {"wav_mtime": os.path.getmtime(wav), "v": CACHE_VERSION, "words": words})
    return words


def voice_regions(ep, clip):
    """Where the voice actually is in a take (Silero VAD), cached. Cut points follow these, not the
    transcript: the recogniser skips words (English jargon, a quick "נכון"), the VAD does not."""
    out = ep.work("vad", clip["id"] + ".json")
    wav = ep.work("audio16", clip["id"] + ".wav")
    cached = load_json(out)
    if cached and cached.get("wav_mtime") == os.path.getmtime(wav):
        return cached["regions"]
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    from .media import read_wav
    samples, sr = read_wav(wav)
    regs = get_speech_timestamps(samples, VadOptions(min_silence_duration_ms=250, speech_pad_ms=60))
    regions = [[round(r["start"] / sr, 3), round(r["end"] / sr, 3)] for r in regs]
    save_json(out, {"wav_mtime": os.path.getmtime(wav), "regions": regions})
    return regions
