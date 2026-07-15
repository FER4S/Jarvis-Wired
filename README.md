# JARVIS Command Center

A fully-local, GPU-accelerated voice assistant — **wake word → speech-to-text → Claude →
text-to-speech**, with persistent memory and multi-account email — wrapped in an Electron
desktop UI and shipped as a **one-click Windows installer**.

- **Backend** (`backend/`) — Python voice pipeline + memory + email; FastAPI on `127.0.0.1:8000`.
  Merged from [github.com/FER4S/Jarvis](https://github.com/FER4S/Jarvis).
- **Frontend** (`src/`) — Electron + React + Three.js "Command Center" UI.

Everything runs on-device except the Claude API call.

## Run in development

```bash
npm install
npm run dev        # Electron spawns the Python backend and opens the UI
```

The backend needs its Python runtime/deps — see **CLAUDE.md** / **BUILD_WINDOWS.md** for setup.
Say **"Hey Jarvis"** (or `Ctrl+Space`) to talk to it.

## Build the Windows installer

```bash
npm run dist       # → release/JARVIS Command Center Setup <ver>.exe  (~119 MB)
```

Ship **only** that `.exe` (it's too big for email — use Drive/WeTransfer). On the target
machine's first launch it downloads the GPU deps + models (~4–5 GB, one time) behind a setup
screen, then runs offline every time after. Full procedure + gotchas: **BUILD_WINDOWS.md**.

## How it's packaged (short version)

The installer is small because it ships a **bare** Python runtime; on first run,
`backend/provision.py` installs the pinned deps (`backend/requirements-lock.txt`) and downloads
the models, showing a progress screen (`src/components/setup/SetupScreen.tsx`), then boots the
app. See **CLAUDE.md** for the architecture and integration details.

## Docs

- **[CLAUDE.md](CLAUDE.md)** — architecture, backend↔UI wiring, packaging, and how to continue.
  **Start here.**
- **[BUILD_WINDOWS.md](BUILD_WINDOWS.md)** — step-by-step installer build + first-run provisioning.
- **[backend/CLAUDE.md](backend/CLAUDE.md)**, **[backend/API.md](backend/API.md)** — backend
  internals (voice loop, memory, email, REST/WS API).
