import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { TopNavPills } from '@/components/layout/TopNavPills'
import { ThemeSettings } from '@/components/account/ThemeSettings'
import { MemoryProfilePanel } from '@/components/account/MemoryProfilePanel'
import { MemoryPeoplePanel } from '@/components/account/MemoryPeoplePanel'
import { MemoryKnowledgePanel } from '@/components/account/MemoryKnowledgePanel'
import { MemoryImportPanel } from '@/components/account/MemoryImportPanel'
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
import { ReleaseNotes } from '@/components/release/ReleaseNotes'
import { CHANGELOG } from '@/data/changelog'
import type { MemoryProfile, MemorySnapshot } from '@/services/types'
import { BrutalInput, brutalBtnClass } from '@/components/ui/BrutalInput'

const TABS = ['Profile', 'People', 'Knowledge', 'Import', "What's New", 'Connection'] as const
type Tab = (typeof TABS)[number]

function getInitialApiUrl(): string {
  return getStoredApiUrl() ?? window.jarvis?.backend?.url ?? 'http://127.0.0.1:8000'
}

function getInitialToken(): string {
  return getStoredToken() ?? window.jarvis?.backend?.token ?? ''
}

export function AccountPage() {
  const { connected } = useBackend()
  const [tab, setTab] = useState<Tab>('Profile')

  // ── Memory state ───────────────────────────────────────────────────────────
  const [memory, setMemory] = useState<MemorySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Connection form state ──────────────────────────────────────────────────
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl)
  const [token, setToken] = useState(getInitialToken)
  const [connError, setConnError] = useState<string | null>(null)
  const [connSuccess, setConnSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)

  const activeUrl = getApiBaseUrl()
  const tokenConfigured = !!getToken()

  // Deliberately NOT polled on an interval (unlike EmailPage, which is
  // read-only): a background refetch would clobber a half-typed edit form.
  // Refresh happens on mount, after every mutation, and on demand.
  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      setMemory(await backendClient.getMemory())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory')
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Run a mutation, surface its message, and re-read the store. */
  const mutate = useCallback(
    async (fn: () => Promise<void>, okMessage: string) => {
      setError(null)
      setSuccess(null)
      try {
        await fn()
        setSuccess(okMessage)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
    [refresh]
  )

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
      void refresh()
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

  const readOnly = memory ? !memory.writable : true

  return (
    <main className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto">
      <PageHeader
        title="Account & Memory"
        description="Everything Jarvis knows about you — correct it, add to it, or remove it."
        action={
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={refreshing}
            className={`${brutalBtnClass} bg-[#252833] text-slate-200`}
          >
            <RefreshCw size={14} strokeWidth={3} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <TopNavPills tabs={TABS} active={tab} onChange={setTab} />

      {!tokenConfigured && (
        <div className="shrink-0 border-2 border-black bg-rose-500/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="font-mono text-xs text-rose-400 uppercase">
            API token missing — memory can't be loaded without backend authentication.
          </p>
          <button
            type="button"
            onClick={() => setTab('Connection')}
            className="font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-black bg-yellow-400 text-black shadow-[3px_3px_0px_0px_black] w-fit"
          >
            Set it up →
          </button>
        </div>
      )}

      {memory && readOnly && (
        <p className="shrink-0 font-mono text-xs text-rose-400 uppercase border-2 border-black bg-rose-500/10 px-3 py-2 leading-relaxed">
          Memory is read-only right now — Jarvis couldn't open its memory file, so it's protecting
          what's on disk. Restart Jarvis, and check the backend log.
        </p>
      )}

      {error && (
        <p className="shrink-0 font-mono text-xs text-rose-500 uppercase border-2 border-black bg-rose-500/10 px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="shrink-0 font-mono text-xs text-green-400 uppercase border-2 border-black bg-green-500/10 px-3 py-2">
          {success}
        </p>
      )}

      {loading && tab !== 'Connection' && tab !== "What's New" ? (
        <p className="font-mono text-xs t-text-muted uppercase">Loading memory…</p>
      ) : (
        <>
          {tab === 'Profile' && memory && (
            <MemoryProfilePanel
              profile={memory.profile}
              readOnly={readOnly}
              onSave={(profile: MemoryProfile) =>
                mutate(async () => {
                  await backendClient.updateMemoryProfile(profile)
                }, 'Profile saved.')
              }
            />
          )}

          {tab === 'People' && memory && (
            <MemoryPeoplePanel
              people={memory.people}
              readOnly={readOnly}
              onAdd={(body) =>
                mutate(async () => {
                  await backendClient.addMemoryPerson(body)
                }, 'Person added.')
              }
              onUpdate={(id, body) =>
                mutate(async () => {
                  await backendClient.updateMemoryPerson(id, body)
                }, 'Person updated.')
              }
              onDelete={(id) =>
                mutate(async () => {
                  await backendClient.deleteMemoryPerson(id)
                }, 'Person deleted.')
              }
            />
          )}

          {tab === 'Knowledge' && memory && (
            <MemoryKnowledgePanel
              facts={memory.facts}
              events={memory.events}
              readOnly={readOnly}
              onAddFact={(text) =>
                mutate(async () => {
                  await backendClient.addMemoryFact(text)
                }, 'Fact added.')
              }
              onUpdateFact={(id, text) =>
                mutate(async () => {
                  await backendClient.updateMemoryFact(id, text)
                }, 'Fact updated.')
              }
              onDeleteFact={(id) =>
                mutate(async () => {
                  await backendClient.deleteMemoryFact(id)
                }, 'Fact deleted.')
              }
              onAddEvent={(body) =>
                mutate(async () => {
                  await backendClient.addMemoryEvent(body)
                }, 'Event added.')
              }
              onUpdateEvent={(id, body) =>
                mutate(async () => {
                  await backendClient.updateMemoryEvent(id, body)
                }, 'Event updated.')
              }
              onDeleteEvent={(id) =>
                mutate(async () => {
                  await backendClient.deleteMemoryEvent(id)
                }, 'Event deleted.')
              }
            />
          )}

          {tab === "What's New" && (
            <div className="flex flex-col gap-4">
              {CHANGELOG.map((release) => (
                <BrutalPanel
                  key={release.version}
                  panelId={`V${release.version}`}
                  title={`Version ${release.version} — ${release.date}`}
                  fillHeight={false}
                >
                  <div className="flex flex-col gap-4">
                    <p className="font-sans text-sm t-text leading-relaxed">{release.headline}</p>
                    <ReleaseNotes release={release} />
                  </div>
                </BrutalPanel>
              ))}
            </div>
          )}

          {tab === 'Import' && (
            <MemoryImportPanel
              readOnly={readOnly}
              onError={(message) => {
                setSuccess(null)
                setError(message)
              }}
              onCommitted={async (result) => {
                setError(null)
                // Report merges/updates/skips too — otherwise a paste that only
                // updated existing entries reads as "0 imported" and looks broken.
                const parts = [
                  `${result.people_created} new`,
                  `${result.people_merged} merged`,
                  `${result.facts_added} fact(s)`,
                  `${result.events_added + result.events_updated} event(s)`
                ]
                if (result.facts_skipped > 0) {
                  parts.push(`${result.facts_skipped} already known`)
                }
                setSuccess(`Imported — ${parts.join(', ')}.`)
                await refresh()
              }}
            />
          )}
        </>
      )}

      {tab === 'Connection' && (
        <div className="flex flex-col gap-4">
          <ThemeSettings />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
            <BrutalPanel
              panelId="CONN"
              title="Backend Connection"
              fillHeight={false}
              className="min-h-[300px]"
            >
              <form onSubmit={handleConnSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-xs font-bold uppercase t-label">Backend URL</span>
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

            <BrutalPanel
              panelId="STATUS"
              title="Connection Status"
              fillHeight={false}
              className="min-h-[300px]"
            >
              <div className="flex flex-col gap-3 font-mono text-xs uppercase h-full">
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
                      healthOk === null ? 't-text-muted' : healthOk ? 'text-green-500' : 'text-rose-500'
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
                <div className="flex items-center justify-between gap-2 p-2 t-surface">
                  <span className="t-text-muted">Memory</span>
                  <span className={memory ? (memory.writable ? 'text-green-500' : 'text-rose-500') : 't-text-muted'}>
                    {memory ? (memory.writable ? 'Editable' : 'Read-only') : 'Unknown'}
                  </span>
                </div>
                {memory?.last_updated && (
                  <div className="flex items-center justify-between gap-2 p-2 t-surface">
                    <span className="t-text-muted">Last saved</span>
                    <span className="t-text truncate normal-case">
                      {new Date(memory.last_updated).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </BrutalPanel>
          </div>
        </div>
      )}
    </main>
  )
}
