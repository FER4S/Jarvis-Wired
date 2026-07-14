import type { ComponentType } from 'react'
import { Cpu, Brain, Mic, Bot, Zap, Activity } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { StatRow } from '@/components/ui/StatRow'
import { coreStats } from '@/services/mockData'

const iconMap: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  cpu: Cpu,
  brain: Brain,
  mic: Mic,
  bot: Bot,
  zap: Zap,
  activity: Activity
}

export function AiCoreOverview() {
  return (
    <GlassPanel title="AI Core Overview" className="h-full" delay={0.05} panelId="MOD-001">
      <div className="space-y-2.5 overflow-y-auto h-full pr-0.5">
        {coreStats.map((stat, i) => {
          const Icon = iconMap[stat.icon] ?? Cpu
          return (
            <StatRow
              key={stat.label}
              label={stat.label}
              value={stat.value}
              status={stat.status}
              icon={Icon}
              delay={0.08 + i * 0.05}
            />
          )
        })}
      </div>
    </GlassPanel>
  )
}
