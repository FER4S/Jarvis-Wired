import type { VoiceState } from './types'

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
}

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  }
  if (window.jarvis?.backend?.url) {
    return window.jarvis.backend.url.replace(/\/$/, '')
  }
  return 'http://127.0.0.1:8000'
}

export function getToken(): string {
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

  /** Submit a typed recipient address to fulfil an open contact request. */
  async submitContactEmail(email: string): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/email/pending-contact`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    if (!res.ok) {
      let detail = `Request failed: ${res.status}`
      try {
        const data = await res.json()
        if (data?.detail) detail = data.detail
      } catch {
        // non-JSON error body — keep the generic message
      }
      throw new Error(detail)
    }
  }

  /** Whether the voice flow is currently waiting for a recipient's address (reconnect resilience). */
  async getPendingContact(): Promise<{ name: string } | null> {
    const res = await fetch(`${getApiBaseUrl()}/email/pending-contact`, { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    return data?.pending ? { name: data.pending.name ?? '' } : null
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
