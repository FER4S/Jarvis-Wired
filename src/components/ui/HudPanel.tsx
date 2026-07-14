import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type Accent = 'cyan' | 'green' | 'purple' | 'none'

interface HudPanelProps {
  children: ReactNode
  className?: string
  title?: string
  accent?: Accent
  noPadding?: boolean
  statusDot?: boolean
  headerExtra?: ReactNode
  delay?: number
  id?: string
}

const accentClass: Record<Accent, string> = {
  cyan: 'hud-panel-accent-cyan',
  green: 'hud-panel-accent-green',
  purple: 'hud-panel-accent-purple',
  none: ''
}

export function HudPanel({
  children,
  className = '',
  title,
  accent = 'none',
  noPadding = false,
  statusDot = false,
  headerExtra,
  delay = 0,
  id
}: HudPanelProps) {
  const pad = noPadding ? '' : 'p-4'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`hud-panel relative flex flex-col min-h-0 h-full overflow-hidden ${pad} ${accentClass[accent]} ${className}`}
    >
      <div className="panel-shine" />
      {accent !== 'none' && (
        <div
          className={`absolute top-0 left-0 right-0 h-px pointer-events-none ${
            accent === 'purple'
              ? 'bg-gradient-to-r from-transparent via-[var(--purple)] to-transparent opacity-40'
              : accent === 'green'
                ? 'bg-gradient-to-r from-transparent via-[var(--green)] to-transparent opacity-40'
                : 'bg-gradient-to-r from-transparent via-[var(--cyan)] to-transparent opacity-50'
          }`}
        />
      )}
      {id && (
        <span className="absolute top-3 right-4 font-mono-hud text-[10px] text-[var(--text-meta)] opacity-60">
          {id}
        </span>
      )}
      {title && (
        <div className="flex items-center justify-between mb-3 shrink-0 pr-10">
          <div className="flex items-center gap-2.5">
            <h3 className="hud-label text-[var(--text-secondary)]">{title}</h3>
            {headerExtra}
          </div>
          {statusDot && !headerExtra && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] live-pulse" />
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden relative">{children}</div>
    </motion.div>
  )
}
