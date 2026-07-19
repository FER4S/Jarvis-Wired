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

### Where the deps live — the ONE thing to understand (CHANGED in 1.1)

The bundled `backend/runtime/` is now **only a bootstrap interpreter**. The actual dependencies live
in a venv at **`%LOCALAPPDATA%\Jarvis\pydeps`**, outside the install folder.

Why: a one-click update runs the old uninstaller first, which does `RMDir /r $INSTDIR` — everything
under the install dir is destroyed on **every** update. With ~8.4 GB of packages in there, each
update cost a ~4 GB re-download (the pip *wheel* cache is empty in practice; only the ~3.5 GB HF
model cache survives by itself). Outside it, an update touches them at all.

| Thing | Where | Survives an update? |
|---|---|---|
| Bootstrap runtime (ships, ~58 MB) | `resources\backend\runtime\` | replaced with the new one |
| Installed dependencies (~8.4 GB) | `%LOCALAPPDATA%\Jarvis\pydeps\` | **yes** |
| Provisioning stamp | `%LOCALAPPDATA%\Jarvis\pydeps\.provisioned` | **yes** |
| Memory + email accounts | `%APPDATA%\Jarvis\data\` | **yes** |

- **The stamp, not a marker.** It's JSON: `{schema, app_version, lock_sha256, python, created_at}`.
  `needsProvision()` (Electron) and `deps_current()` (provision.py) both compare `lock_sha256`
  against the shipped `requirements-lock.txt`. Unchanged lock → no setup screen at all. Changed lock
  → reinstall. This is what makes an update near-instant.
- **Provision for dev:** `cd backend; runtime\python.exe provision.py` — builds the venv, installs
  deps, downloads models, writes the stamp (exactly what the boss's first run does).
- `resolveBackendPaths()` prefers `pydeps\Scripts\python.exe`, then `backend/runtime`, then
  `backend/.venv`, then system python. The backend *source* always comes from the install folder —
  only the interpreter moves.
- **Force a re-provision:** delete `%LOCALAPPDATA%\Jarvis\pydeps`.

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
- **Open via Start Menu → "JARVIS Command Center".** Re-running `Setup.exe` is now *safe* (since 1.1
  the deps live outside `$INSTDIR`, so a reinstall keeps them and the stamp still matches → no setup
  screen) — but it's still not how you launch the app.
- **Quick fix without rebuilding:** edit the *installed* `resources\backend\provision.py` directly
  and hit **Retry** on the setup screen (that's how the `--break-system-packages` fix was validated
  live before rebuilding).
- **Reset a machine's memory/accounts:** delete `%APPDATA%\Jarvis\data`.
- **Caches (survive reinstalls):** models in the Hugging Face cache under `%USERPROFILE%` (~3.5 GB —
  this is real and is why model downloads are skipped). The pip *wheel* cache at
  `%LOCALAPPDATA%\pip\Cache` is mostly index metadata in practice (`wheels/` was 0 bytes when
  measured), so don't count on it to make a re-provision cheap — the persistent `pydeps` venv is
  what actually does that now.

---

## Part 5 — Critical gotchas (we hit ALL of these — don't re-break)
1. **`--break-system-packages`** is kept in `provision.py`'s pip call. Since 1.1 the install target is
   a venv, which has no PEP-668 marker, so it's no longer strictly required — it stays so the same
   command still works if we ever install into the bundled runtime directly again (which *is*
   "externally managed" and would otherwise refuse with `externally-managed-environment`).
2. **`files: ["out/**","package.json"]`** — without it, electron-builder packs the whole project
   (incl. `backend/.venv`, 8 GB) into `app.asar` → 8 GB `.7z` → 32-bit makensis "failed creating
   mmap" → build fails.
3. **Slim the runtime before `npm run dist`** — a full runtime bloats the installer and can OOM
   makensis.
4. **Torch pin** — the lock must be `torch==2.7.1+cu128` (from `--index-url .../whl/cu128`), not the
   `file://` path `pip freeze` emits.
5. `provision.py` writes the stamp to `%LOCALAPPDATA%\Jarvis\pydeps\.provisioned` on success; delete
   that folder to force re-setup. (It is no longer inside `backend/runtime`.)
6. **`build/installer.nsh` uses `customInit`, NOT `preInit`.** `preInit` runs before `initMultiUser`
   resolves `$INSTDIR` from `HKCU\Software\<APP_GUID>\InstallLocation`, so the migration would look
   in the wrong place. `customInit` runs right after it and still well before the old uninstaller.
   electron-builder picks the file up automatically (`nsis.include` defaults to that path) — no
   `package.json` change needed.
7. **The migration is a same-volume `Rename`, never a copy.** `%LOCALAPPDATA%` and `$INSTDIR` are both
   on C:, so it's an instant `MoveFile` regardless of 8.4 GB. Never add a copy fallback: it would
   take many minutes inside `.onInit` with no progress UI and look exactly like a hang.
8. **Bump `requirements-lock.txt` whenever you bump the bundled Python.** The stamp records the
   Python version and `provision.py` rebuilds on a minor change, but Electron's `needsProvision()`
   only compares the lock hash — and `cp310` wheels won't load on 3.11. They travel together anyway
   (a Python bump changes every wheel's ABI tag, so the resolved lock changes).
9. **Known non-issue:** `import pip` followed by `import setuptools` raises inside `_distutils_hack`.
   It does that in a *pristine* venv built from the bundled runtime too — pre-existing, unrelated to
   the deps relocation, and nothing in the app imports that pair. Don't go chasing it.

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
