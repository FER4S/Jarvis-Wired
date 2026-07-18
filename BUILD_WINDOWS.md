# BUILD_WINDOWS.md — Build & ship the Jarvis Desktop installer

How this app is packaged for a non-technical Windows user (the "boss": RTX 5090, no dev tools).
**This reflects the actual shipping design — a slim installer + first-run provisioning.** (An
earlier draft described bundling everything into the installer; that was abandoned because it
produced an ~5 GB download and broke the NSIS build — see "Why slim".)

Read [CLAUDE.md](CLAUDE.md) first for the architecture and backend↔UI wiring.

## The packaging model (read this first)

- The installer is **small (~119 MB)** because it ships a **bare Python runtime** — standalone
  Python 3.10 + pip only, **no** torch/CUDA/models.
- On the target machine's **first launch**, the app shows a **setup screen** and runs
  `backend/provision.py`, which pip-installs the pinned GPU deps (`backend/requirements-lock.txt`)
  and downloads the STT/wake/TTS models — **~4–5 GB, ~15–40 min, once, needs internet**. Then it
  boots; every later launch is instant and offline.
- Key files: `backend/provision.py` (the installer script), `backend/requirements-lock.txt`
  (149 pinned deps), `src/main/index.ts` (spawns provisioner, streams progress, gates the
  backend), `src/preload/index.ts` (`window.jarvis.setup`), `src/components/setup/SetupScreen.tsx`,
  `src/App.tsx` (renders SetupScreen until provisioned), `package.json` `build` block.

### Why slim — do NOT revert to bundling everything
Bundling the GPU deps makes `backend/runtime` ~8 GB → a ~5 GB installer, impractical to send.
Worse: unless `package.json` `files` is scoped, electron-builder also packs the whole project
(incl. an 8 GB `backend/.venv`) into `app.asar`, giving an 8 GB `.7z` that 32-bit `makensis`
**cannot mmap — the build fails outright** (`File: failed creating mmap`). Slim + first-run
download sidesteps all of it.

---

## Part 1 — Dev run (`npm run dev`)

```powershell
cd C:\Users\majd_\Jarvis-Desktop
npm install
npm run dev        # Electron spawns the backend and opens the UI
```

For the backend to work in dev, `backend/runtime` must be a **full** runtime (deps installed) —
see "Runtime states". Then verify: UI reaches **Online**; `Ctrl+Space` toggles the pipeline
(proves the auth token); "Hey Jarvis" → transcript + spoken reply; "remember that…" + an email
question prove memory + email are live. Data lands in `%APPDATA%\Jarvis\data` (NOT `backend/data/`).

### Runtime states — the ONE thing to understand
`backend/runtime/`'s state drives everything:

| State | Contents | Behavior |
|---|---|---|
| **Slim** (what SHIPS) | standalone python + pip only (~58 MB), **no** `.provisioned` marker | App shows the **setup screen** and provisions on launch |
| **Full** (for dev)   | slim + all deps + `.provisioned` marker | App skips setup; backend runs immediately |

- **Make it full (for dev):** with a slim runtime present, just run the provisioner once —
  `cd backend; runtime\python.exe provision.py` — it pip-installs the deps, downloads models, and
  writes the marker (exactly what the boss's first run does). ~4–5 GB first time; cached after.
- **Make it slim (before building):** Part 2.1.
- `resolveBackendPaths()` prefers `backend/runtime`, then `backend/.venv`, then system python — so
  a slim runtime *always* triggers setup. Delete `backend/runtime` to fall back to a dev `.venv`.

---

## Part 2 — Build the installer

### 2.1  Make the runtime SLIM (recreate a bare standalone Python via `uv`)
```powershell
# once: install uv → irm https://astral.sh/uv/install.ps1 | iex   (lands at %USERPROFILE%\.local\bin\uv.exe)
uv python install 3.10
# The standalone lands here. (`uv python find` can be unreliable if the install prints a harmless
# "Missing expected target directory … minor version link" warning — the Python still extracts fine.)
$std = (Get-ChildItem "$env:APPDATA\uv\python" -Directory -Filter 'cpython-3.10.*-windows-x86_64-none' | Select-Object -First 1).FullName
Remove-Item C:\Users\majd_\Jarvis-Desktop\backend\runtime -Recurse -Force -ErrorAction SilentlyContinue
robocopy $std C:\Users\majd_\Jarvis-Desktop\backend\runtime /E
# verify: backend\runtime\python.exe --version  →  Python 3.10.x ; site-packages holds only pip/setuptools
```

### 2.2  The dependency lock (`backend/requirements-lock.txt`, committed)
Pins the **exact** 149 packages provisioning installs — captured from a known-good full runtime so
first-run reproduces a verified environment. It pins **`torch==2.7.1+cu128`** (from the cu128
index) and pulls `en_core_web_sm` from a GitHub URL. **Only regenerate if deps change:** from a
*full* runtime run `runtime\python.exe -m pip freeze > backend\requirements-lock.txt`, then
**rewrite the torch line** — `pip freeze` emits a local `torch @ file:///…Desktop\Jarvis\torch-…whl`
path that won't exist elsewhere; replace it with `torch==2.7.1+cu128`.

### 2.3  The clean shipping `backend/.env` (git-ignored — create on your machine)
```env
ANTHROPIC_API_KEY=sk-ant-...        # a key/budget you're OK shipping — anyone with the app has it
GOOGLE_OAUTH_CLIENT_ID=...          # your Google app client — lets the user connect THEIR Gmail
GOOGLE_OAUTH_CLIENT_SECRET=...
JARVIS_API_TOKEN=                   # leave blank — Electron injects one per launch
```
Never ship `backend/data/` (personal memory + accounts); it's excluded from the bundle and ignored.

### 2.4  `package.json` `build` (already set — do NOT break)
```jsonc
"files": ["out/**", "package.json"],              // CRITICAL — keeps backend/ (incl. .venv) OUT of app.asar
"extraResources": [{ "from": "backend", "to": "backend",
  "filter": ["**/*", "!**/__pycache__/**", "!**/*.pyc", "!data/**", "!.venv/**"] }],
"win":  { "target": ["nsis"] },
"nsis": { "oneClick": true, "perMachine": false, "runAfterFinish": true }
```

### 2.5  Build + distribute
```powershell
cd C:\Users\majd_\Jarvis-Desktop
npm run dist        # → release\JARVIS Command Center Setup <ver>.exe  (~119 MB)
```
Send **only that `.exe`** (ignore `win-unpacked/`, `latest.yml`, `.blockmap`, `builder-debug.yml`).
It's too big for email — use **Google Drive / WeTransfer / Dropbox**.

---

## Part 3 — What the target machine does on first launch
1. Double-click the `.exe`. SmartScreen may warn "unknown publisher" (unsigned) → **More info →
   Run anyway** (once). Installs per-user, no admin.
2. First launch → **"Setting up JARVIS"** screen: pip-installs GPU deps + downloads models, ~4–5 GB
   over ~15–40 min (needs internet), with a progress bar + live log. `provision.py` is
   **idempotent/resumable** (pip + HF caches persist) and shows a **Retry** button on error.
3. On finish it boots into the Command Center; onboarding runs (his own fresh memory), he connects
   his own email. Every later launch is instant + offline.

---

## Part 4 — Where it installs / how to open + debug
- **Install dir:** `%LOCALAPPDATA%\Programs\jarvis-command-center\` (exe `JARVIS Command Center.exe`;
  bundled backend at `resources\backend\`, provisioner at `resources\backend\provision.py`).
- **Open via Start Menu → "JARVIS Command Center".** Do **NOT** re-run `Setup.exe` to open it —
  that reinstalls and re-triggers setup (wipes the runtime deps + `.provisioned` marker;
  re-provisioning is fast from cache, but it's not how you launch).
- **Quick fix without rebuilding:** edit the *installed* `resources\backend\provision.py` directly
  and hit **Retry** on the setup screen (that's how the `--break-system-packages` fix was validated
  live before rebuilding).
- **Reset a machine's memory/accounts:** delete `%APPDATA%\Jarvis\data`.
- **Caches (survive reinstalls):** pip wheels in `%LOCALAPPDATA%\pip\Cache`; models in the Hugging
  Face cache under `%USERPROFILE%`. This is why re-provisioning after a reinstall is fast.

---

## Part 5 — Critical gotchas (we hit ALL of these — don't re-break)
1. **`--break-system-packages`** is REQUIRED in `provision.py`'s pip call — the standalone Python is
   PEP-668 "externally managed" and pip refuses to install into it otherwise (error:
   `externally-managed-environment`).
2. **`files: ["out/**","package.json"]`** — without it, electron-builder packs the whole project
   (incl. `backend/.venv`, 8 GB) into `app.asar` → 8 GB `.7z` → 32-bit makensis "failed creating
   mmap" → build fails.
3. **Slim the runtime before `npm run dist`** — a full runtime bloats the installer and can OOM
   makensis.
4. **Torch pin** — the lock must be `torch==2.7.1+cu128` (from `--index-url .../whl/cu128`), not the
   `file://` path `pip freeze` emits.
5. `provision.py` writes `backend/runtime/.provisioned` on success; delete it (or the deps) to force
   re-setup.

---

## Part 6 — GPU / Blackwell (RTX 5090)
The lock uses **torch cu128** (Blackwell-capable). Older cu121 wheels fail on the 5090 with "no
kernel image is available". faster-whisper uses CTranslate2 with pinned `nvidia-cublas-cu12` /
`nvidia-cudnn-cu12`; `core/stt.py` adds `runtime\Lib\site-packages\nvidia\*\bin` to the DLL path
(the "CUDA shim"). `stt.py`/`tts.py` auto-fall back to CPU if CUDA fails, so **verify the backend
log shows CUDA/GPU, not the CPU int8 fallback**. (Validated on a 3060; the 5090 is the same path.)

## Part 7 — Troubleshooting
- **Setup: "Package installation failed / check your internet"** → a real network blip (Retry — it
  resumes) OR `--break-system-packages` is missing from `provision.py`.
- **UI stuck Offline after setup** → backend didn't boot; confirm `backend\runtime\python.exe`
  exists and `runtime\python.exe main.py` runs from `resources\backend` (imports torch, etc.).
- **SmartScreen** → unsigned installer; "Run anyway", or code-sign it.
- **Mic not detected** → Windows mic privacy; only one app can hold the mic at a time.

## Part 8 — Next steps (NOT done yet)
- **Auto-update** (electron-updater + a release feed) so updates ship as small code diffs, not a
  5 GB re-download. For that to be clean, install the provisioned deps into a **persistent** dir
  (e.g. `%APPDATA%\Jarvis\pydeps`, added to the runtime's path) so an app update doesn't wipe them.
  The `latest.yml` + `.blockmap` files in `release/` are the electron-updater metadata.
- **Code-sign** the installer to remove the SmartScreen warning.
