import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBar } from '@/components/layout/BottomBar'
import { CommandCenter } from '@/pages/CommandCenter'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { HudFrame } from '@/components/ui/HudFrame'
import { BackendProvider } from '@/context/BackendContext'
import { useVoiceState, useVoiceActions } from '@/hooks/useVoiceState'

function AppContent() {
  const voiceState = useVoiceState()
  const { toggleListening } = useVoiceActions()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) {
        e.preventDefault()
        void toggleListening()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleListening])

  return (
    <div className="relative app-shell flex h-screen w-screen min-h-0 bg-[var(--bg-primary)] overflow-hidden">
      <AmbientBackground />
      <HudFrame>
        <div className="relative z-10 flex h-full w-full min-h-0 flex-col">
          <TopBar />
          <CommandCenter />
          <BottomBar voiceState={voiceState} />
        </div>
      </HudFrame>
    </div>
  )
}

export default function App() {
  return (
    <BackendProvider>
      <AppContent />
    </BackendProvider>
  )
}
