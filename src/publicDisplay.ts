import type { AgentSession } from './services/types.js'

export type ActivityBand = 'surging' | 'steady' | 'warm' | 'quiet'

export interface SessionObservation {
  firstSeenAt: number
  lastSeenAt: number
  lastChangedAt: number
  lastStatus: string
  sampleCount: number
  activeSamples: number
}

export interface DisplaySession extends AgentSession {
  modelFamily: string
  observedSince: number
  lastChangedAt: number
  signalScore: number
  signalWindow: string
  footprintLabel: string
  sampleCount: number
  activityBand: ActivityBand
}

export interface PulseSample {
  timestamp: number
  displayed: number
  running: number
}

export interface ModelMixEntry {
  label: string
  count: number
  share: number
}

export interface ZoneMixEntry {
  zone: string
  label: string
  count: number
  running: number
}

export function updateObservation(
  previous: SessionObservation | undefined,
  session: AgentSession,
  now: number,
): SessionObservation {
  const next: SessionObservation = previous
    ? { ...previous }
    : {
        firstSeenAt: now,
        lastSeenAt: now,
        lastChangedAt: now,
        lastStatus: session.status || 'idle',
        sampleCount: 0,
        activeSamples: 0,
      }

  const currentStatus = session.status || 'idle'
  if (next.lastStatus !== currentStatus) {
    next.lastChangedAt = now
    next.lastStatus = currentStatus
  }

  next.lastSeenAt = now
  next.sampleCount += 1
  if (currentStatus === 'running') {
    next.activeSamples += 1
  }

  return next
}

export function toDisplaySession(session: AgentSession, observation: SessionObservation): DisplaySession {
  const fallbackScore =
    observation.sampleCount > 0 ? observation.activeSamples / observation.sampleCount : 0
  const signalScore = clampRatio(session.activityScore ?? fallbackScore)
  const signalWindow = session.activityWindow || fallbackSignalWindow(session.status)

  return {
    ...session,
    modelFamily: getModelFamily(session.model),
    observedSince: observation.firstSeenAt,
    lastChangedAt: observation.lastChangedAt,
    signalScore,
    signalWindow,
    footprintLabel: getFootprintLabel(session.footprint),
    sampleCount: observation.sampleCount,
    activityBand: getActivityBand(session.status, signalScore),
  }
}

export function getModelFamily(model?: string): string {
  if (!model) return 'Hidden'

  const value = model.toLowerCase()
  if (value.includes('gpt')) return 'GPT'
  if (value.includes('claude')) return 'Claude'
  if (value.includes('gemini')) return 'Gemini'
  if (value.includes('qwen')) return 'Qwen'
  if (value.includes('deepseek')) return 'DeepSeek'
  if (value.includes('llama')) return 'Llama'
  if (value.includes('mistral')) return 'Mistral'

  return model.split(/[-/:]/)[0] || model
}

export function getActivityBand(status: string | undefined, signalScore: number): ActivityBand {
  if (status === 'running' || signalScore >= 0.85) return 'surging'
  if (signalScore >= 0.6) return 'steady'
  if (signalScore >= 0.3) return 'warm'
  return 'quiet'
}

export function formatDurationShort(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function getSignalWindowLabel(window: string): string {
  switch (window) {
    case 'live':
      return '实时'
    case 'just-now':
      return '刚刚'
    case '2m':
      return '2分钟前'
    case '10m':
      return '10分钟前'
    case '30m':
      return '30分钟前'
    case '2h':
      return '2小时前'
    case 'today':
      return '今天早些'
    case 'archive':
      return '背景'
    default:
      return '已观察'
  }
}

export function getZoneLabel(zone: string): string {
  switch (zone) {
    case 'code-studio':
      return '代码工作室'
    case 'chat-lounge':
      return '对话休息室'
    case 'ops-lab':
      return '运维实验室'
    default:
      return '公共区域'
  }
}

export function getZoneColor(zone: string): string {
  switch (zone) {
    case 'code-studio':
      return '#ff6b35'
    case 'chat-lounge':
      return '#ef4444'
    case 'ops-lab':
      return '#f59e0b'
    default:
      return '#d4a574'
  }
}

export function getActivityLabel(band: ActivityBand): string {
  switch (band) {
    case 'surging':
      return 'Surging'
    case 'steady':
      return 'Steady'
    case 'warm':
      return 'Warm'
    default:
      return 'Quiet'
  }
}

export function getActivityColor(band: ActivityBand): string {
  switch (band) {
    case 'surging':
      return '#ef4444'
    case 'steady':
      return '#ff6b35'
    case 'warm':
      return '#f59e0b'
    default:
      return '#d4a574'
  }
}

export function getFootprintLabel(footprint: string | undefined): string {
  switch (footprint) {
    case 'deep-stack':
      return 'Deep Stack'
    case 'heavy-context':
      return 'Heavy Context'
    case 'working-set':
      return 'Working Set'
    case 'fresh-thread':
      return 'Fresh Thread'
    default:
      return 'Public Thread'
  }
}

export function getPublicAgentLabel(agentLabel?: string, numericId?: number): string {
  if (agentLabel && agentLabel.trim()) {
    return agentLabel.trim()
  }

  if (typeof numericId === 'number' && Number.isFinite(numericId)) {
    return `Agent ${String(numericId).padStart(2, '0')}`
  }

  return 'Agent'
}

export function summarizeModelMix(sessions: DisplaySession[]): ModelMixEntry[] {
  const counts = new Map<string, number>()
  for (const session of sessions) {
    const key = session.modelFamily || 'Hidden'
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const total = Math.max(sessions.length, 1)
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      share: count / total,
    }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
}

export function summarizeZones(sessions: DisplaySession[]): ZoneMixEntry[] {
  const totals = new Map<string, ZoneMixEntry>()
  for (const session of sessions) {
    const zone = session.zone || 'ops-lab'
    const entry = totals.get(zone) || {
      zone,
      label: getZoneLabel(zone),
      count: 0,
      running: 0,
    }
    entry.count += 1
    if (session.status === 'running') {
      entry.running += 1
    }
    totals.set(zone, entry)
  }

  return Array.from(totals.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function fallbackSignalWindow(status: string | undefined): string {
  return status === 'running' ? 'live' : 'observed'
}
