# ─────────────────────────────────────────────────────────────────────────────
#  core/typed_input.py – The typed-message slot
#  Lets the boss type to Jarvis from the dashboard instead of speaking. The API
#  thread drops a message in; the voice loop takes it out.
#
#  Same shape as EmailManager's pending-contact slot (one lock, a TTL, an atomic
#  claim) — that one is already proven for exactly this API-thread-fills /
#  voice-thread-drains pattern. Two differences, both deliberate:
#
#    * `claim()` REMOVES the message (the contact slot leaves its request open so
#      a mistyped address can be re-submitted). A message is consumed once.
#    * an `arrival_event` is exposed, so a message can abort an in-flight mic
#      recording instead of waiting out its silence timeout.
#
#  Deliberately NOT on EmailManager (no email semantics) and not bare fields on
#  JarvisAssistant: it needs its own lock and TTL, and the house style for that
#  is a small class that owns them.
# ─────────────────────────────────────────────────────────────────────────────

from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from loguru import logger

# How long a queued message stays valid. JarvisAssistant.is_active() is True
# from run() entry — which INCLUDES the multi-minute Whisper/Kokoro model load,
# before the dispatch loop even exists — so the dashboard enables the message box
# while models are still loading. Without a TTL, something typed at second 5
# would be answered at second 180, long after the boss gave up on it.
TYPED_MESSAGE_TTL_S: float = 120.0

# Matches the API layer's Field(max_length=...) bound; enforced here too so the
# slot is safe no matter who calls it.
MAX_MESSAGE_CHARS: int = 2000


class TypedInputBox:
    """
    A single pending typed message, handed between the API thread and the voice
    thread. At most one message is held: a second submit replaces an unclaimed
    first (the boss corrected himself before Jarvis got to it), which is the same
    "typo caught in time" behavior as submit_contact_email().
    """

    def __init__(self, on_message: Optional[Callable[[], None]] = None) -> None:
        """
        Args:
            on_message: called (no args) right after a message is stored, on the
                        API thread. Must be non-blocking — the assistant uses it
                        to poke the dispatch loop and abort a live recording,
                        exactly as _on_new_mail pokes the wake event.
        """
        self._lock = threading.Lock()
        self._pending: Optional[str] = None
        self._queued_at: float = 0.0
        self._on_message = on_message
        # Set while a message is waiting. Handed to STTEngine so a recording in
        # progress can be cut short (see JarvisAssistant._get_turn_input).
        self.arrival_event = threading.Event()

    # ── API thread ────────────────────────────────────────────────────────────

    def submit(self, text: str) -> bool:
        """
        Queue a typed message. Returns False when there is nothing to queue
        (blank, or nothing but whitespace) so the endpoint can answer 400.
        """
        text = (text or "").strip()
        if not text:
            return False
        text = text[:MAX_MESSAGE_CHARS]

        with self._lock:
            replaced = self._pending is not None
            self._pending = text
            self._queued_at = time.time()
            self.arrival_event.set()

        if replaced:
            logger.info("A typed message replaced an earlier unclaimed one.")
        else:
            logger.info("A typed message was queued from the dashboard.")

        # Outside the lock: the callback pokes the dispatch loop and aborts a
        # live recording, and must never run while holding this lock.
        if self._on_message is not None:
            try:
                self._on_message()
            except Exception as exc:  # noqa: BLE001 - a bad callback must not lose the message
                logger.warning(f"typed-input callback failed ({exc}).")
        return True

    # ── Voice thread ──────────────────────────────────────────────────────────

    def _live_locked(self) -> Optional[str]:
        """The queued message, or None if absent/expired. Lock must be held."""
        if self._pending is None:
            return None
        if time.time() - self._queued_at > TYPED_MESSAGE_TTL_S:
            logger.info("Discarded a typed message that went stale before Jarvis reached it.")
            self._pending = None
            self.arrival_event.clear()
            return None
        return self._pending

    def claim(self) -> Optional[str]:
        """
        Atomically take the queued message, or None. Consuming: the same message
        is never handed out twice.
        """
        with self._lock:
            text = self._live_locked()
            if text is None:
                return None
            self._pending = None
            self.arrival_event.clear()
            return text

    def peek_pending(self) -> bool:
        """
        Whether a live message is waiting, WITHOUT consuming it. The dispatch
        loop uses this to decide to spawn a conversation; the conversation then
        claims it as its first turn.
        """
        with self._lock:
            return self._live_locked() is not None

    def clear(self) -> None:
        """Drop anything queued. Used on shutdown."""
        with self._lock:
            self._pending = None
            self.arrival_event.clear()
