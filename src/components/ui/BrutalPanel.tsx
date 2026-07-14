import type { ReactNode } from 'react'

interface BrutalPanelProps {
  panelId: string
  title: string
  children: ReactNode
  className?: string
  noPadding?: boolean
  headerExtra?: ReactNode
  /** When false, panel sizes to its content (for scrollable settings pages). */
  fillHeight?: boolean
}

export function BrutalPanel({
  panelId,
  title,
  children,
  className = '',
  noPadding = false,
  headerExtra,
  fillHeight = true
}: BrutalPanelProps) {
  return (
    <div
      className={`flex flex-col t-panel ${
        fillHeight ? 'min-h-0 h-full overflow-hidden' : 'h-auto shrink-0'
      } ${className}`}
    >
      <div className="flex items-center justify-between shrink-0 t-panel-header px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="font-sans text-xs font-semibold tracking-wide t-text truncate">
            {title}
          </h3>
          {headerExtra}
        </div>
        <span className="font-mono text-[9px] font-medium uppercase tracking-widest t-text-muted shrink-0">
          {panelId}
        </span>
      </div>
      <div
        className={`flex flex-col ${
          fillHeight ? 'flex-1 min-h-0 overflow-hidden' : ''
        } ${noPadding ? '' : 'p-4'}`}
      >
        {children}
      </div>
    </div>
  )
}
