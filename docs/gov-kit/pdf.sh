#!/usr/bin/env bash
# Prints every kit page to PDF with headless Chrome. Run after build.js.
# The hub PDF is the whole kit merged (needs python + pypdf); falls back to skipping it.
set -e
cd "$(dirname "$0")/../.."
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="$(pwd -W 2>/dev/null || pwd)/public/boostart/gov"
print() { # $1 = html path, $2 = pdf path
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
    --print-to-pdf="$2" "file:///$1" >/dev/null 2>&1
  echo "pdf: $2"
}
for row in methodology:Boostart-Agentic-SDD-Methodology.pdf cloud-migration:Boostart-Cloud-Migration-Approach.pdf \
           olim-laanan:Boostart-Olim-Laanan-Approach.pdf team:Boostart-Team-and-Experience.pdf fit:Shlomi-Zevin-Tender-Fit.pdf partner:Boostart-Framework-Partnership.pdf; do
  slug="${row%%:*}"; pdf="${row#*:}"
  print "$BASE/$slug/index.html" "$BASE/$slug/$pdf"
done
print "$BASE/index.html" "$BASE/_cover.pdf"
python - "$BASE" <<'EOF'
import sys, os
from pypdf import PdfWriter
b = sys.argv[1]
parts = ["_cover.pdf", "partner/Boostart-Framework-Partnership.pdf", "methodology/Boostart-Agentic-SDD-Methodology.pdf",
         "cloud-migration/Boostart-Cloud-Migration-Approach.pdf", "olim-laanan/Boostart-Olim-Laanan-Approach.pdf",
         "team/Boostart-Team-and-Experience.pdf"]
w = PdfWriter()
for p in parts: w.append(os.path.join(b, p))
w.write(os.path.join(b, "Boostart-Gov-Response-Kit.pdf"))
os.remove(os.path.join(b, "_cover.pdf"))
print("pdf: merged kit")
EOF
