import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AtSign, Send } from 'lucide-react'
import { BrutalInput } from '@/components/ui/BrutalInput'
import { useBackend } from '@/context/BackendContext'

/**
 * Shown only while the voice send flow is waiting for a recipient's email
 * address (backend event `contact_email_requested`). Lets the boss TYPE the
 * address instead of spelling it out loud — voice still works in parallel, and
 * whichever arrives first wins. Hides automatically when the backend emits
 * `contact_email_resolved` (which clears `pendingContact`).
 */
export function ContactEmailPrompt() {
  const { pendingContact, submitContactEmail } = useBackend()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pendingContact) return
    setEmail('')
    setError(null)
    setSubmitting(false)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [pendingContact])

  if (!pendingContact) return null

  const who = pendingContact.name ? `${pendingContact.name}'s` : "the recipient's"

  const doSubmit = async () => {
    const value = email.trim()
    if (!value || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await submitContactEmail(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit that address.')
      setSubmitting(false)
    }
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    void doSubmit()
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="no-drag w-full mb-3 flex flex-col gap-2.5 px-4 py-3 border-[3px] border-black bg-cyan-500/20 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-black bg-cyan-500 shadow-[3px_3px_0px_0px_black]">
          <AtSign size={16} className="text-black" strokeWidth={3} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-mono text-xs font-bold text-white uppercase tracking-wide">
            Type {who} email address
          </span>
          <span className="font-mono text-[10px] text-slate-400 mt-0.5 uppercase">
            …or just say it out loud.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <BrutalInput
          ref={inputRef}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(null)
          }}
          placeholder="name@example.com"
          autoComplete="off"
          spellCheck={false}
          disabled={submitting}
          className="flex-1 min-w-0"
        />
        <button
          type="button"
          disabled={submitting || email.trim().length === 0}
          onClick={() => void doSubmit()}
          className="shrink-0 flex items-center gap-2 px-3 py-2 font-mono text-xs font-bold uppercase border-2 border-black bg-green-500 text-black shadow-[3px_3px_0px_0px_black] hover:shadow-[4px_4px_0px_0px_black] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} strokeWidth={3} />
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>

      {error && <span className="font-mono text-xs text-rose-500 uppercase">{error}</span>}
    </form>
  )
}
