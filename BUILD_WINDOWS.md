# Jarvis Desktop — Run & Package (Windows)

This project is the **full** Jarvis (wake word → STT → Claude → TTS, **plus** persistent
memory and multi-account email) with the Command Center Electron UI on top. Target: a
one-click Windows app for the boss's machine (**RTX 5090**, no coding tools installed).

- `backend/` — your full Python voice backend (authoritative; copied from FER4S/Jarvis).
- `src/` — the Electron/React UI (from the front-end dev), wired to the backend.

The Electron main process spawns the backend, waits for `/health`, injects a per-launch
auth token, and points the backend's data at `%APPDATA%\Jarvis\data`.

---

## Part 1 — Run it in dev (verify the merge works)

On your Windows dev machine:

```powershell
# 1. Backend deps (GPU — see Part 3 for the RTX 5090 / Blackwell CUDA note)
cd C:\Users\majd_\Jarvis-Desktop\backend
python -m venv .venv
.venv\Scripts\activate
# Fastest on your dev machine: copy your existing .venv instead of reinstalling (see the
# Tip below). To install fresh, use cu128 — it's your original proven build
# (torch 2.7.1+cu128); it runs on your 3060 and is what the boss's RTX 5090 (Blackwell) needs.
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
copy .env.example .env      # set ANTHROPIC_API_KEY (+ Google OAuth vars if using Gmail)
# Leave JARVIS_API_TOKEN blank in .env — Electron injects one at runtime.

# 2. Frontend deps
cd ..
npm install

# 3. Run (Electron auto-spawns the backend)
npm run dev
```

> **Important:** create `backend\.venv` as above *before* `npm run dev`. If it's missing,
> Electron silently falls back to your **system** Python — which likely lacks the CUDA
> libraries, so Whisper/Kokoro run on **CPU** (exactly the `cublas64_12.dll not found → CPU`
> fallback you'd see in the logs).

> **Tip (fastest on your dev machine):** instead of the `pip install` steps, copy your
> existing venv — same bytes, no re-download:
> ```powershell
> robocopy "C:\Users\majd_\OneDrive\Desktop\Jarvis\.venv" "C:\Users\majd_\Jarvis-Desktop\backend\.venv" /E
> ```
> Works because it's the **same machine** (its `pyvenv.cfg` still points at your Python 3.10).
> It will **not** run on the boss's machine — that's what the self-contained `runtime`
> (Part 2) is for. You still need `backend\.env` with your `ANTHROPIC_API_KEY`.

Verify:
- UI top bar shows **Online**.
- `Ctrl+Space` starts/stops the pipeline — this proves the **auth-token wiring** (if it
  were broken you'd get 401s and stay Offline).
- Say **"Hey Jarvis"** → transcription appears and you hear a spoken reply.
- Say **"remember that ..."** and ask an **email** question → proves the full backend
  (memory + email) is live, not the stripped version.
- Data lands in `%APPDATA%\Jarvis\data`, not in the project folder.

> First run downloads the STT/TTS/wake models (~0.5–1 GB) and triggers spoken onboarding
> (fresh memory). That's expected.

---

## Part 2 — Build the one-click installer for the boss

Goal: one `.exe` the boss double-clicks. No Python, no Node, no terminal.

### 2.1  Bundle a self-contained Python (the part that needs care)

A normal `.venv` is **not portable** on Windows — it still depends on the base Python
install, which the boss won't have. So ship a **self-contained** Python runtime as
`backend\runtime\`. Electron is already wired to prefer `backend\runtime\python.exe`
(`src/main/index.ts` → `resolveBackendPaths()`), then fall back to `.venv`, then system.

Recommended route (uses `uv`, which installs relocatable standalone CPython):

```powershell
# install uv once: https://astral.sh/uv
uv python install 3.12
uv python find 3.12          # prints the standalone install path
# copy that whole folder to backend\runtime (it is self-contained):
xcopy /E /I "<path from above>" "C:\Users\majd_\Jarvis-Desktop\backend\runtime"

# install deps INTO that runtime (GPU build — see Part 3):
cd C:\Users\majd_\Jarvis-Desktop\backend
.\runtime\python.exe -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
.\runtime\python.exe -m pip install -r requirements.txt
```

Test it standalone before packaging: `.\runtime\python.exe main.py` → then
`curl http://127.0.0.1:8000/health` should return ok.

> **Alternative if the runtime route fights you:** PyInstaller (`onedir`) freezing
> `main.py` to an exe. Reliable but needs
> `--collect-all torch --collect-all kokoro --collect-all faster_whisper --collect-all openwakeword`
> plus the CUDA DLLs. If you go this way, point `resolveBackendPaths()` at the `.exe`.
> **This Python-bundling step is the single biggest effort in the whole project — budget
> iteration for it.**

### 2.2  Models — download on first run (default) or pre-bundle (optional)

Default: models download automatically on first launch (needs internet once, ~0.5–1 GB).
Simplest to ship; the boss just needs to be online the first time.

Optional (offline/instant first run): after downloading them in dev, set `HF_HOME` to a
folder inside `backend\` and copy the caches there so they ship in `extraResources`; have
Electron pass that `HF_HOME` in the spawn env (same place it sets `JARVIS_DATA_DIR`).

### 2.3  Create the clean shipping `.env`

Create `backend\.env` at build time (it's git-ignored, so it only exists on your machine):

```env
ANTHROPIC_API_KEY=sk-ant-...        # a key/budget you're OK shipping (anyone with the app has it)
GOOGLE_OAUTH_CLIENT_ID=...          # your Google app client — lets the boss connect HIS Gmail
GOOGLE_OAUTH_CLIENT_SECRET=...
# leave JARVIS_API_TOKEN blank — Electron injects it per launch
```

Do **not** copy your personal `.env`, and never include a `backend\data\` folder — the
boss must start with fresh memory and connect his own email accounts. (Both are already in
`.gitignore`, and `data/` is excluded from the packaged bundle.)

### 2.4  Build

```powershell
cd C:\Users\majd_\Jarvis-Desktop
npm install
npm run dist        # → NSIS one-click installer in release\
```

`package.json` is already configured: `win`/`nsis`, one-click **per-user** (no admin
prompt), bundling `backend\` (including `runtime\`, excluding `__pycache__`, `*.pyc`,
`data\`).

### 2.5  Send the boss

Send the single file from `release\` (e.g. `JARVIS Command Center Setup 1.0.0.exe`). He
double-clicks it; it installs per-user and launches. Done.

---

## Part 3 — RTX 5090 (Blackwell) GPU notes  ← check this FIRST, it's the main risk

The 5090 is Blackwell (sm_120). Older `cu121` PyTorch wheels **don't ship kernels for it**
and fail with *"no kernel image is available"*. Use a Blackwell-capable CUDA wheel:

```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

(Confirm the current Blackwell index at pytorch.org — `cu128` or newer.) faster-whisper
uses CTranslate2 with the `nvidia-cublas-cu12` / `nvidia-cudnn-cu12` wheels pinned in
`requirements.txt`; verify they load on the card. Your `stt.py`/`tts.py` **auto-fall back
to CPU** if CUDA fails, so a wheel mismatch degrades gracefully instead of crashing — but
you want GPU, so check the backend log says CUDA, not the CPU `int8` fallback.

---

## Part 4 — Verify before shipping

On a **clean** Windows machine (or a fresh user account with no Python):
- [ ] Installer runs with no admin prompt; app launches; UI reaches **Online** within ~30s.
- [ ] No `backend\data` was bundled; `%APPDATA%\Jarvis\data` is created fresh on first run.
- [ ] Onboarding runs (his memory, not yours); "Hey Jarvis" → transcript → spoken reply.
- [ ] He can connect his own email account from the dashboard; memory/email survive a restart.
- [ ] On the 5090, the backend log shows **CUDA/GPU** in use (not CPU int8 fallback).

Backend-only smoke checks still work with the runtime, e.g. from `backend\`:
`.\runtime\python.exe -m core.email_manager`.

---

## Part 5 — Troubleshooting

- **SmartScreen "unknown publisher"**: the installer is unsigned. Tell the boss *More info
  → Run anyway* once, or buy a code-signing certificate.
- **UI stuck Offline**: backend didn't start, or token mismatch. Check the Electron console
  for `[backend]` lines; confirm `backend\runtime\python.exe` exists in the install and
  that `main.py` runs standalone.
- **`env` not recognized**: already fixed — the `dev`/`preview` scripts no longer use the
  unix-only `env -u`. If you re-pull the dev's repo, re-apply that fix.
- **Mic not detected**: Windows mic privacy setting; only one app can hold the mic at a time.
- **GPU not used**: see Part 3 (Blackwell wheel).

---

## What changed vs. the two source repos

- Backend = your full FER4S/Jarvis (`@ef657bb`): memory + all four email modules restored
  (the dev's repo had stripped them out).
- Integration: Electron generates `JARVIS_API_TOKEN`, injects it into the backend and the
  renderer; `backendClient` sends `Bearer` on `/start`,`/stop` and `?token=` on `/events`.
- `JARVIS_DATA_DIR` → per-user writable data dir (packaged install dir is read-only).
- `resolveBackendPaths()` prefers a bundled `backend/runtime` Python.
- `package.json`: `win`/`nsis` + backend `extraResources`; removed the unix-only `env -u`
  from the dev scripts.
