import type { VoiceState } from '@/services/types'
import { TalkToJarvisBar } from '@/components/voice/TalkToJarvisBar'
import { ContactEmailPrompt } from '@/components/voice/ContactEmailPrompt'

interface BottomBarProps {
  voiceState: VoiceState
}

export function BottomBar({ voiceState }: BottomBarProps) {
  return (
    <footer className="relative shrink-0 z-20 pt-2 bg-transparent">
      <ContactEmailPrompt />
      <TalkToJarvisBar state={voiceState} />
    </footer>
  )
}
