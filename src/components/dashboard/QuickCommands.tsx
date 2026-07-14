import type { ComponentType } from 'react'
import { PlusCircle, Calendar, Mic, Play } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { HudButton } from '@/components/ui/HudButton'
import { quickCommands } from '@/services/mockData'

const iconMap: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  'plus-circle': PlusCircle,
  calendar: Calendar,
  mic: Mic,
  play: Play
}

export function QuickCommands() {
  return (
    <GlassPanel title="Quick Commands" className="h-full" delay={0.3} panelId="CMD-EXEC">
      <div className="grid grid-cols-2 gap-2.5 h-full content-start">
        {quickCommands.map((cmd, i) => (
          <HudButton
            key={cmd.id}
            variant={i < 2 ? 'primary' : 'secondary'}
            icon={iconMap[cmd.icon] ?? PlusCircle}
            fullWidth
            className={i < 2 ? '!border-[var(--cyan)] !shadow-[0_0_12px_rgba(0,229,255,0.15)]' : ''}
          >
            {cmd.label}
          </HudButton>
        ))}
      </div>
    </GlassPanel>
  )
}
