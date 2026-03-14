import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaseStudyLayer } from './components/CaseStudyLayer.js'
import { GhostShiftSummaryCard } from './components/GhostShiftSummaryCard.js'
import { LiveOfficeStage } from './components/LiveOfficeStage.js'
import { ProductDashboard } from './components/ProductDashboard.js'
import { RealtimeStatsSidebar } from './components/RealtimeStatsSidebar.js'
import { SharePanel } from './components/SharePanel.js'
import {
  demoSidebarNotes,
  documentationPoints,
  heroPills,
  surfaceCards,
} from './content/ghostShiftContent.js'
import { OfficeState } from './office/engine/officeState.js'
import type { OfficeLayout } from './office/types.js'
import type { DisplaySession, SessionObservation } from './publicDisplay.js'
import {
  formatDurationShort,
  getPublicAgentLabel,
  getZoneColor,
  getZoneLabel,
  summarizeModelMix,
  summarizeZones,
  toDisplaySession,
  updateObservation,
} from './publicDisplay.js'
import {
  cloneSessions,
  findClosestFrameIndex,
  formatPlaybackBoundary,
  formatPlaybackTimestamp,
  formatRelativeAge,
  getPlaybackWindowMs,
  type PlaybackState,
  type ReplayFrame,
  type TimelinePoint,
} from './replay.js'
import { apiClient } from './services/ApiClient.js'
import type { HistoryMeta } from './portfolioMetrics.js'
import type {
  AgentSession,
  PublicOfficeSnapshot,
  PublicOfficeStatus,
} from './services/types.js'
import { SNAPSHOT_REFRESH_MS, SUMMARY_CARD_SEGMENT } from './surfaceConfig.js'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'
type SurfaceMode = 'portfolio' | 'embed-card'
type SharedPlaybackMode = 'live' | 'replay'

const officeStateRef = { current: null as OfficeState | null }
const sessionToAgentId = new Map<string, number>()
let clientIdCounter = 0

const HISTORY_REFRESH_MS = 15_000
const AUTO_TOUR_MIN_MS = 8_000
const AUTO_TOUR_MAX_MS = 12_000
const DELAYED_THRESHOLD_MS = 15_000

const zoneSeatPrefixes: Record<string, string[]> = {
  'code-studio': ['code-'],
  'chat-lounge': ['chat-'],
  'ops-lab': ['ops-'],
}

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState()
  }
  return officeStateRef.current
}

function normalizePath(pathname: string): string {
  if (!pathname) return '/'
  return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function removePathSuffix(pathname: string, suffix: string): string {
  if (!pathname.endsWith(suffix)) return pathname
  const nextPath = pathname.slice(0, pathname.length - suffix.length)
  return nextPath || '/'
}

function resolveSurfaceMode(pathname: string, search: string): SurfaceMode {
  const params = new URLSearchParams(search)
  const embed = params.get('embed')
  const surface = params.get('surface')
  const normalizedPath = normalizePath(pathname)

  if (
    embed === 'summary' ||
    embed === 'card' ||
    surface === 'embed-card' ||
    normalizedPath.endsWith(SUMMARY_CARD_SEGMENT) ||
    normalizedPath.endsWith('/embed')
  ) {
    return 'embed-card'
  }

  return 'portfolio'
}

function getSurfacePaths(pathname: string): { livePath: string; embedCardPath: string } {
  const normalized = normalizePath(pathname)
  const livePath = normalized.endsWith(SUMMARY_CARD_SEGMENT)
    ? removePathSuffix(normalized, SUMMARY_CARD_SEGMENT)
    : normalized.endsWith('/embed')
      ? removePathSuffix(normalized, '/embed')
      : normalized
  const embedCardPath = livePath === '/' ? SUMMARY_CARD_SEGMENT : `${livePath}${SUMMARY_CARD_SEGMENT}`
  return { livePath, embedCardPath }
}

function parseWindowHours(value: string | null): PlaybackState['windowHours'] {
  if (value === '6') return 6
  if (value === '24') return 24
  return 1
}

function parsePlaybackMode(value: string | null): SharedPlaybackMode {
  return value === 'replay' ? 'replay' : 'live'
}

function buildEmbedSnippet(embedCardPath: string): string {
  return `<iframe
  src="${embedCardPath}"
  title="Ghost Shift summary card"
  loading="lazy"
  style="width:100%;max-width:440px;min-height:520px;border:0;"
></iframe>`
}

function parseTimestamp(value: string | undefined): number | null {
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

function getAgentIdForSessionKey(sessionKey: string): number {
  let agentId = sessionToAgentId.get(sessionKey)
  if (agentId === undefined) {
    agentId = ++clientIdCounter
    sessionToAgentId.set(sessionKey, agentId)
  }
  return agentId
}

function applyLiveSnapshotToOfficeState(
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

function buildReplayFrames(layout: OfficeLayout, frames: Array<{ capturedAt: string; status: PublicOfficeStatus; sessions: AgentSession[] }>): ReplayFrame[] {
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

function buildTourCandidateIds(sessions: DisplaySession[]): number[] {
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

function getModelColor(label: string): string {
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

function buildSessionInsights(replayFrames: ReplayFrame[], liveSessions: DisplaySession[], liveTimestamp: number) {
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
            { label: 'Read', count: entry.toolStats.read, color: '#7db3ff' },
            { label: 'Write', count: entry.toolStats.write, color: '#f6c978' },
            { label: 'Ops', count: entry.toolStats.ops, color: '#9bffb4' },
          ],
          dominantWindow,
        },
      ]
    }),
  )
}

function buildReplayPreviewFrames(
  frames: ReplayFrame[],
  currentReplayFrame: ReplayFrame | null,
): Array<{
  id: string
  timestamp: number
  label: string
  running: number
  displayed: number
  zoneLabel: string
  accent: string
  isCurrent: boolean
}> {
  if (frames.length === 0) return []

  const sampleCount = Math.min(4, frames.length)
  const indices = new Set<number>([0, frames.length - 1])
  if (sampleCount > 2) {
    for (let step = 1; step < sampleCount - 1; step += 1) {
      indices.add(Math.round((step / (sampleCount - 1)) * (frames.length - 1)))
    }
  }

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => {
      const frame = frames[index]
      const topZone = summarizeZones(frame.sessions)[0]
      return {
        id: `${frame.timestamp}`,
        timestamp: frame.timestamp,
        label: formatPlaybackTimestamp(frame.timestamp),
        running: frame.status.running,
        displayed: frame.status.displayed,
        zoneLabel: topZone?.label || 'Quiet office',
        accent: getZoneColor(topZone?.zone || 'ops-lab'),
        isCurrent: currentReplayFrame?.timestamp === frame.timestamp,
      }
    })
}

function buildReplayEventMarkers(
  frames: ReplayFrame[],
  scrubberMin: number,
  scrubberMax: number,
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
    if (runningDelta !== 0) labelParts.push(`${runningDelta > 0 ? '+' : ''}${runningDelta} live`)
    if (visibleDelta !== 0) labelParts.push(`${visibleDelta > 0 ? '+' : ''}${visibleDelta} visible`)
    if (currentZone !== previousZone && currentZone) labelParts.push(`lead ${currentZone}`)

    events.push({
      id: `${current.timestamp}`,
      timestamp: current.timestamp,
      position: (current.timestamp - scrubberMin) / (scrubberMax - scrubberMin),
      label: labelParts.join(' • '),
      tone,
    })
  }

  return events.slice(0, 6)
}

function App() {
  const officeState = getOfficeState()

  const [{ surfaceMode, livePath, embedCardPath, initialMode, initialWindowHours, initialTimestamp }] = useState(() => {
    const pathname = window.location.pathname
    const search = window.location.search
    const params = new URLSearchParams(search)
    return {
      surfaceMode: resolveSurfaceMode(pathname, search),
      ...getSurfacePaths(pathname),
      initialMode: parsePlaybackMode(params.get('mode')),
      initialWindowHours: parseWindowHours(params.get('window')),
      initialTimestamp: parseTimestamp(params.get('ts') || undefined),
    }
  })

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [liveSnapshot, setLiveSnapshot] = useState<PublicOfficeSnapshot | null>(null)
  const [liveSessions, setLiveSessions] = useState<DisplaySession[]>([])
  const [timelineSeries, setTimelineSeries] = useState<TimelinePoint[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>([])
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    mode: initialMode,
    windowHours: initialWindowHours,
    selectedTimestamp: initialTimestamp,
    currentFrameIndex: 0,
    isPlaying: false,
    playbackRate: 1,
  })
  const [backendError, setBackendError] = useState<string | null>(null)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [zoom, setZoom] = useState(() => {
    const dpr = window.devicePixelRatio || 1
    return Math.round(2 * dpr)
  })
  const [compactViewport, setCompactViewport] = useState(() => window.innerWidth < 980)
  const [autoTourPaused, setAutoTourPaused] = useState(false)
  const [tourTargetAgentId, setTourTargetAgentId] = useState<number | null>(null)
  const [responseTrend, setResponseTrend] = useState<Array<{ timestamp: number; value: number }>>([])
  const [hoverState, setHoverState] = useState<{ agentId: number | null; position: { x: number; y: number } | null }>({
    agentId: null,
    position: null,
  })
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const panRef = useRef({ x: 0, y: 0 })
  const observationsRef = useRef<Map<string, SessionObservation>>(new Map())
  const tourCursorRef = useRef(-1)
  const tourCandidatesRef = useRef<number[]>([])

  const liveStatus = liveSnapshot?.status ?? null
  const liveTimestamp = parseTimestamp(liveStatus?.lastUpdatedAt) ?? Date.now()
  const playbackWindowMs = getPlaybackWindowMs(playbackState.windowHours)

  const visibleReplayStartIndex = useMemo(() => {
    if (replayFrames.length === 0) return 0
    const latestTimestamp = replayFrames[replayFrames.length - 1].timestamp
    const cutoff = latestTimestamp - playbackWindowMs
    const matchIndex = replayFrames.findIndex((frame) => frame.timestamp >= cutoff)
    return matchIndex === -1 ? 0 : matchIndex
  }, [playbackWindowMs, replayFrames])

  const visibleReplayFrames = useMemo(
    () => replayFrames.slice(visibleReplayStartIndex),
    [replayFrames, visibleReplayStartIndex],
  )

  const scrubberMin = visibleReplayFrames[0]?.timestamp ?? liveTimestamp
  const scrubberMax = visibleReplayFrames[visibleReplayFrames.length - 1]?.timestamp ?? liveTimestamp

  useEffect(() => {
    const handleResize = () => {
      setCompactViewport(window.innerWidth < 980)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchSnapshot = async () => {
      const requestStartedAt = performance.now()
      try {
        const snapshot = await apiClient.getSnapshot()
        if (cancelled) return

        const now = Date.now()
        const nextSessions = applyLiveSnapshotToOfficeState(
          officeState,
          snapshot.sessions,
          observationsRef.current,
          now,
        )

        startTransition(() => {
          setLiveSnapshot(snapshot)
          setLiveSessions(nextSessions)
        })
        setResponseTrend((previous) =>
          previous
            .concat({
              timestamp: now,
              value: performance.now() - requestStartedAt,
            })
            .slice(-40),
        )
        setConnectionState(snapshot.status.connected ? 'connected' : 'disconnected')
        setBackendError(null)
        setIsSnapshotLoading(false)
      } catch {
        if (cancelled) return
        setConnectionState('disconnected')
        setBackendError('API unavailable')
        setIsSnapshotLoading(false)
      }
    }

    fetchSnapshot()
    const intervalId = window.setInterval(fetchSnapshot, SNAPSHOT_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [officeState])

  useEffect(() => {
    let cancelled = false

    const fetchHistory = async () => {
      try {
        const timelineSince = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString()
        const replaySince = new Date(Date.now() - getPlaybackWindowMs(24)).toISOString()
        const [timelineResponse, replayResponse] = await Promise.all([
          apiClient.getTimeline(timelineSince),
          apiClient.getReplay(replaySince),
        ])

        if (cancelled) return

        startTransition(() => {
          setTimelineSeries(
            timelineResponse.points
              .map((point) => {
                const timestamp = parseTimestamp(point.capturedAt)
                if (timestamp === null) return null
                return {
                  timestamp,
                  displayed: point.displayed,
                  running: point.running,
                  connected: point.connected,
                }
              })
              .filter((point): point is TimelinePoint => point !== null),
          )
          setHistoryMeta({
            intervalSeconds: timelineResponse.intervalSeconds,
            retentionHours: timelineResponse.retentionHours,
          })
          setReplayFrames(buildReplayFrames(officeState.getLayout(), replayResponse.frames))
        })
        setIsHistoryLoading(false)
      } catch {
        if (!cancelled) {
          setBackendError((previous) => previous ?? 'History unavailable')
          setIsHistoryLoading(false)
        }
      }
    }

    fetchHistory()
    const intervalId = window.setInterval(fetchHistory, HISTORY_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [officeState])

  useEffect(() => {
    if (replayFrames.length === 0) return

    setPlaybackState((previous) => {
      const latestIndex = replayFrames.length - 1
      const latestTimestamp = replayFrames[latestIndex].timestamp

      if (previous.mode === 'live') {
        if (
          previous.currentFrameIndex === latestIndex &&
          previous.selectedTimestamp === latestTimestamp &&
          !previous.isPlaying
        ) {
          return previous
        }
        return {
          ...previous,
          currentFrameIndex: latestIndex,
          selectedTimestamp: latestTimestamp,
          isPlaying: false,
        }
      }

      const clampedTimestamp = Math.max(scrubberMin, Math.min(scrubberMax, previous.selectedTimestamp ?? latestTimestamp))
      const relativeIndex = findClosestFrameIndex(visibleReplayFrames, clampedTimestamp)
      const nextIndex = relativeIndex === -1 ? latestIndex : visibleReplayStartIndex + relativeIndex
      const nextTimestamp = replayFrames[nextIndex]?.timestamp ?? latestTimestamp

      if (
        previous.currentFrameIndex === nextIndex &&
        previous.selectedTimestamp === nextTimestamp
      ) {
        return previous
      }

      return {
        ...previous,
        currentFrameIndex: nextIndex,
        selectedTimestamp: nextTimestamp,
      }
    })
  }, [replayFrames, scrubberMax, scrubberMin, visibleReplayFrames, visibleReplayStartIndex])

  useEffect(() => {
    if (playbackState.mode !== 'replay' || !playbackState.isPlaying) return

    const lastVisibleIndex = visibleReplayStartIndex + visibleReplayFrames.length - 1
    if (playbackState.currentFrameIndex >= lastVisibleIndex || replayFrames.length < 2) {
      setPlaybackState((previous) => (previous.isPlaying ? { ...previous, isPlaying: false } : previous))
      return
    }

    const currentFrame = replayFrames[playbackState.currentFrameIndex]
    const nextFrame = replayFrames[playbackState.currentFrameIndex + 1]
    if (!currentFrame || !nextFrame) {
      setPlaybackState((previous) => (previous.isPlaying ? { ...previous, isPlaying: false } : previous))
      return
    }

    const delayMs = Math.max(
      240,
      Math.min(2_400, (nextFrame.timestamp - currentFrame.timestamp) / playbackState.playbackRate),
    )
    const timeoutId = window.setTimeout(() => {
      setPlaybackState((previous) => {
        if (previous.mode !== 'replay' || !previous.isPlaying) return previous
        const nextIndex = Math.min(previous.currentFrameIndex + 1, lastVisibleIndex)
        return {
          ...previous,
          currentFrameIndex: nextIndex,
          selectedTimestamp: replayFrames[nextIndex]?.timestamp ?? previous.selectedTimestamp,
          isPlaying: nextIndex < lastVisibleIndex,
        }
      })
    }, delayMs)

    return () => window.clearTimeout(timeoutId)
  }, [
    playbackState.currentFrameIndex,
    playbackState.isPlaying,
    playbackState.mode,
    playbackState.playbackRate,
    replayFrames,
    visibleReplayFrames.length,
    visibleReplayStartIndex,
  ])

  const pauseAutoTour = useCallback(() => {
    setAutoTourPaused(true)
    setTourTargetAgentId(null)
  }, [])

  const tourCandidates = useMemo(() => buildTourCandidateIds(liveSessions), [liveSessions])

  useEffect(() => {
    tourCandidatesRef.current = tourCandidates
  }, [tourCandidates])

  useEffect(() => {
    if (playbackState.mode !== 'live' || autoTourPaused) {
      setTourTargetAgentId(null)
      return
    }

    let timeoutId = 0
    let cancelled = false

    const cycle = () => {
      if (cancelled) return

      const candidates = tourCandidatesRef.current.filter((agentId) => officeState.characters.has(agentId))
      if (candidates.length === 0) {
        setTourTargetAgentId(null)
        timeoutId = window.setTimeout(cycle, SNAPSHOT_REFRESH_MS)
        return
      }

      const nextIndex = (tourCursorRef.current + 1) % candidates.length
      tourCursorRef.current = nextIndex
      setTourTargetAgentId(candidates[nextIndex])
      timeoutId = window.setTimeout(
        cycle,
        AUTO_TOUR_MIN_MS + Math.round(Math.random() * (AUTO_TOUR_MAX_MS - AUTO_TOUR_MIN_MS)),
      )
    }

    cycle()

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [autoTourPaused, officeState, playbackState.mode])

  const augmentedTimelineSeries = useMemo(() => {
    if (!liveStatus) return timelineSeries

    const latestTimelineTimestamp = timelineSeries[timelineSeries.length - 1]?.timestamp ?? -1
    const livePoint = {
      timestamp: liveTimestamp,
      displayed: liveStatus.displayed,
      running: liveStatus.running,
      connected: liveStatus.connected,
    }

    if (liveTimestamp <= latestTimelineTimestamp) {
      return timelineSeries
    }

    return timelineSeries.concat(livePoint)
  }, [liveStatus, liveTimestamp, timelineSeries])

  const resolvedFrameIndex =
    replayFrames.length === 0 ? -1 : Math.max(0, Math.min(playbackState.currentFrameIndex, replayFrames.length - 1))
  const currentReplayFrame = resolvedFrameIndex === -1 ? null : replayFrames[resolvedFrameIndex]
  const currentReplayCharacterMap = useMemo(() => {
    if (playbackState.mode !== 'replay' || !currentReplayFrame) return null
    return new Map(currentReplayFrame.characters.map((character) => [character.id, character]))
  }, [currentReplayFrame, playbackState.mode])

  const displayTimestamp =
    playbackState.mode === 'replay'
      ? currentReplayFrame?.timestamp ?? liveTimestamp
      : liveTimestamp

  const displayHistory = useMemo(
    () =>
      augmentedTimelineSeries.filter(
        (point) => point.timestamp <= displayTimestamp && point.timestamp >= displayTimestamp - playbackWindowMs,
      ),
    [augmentedTimelineSeries, displayTimestamp, playbackWindowMs],
  )

  const displaySessions = useMemo(
    () => (playbackState.mode === 'replay' ? currentReplayFrame?.sessions ?? [] : liveSessions),
    [currentReplayFrame?.sessions, liveSessions, playbackState.mode],
  )

  const displayStatus = useMemo(
    () => (playbackState.mode === 'replay' ? currentReplayFrame?.status ?? liveStatus : liveStatus),
    [currentReplayFrame?.status, liveStatus, playbackState.mode],
  )

  const selectedAgentId = officeState.selectedAgentId
  const selectedSession =
    displaySessions.find((session) => sessionToAgentId.get(session.sessionKey) === selectedAgentId) || null

  const sessionInsights = useMemo(
    () => buildSessionInsights(replayFrames, liveSessions, liveTimestamp),
    [liveSessions, liveTimestamp, replayFrames],
  )

  const hoveredSession =
    displaySessions.find((session) => sessionToAgentId.get(session.sessionKey) === hoverState.agentId) || null
  const hoveredInsight = hoveredSession ? sessionInsights.get(hoveredSession.sessionKey) : null

  const heatmapSources = useMemo(
    () =>
      displaySessions
        .map((session) => {
          const agentId = sessionToAgentId.get(session.sessionKey)
          if (agentId === undefined) return null
          return {
            agentId,
            zone: session.zone,
            intensity: session.status === 'running' ? 1 : Math.max(0.18, session.signalScore),
          }
        })
        .filter((entry): entry is { agentId: number; zone: string; intensity: number } => entry !== null),
    [displaySessions],
  )

  const replayPreviewFrames = useMemo(
    () => buildReplayPreviewFrames(visibleReplayFrames, currentReplayFrame),
    [currentReplayFrame, visibleReplayFrames],
  )

  const replayEventMarkers = useMemo(
    () => buildReplayEventMarkers(visibleReplayFrames, scrubberMin, scrubberMax),
    [scrubberMax, scrubberMin, visibleReplayFrames],
  )

  const sidebarModelMix = useMemo(
    () =>
      summarizeModelMix(displaySessions)
        .slice(0, 5)
        .map((entry) => ({
          ...entry,
          color: getModelColor(entry.label),
        })),
    [displaySessions],
  )

  const sidebarZoneBars = useMemo(
    () =>
      summarizeZones(displaySessions).map((entry) => ({
        label: entry.label,
        color: getZoneColor(entry.zone),
        value: entry.count / Math.max(displaySessions.length, 1),
        running: entry.running,
        count: entry.count,
      })),
    [displaySessions],
  )

  const freshness = useMemo(() => {
    if (playbackState.mode === 'replay') {
      return {
        label: 'Replay',
        color: '#F9E2AF',
        detail: currentReplayFrame
          ? `Frame ${formatPlaybackTimestamp(currentReplayFrame.timestamp)}`
          : 'Choose a recorded frame',
      }
    }

    if (backendError || connectionState !== 'connected' || !liveStatus?.connected) {
      return {
        label: 'Offline',
        color: '#F38BA8',
        detail: backendError || 'Waiting for a live snapshot',
      }
    }

    const ageMs = Math.max(0, Date.now() - liveTimestamp)
    if (ageMs > DELAYED_THRESHOLD_MS) {
      return {
        label: 'Delayed',
        color: '#FAB387',
        detail: `Updated ${formatRelativeAge(ageMs)}`,
      }
    }

    return {
      label: 'Live now',
      color: '#A6E3A1',
      detail: `Updated ${formatRelativeAge(ageMs)}`,
    }
  }, [backendError, connectionState, currentReplayFrame, liveStatus, liveTimestamp, playbackState.mode])

  const currentFrameLabel =
    playbackState.mode === 'replay'
      ? currentReplayFrame
        ? `Frame ${formatPlaybackTimestamp(currentReplayFrame.timestamp)}`
        : 'Waiting for replay frames'
      : `Live edge ${formatPlaybackTimestamp(displayTimestamp)}`

  const coverageLabel =
    replayFrames.length === 0
      ? 'Replay buffer empty'
      : `Buffered ${formatDurationShort(scrubberMax - replayFrames[0].timestamp)} of 24h retention`

  const handleZoomChange = useCallback(
    (newZoom: number) => {
      pauseAutoTour()
      setZoom(newZoom)
    },
    [pauseAutoTour],
  )

  const handleCanvasInteraction = useCallback(() => {
    pauseAutoTour()
  }, [pauseAutoTour])

  const handleCanvasHoverChange = useCallback(
    (agentId: number | null, position: { x: number; y: number } | null) => {
      setHoverState({ agentId, position })
    },
    [],
  )

  const handleAgentClick = useCallback(
    (agentId: number) => {
      pauseAutoTour()
      officeState.selectedAgentId = agentId
      setShowSessionPanel(true)
      setShowStatusPanel(false)
      setLiveSessions((previous) => [...previous])
    },
    [officeState, pauseAutoTour],
  )

  const handleSelectSession = useCallback(
    (sessionKey: string) => {
      pauseAutoTour()
      const agentId = sessionToAgentId.get(sessionKey)
      if (agentId !== undefined) {
        officeState.selectedAgentId = agentId
        officeState.cameraFollowId = agentId
      }
      setLiveSessions((previous) => [...previous])
    },
    [officeState, pauseAutoTour],
  )

  const handleOpenSession = useCallback(
    (sessionKey: string) => {
      handleSelectSession(sessionKey)
      setShowSessionPanel(true)
      setShowStatusPanel(false)
    },
    [handleSelectSession],
  )

  const handleModeChange = useCallback(
    (mode: 'live' | 'replay') => {
      pauseAutoTour()
      setHoverState({ agentId: null, position: null })
      officeState.cameraFollowId = null
      if (mode === 'live') {
        setPlaybackState((previous) => ({
          ...previous,
          mode: 'live',
          isPlaying: false,
          currentFrameIndex: replayFrames.length > 0 ? replayFrames.length - 1 : 0,
          selectedTimestamp: replayFrames[replayFrames.length - 1]?.timestamp ?? liveTimestamp,
        }))
        return
      }

      setPlaybackState((previous) => ({
        ...previous,
        mode: 'replay',
        isPlaying: false,
        currentFrameIndex: replayFrames.length > 0 ? replayFrames.length - 1 : previous.currentFrameIndex,
        selectedTimestamp: replayFrames[replayFrames.length - 1]?.timestamp ?? previous.selectedTimestamp,
      }))
    },
    [liveTimestamp, officeState, pauseAutoTour, replayFrames],
  )

  const handleWindowHoursChange = useCallback(
    (windowHours: PlaybackState['windowHours']) => {
      pauseAutoTour()
      setPlaybackState((previous) => ({
        ...previous,
        windowHours,
        isPlaying: false,
      }))
    },
    [pauseAutoTour],
  )

  const handleScrub = useCallback(
    (timestamp: number) => {
      pauseAutoTour()
      setHoverState({ agentId: null, position: null })
      officeState.cameraFollowId = null

      if (visibleReplayFrames.length === 0) return

      const relativeIndex = findClosestFrameIndex(visibleReplayFrames, timestamp)
      if (relativeIndex === -1) return

      const frameIndex = visibleReplayStartIndex + relativeIndex
      setPlaybackState((previous) => ({
        ...previous,
        mode: 'replay',
        isPlaying: false,
        currentFrameIndex: frameIndex,
        selectedTimestamp: replayFrames[frameIndex]?.timestamp ?? timestamp,
      }))
    },
    [officeState, pauseAutoTour, replayFrames, visibleReplayFrames, visibleReplayStartIndex],
  )

  const handlePlayToggle = useCallback(() => {
    pauseAutoTour()
    setPlaybackState((previous) => ({
      ...previous,
      mode: 'replay',
      isPlaying: !previous.isPlaying,
    }))
  }, [pauseAutoTour])

  const handlePlaybackRateChange = useCallback(
    (playbackRate: PlaybackState['playbackRate']) => {
      pauseAutoTour()
      setPlaybackState((previous) => ({
        ...previous,
        playbackRate,
      }))
    },
    [pauseAutoTour],
  )

  const handleJumpToLive = useCallback(() => {
    handleModeChange('live')
  }, [handleModeChange])

  const handleResumeTour = useCallback(() => {
    officeState.cameraFollowId = null
    setAutoTourPaused(false)
  }, [officeState])

  const handleToggleHeatmap = useCallback(() => {
    pauseAutoTour()
    setHeatmapEnabled((previous) => !previous)
  }, [pauseAutoTour])

  if (surfaceMode === 'embed-card') {
    return (
      <main className="gs-embed-shell">
        <GhostShiftSummaryCard
          status={liveStatus}
          sessions={liveSessions}
          timeline={augmentedTimelineSeries}
          connectionState={connectionState}
          backendError={backendError}
          refreshMs={SNAPSHOT_REFRESH_MS}
          liveDemoHref={livePath}
          variant="embed"
        />
      </main>
    )
  }

  return (
    <div className="gs-shell">
      <main className="gs-page">
        <section className="gs-hero">
          <div className="gs-hero-copy">
            <span className="gs-kicker">Ghost Shift</span>
            <h1>Replayable public telemetry for live agent work.</h1>
            <p>
              A portfolio-facing product surface: live office canvas, replay timeline, freshness states, and a compact
              summary card that stays privacy-safe by design.
            </p>

            <div className="gs-hero-actions">
              <a className="gs-button gs-button--primary" href={livePath}>
                Open live office
              </a>
              <a className="gs-button gs-button--secondary" href={embedCardPath}>
                Open summary card
              </a>
            </div>

            <div className="gs-pill-row">
              {heroPills.map((pill) => (
                <span key={pill}>{pill}</span>
              ))}
            </div>

            <div className="gs-surface-grid">
              {surfaceCards.map((card) => (
                <article
                  key={card.title}
                  className={`gs-surface-card ${card.featured ? 'gs-surface-card--featured' : ''}`}
                >
                  <div className="gs-surface-card__eyebrow">{card.eyebrow}</div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <div className="gs-surface-card__note">{card.note}</div>
                </article>
              ))}
            </div>
          </div>

          <GhostShiftSummaryCard
            status={liveStatus}
            sessions={liveSessions}
            timeline={augmentedTimelineSeries}
            connectionState={connectionState}
            backendError={backendError}
            refreshMs={SNAPSHOT_REFRESH_MS}
            liveDemoHref={livePath}
          />
        </section>

        <ProductDashboard
          status={displayStatus}
          sessions={displaySessions}
          timeline={augmentedTimelineSeries}
          historyMeta={historyMeta}
          displayTimestamp={displayTimestamp}
        />

        <section className="gs-demo-section">
          <div className="gs-demo-copy">
            <span className="gs-section-kicker">Live Office</span>
            <h2>One surface for live motion, replay storytelling, and safe public context.</h2>
            <p>
              The office stays live on the edge, but the new replay lane lets viewers scrub through the recent narrative,
              switch windows between 1h, 6h, and 24h, and see immediately whether the feed is live, delayed, replaying,
              or offline.
            </p>
          </div>

          <div className="gs-demo-layout">
            <div className="gs-demo-stage">
              <LiveOfficeStage
                officeState={officeState}
                panRef={panRef}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                onAgentClick={handleAgentClick}
                hoveredAgentId={hoverState.agentId}
                hoverPosition={hoverState.position}
                hoveredSession={hoveredSession}
                hoveredPublicId={hoveredInsight?.publicId || hoveredSession?.publicId || hoveredSession?.sessionKey || null}
                hoveredToolStats={hoveredInsight?.toolStats || []}
                hoveredActivityPoints={hoveredInsight?.activityPoints || []}
                hoveredActiveWindow={hoveredInsight?.dominantWindow || hoveredSession?.signalWindow || 'observed'}
                onCanvasHoverChange={handleCanvasHoverChange}
                onCanvasInteraction={handleCanvasInteraction}
                connectionState={connectionState}
                backendError={backendError}
                officeStatus={displayStatus}
                sessions={displaySessions}
                history={displayHistory}
                selectedSession={selectedSession}
                selectedAgentId={selectedAgentId}
                showStatusPanel={showStatusPanel}
                showSessionPanel={showSessionPanel}
                onToggleStatusPanel={() => setShowStatusPanel((previous) => !previous)}
                onCloseStatusPanel={() => setShowStatusPanel(false)}
                onCloseSessionPanel={() => setShowSessionPanel(false)}
                onSelectSession={handleSelectSession}
                onOpenSession={handleOpenSession}
                getNumericAgentId={(sessionKey) => sessionToAgentId.get(sessionKey)}
                compactViewport={compactViewport}
                playbackState={playbackState}
                hasReplayFrames={replayFrames.length > 0}
                isLoading={isSnapshotLoading || isHistoryLoading}
                replayCharacters={playbackState.mode === 'replay' ? currentReplayFrame?.characters ?? null : null}
                replayCharacterMap={currentReplayCharacterMap}
                tourTargetAgentId={tourTargetAgentId}
                heatmapEnabled={heatmapEnabled}
                heatmapSources={heatmapSources}
                onToggleHeatmap={handleToggleHeatmap}
                freshness={freshness}
                scrubberMin={scrubberMin}
                scrubberMax={scrubberMax}
                scrubberValue={playbackState.mode === 'replay' ? currentReplayFrame?.timestamp ?? scrubberMax : scrubberMax}
                currentFrameLabel={currentFrameLabel}
                startLabel={formatPlaybackBoundary(scrubberMin)}
                endLabel={formatPlaybackBoundary(scrubberMax)}
                coverageLabel={coverageLabel}
                autoTourPaused={autoTourPaused}
                previewFrames={replayPreviewFrames}
                eventMarkers={replayEventMarkers}
                onModeChange={handleModeChange}
                onWindowHoursChange={handleWindowHoursChange}
                onScrub={handleScrub}
                onPlayToggle={handlePlayToggle}
                onJumpToLive={handleJumpToLive}
                onResumeTour={handleResumeTour}
                onPlaybackRateChange={handlePlaybackRateChange}
              />
            </div>

            <div className="gs-side-stack">
              <RealtimeStatsSidebar
                freshnessLabel={freshness.label}
                loading={isSnapshotLoading || isHistoryLoading}
                modelMix={sidebarModelMix}
                zoneBars={sidebarZoneBars}
                responseTrend={responseTrend}
              />

              <article className="gs-side-card">
                <div className="gs-side-card__eyebrow">Live roster</div>
                <h3>Public aliases and room cadence</h3>
                <div className="gs-live-roster">
                  {liveSessions.slice(0, 5).map((session) => {
                    const agentId = sessionToAgentId.get(session.sessionKey)
                    return (
                      <div key={session.sessionKey} className="gs-live-roster__row">
                        <div className="gs-live-roster__meta">
                          <span
                            className="gs-live-roster__dot"
                            style={{ background: getZoneColor(session.zone) }}
                          />
                          <span className="gs-live-roster__name">
                            {getPublicAgentLabel(session.agentId, agentId)}
                          </span>
                          <span className="gs-live-roster__zone">{getZoneLabel(session.zone)}</span>
                        </div>
                        <div className="gs-live-roster__window">{session.signalWindow}</div>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="gs-side-card">
                <div className="gs-side-card__eyebrow">Why this surface works</div>
                <h3>Portfolio-first, operator-safe.</h3>
                <ul className="gs-side-list">
                  {demoSidebarNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <SharePanel
          livePath={livePath}
          status={displayStatus}
          sessions={displaySessions}
          timeline={augmentedTimelineSeries}
          timestamp={displayTimestamp}
          freshnessLabel={freshness.label}
          playbackMode={playbackState.mode}
          windowHours={playbackState.windowHours}
        />

        <CaseStudyLayer exampleSession={liveSessions[0] || null} />

        <section className="gs-docs-section">
          <div className="gs-docs-copy">
            <span className="gs-section-kicker">Embed Path</span>
            <h2>Portfolio-ready copy and a dedicated embed path.</h2>
            <p>
              The summary card lives at <code>{embedCardPath}</code>. Use it as the teaser surface for the live office,
              then hand readers into the full replayable demo when they want the deeper story.
            </p>
          </div>

          <div className="gs-docs-layout">
            <article className="gs-side-card">
              <div className="gs-side-card__eyebrow">Deployment notes</div>
              <h3>Keep the public contract narrow.</h3>
              <ul className="gs-doc-list">
                {documentationPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>

            <article className="gs-code-card">
              <pre>
                <code>{buildEmbedSnippet(embedCardPath)}</code>
              </pre>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
