import { useState, type FormEvent } from 'react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { UserProfileForm } from '@/components/account/UserProfileForm'
import { ThemeSettings } from '@/components/account/ThemeSettings'
import { useBackend } from '@/context/BackendContext'
import {
  backendClient,
  clearStoredCredentials,
  getApiBaseUrl,
  getStoredApiUrl,
  getStoredToken,
  getToken,
  setStoredCredentials
} from '@/services/backendClient'
import { formatProfileSummary, getUserProfile } from '@/services/userProfile'

import { BrutalInput, brutalBtnClass } from '@/components/ui/BrutalInput'

function getInitialApiUrl(): string {
  return getStoredApiUrl() ?? window.jarvis?.backend?.url ?? 'http://127.0.0.1:8000'
}

function getInitialToken(): string {
  return getStoredToken() ?? window.jarvis?.backend?.token ?? ''
}

export function AccountPage() {
  const { connected } = useBackend()
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl)
  const [token, setToken] = useState(getInitialToken)
  const [connError, setConnError] = useState<string | null>(null)
  const [connSuccess, setConnSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [profileSummary, setProfileSummary] = useState(() => formatProfileSummary(getUserProfile()))

  const activeUrl = getApiBaseUrl()
  const hasSavedCredentials = !!(getStoredApiUrl() && getStoredToken())
  const tokenConfigured = !!getToken()
  const profile = getUserProfile()
  const profileComplete = !!(profile.fullName || profile.email)

  const handleConnSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setConnError(null)
    setConnSuccess(null)

    const trimmedUrl = apiUrl.trim().replace(/\/$/, '')
    const trimmedToken = token.trim()

    if (!trimmedUrl || !trimmedToken) {
      setConnError('Backend URL and API token are required.')
      setSubmitting(false)
      return
    }

    try {
      await backendClient.validateToken(trimmedUrl, trimmedToken)
      setStoredCredentials(trimmedUrl, trimmedToken)
      backendClient.disconnect()
      backendClient.connect()

      const health = await backendClient.health()
      setHealthOk(health.status === 'ok')
      setConnSuccess('Backend connection saved.')
    } catch (err) {
      setHealthOk(false)
      setConnError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = () => {
    clearStoredCredentials()
    backendClient.disconnect()
    backendClient.connect()
    setApiUrl(window.jarvis?.backend?.url ?? 'http://127.0.0.1:8000')
    setToken(window.jarvis?.backend?.token ?? '')
    setConnError(null)
    setConnSuccess('Saved credentials cleared. Using environment defaults.')
    setHealthOk(null)
  }

  const handleTest = async () => {
    setSubmitting(true)
    setConnError(null)
    setConnSuccess(null)
    try {
      const health = await backendClient.health()
      setHealthOk(health.status === 'ok')
      if (health.status === 'ok') {
        setConnSuccess('Backend is reachable.')
      } else {
        setConnError('Backend responded but health check failed.')
      }
    } catch (err) {
      setHealthOk(false)
      setConnError(err instanceof Error ? err.message : 'Backend unreachable.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto">
      <PageHeader
        title="Account Settings"
        description="Your profile, work context, and backend connection for Jarvis."
      />

      <UserProfileForm
        onSaved={(saved) => setProfileSummary(formatProfileSummary(saved))}
      />

      <ThemeSettings />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
        <BrutalPanel panelId="CONN" title="Backend Connection" fillHeight={false} className="min-h-[300px]">
          <form onSubmit={handleConnSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-bold uppercase t-label">
                Backend URL
              </span>
              <BrutalInput
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-bold uppercase t-label">API Token</span>
              <BrutalInput
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="JARVIS_API_TOKEN value"
                required
              />
            </label>

            {connError && (
              <p className="font-mono text-xs text-rose-500 uppercase border-2 border-black bg-rose-500/10 px-3 py-2">
                {connError}
              </p>
            )}
            {connSuccess && (
              <p className="font-mono text-xs text-green-400 uppercase border-2 border-black bg-green-500/10 px-3 py-2">
                {connSuccess}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submitting}
                className={`${brutalBtnClass} bg-emerald-500 text-black`}
              >
                {submitting ? 'Saving…' : 'Save & Connect'}
              </button>
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={submitting}
                className={`${brutalBtnClass} bg-cyan-500 text-black`}
              >
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting}
                className={`${brutalBtnClass} bg-rose-500 text-black`}
              >
                Clear Saved
              </button>
            </div>
          </form>
        </BrutalPanel>

        <BrutalPanel panelId="STATUS" title="Account Overview" fillHeight={false} className="min-h-[300px]">
          <div className="flex flex-col gap-3 font-mono text-xs uppercase h-full">
            <div className="flex items-center justify-between gap-2 p-2 t-surface">
              <span className="t-text-muted">Profile</span>
              <span className={profileComplete ? 'text-green-500' : 't-text-muted'}>
                {profileComplete ? 'Filled' : 'Incomplete'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2 t-surface">
              <span className="t-text-muted">Active URL</span>
              <span className="t-text truncate">{activeUrl}</span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2 t-surface">
              <span className="t-text-muted">Token</span>
              <span className={tokenConfigured ? 'text-green-500' : 'text-rose-500'}>
                {tokenConfigured ? 'Configured' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2 t-surface">
              <span className="t-text-muted">Health</span>
              <span
                className={
                  healthOk === null
                    ? 't-text-muted'
                    : healthOk
                      ? 'text-green-500'
                      : 'text-rose-500'
                }
              >
                {healthOk === null ? 'Not tested' : healthOk ? 'OK' : 'Failed'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2 t-surface">
              <span className="t-text-muted">WebSocket</span>
              <span className={connected ? 'text-green-500' : 'text-rose-500'}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {profileSummary && (
              <div className="flex-1 min-h-0 mt-1 p-3 t-surface overflow-y-auto">
                <p className="font-mono text-[10px] t-text-muted uppercase mb-2">
                  Saved profile preview
                </p>
                <pre className="font-mono text-[10px] t-text-secondary normal-case whitespace-pre-wrap leading-relaxed">
                  {profileSummary}
                </pre>
              </div>
            )}
          </div>
        </BrutalPanel>
      </div>
    </main>
  )
}
