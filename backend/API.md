# Jarvis API Reference

The Jarvis backend exposes a FastAPI server that the frontend can use to control the assistant and receive real-time state updates.

## Authentication (BREAKING CHANGE)

`POST /start`, `POST /stop`, the `/events` WebSocket, and all `/email/*` endpoints (except the Gmail OAuth callback, which is protected differently — see below) now require a shared secret token. Requests without it are rejected — there is no unauthenticated fallback (an unset token means those endpoints reject **everything**).

**Setup (once):** generate a token and put it in the backend's `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# .env:
# JARVIS_API_TOKEN=<the generated value>
```

The frontend must be configured with the same value and present it as follows:

| Surface | How to send the token | On failure |
|---|---|---|
| `POST /start`, `POST /stop`, `POST /message`, `POST /speech/mute` | HTTP header `Authorization: Bearer <token>` | `401 {"detail": "Missing or invalid API token."}` |
| `WS /events` | Query param: `ws://localhost:8000/events?token=<token>` (browsers can't set headers on WebSocket handshakes) | Handshake rejected (close code 1008 / HTTP 403) |
| All `/email/*` endpoints, except the one below | HTTP header `Authorization: Bearer <token>` | `401 {"detail": "Missing or invalid API token."}` |
| `GET /email/accounts/gmail/oauth-callback` | Not bearer-protected — Google's redirect is a plain browser GET that can't carry the header. Instead requires the one-time `state` query param minted by the (bearer-protected) `GET /email/accounts/gmail/oauth-url` — so an unset token still blocks the whole OAuth flow. | `403` (HTML page: invalid, reused, or expired link) |
| All `/memory/*` endpoints | HTTP header `Authorization: Bearer <token>` | `401 {"detail": "Missing or invalid API token."}` |
| `GET /health`, `GET /status` | No token required | — |

## REST Endpoints

### 1. Health Check
- **URL:** `GET /health`
- **Description:** Liveness probe, plus enough state for a dashboard to bootstrap from this single call: whether the assistant is up, whether the heavy models have finished loading, and the current pipeline state.
- **Note:** `models_ready` is `false` during the (potentially multi-minute) Whisper/Kokoro load even though `assistant_running` is already `true` — that window is "up but still starting", and it is when a freshly-launched dashboard should show a loading state rather than enabling controls.
- **Example Response:**
  ```json
  {
    "status": "ok",
    "service": "jarvis",
    "assistant_running": true,
    "models_ready": true,
    "state": "idle"
  }
  ```

### 2. Status
- **URL:** `GET /status`
- **Description:** Returns whether the assistant pipeline is running and its current state.
- **Note:** `running` is `true` for the entire pipeline lifetime — from the moment startup begins (model loading, first-run onboarding) until shutdown fully completes — not only while the wake-word loop is listening. A `POST /start` sent immediately after `POST /stop` may therefore return `"already running"` while the previous run winds down; poll `/status` until `running` is `false`, then retry.
- **Note:** `error` is `null` when healthy. When a component has died unrecoverably (currently: the wake-word microphone failed to open, or died mid-stream), it holds a short human-readable reason — the process is up but the assistant cannot hear "Hey Jarvis" until the problem is fixed. It clears automatically the next time the detector starts successfully.
- **Example Response:**
  ```json
  {
    "running": true,
    "state": "idle",
    "error": null,
    "muted": false
  }
  ```
- **Note:** `muted` is whether spoken output is currently suppressed (see `POST /speech/mute`). It resets to `false` on every backend restart, so a dashboard that offers the toggle should re-apply its stored preference when it connects.

### 3. Start Assistant
- **URL:** `POST /start`
- **Auth:** Requires `Authorization: Bearer <token>` (see [Authentication](#authentication-breaking-change)); returns `401` otherwise.
- **Description:** Starts the assistant pipeline in a background thread.
- **Example Response:**
  ```json
  {
    "status": "started"
  }
  ```

### 4. Stop Assistant
- **URL:** `POST /stop`
- **Auth:** Requires `Authorization: Bearer <token>` (see [Authentication](#authentication-breaking-change)); returns `401` otherwise.
- **Description:** Stops the assistant pipeline cleanly.
- **Example Response:**
  ```json
  {
    "status": "stopped"
  }
  ```

### 5. Send a Typed Message
- **URL:** `POST /message`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Hands Jarvis a message typed instead of spoken. It is processed exactly like a spoken utterance — same memory and email intercepts, same reply — and appears in the transcript through the ordinary `transcription` (with `source: "typed"`) → `llm_response` events.
- **Queued, not answered inline.** Conversations are strictly serial, so this drops the message into a slot the voice loop drains. If Jarvis is idle it starts a conversation; if he is mid-conversation it becomes the next turn, **cutting short whatever listening window is open** (~32 ms). The response body therefore says nothing about the reply — watch the WebSocket for that.
- **It also answers Jarvis's own questions.** Every clarifying question in the email/memory sub-dialogues accepts a typed answer, so a whole email can be sent — recipient, wording, and the final "should I send it?" — without speaking.
- **At most one message is held.** Sending a second before the first is picked up replaces it (a correction typed in time does the right thing). A queued message is discarded if it goes unclaimed for 120 seconds, so one typed while the models were still loading can't surface minutes later out of context.
- **Request Body:**
  ```json
  {"text": "email Michael and tell him the meeting moved to Thursday"}
  ```
- **Example Response:**
  ```json
  {"status": "accepted"}
  ```
- **Error Responses:**
  - `400 {"detail": "The message can't be empty."}` — whitespace only.
  - `409 {"detail": "Jarvis isn't running. Start the assistant and try again."}` — the pipeline is stopped; nothing would ever drain the message.
  - `422` — missing/oversized `text` (1–2000 characters).

### 6. Mute / Unmute Spoken Replies
- **URL:** `POST /speech/mute`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Turns Jarvis's spoken output off or on. Muted, he still answers — the reply is emitted as `llm_response` and appears in the transcript — he just doesn't say it out loud.
- **Applies to everything he speaks** (the greeting, replies, email/memory confirmations, drafted-email readbacks), with one deliberate exception: **first-run onboarding stays audible**, because a silent onboarding would ask five questions nobody could hear and record five blank answers.
- **`speaking_started` / `speaking_ended` are still emitted while muted**, so a dashboard's state machine doesn't strand itself waiting for a "finished speaking" that never comes. Treat mute as a global UI state (read `muted` from `GET /status`), not as an absence of events.
- **Per-process, resets on restart.** Persist the preference client-side and re-apply it on connect.
- **Request Body:**
  ```json
  {"muted": true}
  ```
- **Example Response:**
  ```json
  {"muted": true}
  ```

## Email Endpoints

Connects and manages email accounts (Hostinger-style IMAP and Gmail via OAuth), and answers dashboard/settings-UI queries. All of these are backed by a background poller (default every `EMAIL_POLL_INTERVAL_S` = 240s) that also drives Jarvis's proactive spoken "you've got new mail" nudge — see the [WebSocket Events](#websocket-events) note below.

**Scope of this API.** These eight endpoints cover *account management*, a *dashboard summary*, and one optional assist for the voice send flow. Everything else about email — listing, reading, searching history, summarizing, "anything need my attention?", and **sending** — happens **by voice**, and has no REST equivalent.

**Sending.** Jarvis can send a new email, and reply to one it just read, by voice. There is deliberately **no endpoint that sends an email**: the only way a message leaves the machine is for the drafted email to be read aloud in full and then explicitly approved out loud. CC/BCC, attachments, multiple recipients, and reply threading (`In-Reply-To`/`References`) are not implemented. The one send-adjacent endpoint, `POST /email/pending-contact`, supplies a *recipient's address* when Jarvis asks for one — it never sends anything by itself.

**The poller is independent of the voice pipeline.** It starts with the server and keeps running across `POST /stop`, so `GET /email/summary` stays fresh even while the assistant is stopped. Only shutting the server down stops it.

### 1. Add IMAP Account
- **URL:** `POST /email/accounts/imap`
- **Auth:** Requires `Authorization: Bearer <token>` (see [Authentication](#authentication-breaking-change)); returns `401` otherwise.
- **Description:** Adds a Hostinger-style (or any standard) IMAP account. The IMAP connection is validated live before anything is stored — on failure, nothing is saved.
- **Outgoing mail (optional).** The `smtp_*` fields are optional. Left out, the outgoing host is derived from `host` at send time (`imap.hostinger.com` → `smtp.hostinger.com`, port 465, implicit TLS), so an account added before sending existed can send with no changes and no re-add. When `smtp_host` **is** supplied, the SMTP login is also validated live before storing; when it isn't, SMTP is never probed here, so adding a read-only mailbox can't fail on an outgoing server it will never use.
- **Request Body:**
  ```json
  {
    "label": "Hostinger Support",
    "host": "imap.hostinger.com",
    "port": 993,
    "username": "support@example.com",
    "password": "the-mailbox-password",
    "use_ssl": true,

    "smtp_host": "smtp.hostinger.com",
    "smtp_port": 465,
    "smtp_use_ssl": true
  }
  ```
- **Example Response:**
  ```json
  {
    "account": {
      "id": "3f9a1c2b4e5d4f6a8b9c0d1e2f3a4b5c",
      "label": "Hostinger Support",
      "provider": "imap",
      "created_at": "2026-07-07T09:15:00+03:00"
    }
  }
  ```
- **Error Response (400):** `{"detail": "Login failed — check the username and password."}` — the raw server error is never echoed back or logged.

### 2. Gmail — Get OAuth Consent URL
- **URL:** `GET /email/accounts/gmail/oauth-url`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Returns a Google consent URL to open in a browser (requests `gmail.readonly` and `gmail.send` scopes — both are now used: `gmail.send` backs the voice send flow, and because it was requested from the first version of this endpoint, already-connected accounts never needed to re-consent). Mints a short-lived, single-use `state` nonce that the callback below requires.
- **Example Response:**
  ```json
  {
    "url": "https://accounts.google.com/o/oauth2/auth?...&state=...",
    "expires_in": 600
  }
  ```
- **Error Responses:**
  - `503` — `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` aren't configured in the backend `.env`. Surface this as "Gmail sign-in isn't set up on this machine"; it is not a user error and retrying won't help.
  - `500` — the server built a consent URL that was missing its scopes and refused to hand it out (a broken `google-auth-oauthlib`/`oauthlib` install). Never expected in a healthy deployment; treat as a backend bug, not a retry.

- **Notes for the frontend — how to use the returned `url` (this trips people up):**
  - **Open it verbatim, don't rebuild it.** It's ~400 characters. Truncating, re-encoding, or manually re-adding query params produces Google's confusing `Missing required parameter: scope` / `invalid client_id` errors. Hand the whole string to the browser (`shell.openExternal(url)` in Electron).
  - **The `state` nonce is in-memory, single-use, and expires in `expires_in` seconds (600).** It lives in the running server process. That means: a URL is only completable against the same backend process that minted it; **restarting the backend invalidates every pending consent URL**; and a URL can be completed exactly once. So fetch a fresh `url` at the moment the boss clicks "Connect Gmail" — never cache one, never persist one across a backend restart, and don't reuse one after a failed attempt (fetch a new one). A stale/reused/expired nonce is what produces the `403` page on the callback.
  - This nonce is also the callback's **only** protection (Google's redirect is a plain browser GET that can't carry the bearer header). If `JARVIS_API_TOKEN` is unset, no nonce can be minted, so the entire Gmail flow correctly fails closed.

### 3. Gmail — OAuth Callback
- **URL:** `GET /email/accounts/gmail/oauth-callback`
- **Auth:** Not bearer-protected — see the [Authentication](#authentication-breaking-change) table above.
- **Description:** Google redirects the boss's browser here after consent, with `code`/`state` query params (or `error` on cancellation). Exchanges the code for a refresh token, looks up the account's email address, and stores the account. Returns a small human-readable HTML page — there's nothing for a frontend to parse; the boss just closes the tab.
- **Note:** If Google doesn't return a refresh token (can happen on a repeat consent without revoking prior access first), nothing is stored and the page explains how to remove Jarvis's access at `myaccount.google.com/permissions` and try again.
- **Note:** The `403` page means the `state` nonce was invalid, already used, or older than 10 minutes — see the bullets above. The fix is always "fetch a fresh consent URL", never "retry this link".
- **Backend setup gotcha:** the **Gmail API must be enabled** in the Google Cloud project that owns the OAuth client (`console.cloud.google.com` → APIs & Services → Enable APIs → Gmail API). Consent will succeed and the callback will then fail on the token exchange / profile lookup with a `400`; the server log line reads `Gmail OAuth exchange failed: HttpError: ...`. Nothing is stored.
- **Note:** A newly connected account is usable **immediately, with no backend restart** — the voice assistant and `GET /email/summary` both see it, and its mail lands in the cache within a few seconds (the poller is woken on connect).

### 4. List Email Accounts
- **URL:** `GET /email/accounts`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Lists connected accounts — label and provider only. Credentials/tokens are never included in this or any other response.
- **Example Response:**
  ```json
  {
    "accounts": [
      {
        "id": "3f9a1c2b4e5d4f6a8b9c0d1e2f3a4b5c",
        "label": "Hostinger Support",
        "provider": "imap",
        "created_at": "2026-07-07T09:15:00+03:00"
      },
      {
        "id": "7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
        "label": "boss@gmail.com",
        "provider": "gmail_oauth",
        "created_at": "2026-07-07T09:20:00+03:00"
      }
    ]
  }
  ```

### 5. Delete Email Account
- **URL:** `DELETE /email/accounts/{account_id}`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Removes a connected account and its cached emails. Returns `404` if the id doesn't exist.
- **Example Response:**
  ```json
  {
    "status": "deleted"
  }
  ```

### 6. Email Summary (Dashboard)
- **URL:** `GET /email/summary`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Unread counts and recent subjects/senders per connected account. Answered from the local cache populated by the background poller — not a live fetch, so it returns instantly and is safe to poll (every 30–60s is plenty; the backend refreshes every `EMAIL_POLL_INTERVAL_S` = 240s by default).
- **Important — `unread_count` and `recent` do not describe the same set of emails.** Don't build UI that implies they do (e.g. "2,922 unread" above a list of 4 items reading as "here they are"):
  - `unread_count` is the **provider's total unread count** for the whole inbox (Gmail's `INBOX` unread label). It can be in the thousands for a neglected mailbox.
  - `recent` is at most **10 items drawn from the local cache**, and the cache only ever holds the **last 2 days**, up to 25 messages per account — unread *and* read.
  - So `len(recent)` is unrelated to `unread_count`, `recent` contains already-read mail, and most unread mail is not in `recent` at all. A big count with a short list is correct, not a sync bug. Label them separately (e.g. "2,922 unread total" vs. "Last 2 days").
  - There is **no full-inbox sync** and no progress to display; nothing is ever "still importing". Older mail isn't cached — it's fetched live, on demand, by voice search only. There is no REST endpoint for searching older mail.
- **Per-account fields:** `last_poll` is `null` until that account's first poll completes (a few seconds after it's added). `last_error` is `null` when healthy and otherwise holds a short human-readable reason that account's last poll failed (bad password, host unreachable, revoked token) — the other accounts keep working, so surface it per-row rather than as a global banner.
- **Example Response:**
  ```json
  {
    "accounts": [
      {
        "id": "3f9a1c2b4e5d4f6a8b9c0d1e2f3a4b5c",
        "label": "Hostinger Support",
        "provider": "imap",
        "unread_count": 2,
        "last_poll": "2026-07-07T09:40:00+03:00",
        "last_error": null,
        "recent": [
          {
            "subject": "Ticket #4521: Refund request",
            "sender_name": "Jane Doe",
            "sender_email": "jane@example.com",
            "date": "2026-07-07T09:35:00+03:00",
            "unread": true,
            "snippet": "Hi, I'd like to request a refund for..."
          }
        ]
      }
    ],
    "total_unread": 2
  }
  ```

### 7. Pending Contact Address (Read)
- **URL:** `GET /email/pending-contact`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Whether Jarvis is currently waiting for a recipient's email address, and whose. When the voice send flow needs an address it doesn't have in memory, it asks aloud **and** opens this request, so the dashboard can offer a text box instead — email addresses are hard for speech-to-text to get right.
- **Optional by design.** The voice flow never waits on this endpoint. If the dashboard is closed, the boss simply speaks the address and Jarvis spells it back for confirmation. At most one request is open at a time, it expires after 180 seconds, and it is always closed when the conversation ends.
- **Example Response (waiting):**
  ```json
  {"pending": {"name": "Michael", "expires_in": 142}}
  ```
- **Example Response (not waiting):**
  ```json
  {"pending": null}
  ```

### 8. Pending Contact Address (Submit)
- **URL:** `POST /email/pending-contact`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Fulfils the open address request with a typed address. The voice loop picks it up on its next round and uses it verbatim — no spoken read-back is needed, because it wasn't transcribed. Submitting again before it's claimed replaces the value, so a typo caught in time does the right thing.
- **This does not send anything.** The drafted email is still read aloud in full and must be explicitly approved out loud before it leaves the machine. A confirmed address is also saved to that person's entry in memory, so the next email to them needs no spelling.
- **Request Body:**
  ```json
  {"email": "michael@codex.com"}
  ```
- **Example Response (202):**
  ```json
  {"status": "accepted"}
  ```
- **Error Responses:**
  - `400 {"detail": "That doesn't look like a valid email address."}` — malformed. Checked before anything else, so a request that expires mid-flight can never be reported as a bad address.
  - `409 {"detail": "Jarvis isn't waiting for a contact's email address."}` — nothing pending, or the request expired.

## Memory Endpoints

Jarvis's persistent memory of the boss — his `profile`, the `people` he knows, plus `facts` and `events` — read and edited manually from the dashboard's Account tab. This is the same store the voice loop reads from and the background extractor writes to; there is exactly one per process, guarded by its own lock, so an edit here and an extraction merge can't clobber each other.

**Things that trip people up:**

- **Entry ids are opaque and not stable across a delete + re-add.** `people` and `events` carry a stored `id`; a **fact's `id` is derived from its text**, so editing a fact changes its id. Always re-read `GET /memory` after a mutation rather than assuming an id survived.
- **Writes are per-entry, never a whole-document PUT.** That is deliberate: the boss can have an edit form open while a conversation ends and the extractor merges new entries, and per-entry writes mean the two touch different entries.
- **`writable: false` means saves are being refused for this session** — `memory.json` was unreadable at startup and couldn't be quarantined, so the file on disk is being protected. Every mutation then returns `503`. Show this as a banner; do not present the store as editable.
- **Deleting a fact doesn't stop Jarvis re-learning it.** Memory is re-extracted from conversations, so a fact the boss removes can come back if he says it again.
- **Editing the profile marks onboarding complete**, because typing your own profile *is* the onboarding. Without that, the next launch would run voice onboarding and replace everything just typed.

### 1. Get Everything In Memory
- **URL:** `GET /memory`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** The whole store in one call. `profile` is a free-form string map (the canonical keys are `name`, `role`, `key_people`, `priorities`, `preferences`, but onboarding can leave a single `raw_qa` key if it failed to structure the answers, and other keys may exist — render unknown keys rather than dropping them).
- **Example Response:**
  ```json
  {
    "profile": {"name": "Feras", "role": "CEO at CodeX"},
    "people": [{"id": "3f9a1c2b…", "name": "Michael Heckin", "notes": "CTO", "email": "michael@codex.com"}],
    "events": [{"id": "7c8d9e0f…", "description": "Board meeting", "date": "2026-07-20"}],
    "facts": [{"id": "a1b2c3d4e5f6a7b8", "text": "Prefers afternoon meetings."}],
    "onboarding_complete": true,
    "last_updated": "2026-07-19T09:15:00+03:00",
    "writable": true
  }
  ```

### 2. Replace The Profile
- **URL:** `PUT /memory/profile`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Replaces the profile wholesale — **not a merge**, so omitting a key deletes it (that is the only way to remove a key the extractor drifted in). Keys with empty values are dropped. Also sets `onboarding_complete`.
- **Request Body:**
  ```json
  {"profile": {"name": "Feras", "role": "CEO at CodeX", "priorities": "Ship Jarvis"}}
  ```
- **Example Response:** `{"profile": {"name": "Feras", "role": "CEO at CodeX", "priorities": "Ship Jarvis"}}`
- **Error Responses:**
  - `503 {"detail": "Couldn't save to memory. …"}` — saves are refused or the write failed.

### 3. People — Add / Edit / Delete
- **URLs:** `POST /memory/people` · `PATCH /memory/people/{person_id}` · `DELETE /memory/people/{person_id}`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** A person is `{id, name, notes, email}`. `POST` **refuses a duplicate name** (409) rather than silently merging — unlike the voice/extraction path, which merges by name. On `PATCH`, only the fields present are changed; `notes` **replaces** (it does not append, which is what an extraction merge does), and `email: ""` explicitly clears a wrong address.
- **Note — an address typed into `notes` is lifted into `email`.** Consistent with what the store does on restart, so a typed address doesn't appear to move on its own later.
- **Request Body (`POST`):**
  ```json
  {"name": "Michael Heckin", "notes": "CTO", "email": "michael@codex.com"}
  ```
- **Example Response:** `{"person": {"id": "3f9a1c2b…", "name": "Michael Heckin", "notes": "CTO", "email": "michael@codex.com"}}`
- **Error Responses:**
  - `400 {"detail": "A name is required."}` / `400 {"detail": "That doesn't look like a valid email address."}`
  - `404 {"detail": "No saved person with that id."}`
  - `409 {"detail": "Someone with that name is already saved."}` — also on a `PATCH` rename onto an existing name.
  - `503` — see above.

### 4. Facts — Add / Edit / Delete
- **URLs:** `POST /memory/facts` · `PATCH /memory/facts/{fact_id}` · `DELETE /memory/facts/{fact_id}`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** A fact is a plain string, addressed by an id **derived from its text** — so a successful `PATCH` returns a *different* id than the one you sent. Duplicates are refused case-insensitively. Editing preserves list position, because the context summary Jarvis sends to Claude is budgeted recency-first.
- **Request Body:** `{"text": "Prefers afternoon meetings."}`
- **Example Response:** `{"fact": {"id": "a1b2c3d4e5f6a7b8", "text": "Prefers afternoon meetings."}}`
- **Error Responses:** `400` empty · `404` unknown id · `409 {"detail": "Jarvis already remembers that."}` · `503`.

### 5. Events — Add / Edit / Delete
- **URLs:** `POST /memory/events` · `PATCH /memory/events/{event_id}` · `DELETE /memory/events/{event_id}`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** An event is `{id, description, date}`. `date` is free-form text, not a validated date (it holds whatever was said — "2026-07-20", "5pm", or ""). Duplicate descriptions are refused, because `description` is still the key the voice paths match on.
- **Note — an empty `date` on `PATCH` clears it.** The voice paths deliberately never blank a stored date (an empty value there means "didn't hear one"); a person clearing the box means it.
- **Request Body:** `{"description": "Board meeting", "date": "2026-07-20"}`
- **Example Response:** `{"event": {"id": "7c8d9e0f…", "description": "Board meeting", "date": "2026-07-20"}}`
- **Error Responses:** `400` empty description · `404` unknown id · `409` duplicate description · `503`.

### 6. Bulk Import — Preview
- **URL:** `POST /memory/import/preview`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Structures a pasted blob (a contact list, meeting notes) into proposed entries using the background-tier model. **Writes nothing.** The response is meant to be shown in an editable review table; the reviewed rows then go to `/memory/import/commit`.
- **Per-person the preview says what committing would do:** `action` is `"new"` or `"merge"`, `existing_id`/`existing_notes`/`existing_email` describe the entry it would merge into, and `notes_preview` is **exactly** the notes text the merge would produce. Because the merge skips a note already contained in the old one, re-running the same import is a no-op.
- **Addresses are gated, and the gate matters.** An address is kept only if it is well-formed **and** appears in the pasted text — matched against the exact set of addresses found there, not as a substring (a substring test would accept `michael@codex.co` from a source saying `michael@codex.com`). A rejected address is blanked and the row carries `email_status` of `"invalid"` or `"not_in_source"`; surface that so the boss can retype it.
- **Request Body:** `{"text": "Michael Heckin — CTO — michael@codex.com\nSara — design lead"}`
- **Example Response:**
  ```json
  {"preview": {
    "people": [{"name": "Michael Heckin", "notes": "CTO", "email": "michael@codex.com",
                "email_status": "ok", "action": "merge", "existing_id": "3f9a1c2b…",
                "existing_notes": "Runs infra", "existing_email": "",
                "notes_preview": "Runs infra; CTO", "merged_from_rows": 1}],
    "facts": [], "events": [],
    "warnings": ["1 email address(es) were removed because they don't appear in the text you pasted."]
  }}
  ```
- **Error Responses:**
  - `400 {"detail": "That text is too long to process at once. …"}` — over the paste cap.
  - `400 {"detail": "That list was too long to process in one go. …"}` — the model ran out of output tokens mid-list; split the paste.
  - `400 {"detail": "There's nothing to import."}`
  - `502 {"detail": "Couldn't make sense of that text. …"}`

### 7. Bulk Import — Commit
- **URL:** `POST /memory/import/commit`
- **Auth:** Requires `Authorization: Bearer <token>`; returns `401` otherwise.
- **Description:** Writes the reviewed rows. Takes **only the rows** — never the raw text — and never calls a model, so what the boss approved is exactly what is stored. People merge by name (notes appended, an empty email slot filled); set `replace_email: true` on a row to overwrite an address the person already had. Facts and events dedup as they do everywhere else. The whole batch is one write.
- **Note — addresses here are validated for shape only.** The in-the-source check can't apply, because a row the boss corrected in the review table legitimately isn't in the paste any more. This is the same trust level as `POST /email/pending-contact`: a typed address is used as typed.
- **Request Body:**
  ```json
  {
    "people": [{"name": "Michael Heckin", "notes": "CTO", "email": "michael@codex.com", "replace_email": false}],
    "facts": ["Allergic to peanuts."],
    "events": [{"description": "Q3 review", "date": "2026-09-01"}]
  }
  ```
- **Example Response:**
  ```json
  {"result": {"people_created": 1, "people_merged": 0, "facts_added": 1,
              "facts_skipped": 0, "events_added": 1, "events_updated": 0}}
  ```
- **Error Responses:** `503` — see above.

## WebSocket Events

- **URL:** `ws://localhost:8000/events?token=<token>`
- **Auth:** The API token must be passed as the `token` query param; a missing or wrong token rejects the handshake (close code 1008 / HTTP 403).
- **Connection:** Connect to this endpoint to receive real-time events broadcast by the assistant.

### Event Types

All events are broadcast as JSON objects containing an `"event"` field and any associated payload data.

| Event | Description | Payload Example |
|---|---|---|
| `wake_word_detected` | Fired when the wake word is detected. | `{"event": "wake_word_detected"}` |
| `listening_started` | Fired when the microphone starts recording. | `{"event": "listening_started"}` |
| `transcription` | Fired when the user's input is ready — speech-to-text finishing, **or** a typed message being picked up. `source` is `"voice"` (default when absent) or `"typed"`. | `{"event": "transcription", "text": "Hello Jarvis", "source": "voice"}` |
| `llm_response` | Fired when Claude finishes generating a reply. | `{"event": "llm_response", "text": "Hello! How can I help you today?"}` |
| `speaking_started` | Fired when text-to-speech audio starts playing. | `{"event": "speaking_started"}` |
| `speaking_ended` | Fired when text-to-speech audio finishes playing. | `{"event": "speaking_ended"}` |
| `idle` | Fired when the conversation cycle resets. | `{"event": "idle"}` |
| `error` | Fired when a component dies unrecoverably (currently: the wake-word microphone failed to open or died mid-stream). The same string is available via `GET /status` as `error`. | `{"event": "error", "message": "wake word detector: microphone failed to open: ..."}` |
| `contact_email_requested` | Fired when the voice send flow needs a recipient's email address and has opened a pending request. Cue to show a text box wired to `POST /email/pending-contact`. | `{"event": "contact_email_requested", "name": "Michael"}` |
| `contact_email_resolved` | Fired when that request ends. `source` is `"voice"` (spoken and confirmed), `"typed"` (submitted from the dashboard), or `"cancelled"` (never supplied — nothing was sent). Cue to hide the text box. | `{"event": "contact_email_resolved", "source": "typed"}` |

**Note — sending email:** there are no events for drafting, confirming, or sending. The whole exchange — "here's what I've got…", "should I send it?", "sent to Michael" — flows through the ordinary `llm_response` → `speaking_started` → `speaking_ended` → `listening_started` → `transcription` sequence, so a transcript view shows it with no special handling. The two `contact_email_*` events above are the only additions, and they exist solely so the dashboard can offer typing as an alternative to speaking an address.

**Note — typed messages:** a message sent with `POST /message` produces the same event sequence as a spoken turn, with two differences a frontend should expect. It carries `source: "typed"` on its `transcription` event. And it may produce **no `listening_started`** at all: when the message was already waiting, Jarvis never opens the microphone, so claiming he was "listening" would be false — don't rely on `listening_started` as a guaranteed precursor to `transcription`. When speech and a typed message arrive at nearly the same moment, the speech wins that turn and the typed message is used for the next one, so a message is never silently dropped. While muted, `speaking_started`/`speaking_ended` still fire with no audio.

**Note — proactive email announcements:** no new event types were added for these. When the background email poller finds new mail and Jarvis is idle, it speaks a nudge (e.g. "Hey, you've got 3 new emails…") using the same `llm_response` → `speaking_started` → `speaking_ended` sequence as a normal reply, followed immediately by the usual `listening_started`/`transcription`/... cycle for whatever the boss says next — exactly as if "Hey Jarvis" had just been said. The only difference a frontend can key off is that this `llm_response` has **no preceding `wake_word_detected`** event. Dashboards should poll `GET /email/summary` for email state rather than relying on WebSocket events.

### Quick Start: Connecting via JavaScript

The following snippet demonstrates how a frontend application (like Electron) can connect to the WebSocket and handle events.

```javascript
const JARVIS_API_TOKEN = "<value of JARVIS_API_TOKEN from the backend .env>";
const ws = new WebSocket(`ws://localhost:8000/events?token=${JARVIS_API_TOKEN}`);

ws.onopen = () => {
    console.log("Connected to Jarvis events WebSocket.");
};

ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    
    switch(data.event) {
        case "wake_word_detected":
            console.log("Wake word detected! Getting ready...");
            break;
            
        case "listening_started":
            console.log("Jarvis is listening...");
            break;
            
        case "transcription":
            console.log("You said:", data.text);
            break;
            
        case "llm_response":
            console.log("Jarvis says:", data.text);
            break;
            
        case "speaking_started":
            console.log("Jarvis is speaking...");
            break;
            
        case "speaking_ended":
            console.log("Jarvis finished speaking.");
            break;
            
        case "idle":
            console.log("Jarvis is now idle and waiting for the wake word.");
            break;
            
        case "error":
            console.error("Jarvis component failure:", data.message);
            break;
            
        default:
            console.log("Unknown event received:", data);
    }
};

ws.onclose = () => {
    console.log("Disconnected from Jarvis.");
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};
```
