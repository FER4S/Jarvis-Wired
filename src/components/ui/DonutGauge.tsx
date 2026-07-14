import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface DonutGaugeProps {
  label: string
  value: number
  color: string
  size?: number
}

export function DonutGauge({ label, value, color, size = 80 }: DonutGaugeProps) {
  const data = [
    { value },
    { value: 100 - value }
  ]

  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <div
        style={{ width: size, height: size }}
        className="relative rounded-full"
      >
        <div
          className="absolute inset-0 rounded-full opacity-40 group-hover:opacity-70 transition-opacity blur-md"
          style={{ background: `radial-gradient(circle, ${color}44 0%, transparent 70%)` }}
        />
        <div
          className="absolute inset-1 rounded-full border border-dashed opacity-20 group-hover:opacity-40 transition-opacity"
          style={{ borderColor: color }}
        />
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="92%"
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
              <Cell fill="rgba(0,229,255,0.06)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-orbitron font-mono-hud text-sm font-black"
            style={{ color, textShadow: `0 0 12px ${color}88` }}
          >
            {value}%
          </span>
        </div>
      </div>
      <span className="hud-label text-[8px] group-hover:text-[var(--cyan)] transition-colors">{label}</span>
    </div>
  )
}
