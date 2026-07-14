import { motion } from 'framer-motion'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { DonutGauge } from '@/components/ui/DonutGauge'
import { systemMetrics } from '@/services/mockData'

export function SystemMonitor() {
  return (
    <GlassPanel title="System Monitor" className="h-full" accent="cyan" delay={0.35} panelId="SYS-MON">
      <div className="flex items-center justify-around h-full pt-1">
        {systemMetrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <DonutGauge
              label={metric.label}
              value={metric.value}
              color={metric.color}
              size={76}
            />
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  )
}
