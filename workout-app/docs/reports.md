# Bug & feature reports — how to read and close them

Shlomi files notes from inside the app (Settings → **דיווחי באגים ופיצ׳רים**) while
he is looking at the thing. They land in Firestore. This file is how a session
picks them up, works them, and closes them — no copy-paste out of WhatsApp.

**The instruction that triggers this is just:** *"read the bugs and features and
handle them"* (optionally scoped: *"only the dietary ones"*).

---

## Where they live

```
users/user_6724/reports/{reportId}
```

`user_6724` is the app uid that `shlomi@boostart.io` resolves to (see
`EMAIL_TO_UID` in `src/config/firebase.ts`). Firestore rules on `users/{uid}/**`
are open, so **no auth is needed** — plain REST works from a session.

Base URL:

```
https://firestore.googleapis.com/v1/projects/boostmind-b052c/databases/(default)/documents
```

---

## Reading them

> ### ⚠️ The list endpoint is PAGINATED. A plain `curl` silently truncates.
>
> `GET .../reports` returns a page of documents plus a `nextPageToken`. **It does
> not tell you that you are missing anything** — you just get fewer documents
> than exist and no error.
>
> This has already bitten once: a naive read returned **13 of 19** reports, and
> the 6 it dropped included **2 open bugs** that looked like an empty queue.
>
> Two rules:
> 1. **Always follow `nextPageToken`** until a page comes back with no documents.
> 2. **`nextPageToken` can be present on the final page too** — so stop on an
>    *empty page*, not merely on a missing token.

Read the whole collection, every page, decoded properly:

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import json, urllib.request, urllib.parse

BASE = "https://firestore.googleapis.com/v1/projects/boostmind-b052c/databases/(default)/documents"
url  = f"{BASE}/users/user_6724/reports"

def v(f):                       # unwrap Firestore's {"stringValue": ...} envelope
    return list(f.values())[0] if f else None

docs, token = [], None
while True:
    q = {"pageSize": "100"}
    if token:
        q["pageToken"] = token
    with urllib.request.urlopen(f"{url}?{urllib.parse.urlencode(q)}") as r:
        page = json.load(r)
    got = page.get("documents", [])
    docs += got
    token = page.get("nextPageToken")
    if not token or not got:    # empty page = genuinely done
        break

print("total:", len(docs))
for d in docs:
    f = d["fields"]
    if v(f.get("status")) != "open":   # only what is outstanding
        continue
    if v(f.get("place")) != "food":    # scope to your domain
        continue
    print(v(f.get("id")), "|", v(f.get("kind")), "|", v(f.get("text")))
PY
```

Sanity check: print the total and confirm it matches what the app shows in its
header (`N פתוחים · M סה״כ`). If your count is lower, you are truncating.

### ⚠️ Hebrew output: write to a file, don't print to the shell

On Windows the console mangles Hebrew into `????`/mojibake, which makes reports
look corrupted when they are perfectly fine in Firestore. This cost a wrong
diagnosis once — resolutions written by another session were reported as broken
when only the terminal was.

- Reading: set `PYTHONIOENCODING=utf-8`, or dump to a JSON file with
  `io.open(path, 'w', encoding='utf-8')` and read that file back with the Read
  tool.
- Writing: build the request body in a **UTF-8 file** and send it with
  `curl --data-binary @file.json`. Never inline Hebrew in a bash heredoc — it
  gets re-encoded on the way through.

### Fields

| Field | Values | Meaning |
|---|---|---|
| `id` | `rep_<ts>_<rand>` | Doc id, same as the document name |
| `kind` | `bug` · `feature` | |
| `place` | `exercise` · `food` · `general` | **Scope your work by this.** Two sessions on two places must not touch each other's items |
| `status` | `open` · `in-progress` · `done` · `wont-do` | |
| `text` | free text (Hebrew) | The report itself |
| `screenshotBase64` | `data:image/...;base64,...` | Often the clearest part — **look at it** (see below) |
| `resolution` | free text | What you did. Written by you, shown in the app |
| `createdAt` / `updatedAt` | epoch ms | |

### Screenshots

Many reports are "see screenshot". Decode and actually open it — the text alone
is usually not enough to locate the problem:

```bash
curl -s "$BASE/users/user_6724/reports/<id>" | python -c "
import sys, json, base64, re
f = json.load(sys.stdin)['fields']
m = re.match(r'data:image/(\w+);base64,(.*)', f['screenshotBase64']['stringValue'])
open('shot.png','wb').write(base64.b64decode(m.group(2)))
print('wrote shot.png')
"
```

Then read `shot.png` with the Read tool.

---

## Closing them

Write `status` and a `resolution` back. Use `updateMask` so you patch those two
fields and nothing else — **without a mask, Firestore REPLACES the whole
document** and you will wipe the report text and screenshot.

```bash
curl -s -X PATCH \
  "$BASE/users/user_6724/reports/<id>?updateMask.fieldPaths=status&updateMask.fieldPaths=resolution&updateMask.fieldPaths=updatedAt" \
  -H "Content-Type: application/json" \
  -d '{"fields":{
        "status":{"stringValue":"done"},
        "resolution":{"stringValue":"What you changed, in one line"},
        "updatedAt":{"integerValue":"1787261655853"}
      }}'
```

Statuses:

- `in-progress` — claim it before a long fix, so a parallel session skips it.
- `done` — shipped. Always leave a `resolution`; Shlomi reads it in the app.
- `wont-do` — with a `resolution` explaining why. Don't silently drop things.

---

## Working rules

1. **Stay in your `place`.** A dietary session handles `place: "food"` and leaves
   `exercise` alone, and vice versa. `general` goes to whoever is asked.
2. **Claim before you start** if the fix is more than a few minutes — set
   `in-progress` so the other session doesn't duplicate the work.
3. **One report, one fix, one resolution.** Don't batch several reports into a
   vague "fixed a bunch of things".
4. **Read the screenshot** whenever there is one.
5. **Report the count before starting.** Say how many you found, in which places,
   and which you intend to take — this is how Shlomi knows nothing was missed.
6. Reports are a to-do list, **not** a spec. If one is ambiguous or looks wrong,
   say so rather than guessing at scope.

---

## Deploying after a fix

```bash
cd workout-app
npx tsc -b                    # must pass
MSYS_NO_PATHCONV=1 npx vite build
cd .. && npx firebase deploy --only hosting --project boostmind-b052c
```

Server changes (`workout-app/server/`) also need:

```bash
cd workout-app/server
gcloud run deploy workout-ai --source . --region me-west1 --project boostmind-b052c \
  --allow-unauthenticated --set-secrets=ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest \
  --memory=512Mi --cpu=1 --max-instances=3 --timeout=300 --quiet
```

> On Git Bash, `MSYS_NO_PATHCONV=1` matters on any command with a `/`-leading
> argument — without it MSYS rewrites `/workout-app/` into a Windows path and the
> built asset URLs come out wrong.
