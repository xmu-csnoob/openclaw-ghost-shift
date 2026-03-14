import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GhostShiftSummaryCard } from './components/GhostShiftSummaryCard.js'
import { LiveOfficeStage } from './components/LiveOfficeStage.js'
import {
  caseStudyCards,
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
import type {
  AgentSession,
  PublicOfficeSnapshot,
  PublicOfficeStatus,
} from './services/types.js'
import { SNAPSHOT_REFRESH_MS, SUMMARY_CARD_SEGMENT } from './surfaceConfig.js'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'
type SurfaceMode = 'portfolio' | 'embed-card'

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

function App() {
  const officeState = getOfficeState()

  const [{ surfaceMode, livePath, embedCardPath }] = useState(() => {
    const pathname = window.location.pathname
    const search = window.location.search
    return {
      surfaceMode: resolveSurfaceMode(pathname, search),
      ...getSurfacePaths(pathname),
    }
  })

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [liveSnapshot, setLiveSnapshot] = useState<PublicOfficeSnapshot | null>(null)
  const [liveSessions, setLiveSessions] = useState<DisplaySession[]>([])
  const [timelineSeries, setTimelineSeries] = useState<TimelinePoint[]>([])
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>([])
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    mode: 'live',
    windowHours: 1,
    selectedTimestamp: null,
    currentFrameIndex: 0,
    isPlaying: false,
  })
  const [backendError, setBackendError] = useState<string | null>(null)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const [zoom, setZoom] = useState(() => {
    const dpr = window.devicePixelRatio || 1
    return Math.round(2 * dpr)
  })
  const [compactViewport, setCompactViewport] = useState(() => window.innerWidth < 980)
  const [autoTourPaused, setAutoTourPaused] = useState(false)
  const [tourTargetAgentId, setTourTargetAgentId] = useState<number | null>(null)
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

        setLiveSnapshot(snapshot)
        setLiveSessions(nextSessions)
        setConnectionState(snapshot.status.connected ? 'connected' : 'disconnected')
        setBackendError(null)
      } catch {
        if (cancelled) return
        setConnectionState('disconnected')
        setBackendError('API unavailable')
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
        const since = new Date(Date.now() - getPlaybackWindowMs(24)).toISOString()
        const [timelineResponse, replayResponse] = await Promise.all([
          apiClient.getTimeline(since),
          apiClient.getReplay(since),
        ])

        if (cancelled) return

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
        setReplayFrames(buildReplayFrames(officeState.getLayout(), replayResponse.frames))
      } catch {
        if (!cancelled) {
          setBackendError((previous) => previous ?? 'History unavailable')
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

    const delayMs = Math.max(450, Math.min(2_400, nextFrame.timestamp - currentFrame.timestamp))
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

  const displaySessions =
    playbackState.mode === 'replay'
      ? currentReplayFrame?.sessions ?? []
      : liveSessions

  const displayStatus =
    playbackState.mode === 'replay'
      ? currentReplayFrame?.status ?? liveStatus
      : liveStatus

  const selectedAgentId = officeState.selectedAgentId
  const selectedSession =
    displaySessions.find((session) => sessionToAgentId.get(session.sessionKey) === selectedAgentId) || null

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

  const handleJumpToLive = useCallback(() => {
    handleModeChange('live')
  }, [handleModeChange])

  const handleResumeTour = useCallback(() => {
    officeState.cameraFollowId = null
    setAutoTourPaused(false)
  }, [officeState])

  if (surfaceMode === 'embed-card') {
    return (
      <main className="gs-embed-shell">
        <GhostShiftSummaryCard
          status={liveStatus}
          sessions={liveSessions}
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
            connectionState={connectionState}
            backendError={backendError}
            refreshMs={SNAPSHOT_REFRESH_MS}
            liveDemoHref={livePath}
          />
        </section>

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
                replayCharacters={playbackState.mode === 'replay' ? currentReplayFrame?.characters ?? null : null}
                replayCharacterMap={currentReplayCharacterMap}
                tourTargetAgentId={tourTargetAgentId}
                freshness={freshness}
                scrubberMin={scrubberMin}
                scrubberMax={scrubberMax}
                scrubberValue={playbackState.mode === 'replay' ? currentReplayFrame?.timestamp ?? scrubberMax : scrubberMax}
                currentFrameLabel={currentFrameLabel}
                startLabel={formatPlaybackBoundary(scrubberMin)}
                endLabel={formatPlaybackBoundary(scrubberMax)}
                coverageLabel={coverageLabel}
                autoTourPaused={autoTourPaused}
                onModeChange={handleModeChange}
                onWindowHoursChange={handleWindowHoursChange}
                onScrub={handleScrub}
                onPlayToggle={handlePlayToggle}
                onJumpToLive={handleJumpToLive}
                onResumeTour={handleResumeTour}
              />
            </div>

            <div className="gs-side-stack">
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

        <section className="gs-case-study">
          <span className="gs-section-kicker">Case Study Layer</span>
          <h2>Explain the privacy boundary while the product is visibly running.</h2>
          <div className="gs-case-grid">
            {caseStudyCards.map((card) => (
              <article key={card.title} className="gs-case-card">
                <div className="gs-case-card__eyebrow">Boundary</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

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
