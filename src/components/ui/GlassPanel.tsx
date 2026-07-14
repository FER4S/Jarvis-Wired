import type { ReactNode } from 'react'
import { HudPanel } from './HudPanel'

type Accent = 'cyan' | 'green' | 'purple' | 'none'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  title?: string
  glow?: boolean
  accent?: Accent
  noPadding?: boolean
  delay?: number
  panelId?: string
  headerExtra?: ReactNode
}

export function GlassPanel({
  children,
  className = '',
  title,
  glow = false,
  accent,
  noPadding = false,
  delay = 0,
  panelId,
  headerExtra
}: GlassPanelProps) {
  const resolvedAccent = accent ?? (glow ? 'cyan' : 'none')

  return (
    <HudPanel
      title={title}
      accent={resolvedAccent}
      noPadding={noPadding}
      className={className}
      statusDot={!!title}
      delay={delay}
      id={panelId}
      headerExtra={headerExtra}
    >
      {children}
    </HudPanel>
  )
}
