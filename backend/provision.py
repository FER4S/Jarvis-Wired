"""
First-run provisioner for the packaged Jarvis app.

Run by the bundled standalone Python (``backend/runtime/python.exe``) when the
app needs its Python dependencies. It builds a virtualenv, installs the GPU
dependencies from ``requirements-lock.txt``, and pre-downloads the STT /
wake-word / TTS models, emitting structured JSON progress on stdout for the
Electron setup screen to render.

WHERE THE DEPENDENCIES LIVE (and why it matters)
------------------------------------------------
They go in a venv at ``%LOCALAPPDATA%\\Jarvis\\pydeps`` — deliberately OUTSIDE
the app install folder. The NSIS installer runs the old uninstaller before
extracting a new version, and that does ``RMDir /r $INSTDIR``: anything under
the install folder is destroyed on every single update. Keeping ~8.4 GB of
packages there meant re-downloading ~4 GB each time. Outside it, an update
touches nothing and provisioning is a no-op.

``%LOCALAPPDATA%`` rather than ``%APPDATA%``: the latter roams, and an 8.4 GB
roaming profile is a bad outcome on a managed machine. (User data — memory and
email accounts — stays in ``%APPDATA%\\Jarvis\\data``, which is small.)

The installer's ``customInit`` hook moves an existing install's site-packages to
``pydeps-staged`` before the wipe; ``_ensure_venv()`` adopts it, so upgrading an
already-provisioned machine costs two instant renames instead of a 4 GB download.

Idempotent + resumable: the stamp records the lock file's hash, so an unchanged
lock is a fast no-op and a changed one forces a reinstall. pip skips
already-installed packages and Hugging Face / openWakeWord skip cached models,
so re-running after a dropped connection continues where it left off.

Progress protocol — one JSON object per line on **stdout**:
    {"type":"progress","pct":<0-100>,"phase":"deps|models","detail":"..."}
    {"type":"log","line":"..."}          # raw subprocess output, for a log tail
    {"type":"done"}
    {"type":"error","message":"..."}
Exit code 0 on success, 1 on failure.
"""

import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
_LOCK = os.path.join(_HERE, "requirements-lock.txt")
_RUNTIME = os.path.join(_HERE, "runtime")

# Schema version for the stamp file, so a future format change is detectable.
_STAMP_SCHEMA = 1

# PyTorch cu128 wheels (torch + nvidia-*-cu12) live on the PyTorch index; every
# other package resolves from PyPI. Passing both lets a single `pip install -r`
# find them all.
_TORCH_INDEX = "https://download.pytorch.org/whl/cu128"
_PYPI = "https://pypi.org/simple"

# The dependency install is the long phase, so it owns most of the bar.
_DEPS_MAX = 75


# ── Paths ─────────────────────────────────────────────────────────────────────

def pydeps_root() -> str:
    """The persistent venv holding the dependencies. Overridable for testing."""
    override = os.environ.get("JARVIS_PYDEPS_DIR")
    if override:
        return override
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    return os.path.join(base, "Jarvis", "pydeps")


def staged_dir() -> str:
    """Where the installer parks an existing install's site-packages."""
    return pydeps_root() + "-staged"


def venv_python(root: str) -> str:
    if os.name == "nt":
        return os.path.join(root, "Scripts", "python.exe")
    return os.path.join(root, "bin", "python")


def _site_packages(root: str) -> str:
    """The venv's site-packages. Windows uses <root>/Lib/site-packages."""
    if os.name == "nt":
        return os.path.join(root, "Lib", "site-packages")
    for entry in sorted(os.listdir(os.path.join(root, "lib"))):
        if entry.startswith("python"):
            return os.path.join(root, "lib", entry, "site-packages")
    raise RuntimeError("Could not locate the venv's site-packages.")


def stamp_path(root: str) -> str:
    """Lives WITH the deps, so the marker and the packages can never disagree."""
    return os.path.join(root, ".provisioned")


# ── Progress protocol ─────────────────────────────────────────────────────────

def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def progress(pct: float, phase: str, detail: str) -> None:
    emit({"type": "progress", "pct": max(0, min(100, int(pct))), "phase": phase, "detail": detail})


def log(line: str) -> None:
    line = line.rstrip()
    if line:
        emit({"type": "log", "line": line})


# ── Stamp ─────────────────────────────────────────────────────────────────────

def lock_sha256() -> str:
    with open(_LOCK, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def read_stamp(root: str) -> dict:
    try:
        with open(stamp_path(root), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_stamp(root: str) -> None:
    payload = {
        "schema": _STAMP_SCHEMA,
        "app_version": os.environ.get("JARVIS_APP_VERSION", ""),
        "lock_sha256": lock_sha256(),
        "python": platform.python_version(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    os.makedirs(root, exist_ok=True)
    with open(stamp_path(root), "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)


def _python_minor(version: str) -> str:
    return ".".join(version.split(".")[:2])


# ── The venv ──────────────────────────────────────────────────────────────────

def _run(cmd: list, cwd: str | None = None) -> int:
    """Run a subprocess, streaming its output into the log channel."""
    proc = subprocess.Popen(
        cmd, cwd=cwd,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        log(line)
    return proc.wait()


def _venv_usable(root: str) -> bool:
    """A venv we can actually run pip from."""
    py = venv_python(root)
    if not os.path.isfile(py):
        return False
    try:
        return subprocess.run(
            [py, "-c", "import pip"], capture_output=True, timeout=60
        ).returncode == 0
    except Exception:
        return False


def ensure_venv() -> str:
    """
    Make sure a usable venv exists at pydeps_root(), adopting the installer's
    staged site-packages when there is one. Returns the venv root.
    """
    root = pydeps_root()
    staged = staged_dir()

    if _venv_usable(root):
        # Already good. If a staged dir is also lying around, a previous update
        # migrated but this venv predates it — drop the staged copy so it can't
        # accumulate 8 GB of dead weight.
        if os.path.isdir(staged):
            log("Removing a leftover staged package directory.")
            shutil.rmtree(staged, ignore_errors=True)
        return root

    # A half-built venv (interrupted run) must not be adopted blindly.
    if os.path.isdir(root):
        log("Removing an incomplete package directory before rebuilding.")
        shutil.rmtree(root, ignore_errors=True)

    progress(1, "deps", "Preparing the package folder…")
    os.makedirs(os.path.dirname(root), exist_ok=True)

    # NOTE: created WITH pip (no --without-pip). Building it without pip and
    # then swapping in a foreign site-packages produced a transient
    # _distutils_hack failure on `import setuptools`; creating it normally does
    # not. The few seconds ensurepip costs are worth not relying on that.
    code = _run([sys.executable, "-m", "venv", root])
    if code != 0:
        raise RuntimeError(f"Could not create the Python environment (exit code {code}).")

    if os.path.isdir(staged):
        progress(3, "deps", "Reusing the packages already on this machine…")
        target = _site_packages(root)
        try:
            shutil.rmtree(target)                 # the fresh venv's own site-packages
            os.rename(staged, target)             # same volume -> instant
            log("Adopted the existing packages from the previous install.")
        except OSError as exc:
            log(f"(could not reuse existing packages: {exc} — they will be reinstalled)")
            os.makedirs(target, exist_ok=True)

    if not _venv_usable(root):
        # Adopting the staged tree left something unusable — start clean rather
        # than limp along. Costs a download; never leaves a broken install.
        log("The reused packages were not usable; rebuilding the environment from scratch.")
        shutil.rmtree(root, ignore_errors=True)
        code = _run([sys.executable, "-m", "venv", root])
        if code != 0:
            raise RuntimeError(f"Could not create the Python environment (exit code {code}).")

    return root


def deps_current(root: str) -> bool:
    """
    Whether the installed packages match the shipped lock file.

    The old check was four imports, which was fine when the whole tree was
    deleted on every update. Now that it persists, a changed lock has to force a
    reinstall or a new dependency would be silently ignored forever.
    """
    stamp = read_stamp(root)
    if not stamp:
        return False
    if stamp.get("lock_sha256") != lock_sha256():
        log("Dependency list changed since the last setup — updating packages.")
        return False
    if _python_minor(str(stamp.get("python", ""))) != _python_minor(platform.python_version()):
        log("Python version changed since the last setup — reinstalling packages.")
        return False
    # Stamp agrees; confirm the tree isn't corrupt.
    py = venv_python(root)
    probe = "import torch, faster_whisper, kokoro, openwakeword"
    try:
        if subprocess.run([py, "-c", probe], capture_output=True, timeout=300).returncode != 0:
            log("Installed packages look incomplete — reinstalling.")
            return False
    except Exception:
        return False
    return True


def install_deps(root: str) -> None:
    if not os.path.isfile(_LOCK):
        raise RuntimeError(f"Dependency lock not found: {_LOCK}")

    progress(4, "deps", "Preparing to install Python packages (~4 GB download)…")

    with open(_LOCK, "r", encoding="utf-8") as fh:
        total = sum(1 for ln in fh if ln.strip() and not ln.startswith("#"))
    total = max(total, 1)

    cmd = [
        venv_python(root), "-m", "pip", "install",
        "--no-input", "--disable-pip-version-check", "--no-warn-script-location",
        # Unnecessary inside a venv (no PEP 668 marker there), but harmless and
        # kept so the same command still works if we ever install into the
        # bundled runtime directly again.
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
            pct = min(_DEPS_MAX - 3, 5 + (seen / total) * (_DEPS_MAX - 8))
            progress(pct, "deps", "Installing Python packages…")
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"Package installation failed (pip exit code {code}). Check your internet connection and retry.")
    progress(_DEPS_MAX, "deps", "Python packages installed.")


# ── Models ────────────────────────────────────────────────────────────────────

def download_models() -> None:
    """
    Pre-download the STT / wake-word / TTS models.

    Runs in-process, but only ever under the VENV's python — the packages it
    imports live there, not in the bundled runtime that starts provisioning. The
    parent re-invokes this file with `--download-models` (see main()).
    """
    if _HERE not in sys.path:
        sys.path.insert(0, _HERE)
    import config

    progress(80, "models", "Downloading speech-to-text model…")
    # Download-only: instantiating WhisperModel here would also int8-convert
    # the (now large) model in RAM just to provision it. download_model()
    # fetches the same files into the same HF cache the runtime load uses.
    from faster_whisper import download_model
    download_model(config.WHISPER_MODEL_SIZE)

    fallback_model = getattr(config, "WHISPER_CPU_FALLBACK_MODEL", "")
    if fallback_model and fallback_model != config.WHISPER_MODEL_SIZE:
        progress(85, "models", "Downloading fallback speech-to-text model…")
        download_model(fallback_model)

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


def download_models_via_venv(root: str) -> None:
    """Re-invoke this script under the venv python to do the model downloads,
    passing its JSON progress lines straight through."""
    proc = subprocess.Popen(
        [venv_python(root), os.path.abspath(__file__), "--download-models"],
        cwd=_HERE,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.rstrip()
        if not line:
            continue
        # Child speaks the same protocol — forward its objects verbatim so the
        # setup screen sees one continuous progress stream.
        if line.startswith("{"):
            sys.stdout.write(line + "\n")
            sys.stdout.flush()
        else:
            log(line)
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"Model download failed (exit code {code}). Check your internet connection and retry.")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    try:
        if "--download-models" in sys.argv:
            # Child mode: running under the venv python.
            download_models()
            return 0

        root = ensure_venv()

        if deps_current(root):
            progress(_DEPS_MAX, "deps", "Python packages already installed.")
        else:
            install_deps(root)

        download_models_via_venv(root)

        write_stamp(root)

        progress(100, "models", "Setup complete.")
        emit({"type": "done"})
        return 0
    except Exception as exc:  # noqa: BLE001
        emit({"type": "error", "message": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
