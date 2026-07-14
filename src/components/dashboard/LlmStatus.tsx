import { Link2, Link2Off } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { llmProviders } from '@/services/mockData'

interface LlmStatusProps {
  connected?: boolean
}

export function LlmStatus({ connected = false }: LlmStatusProps) {
  const providers = llmProviders.map((p) =>
    p.id === 'claude' ? { ...p, connected } : p
  )

  return (
    <BrutalPanel panelId="LLM" title="LLM Providers" className="h-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 h-full overflow-y-auto content-start">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`relative p-3 border-2 border-black text-center shadow-[3px_3px_0px_0px_black] ${
              provider.connected ? 'bg-green-500/20' : 'bg-[#2a2d3a] opacity-70'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              {provider.connected ? (
                <Link2 size={12} className="text-green-500" strokeWidth={3} />
              ) : (
                <Link2Off size={12} className="text-slate-500" strokeWidth={3} />
              )}
              <p className="font-mono text-xs font-bold text-white truncate uppercase">
                {provider.name}
              </p>
            </div>
            <p
              className={`font-mono text-[10px] font-bold uppercase ${
                provider.connected ? 'text-green-500' : 'text-slate-500'
              }`}
            >
              {provider.connected ? 'Connected' : 'Unavailable'}
            </p>
          </div>
        ))}
      </div>
    </BrutalPanel>
  )
}
