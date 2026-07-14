import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 t-page-divider">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-amber-500/90 mb-1">
          Jarvis
        </p>
        <h2 className="font-sans text-xl font-semibold t-text tracking-tight">{title}</h2>
        <p className="font-sans text-sm t-text-secondary mt-1.5 max-w-2xl leading-relaxed">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
