import { motion } from 'framer-motion'
import { Mic, Sparkles } from 'lucide-react'
import type { VoiceState } from '@/services/types'
import { useBackend } from '@/context/BackendContext'
import { useVoiceActions } from '@/hooks/useVoiceState'
import { VoiceWaveformCanvas } from './VoiceWaveformCanvas'

interface TalkToJarvisBarProps {
  state: VoiceState
}

const stateLabel: Record<VoiceState, string> = {
  idle: 'Say "Hey Jarvis" or press Ctrl + Space',
  listening: 'Listening for your command…',
  processing: 'Processing your request…',
  speaking: 'Jarvis is speaking…'
}

const stateStyles: Record<VoiceState, string> = {
  idle: 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--cyan-dim)] hover:bg-[var(--bg-surface-hover)]',
  listening: 'border-[var(--cyan)] bg-[rgba(56,189,248,0.08)] talk-glow',
  processing: 'border-[var(--yellow)] bg-[rgba(251,191,36,0.06)]',
  speaking: 'border-[var(--purple)] bg-[rgba(167,139,250,0.08)]'
}

export function TalkToJarvisBar({ state }: TalkToJarvisBarProps) {
  const { connected, error } = useBackend()
  const { toggleListening } = useVoiceActions()

  const label = !connected
    ? 'Backend offline — reconnecting…'
    : error
      ? error
      : stateLabel[state]

  return (
    <motion.button
      type="button"
      onClick={toggleListening}
      disabled={!connected}
      className={`no-drag w-full max-w-4xl mx-auto flex items-center gap-5 px-5 py-3.5 rounded-xl border transition-all ${
        !connected
          ? 'border-[var(--red)]/30 bg-[rgba(248,113,113,0.06)] opacity-60 cursor-not-allowed'
          : stateStyles[state]
      }`}
      whileHover={connected ? { y: -1 } : undefined}
      whileTap={connected ? { scale: 0.995 } : undefined}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
          state === 'speaking'
            ? 'border-[var(--purple)]/40 bg-[rgba(167,139,250,0.12)]'
            : state === 'listening'
              ? 'border-[var(--cyan)]/40 bg-[rgba(56,189,248,0.12)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)]'
        }`}
      >
        {state === 'processing' ? (
          <Sparkles size={18} className="text-[var(--yellow)]" />
        ) : (
          <Mic
            size={18}
            className={
              state === 'speaking'
                ? 'text-[var(--purple)]'
                : state === 'listening'
                  ? 'text-[var(--cyan)]'
                  : 'text-[var(--text-secondary)]'
            }
          />
        )}
      </div>

      <div className="flex flex-col items-start min-w-0 flex-1">
        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          Voice Assistant
        </span>
        <span className="text-xs text-[var(--text-meta)] mt-0.5 truncate max-w-full">{label}</span>
      </div>

      <div className="hidden sm:block w-48 lg:w-64 h-10 shrink-0 opacity-80">
        <VoiceWaveformCanvas state={state} />
      </div>
    </motion.button>
  )
}
