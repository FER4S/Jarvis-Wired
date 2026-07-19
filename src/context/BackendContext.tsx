import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  backendClient,
  mapBackendState,
  voiceStateFromEvent,
  type JarvisBackendEvent,
  type JarvisEventType
} from '@/services/backendClient'
import { voiceService } from '@/services/voiceService'
import { getStoredMuted, setStoredMuted } from '@/services/speech'
import type { VoiceState } from '@/services/types'

export interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

export interface VoiceEventEntry {
  id: string
  event: JarvisEventType
  label: string
  timestamp: Date
}

interface BackendContextValue {
  connected: boolean
  reconnecting: boolean
  running: boolean
  modelsReady: boolean
  voiceState: VoiceState
  transcript: TranscriptEntry[]
  recentEvents: VoiceEventEntry[]
  error: string | null
  pendingContact: { name: string } | null
  muted: boolean
  toggleAssistant: () => Promise<void>
  startAssistant: () => Promise<void>
  stopAssistant: () => Promise<void>
  submitContactEmail: (email: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  setMuted: (muted: boolean) => Promise<void>
}

const BackendContext = createContext<BackendContextValue | null>(null)

const MAX_EVENTS = 20
// Enough to scroll back through a real conversation. This was 2, which made the
// transcript a two-line window — fine when the only input was voice, useless now
// that it doubles as a chat log.
const MAX_TRANSCRIPT = 50

function formatEventLabel(event: JarvisBackendEvent): string {
  switch (event.event) {
    case 'wake_word_detected':
      return 'Wake word detected'
    case 'listening_started':
      return 'Listening started'
    case 'transcription':
      return `You said: "${event.text ?? ''}"`
    case 'llm_response':
      return `Jarvis: "${event.text ?? ''}"`
    case 'speaking_started':
      return 'Speaking started'
    case 'speaking_ended':
      return 'Speaking ended'
    case 'idle':
      return 'Returned to idle'
    case 'models_ready':
      return 'Speech models loaded'
    case 'contact_email_requested':
      return `Email address requested${event.name ? ` for ${event.name}` : ''}`
    case 'contact_email_resolved':
      return `Email address ${event.source ?? 'resolved'}`
    default:
      return 'Unknown event'
  }
}

export function BackendProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [running, setRunning] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [recentEvents, setRecentEvents] = useState<VoiceEventEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingContact, setPendingContact] = useState<{ name: string } | null>(null)
  const [muted, setMutedState] = useState(getStoredMuted)
  const voiceStateRef = useRef<VoiceState>('idle')

  const pushEvent = useCallback((event: JarvisBackendEvent) => {
    setRecentEvents((prev) => {
      const entry: VoiceEventEntry = {
        id: `${Date.now()}-${event.event}`,
        event: event.event,
        label: formatEventLabel(event),
        timestamp: new Date()
      }
      return [entry, ...prev].slice(0, MAX_EVENTS)
    })
  }, [])

  const handleBackendEvent = useCallback(
    (event: JarvisBackendEvent) => {
      pushEvent(event)

      const nextState = voiceStateFromEvent(event.event, voiceStateRef.current)
      voiceStateRef.current = nextState
      setVoiceState(nextState)
      voiceService.syncState(nextState)

      if (event.event === 'transcription' && event.text) {
        setTranscript((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}-${prev.length}`,
            role: 'user' as const,
            text: event.text!,
            timestamp: new Date()
          }
        ].slice(-MAX_TRANSCRIPT))
      }

      if (event.event === 'llm_response' && event.text) {
        setTranscript((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}-${prev.length}`,
            role: 'assistant' as const,
            text: event.text!,
            timestamp: new Date()
          }
        ].slice(-MAX_TRANSCRIPT))
      }

      if (event.event === 'models_ready') {
        setModelsReady(true)
      }

      if (event.event === 'contact_email_requested') {
        setPendingContact({ name: event.name ?? '' })
      }

      if (event.event === 'contact_email_resolved') {
        setPendingContact(null)
      }
    },
    [pushEvent]
  )

  const refreshStatus = useCallback(async () => {
    try {
      const status = await backendClient.status()
      setRunning(status.running)
      const health = await backendClient.health()
      setModelsReady(health.models_ready ?? false)
      const mapped = mapBackendState(status.state)
      voiceStateRef.current = mapped
      setVoiceState(mapped)
      voiceService.syncState(mapped)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    }
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      const health = await backendClient.health()
      setRunning(health.assistant_running ?? false)
      setModelsReady(health.models_ready ?? false)
      if (health.state) {
        const mapped = mapBackendState(health.state)
        voiceStateRef.current = mapped
        setVoiceState(mapped)
        voiceService.syncState(mapped)
      }
      // main.py auto-starts the assistant; only POST /start if still not running
      if (!health.assistant_running) {
        const result = await backendClient.start()
        if (result.status === 'started') {
          // Poll until models finish loading
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 2000))
            const h = await backendClient.health()
            if (h.assistant_running) {
              setRunning(true)
              break
            }
          }
        }
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backend unavailable')
    }
  }, [])

  useEffect(() => {
    bootstrap()
    backendClient.connect()

    const unsubEvent = backendClient.onEvent(handleBackendEvent)
    const unsubConn = backendClient.onConnectionChange((isConnected) => {
      setConnected(isConnected)
      setReconnecting(!isConnected)
      if (isConnected) {
        void bootstrap()
        void refreshStatus()
        void backendClient.getPendingContact().then(setPendingContact)
        // The backend starts every process unmuted, so push the stored
        // preference back at it on each (re)connect.
        const preferred = getStoredMuted()
        if (preferred) void backendClient.setMuted(true).catch(() => undefined)
        setMutedState(preferred)
        setError(null)
      }
    })

    return () => {
      unsubEvent()
      unsubConn()
      backendClient.disconnect()
    }
  }, [bootstrap, handleBackendEvent, refreshStatus])

  const startAssistant = useCallback(async () => {
    try {
      await backendClient.start()
      setRunning(true)
      await refreshStatus()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assistant')
    }
  }, [refreshStatus])

  const stopAssistant = useCallback(async () => {
    try {
      await backendClient.stop()
      setRunning(false)
      voiceStateRef.current = 'idle'
      setVoiceState('idle')
      voiceService.syncState('idle')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop assistant')
    }
  }, [])

  const submitContactEmail = useCallback(async (email: string) => {
    await backendClient.submitContactEmail(email)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    // No optimistic echo: the backend answers with a `transcription` event,
    // which is what renders the user bubble. Echoing here would double it.
    await backendClient.sendMessage(text)
  }, [])

  const setMuted = useCallback(async (next: boolean) => {
    // Store the preference first so it survives even if the backend is down.
    setStoredMuted(next)
    setMutedState(next)
    try {
      await backendClient.setMuted(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change speech setting')
    }
  }, [])

  const toggleAssistant = useCallback(async () => {
    if (running) await stopAssistant()
    else await startAssistant()
  }, [running, startAssistant, stopAssistant])

  const value = useMemo<BackendContextValue>(
    () => ({
      connected,
      reconnecting,
      running,
      modelsReady,
      voiceState,
      transcript,
      recentEvents,
      error,
      pendingContact,
      muted,
      toggleAssistant,
      startAssistant,
      stopAssistant,
      submitContactEmail,
      sendMessage,
      setMuted
    }),
    [
      connected,
      reconnecting,
      running,
      modelsReady,
      voiceState,
      transcript,
      recentEvents,
      error,
      pendingContact,
      muted,
      toggleAssistant,
      startAssistant,
      stopAssistant,
      submitContactEmail,
      sendMessage,
      setMuted
    ]
  )

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
}

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error('useBackend must be used within BackendProvider')
  return ctx
}

export function useTurnCount(): number {
  const { transcript } = useBackend()
  return transcript.filter((t) => t.role === 'user').length
}
