import type { ComponentType } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Cpu,
  Bot,
  CheckSquare,
  Calendar,
  Brain,
  MessageSquare,
  BookOpen,
  Wrench,
  GitBranch,
  Focus,
  Hexagon
} from 'lucide-react'
import { navItems } from '@/services/mockData'
import { VoiceWaveform } from '@/components/voice/VoiceWaveform'
import { MicButton } from '@/components/voice/MicButton'
import type { VoiceState } from '@/services/types'

const iconMap: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  'layout-dashboard': LayoutDashboard,
  cpu: Cpu,
  bot: Bot,
  'check-square': CheckSquare,
  calendar: Calendar,
  brain: Brain,
  'message-square': MessageSquare,
  'book-open': BookOpen,
  wrench: Wrench,
  'git-branch': GitBranch
}

interface SidebarProps {
  voiceState: VoiceState
}

export function Sidebar({ voiceState }: SidebarProps) {
  return (
    <aside className="app-sidebar w-[236px] h-full flex flex-col shrink-0 relative bg-gradient-to-b from-[rgba(0,12,28,0.95)] to-[rgba(0,6,16,0.98)] border-r border-[var(--cyan-dim)] shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--cyan)] to-transparent opacity-20" />

      <div className="drag-region px-4 py-5 shrink-0 relative">
        <div className="absolute bottom-0 left-4 right-4 hud-divider opacity-60" />
        <div className="no-drag flex items-center gap-3">
          <div className="relative w-11 h-11 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--cyan-dim)] logo-ring opacity-50" />
            <div className="absolute inset-1 rounded-full border border-[var(--cyan)] opacity-30 logo-ring" style={{ animationDirection: 'reverse', animationDuration: '8s' }} />
            <div className="w-9 h-9 rounded-full border-2 border-[var(--cyan)] flex items-center justify-center glow-cyan bg-[rgba(0,229,255,0.1)]">
              <Hexagon size={18} className="text-[var(--cyan-bright)]" />
            </div>
          </div>
          <div>
            <p className="font-orbitron text-xs font-black tracking-[0.2em] text-[var(--cyan-bright)] glow-text-cyan leading-tight">
              JARVIS
            </p>
            <p className="font-mono-hud text-[8px] text-[var(--text-meta)] tracking-[0.15em] mt-0.5">
              COMMAND CENTER
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2.5 no-drag space-y-1">
        <p className="hud-label text-[8px] px-2 mb-2 opacity-50">Navigation</p>
        {navItems.map((item, i) => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard
          const isActive = item.active
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[12px] transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-[rgba(0,229,255,0.2)] via-[rgba(0,229,255,0.08)] to-transparent text-[var(--cyan-bright)] border border-[var(--cyan-dim)] shadow-[0_0_16px_rgba(0,229,255,0.1)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(0,229,255,0.06)] border border-transparent hover:border-[var(--cyan-dim)]'
              }`}
            >
              {isActive && (
                <>
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--cyan)] rounded-r-full nav-active-bar" />
                  <span className="absolute inset-0 rounded-lg bg-[var(--cyan)] opacity-[0.03]" />
                </>
              )}
              <Icon
                size={17}
                className={`shrink-0 transition-all duration-200 group-hover:scale-110 ${
                  isActive ? 'text-[var(--cyan-bright)] drop-shadow-[0_0_8px_var(--cyan)]' : 'group-hover:text-[var(--cyan)]'
                }`}
              />
              <span className="flex-1 truncate whitespace-nowrap font-medium">{item.label}</span>
              {item.badge && (
                <span className="font-mono-hud px-2 py-0.5 text-[9px] rounded-full bg-[rgba(0,229,255,0.2)] text-[var(--cyan-bright)] border border-[var(--cyan-dim)] flex items-center gap-1 shadow-[0_0_8px_rgba(0,229,255,0.15)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] pulse-dot" />
                  {item.badge}
                </span>
              )}
            </motion.button>
          )
        })}
      </nav>

      <div className="no-drag mx-2.5 mb-2.5 p-3.5 rounded-xl border border-[var(--cyan-dim)] bg-gradient-to-b from-[rgba(0,20,40,0.8)] to-[rgba(0,8,20,0.9)] flex flex-col items-center gap-2.5 shrink-0 shadow-[inset_0_1px_0_rgba(0,229,255,0.1),0_0_20px_rgba(0,229,255,0.05)]">
        <div className="w-full flex items-center justify-between border-b border-[var(--border)] pb-2">
          <p className="font-orbitron hud-label text-[8px] text-[var(--cyan)]">Voice Interface</p>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot" />
        </div>
        <VoiceWaveform state={voiceState} barCount={18} className="w-full h-7" />
        <MicButton state={voiceState} size="lg" />
        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--cyan)] hover:text-[var(--cyan-bright)] hover:shadow-[0_0_16px_var(--cyan-glow)] transition-all">
          <Focus size={14} />
          Focus Mode
        </button>
      </div>
    </aside>
  )
}
