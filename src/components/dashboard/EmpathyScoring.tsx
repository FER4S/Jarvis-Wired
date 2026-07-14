import { GlassPanel } from '@/components/ui/GlassPanel'

const empathyChannels = [
  { label: 'TONE ANALYSIS', color: '#00f2ff', phase: 0 },
  { label: 'SENTIMENT TRACKING', color: '#b026ff', phase: 1.2 },
  { label: 'ETHICAL COMPLIANCE', color: '#0066ff', phase: 2.4 }
]

function WaveGraph({ color, phase }: { color: string; phase: number }) {
  const pts = Array.from({ length: 40 }, (_, i) => {
    const x = (i / 39) * 100
    const y =
      50 +
      Math.sin(i * 0.35 + phase) * 18 +
      Math.sin(i * 0.15 + phase * 2) * 10 +
      Math.cos(i * 0.5) * 6
    return `${x},${y}`
  }).join(' L ')

  return (
    <svg viewBox="0 0 100 100" className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${phase}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="50%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path
        d={`M ${pts}`}
        fill="none"
        stroke={`url(#grad-${phase})`}
        strokeWidth="1.2"
        className="empathy-wave"
        style={{ animationDelay: `${phase}s` }}
      />
    </svg>
  )
}

export function EmpathyScoring() {
  return (
    <GlassPanel title="Empathy Scoring" className="h-full" accent="purple" delay={0.15} panelId="EMP-SCR">
      <div className="flex flex-col h-full gap-3 justify-around">
        {empathyChannels.map((ch) => (
          <div
            key={ch.label}
            className="rounded-lg border border-[var(--border)] bg-[rgba(0,10,24,0.5)] px-3 py-2.5"
          >
            <p className="hud-label text-[7px] mb-2" style={{ color: ch.color }}>
              {ch.label}
            </p>
            <WaveGraph color={ch.color} phase={ch.phase} />
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}
