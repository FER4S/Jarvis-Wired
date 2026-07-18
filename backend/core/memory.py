# ─────────────────────────────────────────────────────────────────────────────
#  core/memory.py – Persistent memory for Jarvis
#  Local JSON store of what Jarvis knows about the boss: profile, people,
#  events, and facts. A short summary is injected into the LLM system prompt
#  each conversation; a background Sonnet call extracts new memorable content
#  from the transcript once a conversation ends.
# ─────────────────────────────────────────────────────────────────────────────

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import shutil
import sys
import threading
import time
import uuid
from datetime import datetime

# Ensure the project root is on sys.path so `import config` works when this
# file is run directly (e.g. `python core/memory.py`).
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import anthropic
from loguru import logger

import config

# ── Storage location ─────────────────────────────────────────────────────────
# JARVIS_DATA_DIR redirects writes to a per-user writable dir when packaged
# (e.g. %APPDATA%\Jarvis\data); falls back to project-local ./data in dev.
_DATA_DIR: str = os.environ.get("JARVIS_DATA_DIR") or os.path.join(_PROJECT_ROOT, "data")
_MEMORY_FILE: str = os.path.join(_DATA_DIR, "memory.json")

# Read attempts before declaring memory.json unreadable and quarantining it.
# OneDrive/antivirus can hold a transient lock on the file; a short retry
# rides that out instead of treating it as corruption.
_LOAD_ATTEMPTS: int = 3
_LOAD_RETRY_DELAY_S: float = 0.25

# ── Models ────────────────────────────────────────────────────────────────────
# Heavier background-task tier (memory extraction, future briefings/summaries)
# - distinct from the realtime-voice haiku model in core/llm.py.
EXTRACTION_MODEL_ID: str = "claude-sonnet-5"
EXTRACTION_MAX_TOKENS: int = 1024
EXTRACTION_TIMEOUT: float = 15.0   # background thread - more slack than LLMEngine's 10s

# ── Bulk import (dashboard paste-a-contact-list) ─────────────────────────────
# Reuses the Sonnet tier above (structuring a pasted list is heavier, non-
# realtime work) but with its OWN caps: EXTRACTION_MAX_TOKENS=1024 is sized for
# a conversation's worth of findings and would truncate a 60-person list
# mid-JSON, which parse_json_object then discards entirely. The boss is waiting
# on an HTTP request here, so this uses the no-retry realtime client.
IMPORT_MAX_CHARS: int = 12_000      # rejected above this, with a "smaller batches" message
IMPORT_MAX_TOKENS: int = 8_000
IMPORT_TIMEOUT: float = 60.0
IMPORT_MAX_PEOPLE: int = 200
IMPORT_MAX_FACTS: int = 200
IMPORT_MAX_EVENTS: int = 200

# Same fast model core/llm.py uses, for the one-off explicit-memory cleanup call.
FACT_CLEANUP_MODEL_ID: str = "claude-haiku-4-5-20251001"
FACT_CLEANUP_MAX_TOKENS: int = 100
FACT_CLEANUP_TIMEOUT: float = 10.0  # runs on the conversation thread - matches LLMEngine's own timeout

# Explicit-memory structuring (fact-vs-event classify + event match) and the
# same-or-new answer classify — both realtime, reuse the Haiku tier above.
STRUCTURE_KIND_FACT: str = "fact"
STRUCTURE_KIND_EVENT: str = "event"
STRUCTURE_MAX_TOKENS: int = 300     # classify+structure JSON, larger than a 1-sentence rewrite
CLASSIFY_MAX_TOKENS: int = 10       # "same"/"new" is one word

# Cap on how many (most-recent) existing events are rendered into the prompts
# that need them as context, to bound token cost.
_EVENTS_CONTEXT_CAP: int = 40

# ── get_context_summary() token budget ───────────────────────────────────────
# No tokenizer dependency is available; ~4 chars/token is a standard
# conservative heuristic for English prose (errs toward cutting a bit early
# rather than overshooting the caller's system-prompt token cost).
_CHARS_PER_TOKEN: float = 4.0
_SUMMARY_TOKEN_BUDGET: int = 300
_SUMMARY_CHAR_BUDGET: int = int(_SUMMARY_TOKEN_BUDGET * _CHARS_PER_TOKEN)  # 1200 chars

# extract_and_save() no-ops below this many user turns - not worth an API call.
_MIN_USER_TURNS_FOR_EXTRACTION: int = 2

# Conservative address shape. Guards every write to a person's "email" field:
# that field is what the voice send flow resolves a recipient from, so a
# malformed value stored here becomes a failed - or misdirected - send.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
# Same shape, unanchored, for finding an address embedded in free-text notes.
_EMAIL_SEARCH_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# A dangling "Email:" / "email address is" label left behind once the address
# after it is removed. Stripped so lifted notes don't read "... Email: ".
_EMAIL_LABEL_RE = re.compile(
    r"[,;.]?\s*\b(?:e-?mail(?:\s+address)?)\b\s*(?:is|:)?\s*$", re.IGNORECASE
)


def is_valid_email(value: str) -> bool:
    """True when `value` looks like a single, complete email address."""
    return bool(_EMAIL_RE.match(_clean_str(value)))


def _fact_id(text: str) -> str:
    """
    Stable id for a fact, DERIVED from its text rather than stored.

    Facts are a list[str] and stay that way: turning them into objects would
    break the "; ".join() in _recency_first_section (the context summary fed to
    every conversation), both dedup sites, and the extraction prompt that
    returns plain strings - and would force a content migration of the boss's
    file. They are already unique by case-insensitive content (add_explicit_
    memory and _merge_extracted both dedup that way), so hashing that same key
    gives an id with exactly the collision semantics the dedup already has.
    """
    return hashlib.sha256(_clean_str(text).lower().encode("utf-8")).hexdigest()[:16]


def _split_email_from_notes(notes: str) -> tuple[str, str]:
    """
    Pull a single valid email address out of a free-text notes string.
    Returns (notes_without_the_address, address_lowercased) - or the notes
    unchanged and "" if there's no valid address in them.

    This is the bridge for the one case the extraction guard would otherwise
    strand: background extraction is deliberately never told the "email" field
    exists (so it can't be prompted into inventing an address), which means a
    real address the boss stated in conversation has nowhere to go but the
    notes. Lifting it here - an address the model TRANSCRIBED, not one it was
    asked to produce - lands it in the structured field the send flow reads,
    while the notes keep whatever non-address context came with it.
    """
    notes = _clean_str(notes)
    if not notes:
        return notes, ""
    match = _EMAIL_SEARCH_RE.search(notes)
    if not match or not is_valid_email(match.group(0)):
        return notes, ""

    before = _EMAIL_LABEL_RE.sub("", notes[: match.start()])
    after = notes[match.end():]
    cleaned = f"{before.rstrip()} {after.lstrip()}"
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,;:-")
    return cleaned, match.group(0).lower()


def parse_json_object(raw_text: str) -> dict | None:
    """
    Best-effort parse of a JSON object out of raw_text, tolerating markdown
    code fences and stray commentary around the JSON. Returns None if no
    JSON object could be located/parsed, or the parsed value isn't a dict.
    """
    text = raw_text.strip()

    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            parsed = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None

    return parsed if isinstance(parsed, dict) else None


def extract_response_text(response) -> str:
    """
    Concatenate every text content block in an Anthropic API response.

    response.content[0].text is NOT reliably the reply: Claude can (and
    empirically does, observed live against claude-sonnet-5) return a
    non-text block first (e.g. a thinking block, which has no .text), making
    content[0].text None. Scanning every block and keeping only type=="text"
    ones is the robust way to pull the actual reply out of a response.
    """
    parts = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text" and getattr(block, "text", None)
    ]
    return "".join(parts).strip()


def _clean_str(value) -> str:
    """
    Coerce a possibly-None/non-string value into a stripped string. Needed
    because the extraction model sometimes emits JSON `null` for an optional
    field (e.g. {"notes": null}) instead of an empty string - dict.get(key, "")
    only applies its default when the key is *missing*, not when it's present
    with a None value, so a bare `.strip()` on that would raise.
    """
    if value is None:
        return ""
    return str(value).strip()


def _today_str() -> str:
    """
    Current date, with weekday name, in config.TIMEZONE - e.g.
    "Tuesday, July 07, 2026". Gives the fact-cleanup and extraction
    prompts a real "today" so they can resolve relative time references
    (today/tomorrow/next Tuesday/etc.) into absolute dates instead of
    storing words that go stale.
    """
    return datetime.now(config.TIMEZONE).strftime("%A, %B %d, %Y")


def _events_context_block(events: list[dict]) -> str:
    """
    Render existing events as prompt context so a model can match a new
    mention against them and copy a description verbatim. One line per event:
    `- "<description>" (date: <date or "none">)`. Returns "(none)" when empty.
    Only the most recent _EVENTS_CONTEXT_CAP events are shown, to bound tokens.
    """
    recent = events[-_EVENTS_CONTEXT_CAP:]
    lines = []
    for e in recent:
        description = _clean_str(e.get("description"))
        if not description:
            continue
        date = _clean_str(e.get("date")) or "none"
        lines.append(f'- "{description}" (date: {date})')
    return "\n".join(lines) if lines else "(none)"


class MemoryManager:
    """
    Local JSON-backed memory store for Jarvis.

    Call load() once at startup, then get_context_summary() at the start of
    each conversation to feed LLMEngine.get_response(). add_explicit_memory()
    handles "Jarvis, remember that..." commands; extract_and_save() handles
    background extraction from a finished conversation's transcript.

    Usage:
        memory = MemoryManager()
        memory.load()
        summary = memory.get_context_summary()
    """

    def __init__(self, api_key: str = config.ANTHROPIC_API_KEY) -> None:
        if not api_key:
            logger.warning(
                "ANTHROPIC_API_KEY is not set. "
                "Memory extraction calls will fail until it is added to .env."
            )
        # Realtime tier: structure_explicit_memory / clean_fact_text /
        # classify_same_or_new run on the conversation thread with the boss
        # actively waiting — no SDK auto-retries, fail within one timeout.
        self._client = anthropic.Anthropic(api_key=api_key, max_retries=0)
        # Background tier: extract_and_save runs on a daemon thread after the
        # conversation ends — nobody is waiting, so keep the SDK's default
        # retry behavior (retrying a transient failure there is pure upside).
        self._background_client = anthropic.Anthropic(api_key=api_key)
        self._state: dict = self._empty_state()
        self._lock = threading.Lock()
        # Set when memory.json was unreadable AND couldn't be quarantined -
        # every save is then refused so the file on disk is never overwritten
        # by this session's empty fallback state.
        self._save_disabled = False

    @staticmethod
    def _empty_state() -> dict:
        return {
            "onboarding_complete": False,
            "profile": {},
            "people": [],
            "events": [],
            "facts": [],
            "last_updated": "",
        }

    # ── Storage ───────────────────────────────────────────────────────────────

    def load(self) -> None:
        """
        Load memory from disk, creating the file/directory if missing.

        If the file exists but cannot be read/parsed even after a short retry
        (transient OneDrive/AV locks), it is quarantined - renamed aside for
        manual recovery, never overwritten - and this session starts with
        empty memory. See _quarantine_unreadable_file().
        """
        with self._lock:
            if not os.path.isdir(_DATA_DIR):
                os.makedirs(_DATA_DIR, exist_ok=True)

            if not os.path.isfile(_MEMORY_FILE):
                logger.info(f"No memory file found at {_MEMORY_FILE} - creating a new one.")
                self._state = self._empty_state()
                self._write_locked()
                return

            last_exc: Exception | None = None
            for attempt in range(1, _LOAD_ATTEMPTS + 1):
                # ValueError covers json.JSONDecodeError (its subclass) plus the
                # wrong-shape check below; OSError covers locked/unreadable files.
                try:
                    with open(_MEMORY_FILE, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                    if not isinstance(loaded, dict):
                        raise ValueError(
                            f"top level must be a JSON object, got {type(loaded).__name__}"
                        )
                    merged = self._empty_state()
                    merged.update(loaded)
                    self._state = merged
                    # Self-heal any person whose address is stranded in their
                    # notes (an older extraction, before the field was lifted
                    # at merge time) into the structured email field.
                    repaired = self._normalize_people_emails_locked()
                    # Stamp entry ids onto a store written before they existed.
                    # Purely additive - no existing field is read or changed -
                    # so the boss's accumulated memory survives untouched.
                    stamped = self._ensure_ids_locked()
                    if (repaired or stamped) and not self._save_disabled:
                        if stamped:
                            self._backup_before_migration_locked()
                        self._write_locked()
                    logger.success(f"Memory loaded from {_MEMORY_FILE}.")
                    return
                except (ValueError, OSError) as exc:
                    last_exc = exc
                    if attempt < _LOAD_ATTEMPTS:
                        logger.warning(
                            f"Failed to load memory file (attempt {attempt}/"
                            f"{_LOAD_ATTEMPTS}: {exc}) - retrying in "
                            f"{_LOAD_RETRY_DELAY_S}s…"
                        )
                        time.sleep(_LOAD_RETRY_DELAY_S)

            self._quarantine_unreadable_file(last_exc)

    def _quarantine_unreadable_file(self, exc: Exception | None) -> None:
        """
        Handle a memory.json that exists but stayed unreadable through the
        retry loop. Caller must already hold self._lock.

        The one outcome this must prevent: a later save() overwriting the
        boss's accumulated memory with this session's empty fallback state.
        So the bad file is renamed aside (atomic) for manual recovery; if even
        the rename fails (file still locked), saves are disabled for the rest
        of this session and the file on disk stays untouched.

        Both failure modes mark onboarding complete in the fallback state:
        re-running onboarding over a recoverable store would clobber (or,
        with saves disabled, silently drop) the real profile. The genuine
        first-run path - no file at all - never reaches here.
        """
        timestamp = datetime.now(config.TIMEZONE).strftime("%Y%m%d-%H%M%S")
        quarantine_path = f"{_MEMORY_FILE}.corrupt-{timestamp}"
        try:
            os.replace(_MEMORY_FILE, quarantine_path)
            logger.critical(
                f"memory.json could not be loaded ({exc}) - moved it to "
                f"{quarantine_path} for manual recovery. Starting with EMPTY "
                f"memory; new saves will create a fresh file."
            )
        except OSError as move_exc:
            self._save_disabled = True
            logger.critical(
                f"memory.json could not be loaded ({exc}) and could not be "
                f"quarantined ({move_exc}) - memory saves are DISABLED for this "
                f"session to protect the file on disk. Restart Jarvis once the "
                f"file is accessible again."
            )
        self._state = self._empty_state()
        self._state["onboarding_complete"] = True

    def save(self) -> None:
        """Write the current memory state to disk."""
        with self._lock:
            self._write_locked()

    def is_writable(self) -> bool:
        """
        False when saves are refused for this session (an unreadable memory.json
        was left in place). The API surfaces this so the dashboard can show a
        read-only banner instead of presenting an empty store as the truth and
        reporting "Saved" on writes that never reach disk.
        """
        with self._lock:
            return not self._save_disabled

    def _ensure_ids_locked(self) -> bool:
        """
        Stamp a stable id onto any person/event that lacks one. Returns whether
        anything changed. Caller must already hold self._lock.

        Called from _write_locked(), which is the single choke point every
        creation path funnels through (_upsert_person_locked, add_event,
        _merge_extracted, complete_onboarding, load()'s repair write) - so no
        entry can ever reach disk without an id, and none of those paths needed
        touching. Facts are excluded by design: their id is derived from their
        text (see _fact_id).

        The ids are additive and invisible to the voice paths, which keep
        matching people by name and events by description; nothing renders them
        into a prompt, so the model can neither see nor invent one.
        """
        changed = False
        for collection in ("people", "events"):
            for entry in self._state.get(collection, []):
                if not isinstance(entry, dict):
                    continue
                if not isinstance(entry.get("id"), str) or not entry.get("id"):
                    entry["id"] = uuid.uuid4().hex
                    changed = True
        return changed

    def _backup_before_migration_locked(self) -> None:
        """
        One-time copy of memory.json aside before the first id-stamping write.
        Caller must already hold self._lock.

        Only ever runs when load() found entries without ids - i.e. exactly once,
        on the first launch after this feature ships, against the boss's
        accumulated memory. Afterwards nothing lacks an id, so no .bak- files
        accumulate. A failed backup is logged and the migration proceeds: the
        tmp+os.replace write is the real protection, and refusing to migrate
        would leave the store permanently un-editable.
        """
        timestamp = datetime.now(config.TIMEZONE).strftime("%Y%m%d-%H%M%S")
        backup_path = f"{_MEMORY_FILE}.bak-{timestamp}"
        try:
            shutil.copy2(_MEMORY_FILE, backup_path)
            logger.info(f"Backed up memory.json to {backup_path} before adding entry ids.")
        except OSError as exc:
            logger.warning(f"Could not back up memory.json before migration ({exc}) - proceeding.")

    def _write_locked(self) -> bool:
        """
        Actual write logic. Caller must already hold self._lock.

        Returns True only when the state actually reached disk. Callers that
        report success to a user (the /memory/* endpoints) must check it: a
        refused or failed save that returned silently would have the dashboard
        render "Saved" over a file that never changed.
        """
        if self._save_disabled:
            logger.error(
                "Memory save skipped - saves are disabled for this session after "
                "an unreadable memory.json was left in place (see startup log)."
            )
            return False
        self._ensure_ids_locked()
        self._state["last_updated"] = datetime.now(config.TIMEZONE).isoformat()
        os.makedirs(_DATA_DIR, exist_ok=True)
        tmp_path = _MEMORY_FILE + ".tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2, ensure_ascii=False)
            os.replace(tmp_path, _MEMORY_FILE)  # atomic on both Windows and POSIX
            return True
        except OSError as exc:
            logger.error(f"Failed to save memory file: {exc}")
            return False

    # ── Context summary ───────────────────────────────────────────────────────

    def get_context_summary(self) -> str:
        """
        Build a short plain-text summary of everything in memory, suitable for
        injection into an LLM system prompt. Stays under ~300 tokens (via a
        char-based heuristic). Returns "" if memory has nothing meaningful yet.

        Profile/people are included in full (bounded in practice). Events/facts
        - the two lists that grow unboundedly over months of use - are built
        recency-first: when space-constrained, the OLDEST entries are dropped,
        not the newest, since a naive "join everything then truncate the end"
        approach would silently keep ancient facts forever while dropping
        whatever was just learned.
        """
        with self._lock:
            profile = dict(self._state.get("profile") or {})
            people = list(self._state.get("people") or [])
            events = list(self._state.get("events") or [])
            facts = list(self._state.get("facts") or [])

        if not profile and not people and not events and not facts:
            return ""

        sections: list[str] = []
        for section in (self._format_profile_section(profile), self._format_people_section(people)):
            if section:
                sections.append(section)

        def _remaining_budget() -> int:
            joined_so_far = " | ".join(sections)
            separator_if_more = 3 if sections else 0  # " | "
            return _SUMMARY_CHAR_BUDGET - len(joined_so_far) - separator_if_more

        event_strs = [
            f"{e.get('description', '?')} ({e.get('date', 'date unknown')})" for e in events
        ]
        events_section = self._recency_first_section(
            "Upcoming/relevant events", event_strs, _remaining_budget()
        )
        if events_section:
            sections.append(events_section)

        facts_section = self._recency_first_section("Other known facts", facts, _remaining_budget())
        if facts_section:
            sections.append(facts_section)

        summary = " | ".join(sections)

        # Defense-in-depth backstop - the section budgeting above should
        # already guarantee this, but a hard cap costs nothing extra.
        if len(summary) > _SUMMARY_CHAR_BUDGET:
            summary = summary[:_SUMMARY_CHAR_BUDGET].rstrip() + "..."

        return summary

    @staticmethod
    def _format_profile_section(profile: dict) -> str:
        if not profile:
            return ""
        if "raw_qa" in profile and len(profile) == 1:
            return f"About the user: {profile['raw_qa']}"
        profile_bits = "; ".join(f"{k}: {v}" for k, v in profile.items() if v)
        return f"About the user: {profile_bits}" if profile_bits else ""

    @staticmethod
    def _format_people_section(people: list[dict]) -> str:
        if not people:
            return ""
        people_bits = "; ".join(
            MemoryManager._format_person(p) for p in people
        )
        return f"Key people: {people_bits}"

    @staticmethod
    def _format_person(person: dict) -> str:
        """`Name (notes) <email>`, omitting whichever parts are absent. The
        address is included so plain Claude can answer "what's Sarah's email?"
        from real data instead of confabulating one."""
        rendered = person.get("name", "?")
        if person.get("notes"):
            rendered += f" ({person['notes']})"
        if person.get("email"):
            rendered += f" <{person['email']}>"
        return rendered

    @staticmethod
    def _recency_first_section(label: str, items: list[str], budget: int) -> str:
        """
        Build "label: item; item; ..." keeping the MOST RECENT items (from the
        end of `items`) that fit within `budget` characters, dropping older
        ones first when space-constrained.
        """
        if budget <= 0 or not items:
            return ""
        kept: list[str] = []
        used = len(label) + 2  # ": "
        for item in reversed(items):
            addition = len(item) + (2 if kept else 0)  # "; " separator
            if used + addition > budget:
                break
            kept.append(item)
            used += addition
        if not kept:
            return ""
        kept.reverse()  # restore chronological order for readability
        return f"{label}: {'; '.join(kept)}"

    # ── Explicit memory ("Jarvis, remember that...") ─────────────────────────

    def add_explicit_memory(self, text: str) -> None:
        """
        Add a raw fact string to the facts list and save immediately. Used for
        "Jarvis, remember that..." voice commands. Does no LLM work itself -
        a thin, fast, always-succeeds append (see clean_fact_text() for the
        companion Haiku cleanup step assistant.py runs before calling this).
        """
        text = text.strip()
        if not text:
            logger.warning("add_explicit_memory() called with empty text - skipping.")
            return

        with self._lock:
            facts = self._state.setdefault("facts", [])
            if any(_clean_str(existing).lower() == text.lower() for existing in facts):
                logger.debug(f"Fact already present, skipping duplicate: '{text}'")
            else:
                facts.append(text)
            self._write_locked()

        logger.success(f"Explicit memory saved: '{text}'")

    def clean_fact_text(self, raw_text: str) -> str:
        """
        One-off Haiku call to normalize a raw spoken fragment (already
        stripped of its "remember that"/"don't forget" trigger phrase) into a
        clean, well-formed fact statement. Never raises - falls back to
        raw_text.strip() unchanged if the API call fails for any reason.
        """
        raw_text = raw_text.strip()
        if not raw_text:
            return raw_text
        try:
            response = self._client.messages.create(
                model=FACT_CLEANUP_MODEL_ID,
                max_tokens=FACT_CLEANUP_MAX_TOKENS,
                timeout=FACT_CLEANUP_TIMEOUT,
                system=(
                    f"Today is {_today_str()}. Rewrite the following fragment as a "
                    "single, clean, third-person factual statement suitable for a "
                    "personal memory note. Keep it concise - one sentence.\n\n"
                    "If the fragment contains a relative time/day reference (e.g. "
                    "today, tomorrow, yesterday, next Tuesday, this Friday, in two "
                    "weeks), resolve it to an absolute date using the date given "
                    "above and state that date explicitly in the rewritten sentence "
                    "instead of the relative word. Otherwise, if the fragment has no "
                    "relative time/day reference - including if it only has a bare "
                    "time-of-day like \"5pm\" with no relative day word, or if it "
                    "already names an absolute date - leave that part exactly as "
                    "stated and do not add, invent, or infer any date that is not "
                    "already implied by a relative reference in the fragment.\n\n"
                    "Return ONLY the rewritten sentence, no quotes, no preamble, no "
                    "explanation."
                ),
                messages=[{"role": "user", "content": raw_text}],
            )
            cleaned = extract_response_text(response)
            return cleaned if cleaned else raw_text
        except Exception as exc:
            logger.warning(f"clean_fact_text() failed ({exc}) - using raw text unmodified.")
            return raw_text

    def structure_explicit_memory(self, raw_text: str) -> dict:
        """
        One Haiku call that decides whether an explicit "remember that…" command
        is a general FACT or a dated EVENT; for events, produces a normalized
        {description, date} (relative dates resolved against _today_str()) and
        whether it matches an existing event.

        Returns a fully-defaulted dict (callers never KeyError):
            {"kind": "event"|"fact", "description": str, "date": str,
             "match_description": str}
        - description/date are "" for facts.
        - match_description is "" or the EXACT existing description it resembles.

        Never raises. On any failure/unparseable/wrong-shape, falls back to
        {"kind": "fact", ...} so the raw text is still saved via the always-
        succeeds fact path (no event data invented, nothing lost).
        """
        fallback = {"kind": STRUCTURE_KIND_FACT, "description": "", "date": "", "match_description": ""}

        raw_text = raw_text.strip()
        if not raw_text:
            return fallback

        # Snapshot events under the lock, then build the prompt and make the
        # network call OUTSIDE the lock (no network call ever holds self._lock).
        with self._lock:
            events_snapshot = list(self._state.get("events") or [])
        existing_descriptions_lower = {
            _clean_str(e.get("description")).lower() for e in events_snapshot
        }

        try:
            response = self._client.messages.create(
                model=FACT_CLEANUP_MODEL_ID,
                max_tokens=STRUCTURE_MAX_TOKENS,
                timeout=FACT_CLEANUP_TIMEOUT,
                system=(
                    f"Today is {_today_str()}. You are the structuring step of a "
                    "personal voice assistant's memory. The user just gave an explicit "
                    "\"remember this\" command. Decide whether it describes a dated/"
                    "scheduled EVENT (a meeting, appointment, call, deadline, trip, "
                    "reminder tied to a day/time) or a general FACT (a preference or "
                    "standing detail with no specific occurrence time).\n\n"
                    "Respond with ONLY a single JSON object (no markdown fences, no "
                    "commentary) with exactly these keys:\n"
                    "- \"kind\": either \"event\" or \"fact\".\n"
                    "- \"description\": if kind is \"event\", a short third-person "
                    "description with NO date/time words in it (e.g. \"Meeting with "
                    "Dana\", \"Dentist appointment\"); if kind is \"fact\", \"\".\n"
                    "- \"date\": if kind is \"event\", the event's date/time as stated; "
                    "if kind is \"fact\", \"\". If the event has a relative time/day "
                    "reference (today, tomorrow, next Tuesday, this Friday, in two "
                    "weeks), resolve it to an absolute ISO 8601 date (YYYY-MM-DD) using "
                    "today's date above and put that here instead of the relative "
                    "phrase; you may append a bare time-of-day (e.g. \"2026-07-14 at 5 "
                    "p.m.\"). If only a bare time-of-day was given with no day word, "
                    "keep just that time. If no date/time was given, \"\".\n"
                    "- \"match_description\": if kind is \"event\" AND it clearly refers "
                    "to the SAME real-world event as one already in the existing-events "
                    "list below (same meeting/appointment, possibly rescheduled or "
                    "reworded), copy that existing event's description string EXACTLY, "
                    "character for character. Otherwise \"\".\n\n"
                    "Existing events already in memory:\n"
                    f"{_events_context_block(events_snapshot)}\n\n"
                    "Only set match_description when you are confident it is the SAME "
                    "underlying event, not merely a similar kind of event. Do not "
                    "invent information that was not stated."
                ),
                messages=[{"role": "user", "content": raw_text}],
            )
            parsed = parse_json_object(extract_response_text(response))
            if not isinstance(parsed, dict):
                return fallback

            kind = _clean_str(parsed.get("kind")).lower()
            if kind != STRUCTURE_KIND_EVENT:
                return fallback  # whitelist: anything not "event" is a fact

            description = _clean_str(parsed.get("description"))
            if not description:
                return fallback  # event with no description → treat as a fact

            date = _clean_str(parsed.get("date"))
            match_description = _clean_str(parsed.get("match_description"))
            # Defend against a hallucinated match: only honor it if it actually
            # names an existing event (case-insensitive).
            if match_description and match_description.lower() not in existing_descriptions_lower:
                match_description = ""

            return {
                "kind": STRUCTURE_KIND_EVENT,
                "description": description,
                "date": date,
                "match_description": match_description,
            }
        except Exception as exc:
            logger.warning(f"structure_explicit_memory() failed ({exc}) - treating as a plain fact.")
            return fallback

    def add_event(self, description: str, date: str, force_new: bool = False) -> None:
        """
        Append a new event {description, date} and save immediately. Thin,
        never raises.

        By default (force_new=False), if an event with this exact
        (case-insensitive) description already exists, its date is updated in
        place instead of appending — a safety net so a stale/uncertain add
        can't create an accidental duplicate. Pass force_new=True to always
        append a separate entry regardless of collision: used when the boss
        has *explicitly* said this is a new, different event, so the dedup net
        must not silently override that answer.
        """
        description = _clean_str(description)
        if not description:
            logger.warning("add_event() called with empty description - skipping.")
            return
        date = _clean_str(date)

        with self._lock:
            events = self._state.setdefault("events", [])
            if not force_new:
                for existing in events:
                    if _clean_str(existing.get("description")).lower() == description.lower():
                        if date:
                            existing["date"] = date
                        self._write_locked()
                        logger.success(f"Event already present, updated date in place: '{description}'")
                        return
            events.append({"description": description, "date": date})
            self._write_locked()

        logger.success(
            f"Event saved{' (forced new entry)' if force_new else ''}: "
            f"'{description}' (date: '{date}')"
        )

    def update_event_date(
        self, match_description: str, new_date: str, new_description: str = ""
    ) -> bool:
        """
        Update the first event whose description case-insensitively equals
        match_description. Returns True if a match was found and updated, False
        otherwise (so the caller can fall back to add_event on a stale key).

        Date guard: only overwrite the date when new_date is non-empty (a vague
        "yeah, same one" must not blank a good stored date). Description is only
        overwritten when new_description is non-empty and actually differs.
        """
        key = _clean_str(match_description).lower()
        if not key:
            return False
        new_date = _clean_str(new_date)
        new_description = _clean_str(new_description)

        with self._lock:
            events = self._state.get("events") or []
            for existing in events:
                if _clean_str(existing.get("description")).lower() == key:
                    if new_date:
                        existing["date"] = new_date
                    if new_description and new_description.lower() != key:
                        existing["description"] = new_description
                    self._write_locked()
                    logger.success(f"Event updated: '{match_description}' -> date '{new_date}'")
                    return True

        logger.debug(f"update_event_date(): no event matching '{match_description}' - caller should add new.")
        return False

    # ── People ────────────────────────────────────────────────────────────────

    def _upsert_person_locked(
        self, name: str, notes: str = "", email: str = "", overwrite_email: bool = False
    ) -> None:
        """
        The single place a person entry is created or updated. Assumes
        self._lock is HELD (same convention as _write_locked) and does not
        save - the caller owns both.

        Dedup is a case-insensitive name match, unchanged. Notes are appended
        with "; " when the new note isn't already contained in the old.

        Email is only written when it passes _EMAIL_RE, and only over an empty
        stored value - unless `overwrite_email` is set, which only the explicit
        set_person_email() path does. Background extraction never reaches that
        parameter, so an extracted (i.e. possibly hallucinated) address can
        never displace one the boss confirmed out loud: memory is what the send
        flow resolves recipients from, and a wrong address there is a
        misdirected, unrecallable send.

        When no explicit `email` is given but the `notes` contain a valid
        address (how background extraction surfaces one, since its prompt has
        no email field), it is lifted out of the notes into the field. This
        never overwrites a stored address - it fills an empty slot only - so
        the same guard holds.
        """
        name = _clean_str(name)
        if not name:
            return
        notes = _clean_str(notes)
        email = _clean_str(email)
        if not email:
            notes, email = _split_email_from_notes(notes)
        name_lower = name.lower()

        for existing in self._state.setdefault("people", []):
            if _clean_str(existing.get("name")).lower() != name_lower:
                continue
            old_notes = _clean_str(existing.get("notes"))
            if notes and notes.lower() not in old_notes.lower():
                existing["notes"] = f"{old_notes}; {notes}".strip("; ")
            if email and is_valid_email(email):
                if overwrite_email or not _clean_str(existing.get("email")):
                    existing["email"] = email
            return

        self._state["people"].append({
            "name": name,
            "notes": notes,
            "email": email if (email and is_valid_email(email)) else "",
        })

    def _normalize_people_emails_locked(self) -> bool:
        """
        Lift a stranded address out of any person's notes into their empty
        email field (see _split_email_from_notes). One-time repair for entries
        written before the field was populated at merge time. Assumes the lock
        is held; does not save. Returns True if anything changed.

        Only touches a person whose email field is empty, so a confirmed
        address is never disturbed.
        """
        changed = False
        for person in self._state.get("people") or []:
            if _clean_str(person.get("email")):
                continue
            new_notes, lifted = _split_email_from_notes(person.get("notes"))
            if lifted:
                person["notes"] = new_notes
                person["email"] = lifted
                changed = True
                logger.info(f"Repaired a stranded email in memory for '{person.get('name')}'.")
        return changed

    def set_person_email(self, name: str, email: str) -> bool:
        """
        Store `email` as `name`'s address, creating the person if unknown.
        Overwrites an existing address, since the only callers are the
        confirmed voice flow (the boss spelled it out and approved the
        readback) and the typed dashboard submission - both are the boss
        explicitly correcting the record.

        Returns False without writing anything when the address is malformed.
        Routes through _upsert_person_locked, so name dedup and notes-merge
        behave exactly as they do for background extraction.
        """
        name = _clean_str(name)
        email = _clean_str(email)
        if not name or not is_valid_email(email):
            logger.warning(
                f"set_person_email(): refusing to store an invalid address for '{name}'."
            )
            return False

        with self._lock:
            self._upsert_person_locked(name, email=email, overwrite_email=True)
            self._write_locked()

        logger.success(f"Contact address saved for '{name}'.")
        return True

    def find_people_by_name(self, name: str) -> list[dict]:
        """
        Look up stored people by a spoken name. Returns copies (callers must
        not mutate the live list). More than one result means the caller must
        ask the boss which person they meant.

        Resolution is deterministic, in three stages, stopping at the first
        that produces anything:

        1. Exact case-insensitive full-name match. Exactly one such person
           wins OUTRIGHT - a bare "Michael" resolves to the person literally
           named "Michael" with no clarifying question, even though "Michael
           Heckin" is also stored.
        2. Anchored per-token prefix: every query token prefixes the name
           token in the same position. "Michael H" -> "Michael Heckin";
           "Mich" -> both Michaels (so the caller asks); "Michael" with no
           bare-"Michael" entry -> every Michael.
        3. Surname fallback for a single-token query that prefixed nothing:
           any name containing it as a whole token. "Heckin" -> "Michael
           Heckin".

        A loose match is safe here: the recipient's name AND address are read
        back for explicit confirmation before anything is sent.
        """
        query = _clean_str(name).lower()
        if not query:
            return []

        with self._lock:
            people = [dict(p) for p in self._state.get("people") or []]

        exact = [p for p in people if _clean_str(p.get("name")).lower() == query]
        if len(exact) == 1:
            return exact

        query_tokens = query.split()

        def token_prefix_match(person: dict) -> bool:
            name_tokens = _clean_str(person.get("name")).lower().split()
            if len(query_tokens) > len(name_tokens):
                return False
            return all(
                name_tokens[i].startswith(token) for i, token in enumerate(query_tokens)
            )

        prefixed = [p for p in people if token_prefix_match(p)]
        if prefixed:
            return prefixed

        if len(query_tokens) == 1:
            return [
                p for p in people
                if query in _clean_str(p.get("name")).lower().split()
            ]
        return exact

    def classify_same_or_new(self, answer_text: str) -> str:
        """
        Interpret the boss's spoken answer to the "same event, or new?"
        clarifying question. Returns "same", "new", or "unclear":
        - "same": clearly the same event (→ caller updates it in place).
        - "new": clearly a different, separate event — an EXPLICIT answer the
          caller honors by force-appending a new entry even on a description
          collision.
        - "unclear": noncommittal/ambiguous/silent, or any failure. The caller
          still records the event, but WITHOUT forcing, so the dedup safety net
          can guard against a stray duplicate on a non-answer.

        Never raises. Silence and errors both resolve to "unclear" so only a
        confident, explicit "new" ever forces a separate entry.
        """
        if not answer_text.strip():
            return "unclear"  # silence is not an explicit answer; no API call

        try:
            response = self._client.messages.create(
                model=FACT_CLEANUP_MODEL_ID,
                max_tokens=CLASSIFY_MAX_TOKENS,
                timeout=FACT_CLEANUP_TIMEOUT,
                system=(
                    "The user was asked whether something they just mentioned is the "
                    "SAME event they mentioned before (e.g. just rescheduled or "
                    "reworded) or a NEW, different event. Read their reply and answer "
                    "with ONLY one lowercase word:\n"
                    "- \"same\" if they clearly mean it is the same event,\n"
                    "- \"new\" if they clearly mean it is a different, separate event,\n"
                    "- \"unclear\" if their reply is noncommittal, ambiguous, or "
                    "doesn't answer the question.\n"
                    "Output only that one word, nothing else."
                ),
                messages=[{"role": "user", "content": answer_text}],
            )
            verdict = extract_response_text(response).strip().lower()
            if verdict.startswith("same"):
                return "same"
            if verdict.startswith("new"):
                return "new"
            return "unclear"
        except Exception as exc:
            logger.warning(f"classify_same_or_new() failed ({exc}) - defaulting to 'unclear'.")
            return "unclear"

    # ── Background extraction ─────────────────────────────────────────────────

    def extract_and_save(self, conversation: list[dict]) -> None:
        """
        Extract memorable facts/people/events from a finished conversation and
        merge them into memory. `conversation` is the list[dict] shape
        LLMEngine.history returns (role/content dicts).

        No-ops if the conversation has fewer than _MIN_USER_TURNS_FOR_EXTRACTION
        user turns. Never raises - designed to run safely from a background
        daemon thread at conversation teardown.
        """
        user_turn_count = sum(1 for turn in conversation if turn.get("role") == "user")
        if user_turn_count < _MIN_USER_TURNS_FOR_EXTRACTION:
            logger.debug(
                f"extract_and_save(): only {user_turn_count} user turn(s) - "
                f"skipping extraction (need >= {_MIN_USER_TURNS_FOR_EXTRACTION})."
            )
            return

        try:
            transcript = "\n".join(
                f"{turn.get('role', '?').upper()}: {turn.get('content', '')}"
                for turn in conversation
            )

            # Snapshot existing events under the lock so the extraction model can
            # decide update-vs-new. The authoritative re-read happens again under
            # the lock in _merge_extracted; this copy is only for the prompt.
            with self._lock:
                events_snapshot = list(self._state.get("events") or [])

            extraction_system_prompt = (
                f"Today is {_today_str()}. You analyze a conversation transcript "
                "between a voice assistant and its user, and extract any durable, "
                "memorable information about the user's life, work, or preferences "
                "that would be useful to remember in future conversations. Ignore "
                "small talk, one-off questions (e.g. what time is it), and anything "
                "not meaningfully new.\n\n"
                "Respond with ONLY a single JSON object (no markdown fences, no "
                "commentary) matching exactly this shape: an object with three keys "
                "people (list of objects with name and notes string fields), "
                "events (list of objects with description, date, and updates string "
                "fields), and facts (list of plain strings).\n\n"
                "Use empty arrays for any category with nothing to report.\n\n"
                "If a fact, event description, or event date contains a relative "
                "time/day reference (e.g. today, tomorrow, yesterday, next Tuesday, "
                "this Friday, in two weeks), resolve it to an absolute ISO 8601 date "
                "(YYYY-MM-DD) using the real today's-date given above, and write "
                "that absolute date into the text/field in place of the relative "
                "phrase. Otherwise, if there is no relative time/day reference - "
                "including a bare time-of-day like \"5pm\" with no relative day "
                "word, or a date already stated absolutely - leave it exactly as "
                "said and do not add, invent, or infer a date that is not already "
                "implied by a relative reference in the transcript. An event with no "
                "date mentioned at all should have an empty string \"\" for its date "
                "field, not a guessed or invented one. Do not invent information not "
                "present in the transcript.\n\n"
                "The user already has these events stored in memory:\n"
                f"{_events_context_block(events_snapshot)}\n"
                "For each event you output, add an \"updates\" field. If the event is "
                "the SAME real-world event as one stored above but with a changed/"
                "newly-clarified date/time (or a reworded description of that same "
                "event), set \"updates\" to that existing event's description string "
                "copied EXACTLY, character for character, and put the new date in "
                "\"date\". If it is genuinely new, set \"updates\" to \"\". Only use "
                "\"updates\" when confident it is the same underlying event, not "
                "merely a similar kind of event."
            )

            response = self._background_client.messages.create(
                model=EXTRACTION_MODEL_ID,
                max_tokens=EXTRACTION_MAX_TOKENS,
                timeout=EXTRACTION_TIMEOUT,
                system=extraction_system_prompt,
                messages=[{"role": "user", "content": transcript}],
            )

            raw_text = extract_response_text(response)
            extracted = self._parse_extraction_json(raw_text)
            if extracted is None:
                logger.warning(
                    "extract_and_save(): could not parse a usable JSON object from "
                    "the extraction response - discarding this extraction pass."
                )
                return

            self._merge_extracted(extracted)
            logger.success("extract_and_save(): memory updated from conversation.")

        except Exception as exc:
            logger.error(f"extract_and_save() failed, memory not updated: {exc}")

    @staticmethod
    def _parse_extraction_json(raw_text: str) -> dict | None:
        """Parse the extraction response into a dict with people/events/facts list keys."""
        parsed = parse_json_object(raw_text)
        if not isinstance(parsed, dict):
            return None

        return {
            "people": parsed.get("people") if isinstance(parsed.get("people"), list) else [],
            "events": parsed.get("events") if isinstance(parsed.get("events"), list) else [],
            "facts": parsed.get("facts") if isinstance(parsed.get("facts"), list) else [],
        }

    def _merge_extracted(self, extracted: dict) -> None:
        """Merge newly-extracted people/events/facts into self._state, deduplicating, then save."""
        with self._lock:
            self._state.setdefault("people", [])
            existing_events = self._state.setdefault("events", [])
            existing_facts = self._state.setdefault("facts", [])

            # People: dedup by case-insensitive name match; merge notes on
            # repeat. `email` is deliberately never passed - the extraction
            # prompt doesn't know the field exists, so the model cannot invent
            # an address that a later send would deliver to.
            for person in extracted["people"]:
                if not isinstance(person, dict):
                    continue
                self._upsert_person_locked(
                    _clean_str(person.get("name")), notes=_clean_str(person.get("notes"))
                )

            # Events: update in place when the model flags an update (matched by
            # exact existing-description key), else fall back to exact-description
            # dedup, else append. Reads the authoritative existing_events list so
            # an interleaved Path-1 write is respected. Legacy events (no
            # "updates" field) are read only via .get() and never retroactively
            # merged - only extracted->existing matches act here.
            existing_descriptions_lower = {_clean_str(e.get("description")).lower() for e in existing_events}
            for event in extracted["events"]:
                if not isinstance(event, dict):
                    continue
                description = _clean_str(event.get("description"))
                if not description:
                    continue
                date = _clean_str(event.get("date"))
                updates_key = _clean_str(event.get("updates")).lower()

                target = None
                if updates_key:  # 1) explicit update by stable description key
                    for existing in existing_events:
                        if _clean_str(existing.get("description")).lower() == updates_key:
                            target = existing
                            break
                if target is None:  # 2) safety net: exact-description dedup
                    for existing in existing_events:
                        if _clean_str(existing.get("description")).lower() == description.lower():
                            target = existing
                            break

                if target is not None:
                    if date:  # don't blank a good stored date
                        target["date"] = date
                    if description.lower() != _clean_str(target.get("description")).lower():
                        target["description"] = description
                        existing_descriptions_lower.add(description.lower())
                    continue

                existing_events.append({"description": description, "date": date})  # 3) new
                existing_descriptions_lower.add(description.lower())

            # Facts: dedup by case-insensitive exact match.
            existing_facts_lower = {_clean_str(f).lower() for f in existing_facts}
            for fact in extracted["facts"]:
                if not isinstance(fact, str):
                    continue
                fact = fact.strip()
                if fact and fact.lower() not in existing_facts_lower:
                    existing_facts.append(fact)
                    existing_facts_lower.add(fact.lower())

            self._write_locked()

    # ── Onboarding ────────────────────────────────────────────────────────────

    def is_onboarding_complete(self) -> bool:
        with self._lock:
            return bool(self._state.get("onboarding_complete", False))

    def complete_onboarding(self, profile: dict) -> None:
        """Store the given profile dict, mark onboarding complete, and save."""
        with self._lock:
            self._state["profile"] = profile if isinstance(profile, dict) else {"raw_qa": str(profile)}
            self._state["onboarding_complete"] = True
            self._write_locked()
        logger.success("Onboarding complete - profile saved to memory.")

    # ── Manual editing surface (dashboard Account tab) ───────────────────────
    # Everything below backs the /memory/* endpoints. Two rules hold throughout:
    # each method takes self._lock exactly once and calls _write_locked() once
    # (never N saves for a batch), and none holds the lock across a network call.
    # Every mutator returns None / False / raises nothing on a refused write -
    # instead it reports the _write_locked() result so the API can answer 503
    # rather than let the dashboard claim a save that never reached disk.

    def get_snapshot(self) -> dict:
        """
        The whole store, as the dashboard needs it: deep-copied so a caller can
        never mutate live state, with facts rendered as {id, text} so all three
        lists are id-addressable and symmetric for the UI.
        """
        with self._lock:
            return {
                "profile": copy.deepcopy(self._state.get("profile") or {}),
                "people": copy.deepcopy(self._state.get("people") or []),
                "events": copy.deepcopy(self._state.get("events") or []),
                "facts": [
                    {"id": _fact_id(f), "text": _clean_str(f)}
                    for f in (self._state.get("facts") or [])
                    if _clean_str(f)
                ],
                "onboarding_complete": bool(self._state.get("onboarding_complete", False)),
                "last_updated": _clean_str(self._state.get("last_updated")),
                "writable": not self._save_disabled,
            }

    def update_profile(self, profile: dict) -> bool:
        """
        Replace the profile wholesale (not a merge): replace is the only
        semantic that lets the boss DELETE a key the extractor drifted in, and
        nothing else writes profile except one-time onboarding.

        Also marks onboarding complete. Without that, a boss who fills in his
        profile here before ever completing the voice onboarding would have
        run() start onboarding on the next launch and overwrite every field he
        just typed (complete_onboarding replaces the whole dict). Typing your
        own profile in IS the onboarding.
        """
        cleaned = {
            _clean_str(k): _clean_str(v)
            for k, v in (profile or {}).items()
            if _clean_str(k) and _clean_str(v)
        }
        with self._lock:
            self._state["profile"] = cleaned
            self._state["onboarding_complete"] = True
            return self._write_locked()

    # ── People (manual) ───────────────────────────────────────────────────────

    def _find_by_id_locked(self, collection: str, entry_id: str) -> dict | None:
        """Locate a person/event by id. Caller must already hold self._lock."""
        for entry in self._state.get(collection) or []:
            if isinstance(entry, dict) and entry.get("id") == entry_id:
                return entry
        return None

    def add_person(self, name: str, notes: str = "", email: str = "") -> tuple[str, dict | None]:
        """
        Create a person. Returns (status, person) where status is "ok",
        "invalid_name", "duplicate", or "write_failed".

        Deliberately 409s on a case-insensitive name collision instead of
        silently merging (which is what _upsert_person_locked does for the
        voice/extraction paths): in a manual editor, "add" that quietly
        rewrites someone else's entry is a surprise. The bulk import is the
        opposite - it merges - but only after showing the boss that it will.
        """
        name = _clean_str(name)
        if not name:
            return "invalid_name", None
        notes = _clean_str(notes)
        email = _clean_str(email)
        if email and not is_valid_email(email):
            return "invalid_email", None

        with self._lock:
            name_lower = name.lower()
            for existing in self._state.setdefault("people", []):
                if _clean_str(existing.get("name")).lower() == name_lower:
                    return "duplicate", None
            person = {
                "id": uuid.uuid4().hex,
                "name": name,
                "notes": notes,
                "email": email,
            }
            self._state["people"].append(person)
            if not self._write_locked():
                self._state["people"].remove(person)
                return "write_failed", None
            return "ok", dict(person)

    def update_person(
        self,
        person_id: str,
        name: str | None = None,
        notes: str | None = None,
        email: str | None = None,
    ) -> tuple[str, dict | None]:
        """
        Edit a person in place. Only the fields passed (non-None) are touched.
        Returns (status, person): "ok", "not_found", "invalid_name",
        "invalid_email", "duplicate", "write_failed".

        Sets fields DIRECTLY rather than going through _upsert_person_locked,
        which appends to notes - correct when merging an extraction, wrong when
        the boss is rewriting a note he wants replaced.

        `email` may be set here (gated by is_valid_email) or cleared with "".
        That is the same trust level set_person_email() already documents for a
        typed dashboard submission: an explicit, reviewed correction by the
        boss, not something a model produced. A rename that would collide with
        another person is refused, so the name key the voice paths still match
        on stays unambiguous.
        """
        with self._lock:
            person = self._find_by_id_locked("people", person_id)
            if person is None:
                return "not_found", None

            before = dict(person)

            if name is not None:
                new_name = _clean_str(name)
                if not new_name:
                    return "invalid_name", None
                if new_name.lower() != _clean_str(person.get("name")).lower():
                    for other in self._state.get("people") or []:
                        if other is person:
                            continue
                        if _clean_str(other.get("name")).lower() == new_name.lower():
                            return "duplicate", None
                person["name"] = new_name

            if notes is not None:
                new_notes = _clean_str(notes)
                # Keep the store self-consistent: if the boss types an address
                # into the notes box, lift it the same way load() would on the
                # next restart - otherwise it silently moves later and looks
                # like Jarvis edited his note behind his back.
                if not _clean_str(person.get("email")):
                    new_notes, lifted = _split_email_from_notes(new_notes)
                    if lifted and is_valid_email(lifted):
                        person["email"] = lifted
                person["notes"] = new_notes

            if email is not None:
                new_email = _clean_str(email)
                if new_email and not is_valid_email(new_email):
                    return "invalid_email", None
                person["email"] = new_email  # "" explicitly clears a wrong address

            if not self._write_locked():
                person.clear()
                person.update(before)
                return "write_failed", None
            return "ok", dict(person)

    def delete_person(self, person_id: str) -> str:
        """Remove a person. Returns "ok", "not_found", or "write_failed"."""
        with self._lock:
            people = self._state.get("people") or []
            person = self._find_by_id_locked("people", person_id)
            if person is None:
                return "not_found"
            index = people.index(person)
            people.remove(person)
            if not self._write_locked():
                people.insert(index, person)
                return "write_failed"
            return "ok"

    # ── Facts (manual) ────────────────────────────────────────────────────────

    def add_fact(self, text: str) -> tuple[str, dict | None]:
        """Append a fact. Reuses add_explicit_memory's case-insensitive dedup."""
        text = _clean_str(text)
        if not text:
            return "invalid_text", None
        with self._lock:
            facts = self._state.setdefault("facts", [])
            if any(_clean_str(f).lower() == text.lower() for f in facts):
                return "duplicate", None
            facts.append(text)
            if not self._write_locked():
                facts.remove(text)
                return "write_failed", None
            return "ok", {"id": _fact_id(text), "text": text}

    def update_fact(self, fact_id: str, text: str) -> tuple[str, dict | None]:
        """
        Replace a fact's text in place - position is preserved, because
        get_context_summary() budgets facts recency-first and reordering would
        silently change what Jarvis remembers about most recently.
        """
        text = _clean_str(text)
        if not text:
            return "invalid_text", None
        with self._lock:
            facts = self._state.get("facts") or []
            for index, existing in enumerate(facts):
                if _fact_id(existing) != fact_id:
                    continue
                if any(
                    i != index and _clean_str(f).lower() == text.lower()
                    for i, f in enumerate(facts)
                ):
                    return "duplicate", None
                before = existing
                facts[index] = text
                if not self._write_locked():
                    facts[index] = before
                    return "write_failed", None
                return "ok", {"id": _fact_id(text), "text": text}
            return "not_found", None

    def delete_fact(self, fact_id: str) -> str:
        """Remove a fact by its derived id."""
        with self._lock:
            facts = self._state.get("facts") or []
            for index, existing in enumerate(facts):
                if _fact_id(existing) == fact_id:
                    removed = facts.pop(index)
                    if not self._write_locked():
                        facts.insert(index, removed)
                        return "write_failed"
                    return "ok"
            return "not_found"

    # ── Events (manual) ───────────────────────────────────────────────────────

    def add_event_entry(self, description: str, date: str = "") -> tuple[str, dict | None]:
        """
        Create an event. 409s on an exact (case-insensitive) description
        collision: description is still the key update_event_date() and
        _merge_extracted() match on, so the editor must not manufacture new
        ambiguity there. (Pre-existing duplicates from add_event(force_new=True)
        stay editable and deletable by id.)
        """
        description = _clean_str(description)
        if not description:
            return "invalid_description", None
        date = _clean_str(date)
        with self._lock:
            events = self._state.setdefault("events", [])
            key = description.lower()
            for existing in events:
                if _clean_str(existing.get("description")).lower() == key:
                    return "duplicate", None
            event = {"id": uuid.uuid4().hex, "description": description, "date": date}
            events.append(event)
            if not self._write_locked():
                events.remove(event)
                return "write_failed", None
            return "ok", dict(event)

    def update_event(
        self, event_id: str, description: str | None = None, date: str | None = None
    ) -> tuple[str, dict | None]:
        """
        Edit an event in place. Unlike the voice paths - which never blank a
        stored date, because a model returning "" means "didn't hear one" - an
        explicitly typed empty date here DOES clear it. This is a deliberate,
        documented difference: a person deleting the contents of a date box
        means it.
        """
        with self._lock:
            event = self._find_by_id_locked("events", event_id)
            if event is None:
                return "not_found", None
            before = dict(event)

            if description is not None:
                new_description = _clean_str(description)
                if not new_description:
                    return "invalid_description", None
                if new_description.lower() != _clean_str(event.get("description")).lower():
                    for other in self._state.get("events") or []:
                        if other is event:
                            continue
                        if _clean_str(other.get("description")).lower() == new_description.lower():
                            return "duplicate", None
                event["description"] = new_description

            if date is not None:
                event["date"] = _clean_str(date)

            if not self._write_locked():
                event.clear()
                event.update(before)
                return "write_failed", None
            return "ok", dict(event)

    def delete_event(self, event_id: str) -> str:
        """Remove an event by id."""
        with self._lock:
            events = self._state.get("events") or []
            event = self._find_by_id_locked("events", event_id)
            if event is None:
                return "not_found"
            index = events.index(event)
            events.remove(event)
            if not self._write_locked():
                events.insert(index, event)
                return "write_failed"
            return "ok"

    # ── Bulk import (paste a contact list, review, then commit) ──────────────
    #
    # NOTE ON THE EMAIL INVARIANT. Everywhere else in this file the rule is that
    # a model is never told the person `email` field exists, because an invented
    # address becomes a misdirected, unrecallable send. The import prompt below
    # DOES ask for addresses. That is a deliberate, scoped exception, safe only
    # because of four gates the background extractor has none of:
    #   1. the boss supplied the source text himself (it is not a transcript);
    #   2. every returned address must be a MEMBER of the set of addresses
    #      literally present in that text (see the gate in preview_import) - so
    #      the model can surface an address but cannot author one;
    #   3. he reviews every row in an editable table before anything is stored;
    #   4. nothing is written until he explicitly commits.
    # extract_and_save()'s prompt is untouched and must stay that way; keep this
    # prompt in its own function so the two can never drift into each other.

    @staticmethod
    def _empty_import_preview() -> dict:
        return {"people": [], "facts": [], "events": [], "warnings": []}

    def preview_import(self, text: str) -> tuple[str, dict]:
        """
        Structure a pasted blob into memory entries WITHOUT writing anything.

        Returns (status, preview) where status is "ok", "too_long", "empty",
        "truncated" (the model hit its token cap mid-JSON), or "unparseable".
        The preview tells the caller, per person, whether committing would
        create a new entry or merge into an existing one - and exactly what the
        merged notes would read as - so the review table is a faithful
        prediction rather than a guess.
        """
        text = (text or "").strip()
        if not text:
            return "empty", self._empty_import_preview()
        if len(text) > IMPORT_MAX_CHARS:
            return "too_long", self._empty_import_preview()

        # Snapshot under the lock, then release it: the network call below must
        # never hold it (same pattern as structure_explicit_memory).
        with self._lock:
            people_snapshot = copy.deepcopy(self._state.get("people") or [])

        try:
            response = self._client.messages.create(
                model=EXTRACTION_MODEL_ID,
                max_tokens=IMPORT_MAX_TOKENS,
                timeout=IMPORT_TIMEOUT,
                system=(
                    f"Today is {_today_str()}. The user pasted a block of their own "
                    "notes or contact list into a memory manager. Structure it into "
                    "entries a personal assistant should remember.\n\n"
                    "Respond with ONLY a single JSON object (no markdown fences, no "
                    "commentary) matching exactly this shape: an object with three "
                    "keys - people (list of objects with name, notes, and email "
                    "string fields), facts (list of plain strings), and events "
                    "(list of objects with description and date string fields).\n\n"
                    "Use empty arrays for any category with nothing to report.\n\n"
                    "For people: name is the person's name on its own; notes holds "
                    "the rest of what was written about them (role, company, phone, "
                    "context) as a short readable phrase; email is their email "
                    "address EXACTLY as written in the text.\n\n"
                    "CRITICAL: if a person's email address is not written in the "
                    "text, use an empty string for the email field. Never "
                    "construct, guess, complete, or infer an address - not from "
                    "their name, not from a domain that appears elsewhere in the "
                    "text, not from any pattern you notice. An invented address "
                    "would send the user's mail to the wrong person.\n\n"
                    "If a fact, event description, or event date contains a relative "
                    "time/day reference (e.g. today, tomorrow, next Tuesday, in two "
                    "weeks), resolve it to an absolute ISO 8601 date (YYYY-MM-DD) "
                    "using the real today's-date given above. Otherwise leave it "
                    "exactly as written; an event with no date at all gets an empty "
                    "string. Do not invent information not present in the text."
                ),
                messages=[{"role": "user", "content": text}],
            )
        except Exception as exc:
            logger.warning(f"preview_import() model call failed ({exc}).")
            return "unparseable", self._empty_import_preview()

        # A long list truncated mid-JSON parses to None and would otherwise look
        # like "nothing found" - tell the boss to split the paste instead.
        if getattr(response, "stop_reason", None) == "max_tokens":
            return "truncated", self._empty_import_preview()

        parsed = parse_json_object(extract_response_text(response))
        if not isinstance(parsed, dict):
            return "unparseable", self._empty_import_preview()

        # ── The address gate: set membership, NOT substring ──────────────────
        # A substring test would accept "michael@codex.co" against a source
        # containing "michael@codex.com" - an address that silently delivers to
        # a different domain. Membership of the exact set of addresses found in
        # the source admits only what the boss actually typed.
        source_addrs = {a.lower() for a in _EMAIL_SEARCH_RE.findall(text)}

        warnings: list[str] = []
        rejected_emails = 0

        existing_by_name = {
            _clean_str(p.get("name")).lower(): p
            for p in people_snapshot
            if _clean_str(p.get("name"))
        }

        people: list[dict] = []
        seen_names: dict[str, dict] = {}
        for raw in (parsed.get("people") or [])[:IMPORT_MAX_PEOPLE]:
            if not isinstance(raw, dict):
                continue
            name = _clean_str(raw.get("name"))
            if not name:
                continue
            notes = _clean_str(raw.get("notes"))
            email = _clean_str(raw.get("email"))
            email_status = "ok"
            if email:
                if not is_valid_email(email):
                    email, email_status = "", "invalid"
                    rejected_emails += 1
                elif email.lower() not in source_addrs:
                    email, email_status = "", "not_in_source"
                    rejected_emails += 1

            key = name.lower()
            # Collapse duplicates WITHIN the paste using the same rule
            # _upsert_person_locked would apply, so the preview matches commit.
            if key in seen_names:
                row = seen_names[key]
                if notes and notes.lower() not in row["notes"].lower():
                    row["notes"] = f"{row['notes']}; {notes}".strip("; ")
                if not row["email"] and email:
                    row["email"] = email
                    row["email_status"] = email_status
                row["merged_from_rows"] = row.get("merged_from_rows", 1) + 1
                continue

            existing = existing_by_name.get(key)
            row = {
                "name": name,
                "notes": notes,
                "email": email,
                "email_status": email_status,
                "action": "merge" if existing else "new",
                "existing_id": existing.get("id") if existing else None,
                "existing_notes": _clean_str(existing.get("notes")) if existing else "",
                "existing_email": _clean_str(existing.get("email")) if existing else "",
                "merged_from_rows": 1,
            }
            # Exactly what _upsert_person_locked's append would produce - its
            # containment check is also what makes re-running an import a no-op.
            if existing:
                old_notes = row["existing_notes"]
                row["notes_preview"] = (
                    f"{old_notes}; {notes}".strip("; ")
                    if notes and notes.lower() not in old_notes.lower()
                    else old_notes
                )
            else:
                row["notes_preview"] = notes
            people.append(row)
            seen_names[key] = row

        facts = [
            _clean_str(f) for f in (parsed.get("facts") or [])[:IMPORT_MAX_FACTS]
            if isinstance(f, str) and _clean_str(f)
        ]
        events = [
            {"description": _clean_str(e.get("description")), "date": _clean_str(e.get("date"))}
            for e in (parsed.get("events") or [])[:IMPORT_MAX_EVENTS]
            if isinstance(e, dict) and _clean_str(e.get("description"))
        ]

        if rejected_emails:
            warnings.append(
                f"{rejected_emails} email address(es) were removed because they "
                "don't appear in the text you pasted."
            )
        if not people and not facts and not events:
            warnings.append("Nothing recognisable was found in that text.")

        return "ok", {
            "people": people,
            "facts": facts,
            "events": events,
            "warnings": warnings,
        }

    def commit_import(
        self,
        people: list[dict] | None = None,
        facts: list[str] | None = None,
        events: list[dict] | None = None,
    ) -> tuple[str, dict]:
        """
        Write reviewed import rows. Takes only the rows the boss approved -
        never the raw text - and never calls a model.

        The address gate here is is_valid_email() ALONE: the source-membership
        check cannot apply, because a row the boss corrected in the review table
        legitimately no longer appears in the paste. That is exactly the trust
        level of POST /email/pending-contact, where a typed address is used
        verbatim precisely because it was typed rather than transcribed.

        One lock, one write for the whole batch.
        """
        people = people or []
        facts = facts or []
        events = events or []
        counts = {
            "people_created": 0, "people_merged": 0,
            "facts_added": 0, "facts_skipped": 0,
            "events_added": 0, "events_updated": 0,
        }

        with self._lock:
            existing_people = self._state.setdefault("people", [])
            for row in people:
                name = _clean_str(row.get("name"))
                if not name:
                    continue
                email = _clean_str(row.get("email"))
                if email and not is_valid_email(email):
                    email = ""
                notes = _clean_str(row.get("notes"))
                key = name.lower()
                match = next(
                    (p for p in existing_people
                     if _clean_str(p.get("name")).lower() == key),
                    None,
                )
                if match is not None:
                    counts["people_merged"] += 1
                else:
                    counts["people_created"] += 1
                # Reuse the single canonical writer so merge semantics (notes
                # append + containment check) are identical to every other path.
                self._upsert_person_locked(
                    name, notes, email,
                    overwrite_email=bool(row.get("replace_email")),
                )

            stored_facts = self._state.setdefault("facts", [])
            for raw in facts:
                fact = _clean_str(raw)
                if not fact:
                    continue
                if any(_clean_str(f).lower() == fact.lower() for f in stored_facts):
                    counts["facts_skipped"] += 1
                    continue
                stored_facts.append(fact)
                counts["facts_added"] += 1

            stored_events = self._state.setdefault("events", [])
            for raw in events:
                description = _clean_str(raw.get("description"))
                if not description:
                    continue
                date = _clean_str(raw.get("date"))
                key = description.lower()
                match = next(
                    (e for e in stored_events
                     if _clean_str(e.get("description")).lower() == key),
                    None,
                )
                if match is not None:
                    # Same guard as every other event path: never blank a stored
                    # date with an empty new one.
                    if date:
                        match["date"] = date
                        counts["events_updated"] += 1
                    continue
                stored_events.append({"description": description, "date": date})
                counts["events_added"] += 1

            if not self._write_locked():
                return "write_failed", counts

        logger.success(f"Memory import committed: {counts}")
        return "ok", counts


# ── Standalone test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.remove()
    logger.add(
        sys.stderr,
        level="DEBUG",
        colorize=True,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
    )

    manager = MemoryManager()
    manager.load()

    print(f"\nOnboarding complete: {manager.is_onboarding_complete()}")

    test_fact = "Prefers meetings scheduled in the afternoon, not mornings."
    print(f"\nAdding explicit memory: '{test_fact}'")
    manager.add_explicit_memory(test_fact)

    summary = manager.get_context_summary()
    print(f"\nContext summary ({len(summary)} chars):\n{summary}\n")
