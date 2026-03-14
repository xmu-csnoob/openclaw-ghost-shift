export interface AgentSession {
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
