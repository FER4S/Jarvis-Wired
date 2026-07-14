import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import type { VoiceState } from '@/services/types'
import { useBackend } from '@/context/BackendContext'
import { useVoiceActions } from '@/hooks/useVoiceState'
import { useVoiceAmplitude } from '@/hooks/useVoiceAmplitude'
import { voiceService } from '@/services/voiceService'

interface TalkToJarvisBarProps {
  state: VoiceState
}

const BAR_COUNT = 48

const stateLabel: Record<VoiceState, string> = {
  idle: 'Say "Hey Jarvis" or press Ctrl + Space',
  listening: 'Listening for your command…',
  processing: 'Processing your request…',
  speaking: 'Jarvis is speaking…'
}

export function TalkToJarvisBar({ state }: TalkToJarvisBarProps) {
  const { connected, error } = useBackend()
  const { toggleListening } = useVoiceActions()
  const amplitude = useVoiceAmplitude()
  const [barHeights, setBarHeights] = useState<number[]>(() => Array(BAR_COUNT).fill(0.15))
  const phaseRef = useRef(0)

  useEffect(() => {
    let animId: number
    const isActive = state !== 'idle'

    const tick = () => {
      phaseRef.current += 0.08 + amplitude * 0.15
      const freqData = voiceService.getFrequencyData()

      setBarHeights(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          const t = i / BAR_COUNT
          const bin = Math.floor(t * (freqData.length || 1))
          const freqVal = isActive && freqData.length ? freqData[bin] / 255 : 0
          const wave =
            Math.sin(t * Math.PI * 6 + phaseRef.current) * 0.35 +
            Math.sin(t * Math.PI * 14 + phaseRef.current * 1.7) * 0.2 +
            freqVal * 0.5
          return Math.max(0.08, Math.min(1, 0.2 + wave + amplitude * 0.4))
        })
      )

      animId = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(animId)
  }, [state, amplitude])

  const label = !connected
    ? 'Backend offline — check Account settings'
    : error
      ? error
      : stateLabel[state]

  return (
    <div className="no-drag w-full">
      <div
        className="h-2 border-t-2"
        style={{
          borderColor: 'var(--theme-border)',
          backgroundImage: 'var(--theme-hazard)'
        }}
        aria-hidden
      />
      <button
        type="button"
        onClick={toggleListening}
        disabled={!connected}
        className={`w-full flex flex-col t-elevated border-t-0 transition-all hover:-translate-y-px ${
          !connected ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center t-accent-mark">
            <Mic size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="font-sans text-xs font-semibold t-text">Voice Assistant</span>
            <span className="font-mono text-[10px] t-text-secondary mt-0.5 truncate max-w-full">
              {label}
            </span>
          </div>
        </div>
        <div className="flex items-end justify-center gap-[2px] h-10 px-4 pb-3">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="w-1 bg-amber-400/90 rounded-sm"
              style={{ height: `${h * 100}%` }}
              aria-hidden
            />
          ))}
        </div>
      </button>
    </div>
  )
}
