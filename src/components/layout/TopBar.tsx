import { WindowControls } from '@/components/layout/WindowControls'
import { useBackend } from '@/context/BackendContext'
import { useClock } from '@/hooks/useClock'
import { Cpu } from 'lucide-react'

export function TopBar() {
  const { connected, reconnecting, running, voiceState } = useBackend()
  const { time, date } = useClock()

  const statusKey = connected ? 'online' : reconnecting ? 'warning' : 'offline'
  const statusLabel = connected
    ? running
      ? voiceState.replace('_', ' ')
      : 'Standby'
    : reconnecting
      ? 'Reconnecting'
      : 'Offline'

  return (
    <header className="relative h-12 shrink-0 flex items-center justify-between px-5 border-b border-[var(--border)] bg-[rgba(7,11,18,0.6)] backdrop-blur-md drag-region">
      <div className="flex items-center gap-5 no-drag">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
            <Cpu size={16} className="text-[var(--cyan)]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-orbitron text-sm font-bold tracking-[0.2em] text-[var(--text-primary)] leading-none">
              JARVIS
            </h1>
            <p className="text-[10px] text-[var(--text-meta)] mt-0.5 tracking-wide">
              Command Center
            </p>
          </div>
        </div>

        <div className="hidden md:block h-6 w-px bg-[var(--border)]" />

        <span className={`status-pill status-pill--${statusKey}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              statusKey === 'online'
                ? 'bg-[var(--green)]'
                : statusKey === 'warning'
                  ? 'bg-[var(--yellow)]'
                  : 'bg-[var(--red)]'
            } ${connected ? 'pulse-dot' : ''}`}
          />
          <span className="capitalize">{statusLabel}</span>
        </span>
      </div>

      <div className="flex items-center gap-4 no-drag">
        <div className="hidden sm:block text-right">
          <p className="font-mono-hud text-xs font-medium text-[var(--text-primary)]">{time}</p>
          <p className="text-[10px] text-[var(--text-meta)]">{date}</p>
        </div>
        <WindowControls />
      </div>
    </header>
  )
}
