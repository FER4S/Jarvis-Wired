import type { ReactNode } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const barData = [
  { name: 'A', v: 65 },
  { name: 'B', v: 42 },
  { name: 'C', v: 78 },
  { name: 'D', v: 55 }
]

const pieData = [
  { value: 35, color: '#00f2ff' },
  { value: 25, color: '#b026ff' },
  { value: 20, color: '#0066ff' },
  { value: 20, color: '#00ff9d' }
]

const codeLines = [
  'async function deploy() {',
  '  const core = await jarvis.init()',
  '  return core.orchestrate(agents)',
  '}'
]

function MiniWindow({
  title,
  children,
  offset
}: {
  title: string
  children: ReactNode
  offset: number
}) {
  return (
    <div
      className="rounded-lg border border-[var(--cyan-dim)] bg-[rgba(0,8,20,0.85)] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      style={{ transform: `translateY(${offset}px)`, zIndex: 10 - offset }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[var(--border)] bg-[rgba(0,242,255,0.06)]">
        <span className="w-2 h-2 rounded-full bg-[var(--red)] opacity-70" />
        <span className="w-2 h-2 rounded-full bg-[var(--yellow)] opacity-70" />
        <span className="w-2 h-2 rounded-full bg-[var(--green)] opacity-70" />
        <span className="hud-label text-[7px] ml-1 text-[var(--cyan)]">{title}</span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

export function WorkspaceIntegration() {
  return (
    <GlassPanel title="Workspace Integration" className="h-full" delay={0.1} panelId="WS-INT">
      <div className="relative h-full flex flex-col gap-2">
        <MiniWindow title="CODE GENERATION" offset={0}>
          <pre className="font-mono-hud text-[8px] leading-relaxed text-[var(--cyan-bright)]">
            {codeLines.map((line, i) => (
              <div key={i}>
                <span className="text-[var(--text-meta)] mr-2">{i + 1}</span>
                <span className={line.includes('async') ? 'text-[var(--purple)]' : ''}>{line}</span>
              </div>
            ))}
          </pre>
        </MiniWindow>
        <MiniWindow title="DATA VISUALIZATION" offset={-8}>
          <div className="flex gap-2 h-16">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={['#00f2ff', '#b026ff', '#0066ff', '#00ff9d'][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="w-14">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="none">
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </MiniWindow>
        <MiniWindow title="STRATEGY PLANNING" offset={-16}>
          <div className="h-12 relative rounded border border-[var(--border)] bg-[rgba(0,20,40,0.5)] overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 200 60">
              {[
                [30, 30, 80, 20],
                [80, 20, 130, 40],
                [80, 20, 60, 45],
                [130, 40, 170, 25]
              ].map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(0,242,255,0.35)"
                  strokeWidth="1"
                />
              ))}
              {[
                [30, 30],
                [80, 20],
                [130, 40],
                [60, 45],
                [170, 25]
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="4" fill="#00f2ff" opacity="0.8" />
              ))}
            </svg>
          </div>
        </MiniWindow>
      </div>
    </GlassPanel>
  )
}
