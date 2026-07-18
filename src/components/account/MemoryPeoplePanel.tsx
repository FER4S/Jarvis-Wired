import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { BrutalInput, brutalBtnClass } from '@/components/ui/BrutalInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { MemoryPerson } from '@/services/types'

interface Props {
  people: MemoryPerson[]
  readOnly: boolean
  onAdd: (body: { name: string; notes: string; email: string }) => Promise<void>
  onUpdate: (id: string, body: { name: string; notes: string; email: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const EMPTY = { name: '', notes: '', email: '' }

export function MemoryPeoplePanel({ people, readOnly, onAdd, onUpdate, onDelete }: Props) {
  const [draft, setDraft] = useState(EMPTY)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<MemoryPerson | null>(null)

  const startEdit = (person: MemoryPerson) => {
    setEditingId(person.id)
    setEdit({ name: person.name, notes: person.notes, email: person.email })
  }

  const submitAdd = async () => {
    if (!draft.name.trim()) return
    setBusy(true)
    try {
      await onAdd(draft)
      setDraft(EMPTY)
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  const submitEdit = async (id: string) => {
    if (!edit.name.trim()) return
    setBusy(true)
    try {
      await onUpdate(id, edit)
      setEditingId(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    setBusy(true)
    try {
      await onDelete(target.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <BrutalPanel
        panelId="PEOPLE"
        title={`People (${people.length})`}
        fillHeight={false}
        headerExtra={
          !readOnly && !adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase border-2 border-black bg-amber-400 text-black"
            >
              <Plus size={12} strokeWidth={3} /> Add
            </button>
          ) : null
        }
      >
        <div className="flex flex-col gap-3">
          <p className="font-sans text-sm t-text-secondary leading-relaxed">
            Everyone Jarvis knows about. A saved email address is what he sends to when you say
            “email Michael”, so it's worth getting right.
          </p>

          {adding && (
            <div className="flex flex-col gap-2 p-3 t-surface">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <BrutalInput
                  autoFocus
                  placeholder="Name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <BrutalInput
                  placeholder="Email (optional)"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              <BrutalInput
                placeholder="Notes — role, company, context (optional)"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void submitAdd()}
                  disabled={busy || !draft.name.trim()}
                  className={`${brutalBtnClass} bg-emerald-500 text-black`}
                >
                  Save person
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    setDraft(EMPTY)
                  }}
                  className={`${brutalBtnClass} bg-[#252833] text-slate-200`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {people.length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="w-14 h-14 border-2 border-black bg-[#0f1016] shadow-[4px_4px_0px_0px_black] flex items-center justify-center font-mono text-lg text-slate-500">
                @
              </div>
              <p className="font-mono text-xs text-slate-400 uppercase max-w-[260px] leading-relaxed">
                No people saved yet. Add one above, or paste a whole list in the Import tab.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {people.map((person) =>
                editingId === person.id ? (
                  <div key={person.id} className="flex flex-col gap-2 p-3 t-surface">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <BrutalInput
                        autoFocus
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                        placeholder="Name"
                      />
                      <BrutalInput
                        value={edit.email}
                        onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                        placeholder="Email — clear the box to remove it"
                      />
                    </div>
                    <BrutalInput
                      value={edit.notes}
                      onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                      placeholder="Notes"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void submitEdit(person.id)}
                        disabled={busy || !edit.name.trim()}
                        className={`${brutalBtnClass} bg-emerald-500 text-black`}
                      >
                        <Check size={14} strokeWidth={3} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={`${brutalBtnClass} bg-[#252833] text-slate-200`}
                      >
                        <X size={14} strokeWidth={3} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={person.id}
                    className="flex items-start justify-between gap-3 p-3 t-surface"
                  >
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <p className="font-sans text-sm font-semibold t-text truncate">
                        {person.name}
                      </p>
                      {person.email ? (
                        <p className="font-mono text-[11px] text-amber-400/90 truncate">
                          {person.email}
                        </p>
                      ) : (
                        <p className="font-mono text-[10px] uppercase t-text-muted">
                          No email saved
                        </p>
                      )}
                      {person.notes && (
                        <p className="font-sans text-xs t-text-secondary break-words leading-relaxed">
                          {person.notes}
                        </p>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(person)}
                          aria-label={`Edit ${person.name}`}
                          className="p-1.5 border-2 border-black bg-cyan-500 text-black"
                        >
                          <Pencil size={14} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(person)}
                          aria-label={`Delete ${person.name}`}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this person?"
        message={`Jarvis will forget ${pendingDelete?.name ?? 'this person'}${
          pendingDelete?.email ? ` and their address (${pendingDelete.email})` : ''
        }. You'll have to add them again by hand.`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}
