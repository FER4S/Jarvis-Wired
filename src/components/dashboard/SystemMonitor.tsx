import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { DonutGauge } from '@/components/ui/DonutGauge'
import { systemMetrics } from '@/services/mockData'

export function SystemMonitor() {
  return (
    <BrutalPanel panelId="SYS-MON" title="System Monitor" className="h-full">
      <div className="flex items-center justify-around h-full pt-1">
        {systemMetrics.map((metric) => (
          <DonutGauge
            key={metric.label}
            label={metric.label}
            value={metric.value}
            color={metric.color}
            size={76}
          />
        ))}
      </div>
    </BrutalPanel>
  )
}
