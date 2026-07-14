import type { IVoiceService, VoiceState } from './types'

const FREQ_BINS = 32

class VoiceService implements IVoiceService {
  private state: VoiceState = 'idle'
  private amplitude = 0
  private stateListeners = new Set<(state: VoiceState) => void>()
  private amplitudeListeners = new Set<(amplitude: number) => void>()
  private rafId: number | null = null
  private simPhase = 0
  private frequencyData = new Uint8Array(FREQ_BINS)

  getState(): VoiceState {
    return this.state
  }

  getAmplitude(): number {
    return this.amplitude
  }

  getFrequencyData(): Uint8Array {
    return this.frequencyData
  }

  onStateChange(cb: (state: VoiceState) => void): () => void {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }

  onAmplitudeChange(cb: (amplitude: number) => void): () => void {
    this.amplitudeListeners.add(cb)
    return () => this.amplitudeListeners.delete(cb)
  }

  syncState(state: VoiceState): void {
    this.setState(state)
    if (state === 'idle') {
      this.stopAmplitudeLoop()
    } else if (this.rafId === null) {
      this.startAmplitudeLoop()
    }
  }

  private setState(state: VoiceState): void {
    this.state = state
    this.stateListeners.forEach((cb) => cb(state))
  }

  private emitAmplitude(value: number): void {
    this.amplitude = value
    for (let i = 0; i < this.frequencyData.length; i++) {
      this.frequencyData[i] = Math.floor(value * 255 * (0.5 + Math.random() * 0.5))
    }
    this.amplitudeListeners.forEach((cb) => cb(value))
  }

  private simulateAmplitude(): number {
    this.simPhase += 0.12
    const base =
      this.state === 'listening'
        ? 0.35 + Math.sin(this.simPhase) * 0.25 + Math.sin(this.simPhase * 2.7) * 0.15
        : this.state === 'speaking'
          ? 0.5 + Math.sin(this.simPhase * 1.4) * 0.3 + Math.sin(this.simPhase * 3.1) * 0.12
          : this.state === 'processing'
            ? 0.2 + Math.sin(this.simPhase * 4) * 0.15
            : 0.04 + Math.sin(this.simPhase * 0.5) * 0.03
    return Math.max(0, Math.min(1, base))
  }

  private startAmplitudeLoop(): void {
    const tick = () => {
      this.emitAmplitude(this.simulateAmplitude())
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopAmplitudeLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.emitAmplitude(0)
  }

  async startListening(): Promise<void> {
    // Wake-word driven — no-op; assistant controlled via BackendContext
  }

  async stopListening(): Promise<void> {
    // Wake-word driven — no-op; assistant controlled via BackendContext
  }
}

export const voiceService: IVoiceService = new VoiceService()
