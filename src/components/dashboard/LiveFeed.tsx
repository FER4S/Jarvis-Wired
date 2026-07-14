import { motion } from 'framer-motion'
import type { FeedTag } from '@/services/types'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { HudChip } from '@/components/ui/HudChip'
import { feedItems } from '@/services/mockData'

const tagVariant: Record<FeedTag, 'info' | 'warn' | 'tip' | 'live'> = {
  INFO: 'info',
  WARN: 'warn',
  TIP: 'tip',
  LIVE: 'live'
}

export function LiveFeed() {
  return (
    <GlassPanel title="Live Intelligence Feed" className="h-full" delay={0.15} panelId="FEED-01">
      <div className="h-full overflow-y-auto space-y-2 pr-1">
        {feedItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
            className="flex gap-2 p-2.5 rounded-md bg-[rgba(0,20,40,0.45)] border border-[var(--border)] hover:border-[var(--cyan-dim)] hover:translate-x-0.5 hover:shadow-[0_0_10px_var(--cyan-glow)] transition-all group"
          >
            <HudChip tag={item.tag} variant={tagVariant[item.tag]} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-primary)] leading-relaxed group-hover:text-white transition-colors">
                {item.message}
              </p>
              <p className="hud-meta mt-1">{item.time}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  )
}
