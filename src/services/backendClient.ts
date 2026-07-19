import type { VoiceState } from './types'
import type {
  EmailAccount,
  EmailSummaryResponse,
  GmailOAuthUrlResponse,
  ImapAccountRequest,
  MemoryEvent,
  MemoryFact,
  MemoryImportCommitRequest,
  MemoryImportPreview,
  MemoryImportResult,
  MemoryPerson,
  MemoryProfile,
  MemorySnapshot
} from './types'

export type JarvisEventType =
  | 'wake_word_detected'
  | 'listening_started'
  | 'transcription'
  | 'llm_response'
  | 'speaking_started'
  | 'speaking_ended'
  | 'idle'
  | 'models_ready'
  | 'contact_email_requested'
  | 'contact_email_resolved'

export interface JarvisBackendEvent {
  event: JarvisEventType
  text?: string
  name?: string
  source?: string
}

export interface HealthResponse {
  status: string
  service: string
  assistant_running?: boolean
  assistant_starting?: boolean
  models_ready?: boolean
  state?: string
}

export interface StatusResponse {
  running: boolean
  state: string
  error?: string | null
}

const STORAGE_URL_KEY = 'jarvis_api_url'
const STORAGE_TOKEN_KEY = 'jarvis_api_token'

export function getStoredApiUrl(): string | null {
  return localStorage.getItem(STORAGE_URL_KEY)
}

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN_KEY)
}

export function setStoredCredentials(apiUrl: string, token: string): void {
  localStorage.setItem(STORAGE_URL_KEY, apiUrl.replace(/\/$/, ''))
  localStorage.setItem(STORAGE_TOKEN_KEY, token)
}

export function clearStoredCredentials(): void {
  localStorage.removeItem(STORAGE_URL_KEY)
  localStorage.removeItem(STORAGE_TOKEN_KEY)
}

export function getApiBaseUrl(): string {
  const stored = getStoredApiUrl()
  if (stored) return stored
  if (import.meta.env.VITE_API_BASE_URL) {
    return (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '')
  }
  if (window.jarvis?.backend?.url) {
    return window.jarvis.backend.url.replace(/\/$/, '')
  }
  return 'http://127.0.0.1:8000'
}

export function getToken(): string {
  const stored = getStoredToken()
  if (stored) return stored
  if (import.meta.env.VITE_JARVIS_TOKEN) {
    return import.meta.env.VITE_JARVIS_TOKEN as string
  }
  return window.jarvis?.backend?.token ?? ''
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getWsUrl(): string {
  const base = getApiBaseUrl()
  const wsBase = base.replace(/^http/, 'ws') + '/events'
  const token = getToken()
  return token ? `${wsBase}?token=${encodeURIComponent(token)}` : wsBase
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (data?.detail) return typeof data.detail === 'string' ? data.detail : fallback
  } catch {
    // non-JSON body
  }
  return fallback
}

export function mapBackendState(state: string): VoiceState {
  switch (state) {
    case 'listening':
      return 'listening'
    case 'thinking':
      return 'processing'
    case 'speaking':
      return 'speaking'
    default:
      return 'idle'
  }
}

export function voiceStateFromEvent(
  event: JarvisEventType,
  current: VoiceState
): VoiceState {
  switch (event) {
    case 'wake_word_detected':
    case 'listening_started':
      return 'listening'
    case 'transcription':
    case 'llm_response':
      return 'processing'
    case 'speaking_started':
      return 'speaking'
    case 'speaking_ended':
      return current === 'speaking' ? 'listening' : current
    case 'models_ready':
      return current
    case 'idle':
      return 'idle'
    default:
      return current
  }
}

class BackendClient {
  private ws: WebSocket | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private eventListeners = new Set<(event: JarvisBackendEvent) => void>()
  private connectionListeners = new Set<(connected: boolean) => void>()
  private intentionalClose = false

  onEvent(cb: (event: JarvisBackendEvent) => void): () => void {
    this.eventListeners.add(cb)
    return () => this.eventListeners.delete(cb)
  }

  onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connectionListeners.add(cb)
    return () => this.connectionListeners.delete(cb)
  }

  private emitEvent(event: JarvisBackendEvent): void {
    this.eventListeners.forEach((cb) => cb(event))
  }

  private emitConnection(connected: boolean): void {
    this.connectionListeners.forEach((cb) => cb(connected))
  }

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${getApiBaseUrl()}/health`)
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
    return res.json()
  }

  async status(): Promise<StatusResponse> {
    const res = await fetch(`${getApiBaseUrl()}/status`)
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
    return res.json()
  }

  async validateToken(apiUrl: string, token: string): Promise<void> {
    const base = apiUrl.replace(/\/$/, '')
    const healthRes = await fetch(`${base}/health`)
    if (!healthRes.ok) throw new Error('Backend unreachable — check the URL.')

    const res = await fetch(`${base}/email/accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.status === 401) throw new Error('Invalid API token.')
    if (!res.ok) throw new Error(`Auth check failed: ${res.status}`)
  }

  async start(): Promise<{ status: string }> {
    const res = await fetch(`${getApiBaseUrl()}/start`, { method: 'POST', headers: authHeaders() })
    if (!res.ok) throw new Error(`Start failed: ${res.status}`)
    return res.json()
  }

  async stop(): Promise<{ status: string }> {
    const res = await fetch(`${getApiBaseUrl()}/stop`, { method: 'POST', headers: authHeaders() })
    if (!res.ok) throw new Error(`Stop failed: ${res.status}`)
    return res.json()
  }

  async listEmailAccounts(): Promise<EmailAccount[]> {
    const res = await fetch(`${getApiBaseUrl()}/email/accounts`, { headers: authHeaders() })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to list accounts: ${res.status}`))
    const data = await res.json()
    return data.accounts ?? []
  }

  async addImapAccount(body: ImapAccountRequest): Promise<EmailAccount> {
    const res = await fetch(`${getApiBaseUrl()}/email/accounts/imap`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to add account: ${res.status}`))
    const data = await res.json()
    return data.account
  }

  async getGmailOAuthUrl(): Promise<GmailOAuthUrlResponse> {
    const res = await fetch(`${getApiBaseUrl()}/email/accounts/gmail/oauth-url`, {
      headers: authHeaders()
    })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Gmail OAuth failed: ${res.status}`))
    return res.json()
  }

  async deleteEmailAccount(id: string): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/email/accounts/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to delete account: ${res.status}`))
  }

  async getEmailSummary(): Promise<EmailSummaryResponse> {
    const res = await fetch(`${getApiBaseUrl()}/email/summary`, { headers: authHeaders() })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to fetch summary: ${res.status}`))
    return res.json()
  }

  async submitContactEmail(email: string): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/email/pending-contact`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, `Request failed: ${res.status}`))
    }
  }

  /**
   * Hand Jarvis a typed message. Queued, not answered inline — the reply
   * arrives over the WebSocket as the usual transcription -> llm_response pair,
   * so there is nothing to render from the return value.
   */
  async sendMessage(text: string): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/message`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to send message: ${res.status}`))
  }

  /** Turn Jarvis's spoken replies off or on (he still answers in the transcript). */
  async setMuted(muted: boolean): Promise<boolean> {
    const res = await fetch(`${getApiBaseUrl()}/speech/mute`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted })
    })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to change speech: ${res.status}`))
    const data = await res.json()
    return !!data.muted
  }

  async getPendingContact(): Promise<{ name: string } | null> {
    const res = await fetch(`${getApiBaseUrl()}/email/pending-contact`, { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    return data?.pending ? { name: data.pending.name ?? '' } : null
  }

  // ── Memory (Account tab) ───────────────────────────────────────────────────
  // Every write is per-entry on purpose: an edit here and a background memory
  // extraction then touch different entries and can't clobber each other. Always
  // re-read getMemory() after a mutation rather than patching local state.

  private async memoryWrite(path: string, method: string, body?: unknown): Promise<any> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Memory update failed: ${res.status}`))
    return res.status === 204 ? null : res.json()
  }

  async getMemory(): Promise<MemorySnapshot> {
    const res = await fetch(`${getApiBaseUrl()}/memory`, { headers: authHeaders() })
    if (!res.ok) throw new Error(await parseErrorDetail(res, `Failed to load memory: ${res.status}`))
    return res.json()
  }

  async updateMemoryProfile(profile: MemoryProfile): Promise<MemoryProfile> {
    const data = await this.memoryWrite('/memory/profile', 'PUT', { profile })
    return data.profile
  }

  async addMemoryPerson(body: {
    name: string
    notes?: string
    email?: string
  }): Promise<MemoryPerson> {
    const data = await this.memoryWrite('/memory/people', 'POST', body)
    return data.person
  }

  async updateMemoryPerson(
    id: string,
    body: { name?: string; notes?: string; email?: string }
  ): Promise<MemoryPerson> {
    const data = await this.memoryWrite(`/memory/people/${id}`, 'PATCH', body)
    return data.person
  }

  async deleteMemoryPerson(id: string): Promise<void> {
    await this.memoryWrite(`/memory/people/${id}`, 'DELETE')
  }

  async addMemoryFact(text: string): Promise<MemoryFact> {
    const data = await this.memoryWrite('/memory/facts', 'POST', { text })
    return data.fact
  }

  async updateMemoryFact(id: string, text: string): Promise<MemoryFact> {
    const data = await this.memoryWrite(`/memory/facts/${id}`, 'PATCH', { text })
    return data.fact
  }

  async deleteMemoryFact(id: string): Promise<void> {
    await this.memoryWrite(`/memory/facts/${id}`, 'DELETE')
  }

  async addMemoryEvent(body: { description: string; date?: string }): Promise<MemoryEvent> {
    const data = await this.memoryWrite('/memory/events', 'POST', body)
    return data.event
  }

  async updateMemoryEvent(
    id: string,
    body: { description?: string; date?: string }
  ): Promise<MemoryEvent> {
    const data = await this.memoryWrite(`/memory/events/${id}`, 'PATCH', body)
    return data.event
  }

  async deleteMemoryEvent(id: string): Promise<void> {
    await this.memoryWrite(`/memory/events/${id}`, 'DELETE')
  }

  /** Structures pasted text into proposed entries. Writes nothing. */
  async previewMemoryImport(text: string): Promise<MemoryImportPreview> {
    const data = await this.memoryWrite('/memory/import/preview', 'POST', { text })
    return data.preview
  }

  /** Writes the REVIEWED rows — never the raw text, never re-parsed. */
  async commitMemoryImport(body: MemoryImportCommitRequest): Promise<MemoryImportResult> {
    const data = await this.memoryWrite('/memory/import/commit', 'POST', body)
    return data.result
  }

  connect(): void {
    this.intentionalClose = false
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    const ws = new WebSocket(getWsUrl())
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.emitConnection(true)
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 30000)
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as JarvisBackendEvent
        if (data.event) this.emitEvent(data)
      } catch {
        // ignore non-JSON frames
      }
    }

    ws.onclose = () => {
      this.clearPing()
      this.emitConnection(false)
      if (!this.intentionalClose) this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.clearReconnect()
    this.clearPing()
    this.ws?.close()
    this.ws = null
    this.emitConnection(false)
  }

  private scheduleReconnect(): void {
    this.clearReconnect()
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}

export const backendClient = new BackendClient()
