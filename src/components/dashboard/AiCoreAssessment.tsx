import { GlassPanel } from '@/components/ui/GlassPanel'
import { assessmentStats, skillAxes } from '@/services/mockData'

function RadarChart() {
  const cx = 50
  const cy = 50
  const maxR = 38
  const levels = 4

  const points = skillAxes
    .map((axis, i) => {
      const angle = (i / skillAxes.length) * Math.PI * 2 - Math.PI / 2
      const r = (axis.value / 100) * maxR
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`
    })
    .join(' ')

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" className="w-24 h-24">
        {Array.from({ length: levels }).map((_, l) => {
          const r = ((l + 1) / levels) * maxR
          const ring = skillAxes
            .map((_, i) => {
              const angle = (i / skillAxes.length) * Math.PI * 2 - Math.PI / 2
              return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`
            })
            .join(' ')
          return (
            <polygon key={l} points={ring} fill="none" stroke="rgba(0,242,255,0.15)" strokeWidth="0.5" />
          )
        })}
        {skillAxes.map((axis, i) => {
          const angle = (i / skillAxes.length) * Math.PI * 2 - Math.PI / 2
          return (
            <line
              key={axis.label}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(angle) * maxR}
              y2={cy + Math.sin(angle) * maxR}
              stroke="rgba(0,242,255,0.2)"
              strokeWidth="0.4"
            />
          )
        })}
        <polygon
          points={points}
          fill="rgba(0,242,255,0.15)"
          stroke="#00f2ff"
          strokeWidth="1"
          className="radar-pulse"
        />
      </svg>
      <span className="hud-label text-[7px] text-[var(--cyan)]">SKILLSET</span>
    </div>
  )
}

function LearningChart() {
  const pts = [12, 22, 18, 32, 28, 40, 36, 48]
  const path = pts
    .map((y, i) => `${(i / (pts.length - 1)) * 100},${60 - y}`)
    .join(' L ')

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 60" className="w-20 h-14">
        <defs>
          <linearGradient id="learnGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00f2ff" />
            <stop offset="100%" stopColor="#b026ff" />
          </linearGradient>
        </defs>
        <path d={`M ${path}`} fill="none" stroke="url(#learnGrad)" strokeWidth="1.5" className="empathy-wave" />
        {pts.map((y, i) => (
          <circle
            key={i}
            cx={(i / (pts.length - 1)) * 100}
            cy={60 - y}
            r="2"
            fill="#00f2ff"
            opacity="0.8"
          />
        ))}
      </svg>
      <span className="hud-label text-[7px] text-[var(--purple)]">LEARNING</span>
    </div>
  )
}

export function AiCoreAssessment() {
  return (
    <GlassPanel title="AI Core Assessment" className="h-full" accent="cyan" delay={0.05} panelId="ASM-CORE">
      <div className="flex flex-col h-full gap-3">
        <div className="space-y-2.5">
          {assessmentStats.map((stat) => (
            <div key={stat.label} className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
              <span className="hud-label text-[8px]">{stat.label}</span>
              <span className="font-orbitron font-mono-hud text-sm font-black text-[var(--cyan-bright)] glow-text-cyan">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex-1 flex items-end justify-around gap-2 pt-2 border-t border-[var(--border)]">
          <RadarChart />
          <LearningChart />
        </div>
      </div>
    </GlassPanel>
  )
}
