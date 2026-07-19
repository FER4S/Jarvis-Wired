# Changelog

The user-facing entries here are mirrored in `src/data/changelog.ts`, which is
what the app actually displays — **update both**. The *Internal* sections are
repo-only and are deliberately not shown in the app.

---

## 1.1.0 — 2026-07-19

**Type to Jarvis, mute him, and fix what he remembers.**

### You can type to Jarvis now
There's a message box under the conversation. Type anything and press Enter —
Jarvis answers exactly as if you'd said it out loud. It works any time, even
while he's listening, thinking or talking; typing cuts him off and your message
goes first. You can answer his questions by typing too, so you can send a whole
email without saying a word.

### You can mute him
There's a speaker button next to the message box. Turn it off and Jarvis stops
talking out loud — you'll still see everything he says in the conversation. He
remembers your choice.

### You can interrupt him
If Jarvis is halfway through something you didn't want, just say "Hey Jarvis" and
he stops talking and listens. No more waiting for a long wrong answer to finish.

### Sending email is much harder to derail
Before, one misheard word — usually which account to send from — threw away the
whole message and you started over. Now he asks again instead of giving up. You
can also say the whole thing at once: "email Michael and tell him the meeting
moved to Thursday" — he works out the rest.

### He hears you much better
Jarvis now uses a considerably more accurate speech model. Names, email addresses
and account names come through right far more often.

### Emails you send actually show up in Sent
Messages sent through your Hostinger account now appear in your Sent folder like
any other email, so there's a record of them in your mail app.

### You can see and edit everything Jarvis remembers
There's a new Account section where you can read, correct, add or delete anything
he's learned about you — your details, the people you work with, facts and dates.
You can also paste in a list of contacts and he'll sort it into proper entries for
you to review before anything is saved.

### Internal

- **Typed input**: new `core/typed_input.py` (`TypedInputBox`) — a TTL'd
  cross-thread slot modelled on the pending-contact one. `POST /message` fills
  it; the voice loop drains it. New `JarvisAssistant._get_turn_input()` is now
  the single input path (turn loop, `_ask_and_listen`, and onboarding all route
  through it), so every sub-dialogue accepts typing for free.
- **STT abort**: `STTEngine.request_abort()` + a per-chunk check (~32 ms), so a
  typed message cuts a listening window short. Aborted listens return `""`, the
  same as silence — the caller disambiguates via the typed slot, so the
  `listen_and_transcribe -> str` contract is unchanged.
- **Mute**: flag on `JarvisAssistant`, guarded in `_speak()` (returns `True`, not
  `False`, so it isn't mistaken for a barge-in). Onboarding is deliberately
  exempt — it calls `_tts.speak()` directly and must stay audible.
- **Fixed `GET /health` drift**: it now returns `assistant_running`,
  `models_ready` and `state`, which the frontend had always read but never
  received. `running` was permanently `false`, and bootstrap sat in a 120 s poll.
- **Persistent Python deps**: dependencies now install into a venv at
  `%LOCALAPPDATA%\Jarvis\pydeps` instead of inside the app folder, which the
  installer wipes on every update. An NSIS `customInit` hook relocates an
  existing install's packages before the wipe, so updating no longer re-downloads
  ~4 GB. The `.provisioned` marker became a JSON stamp carrying the lock hash, so
  a changed `requirements-lock.txt` forces a reinstall and an unchanged one is a
  no-op.
- **CUDA DLL discovery** now scans every site-packages root instead of only
  `sys.prefix`, and warns loudly when it finds none (it previously failed
  silently, degrading GPU transcription to CPU).
- Transcript history raised from 2 entries to 50; `transcription` events carry
  `source: "voice" | "typed"`; renderer typecheck errors reduced 7 → 1.

---

## 1.0.0 — 2026-07-14

First release: wake-word voice assistant with persistent memory and multi-account
email, packaged as a one-click Windows installer with first-run GPU provisioning.
