import { useState } from 'react'
import { AlertTriangle, Upload } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, BrutalTextarea, brutalBtnClass } from '@/components/ui/BrutalInput'
import { backendClient } from '@/services/backendClient'
import type {
  MemoryImportCommitRequest,
  MemoryImportPreview,
  MemoryImportResult
} from '@/services/types'

interface Props {
  readOnly: boolean
  onCommitted: (result: MemoryImportResult) => Promise<void>
  onError: (message: string) => void
}

/** A preview row plus the boss's edits to it. */
interface EditableRow {
  include: boolean
  name: string
  notes: string
  email: string
  replaceEmail: boolean
  emailStatus: string
  action: 'new' | 'merge'
  existingNotes: string
  existingEmail: string
  notesPreview: string
}

export function MemoryImportPanel({ readOnly, onCommitted, onError }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [preview, setPreview] = useState<MemoryImportPreview | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [facts, setFacts] = useState<Array<{ include: boolean; text: string }>>([])
  const [events, setEvents] = useState<
    Array<{ include: boolean; description: string; date: string }>
  >([])

  const runPreview = async () => {
    setLoading(true)
    try {
      const result = await backendClient.previewMemoryImport(text)
      setPreview(result)
      setRows(
        result.people.map((p) => ({
          include: true,
          name: p.name,
          notes: p.notes,
          email: p.email,
          replaceEmail: false,
          emailStatus: p.email_status,
          action: p.action,
          existingNotes: p.existing_notes,
          existingEmail: p.existing_email,
          notesPreview: p.notes_preview
        }))
      )
      setFacts(result.facts.map((f) => ({ include: true, text: f })))
      setEvents(result.events.map((e) => ({ include: true, description: e.description, date: e.date })))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that text.')
    } finally {
      setLoading(false)
    }
  }

  const commit = async () => {
    setCommitting(true)
    try {
      const body: MemoryImportCommitRequest = {
        people: rows
          .filter((r) => r.include && r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            notes: r.notes.trim(),
            email: r.email.trim(),
            replace_email: r.replaceEmail
          })),
        facts: facts.filter((f) => f.include && f.text.trim()).map((f) => f.text.trim()),
        events: events
          .filter((e) => e.include && e.description.trim())
          .map((e) => ({ description: e.description.trim(), date: e.date.trim() }))
      }
      const result = await backendClient.commitMemoryImport(body)
      await onCommitted(result)
      setPreview(null)
      setRows([])
      setFacts([])
      setEvents([])
      setText('')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save those entries.')
    } finally {
      setCommitting(false)
    }
  }

  const selectedCount =
    rows.filter((r) => r.include).length +
    facts.filter((f) => f.include).length +
    events.filter((e) => e.include).length

  return (
    <div className="flex flex-col gap-4">
      <BrutalPanel panelId="IMPORT" title="Paste & Import" fillHeight={false}>
        <div className="flex flex-col gap-3">
          <p className="font-sans text-sm t-text-secondary leading-relaxed">
            Paste a list of contacts, notes, anything. Jarvis will sort it into people, facts and
            events, and show you exactly what he'd save — <strong className="t-text">nothing is
            stored until you press Import</strong>, and you can edit every row first.
          </p>

          <BrutalTextarea
            rows={8}
            placeholder={
              'Michael Heckin — CTO — michael@codex.com\nSara Duarte, design lead, sara@codex.com\nBoard meeting on 2026-09-01\nI prefer afternoon meetings'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={readOnly || loading}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={readOnly || loading || !text.trim()}
              className={`${brutalBtnClass} bg-cyan-500 text-black`}
            >
              <Upload size={14} strokeWidth={3} />
              {loading ? 'Reading…' : 'Read it'}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null)
                  setRows([])
                  setFacts([])
                  setEvents([])
                }}
                className={`${brutalBtnClass} bg-[#252833] text-slate-200`}
              >
                Discard
              </button>
            )}
          </div>
        </div>
      </BrutalPanel>

      {preview && (
        <BrutalPanel
          panelId="REVIEW"
          title={`Review — ${selectedCount} selected`}
          fillHeight={false}
        >
          <div className="flex flex-col gap-4">
            {preview.warnings.map((w) => (
              <p
                key={w}
                className="font-mono text-xs text-amber-400 uppercase border-2 border-black bg-amber-500/10 px-3 py-2 leading-relaxed flex items-start gap-2"
              >
                <AlertTriangle size={14} strokeWidth={3} className="shrink-0 mt-0.5" />
                {w}
              </p>
            ))}

            {rows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] font-bold uppercase t-text-muted">
                  People ({rows.length})
                </p>
                {rows.map((row, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 t-surface">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))
                        }
                        className="w-4 h-4 shrink-0 accent-amber-400"
                        aria-label={`Include ${row.name}`}
                      />
                      <span
                        className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase border-2 border-black ${
                          row.action === 'new' ? 'bg-emerald-500 text-black' : 'bg-cyan-500 text-black'
                        }`}
                      >
                        {row.action === 'new' ? 'New' : 'Merge'}
                      </span>
                      {row.emailStatus !== 'ok' && (
                        <span className="px-2 py-0.5 font-mono text-[9px] font-bold uppercase border-2 border-black bg-rose-500 text-black">
                          {row.emailStatus === 'not_in_source' ? 'Address not in text' : 'Bad address'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <BrutalInput
                        value={row.name}
                        placeholder="Name"
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                      />
                      <BrutalInput
                        value={row.email}
                        placeholder="Email"
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (j === i ? { ...r, email: e.target.value } : r)))
                        }
                      />
                    </div>
                    <BrutalInput
                      value={row.notes}
                      placeholder="Notes"
                      onChange={(e) =>
                        setRows(rows.map((r, j) => (j === i ? { ...r, notes: e.target.value } : r)))
                      }
                    />

                    {row.action === 'merge' && (
                      <div className="flex flex-col gap-1.5 pl-1 border-l-2 border-cyan-500/40">
                        <p className="font-mono text-[10px] uppercase t-text-muted">
                          Notes will become:{' '}
                          <span className="t-text-secondary normal-case">{row.notesPreview}</span>
                        </p>
                        {row.existingEmail && row.email && row.existingEmail !== row.email && (
                          <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-amber-400">
                            <input
                              type="checkbox"
                              checked={row.replaceEmail}
                              onChange={(e) =>
                                setRows(
                                  rows.map((r, j) =>
                                    j === i ? { ...r, replaceEmail: e.target.checked } : r
                                  )
                                )
                              }
                              className="w-3.5 h-3.5 accent-amber-400"
                            />
                            Replace saved address ({row.existingEmail})
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {facts.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] font-bold uppercase t-text-muted">
                  Facts ({facts.length})
                </p>
                {facts.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 t-surface">
                    <input
                      type="checkbox"
                      checked={f.include}
                      onChange={(e) =>
                        setFacts(facts.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))
                      }
                      className="w-4 h-4 shrink-0 accent-amber-400"
                      aria-label="Include fact"
                    />
                    <BrutalInput
                      value={f.text}
                      onChange={(e) =>
                        setFacts(facts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {events.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] font-bold uppercase t-text-muted">
                  Events ({events.length})
                </p>
                {events.map((ev, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 t-surface">
                    <input
                      type="checkbox"
                      checked={ev.include}
                      onChange={(e) =>
                        setEvents(events.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))
                      }
                      className="w-4 h-4 shrink-0 accent-amber-400"
                      aria-label="Include event"
                    />
                    <BrutalInput
                      value={ev.description}
                      onChange={(e) =>
                        setEvents(
                          events.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                        )
                      }
                    />
                    <BrutalInput
                      className="sm:max-w-[180px]"
                      placeholder="When"
                      value={ev.date}
                      onChange={(e) =>
                        setEvents(events.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void commit()}
              disabled={readOnly || committing || selectedCount === 0}
              className={`${brutalBtnClass} bg-emerald-500 text-black self-start`}
            >
              {committing ? 'Importing…' : `Import ${selectedCount} item${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </BrutalPanel>
      )}
    </div>
  )
}
