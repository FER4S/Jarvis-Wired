import { useEffect, useRef } from 'react'
import { brutalBtnClass } from './BrutalInput'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive (red). */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Blocking yes/no dialog, used before anything is deleted from memory.
 *
 * Deletes elsewhere in this app fire immediately (see EmailPage), which is fine
 * for a re-addable account — but memory holds things the boss can't reconstruct,
 * so every destructive action here goes through a confirm step. Focus lands on
 * Cancel, and Escape dismisses, so the safe path is always the default one.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md t-panel"
      >
        <div className="flex items-center justify-between shrink-0 t-panel-header px-4 py-2.5">
          <h3 className="font-sans text-xs font-semibold tracking-wide t-text truncate">{title}</h3>
          <span className="font-mono text-[9px] font-medium uppercase tracking-widest t-text-muted shrink-0">
            CONFIRM
          </span>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p className="font-sans text-sm t-text-secondary leading-relaxed break-words">{message}</p>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className={`${brutalBtnClass} bg-[#252833] text-slate-200`}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`${brutalBtnClass} ${
                destructive ? 'bg-rose-500 text-black' : 'bg-emerald-500 text-black'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
