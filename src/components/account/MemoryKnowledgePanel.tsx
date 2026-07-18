import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, brutalBtnClass } from '@/components/ui/BrutalInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { MemoryEvent, MemoryFact } from '@/services/types'

interface Props {
  facts: MemoryFact[]
  events: MemoryEvent[]
  readOnly: boolean
  onAddFact: (text: string) => Promise<void>
  onUpdateFact: (id: string, text: string) => Promise<void>
  onDeleteFact: (id: string) => Promise<void>
  onAddEvent: (body: { description: string; date: string }) => Promise<void>
  onUpdateEvent: (id: string, body: { description: string; date: string }) => Promise<void>
  onDeleteEvent: (id: string) => Promise<void>
}

type PendingDelete =
  | { kind: 'fact'; id: string; label: string }
  | { kind: 'event'; id: string; label: string }
  | null

export function MemoryKnowledgePanel({
  facts,
  events,
  readOnly,
  onAddFact,
  onUpdateFact,
  onDeleteFact,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent
}: Props) {
  const [newFact, setNewFact] = useState('')
  const [editingFact, setEditingFact] = useState<string | null>(null)
  const [factDraft, setFactDraft] = useState('')

  const [newEvent, setNewEvent] = useState({ description: '', date: '' })
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [eventDraft, setEventDraft] = useState({ description: '', date: '' })

  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    await run(() =>
      target.kind === 'fact' ? onDeleteFact(target.id) : onDeleteEvent(target.id)
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <BrutalPanel panelId="FACTS" title={`Facts (${facts.length})`} fillHeight={false}>
          <div className="flex flex-col gap-3">
            <p className="font-sans text-sm t-text-secondary leading-relaxed">
              Things Jarvis has learned about you — from “remember that…” and from what he picks
              up in conversation. Deleting one removes it now, but he can learn it again if you
              mention it later.
            </p>

            {!readOnly && (
              <div className="flex gap-2">
                <BrutalInput
                  placeholder="Add something Jarvis should remember"
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFact.trim()) {
                      e.preventDefault()
                      void run(async () => {
                        await onAddFact(newFact)
                        setNewFact('')
                      })
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !newFact.trim()}
                  onClick={() =>
                    void run(async () => {
                      await onAddFact(newFact)
                      setNewFact('')
                    })
                  }
                  className={`${brutalBtnClass} bg-amber-400 text-black shrink-0`}
                >
                  <Plus size={14} strokeWidth={3} /> Add
                </button>
              </div>
            )}

            {facts.length === 0 ? (
              <p className="font-mono text-xs t-text-muted uppercase py-4 text-center">
                Nothing remembered yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {facts.map((fact) =>
                  editingFact === fact.id ? (
                    <div key={fact.id} className="flex gap-2 p-2 t-surface">
                      <BrutalInput
                        autoFocus
                        value={factDraft}
                        onChange={(e) => setFactDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={busy || !factDraft.trim()}
                        onClick={() =>
                          void run(async () => {
                            await onUpdateFact(fact.id, factDraft)
                            setEditingFact(null)
                          })
                        }
                        aria-label="Save fact"
                        className="p-2 border-2 border-black bg-emerald-500 text-black shrink-0"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFact(null)}
                        aria-label="Cancel"
                        className="p-2 border-2 border-black bg-[#252833] text-slate-200 shrink-0"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <div key={fact.id} className="flex items-start justify-between gap-3 p-3 t-surface">
                      <p className="font-sans text-sm t-text break-words leading-relaxed min-w-0">
                        {fact.text}
                      </p>
                      {!readOnly && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFact(fact.id)
                              setFactDraft(fact.text)
                            }}
                            aria-label="Edit fact"
                            className="p-1.5 border-2 border-black bg-cyan-500 text-black"
                          >
                            <Pencil size={14} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({ kind: 'fact', id: fact.id, label: fact.text })
                            }
                            aria-label="Delete fact"
                            className="p-1.5 border-2 border-black bg-rose-500 text-black"
                          >
                            <Trash2 size={14} strokeWidth={3} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </BrutalPanel>

        <BrutalPanel panelId="EVENTS" title={`Events (${events.length})`} fillHeight={false}>
          <div className="flex flex-col gap-3">
            <p className="font-sans text-sm t-text-secondary leading-relaxed">
              Dated things Jarvis is holding on to. The date is free text — whatever was said —
              so “next Friday”, “2026-09-01” and an empty date are all fine.
            </p>

            {!readOnly && (
              <div className="flex flex-col sm:flex-row gap-2">
                <BrutalInput
                  placeholder="What's happening"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
                <BrutalInput
                  placeholder="When (optional)"
                  className="sm:max-w-[200px]"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
                <button
                  type="button"
                  disabled={busy || !newEvent.description.trim()}
                  onClick={() =>
                    void run(async () => {
                      await onAddEvent(newEvent)
                      setNewEvent({ description: '', date: '' })
                    })
                  }
                  className={`${brutalBtnClass} bg-amber-400 text-black shrink-0`}
                >
                  <Plus size={14} strokeWidth={3} /> Add
                </button>
              </div>
            )}

            {events.length === 0 ? (
              <p className="font-mono text-xs t-text-muted uppercase py-4 text-center">
                No events saved.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map((event) =>
                  editingEvent === event.id ? (
                    <div key={event.id} className="flex flex-col sm:flex-row gap-2 p-2 t-surface">
                      <BrutalInput
                        autoFocus
                        value={eventDraft.description}
                        onChange={(e) =>
                          setEventDraft({ ...eventDraft, description: e.target.value })
                        }
                      />
                      <BrutalInput
                        className="sm:max-w-[200px]"
                        placeholder="Clear to remove the date"
                        value={eventDraft.date}
                        onChange={(e) => setEventDraft({ ...eventDraft, date: e.target.value })}
                      />
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busy || !eventDraft.description.trim()}
                          onClick={() =>
                            void run(async () => {
                              await onUpdateEvent(event.id, eventDraft)
                              setEditingEvent(null)
                            })
                          }
                          aria-label="Save event"
                          className="p-2 border-2 border-black bg-emerald-500 text-black"
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEvent(null)}
                          aria-label="Cancel"
                          className="p-2 border-2 border-black bg-[#252833] text-slate-200"
                        >
                          <X size={14} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={event.id}
                      className="flex items-start justify-between gap-3 p-3 t-surface"
                    >
                      <div className="min-w-0">
                        <p className="font-sans text-sm t-text break-words leading-relaxed">
                          {event.description}
                        </p>
                        <p className="font-mono text-[11px] text-amber-400/90 mt-0.5">
                          {event.date || 'no date'}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(event.id)
                              setEventDraft({ description: event.description, date: event.date })
                            }}
                            aria-label="Edit event"
                            className="p-1.5 border-2 border-black bg-cyan-500 text-black"
                          >
                            <Pencil size={14} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                kind: 'event',
                                id: event.id,
                                label: event.description
                              })
                            }
                            aria-label="Delete event"
                            className="p-1.5 border-2 border-black bg-rose-500 text-black"
                          >
                            <Trash2 size={14} strokeWidth={3} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </BrutalPanel>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'event' ? 'Delete this event?' : 'Delete this fact?'}
        message={`Jarvis will forget: “${pendingDelete?.label ?? ''}”`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}
