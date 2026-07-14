import type { ComponentType } from 'react'
import { motion } from 'framer-motion'

interface StatRowProps {
  label: string
  value: string
  status?: 'active' | 'online' | 'connected' | 'standby'
  icon: ComponentType<{ size?: number; className?: string }>
  delay?: number
}

const statusColor: Record<string, string> = {
  active: 'text-[var(--green)]',
  online: 'text-[var(--cyan-bright)]',
  connected: 'text-[var(--purple)]',
  standby: 'text-[var(--yellow)]'
}

const statusBar: Record<string, string> = {
  active: 'from-[var(--green)] to-[var(--cyan)]',
  online: 'from-[var(--cyan)] to-[var(--cyan-bright)]',
  connected: 'from-[var(--purple)] to-[var(--cyan)]',
  standby: 'from-[var(--yellow)] to-transparent'
}

const fillPercent: Record<string, number> = {
  active: 92,
  online: 88,
  connected: 76,
  standby: 40
}

export function StatRow({ label, value, status = 'active', icon: Icon, delay = 0 }: StatRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative rounded-lg border border-[var(--border)] bg-[rgba(0,16,32,0.55)] px-2.5 py-2 hover:border-[var(--cyan-dim)] hover:shadow-[0_0_14px_rgba(0,229,255,0.12)] transition-all overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--cyan)] to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-md border border-[var(--cyan-dim)] flex items-center justify-center bg-[rgba(0,229,255,0.08)] group-hover:shadow-[0_0_12px_var(--cyan-glow)] transition-all">
          <Icon size={14} className="text-[var(--cyan-bright)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="hud-label text-[8px]">{label}</p>
            <div className="flex items-center gap-1.5">
              {(status === 'active' || status === 'online') && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot shadow-[0_0_6px_var(--green)]" />
              )}
              <p className={`font-mono-hud text-[11px] font-bold ${statusColor[status]}`}>{value}</p>
            </div>
          </div>
          <div className="h-1 rounded-full bg-[rgba(0,229,255,0.06)] overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${statusBar[status]} shadow-[0_0_8px_var(--cyan-glow)]`}
              initial={{ width: 0 }}
              animate={{ width: `${fillPercent[status]}%` }}
              transition={{ delay: delay + 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
