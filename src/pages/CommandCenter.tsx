import {
  ConversationTranscriptPanel,
  BackendStatusPanel,
  VoiceEventsPanel,
  EmailPanel
} from '@/components/dashboard/SphereFeeds'
import { SystemMonitor } from '@/components/dashboard/SystemMonitor'
import { LlmStatus } from '@/components/dashboard/LlmStatus'
import { VoiceReactiveSphere } from '@/components/hero/VoiceReactiveSphere'
import { TopNavPills } from '@/components/layout/TopNavPills'
import { DashboardBackdrop } from '@/components/layout/DashboardBackdrop'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { useBackend } from '@/context/BackendContext'
import { useState } from 'react'

const tabs = ['Core Overview', 'System View'] as const
type Tab = (typeof tabs)[number]

export function CommandCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('Core Overview')
  const { connected } = useBackend()

  return (
    <main className="relative flex-1 min-h-0 h-full overflow-hidden flex flex-col">
      <DashboardBackdrop />
      <TopNavPills tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="relative z-10 flex-1 min-h-0 pt-4">
        {activeTab === 'Core Overview' ? (
          <div className="h-full grid grid-cols-[minmax(0,1fr)_1.35fr_minmax(0,1fr)] grid-rows-1 gap-4 min-h-0">
            <div className="h-full min-h-0 min-w-0 grid grid-rows-[minmax(220px,1.3fr)_minmax(120px,0.7fr)] gap-4">
              <ConversationTranscriptPanel />
              <VoiceEventsPanel />
            </div>
            <div className="h-full min-h-0 min-w-0">
              <BrutalPanel panelId="AI-CORE" title="AI Core" noPadding className="h-full">
                <VoiceReactiveSphere />
              </BrutalPanel>
            </div>
            <div className="h-full min-h-0 min-w-0 grid grid-rows-2 gap-4">
              <BackendStatusPanel />
              <EmailPanel />
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-2 gap-4 min-h-0">
            <SystemMonitor />
            <LlmStatus connected={connected} />
          </div>
        )}
      </div>
    </main>
  )
}
