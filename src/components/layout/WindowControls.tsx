import { Minus, Square, X } from 'lucide-react'

export function WindowControls() {
  const minimize = () => window.jarvis?.window?.minimize()
  const maximize = () => window.jarvis?.window?.maximize()
  const close = () => window.jarvis?.window?.close()

  const btn =
    'w-8 h-8 flex items-center justify-center t-btn t-surface t-text transition-all hover:-translate-y-px'

  return (
    <div className="flex items-center gap-2 no-drag">
      <button onClick={minimize} className={btn} aria-label="Minimize">
        <Minus size={14} strokeWidth={3} />
      </button>
      <button onClick={maximize} className={btn} aria-label="Maximize">
        <Square size={11} strokeWidth={3} />
      </button>
      <button
        onClick={close}
        className="w-8 h-8 flex items-center justify-center t-btn bg-rose-500 text-black transition-all hover:-translate-y-px"
        aria-label="Close"
      >
        <X size={14} strokeWidth={3} />
      </button>
    </div>
  )
}
