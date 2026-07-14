import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Trash2 } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmailSetupSection } from '@/components/email/EmailSetupSection'
import { backendClient, getToken } from '@/services/backendClient'
import type { EmailAccount, EmailSummaryResponse } from '@/services/types'

import { brutalBtnClass } from '@/components/ui/BrutalInput'

function formatPollTime(value: string | null): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

export function EmailPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [summary, setSummary] = useState<EmailSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const tokenConfigured = !!getToken()

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const [accts, sum] = await Promise.all([
        backendClient.listEmailAccounts(),
        backendClient.getEmailSummary()
      ])
      setAccounts(accts)
      setSummary(sum)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load email data'
      setError(message)
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 45000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleDelete = async (id: string) => {
    try {
      await backendClient.deleteEmailAccount(id)
      setSuccess('Account removed.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const handleSetupSuccess = async () => {
    setSuccess('Account connected. Mail will appear within a few seconds.')
    await refresh(true)
  }

  const lastPoll =
    summary?.accounts.reduce<string | null>((latest, acct) => {
      if (!acct.last_poll) return latest
      if (!latest) return acct.last_poll
      return new Date(acct.last_poll) > new Date(latest) ? acct.last_poll : latest
    }, null) ?? null

  return (
    <main className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <PageHeader
        title="Email Integration"
        description="Connect Gmail or IMAP inboxes. Jarvis polls mail in the background and surfaces unread counts on the Command Center."
        action={
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={refreshing}
            className={`${brutalBtnClass} flex items-center gap-2 bg-[#252833] text-slate-200 shrink-0`}
          >
            <RefreshCw size={14} strokeWidth={3} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {!tokenConfigured && (
        <div className="shrink-0 border-2 border-black bg-rose-500/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="font-mono text-xs text-rose-400 uppercase">
            API token missing — email endpoints require backend authentication.
          </p>
          <Link
            to="/account"
            className="font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-black bg-yellow-400 text-black shadow-[3px_3px_0px_0px_black] w-fit"
          >
            Configure in Account →
          </Link>
        </div>
      )}

      {error && (
        <div className="shrink-0 border-2 border-black bg-rose-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="font-mono text-xs text-rose-500 uppercase">{error}</p>
          {!tokenConfigured && (
            <Link
              to="/account"
              className="font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-black bg-yellow-400 text-black shadow-[3px_3px_0px_0px_black] w-fit"
            >
              Fix connection →
            </Link>
          )}
        </div>
      )}

      {success && (
        <p className="shrink-0 font-mono text-xs text-green-400 uppercase border-2 border-black bg-green-500/10 px-3 py-2">
          {success}
        </p>
      )}

      <div className="shrink-0 grid grid-cols-3 gap-3">
        {[
          { label: 'Connected', value: loading ? '…' : String(accounts.length) },
          { label: 'Unread total', value: loading ? '…' : String(summary?.total_unread ?? 0) },
          { label: 'Last poll', value: loading ? '…' : formatPollTime(lastPoll) }
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-2 border-black bg-[#181a24] px-3 py-2 shadow-[4px_4px_0px_0px_black]"
          >
            <p className="font-mono text-[10px] text-slate-500 uppercase">{stat.label}</p>
            <p className="font-mono text-sm font-bold text-white mt-1 truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 overflow-hidden">
        <div className="min-h-0 overflow-y-auto">
          <EmailSetupSection onSuccess={() => void handleSetupSuccess()} disabled={!tokenConfigured} />
        </div>

        <BrutalPanel panelId="ACCTS" title="Connected Accounts" className="h-full min-h-[320px]">
          {loading ? (
            <p className="font-mono text-xs text-slate-500 uppercase">Loading…</p>
          ) : accounts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="w-14 h-14 border-2 border-black bg-[#0f1016] shadow-[4px_4px_0px_0px_black] flex items-center justify-center font-mono text-xl text-slate-500">
                @
              </div>
              <p className="font-mono text-xs text-slate-400 uppercase max-w-[220px] leading-relaxed">
                No inboxes connected yet. Pick Gmail or IMAP on the left to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-full pr-1">
              {accounts.map((acct) => {
                const summaryAcct = summary?.accounts.find((s) => s.id === acct.id)
                return (
                  <div
                    key={acct.id}
                    className="p-3 border-2 border-black bg-[#0f1016] flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-white truncate">
                          {acct.label}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 uppercase mt-0.5">
                          {acct.provider}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(acct.id)}
                        className="shrink-0 p-1.5 border-2 border-black bg-rose-500 text-black"
                        aria-label="Delete account"
                      >
                        <Trash2 size={14} strokeWidth={3} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase">
                      <span className="px-2 py-0.5 border border-black bg-purple-500/20 text-purple-300">
                        {summaryAcct?.unread_count ?? 0} unread total
                      </span>
                      <span className="px-2 py-0.5 border border-black bg-[#181a24] text-slate-400">
                        Poll: {formatPollTime(summaryAcct?.last_poll ?? null)}
                      </span>
                    </div>
                    {summaryAcct?.last_error && (
                      <p className="font-mono text-[10px] text-rose-500 uppercase leading-relaxed">
                        {summaryAcct.last_error}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </BrutalPanel>
      </div>

      <BrutalPanel panelId="INBOX" title="Inbox Summary" className="shrink-0 min-h-[200px] max-h-[280px]">
        {!summary || summary.accounts.length === 0 ? (
          <p className="font-mono text-xs text-slate-500 uppercase">
            Summary appears after you connect an account.
          </p>
        ) : (
          <div className="h-full overflow-y-auto space-y-3 pr-1">
            <p className="font-mono text-sm font-bold text-yellow-400 uppercase sticky top-0 bg-[#181a24] py-1">
              {summary.total_unread} unread total — recent mail from last 2 days below
            </p>
            {summary.accounts.map((acct) => (
              <div key={acct.id} className="border-2 border-black bg-[#0f1016] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-mono text-xs font-bold text-white">{acct.label}</p>
                  <span className="font-mono text-[10px] text-slate-400 uppercase">
                    {acct.unread_count} unread total
                  </span>
                </div>
                <p className="font-mono text-[10px] text-slate-500 uppercase mb-2">
                  Last 2 days ({acct.recent.length} cached)
                </p>
                <div className="space-y-1">
                  {acct.recent.length === 0 ? (
                    <p className="font-mono text-[10px] text-slate-500">No recent mail</p>
                  ) : (
                    acct.recent.slice(0, 4).map((item, i) => (
                      <div key={i} className="font-mono text-[10px] text-slate-300 leading-relaxed">
                        <span className={item.unread ? 'text-pink-400' : 'text-slate-500'}>
                          [{item.unread ? 'UNREAD' : 'READ'}]
                        </span>{' '}
                        {item.sender_name}: {item.subject}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </BrutalPanel>
    </main>
  )
}
