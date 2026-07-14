import type { VoiceState } from '@/services/types'
import { TalkToJarvisBar } from '@/components/voice/TalkToJarvisBar'
import { ContactEmailPrompt } from '@/components/voice/ContactEmailPrompt'

interface BottomBarProps {
  voiceState: VoiceState
}

export function BottomBar({ voiceState }: BottomBarProps) {
  return (
    <footer className="relative shrink-0 px-5 py-4 border-t border-[var(--border)] bg-[rgba(7,11,18,0.75)] backdrop-blur-md">
      <ContactEmailPrompt />
      <TalkToJarvisBar state={voiceState} />
    </footer>
  )
}
