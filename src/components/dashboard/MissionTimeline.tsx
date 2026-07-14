import { motion } from 'framer-motion'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { timelineEvents } from '@/services/mockData'

const statusColor = {
  done: 'from-[var(--green)] to-[var(--cyan)]',
  active: 'from-[var(--cyan)] to-[var(--purple)]',
  upcoming: 'from-[rgba(0,212,255,0.3)] to-[rgba(0,212,255,0.1)]'
}

export function MissionTimeline() {
  return (
    <GlassPanel title="Mission Timeline" className="h-full" delay={0.25} panelId="TML-OPS">
      <div className="relative pl-5 space-y-3.5 overflow-y-auto h-full pr-1">
        <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gradient-to-b from-[var(--cyan)] via-[var(--cyan-dim)] to-transparent opacity-60" />
        {timelineEvents.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className="relative"
          >
            <div
              className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-primary)] ${
                event.status === 'active'
                  ? 'bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan)] pulse-dot'
                  : event.status === 'done'
                    ? 'bg-[var(--green)]'
                    : 'bg-[rgba(0,212,255,0.25)]'
              }`}
            />
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{event.title}</p>
              <span className="font-mono-hud text-[10px] text-[var(--text-secondary)] shrink-0">
                {event.time}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[rgba(0,212,255,0.08)] overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${statusColor[event.status]}`}
                initial={{ width: 0 }}
                animate={{ width: `${event.progress}%` }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  )
}
