import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, BrutalTextarea, brutalBtnClass } from '@/components/ui/BrutalInput'
import type { MemoryProfile } from '@/services/types'

/** The keys onboarding produces, shown in this order as labelled fields. */
const CANONICAL_KEYS = ['name', 'role', 'key_people', 'priorities', 'preferences'] as const
const LONG_KEYS = new Set(['key_people', 'priorities', 'preferences'])

const LABELS: Record<string, string> = {
  name: 'Your name',
  role: 'Your role',
  key_people: 'Key people you work with',
  priorities: 'Current priorities',
  preferences: 'Preferences & working style',
  raw_qa: 'Unstructured onboarding answers'
}

function labelFor(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ')
}

interface Props {
  profile: MemoryProfile
  readOnly: boolean
  onSave: (profile: MemoryProfile) => Promise<void>
}

export function MemoryProfilePanel({ profile, readOnly, onSave }: Props) {
  const [form, setForm] = useState<MemoryProfile>(profile)
  const [extraKeys, setExtraKeys] = useState<string[]>([])
  const [newKey, setNewKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Resync when the snapshot is refetched — but never over unsaved edits.
  useEffect(() => {
    if (dirty) return
    setForm(profile)
    setExtraKeys(Object.keys(profile).filter((k) => !CANONICAL_KEYS.includes(k as never)))
  }, [profile, dirty])

  const set = (key: string, value: string) => {
    setDirty(true)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const removeKey = (key: string) => {
    setDirty(true)
    setForm((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setExtraKeys((prev) => prev.filter((k) => k !== key))
  }

  const addKey = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key || form[key] !== undefined || CANONICAL_KEYS.includes(key as never)) return
    setExtraKeys((prev) => [...prev, key])
    setForm((prev) => ({ ...prev, [key]: '' }))
    setNewKey('')
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const onlyRawQa = extraKeys.length === 1 && extraKeys[0] === 'raw_qa' &&
    !CANONICAL_KEYS.some((k) => (form[k] ?? '').trim())

  return (
    <BrutalPanel panelId="PROFILE" title="About You" fillHeight={false}>
      <div className="flex flex-col gap-4">
        <p className="font-sans text-sm t-text-secondary leading-relaxed">
          What Jarvis knows about you. This is read into every conversation, so correcting
          something here changes how he answers straight away.
        </p>

        {onlyRawQa && (
          <p className="font-mono text-xs text-amber-400 uppercase border-2 border-black bg-amber-500/10 px-3 py-2 leading-relaxed">
            Onboarding couldn't be structured into fields. Edit the answers below into the
            proper fields, then clear the leftover text.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CANONICAL_KEYS.map((key) => (
            <label
              key={key}
              className={`flex flex-col gap-1 ${LONG_KEYS.has(key) ? 'md:col-span-2' : ''}`}
            >
              <span className="font-mono text-[10px] font-bold uppercase t-label">
                {labelFor(key)}
              </span>
              {LONG_KEYS.has(key) ? (
                <BrutalTextarea
                  value={form[key] ?? ''}
                  onChange={(e) => set(key, e.target.value)}
                  disabled={readOnly}
                  rows={2}
                />
              ) : (
                <BrutalInput
                  value={form[key] ?? ''}
                  onChange={(e) => set(key, e.target.value)}
                  disabled={readOnly}
                />
              )}
            </label>
          ))}
        </div>

        {extraKeys.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] font-bold uppercase t-text-muted">
              Other saved fields
            </p>
            {extraKeys.map((key) => (
              <div key={key} className="flex items-start gap-2">
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="font-mono text-[10px] font-bold uppercase t-label">
                    {labelFor(key)}
                  </span>
                  <BrutalTextarea
                    value={form[key] ?? ''}
                    onChange={(e) => set(key, e.target.value)}
                    disabled={readOnly}
                    rows={2}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeKey(key)}
                  disabled={readOnly}
                  aria-label={`Remove ${labelFor(key)}`}
                  className="mt-5 shrink-0 p-2 border-2 border-black bg-rose-500 text-black disabled:opacity-45"
                >
                  <Trash2 size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="font-mono text-[10px] font-bold uppercase t-label">
              Add another field
            </span>
            <BrutalInput
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKey()
                }
              }}
              placeholder="e.g. timezone"
              disabled={readOnly}
            />
          </label>
          <button
            type="button"
            onClick={addKey}
            disabled={readOnly || !newKey.trim()}
            className={`${brutalBtnClass} bg-[#252833] text-slate-200`}
          >
            <Plus size={14} strokeWidth={3} /> Add
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={readOnly || saving || !dirty}
            className={`${brutalBtnClass} bg-emerald-500 text-black`}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {dirty && !readOnly && (
            <span className="font-mono text-[10px] uppercase text-amber-400">Unsaved changes</span>
          )}
        </div>
      </div>
    </BrutalPanel>
  )
}
