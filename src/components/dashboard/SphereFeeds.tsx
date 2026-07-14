import { useEffect, useRef, type ComponentType, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare,
  Activity,
  Radio,
  BarChart3,
  Mic,
  Power,
  PowerOff
} from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { HudButton } from '@/components/ui/HudButton'
import { useBackend, useTurnCount } from '@/context/BackendContext'
import type { TranscriptEntry } from '@/context/BackendContext'

function FeedScroller({
  icon: Icon,
  items,
  emptyLabel
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  items: ReactNode[]
  emptyLabel: string
}) {
  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <Icon size={20} className="text-[var(--text-meta)]" strokeWidth={1.5} />
        </div>
        <p className="text-xs text-[var(--text-meta)] text-center px-6 max-w-[200px] leading-relaxed">
          {emptyLabel}
        </p>
      </div>
    )
  }

  return <div className="h-full overflow-y-auto space-y-2 pr-1">{items}</div>
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === 'user'
  const time = entry.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg ${
        isUser
          ? 'bg-[rgba(56,189,248,0.06)] border border-[rgba(56,189,248,0.12)]'
          : 'bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.12)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            isUser ? 'text-[var(--cyan)]' : 'text-[var(--purple)]'
          }`}
        >
          {isUser ? 'You' : 'Jarvis'}
        </span>
        <span className="hud-meta text-[10px]">{time}</span>
      </div>
      <p className="hud-body text-[var(--text-secondary)]">{entry.text}</p>
    </motion.div>
  )
}

export function ConversationTranscriptPanel() {
  const { transcript } = useBackend()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript])

  return (
    <GlassPanel
      title="Conversation"
      className="h-full"
      accent="cyan"
      delay={0.05}
      panelId="CONV"
      headerExtra={
        transcript.length > 0 ? (
          <span className="text-[10px] text-[var(--text-meta)] font-mono-hud">
            {transcript.length}
          </span>
        ) : null
      }
    >
      <div ref={scrollRef} className="h-full overflow-y-auto pr-1">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
              <MessageSquare size={20} className="text-[var(--text-meta)]" strokeWidth={1.5} />
            </div>
            <p className="text-xs text-[var(--text-meta)] text-center px-6 max-w-[220px] leading-relaxed">
              Say &quot;Hey Jarvis&quot; to start a conversation
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transcript.map((entry) => (
              <TranscriptBubble key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  )
}

const connectionBadge = {
  online: { label: 'Connected', pill: 'status-pill--online', dot: 'bg-[var(--green)]' },
  reconnecting: { label: 'Reconnecting', pill: 'status-pill--warning', dot: 'bg-[var(--yellow)]' },
  offline: { label: 'Disconnected', pill: 'status-pill--offline', dot: 'bg-[var(--red)]' }
} as const

export function BackendStatusPanel() {
  const { connected, reconnecting, running, voiceState, error, startAssistant, stopAssistant } =
    useBackend()

  const connKey = connected ? 'online' : reconnecting ? 'reconnecting' : 'offline'
  const badge = connectionBadge[connKey]

  return (
    <GlassPanel title="System Status" className="h-full" delay={0.1} panelId="STATUS">
      <div className="h-full flex flex-col gap-4">
        <span className={`status-pill ${badge.pill} w-fit`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${connected ? 'pulse-dot' : ''}`} />
          {badge.label}
        </span>

        <div className="space-y-0.5 rounded-lg border border-[var(--border)] overflow-hidden">
          <StatusRow label="Assistant" value={running ? 'Running' : 'Stopped'} highlight={running} />
          <StatusRow label="Voice" value={voiceState} />
          <StatusRow label="Wake word" value="Hey Jarvis" />
          <StatusRow label="Speech" value="faster-whisper" />
          <StatusRow label="Model" value="Claude" />
          <ModelsReadyRow />
        </div>

        {error && (
          <p className="text-xs text-[var(--red)] leading-relaxed px-1">{error}</p>
        )}

        <div className="mt-auto flex gap-2">
          <HudButton
            variant="primary"
            onClick={() => void startAssistant()}
            disabled={!connected || running}
            className="flex-1"
            icon={Power}
          >
            Start
          </HudButton>
          <HudButton
            onClick={() => void stopAssistant()}
            disabled={!connected || !running}
            className="flex-1"
            icon={PowerOff}
          >
            Stop
          </HudButton>
        </div>
      </div>
    </GlassPanel>
  )
}

function StatusRow({
  label,
  value,
  highlight
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border)] last:border-b-0">
      <span className="text-xs text-[var(--text-meta)]">{label}</span>
      <span
        className={`text-xs font-medium capitalize ${
          highlight ? 'text-[var(--green)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function ModelsReadyRow() {
  const { modelsReady, running } = useBackend()
  const value = !running ? '—' : modelsReady ? 'Ready' : 'Loading…'
  return <StatusRow label="TTS / STT" value={value} highlight={modelsReady && running} />
}

const eventIcons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  wake_word_detected: Mic,
  listening_started: Mic,
  transcription: MessageSquare,
  llm_response: MessageSquare,
  speaking_started: Radio,
  speaking_ended: Radio,
  idle: Activity
}

export function VoiceEventsPanel() {
  const { recentEvents } = useBackend()

  return (
    <GlassPanel title="Activity" className="h-full" accent="purple" delay={0.15} panelId="EVENTS">
      <FeedScroller
        icon={Radio}
        emptyLabel="Voice events will appear here as you interact with Jarvis"
        items={recentEvents.map((evt) => {
          const Icon = eventIcons[evt.event] ?? Activity
          const time = evt.timestamp.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[rgba(167,139,250,0.1)]">
                <Icon size={13} className="text-[var(--purple)]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--text-primary)] leading-snug line-clamp-2">
                  {evt.label}
                </p>
                <p className="hud-meta text-[10px] mt-1">{time}</p>
              </div>
            </motion.div>
          )
        })}
      />
    </GlassPanel>
  )
}

export function SessionSummaryPanel() {
  const { transcript } = useBackend()
  const turnCount = useTurnCount()

  const lastUser = [...transcript].reverse().find((t) => t.role === 'user')
  const lastAssistant = [...transcript].reverse().find((t) => t.role === 'assistant')

  return (
    <GlassPanel title="Session" className="h-full" delay={0.2} panelId="SESSION">
      <div className="h-full flex flex-col gap-4">
        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
          <span className="text-xs text-[var(--text-meta)]">Turns</span>
          <span className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
            {turnCount}
          </span>
        </div>

        <SummaryBlock label="Last input" text={lastUser?.text} empty="No input yet" />
        <SummaryBlock label="Last response" text={lastAssistant?.text} empty="No response yet" />
      </div>
    </GlassPanel>
  )
}

function SummaryBlock({
  label,
  text,
  empty
}: {
  label: string
  text?: string
  empty: string
}) {
  return (
    <div className="flex-1 min-h-0 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={12} className="text-[var(--purple)]" strokeWidth={1.75} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-meta)]">
          {label}
        </span>
      </div>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4">
        {text ?? empty}
      </p>
    </div>
  )
}
