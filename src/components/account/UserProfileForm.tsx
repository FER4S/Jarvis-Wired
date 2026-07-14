import { useState, type FormEvent } from 'react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, BrutalTextarea, brutalBtnClass } from '@/components/ui/BrutalInput'
import {
  clearUserProfile,
  getUserProfile,
  saveUserProfile,
  type UserProfile
} from '@/services/userProfile'

interface UserProfileFormProps {
  onSaved?: (profile: UserProfile) => void
}

export function UserProfileForm({ onSaved }: UserProfileFormProps) {
  const [form, setForm] = useState<Omit<UserProfile, 'updatedAt'>>(() => {
    const { updatedAt: _, ...rest } = getUserProfile()
    return rest
  })
  const [savedAt, setSavedAt] = useState(getUserProfile().updatedAt)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSuccess(null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!form.fullName.trim() && !form.email.trim()) {
      setError('Add at least your name or email so Jarvis knows who you are.')
      setSubmitting(false)
      return
    }

    try {
      const saved = saveUserProfile(form)
      setSavedAt(saved.updatedAt)
      setSuccess('Profile saved locally.')
      onSaved?.(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = () => {
    clearUserProfile()
    setForm({
      fullName: '',
      email: '',
      company: '',
      role: '',
      projects: '',
      keyPeople: '',
      priorities: '',
      notes: ''
    })
    setSavedAt('')
    setError(null)
    setSuccess('Profile cleared.')
  }

  return (
    <BrutalPanel panelId="PROFILE" title="Your Profile" fillHeight={false}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="font-mono text-[10px] t-text-secondary uppercase leading-relaxed">
          Tell Jarvis who you are and what you work on. Saved on this device and used as context
          for voice and email.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase t-label">Full name</span>
            <BrutalInput
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Alex Morgan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase t-label">
              Email / username
            </span>
            <BrutalInput
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase t-label">Company</span>
            <BrutalInput
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              placeholder="CodeX"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase t-label">
              Role / title
            </span>
            <BrutalInput
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              placeholder="Founder, Engineering Lead…"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs font-bold uppercase t-label">
            Active projects
          </span>
          <BrutalTextarea
            value={form.projects}
            onChange={(e) => update('projects', e.target.value)}
            placeholder="One per line — e.g. Jarvis desktop app, client onboarding portal…"
            rows={3}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase t-label">
              Key people
            </span>
            <BrutalTextarea
              value={form.keyPeople}
              onChange={(e) => update('keyPeople', e.target.value)}
              placeholder="Michael — CTO, Sarah — client lead…"
              rows={3}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase t-label">
              Current priorities
            </span>
            <BrutalTextarea
              value={form.priorities}
              onChange={(e) => update('priorities', e.target.value)}
              placeholder="Ship v1, close Q3 deals, hire backend engineer…"
              rows={3}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs font-bold uppercase t-label">
            Notes & preferences
          </span>
          <BrutalTextarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Work style, communication preferences, timezone, anything else Jarvis should know…"
            rows={4}
          />
        </label>

        {error && (
          <p className="font-mono text-xs text-rose-500 uppercase border-2 border-black bg-rose-500/10 px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="font-mono text-xs text-green-400 uppercase border-2 border-black bg-green-500/10 px-3 py-2">
            {success}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className={`${brutalBtnClass} bg-emerald-500 text-black`}
          >
            {submitting ? 'Saving…' : 'Save Profile'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={submitting}
            className={`${brutalBtnClass} bg-rose-500 text-black`}
          >
            Clear Profile
          </button>
          {savedAt && (
            <span className="font-mono text-[10px] t-text-muted uppercase">
              Last saved {new Date(savedAt).toLocaleString()}
            </span>
          )}
        </div>
      </form>
    </BrutalPanel>
  )
}
