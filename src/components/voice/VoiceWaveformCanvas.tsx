import { useEffect, useRef } from 'react'
import type { VoiceState } from '@/services/types'
import { voiceService } from '@/services/voiceService'
import { useVoiceAmplitude } from '@/hooks/useVoiceAmplitude'

interface VoiceWaveformCanvasProps {
  state: VoiceState
  className?: string
}

const stateColors: Record<VoiceState, [string, string]> = {
  idle: ['#38bdf8', '#0ea5e9'],
  listening: ['#38bdf8', '#34d399'],
  processing: ['#fbbf24', '#38bdf8'],
  speaking: ['#a78bfa', '#38bdf8']
}

export function VoiceWaveformCanvas({ state, className = '' }: VoiceWaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const amplitude = useVoiceAmplitude()
  const phaseRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const [c1, c2] = stateColors[state]
    const isActive = state !== 'idle'

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      ctx.clearRect(0, 0, w, h)
      phaseRef.current += 0.08 + amplitude * 0.15

      const freqData = voiceService.getFrequencyData()
      const mid = h / 2

      const grad = ctx.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, c1 + '00')
      grad.addColorStop(0.3, c1)
      grad.addColorStop(0.7, c2)
      grad.addColorStop(1, c2 + '00')

      ctx.beginPath()
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.shadowColor = c1
      ctx.shadowBlur = isActive ? 12 + amplitude * 16 : 4

      for (let x = 0; x < w; x++) {
        const t = x / w
        const bin = Math.floor(t * freqData.length)
        const freqVal = isActive && freqData.length ? freqData[bin] / 255 : 0
        const wave =
          Math.sin(t * Math.PI * 6 + phaseRef.current) * (8 + amplitude * 20) +
          Math.sin(t * Math.PI * 14 + phaseRef.current * 1.7) * (4 + amplitude * 10) +
          freqVal * 18
        const y = mid + wave
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      if (isActive) {
        ctx.beginPath()
        ctx.strokeStyle = c2 + '44'
        ctx.lineWidth = 1
        for (let x = 0; x < w; x++) {
          const t = x / w
          const y = mid + Math.sin(t * Math.PI * 8 - phaseRef.current) * (6 + amplitude * 12)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [state, amplitude])

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} aria-hidden />
}
