import { useCallback, useEffect, useState } from 'react'
import { Power, PowerOff } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { brutalBtnClass } from '@/components/ui/BrutalInput'
import { useBackend } from '@/context/BackendContext'
import { backendClient } from '@/services/backendClient'
import { getStatusPillClasses, getStatusPillText } from '@/utils/voiceStateColors'

export function SystemControlPage() {
  const { connected, running, voiceState, error, startAssistant, stopAssistant } = useBackend()
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [statusState, setStatusState] = useState<string>('idle')
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusRunning, setStatusRunning] = useState(false)
  const [polling, setPolling] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [health, status] = await Promise.all([backendClient.health(), backendClient.status()])
      setHealthOk(health.status === 'ok')
      setStatusRunning(status.running)
      setStatusState(status.state)
      setStatusError(status.error ?? null)
    } catch {
      setHealthOk(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleStart = async () => {
    setPolling(true)
    try {
      await startAssistant()
      await refresh()
    } finally {
      setPolling(false)
    }
  }

  const handleStop = async () => {
    setPolling(true)
    try {
      await stopAssistant()
      for (let i = 0; i < 15; i++) {
        const status = await backendClient.status()
        if (!status.running) break
        await new Promise((r) => setTimeout(r, 500))
      }
      await refresh()
    } finally {
      setPolling(false)
    }
  }

  const pillClass = getStatusPillClasses(connected, voiceState, !!(error || statusError))
  const pillText = getStatusPillText(connected, running, voiceState, !!(error || statusError))

  const brutalBtn = brutalBtnClass

  return (
    <main className="h-full min-h-0 overflow-y-auto flex flex-col gap-4">
      <PageHeader
        title="System Control"
        description="Monitor backend health, assistant state, and start or stop the voice pipeline."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BrutalPanel panelId="HEALTH" title="Health" className="min-h-[120px]">
          <div className="flex flex-col gap-2">
            <span
              className={`inline-block w-fit px-3 py-2 font-mono text-xs font-bold uppercase border-2 border-black ${
                healthOk ? 'bg-green-500 text-black' : 'bg-rose-500 text-black'
              }`}
            >
              {healthOk === null ? 'Checking…' : healthOk ? 'Server OK' : 'Unreachable'}
            </span>
            <span
              className={`inline-block w-fit px-3 py-2 font-mono text-xs font-bold uppercase border-2 border-black ${
                connected ? 'bg-green-500 text-black' : 'bg-rose-500 text-black'
              }`}
            >
              WebSocket: {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </BrutalPanel>

        <BrutalPanel panelId="STATUS" title="Assistant Status" className="min-h-[120px]">
          <div className="font-mono text-xs space-y-2 uppercase">
            <p>
              Running: <span className="text-white">{statusRunning ? 'Yes' : 'No'}</span>
            </p>
            <p>
              State: <span className="text-white">{statusState}</span>
            </p>
            {statusError && <p className="text-rose-500">{statusError}</p>}
          </div>
        </BrutalPanel>
      </div>

      <BrutalPanel panelId="CTRL" title="Assistant Control" className="flex-1 min-h-[200px]">
        <div className="flex flex-col gap-4 h-full">
          <div
            className={`w-full px-4 py-4 border-2 border-black shadow-[4px_4px_0px_0px_black] font-mono text-sm font-bold text-black uppercase tracking-wide ${pillClass}`}
          >
            {pillText}
          </div>

          {(error || statusError) && (
            <p className="font-mono text-xs text-rose-500 uppercase">{error ?? statusError}</p>
          )}

          <div className="flex gap-3 mt-auto">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!connected || running || polling}
              className={`${brutalBtn} flex-1 bg-emerald-500 text-black`}
            >
              <Power size={14} strokeWidth={3} />
              Start
            </button>
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={!connected || !running || polling}
              className={`${brutalBtn} flex-1 bg-[#252833] text-slate-200`}
            >
              <PowerOff size={14} strokeWidth={3} />
              Stop
            </button>
          </div>

          <p className="font-mono text-[10px] text-slate-500 uppercase">
            If start returns &quot;already running&quot;, wait until status shows stopped, then retry.
          </p>
        </div>
      </BrutalPanel>
    </main>
  )
}
