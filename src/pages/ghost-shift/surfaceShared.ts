import type { SurfaceExperiencePreferences } from '../../components/ExperiencePanel.js'
import { i18n } from '../../content/i18n/index.js'
import { t } from '../../content/locale.js'
import { OfficeState } from '../../office/engine/officeState.js'
import type { OfficeLayout } from '../../office/types.js'
import type { DisplaySession, SessionObservation } from '../../publicDisplay.js'
import {
  cloneSessions,
  findClosestFrameIndex,
  formatPlaybackTimestamp,
  getPlaybackWindowMs,
  type ReplayFrame,
  type TimelinePoint,
} from '../../replay.js'
import {
  getZoneColor,
  summarizeZones,
  toDisplaySession,
  updateObservation,
} from '../../publicDisplay.js'
import type { AgentSession, PublicOfficeStatus } from '../../services/types.js'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'
export type SharedPlaybackMode = 'live' | 'replay'
export type GhostShiftPage = 'landing' | 'live' | 'replay' | 'embed' | 'embed-card' | 'docs' | 'about'
export type LiveStagePanelKey = 'timeline' | 'pulse' | 'roster' | 'guide' | 'hover'

const officeStateRef = { current: null as OfficeState | null }
const sessionToAgentId = new Map<string, number>()
let clientIdCounter = 0

export const HISTORY_REFRESH_MS = 15_000
export const METRICS_LIVE_REFRESH_MS = 5_000
export const ANALYTICS_REFRESH_MS = 30_000
export const ANALYTICS_COMPARE_REFRESH_MS = 60_000
export const ANALYTICS_TREND_HOURS = 6
export const AUTO_TOUR_MIN_MS = 8_000
export const AUTO_TOUR_MAX_MS = 12_000
export const DELAYED_THRESHOLD_MS = 15_000
export const UI_PREFERENCES_KEY = 'ghost-shift-ui-preferences'

export const defaultLiveStagePanels: Record<LiveStagePanelKey, boolean> = {
  timeline: false,
  pulse: false,
  roster: false,
  guide: false,
  hover: false,
}

const zoneSeatPrefixes: Record<string, string[]> = {
  'code-studio': ['code-'],
  'chat-lounge': ['chat-'],
  'ops-lab': ['ops-'],
}

export const defaultSurfacePreferences: SurfaceExperiencePreferences = {
  theme: 'aurora',
  density: 'comfortable',
  autoSharePreview: true,
  coachTips: true,
}

export interface SurfaceSessionInsight {
  publicId: string
  activityPoints: Array<{ timestamp: number; score: number }>
  toolStats: Array<{ label: string; count: number; color: string }>
  dominantWindow: string
}

export function readSurfacePreferences(): SurfaceExperiencePreferences {
  if (typeof window === 'undefined') return defaultSurfacePreferences

  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_KEY)
    if (!raw) return defaultSurfacePreferences
    const parsed = JSON.parse(raw) as Partial<SurfaceExperiencePreferences>

    return {
      theme: parsed.theme === 'ember' || parsed.theme === 'circuit' || parsed.theme === 'aurora'
        ? parsed.theme
        : defaultSurfacePreferences.theme,
      density: parsed.density === 'compact' ? 'compact' : defaultSurfacePreferences.density,
      autoSharePreview: typeof parsed.autoSharePreview === 'boolean'
        ? parsed.autoSharePreview
        : defaultSurfacePreferences.autoSharePreview,
      coachTips: typeof parsed.coachTips === 'boolean'
        ? parsed.coachTips
        : defaultSurfacePreferences.coachTips,
    }
  } catch {
    return defaultSurfacePreferences
  }
}

export function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState()
  }
  return officeStateRef.current
}

export function parseWindowHours(value: string | null): 1 | 6 | 24 {
  if (value === '6') return 6
  if (value === '24') return 24
  return 1
}

export function parsePlaybackMode(value: string | null): SharedPlaybackMode {
  return value === 'replay' ? 'replay' : 'live'
}

export function buildEmbedSnippet(embedCardPath: string): string {
  return `<iframe
  src="${embedCardPath}"
  title="${t(i18n.summaryCard.iframeTitle)}"
  loading="lazy"
  style="width:100%;max-width:440px;min-height:520px;border:0;"
></iframe>`
}

export function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function seatMatchesZone(seatId: string | null | undefined, zone: string): boolean {
  if (!seatId) return false
  const prefixes = zoneSeatPrefixes[zone] || zoneSeatPrefixes['ops-lab']
  return prefixes.some((prefix) => seatId.startsWith(prefix))
}

function findPreferredSeat(officeState: OfficeState, zone: string): string | null {
  const prefixes = zoneSeatPrefixes[zone] || zoneSeatPrefixes['ops-lab']
  for (const [seatId, seat] of officeState.seats.entries()) {
    if (!seat.assigned && prefixes.some((prefix) => seatId.startsWith(prefix))) {
      return seatId
    }
  }
  return null
}

export function getAgentIdForSessionKey(sessionKey: string): number {
  let agentId = sessionToAgentId.get(sessionKey)
  if (agentId === undefined) {
    agentId = ++clientIdCounter
    sessionToAgentId.set(sessionKey, agentId)
  }
  return agentId
}

export function getNumericAgentId(sessionKey: string): number | undefined {
  return sessionToAgentId.get(sessionKey)
}

export function applyLiveSnapshotToOfficeState(
  officeState: OfficeState,
  sessions: AgentSession[],
  observations: Map<string, SessionObservation>,
  now: number,
): DisplaySession[] {
  const currentKeys = new Set(sessions.map((session) => session.sessionKey))
  const nextSessions: DisplaySession[] = []

  for (const session of sessions) {
    const agentId = getAgentIdForSessionKey(session.sessionKey)
    const previous = observations.get(session.sessionKey)
    const nextObservation = updateObservation(previous, session, now)
    observations.set(session.sessionKey, nextObservation)

    const preferredSeatId = findPreferredSeat(officeState, session.zone)
    const displaySession = toDisplaySession(session, nextObservation)

    if (!officeState.characters.has(agentId)) {
      officeState.addAgent(agentId, agentId % 6, undefined, preferredSeatId || undefined, true)
    }

    if (previous?.lastStatus !== 'running' && session.status === 'running') {
      officeState.showWaitingBubble(agentId)
    }

    const currentCharacter = officeState.characters.get(agentId)
    if (currentCharacter && !seatMatchesZone(currentCharacter.seatId, session.zone) && preferredSeatId) {
      officeState.reassignSeat(agentId, preferredSeatId)
    }

    officeState.setAgentActive(agentId, session.status === 'running' || displaySession.signalScore >= 0.72)
    nextSessions.push(displaySession)
  }

  for (const sessionKey of Array.from(observations.keys())) {
    if (currentKeys.has(sessionKey)) continue
    const agentId = sessionToAgentId.get(sessionKey)
    if (agentId !== undefined) {
      officeState.removeAgent(agentId)
    }
    observations.delete(sessionKey)
  }

  nextSessions.sort((a, b) => a.agentId.localeCompare(b.agentId))
  return nextSessions
}

function buildReplayCharacters(layout: OfficeLayout, sessions: DisplaySession[]): ReplayFrame['characters'] {
  const replayOfficeState = new OfficeState(layout)

  for (const session of sessions) {
    const agentId = getAgentIdForSessionKey(session.sessionKey)
    const preferredSeatId = findPreferredSeat(replayOfficeState, session.zone)
    replayOfficeState.addAgent(agentId, agentId % 6, undefined, preferredSeatId || undefined, true)
    replayOfficeState.setAgentActive(agentId, session.status === 'running' || session.signalScore >= 0.72)
  }

  return replayOfficeState.getCharacters().map((character) => ({
    ...character,
    path: character.path.map((step) => ({ ...step })),
    matrixEffectSeeds: [...character.matrixEffectSeeds],
  }))
}

export function buildReplayFrames(
  layout: OfficeLayout,
  frames: Array<{ capturedAt: string; status: PublicOfficeStatus; sessions: AgentSession[] }>,
): ReplayFrame[] {
  const observations = new Map<string, SessionObservation>()
  const replayFrames: ReplayFrame[] = []

  for (const frame of frames) {
    const timestamp = parseTimestamp(frame.capturedAt)
    if (timestamp === null) continue

    const displaySessions = frame.sessions
      .map((session) => {
        const previous = observations.get(session.sessionKey)
        const nextObservation = updateObservation(previous, session, timestamp)
        observations.set(session.sessionKey, nextObservation)
        return toDisplaySession(session, nextObservation)
      })
      .sort((a, b) => a.agentId.localeCompare(b.agentId))

    replayFrames.push({
      timestamp,
      status: { ...frame.status },
      sessions: cloneSessions(displaySessions),
      characters: buildReplayCharacters(layout, displaySessions),
    })
  }

  return replayFrames
}

export function buildTourCandidateIds(sessions: DisplaySession[]): number[] {
  const candidatePool = sessions.filter((session) => session.status === 'running' || session.signalScore >= 0.72)
  const ranked = (candidatePool.length > 0 ? candidatePool : sessions)
    .slice()
    .sort((a, b) => {
      if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore
      return a.agentId.localeCompare(b.agentId)
    })

  const byZone = new Map<string, number>()
  for (const session of ranked) {
    const agentId = sessionToAgentId.get(session.sessionKey)
    if (agentId === undefined || byZone.has(session.zone)) continue
    byZone.set(session.zone, agentId)
  }

  const uniqueCandidates = Array.from(byZone.values())
  if (uniqueCandidates.length > 0) {
    return uniqueCandidates
  }

  return ranked
    .map((session) => sessionToAgentId.get(session.sessionKey))
    .filter((agentId): agentId is number => agentId !== undefined)
}

export function getModelColor(label: string): string {
  switch (label.toLowerCase()) {
    case 'gpt':
      return '#7db3ff'
    case 'claude':
      return '#f6c978'
    case 'gemini':
      return '#9bffb4'
    case 'qwen':
      return '#ff9fb2'
    case 'deepseek':
      return '#cba6f7'
    default:
      return '#90a5c1'
  }
}

export function buildSessionInsights(
  replayFrames: ReplayFrame[],
  liveSessions: DisplaySession[],
  liveTimestamp: number,
): Map<string, SurfaceSessionInsight> {
  const insights = new Map<
    string,
    {
      publicId: string
      points: Array<{ timestamp: number; score: number }>
      toolStats: { read: number; write: number; ops: number }
      windowCounts: Map<string, number>
    }
  >()

  const sourceFrames = replayFrames.slice()
  if (liveSessions.length > 0) {
    sourceFrames.push({
      timestamp: liveTimestamp,
      status: replayFrames[replayFrames.length - 1]?.status || {
        connected: true,
        status: 'live',
        displayed: liveSessions.length,
        running: liveSessions.filter((session) => session.status === 'running').length,
        lastUpdatedAt: new Date(liveTimestamp).toISOString(),
      },
      sessions: liveSessions,
      characters: [],
    })
  }

  for (const frame of sourceFrames) {
    for (const session of frame.sessions) {
      const entry = insights.get(session.sessionKey) || {
        publicId: session.publicId || session.sessionKey,
        points: [],
        toolStats: { read: 0, write: 0, ops: 0 },
        windowCounts: new Map<string, number>(),
      }

      entry.points.push({
        timestamp: frame.timestamp,
        score: session.status === 'running' ? Math.max(session.signalScore, 0.9) : session.signalScore,
      })
      entry.windowCounts.set(session.signalWindow, (entry.windowCounts.get(session.signalWindow) || 0) + 1)

      if (session.role === 'automation') {
        entry.toolStats.ops += Math.max(1, Math.round(session.signalScore * 2))
      } else if (session.role === 'webchat') {
        entry.toolStats.read += 1
        entry.toolStats.ops += session.signalScore > 0.55 ? 1 : 0
      } else {
        entry.toolStats.write += session.status === 'running' ? 2 : session.signalScore > 0.7 ? 1 : 0
        entry.toolStats.read += session.signalScore < 0.55 ? 1 : 0
      }

      insights.set(session.sessionKey, entry)
    }
  }

  return new Map(
    Array.from(insights.entries()).map(([sessionKey, entry]) => {
      const dominantWindow =
        Array.from(entry.windowCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'observed'

      return [
        sessionKey,
        {
          publicId: entry.publicId,
          activityPoints: entry.points.slice(-20),
          toolStats: [
            { label: t(i18n.agent.toolStats.read), count: entry.toolStats.read, color: '#7db3ff' },
            { label: t(i18n.agent.toolStats.write), count: entry.toolStats.write, color: '#f6c978' },
            { label: t(i18n.agent.toolStats.ops), count: entry.toolStats.ops, color: '#9bffb4' },
          ],
          dominantWindow,
        },
      ]
    }),
  )
}

export function buildReplayPreviewFrames(
  frames: ReplayFrame[],
  currentReplayFrame: ReplayFrame | null,
  sampleCount: number = 4,
): Array<{
  id: string
  timestamp: number
  label: string
  running: number
  displayed: number
  zoneLabel: string
  accent: string
  isCurrent: boolean
  previewBars: number[]
}> {
  if (frames.length === 0) return []

  const resolvedSampleCount = Math.min(sampleCount, frames.length)
  const peakDisplayed = Math.max(1, ...frames.map((frame) => frame.status.displayed))
  const indices = new Set<number>([0, frames.length - 1])
  if (resolvedSampleCount > 2) {
    for (let step = 1; step < resolvedSampleCount - 1; step += 1) {
      indices.add(Math.round((step / (resolvedSampleCount - 1)) * (frames.length - 1)))
    }
  }

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => {
      const frame = frames[index]
      const topZone = summarizeZones(frame.sessions)[0]
      const runningRatio = frame.status.running / Math.max(frame.status.displayed, 1)
      const occupancyRatio = frame.status.displayed / peakDisplayed
      const zoneShare = (topZone?.count || 0) / Math.max(frame.sessions.length, 1)

      return {
        id: `${frame.timestamp}`,
        timestamp: frame.timestamp,
        label: formatPlaybackTimestamp(frame.timestamp),
        running: frame.status.running,
        displayed: frame.status.displayed,
        zoneLabel: t(topZone?.label || i18n.quietOffice),
        accent: getZoneColor(topZone?.zone || 'ops-lab'),
        isCurrent: currentReplayFrame?.timestamp === frame.timestamp,
        previewBars: [runningRatio, occupancyRatio, zoneShare],
      }
    })
}

export function buildReplayEventMarkers(
  frames: ReplayFrame[],
  scrubberMin: number,
  scrubberMax: number,
  maxMarkers: number = 6,
): Array<{ id: string; timestamp: number; position: number; label: string; tone: string }> {
  if (frames.length < 2 || scrubberMax <= scrubberMin) return []

  const events: Array<{ id: string; timestamp: number; position: number; label: string; tone: string }> = []
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const runningDelta = current.status.running - previous.status.running
    const visibleDelta = current.status.displayed - previous.status.displayed
    const currentZone = summarizeZones(current.sessions)[0]?.label
    const previousZone = summarizeZones(previous.sessions)[0]?.label

    if (Math.abs(runningDelta) < 2 && Math.abs(visibleDelta) < 2 && currentZone === previousZone) {
      continue
    }

    const tone =
      runningDelta > 0
        ? '#F38BA8'
        : runningDelta < 0
          ? '#89B4FA'
          : '#F9E2AF'
    const labelParts = [`${formatPlaybackTimestamp(current.timestamp)}`]
    if (runningDelta !== 0) {
      labelParts.push(`${runningDelta > 0 ? '+' : ''}${runningDelta} ${t(i18n.replay.freshness.liveDeltaSuffix)}`)
    }
    if (visibleDelta !== 0) {
      labelParts.push(`${visibleDelta > 0 ? '+' : ''}${visibleDelta} ${t(i18n.replay.freshness.visibleDeltaSuffix)}`)
    }
    if (currentZone !== previousZone && currentZone) {
      labelParts.push(`${t(i18n.replay.freshness.leadPrefix)} ${currentZone}`)
    }

    events.push({
      id: `${current.timestamp}`,
      timestamp: current.timestamp,
      position: (current.timestamp - scrubberMin) / (scrubberMax - scrubberMin),
      label: labelParts.join(' • '),
      tone,
    })
  }

  return events.slice(0, maxMarkers)
}

export function findReplayFrameIndex(frames: ReplayFrame[], timestamp: number): number {
  return findClosestFrameIndex(frames, timestamp)
}

export function getPlaybackWindow(windowHours: 1 | 6 | 24): number {
  return getPlaybackWindowMs(windowHours)
}

export type SurfaceTimelinePoint = TimelinePoint
