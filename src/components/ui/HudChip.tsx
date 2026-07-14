import type { ReactNode, ComponentType } from 'react'

type ChipVariant = 'info' | 'warn' | 'tip' | 'live' | 'status' | 'default'

interface HudChipProps {
  label?: string
  value?: string
  tag?: string
  variant?: ChipVariant
  icon?: ComponentType<{ size?: number; className?: string }>
  className?: string
  children?: ReactNode
}

const variantStyles: Record<ChipVariant, string> = {
  info: 'border-l-[var(--cyan)] bg-[rgba(0,229,255,0.1)] shadow-[0_0_8px_rgba(0,229,255,0.08)]',
  warn: 'border-l-[var(--yellow)] bg-[rgba(255,184,77,0.1)]',
  tip: 'border-l-[var(--purple)] bg-[rgba(179,136,255,0.1)]',
  live: 'border-l-[var(--green)] bg-[rgba(0,255,157,0.1)] live-pulse',
  status: 'border-l-[var(--cyan)] bg-[rgba(0,20,48,0.7)] shadow-[inset_0_1px_0_rgba(0,229,255,0.08)]',
  default: 'border-l-[var(--border)] bg-[rgba(0,20,40,0.5)]'
}

const tagText: Record<ChipVariant, string> = {
  info: 'text-[var(--cyan-bright)]',
  warn: 'text-[var(--yellow)]',
  tip: 'text-[var(--purple)]',
  live: 'text-[var(--green)]',
  status: 'text-[var(--text-primary)]',
  default: 'text-[var(--text-secondary)]'
}

export function HudChip({
  label,
  value,
  tag,
  variant = 'default',
  icon: Icon,
  className = '',
  children
}: HudChipProps) {
  if (tag) {
    return (
      <span
        className={`shrink-0 px-2 py-0.5 text-[9px] font-bold rounded border border-[var(--border)] border-l-2 ${tagText[variant]} ${variantStyles[variant]} ${className}`}
      >
        {tag}
      </span>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] border-l-2 transition-all hover:border-[var(--cyan-dim)] ${variantStyles[variant]} ${className}`}
    >
      {Icon && <Icon size={13} className="text-[var(--cyan-bright)] shrink-0" />}
      <div className="min-w-0">
        {label && <p className="hud-label text-[8px] leading-none opacity-70">{label}</p>}
        {value && (
          <p className="text-[11px] font-medium text-[var(--text-primary)] whitespace-nowrap">{value}</p>
        )}
        {children}
      </div>
    </div>
  )
}
