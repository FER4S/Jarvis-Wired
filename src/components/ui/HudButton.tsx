import type { ReactNode, ComponentType } from 'react'
import { motion } from 'framer-motion'

interface HudButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: ComponentType<{ size?: number; className?: string }>
  className?: string
  fullWidth?: boolean
  layout?: 'col' | 'row'
}

const variants = {
  primary:
    'border-[var(--cyan)]/40 bg-[rgba(56,189,248,0.12)] text-[var(--cyan-bright)] hover:bg-[rgba(56,189,248,0.18)] hover:border-[var(--cyan)]/60',
  secondary:
    'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]',
  ghost:
    'border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
}

export function HudButton({
  children,
  onClick,
  disabled = false,
  variant = 'secondary',
  icon: Icon,
  className = '',
  fullWidth = false,
  layout = 'row'
}: HudButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`no-drag flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
        disabled ? 'opacity-35 cursor-not-allowed pointer-events-none' : ''
      } ${layout === 'row' ? 'flex-row' : 'flex-col py-3'} ${fullWidth ? 'w-full' : ''} ${variants[variant]} ${className}`}
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      <span>{children}</span>
    </motion.button>
  )
}
