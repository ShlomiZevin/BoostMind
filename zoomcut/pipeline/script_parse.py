"""Parse the dialogue script into ordered items.

Accepted line forms (markdown bold optional):
    **אמיר:** text          dialogue
    אמיר: text              dialogue
    [שתיקה 0.8] / [pause 0.8]                 extra silence before the next line
    [חפיפה 0.3] / [overlap 0.3]               next line starts this much before the previous ends
    [דניאל מנסה לדבר 2.0] / [attempt daniel 2.0]  silent reaction beat on a character
    [הסר: דניאל] / [remove: daniel]           host removes the participant (Zoom event)
A dialogue line ending with "—", "–", "-" or "..." is treated as interrupted.
Text in (parentheses) is a stage direction: shown nowhere, ignored by the matcher.
"""
import re

DASHES = ("—", "–", "-", "...", "…")


def _char_lookup(characters):
    table = {}
    for c in characters:
        for a in [c["id"], c["name"], *c.get("aliases", [])]:
            table[a.strip().lower()] = c["id"]
    return table


def parse_script(text, characters):
    who = _char_lookup(characters)
    items = []
    n = 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.fullmatch(r"\[(.+)\]", line)
        if m:
            items.append(_directive(m.group(1).strip(), who))
            continue
        m = re.match(r"^\**\s*([^:*]{1,30}?)\s*:\s*\**\s*(.+)$", line)
        if not m or m.group(1).strip().lower() not in who:
            continue
        speaker = who[m.group(1).strip().lower()]
        body = m.group(2).strip().strip("*").strip()
        spoken = re.sub(r"\([^)]*\)", "", body).strip()
        interrupted = spoken.endswith(DASHES)
        n += 1
        items.append({
            "type": "line",
            "n": n,
            "speaker": speaker,
            "text": spoken,
            "match_text": spoken.rstrip("—–-.… ").strip(),
            "interrupted": interrupted,
        })
    return items


def _directive(body, who):
    num = re.search(r"(\d+(?:\.\d+)?)", body)
    val = float(num.group(1)) if num else None
    low = body.lower()
    if low.startswith(("שתיקה", "pause", "הפסקה")):
        return {"type": "pause", "seconds": val or 0.8}
    if low.startswith(("חפיפה", "overlap")):
        return {"type": "overlap", "seconds": val or 0.3}
    if low.startswith(("הסר", "remove", "kick")):
        name = re.split(r"[:\s]+", body, maxsplit=1)[-1].strip()
        return {"type": "remove", "char": who.get(name.lower(), name)}
    for name, cid in who.items():
        if name in low and ("מנסה" in low or "attempt" in low or "react" in low or "תגובה" in low):
            return {"type": "reaction", "char": cid, "seconds": val or 1.8}
    return {"type": "unknown", "raw": body}
