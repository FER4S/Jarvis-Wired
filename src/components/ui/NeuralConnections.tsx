export function NeuralConnections() {
  const lines = [
    { x1: '50%', y1: '50%', x2: '18%', y2: '28%' },
    { x1: '50%', y1: '50%', x2: '18%', y2: '72%' },
    { x1: '50%', y1: '50%', x2: '82%', y2: '28%' },
    { x1: '50%', y1: '50%', x2: '82%', y2: '72%' }
  ]

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden>
      <defs>
        <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00f2ff" stopOpacity="0" />
          <stop offset="40%" stopColor="#00f2ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#00f2ff" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="url(#neuralGrad)"
          strokeWidth="1"
          className="neural-line"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </svg>
  )
}
