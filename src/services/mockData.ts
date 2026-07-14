import type {
  Agent,
  CoreStat,
  FeedItem,
  LlmProvider,
  MemoryEdge,
  MemoryNode,
  NavItem,
  NotificationItem,
  NewsItem,
  EmailItem,
  QuickCommand,
  StatusChip,
  SystemMetric,
  TimelineEvent
} from './types'

export const navItems: NavItem[] = [
  { id: 'command', label: 'Command Center', icon: 'layout-dashboard', active: true },
  { id: 'ai-core', label: 'AI Core', icon: 'cpu' },
  { id: 'agents', label: 'Agents', icon: 'bot' },
  { id: 'tasks', label: 'Tasks', icon: 'check-square', badge: 3 },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'memory', label: 'Memory', icon: 'brain' },
  { id: 'conversations', label: 'Conversations', icon: 'message-square', badge: 12 },
  { id: 'knowledge', label: 'Knowledge Base', icon: 'book-open' },
  { id: 'tools', label: 'Tools & Skills', icon: 'wrench', badge: 18 },
  { id: 'workflows', label: 'Workflows', icon: 'git-branch' }
]

export const coreStats: CoreStat[] = [
  { label: 'AI Core', value: 'Active', status: 'active', icon: 'cpu' },
  { label: 'Memory', value: '3,380 Stored', status: 'online', icon: 'brain' },
  { label: 'Voice', value: 'Online', status: 'online', icon: 'mic' },
  { label: 'Agents', value: '4 Connected', status: 'connected', icon: 'bot' },
  { label: 'LLMs', value: '6 Active', status: 'active', icon: 'zap' },
  { label: 'System', value: 'Optimal', status: 'active', icon: 'activity' }
]

export const feedItems: FeedItem[] = [
  { id: '1', tag: 'INFO', message: 'Task #247 marked complete — Deploy staging pipeline', time: '11:14' },
  { id: '2', tag: 'LIVE', message: 'GitHub PR #89 merged: HUD spacing improvements', time: '11:12' },
  { id: '3', tag: 'WARN', message: 'Memory index rebuild scheduled in 2 hours', time: '11:08' },
  { id: '4', tag: 'TIP', message: 'Voice model latency improved by 18% after cache warm-up', time: '11:05' },
  { id: '5', tag: 'INFO', message: 'Agent "Research" completed web scan — 14 sources indexed', time: '10:58' },
  { id: '6', tag: 'LIVE', message: 'CPU usage normalized after batch job completion', time: '10:52' },
  { id: '7', tag: 'INFO', message: 'New workflow template available: Daily Briefing', time: '10:45' }
]

export const agents: Agent[] = [
  { id: 'coding', name: 'Coding', status: 'active', icon: 'code', color: '#00d4ff' },
  { id: 'research', name: 'Research', status: 'active', icon: 'search', color: '#aa66ff' },
  { id: 'memory', name: 'Memory', status: 'standby', icon: 'brain', color: '#00ff88' },
  { id: 'browser', name: 'Browser', status: 'active', icon: 'globe', color: '#ffaa00' },
  { id: 'task', name: 'Task', status: 'standby', icon: 'list-todo', color: '#ff4466' },
  { id: 'system', name: 'System', status: 'active', icon: 'settings', color: '#00d4ff' }
]

export const timelineEvents: TimelineEvent[] = [
  { id: '1', title: 'Daily Standup', time: '09:00', progress: 100, status: 'done' },
  { id: '2', title: 'HUD Spacing Review', time: '10:30', progress: 100, status: 'done' },
  { id: '3', title: 'Deep-work Block', time: '11:00', progress: 65, status: 'active' },
  { id: '4', title: 'Agent Sync', time: '14:00', progress: 0, status: 'upcoming' },
  { id: '5', title: 'Executive Briefing', time: '17:00', progress: 0, status: 'upcoming' }
]

export const quickCommands: QuickCommand[] = [
  { id: 'task', label: 'Start New Task', icon: 'plus-circle' },
  { id: 'calendar', label: 'Open Calendar', icon: 'calendar' },
  { id: 'voice', label: 'Start Voice Chat', icon: 'mic' },
  { id: 'workflow', label: 'Run Workflow', icon: 'play' }
]

export const systemMetrics: SystemMetric[] = [
  { label: 'CPU', value: 15, color: '#00d4ff' },
  { label: 'RAM', value: 54, color: '#aa66ff' },
  { label: 'Disk', value: 40, color: '#00ff88' }
]

export const memoryNodes: MemoryNode[] = [
  { id: 'n1', x: 50, y: 30, size: 8 },
  { id: 'n2', x: 25, y: 55, size: 6 },
  { id: 'n3', x: 75, y: 50, size: 7 },
  { id: 'n4', x: 40, y: 75, size: 5 },
  { id: 'n5', x: 65, y: 25, size: 6 },
  { id: 'n6', x: 15, y: 40, size: 4 },
  { id: 'n7', x: 85, y: 70, size: 5 },
  { id: 'n8', x: 55, y: 60, size: 9 }
]

export const memoryEdges: MemoryEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n1', to: 'n3' },
  { from: 'n1', to: 'n5' },
  { from: 'n2', to: 'n4' },
  { from: 'n3', to: 'n7' },
  { from: 'n5', to: 'n8' },
  { from: 'n4', to: 'n8' },
  { from: 'n6', to: 'n2' }
]

export const memoryStats = {
  memories: 3380,
  sessionTurns: 22,
  toolCalls: 47
}

export const llmProviders: LlmProvider[] = [
  { id: 'claude', name: 'Claude', connected: true },
  { id: 'openai', name: 'OpenAI', connected: true },
  { id: 'gemini', name: 'Gemini', connected: true },
  { id: 'groq', name: 'Groq', connected: true },
  { id: 'openrouter', name: 'OpenRouter', connected: false },
  { id: 'ollama', name: 'Ollama', connected: true },
  { id: 'claude-code', name: 'Claude Code', connected: true },
  { id: 'cursor', name: 'Cursor', connected: true },
  { id: 'copilot', name: 'Copilot', connected: false }
]

export const statusChips: StatusChip[] = [
  { label: 'Location', value: 'Bhimber, Pak', icon: 'map-pin' },
  { label: 'Weather', value: '28°C Overcast', icon: 'cloud' },
  { label: 'Network', value: 'Excellent', icon: 'wifi' }
]

export const assessmentStats = [
  { label: 'INTELLIGENCE QUOTIENT', value: '168' },
  { label: 'ADAPTABILITY', value: 'HIGH' },
  { label: 'MEMORY INDEX', value: '9.8TB' },
  { label: 'LOGIC PROCESSING', value: '18 TFLOPs' }
]

export const skillAxes = [
  { label: 'Logic', value: 92 },
  { label: 'Memory', value: 88 },
  { label: 'Language', value: 95 },
  { label: 'Vision', value: 78 },
  { label: 'Reasoning', value: 90 },
  { label: 'Creativity', value: 85 }
]

export const collaborationNodes = [
  { id: 'c1', label: 'HUMAN LABS', x: 25, y: 30, size: 5 },
  { id: 'c2', label: 'HUMAN COM', x: 75, y: 25, size: 5 },
  { id: 'c3', label: 'HUMAN OPS', x: 20, y: 70, size: 4 },
  { id: 'c4', label: 'HUMAN R&D', x: 80, y: 75, size: 4 },
  { id: 'center', label: 'CONNECTION', x: 50, y: 50, size: 7, central: true }
]

export const collaborationEdges = [
  { from: 'center', to: 'c1' },
  { from: 'center', to: 'c2' },
  { from: 'center', to: 'c3' },
  { from: 'center', to: 'c4' },
  { from: 'c1', to: 'c2' },
  { from: 'c3', to: 'c4' }
]

export const notifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Security Scan Complete',
    message: 'No threats detected across all connected nodes.',
    time: '2m ago',
    priority: 'normal',
    read: false,
    source: 'JARVIS Security'
  },
  {
    id: 'n2',
    title: 'Agent Task Finished',
    message: 'Research agent indexed 14 new sources for your briefing.',
    time: '8m ago',
    priority: 'low',
    read: false,
    source: 'Agent Network'
  },
  {
    id: 'n3',
    title: 'Calendar Reminder',
    message: 'Executive briefing starts in 45 minutes.',
    time: '12m ago',
    priority: 'high',
    read: false,
    source: 'Calendar'
  },
  {
    id: 'n4',
    title: 'System Update',
    message: 'Neural core patch v3.0.1 installed successfully.',
    time: '28m ago',
    priority: 'normal',
    read: true,
    source: 'System'
  },
  {
    id: 'n5',
    title: 'Memory Sync',
    message: 'Long-term memory index optimized — 12% faster retrieval.',
    time: '1h ago',
    priority: 'low',
    read: true,
    source: 'Memory Core'
  }
]

export const newsItems: NewsItem[] = [
  {
    id: 'news1',
    headline: 'Global AI regulation framework advances to final vote in EU parliament',
    source: 'Reuters',
    time: '14m ago',
    category: 'Tech Policy',
    breaking: true
  },
  {
    id: 'news2',
    headline: 'Quantum computing breakthrough achieves new error-correction milestone',
    source: 'Nature',
    time: '32m ago',
    category: 'Science'
  },
  {
    id: 'news3',
    headline: 'Major cloud providers announce unified edge-AI deployment standard',
    source: 'TechCrunch',
    time: '1h ago',
    category: 'Industry'
  },
  {
    id: 'news4',
    headline: 'Markets rally as semiconductor supply chain stabilizes in Q2',
    source: 'Bloomberg',
    time: '2h ago',
    category: 'Finance'
  },
  {
    id: 'news5',
    headline: 'Open-source LLM ecosystem sees 40% contributor growth this quarter',
    source: 'The Verge',
    time: '3h ago',
    category: 'AI'
  }
]

export const emails: EmailItem[] = [
  {
    id: 'e1',
    from: 'Sarah Chen',
    subject: 'Q2 Strategy Review — Action Items',
    preview: 'Hi, attached are the action items from yesterday\'s strategy session. Please review the deployment timeline...',
    time: '9:42 AM',
    unread: true,
    starred: true
  },
  {
    id: 'e2',
    from: 'DevOps Team',
    subject: 'Staging pipeline deployed successfully',
    preview: 'The staging environment is now live with the latest HUD improvements. Smoke tests passed.',
    time: '9:15 AM',
    unread: true
  },
  {
    id: 'e3',
    from: 'Marcus Webb',
    subject: 'Re: Neural interface prototype feedback',
    preview: 'The voice-reactive sphere demo looks incredible. Can we schedule a walkthrough for the board?',
    time: '8:30 AM',
    unread: true
  },
  {
    id: 'e4',
    from: 'GitHub',
    subject: '[jarvis-front] PR #89 merged',
    preview: 'Your pull request "HUD spacing improvements" was merged into main by khaledezaldin.',
    time: 'Yesterday',
    unread: false
  },
  {
    id: 'e5',
    from: 'AWS Billing',
    subject: 'Your invoice for March 2026',
    preview: 'Your AWS invoice is ready. Total amount: $142.38. View details in the billing console.',
    time: 'Yesterday',
    unread: false
  }
]
