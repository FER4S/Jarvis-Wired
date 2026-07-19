import { NavLink } from 'react-router-dom'
import { WindowControls } from '@/components/layout/WindowControls'
import { useBackend } from '@/context/BackendContext'
import { getAppVersion } from '@/services/release'

const navLinks = [
  { to: '/', label: 'Command', end: true },
  { to: '/email', label: 'Email' },
  { to: '/system', label: 'System' },
  { to: '/account', label: 'Account' }
] as const

export function TopBar() {
  const { connected } = useBackend()

  return (
    <header className="relative shrink-0 flex items-center justify-between gap-4 px-4 py-3 t-elevated drag-region">
      <div className="flex items-center gap-5 no-drag min-w-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 t-accent-mark flex items-center justify-center">
            <span className="font-mono text-xs font-bold">J</span>
          </div>
          <div className="hidden sm:block">
            <p className="font-sans text-sm font-semibold t-text leading-none">Jarvis</p>
            <p className="font-mono text-[9px] t-text-muted uppercase tracking-wider mt-0.5">
              Command Center <span className="opacity-70">v{getAppVersion()}</span>
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto">
          {navLinks.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide whitespace-nowrap transition-colors ${
                  isActive
                    ? 't-nav-active font-bold'
                    : 't-nav-inactive font-medium'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 no-drag shrink-0">
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 t-surface border">
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`}
          />
          <span className="font-mono text-[9px] uppercase t-text-muted">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
        <WindowControls />
      </div>
    </header>
  )
}
