import type { VoiceState } from '@/services/types'

interface VoiceWaveformProps {
  active?: boolean
  state?: VoiceState
  barCount?: number
  className?: string
}

const stateColors: Record<VoiceState, string> = {
  idle: 'bg-[var(--cyan)]',
  listening: 'bg-[var(--cyan)]',
  processing: 'bg-[var(--yellow)]',
  speaking: 'bg-[var(--purple)]'
}

export function VoiceWaveform({
  active = false,
  state = 'idle',
  barCount = 12,
  className = ''
}: VoiceWaveformProps) {
  const isAnimating = active || state === 'listening' || state === 'processing' || state === 'speaking'
  const isFast = state === 'listening' || state === 'speaking'
  const barColor = stateColors[state]

  return (
    <div className={`flex items-center justify-center gap-[2px] h-6 ${className}`} aria-hidden>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${barColor} ${
            isAnimating ? (isFast ? 'waveform-bar-fast' : 'waveform-bar') : ''
          }`}
          style={{
            height: isAnimating ? undefined : '4px',
            opacity: isAnimating ? 0.4 + (i % 3) * 0.2 : 0.25,
            animationDelay: `${i * 0.08}s`,
            animationDuration: `${0.5 + (i % 4) * 0.12}s`
          }}
        />
      ))}
    </div>
  )
}
