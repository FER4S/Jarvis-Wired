import type { ComponentType, CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Code, Search, Brain, Globe, ListTodo, Settings } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { VoiceWaveform } from '@/components/voice/VoiceWaveform'
import { agents } from '@/services/mockData'

const iconMap: Record<string, ComponentType<{ size?: number; className?: string; style?: CSSProperties }>> = {
  code: Code,
  search: Search,
  brain: Brain,
  globe: Globe,
  'list-todo': ListTodo,
  settings: Settings
}

export function ActiveAgents() {
  return (
    <GlassPanel title="Active Agents" className="h-full" delay={0.2} panelId="AGT-NET">
      <div className="grid grid-cols-3 gap-2 h-full content-start overflow-y-auto">
        {agents.map((agent, i) => {
          const Icon = iconMap[agent.icon] ?? Code
          const isActive = agent.status === 'active'
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(0,212,255,0.15)' }}
              className={`relative p-2.5 rounded-lg border text-center transition-all ${
                isActive
                  ? 'border-[var(--cyan)] bg-gradient-to-b from-[rgba(0,229,255,0.15)] to-[rgba(0,229,255,0.04)] shadow-[0_0_20px_rgba(0,229,255,0.2)]'
                  : 'border-dashed border-[var(--border)] bg-[rgba(0,20,40,0.25)] opacity-50'
              }`}
            >
              <div className="relative w-8 h-8 mx-auto mb-1.5">
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--green)] pulse-dot border border-[var(--bg-primary)]" />
                )}
                <div
                  className="w-full h-full rounded-md flex items-center justify-center"
                  style={{ background: `${agent.color}12`, border: `1px solid ${agent.color}35` }}
                >
                  <Icon size={14} style={{ color: agent.color }} />
                </div>
              </div>
              <p className="text-[11px] font-medium text-[var(--text-primary)]">{agent.name}</p>
              {isActive ? (
                <VoiceWaveform active barCount={6} className="mt-1.5 h-3" />
              ) : (
                <p className="hud-meta mt-1.5">Standby</p>
              )}
            </motion.div>
          )
        })}
      </div>
    </GlassPanel>
  )
}
