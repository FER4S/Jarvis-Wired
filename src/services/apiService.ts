import type { IJarvisApi } from './types'
import {
  agents,
  coreStats,
  feedItems,
  llmProviders,
  statusChips,
  systemMetrics,
  timelineEvents
} from './mockData'

export const mockJarvisApi: IJarvisApi = {
  getCoreStats: async () => coreStats,
  getFeedItems: async () => feedItems,
  getAgents: async () => agents,
  getTimeline: async () => timelineEvents,
  getSystemMetrics: async () => systemMetrics,
  getLlmProviders: async () => llmProviders,
  getStatusChips: async () => statusChips
}

export const jarvisApi: IJarvisApi = mockJarvisApi
