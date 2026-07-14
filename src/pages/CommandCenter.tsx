import {
  ConversationTranscriptPanel,
  BackendStatusPanel,
  VoiceEventsPanel,
  SessionSummaryPanel
} from '@/components/dashboard/SphereFeeds'
import { SystemMonitor } from '@/components/dashboard/SystemMonitor'
import { LlmStatus } from '@/components/dashboard/LlmStatus'
import { VoiceReactiveSphere } from '@/components/hero/VoiceReactiveSphere'
import { TopNavPills } from '@/components/layout/TopNavPills'
import { NeuralConnections } from '@/components/ui/NeuralConnections'
import { PageTransition } from '@/components/ui/PageTransition'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useBackend } from '@/context/BackendContext'
import { useState } from 'react'

const tabs = ['Core Overview', 'System View'] as const
type Tab = (typeof tabs)[number]

export function CommandCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('Core Overview')
  const { connected } = useBackend()

  return (
    <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <TopNavPills tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 min-h-0 px-5 pb-4 pt-4 relative">
        <NeuralConnections />
        {activeTab === 'Core Overview' ? (
          <PageTransition className="relative z-10 h-full grid grid-cols-[minmax(0,1fr)_1.4fr_minmax(0,1fr)] grid-rows-2 gap-4 min-h-0">
            <div className="min-h-0 min-w-0">
              <ConversationTranscriptPanel />
            </div>
            <div className="row-span-2 min-h-0 min-w-0 relative">
              <GlassPanel glow noPadding className="h-full" delay={0.08} panelId="AI-CORE">
                <VoiceReactiveSphere />
              </GlassPanel>
            </div>
            <div className="min-h-0 min-w-0">
              <BackendStatusPanel />
            </div>
            <div className="min-h-0 min-w-0">
              <VoiceEventsPanel />
            </div>
            <div className="min-h-0 min-w-0">
              <SessionSummaryPanel />
            </div>
          </PageTransition>
        ) : (
          <PageTransition className="relative z-10 h-full grid grid-cols-2 gap-4 min-h-0">
            <SystemMonitor />
            <LlmStatus connected={connected} />
          </PageTransition>
        )}
      </div>
    </main>
  )
}
