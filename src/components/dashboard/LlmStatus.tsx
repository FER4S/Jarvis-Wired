import { motion } from 'framer-motion'
import { Link2, Link2Off } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { llmProviders } from '@/services/mockData'

interface LlmStatusProps {
  connected?: boolean
}

export function LlmStatus({ connected = false }: LlmStatusProps) {
  const providers = llmProviders.map((p) =>
    p.id === 'claude' ? { ...p, connected } : p
  )

  return (
    <GlassPanel title="LLM Providers" className="h-full" delay={0.45} panelId="LLM">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 h-full overflow-y-auto content-start">
        {providers.map((provider, i) => (
          <motion.div
            key={provider.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.04 }}
            className={`relative p-3 rounded-lg border text-center transition-all ${
              provider.connected
                ? 'border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.06)]'
                : 'border-[var(--border)] bg-[var(--bg-surface)] opacity-60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              {provider.connected ? (
                <Link2 size={12} className="text-[var(--green)]" strokeWidth={2} />
              ) : (
                <Link2Off size={12} className="text-[var(--text-meta)]" strokeWidth={2} />
              )}
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {provider.name}
              </p>
            </div>
            <p
              className={`text-[10px] font-medium ${
                provider.connected ? 'text-[var(--green)]' : 'text-[var(--text-meta)]'
              }`}
            >
              {provider.connected ? 'Connected' : 'Unavailable'}
            </p>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  )
}
