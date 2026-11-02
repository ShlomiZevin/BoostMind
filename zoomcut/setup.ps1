# Sketch Studio on a new computer - one step (the studio online: zoomcut/render/cloud/).
#   Right-click > "Run with PowerShell", or:  powershell -ExecutionPolicy Bypass -File setup.ps1
# What it does, each step only if needed: the tools (Git, Node, Python 3.12, ffmpeg, Google Cloud CLI - via winget),
# the code (cloned to C:\workspace\BoostMind), the editor's packages, Python's packages, the Google sign-in, the keys
# (from Secret Manager - no file to copy), the AI models, and the cloud sync switched on. Then the studio starts at
# http://localhost:4747 and the project menu lists every project in the cloud - opening one brings it here.
# Run it again any time: it skips what is there.
param(
  [string]$Root = "C:\workspace\BoostMind",
  [int]$Port = 4747,
  [switch]$NoInstall,   # never install a tool, only say what is missing
  [switch]$NoStart      # set up, don't start the studio
)
$ErrorActionPreference = 'Stop'
$Bucket = 'gs://shlomiverse-studio'
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Fresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + "$env:LOCALAPPDATA\Microsoft\WinGet\Links" }
function Need($cmd, $id, $what) {
  if (Has $cmd) { Write-Host "  ok   $what"; return }
  if ($NoInstall) { throw "$what is missing - install it, or run without -NoInstall" }
  Write-Host "  ...  installing $what"
  winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements
  Fresh-Path
  if (-not (Has $cmd)) { throw "$what was installed - close this window and run setup.ps1 again (Windows needs a new window to see it)" }
  Write-Host "  ok   $what"
}
function Run($exe) { & $exe @args; if ($LASTEXITCODE) { throw "failed: $exe $args" } }

Step '1/7  The tools'
Fresh-Path
Need git Git.Git 'Git'
Need node OpenJS.NodeJS.LTS 'Node.js'
function Has312 { (Has py) -and ((py -0 2>$null) -match '3\.12') }
if (Has312) { Write-Host '  ok   Python 3.12' }
elseif ($NoInstall) { throw 'Python 3.12 is missing - install it, or run without -NoInstall' }
else {
  Write-Host '  ...  installing Python 3.12'
  winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements
  Fresh-Path
  if (-not (Has312)) { throw 'Python 3.12 was installed - close this window and run setup.ps1 again' }
}
Need ffmpeg Gyan.FFmpeg 'ffmpeg'
Need gcloud Google.CloudSDK 'Google Cloud CLI'

Step '2/7  The code'
if (Test-Path "$Root\zoomcut\render\server.mjs") { Write-Host "  ok   $Root" }
else { Run git clone https://github.com/ShlomiZevin/BoostMind.git $Root }
$Z = "$Root\zoomcut"

Step '3/7  The editor''s packages'
Push-Location "$Z\render"
if (Test-Path node_modules\vite) { Write-Host '  ok   node_modules' } else { Run npm install --no-audit --no-fund }
Run npx remotion browser ensure  # (the browser the export draws with)
Pop-Location

Step '4/7  Python''s packages (zoomcut\.venv)'
$Py = "$Z\.venv\Scripts\python.exe"
if (-not (Test-Path $Py)) { Run py -3.12 -m venv "$Z\.venv" }
Run $Py -m pip install --disable-pip-version-check -q -r "$Z\requirements.txt"
Write-Host '  ok   Python packages'

Step '5/7  Google sign-in (the studio''s cloud)'
$acct = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null)
if (-not $acct) { Run gcloud auth login; $acct = (gcloud auth list --filter=status:ACTIVE --format="value(account)") }
Write-Host "  ok   $acct"
gcloud storage ls "$Bucket/" *> $null
if ($LASTEXITCODE) { throw "$acct can't open $Bucket - sign in with the account that owns boostmind-b052c (gcloud auth login)" }

Step '6/7  Keys, AI models, the cloud sync'
New-Item -ItemType Directory -Force "$Z\episodes\_cloud" | Out-Null
[IO.File]::WriteAllText("$Z\episodes\_cloud\config.json", '{ "sync": "on" }')  # (no BOM: the studio reads it as JSON)
Run node "$Z\render\cloud\keys.mjs" pull
Run gcloud storage rsync -r "$Bucket/studio/models" "$Z\models" --exclude=".*\.gitattributes$"  # (git keeps its own)
Write-Host '  ok   keys (zoomcut\.env, from Secret Manager), models, sync on'
Write-Host '  note: eye contact (NVIDIA Maxine) needs an NVIDIA graphics card and its SDK - the rest works on any computer.' -ForegroundColor DarkGray

if ($NoStart) { Write-Host "`nReady. Start it with:  node $Z\render\server.mjs" -ForegroundColor Green; exit 0 }
Step '7/7  Sketch Studio'
# another studio already running on this computer: this one gets no iPhone Drop poller (two would fight over the Drop's
# folders) and must take another port
if (Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction SilentlyContinue) {
  if ($Port -eq 4747) { throw 'A studio already runs on port 4747 here - stop it, or run setup.ps1 -Port 4748' }
  $env:ZC_NO_DROP = '1'
  Write-Host '  note: another studio runs on this computer - this one starts without the iPhone Drop' -ForegroundColor DarkGray
}
Write-Host "  http://localhost:$Port - open a project from the menu; one in the cloud comes here first." -ForegroundColor Green
Start-Process "http://localhost:$Port"
$env:PORT = "$Port"
Push-Location "$Z\render"
node server.mjs
