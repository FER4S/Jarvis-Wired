import { Mic } from 'lucide-react'
import { motion } from 'framer-motion'
import type { VoiceState } from '@/services/types'
import { useVoiceActions } from '@/hooks/useVoiceState'

interface MicButtonProps {
  state: VoiceState
  size?: 'sm' | 'lg'
}

const stateRing: Record<VoiceState, string> = {
  idle: 'border-[var(--cyan-dim)]',
  listening: 'border-[var(--cyan)] glow-border-cyan',
  processing: 'border-[var(--yellow)]',
  speaking: 'border-[var(--purple)]'
}

const stateBg: Record<VoiceState, string> = {
  idle: 'bg-[rgba(0,212,255,0.05)]',
  listening: 'bg-[rgba(0,212,255,0.18)]',
  processing: 'bg-[rgba(255,170,0,0.12)]',
  speaking: 'bg-[rgba(170,102,255,0.12)]'
}

export function MicButton({ state, size = 'lg' }: MicButtonProps) {
  const { toggleListening } = useVoiceActions()
  const isActive = state !== 'idle'
  const dim = size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'
  const iconSize = size === 'lg' ? 24 : 18

  const label =
    state === 'listening'
      ? 'Listening...'
      : state === 'processing'
        ? 'Processing...'
        : state === 'speaking'
          ? 'Speaking...'
          : 'Tap to Speak'

  return (
    <button
      onClick={toggleListening}
      className="relative no-drag flex flex-col items-center gap-2"
      aria-label={isActive ? 'Stop listening' : 'Tap to speak'}
    >
      {state === 'listening' && (
        <>
          <span className="absolute inset-0 rounded-full border border-[var(--cyan)] pulse-ring" />
          <span
            className="absolute inset-0 rounded-full border border-[var(--cyan)] pulse-ring"
            style={{ animationDelay: '0.5s' }}
          />
        </>
      )}
      {state === 'processing' && (
        <span className="absolute inset-0 rounded-full border-2 border-[var(--yellow)] pulse-ring-amber" />
      )}
      <motion.div
        className={`${dim} rounded-full flex items-center justify-center border-2 ${stateRing[state]} ${stateBg[state]}`}
        animate={state === 'listening' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ repeat: state === 'listening' ? Infinity : 0, duration: 1.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Mic
          size={iconSize}
          className={
            state === 'processing'
              ? 'text-[var(--yellow)]'
              : state === 'speaking'
                ? 'text-[var(--purple)]'
                : 'text-[var(--cyan)]'
          }
        />
      </motion.div>
      <span className="hud-meta text-[10px]">{label}</span>
    </button>
  )
}
