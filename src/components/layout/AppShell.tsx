import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBar } from '@/components/layout/BottomBar'
import { WhatsNewDialog } from '@/components/release/WhatsNewDialog'
import { useVoiceState } from '@/hooks/useVoiceState'
import { LATEST } from '@/data/changelog'
import { getAppVersion, markVersionSeen, shouldShowWhatsNew } from '@/services/release'

export function AppShell() {
  const voiceState = useVoiceState()
  const location = useLocation()
  const showVoiceBar = location.pathname === '/'

  // Mounted here rather than on a page, so the update notes show on whichever
  // route the app happens to open on. Evaluated once on mount.
  const [showWhatsNew, setShowWhatsNew] = useState(() => shouldShowWhatsNew(getAppVersion()))

  const dismissWhatsNew = () => {
    markVersionSeen(getAppVersion())
    setShowWhatsNew(false)
  }

  return (
    <div className="relative flex h-screen w-screen min-h-0 overflow-hidden t-bg-app flex-col p-3 sm:p-4 gap-3">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{ backgroundImage: 'var(--theme-app-gradient)' }}
      />
      <TopBar />
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden flex flex-col">
        <Outlet />
      </div>
      {showVoiceBar && <BottomBar voiceState={voiceState} />}
      {showWhatsNew && <WhatsNewDialog release={LATEST} onDismiss={dismissWhatsNew} />}
    </div>
  )
}
