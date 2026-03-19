import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { i18n } from '../content/i18n.js'
import { useLocale, useT } from '../content/locale.js'
import type { OfficeState } from '../office/engine/officeState.js'
import type { DisplaySession } from '../publicDisplay.js'
import {
  findClosestFrameIndex,
  formatPlaybackTimestamp,
  type PlaybackState,
  type ReplayFrame,
  type TimelinePoint,
} from '../replay.js'
import { formatDurationShort } from '../publicDisplay.js'
import { apiClient } from '../services/ApiClient.js'
import type { PublicOfficeStatus } from '../services/types.js'
import {
  buildReplayEventMarkers,
  buildReplayFrames,
  buildReplayPreviewFrames,
  getPlaybackWindow,
  HISTORY_REFRESH_MS,
  parseTimestamp,
} from '../pages/ghost-shift/surfaceShared.js'

interface UseReplayPlaybackParams {
  officeState: OfficeState
  initialMode: PlaybackState['mode']
  initialWindowHours: PlaybackState['windowHours']
  initialTimestamp: number | null
  liveStatus: PublicOfficeStatus | null
  liveTimestamp: number
  liveSessions: DisplaySession[]
  compactViewport: boolean
}

export function useReplayPlayback({
  officeState,
  initialMode,
  initialWindowHours,
  initialTimestamp,
  liveStatus,
  liveTimestamp,
  liveSessions,
  compactViewport,
}: UseReplayPlaybackParams) {
  const locale = useLocale()
  const tt = useT()
  const [timelineSeries, setTimelineSeries] = useState<TimelinePoint[]>([])
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>([])
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    mode: initialMode,
    windowHours: initialWindowHours,
    selectedTimestamp: initialTimestamp,
    currentFrameIndex: 0,
    isPlaying: false,
    playbackRate: 1,
  })
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const playbackWindowMs = getPlaybackWindow(playbackState.windowHours)

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
    let cancelled = false

    const fetchHistory = async () => {
      try {
        const timelineSince = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString()
        const replaySince = new Date(Date.now() - getPlaybackWindow(24)).toISOString()
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
          setReplayFrames(buildReplayFrames(officeState.getLayout(), replayResponse.frames))
        })
        setHistoryError(null)
        setIsHistoryLoading(false)
      } catch {
        if (!cancelled) {
          setHistoryError((previous) => previous ?? tt(i18n.historyUnavailable))
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
  }, [officeState, tt])

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

  const replayPreviewFrames = useMemo(
    () => buildReplayPreviewFrames(visibleReplayFrames, currentReplayFrame, compactViewport ? 3 : 4),
    [compactViewport, currentReplayFrame, locale, visibleReplayFrames],
  )

  const replayEventMarkers = useMemo(
    () => buildReplayEventMarkers(visibleReplayFrames, scrubberMin, scrubberMax, compactViewport ? 4 : 6),
    [compactViewport, locale, scrubberMax, scrubberMin, visibleReplayFrames],
  )

  const currentFrameLabel =
    playbackState.mode === 'replay'
      ? currentReplayFrame
        ? `${tt(i18n.replay.frame)} ${formatPlaybackTimestamp(currentReplayFrame.timestamp)}`
        : tt(i18n.replay.waitingForReplayFrames)
      : `${tt(i18n.replay.liveEdge)} ${formatPlaybackTimestamp(displayTimestamp)}`

  const coverageLabel =
    replayFrames.length === 0
      ? tt(i18n.replay.replayBufferEmpty)
      : `${tt(i18n.replay.buffered)} ${formatDurationShort(scrubberMax - replayFrames[0].timestamp)} ${tt(i18n.replay.bufferedRetention)}`

  const landingReplayFrame = useMemo(
    () => visibleReplayFrames[visibleReplayFrames.length - 1] ?? currentReplayFrame ?? null,
    [currentReplayFrame, visibleReplayFrames],
  )

  const landingReplayCharacterMap = useMemo(() => {
    if (!landingReplayFrame) return null
    return new Map(landingReplayFrame.characters.map((character) => [character.id, character]))
  }, [landingReplayFrame])

  const handleModeChange = useCallback(
    (mode: PlaybackState['mode']) => {
      setPlaybackState((previous) => {
        if (mode === 'live') {
          return {
            ...previous,
            mode: 'live',
            isPlaying: false,
            currentFrameIndex: replayFrames.length > 0 ? replayFrames.length - 1 : 0,
            selectedTimestamp: replayFrames[replayFrames.length - 1]?.timestamp ?? liveTimestamp,
          }
        }

        return {
          ...previous,
          mode: 'replay',
          isPlaying: false,
          currentFrameIndex: replayFrames.length > 0 ? replayFrames.length - 1 : previous.currentFrameIndex,
          selectedTimestamp: replayFrames[replayFrames.length - 1]?.timestamp ?? previous.selectedTimestamp,
        }
      })
    },
    [liveTimestamp, replayFrames],
  )

  const handleWindowHoursChange = useCallback((windowHours: PlaybackState['windowHours']) => {
    setPlaybackState((previous) => ({
      ...previous,
      windowHours,
      isPlaying: false,
    }))
  }, [])

  const handleScrub = useCallback(
    (timestamp: number) => {
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
    [replayFrames, visibleReplayFrames, visibleReplayStartIndex],
  )

  const handlePlayToggle = useCallback(() => {
    setPlaybackState((previous) => ({
      ...previous,
      mode: 'replay',
      isPlaying: !previous.isPlaying,
    }))
  }, [])

  const handlePlaybackRateChange = useCallback((playbackRate: PlaybackState['playbackRate']) => {
    setPlaybackState((previous) => ({
      ...previous,
      playbackRate,
    }))
  }, [])

  const handleJumpToLive = useCallback(() => {
    handleModeChange('live')
  }, [handleModeChange])

  return {
    timelineSeries,
    augmentedTimelineSeries,
    replayFrames,
    playbackState,
    isHistoryLoading,
    historyError,
    visibleReplayFrames,
    scrubberMin,
    scrubberMax,
    currentReplayFrame,
    currentReplayCharacterMap,
    displayTimestamp,
    displayHistory,
    displaySessions,
    displayStatus,
    replayPreviewFrames,
    replayEventMarkers,
    currentFrameLabel,
    coverageLabel,
    landingReplayFrame,
    landingReplayCharacterMap,
    handleModeChange,
    handleWindowHoursChange,
    handleScrub,
    handlePlayToggle,
    handleJumpToLive,
    handlePlaybackRateChange,
  }
}
