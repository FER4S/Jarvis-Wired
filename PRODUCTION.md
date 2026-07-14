# JARVIS Production Guide

Complete setup and deployment checklist for the JARVIS Command Center desktop app (Electron frontend + Python voice backend).

## Architecture

```
Electron App (frontend)
├── src/main/index.ts      → spawns backend, health-gates UI
├── src/renderer/          → React HUD UI
└── backend/               → Python FastAPI + voice pipeline
    ├── main.py            → entry point
    ├── api/server.py      → REST + WebSocket
    └── core/              → wake word, STT, LLM, TTS
```

**Pipeline:** Wake word → STT (faster-whisper) → Claude API → TTS (Kokoro-82M) → Speaker

**UI integration:** WebSocket `ws://127.0.0.1:8000/events` drives voice state, transcript, and event log.

---

## Prerequisites

### Operating system

| Platform | Notes |
|----------|-------|
| **Linux (Fedora/Ubuntu)** | Primary target for this repo. Install system audio libs below. |
| **Windows 11** | Upstream backend was developed on Windows with NVIDIA GPU. Use `requirements.txt` + CUDA PyTorch if you have an NVIDIA GPU. |

### Required software

- **Node.js 20+** and npm
- **Python 3.11+**
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)

### Linux system packages (Fedora example)

```bash
sudo dnf install portaudio-devel python3-devel gcc
```

Ubuntu/Debian equivalent:

```bash
sudo apt install portaudio19-dev python3-dev build-essential
```

---

## Backend Setup

### 1. Create virtual environment (Python 3.12 required)

Fedora ships Python 3.14, which is **not compatible** with Kokoro/openwakeword. Use `uv` to install Python 3.12 without sudo:

```bash
cd backend
bash setup.sh
```

Or manually:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env
uv python install 3.12
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
uv pip install fastapi==0.115.5 "uvicorn[standard]==0.32.1" faster-whisper==1.1.0 \
  anthropic==0.40.0 "kokoro>=0.9.4" sounddevice==0.5.1 python-dotenv==1.0.1 \
  tzdata==2025.2 anyio==4.7.0 loguru==0.7.2
uv pip install openwakeword==0.6.0 --no-deps
uv pip install onnxruntime scipy scikit-learn requests tqdm
python -c "from openwakeword.utils import download_models; download_models()"
```

**Note:** PyAudio is not required — mic capture uses `sounddevice` (system `libportaudio`).

### 2. Install PyTorch (CPU — no CUDA)

Already handled by `setup.sh` above.

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here

# CPU settings (Linux)
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8

# Optional tuning
WHISPER_MODEL_SIZE=base
TTS_VOICE=am_michael
SERVER_HOST=127.0.0.1
SERVER_PORT=8000
LOG_LEVEL=INFO
```

### 5. First run (downloads models)

On first launch, these download automatically:

- **faster-whisper** model (~150 MB for `base`)
- **Kokoro-82M** TTS (~300 MB)
- **openwakeword** wake word model

```bash
python main.py
```

Verify:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","service":"jarvis","assistant_running":true,"state":"idle"}
```

---

## Frontend Setup

### 1. Install dependencies

```bash
cd ..   # project root (jarvis front)
npm install
```

### 2. Configure (optional)

```bash
cp .env.example .env
```

Default backend URL is `http://127.0.0.1:8000`. Change only if you use a different port:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Development Workflow

### Option A — Electron spawns backend (default)

```bash
npm run dev
```

Electron main process starts `backend/main.py`, waits for `/health`, then opens the UI.

### Option B — Manual backend (debugging)

Terminal 1:

```bash
cd backend
source .venv/bin/activate
python main.py
```

Terminal 2:

```bash
npm run dev
```

### Verify integration

1. UI top bar shows **ONLINE** (green dot)
2. Backend Status panel shows **Running**
3. Say **"Hey Jarvis"** — voice events appear in the Voice Events panel
4. Conversation transcript updates with your speech and Jarvis replies
5. `Ctrl + Space` toggles assistant start/stop

---

## Production Build

### 1. Build frontend

```bash
npm run build
```

Output: `out/` (main, preload, renderer bundles)

### 2. Package desktop app

```bash
npm run dist
```

Output: `release/` (AppImage and `.deb` on Linux)

### 3. Backend bundling

For a self-contained install, ship the backend alongside the Electron app:

```
release/
├── JARVIS Command Center.AppImage
└── (or install .deb)

backend/                  # must be present relative to app
├── .venv/                # pre-built venv with all deps
├── main.py
├── .env                  # user config (NOT in git)
└── ...
```

Electron resolves backend at `app.getAppPath()/backend` in dev and `resources/backend` when packaged. Update `electron-builder` config to copy `backend/` into `extraResources` for full packaging:

```json
"extraResources": [
  { "from": "backend", "to": "backend", "filter": ["**/*", "!.venv/**"] }
]
```

For production, either bundle a pre-built `.venv` or document that users run `pip install` once after install.

---

## Production Checklist

- [ ] `backend/.env` created with valid `ANTHROPIC_API_KEY`
- [ ] `WHISPER_DEVICE=cpu` on Linux without NVIDIA GPU
- [ ] Backend venv created and dependencies installed
- [ ] First-run model downloads completed successfully
- [ ] `curl http://127.0.0.1:8000/health` returns `assistant_running: true`
- [ ] Microphone works (test wake word "Hey Jarvis")
- [ ] Speaker/audio output works (TTS playback)
- [ ] `npm run build` succeeds without errors
- [ ] `npm run dist` produces installable package
- [ ] Packaged app launches and spawns backend automatically
- [ ] UI shows Online status within 30 seconds of launch
- [ ] Wake word → transcript → response flow works end-to-end
- [ ] `LOG_FILE` set for persistent logs (optional): `LOG_FILE=logs/jarvis.log`
- [ ] Mic device configured if default fails: `MIC_DEVICE_INDEX=0` (try 0, 1, 2…)

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | **Required.** Claude API key |
| `CLAUDE_MODEL` | `claude-opus-4-5` | Claude model ID |
| `WAKE_WORD_MODEL` | `hey_jarvis` | openwakeword model name |
| `WAKE_WORD_THRESHOLD` | `0.5` | Detection sensitivity |
| `MIC_DEVICE_INDEX` | (system default) | PyAudio mic index |
| `WHISPER_MODEL_SIZE` | `base` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `WHISPER_DEVICE` | `cuda` | `cpu` or `cuda` |
| `WHISPER_COMPUTE_TYPE` | `float16` | `int8` for CPU |
| `TTS_VOICE` | `am_michael` | Kokoro voice ID |
| `SERVER_HOST` | `127.0.0.1` | Bind address |
| `SERVER_PORT` | `8000` | API port |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `LOG_FILE` | — | Optional log file path |

### Frontend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Backend REST/WS base URL |

---

## API Reference (Frontend Integration)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness + `assistant_running` + `state` |
| `/status` | GET | `{ running, state }` |
| `/start` | POST | Start assistant pipeline |
| `/stop` | POST | Stop assistant pipeline |
| `/events` | WebSocket | Real-time voice events |

WebSocket events: `wake_word_detected`, `listening_started`, `transcription`, `llm_response`, `speaking_started`, `speaking_ended`, `idle`.

See [`backend/API.md`](backend/API.md) for full details.

---

## Security

- Backend binds to **127.0.0.1** only — not exposed to the network by default
- No authentication on API endpoints — acceptable for local desktop use
- **Never commit** `backend/.env` — contains API keys
- API key is read server-side only; never bundled in the Electron frontend
- Do not expose port 8000 via firewall or reverse proxy without adding auth

---

## Troubleshooting

### Backend won't start

- Check Python path: `backend/.venv/bin/python --version`
- Port in use: `ss -tlnp | grep 8000` — kill conflicting process or change `SERVER_PORT`
- Missing deps: re-run `pip install -r requirements-cpu.txt`
- Check Electron console / terminal for `[backend]` log lines

### UI shows Offline

- Confirm backend is running: `curl http://127.0.0.1:8000/health`
- Check `VITE_API_BASE_URL` matches backend port
- WebSocket blocked: ensure no proxy interfering with `ws://127.0.0.1:8000/events`

### Wake word not detected

- Verify mic permissions (system settings)
- List devices: run backend with debug logging; try `MIC_DEVICE_INDEX=0`, `1`, etc.
- Ensure no other app holds the mic (browser, other voice apps)
- Frontend does **not** open the mic — backend owns PyAudio exclusively

### STT / TTS errors

- CPU too slow: use `WHISPER_MODEL_SIZE=tiny` or `base`
- CUDA errors on Linux: set `WHISPER_DEVICE=cpu` and `WHISPER_COMPUTE_TYPE=int8`
- Kokoro download failed: check disk space and internet; retry `python main.py`

### Claude API errors

- Verify `ANTHROPIC_API_KEY` in `backend/.env`
- Check API quota and billing at console.anthropic.com
- Model name: ensure `CLAUDE_MODEL` is a valid model ID

### WebSocket disconnects

- Client sends `ping` every 30s automatically
- Backend restart triggers auto-reconnect with exponential backoff
- Check `LOG_LEVEL=DEBUG` for connection errors

### Electron build fails

- Run `npm run build` first to see TypeScript errors
- Ensure Node 20+ and all `npm install` completed

---

## File Map

| Path | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main — spawns backend, window IPC |
| `src/preload/index.ts` | Exposes `window.jarvis.backend.url` |
| `src/App.tsx` | Root React layout + `BackendProvider` |
| `src/context/BackendContext.tsx` | WS state, transcript, connection |
| `src/services/backendClient.ts` | REST + WebSocket client |
| `src/pages/CommandCenter.tsx` | Main HUD layout |
| `backend/main.py` | Backend entry point |
| `backend/api/server.py` | FastAPI routes |
| `backend/core/assistant.py` | Voice pipeline orchestration |
| `backend/.env` | Secrets and config (create from `.env.example`) |
| `backend/requirements-cpu.txt` | CPU-only Python deps |
| `out/` | Built Electron bundles |
| `release/` | Packaged installers |

---

## Optional: Auto-start on Login (Linux)

Create `~/.config/autostart/jarvis.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=JARVIS Command Center
Exec=/path/to/JARVIS Command Center.AppImage
X-GNOME-Autostart-enabled=true
```

---

## Support

- Backend API docs: `http://127.0.0.1:8000/docs` (when running)
- Upstream backend repo: [github.com/FER4S/Jarvis](https://github.com/FER4S/Jarvis)
