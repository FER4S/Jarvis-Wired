import { motion } from 'framer-motion'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { memoryNodes, memoryEdges, memoryStats } from '@/services/mockData'

export function MemoryInsights() {
  const nodeMap = Object.fromEntries(memoryNodes.map((n) => [n.id, n]))

  return (
    <GlassPanel title="Memory Insights" className="h-full" accent="purple" delay={0.4} panelId="MEM-MAP">
      <div className="flex gap-4 h-full">
        <div className="flex-1 relative min-h-[80px] rounded-lg border border-[var(--border)] bg-[rgba(0,8,24,0.5)] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(179,136,255,0.08),transparent_70%)]" />
          <svg className="w-full h-full relative z-10" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {memoryEdges.map((edge, i) => {
              const from = nodeMap[edge.from]
              const to = nodeMap[edge.to]
              if (!from || !to) return null
              return (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(179,136,255,0.35)"
                  strokeWidth="0.4"
                  className="memory-edge"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              )
            })}
            {memoryNodes.map((node, i) => (
              <g key={node.id} className="node-float" style={{ animationDelay: `${i * 0.3}s` }}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size / 1.6}
                  fill="rgba(179,136,255,0.08)"
                  stroke="rgba(179,136,255,0.5)"
                  strokeWidth="0.35"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size / 3.5}
                  fill="#b388ff"
                  opacity="0.9"
                  className="pulse-dot"
                />
              </g>
            ))}
          </svg>
        </div>
        <div className="flex flex-col justify-center gap-3 shrink-0 border-l border-[var(--border)] pl-4">
          {[
            { label: 'Memories', value: memoryStats.memories.toLocaleString(), color: 'text-[var(--cyan-bright)]', glow: 'shadow-[0_0_20px_rgba(0,229,255,0.2)]' },
            { label: 'Session Turns', value: String(memoryStats.sessionTurns), color: 'text-[var(--purple)]', glow: '' },
            { label: 'Tool Calls', value: String(memoryStats.toolCalls), color: 'text-[var(--green)]', glow: '' }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.08 }}
              className={`rounded-lg border border-[var(--border)] bg-[rgba(0,16,32,0.4)] px-3 py-2 ${stat.glow}`}
            >
              <p className="hud-label text-[7px]">{stat.label}</p>
              <p className={`font-orbitron font-mono-hud text-xl font-black ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
