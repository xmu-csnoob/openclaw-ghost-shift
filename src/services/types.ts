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
}

export interface PublicOfficeSnapshot {
  status: PublicOfficeStatus
  sessions: AgentSession[]
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
