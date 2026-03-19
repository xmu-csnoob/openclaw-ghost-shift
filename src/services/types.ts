export interface AgentSession {
  publicId?: string
  sessionKey: string
  agentId: string
  model?: string
  status?: 'idle' | 'running' | 'connected' | 'disconnected' | 'error'
  zone: 'code-studio' | 'chat-lounge' | 'ops-lab' | string
  role: 'coding-agent' | 'webchat' | 'automation' | string
  origin: string
  activityScore?: number
  activityWindow?: string
  footprint?: string
}

export interface PublicOfficeStatus {
  connected: boolean
  status: string
  displayed: number
  running: number
  lastUpdatedAt: string
  filtered?: number
  total?: number
}

export type SessionFilterStatus = 'all' | 'live' | 'active' | 'warm' | 'visible' | 'running' | 'idle'

export interface FilterInfo {
  status?: SessionFilterStatus
  minActivity?: string
  includeZombie?: boolean
}

export interface PublicOfficeSnapshot {
  status: PublicOfficeStatus
  sessions: AgentSession[]
  filter?: FilterInfo
}

export interface PublicTimelinePoint {
  capturedAt: string
  connected: boolean
  status: string
  displayed: number
  running: number
}

export interface PublicTimelineResponse {
  retentionHours: number
  intervalSeconds: number
  points: PublicTimelinePoint[]
}

export interface PublicReplayFrame {
  capturedAt: string
  status: PublicOfficeStatus
  sessions: AgentSession[]
}

export interface PublicReplayResponse {
  retentionHours: number
  intervalSeconds: number
  frames: PublicReplayFrame[]
}

export interface PublicMetricsLive {
  tps: number
  onlineAgents: number
  averageLoad: number
  updatedAt: string
}

export interface PublicAnalyticsTrendPoint {
  capturedAt: string
  onlineAgents: number
  runningAgents: number
  messageCount: number
  totalTokens: number
  deltaMessages: number
  deltaToolCalls: number
  deltaTokens: number
  avgResponseTime: number
}

export interface PublicAnalyticsTrendSummary {
  sampleCount: number
  onlineAgentsDelta: number
  runningAgentsDelta: number
  messageCountDelta: number
  toolCallCount: number
  totalTokensDelta: number
  avgResponseTime: number
}

export interface PublicAnalyticsTrendsResponse {
  hours: number
  since: string
  until: string
  points: PublicAnalyticsTrendPoint[]
  summary: PublicAnalyticsTrendSummary
}

export interface PublicAnalyticsComparePeriod {
  label: string
  date: string
  avgOnlineAgents: number
  avgRunningAgents: number
  messageCountDelta: number
  toolCallCount: number
  totalTokensDelta: number
  avgResponseTime: number
}

export interface PublicAnalyticsCompareDelta {
  avgOnlineAgents: number
  avgRunningAgents: number
  messageCountDelta: number
  toolCallCount: number
  totalTokensDelta: number
  avgResponseTime: number
}

export interface PublicAnalyticsCompareResponse {
  timezone: string
  comparedAt: string
  today: PublicAnalyticsComparePeriod
  yesterday: PublicAnalyticsComparePeriod
  delta: PublicAnalyticsCompareDelta
}

export interface PublicZoneStatusDistribution {
  status: string
  count: number
  share: number
}

export interface PublicZoneHeatmapEntry {
  zone: string
  activityScore: number
  agentCount: number
  statusDistribution: PublicZoneStatusDistribution[]
}

export interface PublicZonesHeatmapResponse {
  capturedAt: string
  zones: PublicZoneHeatmapEntry[]
}

export interface PublicModelDistributionEntry {
  model: string
  share: number
  sampleCount: number
  agentCount: number
  avgResponseTime: number
  throughputTokensPerMinute: number
  avgLoad: number
}

export interface PublicModelsDistributionResponse {
  models: PublicModelDistributionEntry[]
}

export interface PublicAgentActivePeriod {
  label: string
  count: number
  share: number
}

export interface PublicAgentStats {
  publicId: string
  agentId: string
  workTimeSeconds: number
  toolCallCount: number
  avgResponseTime: number
  activePeriods: PublicAgentActivePeriod[]
  messageCount: number
  sampleCount: number
}
