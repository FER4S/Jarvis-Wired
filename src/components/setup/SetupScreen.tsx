import { useCallback, useEffect, useRef, useState } from 'react'

interface SetupScreenProps {
  onComplete: () => void
}

interface Progress {
  pct: number
  phase: string
  detail: string
}

/**
 * Shown on first launch (before the backend is booted) while the app installs
 * the GPU Python deps + downloads the voice models. Driven entirely by
 * `window.jarvis.setup` IPC from the Electron main process (see provision.py).
 * Plain but functional — the front-end dev can restyle to match the theme.
 */
export function SetupScreen({ onComplete }: SetupScreenProps) {
  const setup = window.jarvis?.setup
  const [progress, setProgress] = useState<Progress>({ pct: 0, phase: 'deps', detail: 'Preparing…' })
  const [logLines, setLogLines] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!setup) {
      onComplete()
      return
    }
    const unsubs = [
      setup.onProgress((p) => {
        setError(null)
        setProgress(p)
      }),
      setup.onLog((line) => setLogLines((prev) => [...prev, line].slice(-300))),
      setup.onDone(() => onComplete()),
      setup.onError((e) => setError(e.message))
    ]
    setup.begin()
    return () => unsubs.forEach((u) => u())
  }, [setup, onComplete])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logLines])

  const retry = useCallback(() => {
    setError(null)
    setLogLines([])
    setProgress({ pct: 0, phase: 'deps', detail: 'Retrying…' })
    setup?.retry()
  }, [setup])

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-[var(--bg-base,#070b12)] text-[var(--text-primary,#e5eefc)] [-webkit-app-region:drag]">
      <button
        onClick={() => window.jarvis?.window?.close()}
        aria-label="Close"
        className="no-drag [-webkit-app-region:no-drag] absolute right-4 top-4 rounded px-3 py-1 text-sm text-[var(--text-meta,#7a8ba3)] transition-colors hover:text-[var(--red,#f87171)]"
      >
        ✕
      </button>

      <div className="w-full max-w-xl px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Setting up JARVIS</h1>
        <p className="mt-2 text-sm text-[var(--text-meta,#7a8ba3)]">
          First-time setup downloads the AI engine (~4–5 GB) and voice models. It runs once and
          needs an internet connection — after it finishes, JARVIS starts instantly every launch.
        </p>

        <div className="mt-8">
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-[var(--border,#1e2c40)] bg-[var(--bg-surface,#0e1826)]">
            <div
              className="h-full rounded-full bg-[var(--cyan,#38bdf8)] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, progress.pct)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary,#b9c6da)]">{progress.detail}</span>
            <span className="tabular-nums text-[var(--cyan-bright,#7dd3fc)]">{progress.pct}%</span>
          </div>
        </div>

        <div
          ref={logRef}
          className="no-drag [-webkit-app-region:no-drag] mt-6 h-40 overflow-y-auto rounded-lg border border-[var(--border,#1e2c40)] bg-[var(--bg-surface,#0e1826)] p-3 font-mono text-xs leading-relaxed text-[var(--text-meta,#7a8ba3)]"
        >
          {logLines.length === 0 ? (
            <div className="opacity-60">Starting…</div>
          ) : (
            logLines.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {l}
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="no-drag [-webkit-app-region:no-drag] mt-5 rounded-lg border border-[var(--red,#f87171)]/40 bg-[rgba(248,113,113,0.08)] p-4">
            <p className="text-sm text-[var(--red,#f87171)]">{error}</p>
            <button
              onClick={retry}
              className="mt-3 rounded-lg border border-[var(--cyan,#38bdf8)]/50 bg-[rgba(56,189,248,0.12)] px-4 py-2 text-sm font-medium text-[var(--cyan-bright,#7dd3fc)] transition-colors hover:bg-[rgba(56,189,248,0.2)]"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
