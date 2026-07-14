export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

export type FeedTag = 'INFO' | 'WARN' | 'TIP' | 'LIVE'

export interface NavItem {
  id: string
  label: string
  icon: string
  badge?: number
  active?: boolean
}

export interface CoreStat {
  label: string
  value: string
  status: 'active' | 'online' | 'connected' | 'standby'
  icon: string
}

export interface AssessmentStat {
  label: string
  value: string
}

export interface SkillAxis {
  label: string
  value: number
}

export interface CollaborationNode {
  id: string
  label: string
  x: number
  y: number
  size?: number
  central?: boolean
}

export interface FeedItem {
  id: string
  tag: FeedTag
  message: string
  time: string
}

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface NotificationItem {
  id: string
  title: string
  message: string
  time: string
  priority: NotificationPriority
  read: boolean
  source: string
}

export interface NewsItem {
  id: string
  headline: string
  source: string
  time: string
  category: string
  breaking?: boolean
}

export interface EmailItem {
  id: string
  from: string
  subject: string
  preview: string
  time: string
  unread: boolean
  starred?: boolean
}

export interface EmailAccount {
  id: string
  label: string
  provider: 'imap' | 'gmail_oauth'
  created_at: string
}

export interface EmailRecentItem {
  subject: string
  sender_name: string
  sender_email: string
  date: string
  unread: boolean
  snippet: string
}

export interface EmailSummaryAccount {
  id: string
  label: string
  provider: 'imap' | 'gmail_oauth'
  unread_count: number
  last_poll: string | null
  last_error: string | null
  recent: EmailRecentItem[]
}

export interface EmailSummaryResponse {
  accounts: EmailSummaryAccount[]
  total_unread: number
}

export interface ImapAccountRequest {
  label: string
  host: string
  port: number
  username: string
  password: string
  use_ssl?: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_use_ssl?: boolean
}

export interface GmailOAuthUrlResponse {
  url: string
  expires_in: number
}

export interface Agent {
  id: string
  name: string
  status: 'active' | 'standby'
  icon: string
  color: string
}

export interface TimelineEvent {
  id: string
  title: string
  time: string
  progress: number
  status: 'upcoming' | 'active' | 'done'
}

export interface QuickCommand {
  id: string
  label: string
  icon: string
}

export interface SystemMetric {
  label: string
  value: number
  color: string
}

export interface MemoryNode {
  id: string
  x: number
  y: number
  size: number
}

export interface MemoryEdge {
  from: string
  to: string
}

export interface LlmProvider {
  id: string
  name: string
  connected: boolean
}

export interface StatusChip {
  label: string
  value: string
  icon: string
}

export interface IJarvisApi {
  getCoreStats(): Promise<CoreStat[]>
  getFeedItems(): Promise<FeedItem[]>
  getAgents(): Promise<Agent[]>
  getTimeline(): Promise<TimelineEvent[]>
  getSystemMetrics(): Promise<SystemMetric[]>
  getLlmProviders(): Promise<LlmProvider[]>
  getStatusChips(): Promise<StatusChip[]>
}

export interface IVoiceService {
  startListening(): Promise<void>
  stopListening(): Promise<void>
  getState(): VoiceState
  getAmplitude(): number
  getFrequencyData(): Uint8Array
  onStateChange(cb: (state: VoiceState) => void): () => void
  onAmplitudeChange(cb: (amplitude: number) => void): () => void
}

declare global {
  interface Window {
    jarvis?: {
      platform: string
      version: string
      backend?: {
        url: string
        token?: string
      }
      window?: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
    }
  }
}
