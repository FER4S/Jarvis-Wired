import { useState, type FormEvent } from 'react'
import { Mail, Server } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, brutalBtnClass } from '@/components/ui/BrutalInput'
import { backendClient } from '@/services/backendClient'
import type { ImapAccountRequest } from '@/services/types'

const IMAP_PRESETS = [
  { id: 'hostinger', label: 'Hostinger', host: 'imap.hostinger.com', port: 993 },
  { id: 'gmail', label: 'Gmail IMAP', host: 'imap.gmail.com', port: 993 },
  { id: 'outlook', label: 'Outlook', host: 'outlook.office365.com', port: 993 },
  { id: 'custom', label: 'Custom', host: '', port: 993 }
] as const

type Provider = 'gmail' | 'imap'

interface EmailSetupSectionProps {
  onSuccess: () => void
  disabled?: boolean
}

export function EmailSetupSection({ onSuccess, disabled = false }: EmailSetupSectionProps) {
  const [provider, setProvider] = useState<Provider>('gmail')
  const [preset, setPreset] = useState<(typeof IMAP_PRESETS)[number]['id']>('hostinger')
  const [imapError, setImapError] = useState<string | null>(null)
  const [gmailError, setGmailError] = useState<string | null>(null)
  const [submittingImap, setSubmittingImap] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)

  const [imapForm, setImapForm] = useState<ImapAccountRequest>({
    label: '',
    host: 'imap.hostinger.com',
    port: 993,
    username: '',
    password: '',
    use_ssl: true
  })

  const applyPreset = (id: (typeof IMAP_PRESETS)[number]['id']) => {
    setPreset(id)
    const selected = IMAP_PRESETS.find((p) => p.id === id)
    if (!selected || id === 'custom') return
    setImapForm((f) => ({
      ...f,
      host: selected.host,
      port: selected.port,
      use_ssl: true
    }))
  }

  const handleImapSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmittingImap(true)
    setImapError(null)
    try {
      await backendClient.addImapAccount(imapForm)
      setImapForm((f) => ({ ...f, password: '', username: '', label: '' }))
      onSuccess()
    } catch (err) {
      setImapError(err instanceof Error ? err.message : 'Failed to add account')
    } finally {
      setSubmittingImap(false)
    }
  }

  const handleGmailConnect = async () => {
    setConnectingGmail(true)
    setGmailError(null)
    try {
      const { url } = await backendClient.getGmailOAuthUrl()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Failed to get Gmail URL')
    } finally {
      setConnectingGmail(false)
    }
  }

  return (
    <BrutalPanel panelId="SETUP" title="Connect Email" className="h-full min-h-[420px]">
      <div className="h-full flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setProvider('gmail')}
            className={`p-4 text-left border-2 border-black transition-shadow ${
              provider === 'gmail'
                ? 'bg-cyan-500 text-black shadow-[4px_4px_0px_0px_black]'
                : 'bg-[#0f1016] text-white hover:shadow-[3px_3px_0px_0px_black]'
            }`}
          >
            <Mail size={18} strokeWidth={3} className="mb-2" />
            <p className="font-mono text-xs font-bold uppercase">Gmail</p>
            <p className="font-mono text-[10px] mt-1 opacity-80">OAuth — recommended</p>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setProvider('imap')}
            className={`p-4 text-left border-2 border-black transition-shadow ${
              provider === 'imap'
                ? 'bg-green-500 text-black shadow-[4px_4px_0px_0px_black]'
                : 'bg-[#0f1016] text-white hover:shadow-[3px_3px_0px_0px_black]'
            }`}
          >
            <Server size={18} strokeWidth={3} className="mb-2" />
            <p className="font-mono text-xs font-bold uppercase">IMAP</p>
            <p className="font-mono text-[10px] mt-1 opacity-80">Hostinger, Outlook, custom</p>
          </button>
        </div>

        {provider === 'gmail' ? (
          <div className="flex-1 flex flex-col gap-4">
            <ol className="font-mono text-[10px] text-slate-400 uppercase space-y-2 list-decimal list-inside leading-relaxed">
              <li>Click connect — Google opens in your browser</li>
              <li>Approve access for Jarvis</li>
              <li>Close the tab — account appears below within seconds</li>
            </ol>
            <button
              type="button"
              onClick={() => void handleGmailConnect()}
              disabled={disabled || connectingGmail}
              className={`${brutalBtnClass} flex items-center justify-center gap-2 bg-cyan-500 text-black mt-auto`}
            >
              <Mail size={14} strokeWidth={3} />
              {connectingGmail ? 'Opening browser…' : 'Connect Gmail'}
            </button>
            <p className="font-mono text-[10px] text-slate-500 uppercase">
              OAuth link expires in 10 minutes. Fetch a fresh URL for each attempt.
            </p>
            {gmailError && (
              <p className="font-mono text-[10px] text-rose-500 uppercase border-2 border-black bg-rose-500/10 px-2 py-1.5">
                {gmailError}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleImapSubmit} className="flex-1 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {IMAP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyPreset(p.id)}
                  className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase border-2 border-black ${
                    preset === p.id
                      ? 'bg-yellow-400 text-black'
                      : 'bg-[#0f1016] text-slate-300 hover:bg-[#2a2d3a]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Account label
              </span>
              <BrutalInput
                placeholder="Work inbox"
                value={imapForm.label}
                onChange={(e) => setImapForm((f) => ({ ...f, label: e.target.value }))}
                className="text-xs"
                required
                disabled={disabled}
              />
            </label>

            <div className="grid grid-cols-[1fr_88px] gap-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] font-bold uppercase text-slate-400">Host</span>
                <BrutalInput
                  placeholder="imap.example.com"
                  value={imapForm.host}
                  onChange={(e) => setImapForm((f) => ({ ...f, host: e.target.value }))}
                  className="text-xs"
                  required
                  disabled={disabled}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] font-bold uppercase text-slate-400">Port</span>
                <BrutalInput
                  type="number"
                  value={imapForm.port}
                  onChange={(e) => setImapForm((f) => ({ ...f, port: Number(e.target.value) }))}
                  className="text-xs"
                  required
                  disabled={disabled}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Username / email
              </span>
              <BrutalInput
                placeholder="you@domain.com"
                value={imapForm.username}
                onChange={(e) => setImapForm((f) => ({ ...f, username: e.target.value }))}
                className="text-xs"
                required
                disabled={disabled}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Password / app password
              </span>
              <BrutalInput
                type="password"
                placeholder="••••••••"
                value={imapForm.password}
                onChange={(e) => setImapForm((f) => ({ ...f, password: e.target.value }))}
                className="text-xs"
                required
                disabled={disabled}
              />
            </label>

            {imapError && (
              <p className="font-mono text-[10px] text-rose-500 uppercase border-2 border-black bg-rose-500/10 px-2 py-1.5">
                {imapError}
              </p>
            )}

            <button
              type="submit"
              disabled={disabled || submittingImap}
              className={`${brutalBtnClass} bg-emerald-500 text-black mt-auto`}
            >
              {submittingImap ? 'Connecting…' : 'Add IMAP Account'}
            </button>
          </form>
        )}
      </div>
    </BrutalPanel>
  )
}
