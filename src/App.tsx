import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BackendProvider } from '@/context/BackendContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { AppShell } from '@/components/layout/AppShell'
import { SetupScreen } from '@/components/setup/SetupScreen'
import { CommandCenter } from '@/pages/CommandCenter'
import { EmailPage } from '@/pages/EmailPage'
import { SystemControlPage } from '@/pages/SystemControlPage'
import { AccountPage } from '@/pages/AccountPage'
import { useVoiceActions } from '@/hooks/useVoiceState'
import { getAppVersion, markVersionSeen } from '@/services/release'

function AppRoutes() {
  const voiceActions = useVoiceActions()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) {
        // Don't hijack the shortcut while the boss is typing a message —
        // Ctrl+Space in the conversation box would otherwise stop the assistant
        // mid-sentence.
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        void voiceActions.toggleListening()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [voiceActions])

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CommandCenter />} />
          <Route path="email" element={<EmailPage />} />
          <Route path="system" element={<SystemControlPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  const [phase, setPhase] = useState<'checking' | 'setup' | 'ready'>('checking')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const status = await window.jarvis?.setup?.status()
        if (!cancelled) setPhase(status?.needed ? 'setup' : 'ready')
      } catch {
        if (!cancelled) setPhase('ready') // no setup API (e.g. plain browser) → just show the app
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // First run on a brand-new machine: there is no "before", so record the
  // current version silently instead of popping release notes at someone who
  // has never seen the app. Only a genuine update should show What's New.
  const handleSetupComplete = () => {
    markVersionSeen(getAppVersion())
    setPhase('ready')
  }

  return (
    <ThemeProvider>
      {phase === 'checking' ? null : phase === 'setup' ? (
        <SetupScreen onComplete={handleSetupComplete} />
      ) : (
        <BackendProvider>
          <AppRoutes />
        </BackendProvider>
      )}
    </ThemeProvider>
  )
}
