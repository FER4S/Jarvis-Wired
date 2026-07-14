import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BackendProvider } from '@/context/BackendContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { AppShell } from '@/components/layout/AppShell'
import { CommandCenter } from '@/pages/CommandCenter'
import { EmailPage } from '@/pages/EmailPage'
import { SystemControlPage } from '@/pages/SystemControlPage'
import { AccountPage } from '@/pages/AccountPage'
import { useVoiceActions } from '@/hooks/useVoiceState'

function AppRoutes() {
  const voiceActions = useVoiceActions()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) {
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
  return (
    <ThemeProvider>
      <BackendProvider>
        <AppRoutes />
      </BackendProvider>
    </ThemeProvider>
  )
}
