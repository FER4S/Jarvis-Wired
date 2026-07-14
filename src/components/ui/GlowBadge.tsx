import type { ReactNode } from 'react'

interface GlowBadgeProps {
  children: ReactNode
  color?: 'green' | 'cyan' | 'yellow' | 'red'
  dot?: boolean
  className?: string
}

const colorMap = {
  green: 'border-[var(--green)] text-[var(--green)] bg-[rgba(0,255,136,0.1)]',
  cyan: 'border-[var(--cyan)] text-[var(--cyan)] bg-[rgba(0,212,255,0.1)]',
  yellow: 'border-[var(--yellow)] text-[var(--yellow)] bg-[rgba(255,170,0,0.1)]',
  red: 'border-[var(--red)] text-[var(--red)] bg-[rgba(255,68,102,0.1)]'
}

const dotColorMap = {
  green: 'bg-[var(--green)] shadow-[0_0_8px_var(--green)]',
  cyan: 'bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)]',
  yellow: 'bg-[var(--yellow)] shadow-[0_0_8px_var(--yellow)]',
  red: 'bg-[var(--red)] shadow-[0_0_8px_var(--red)]'
}

export function GlowBadge({ children, color = 'cyan', dot = false, className = '' }: GlowBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium tracking-wide ${colorMap[color]} ${className}`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${dotColorMap[color]}`} />}
      {children}
    </span>
  )
}
