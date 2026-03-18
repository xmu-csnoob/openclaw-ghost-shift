import { i18n } from './content/i18n.js'
import { t } from './content/locale.js'
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
  const dayLabel = t(i18n.time.short.day)
  const hourLabel = t(i18n.time.short.hour)
  const minuteLabel = t(i18n.time.short.minute)

  if (days > 0) {
    return `${days}${dayLabel} ${hours}${hourLabel}`
  }
  if (hours > 0) {
    return `${hours}${hourLabel} ${minutes}${minuteLabel}`
  }

  return `${minutes}${minuteLabel}`
}

export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function getSignalWindowLabel(window: string): string {
  switch (window) {
    case 'live':
      return t(i18n.agent.window.live)
    case 'just-now':
      return t(i18n.agent.window.justNow)
    case '2m':
      return t(i18n.agent.window.twoMinutesAgo)
    case '10m':
      return t(i18n.agent.window.tenMinutesAgo)
    case '30m':
      return t(i18n.agent.window.thirtyMinutesAgo)
    case '2h':
      return t(i18n.agent.window.twoHoursAgo)
    case 'today':
      return t(i18n.agent.window.earlierToday)
    case 'archive':
      return t(i18n.agent.window.background)
    default:
      return t(i18n.agent.window.observed)
  }
}

export function getZoneLabel(zone: string): string {
  switch (zone) {
    case 'code-studio':
      return t(i18n.zones['code-studio'])
    case 'chat-lounge':
      return t(i18n.zones['chat-lounge'])
    case 'ops-lab':
      return t(i18n.zones['ops-lab'])
    default:
      return t(i18n.zones.public)
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
      return t(i18n.agent.band.surging)
    case 'steady':
      return t(i18n.agent.band.steady)
    case 'warm':
      return t(i18n.agent.band.warm)
    default:
      return t(i18n.agent.band.quiet)
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
      return t(i18n.agent.footprint.deepStack)
    case 'heavy-context':
      return t(i18n.agent.footprint.heavyContext)
    case 'working-set':
      return t(i18n.agent.footprint.workingSet)
    case 'fresh-thread':
      return t(i18n.agent.footprint.freshThread)
    default:
      return t(i18n.agent.footprint.publicThread)
  }
}

export function getStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'running':
      return t(i18n.agent.status.running)
    case 'idle':
    case undefined:
    case null:
      return t(i18n.agent.status.idle)
    default:
      return status
  }
}

export function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'assistant':
      return t(i18n.agent.role.assistant)
    case 'automation':
      return t(i18n.agent.role.automation)
    case 'webchat':
      return t(i18n.agent.role.webchat)
    case undefined:
    case null:
      return t(i18n.caseStudy.fields.hidden)
    default:
      return role
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
