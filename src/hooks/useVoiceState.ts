import { useBackend } from '@/context/BackendContext'
import type { VoiceState } from '@/services/types'

export function useVoiceState(): VoiceState {
  const { voiceState } = useBackend()
  return voiceState
}

export function useVoiceActions() {
  const { toggleAssistant } = useBackend()

  return { toggleListening: toggleAssistant }
}
