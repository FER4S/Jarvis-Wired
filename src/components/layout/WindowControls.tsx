import { Minus, Square, X } from 'lucide-react'

export function WindowControls() {
  const minimize = () => window.jarvis?.window?.minimize()
  const maximize = () => window.jarvis?.window?.maximize()
  const close = () => window.jarvis?.window?.close()

  const btn =
    'w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-meta)] transition-colors'

  return (
    <div className="flex items-center gap-0.5 no-drag">
      <button
        onClick={minimize}
        className={`${btn} hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]`}
        aria-label="Minimize"
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <button
        onClick={maximize}
        className={`${btn} hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]`}
        aria-label="Maximize"
      >
        <Square size={11} strokeWidth={2} />
      </button>
      <button
        onClick={close}
        className={`${btn} hover:bg-[rgba(248,113,113,0.15)] hover:text-[var(--red)]`}
        aria-label="Close"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}
