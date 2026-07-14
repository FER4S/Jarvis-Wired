import type { VoiceState } from '@/services/types'

export const voiceStateBg: Record<VoiceState, string> = {
  idle: 'bg-yellow-400',
  listening: 'bg-green-500',
  processing: 'bg-cyan-500',
  speaking: 'bg-pink-500'
}

export const voiceStateLabel: Record<VoiceState, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  processing: 'PROCESSING',
  speaking: 'SPEAKING'
}

export function getStatusPillClasses(connected: boolean, voiceState: VoiceState, hasError: boolean) {
  if (!connected || hasError) return 'bg-rose-500'
  return voiceStateBg[voiceState]
}

export function getStatusPillText(
  connected: boolean,
  running: boolean,
  voiceState: VoiceState,
  hasError: boolean
) {
  if (!connected) return '■ STATE: OFFLINE // MIC: OFF'
  if (hasError) return '■ STATE: ERROR // MIC: OFF'
  const state = running ? voiceStateLabel[voiceState] : 'STANDBY'
  const mic = running && voiceState !== 'idle' ? 'ON' : running ? 'READY' : 'OFF'
  return `■ STATE: ${state} // MIC: ${mic}`
}
