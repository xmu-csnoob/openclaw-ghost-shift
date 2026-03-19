import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { i18n } from '../content/i18n/index.js'
import { useT } from '../content/locale.js'
import type { OfficeState } from '../office/engine/officeState.js'
import type { DisplaySession, SessionObservation } from '../publicDisplay.js'
import { formatRelativeAge } from '../replay.js'
import { apiClient } from '../services/ApiClient.js'
import type { PublicOfficeSnapshot } from '../services/types.js'
import { SNAPSHOT_REFRESH_MS } from '../surfaceConfig.js'
import {
  applyLiveSnapshotToOfficeState,
  type ConnectionState,
  DELAYED_THRESHOLD_MS,
  parseTimestamp,
} from '../pages/ghost-shift/surfaceShared.js'

interface UseOfficeSnapshotParams {
  officeState: OfficeState
}

export function useOfficeSnapshot({ officeState }: UseOfficeSnapshotParams) {
  const tt = useT()
  const observationsRef = useRef<Map<string, SessionObservation>>(new Map())
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [liveSnapshot, setLiveSnapshot] = useState<PublicOfficeSnapshot | null>(null)
  const [liveSessions, setLiveSessions] = useState<DisplaySession[]>([])
  const [responseTrend, setResponseTrend] = useState<Array<{ timestamp: number; value: number }>>([])
  const [backendError, setBackendError] = useState<string | null>(null)
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(true)

  const liveStatus = liveSnapshot?.status ?? null
  const liveTimestamp = parseTimestamp(liveStatus?.lastUpdatedAt) ?? Date.now()

  useEffect(() => {
    let cancelled = false

    const fetchSnapshot = async () => {
      const requestStartedAt = performance.now()
      try {
        const snapshot = await apiClient.getSnapshot('active')
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
        setBackendError(tt(i18n.status.apiUnavailable))
        setIsSnapshotLoading(false)
      }
    }

    fetchSnapshot()
    const intervalId = window.setInterval(fetchSnapshot, SNAPSHOT_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [officeState, tt])

  const refreshLiveSessions = useCallback(() => {
    setLiveSessions((previous) => [...previous])
  }, [])

  const liveFreshness = useMemo(() => {
    if (backendError || connectionState !== 'connected' || !liveStatus?.connected) {
      return {
        label: tt(i18n.status.offline),
        color: '#F38BA8',
        detail: backendError || tt(i18n.status.waitingForLiveSnapshot),
      }
    }

    const ageMs = Math.max(0, Date.now() - liveTimestamp)
    if (ageMs > DELAYED_THRESHOLD_MS) {
      return {
        label: tt(i18n.status.delayed),
        color: '#FAB387',
        detail: `${tt(i18n.status.updated)} ${formatRelativeAge(ageMs)}`,
      }
    }

    return {
      label: tt(i18n.status.liveNow),
      color: '#A6E3A1',
      detail: `${tt(i18n.status.updated)} ${formatRelativeAge(ageMs)}`,
    }
  }, [backendError, connectionState, liveStatus, liveTimestamp, tt])

  return {
    connectionState,
    liveSnapshot,
    liveStatus,
    liveSessions,
    liveTimestamp,
    responseTrend,
    backendError,
    isSnapshotLoading,
    liveFreshness,
    refreshLiveSessions,
  }
}
