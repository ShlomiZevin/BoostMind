"""The characters as the Shlomiverse's database has them (render/verse_db.mjs's twin for the pipeline, 2026-11-06 - the
database is their only copy; no character.json in git). Read through versePublish, kept in memory for this run only."""
import json
import os
import socket
import urllib.request

from .common import ROOT

API = "https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish"
_cache = {}


def _key():
    if os.environ.get("VERSE_PUBLISH_KEY"):
        return os.environ["VERSE_PUBLISH_KEY"]
    try:
        for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
            if line.startswith("VERSE_PUBLISH_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")
    except OSError:
        pass
    return ""


def _list(kind):
    if kind not in _cache:
        body = json.dumps({"op": "list", "kind": kind, "full": True, "by": f"{socket.gethostname()} Shlomiverse Studio pipeline"}).encode()
        req = urllib.request.Request(os.environ.get("VERSE_PUBLISH_URL") or API, data=body, method="POST",
                                     headers={"authorization": "Key " + _key(), "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            _cache[kind] = json.loads(r.read().decode("utf-8")).get("items") or []
    return _cache[kind]


def characters():
    """Every character record ({id, name, world, videos, ...}), in their order. [] when the database can't be reached."""
    try:
        return sorted(_list("character"), key=lambda c: (c.get("order") if c.get("order") is not None else 1e9, c.get("id", "")))
    except Exception as e:  # (offline: a video is built without its characters - he can add them in the project)
        print(f"  ! the characters weren't read from the Shlomiverse ({str(e)[:120]})")
        return []
