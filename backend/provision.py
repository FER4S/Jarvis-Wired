"""
First-run provisioner for the packaged Jarvis app.

Run by the bundled standalone Python (``backend/runtime/python.exe``) the first
time the app launches on a new machine. It installs the GPU Python dependencies
from ``requirements-lock.txt`` and pre-downloads the STT / wake-word / TTS models,
emitting structured JSON progress on stdout for the Electron setup screen to
render.

Idempotent + resumable: pip skips already-installed packages and Hugging Face /
openWakeWord skip cached models, so re-running after a dropped connection simply
continues where it left off.

Progress protocol — one JSON object per line on **stdout**:
    {"type":"progress","pct":<0-100>,"phase":"deps|models","detail":"..."}
    {"type":"log","line":"..."}          # raw subprocess output, for a log tail
    {"type":"done"}
    {"type":"error","message":"..."}
Exit code 0 on success, 1 on failure.
"""

import json
import os
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_LOCK = os.path.join(_HERE, "requirements-lock.txt")
_RUNTIME = os.path.join(_HERE, "runtime")
_MARKER = os.path.join(_RUNTIME, ".provisioned")

# PyTorch cu128 wheels (torch + nvidia-*-cu12) live on the PyTorch index; every
# other package resolves from PyPI. Passing both lets a single `pip install -r`
# find them all.
_TORCH_INDEX = "https://download.pytorch.org/whl/cu128"
_PYPI = "https://pypi.org/simple"

# The dependency install is the long phase, so it owns most of the bar.
_DEPS_MAX = 75


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def progress(pct: float, phase: str, detail: str) -> None:
    emit({"type": "progress", "pct": max(0, min(100, int(pct))), "phase": phase, "detail": detail})


def log(line: str) -> None:
    line = line.rstrip()
    if line:
        emit({"type": "log", "line": line})


def _deps_present() -> bool:
    try:
        import torch  # noqa: F401
        import faster_whisper  # noqa: F401
        import kokoro  # noqa: F401
        import openwakeword  # noqa: F401
        return True
    except Exception:
        return False


def install_deps() -> None:
    if not os.path.isfile(_LOCK):
        raise RuntimeError(f"Dependency lock not found: {_LOCK}")

    progress(2, "deps", "Preparing to install Python packages (~4 GB download)…")

    with open(_LOCK, "r", encoding="utf-8") as fh:
        total = sum(1 for ln in fh if ln.strip() and not ln.startswith("#"))
    total = max(total, 1)

    cmd = [
        sys.executable, "-m", "pip", "install",
        "--no-input", "--disable-pip-version-check", "--no-warn-script-location",
        # The bundled runtime is a python-build-standalone install, which ships an
        # EXTERNALLY-MANAGED marker (PEP 668) so pip refuses to touch it. It's OUR
        # private runtime and installing into it is the whole point — override the guard.
        "--break-system-packages",
        "--index-url", _TORCH_INDEX,
        "--extra-index-url", _PYPI,
        "-r", _LOCK,
    ]
    proc = subprocess.Popen(
        cmd, cwd=_HERE,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
    )
    seen = 0
    assert proc.stdout is not None
    for line in proc.stdout:
        log(line)
        low = line.lower().lstrip()
        if (low.startswith("collecting ") or low.startswith("downloading ")
                or low.startswith("using cached ") or "installing collected packages" in low):
            seen += 1
            pct = min(_DEPS_MAX - 3, 3 + (seen / total) * (_DEPS_MAX - 6))
            progress(pct, "deps", "Installing Python packages…")
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"Package installation failed (pip exit code {code}). Check your internet connection and retry.")
    progress(_DEPS_MAX, "deps", "Python packages installed.")


def download_models() -> None:
    # Backend package must be importable for config (WHISPER_MODEL_SIZE, TTS_VOICE).
    if _HERE not in sys.path:
        sys.path.insert(0, _HERE)
    import config

    progress(80, "models", "Downloading speech-to-text model…")
    from faster_whisper import WhisperModel
    WhisperModel(config.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")

    progress(88, "models", "Downloading wake-word model…")
    from openwakeword.utils import download_models as oww_download
    oww_download()

    progress(94, "models", "Downloading text-to-speech model…")
    from kokoro import KPipeline
    pipe = KPipeline(lang_code="a", device="cpu")
    # Pull the specific voice too, so the first spoken reply is instant. Best-effort.
    try:
        list(pipe("Setup complete.", voice=config.TTS_VOICE))
    except Exception as exc:  # noqa: BLE001
        log(f"(voice prefetch skipped: {exc})")

    progress(99, "models", "Finalising…")


def main() -> int:
    try:
        if _deps_present():
            progress(_DEPS_MAX, "deps", "Python packages already installed.")
        else:
            install_deps()

        download_models()

        os.makedirs(_RUNTIME, exist_ok=True)
        with open(_MARKER, "w", encoding="utf-8") as fh:
            fh.write("ok\n")

        progress(100, "models", "Setup complete.")
        emit({"type": "done"})
        return 0
    except Exception as exc:  # noqa: BLE001
        emit({"type": "error", "message": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
