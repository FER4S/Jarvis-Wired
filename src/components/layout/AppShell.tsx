import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBar } from '@/components/layout/BottomBar'
import { useVoiceState } from '@/hooks/useVoiceState'

export function AppShell() {
  const voiceState = useVoiceState()
  const location = useLocation()
  const showVoiceBar = location.pathname === '/'

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
    </div>
  )
}
