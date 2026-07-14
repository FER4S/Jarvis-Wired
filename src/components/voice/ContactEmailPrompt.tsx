import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AtSign, Send } from 'lucide-react'
import { useBackend } from '@/context/BackendContext'
import { HudButton } from '@/components/ui/HudButton'

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

  // Reset + focus each time a fresh request opens.
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
      // Success: the voice loop claims it and emits contact_email_resolved,
      // which clears pendingContact and unmounts this component.
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
    <motion.form
      onSubmit={handleFormSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="no-drag w-full max-w-4xl mx-auto mb-3 flex flex-col gap-2.5 px-5 py-3.5 rounded-xl border border-[var(--cyan)]/40 bg-[rgba(56,189,248,0.06)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--cyan)]/40 bg-[rgba(56,189,248,0.12)]">
          <AtSign size={16} className="text-[var(--cyan)]" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            Type {who} email address
          </span>
          <span className="text-xs text-[var(--text-meta)] mt-0.5">…or just say it out loud.</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
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
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-meta)] outline-none transition-colors focus:border-[var(--cyan)]/60"
        />
        <HudButton
          variant="primary"
          icon={Send}
          disabled={submitting || email.trim().length === 0}
          onClick={doSubmit}
        >
          {submitting ? 'Sending…' : 'Send'}
        </HudButton>
      </div>

      {error && <span className="text-xs text-[var(--red)]">{error}</span>}
    </motion.form>
  )
}
