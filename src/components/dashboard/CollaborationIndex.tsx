import { GlassPanel } from '@/components/ui/GlassPanel'
import { collaborationNodes, collaborationEdges } from '@/services/mockData'

export function CollaborationIndex() {
  const nodeMap = Object.fromEntries(collaborationNodes.map((n) => [n.id, n]))

  return (
    <GlassPanel title="Collaboration Index" className="h-full" accent="cyan" delay={0.2} panelId="COL-IDX">
      <div className="h-full flex flex-col">
        <p className="hud-label text-[7px] text-center mb-2 text-[var(--cyan)]">HUMAN CONNECTIONS</p>
        <div className="flex-1 relative rounded-lg border border-[var(--border)] bg-[rgba(0,8,20,0.5)] overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {collaborationEdges.map((edge, i) => {
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
                  stroke="rgba(0,242,255,0.3)"
                  strokeWidth="0.4"
                  className="memory-edge"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              )
            })}
            {collaborationNodes.map((node) => (
              <g key={node.id}>
                {node.central && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={(node.size ?? 6) + 4}
                    fill="none"
                    stroke="rgba(0,242,255,0.2)"
                    strokeWidth="0.5"
                    className="hero-pulse-ring"
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size ?? 5}
                  fill={node.central ? 'rgba(0,242,255,0.2)' : 'rgba(179,38,255,0.15)'}
                  stroke={node.central ? '#00f2ff' : '#b026ff'}
                  strokeWidth="0.5"
                />
                <text
                  x={node.x}
                  y={node.y + (node.size ?? 5) + 5}
                  textAnchor="middle"
                  className="font-mono-hud"
                  fill="rgba(232,244,255,0.6)"
                  fontSize="3.5"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </GlassPanel>
  )
}
