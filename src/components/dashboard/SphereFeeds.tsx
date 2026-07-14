import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Mic, Power, PowerOff, Send, Server } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, brutalBtnClass } from '@/components/ui/BrutalInput'
import { useBackend } from '@/context/BackendContext'
import { backendClient, getToken } from '@/services/backendClient'
import type { EmailRecentItem } from '@/services/types'
import { getStatusPillClasses, getStatusPillText } from '@/utils/voiceStateColors'
import type { TranscriptEntry } from '@/context/BackendContext'

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[90%] px-3.5 py-2.5 border-2 border-black/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
          isUser ? 'bg-[#252833] text-slate-100' : 'bg-pink-500 text-black'
        }`}
      >
        <p
          className={`font-mono text-[9px] font-semibold uppercase tracking-wider mb-1 ${
            isUser ? 'text-slate-400' : 'text-black/60'
          }`}
        >
          {isUser ? 'You' : 'Jarvis'}
        </p>
        <p className="font-sans text-sm leading-relaxed">{entry.text}</p>
      </div>
    </motion.div>
  )
}

export function ConversationTranscriptPanel() {
  const { transcript, connected, running, voiceState } = useBackend()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const visibleMessages = transcript.slice(-2)

  const busy =
    voiceState === 'listening' || voiceState === 'processing' || voiceState === 'speaking'

  const placeholder = !connected
    ? 'Connect backend in Account settings…'
    : !running
      ? 'Start assistant to begin…'
      : busy
        ? 'Jarvis is busy…'
        : 'Message Jarvis…'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleMessages])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setDraft('')
  }

  return (
    <BrutalPanel panelId="CONV" title="Conversation" className="h-full" noPadding>
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3 flex flex-col justify-end gap-3"
        >
          {visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="w-11 h-11 border-2 border-black/80 bg-[#12141c] shadow-[2px_2px_0px_0px_black] flex items-center justify-center">
                <Mic size={18} className="text-amber-400" strokeWidth={2.5} />
              </div>
              <p className="font-sans text-sm text-slate-400 leading-relaxed max-w-[240px]">
                Say &quot;Hey Jarvis&quot;, type below, or use the voice bar
              </p>
              <p className="font-mono text-[9px] text-slate-600 uppercase tracking-wider">
                Ctrl + Space to toggle mic
              </p>
            </div>
          ) : (
            visibleMessages.map((entry) => <TranscriptBubble key={entry.id} entry={entry} />)
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t-2 border-black bg-[#111318] px-3 py-3 flex items-center gap-2"
        >
          <BrutalInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={!connected || !running || busy}
            className="flex-1 min-w-0"
          />
          <button
            type="submit"
            disabled={!connected || !running || busy || draft.trim().length === 0}
            className="shrink-0 flex h-[42px] w-[42px] items-center justify-center border-2 border-black bg-pink-500 text-black shadow-[3px_3px_0px_0px_black] hover:shadow-[4px_4px_0px_0px_black] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
            title="Voice only — use the mic bar below"
          >
            <Send size={16} strokeWidth={3} />
          </button>
        </form>
      </div>
    </BrutalPanel>
  )
}

export function BackendStatusPanel() {
  const { connected, running, voiceState, error, startAssistant, stopAssistant } = useBackend()

  const pillClass = getStatusPillClasses(connected, voiceState, !!error)
  const pillText = getStatusPillText(connected, running, voiceState, !!error)

  const brutalBtn = brutalBtnClass

  return (
    <BrutalPanel panelId="STATUS" title="Status" className="h-full">
      <div className="h-full flex flex-col gap-4">
        <div
          className={`w-full px-4 py-4 border-2 border-black shadow-[4px_4px_0px_0px_black] font-mono text-sm font-bold text-black uppercase tracking-wide ${pillClass}`}
        >
          {pillText}
        </div>

        {error && (
          <div className="space-y-2">
            <p className="font-mono text-xs text-rose-500 leading-relaxed px-1 uppercase">{error}</p>
            {!connected && (
              <Link
                to="/account"
                className="inline-block font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-black bg-yellow-400 text-black shadow-[2px_2px_0px_0px_black]"
              >
                Configure backend →
              </Link>
            )}
          </div>
        )}

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => void startAssistant()}
            disabled={!connected || running}
            className={`${brutalBtn} flex-1 bg-emerald-500 text-black`}
          >
            <Power size={14} strokeWidth={3} />
            Start
          </button>
          <button
            type="button"
            onClick={() => void stopAssistant()}
            disabled={!connected || !running}
            className={`${brutalBtn} flex-1 bg-[#252833] text-slate-200`}
          >
            <PowerOff size={14} strokeWidth={3} />
            Stop
          </button>
        </div>
      </div>
    </BrutalPanel>
  )
}

export function VoiceEventsPanel() {
  const { recentEvents } = useBackend()

  return (
    <BrutalPanel panelId="EVENTS" title="Events" className="h-full">
      <div className="h-full overflow-y-auto font-mono text-sm text-slate-300 space-y-1">
        {recentEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-6">
            <div className="w-full max-w-[180px] h-1.5 border border-black bg-[#0f1016] overflow-hidden">
              <div className="h-full w-1/3 bg-yellow-400/40 animate-pulse" />
            </div>
            <p className="text-slate-500 uppercase text-xs">Waiting for events</p>
          </div>
        ) : (
          recentEvents.map((evt) => {
            const time = evt.timestamp.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="leading-relaxed"
              >
                <span className="text-yellow-400">[{time}]</span> {evt.label}
              </motion.div>
            )
          })
        )}
      </div>
    </BrutalPanel>
  )
}

export function EmailPanel() {
  const [totalUnread, setTotalUnread] = useState(0)
  const [accountCount, setAccountCount] = useState(0)
  const [firstUnread, setFirstUnread] = useState<(EmailRecentItem & { accountLabel: string }) | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const tokenConfigured = !!getToken()

  useEffect(() => {
    const load = async () => {
      if (!tokenConfigured) {
        setLoading(false)
        setFetchError('not_configured')
        return
      }

      try {
        const summary = await backendClient.getEmailSummary()
        setTotalUnread(summary.total_unread)
        setAccountCount(summary.accounts.length)
        setFetchError(null)
        let found: (EmailRecentItem & { accountLabel: string }) | null = null
        for (const account of summary.accounts) {
          const item = account.recent.find((r) => r.unread)
          if (item) {
            found = { ...item, accountLabel: account.label }
            break
          }
        }
        setFirstUnread(found)
      } catch {
        setFetchError('fetch_failed')
      } finally {
        setLoading(false)
      }
    }

    void load()
    const interval = setInterval(() => void load(), 45000)
    return () => clearInterval(interval)
  }, [tokenConfigured])

  return (
    <BrutalPanel
      panelId="EMAIL"
      title="Email"
      className="h-full"
      headerExtra={
        totalUnread > 0 ? (
          <span className="border-2 border-black bg-purple-500 text-white font-mono text-xs font-bold px-1.5 py-0.5">
            {totalUnread}
          </span>
        ) : null
      }
    >
      <div className="h-full flex flex-col gap-3">
        {loading ? (
          <p className="font-mono text-xs text-slate-500 uppercase py-4">Loading…</p>
        ) : fetchError === 'not_configured' ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="font-mono text-[10px] text-slate-400 uppercase leading-relaxed">
              Backend token required for email
            </p>
            <Link
              to="/account"
              className="font-mono text-[10px] font-bold uppercase px-3 py-1.5 border-2 border-black bg-yellow-400 text-black shadow-[3px_3px_0px_0px_black]"
            >
              Set up →
            </Link>
          </div>
        ) : accountCount === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-2 text-center">
            <div className="w-10 h-10 border-2 border-black bg-cyan-500/20 flex items-center justify-center">
              <Mail size={16} strokeWidth={3} className="text-cyan-400" />
            </div>
            <p className="font-mono text-[10px] text-slate-400 uppercase leading-relaxed">
              No inbox connected
            </p>
            <div className="flex gap-2">
              <Link
                to="/email"
                className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-black bg-cyan-500 text-black shadow-[2px_2px_0px_0px_black] flex items-center gap-1"
              >
                <Mail size={10} strokeWidth={3} /> Gmail
              </Link>
              <Link
                to="/email"
                className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-black bg-green-500 text-black shadow-[2px_2px_0px_0px_black] flex items-center gap-1"
              >
                <Server size={10} strokeWidth={3} /> IMAP
              </Link>
            </div>
          </div>
        ) : firstUnread ? (
          <>
            <div className="font-mono text-xs text-slate-400 uppercase">
              From:{' '}
              <span className="text-white">
                {firstUnread.sender_name || firstUnread.sender_email}
              </span>
            </div>
            <div
              className="flex-1 min-h-0 p-4 border-2 border-black bg-[#0f1016] overflow-hidden"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
              }}
            >
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Latest unread
              </p>
              <p className="font-mono text-sm text-slate-300 leading-relaxed line-clamp-4">
                {firstUnread.snippet || firstUnread.subject}
              </p>
            </div>
            <Link
              to="/email"
              className="font-mono text-[10px] font-bold uppercase text-cyan-400 hover:text-cyan-300"
            >
              Open email settings →
            </Link>
          </>
        ) : (
          <div className="h-full flex flex-col justify-center gap-2 py-4">
            <p className="font-mono text-xs text-slate-500 uppercase">
              {accountCount} account{accountCount === 1 ? '' : 's'} — inbox clear
            </p>
            <Link
              to="/email"
              className="font-mono text-[10px] font-bold uppercase text-cyan-400 hover:text-cyan-300 w-fit"
            >
              Manage accounts →
            </Link>
          </div>
        )}
        {fetchError === 'fetch_failed' && accountCount > 0 && (
          <p className="font-mono text-[10px] text-rose-500 uppercase">Could not refresh summary</p>
        )}
      </div>
    </BrutalPanel>
  )
}
