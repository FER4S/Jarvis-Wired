import { useEffect, useState } from 'react'
import { voiceService } from '@/services/voiceService'

export function useVoiceAmplitude(): number {
  const [amplitude, setAmplitude] = useState(voiceService.getAmplitude())

  useEffect(() => voiceService.onAmplitudeChange(setAmplitude), [])

  return amplitude
}
