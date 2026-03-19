import { startTransition, useCallback, useEffect, useState } from 'react'
import { i18n } from '../content/i18n/index.js'
import { useT } from '../content/locale.js'
import type { OfficeState } from '../office/engine/officeState.js'
import type { DisplaySession } from '../publicDisplay.js'
import type { PlaybackState } from '../replay.js'
import { apiClient } from '../services/ApiClient.js'
import type { PublicAgentStats } from '../services/types.js'

interface UseAgentDetailParams {
  officeState: OfficeState
  playbackMode: PlaybackState['mode']
  pauseAutoTour: () => void
  refreshLiveSessions: () => void
}

export function useAgentDetail({
  officeState,
  playbackMode,
  pauseAutoTour,
  refreshLiveSessions,
}: UseAgentDetailParams) {
  const tt = useT()
  const [showAgentDetailModal, setShowAgentDetailModal] = useState(false)
  const [agentDetailSession, setAgentDetailSession] = useState<DisplaySession | null>(null)
  const [agentDetailStats, setAgentDetailStats] = useState<PublicAgentStats | null>(null)
  const [agentDetailLoading, setAgentDetailLoading] = useState(false)
  const [agentDetailError, setAgentDetailError] = useState<string | null>(null)

  const openAgentDetailForSession = useCallback(
    (session: DisplaySession | null, agentId?: number) => {
      pauseAutoTour()
      if (typeof agentId === 'number') {
        officeState.selectedAgentId = agentId
        officeState.cameraFollowId = agentId
      }

      setAgentDetailSession(session)
      setAgentDetailStats(null)
      setAgentDetailError(null)
      setAgentDetailLoading(Boolean(session?.publicId))
      setShowAgentDetailModal(Boolean(session))

      if (playbackMode === 'live') {
        refreshLiveSessions()
      }
    },
    [officeState, pauseAutoTour, playbackMode, refreshLiveSessions],
  )

  const handleCloseAgentDetail = useCallback(() => {
    setShowAgentDetailModal(false)
    setAgentDetailLoading(false)
  }, [])

  useEffect(() => {
    if (!showAgentDetailModal) return

    const publicId = agentDetailSession?.publicId
    if (!publicId) {
      setAgentDetailLoading(false)
      setAgentDetailStats(null)
      return
    }

    let cancelled = false
    setAgentDetailLoading(true)

    const fetchAgentStats = async () => {
      try {
        const stats = await apiClient.getAgentStats(publicId)
        if (cancelled) return

        startTransition(() => {
          setAgentDetailStats(stats)
        })
        setAgentDetailError(null)
      } catch {
        if (cancelled) return
        setAgentDetailStats(null)
        setAgentDetailError(tt(i18n.status.apiUnavailable))
      } finally {
        if (!cancelled) {
          setAgentDetailLoading(false)
        }
      }
    }

    fetchAgentStats()
    return () => {
      cancelled = true
    }
  }, [agentDetailSession?.publicId, showAgentDetailModal, tt])

  return {
    showAgentDetailModal,
    agentDetailSession,
    agentDetailStats,
    agentDetailLoading,
    agentDetailError,
    openAgentDetailForSession,
    handleCloseAgentDetail,
    setShowAgentDetailModal,
  }
}
