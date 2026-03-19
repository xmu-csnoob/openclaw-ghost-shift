import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useHref, useLocation } from 'react-router-dom'
import { CaseStudyLayer } from '../components/CaseStudyLayer.js'
import { ErrorBoundary } from '../components/ErrorBoundary.js'
import { AboutOverviewSection } from '../components/ghostShift/AboutOverviewSection.js'
import { AgentDetailModal } from '../components/ghostShift/AgentDetailModal.js'
import { DocsStudioSection } from '../components/ghostShift/DocsStudioSection.js'
import { Modal } from '../components/Modal.js'
import { SettingsContent } from '../components/SettingsContent.js'
import { SharePanel } from '../components/SharePanel.js'
import type { SessionFilterStatus } from '../services/types.js'
import { SurfaceProvider } from '../contexts/SurfaceContext.js'
import { useAgentDetail } from '../hooks/useAgentDetail.js'
import { useAnalyticsData } from '../hooks/useAnalyticsData.js'
import { useOfficeSnapshot } from '../hooks/useOfficeSnapshot.js'
import { useReplayPlayback } from '../hooks/useReplayPlayback.js'
import { useSurfaceUI } from '../hooks/useSurfaceUI.js'
import { EmbedView } from '../views/EmbedView.js'
import { LandingView } from '../views/LandingView.js'
import { WorkspaceView } from '../views/WorkspaceView.js'
import {
  demoSidebarNotes,
  documentationPoints,
} from '../content/ghostShiftContent.js'
import { i18n } from '../content/i18n/index.js'
import { setLocale, t, useLocale, useT } from '../content/locale.js'
import type { DisplaySession } from '../publicDisplay.js'
import {
  getZoneColor,
  summarizeModelMix,
  summarizeZones,
} from '../publicDisplay.js'
import {
  formatPlaybackBoundary,
  formatPlaybackTimestamp,
  type PlaybackState,
} from '../replay.js'
import { SNAPSHOT_REFRESH_MS } from '../surfaceConfig.js'
import {
  AUTO_TOUR_MAX_MS,
  AUTO_TOUR_MIN_MS,
  buildEmbedSnippet,
  buildSessionInsights,
  buildTourCandidateIds,
  getModelColor,
  getNumericAgentId,
  getOfficeState,
  type GhostShiftPage,
  parsePlaybackMode,
  parseTimestamp,
  parseWindowHours,
} from './ghost-shift/surfaceShared.js'

interface GhostShiftSurfaceProps {
  page: GhostShiftPage
}

function GhostShiftSurface({ page }: GhostShiftSurfaceProps) {
  const officeState = getOfficeState()
  const locale = useLocale()
  const tt = useT()
  const location = useLocation()
  const landingHref = useHref('/')
  const liveHref = useHref('/live')
  const replayHref = useHref('/replay')
  const embedHref = useHref('/embed')
  const embedCardHref = useHref('/embed/card')
  const docsHref = useHref('/docs')
  const aboutHref = useHref('/about')

  const [{ initialMode, initialWindowHours, initialTimestamp }] = useState(() => {
    const params = new URLSearchParams(location.search)
    return {
      initialMode: page === 'replay' ? 'replay' : parsePlaybackMode(params.get('mode')),
      initialWindowHours: parseWindowHours(params.get('window')),
      initialTimestamp: parseTimestamp(params.get('ts') || undefined),
    }
  })
  const panRef = useRef({ x: 0, y: 0 })
  const tourCursorRef = useRef(-1)
  const tourCandidatesRef = useRef<number[]>([])
  const surfaceUI = useSurfaceUI({ page })
  const [filterStatus, setFilterStatus] = useState<SessionFilterStatus>('active')
  const snapshot = useOfficeSnapshot({ officeState, filterStatus })
  const analytics = useAnalyticsData()
  const replay = useReplayPlayback({
    officeState,
    initialMode,
    initialWindowHours,
    initialTimestamp,
    liveStatus: snapshot.liveStatus,
    liveTimestamp: snapshot.liveTimestamp,
    liveSessions: snapshot.liveSessions,
    compactViewport: surfaceUI.compactViewport,
  })
  const agentDetail = useAgentDetail({
    officeState,
    playbackMode: replay.playbackState.mode,
    pauseAutoTour: surfaceUI.pauseAutoTour,
    refreshLiveSessions: snapshot.refreshLiveSessions,
  })
  const {
    showAgentDetailModal,
    agentDetailSession,
    agentDetailStats,
    agentDetailLoading,
    agentDetailError,
    openAgentDetailForSession: openAgentDetail,
    handleCloseAgentDetail,
  } = agentDetail

  const {
    surfacePreferences,
    showGuide,
    showSettings,
    showShareModal,
    shortcutNotice,
    showHelpModal,
    sidebarOpen,
    liveStagePanels,
    showStatusPanel,
    showSessionPanel,
    heatmapEnabled,
    zoom,
    compactViewport,
    autoTourPaused,
    tourTargetAgentId,
    hoverState,
    setShowGuide,
    setShowSettings,
    setShowShareModal,
    setShortcutNotice,
    setShowHelpModal,
    setSidebarOpen,
    setLiveStagePanels,
    setShowStatusPanel,
    setShowSessionPanel,
    setTourTargetAgentId,
    setHoverState,
    handleZoomChange,
    handleCanvasInteraction,
    handleCanvasHoverChange,
    handleToggleHeatmap,
    handleThemeChange,
    handleCycleTheme,
    handleDensityChange,
    handleAutoSharePreviewChange,
    handleCoachTipsChange,
  } = surfaceUI

  const {
    connectionState,
    liveStatus,
    liveSessions,
    liveTimestamp,
    responseTrend,
    backendError: snapshotError,
    isSnapshotLoading,
    liveFreshness,
  } = snapshot

  const {
    metricsLive,
    analyticsTrends,
    analyticsCompare,
    zonesHeatmap,
    modelsDistribution,
    gatewayStatus,
    sessionInventory,
    analyticsError,
    analyticsLoading,
  } = analytics

  const {
    replayFrames,
    playbackState,
    isHistoryLoading,
    historyError,
    scrubberMin,
    scrubberMax,
    currentReplayFrame,
    currentReplayCharacterMap,
    augmentedTimelineSeries,
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
    handleModeChange: setPlaybackMode,
    handleWindowHoursChange: setPlaybackWindowHours,
    handleScrub: scrubReplay,
    handlePlayToggle: toggleReplayPlayback,
    handlePlaybackRateChange: setPlaybackRate,
  } = replay

  const backendError = snapshotError ?? historyError

  useEffect(() => {
    agentDetail.setShowAgentDetailModal(false)
  }, [agentDetail.setShowAgentDetailModal, page])

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

  const selectedAgentId = officeState.selectedAgentId
  const selectedSession =
    displaySessions.find((session) => getNumericAgentId(session.sessionKey) === selectedAgentId) || null

  const sessionInsights = useMemo(
    () => buildSessionInsights(replayFrames, liveSessions, liveTimestamp),
    [liveSessions, liveTimestamp, replayFrames, locale],
  )

  const hoveredSession =
    displaySessions.find((session) => getNumericAgentId(session.sessionKey) === hoverState.agentId) || null
  const hoveredInsight = hoveredSession ? sessionInsights.get(hoveredSession.sessionKey) : null
  const hoveredToolStats = hoveredInsight?.toolStats || []

  const heatmapSources = useMemo(
    () =>
      displaySessions
        .map((session) => {
          const agentId = getNumericAgentId(session.sessionKey)
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
        label: tt(i18n.status.replay),
        color: '#F9E2AF',
        detail: currentReplayFrame
          ? `${tt(i18n.replay.frame)} ${formatPlaybackTimestamp(currentReplayFrame.timestamp)}`
          : tt(i18n.replay.chooseRecordedFrame),
      }
    }

    return liveFreshness
  }, [currentReplayFrame, liveFreshness, playbackState.mode, tt])

  const stagePlaybackState: PlaybackState = page === 'landing'
    ? {
        ...playbackState,
        mode: landingReplayFrame ? 'replay' : 'live',
        isPlaying: false,
      }
    : playbackState
  const stageStatus = page === 'landing' ? landingReplayFrame?.status ?? displayStatus : displayStatus
  const stageSessions = page === 'landing' ? landingReplayFrame?.sessions ?? displaySessions : displaySessions
  const stageHistory = displayHistory

  const openAgentDetailForSession = useCallback(
    (session: DisplaySession | null, agentId?: number) => {
      setShowStatusPanel(false)
      setShowSessionPanel(false)
      openAgentDetail(session, agentId)
    },
    [openAgentDetail, setShowSessionPanel, setShowStatusPanel],
  )

  const handleAgentClick = useCallback(
    (agentId: number) => {
      const session =
        displaySessions.find((entry) => getNumericAgentId(entry.sessionKey) === agentId) || null
      openAgentDetailForSession(session, agentId)
    },
    [displaySessions, openAgentDetailForSession],
  )

  const handleSelectSession = useCallback(
    (sessionKey: string) => {
      surfaceUI.pauseAutoTour()
      const agentId = getNumericAgentId(sessionKey)
      if (agentId !== undefined) {
        officeState.selectedAgentId = agentId
        officeState.cameraFollowId = agentId
      }
      snapshot.refreshLiveSessions()
    },
    [officeState, snapshot, surfaceUI],
  )

  const handleOpenSession = useCallback(
    (sessionKey: string) => {
      const session =
        displaySessions.find((entry) => entry.sessionKey === sessionKey) ||
        liveSessions.find((entry) => entry.sessionKey === sessionKey) ||
        null
      openAgentDetailForSession(session, getNumericAgentId(sessionKey))
    },
    [displaySessions, liveSessions, openAgentDetailForSession],
  )

  const handleModeChange = useCallback(
    (mode: 'live' | 'replay') => {
      surfaceUI.pauseAutoTour()
      setHoverState({ agentId: null, position: null })
      officeState.cameraFollowId = null
      setPlaybackMode(mode)
    },
    [officeState, setHoverState, setPlaybackMode, surfaceUI],
  )

  const handleWindowHoursChange = useCallback(
    (windowHours: PlaybackState['windowHours']) => {
      surfaceUI.pauseAutoTour()
      setPlaybackWindowHours(windowHours)
    },
    [setPlaybackWindowHours, surfaceUI],
  )

  const handleScrub = useCallback(
    (timestamp: number) => {
      surfaceUI.pauseAutoTour()
      setHoverState({ agentId: null, position: null })
      officeState.cameraFollowId = null
      scrubReplay(timestamp)
    },
    [officeState, scrubReplay, setHoverState, surfaceUI],
  )

  const handlePlayToggle = useCallback(() => {
    surfaceUI.pauseAutoTour()
    toggleReplayPlayback()
  }, [surfaceUI, toggleReplayPlayback])

  const handlePlaybackRateChange = useCallback(
    (playbackRate: PlaybackState['playbackRate']) => {
      surfaceUI.pauseAutoTour()
      setPlaybackRate(playbackRate)
    },
    [setPlaybackRate, surfaceUI],
  )

  const handleJumpToLive = useCallback(() => {
    handleModeChange('live')
  }, [handleModeChange])

  const handleResumeTour = useCallback(() => {
    officeState.cameraFollowId = null
    surfaceUI.resumeAutoTour()
  }, [officeState, surfaceUI])

  const handleJumpToShare = useCallback(() => {
    setShowShareModal(true)
  }, [])

  const handleOpenHelp = useCallback(() => {
    setShowHelpModal(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return

      const key = event.key.toLowerCase()
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault()
        setShowGuide((previous) => !previous)
        setShortcutNotice(t(showGuide ? i18n.shortcutNotices.guideHidden : i18n.shortcutNotices.guideShown))
        return
      }

      if (key === 't') {
        event.preventDefault()
        handleCycleTheme()
        setShortcutNotice(t(i18n.shortcutNotices.themeSwitched))
        return
      }

      if (key === 'g') {
        event.preventDefault()
        handleToggleHeatmap()
        setShortcutNotice(t(heatmapEnabled ? i18n.shortcutNotices.heatmapOff : i18n.shortcutNotices.heatmapOn))
        return
      }

      if (key === 's') {
        event.preventDefault()
        handleJumpToShare()
        setShortcutNotice(t(i18n.shortcutNotices.jumpedToShare))
        return
      }

      if (key === 'l') {
        event.preventDefault()
        handleModeChange('live')
        setShortcutNotice(t(i18n.shortcutNotices.liveModeSelected))
        return
      }

      if (key === 'r') {
        event.preventDefault()
        handleModeChange('replay')
        setShortcutNotice(t(i18n.shortcutNotices.replayModeSelected))
        return
      }

      if (key === '1') {
        event.preventDefault()
        handleWindowHoursChange(1)
        setShortcutNotice(t(i18n.shortcutNotices.replayWindow1h))
        return
      }

      if (key === '6') {
        event.preventDefault()
        handleWindowHoursChange(6)
        setShortcutNotice(t(i18n.shortcutNotices.replayWindow6h))
        return
      }

      if (key === '2') {
        event.preventDefault()
        handleWindowHoursChange(24)
        setShortcutNotice(t(i18n.shortcutNotices.replayWindow24h))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleCycleTheme,
    handleJumpToShare,
    handleModeChange,
    handleToggleHeatmap,
    handleWindowHoursChange,
    heatmapEnabled,
    showGuide,
  ])

  const isLoading = isSnapshotLoading || isHistoryLoading
  const summaryCardProps = {
    status: displayStatus,
    sessions: displaySessions,
    timeline: augmentedTimelineSeries,
    connectionState,
    backendError,
    refreshMs: SNAPSHOT_REFRESH_MS,
    liveDemoHref: liveHref,
  }
  const embedSnippet = buildEmbedSnippet(embedCardHref)
  const localeToggleAction = {
    key: 'locale',
    label: `🌐 ${locale === 'zh' ? 'EN' : '中'}`,
    onClick: () => setLocale(locale === 'zh' ? 'en' : 'zh'),
    ariaLabel: locale === 'zh' ? tt(i18n.localeSwitcher.toggleToEn) : tt(i18n.localeSwitcher.toggleToZh),
    title: locale === 'zh' ? tt(i18n.localeSwitcher.toggleToEn) : tt(i18n.localeSwitcher.toggleToZh),
  }
  const siteLinks = [
    { href: landingHref, label: tt(i18n.nav.home), active: page === 'landing' },
    { href: liveHref, label: tt(i18n.nav.live), active: page === 'live' },
    { href: replayHref, label: tt(i18n.nav.replay), active: page === 'replay' },
    { href: docsHref, label: tt(i18n.nav.docs), active: page === 'docs' },
    { href: aboutHref, label: tt(i18n.nav.about), active: page === 'about' },
  ]
  const workspaceActions = [
    {
      key: 'live',
      label: tt(i18n.status.live),
      onClick: () => handleModeChange('live'),
      active: playbackState.mode === 'live',
    },
    {
      key: 'replay',
      label: tt(i18n.status.replay),
      onClick: () => handleModeChange('replay'),
      active: playbackState.mode === 'replay',
    },
    {
      key: 'share',
      label: tt(i18n.common.share),
      onClick: handleJumpToShare,
    },
    localeToggleAction,
    {
      key: 'help',
      label: '?',
      onClick: handleOpenHelp,
      ariaLabel: tt(i18n.common.openHelpAndCaseStudy),
    },
    {
      key: 'settings',
      label: tt(i18n.common.settings),
      onClick: () => setShowSettings((previous) => !previous),
      active: showSettings,
    },
  ]
  const liveStagePanelToggles = page === 'live'
    ? [
        {
          key: 'timeline',
          label: tt(i18n.panels.timeline),
          active: liveStagePanels.timeline,
          onToggle: () => setLiveStagePanels((previous) => ({ ...previous, timeline: !previous.timeline })),
        },
        {
          key: 'pulse',
          label: tt(i18n.panels.pulse),
          active: liveStagePanels.pulse,
          onToggle: () => setLiveStagePanels((previous) => ({ ...previous, pulse: !previous.pulse })),
          disabled: compactViewport,
        },
        {
          key: 'roster',
          label: tt(i18n.panels.roster),
          active: liveStagePanels.roster,
          onToggle: () => setLiveStagePanels((previous) => ({ ...previous, roster: !previous.roster })),
          disabled: compactViewport,
        },
        {
          key: 'guide',
          label: tt(i18n.panels.guide),
          active: liveStagePanels.guide,
          onToggle: () => setLiveStagePanels((previous) => ({ ...previous, guide: !previous.guide })),
          disabled: compactViewport,
        },
        {
          key: 'hover',
          label: tt(i18n.panels.hover),
          active: liveStagePanels.hover,
          onToggle: () => setLiveStagePanels((previous) => ({ ...previous, hover: !previous.hover })),
        },
        {
          key: 'sidebar',
          label: tt(i18n.panels.sidebar),
          active: sidebarOpen,
          onToggle: () => setSidebarOpen((previous) => !previous),
        },
      ]
    : []

  const landingHeaderProps = {
    variant: 'site' as const,
    brandHref: landingHref,
    brandName: tt(i18n.brand.name),
    brandSubtitle: tt(i18n.brand.tagline),
    links: siteLinks,
    actions: [localeToggleAction],
  }

  const landingStageProps = {
    officeState,
    panRef,
    zoom,
    onZoomChange: handleZoomChange,
    onAgentClick: () => {},
    hoveredAgentId: hoverState.agentId,
    hoverPosition: hoverState.position,
    hoveredSession,
    hoveredToolStats,
    hoveredActivityPoints: hoveredInsight?.activityPoints || [],
    hoveredActiveWindow: hoveredInsight?.dominantWindow || hoveredSession?.signalWindow || 'observed',
    onCanvasHoverChange: handleCanvasHoverChange,
    onCanvasInteraction: handleCanvasInteraction,
    connectionState,
    backendError,
    officeStatus: stageStatus,
    sessions: stageSessions,
    history: stageHistory,
    selectedSession: null,
    selectedAgentId: null,
    showStatusPanel: false,
    showSessionPanel: false,
    onToggleStatusPanel: () => {},
    onCloseStatusPanel: () => {},
    onCloseSessionPanel: () => {},
    onSelectSession: () => {},
    onOpenSession: () => {},
    getNumericAgentId,
    compactViewport,
    playbackState: stagePlaybackState,
    hasReplayFrames: replayFrames.length > 0,
    isLoading,
    replayCharacters: landingReplayFrame?.characters ?? null,
    replayCharacterMap: landingReplayCharacterMap,
    tourTargetAgentId: landingReplayFrame ? null : tourTargetAgentId,
    heatmapEnabled: false,
    heatmapSources: [],
    onToggleHeatmap: () => {},
    freshness,
    scrubberMin,
    scrubberMax,
    scrubberValue: landingReplayFrame?.timestamp ?? scrubberMax,
    currentFrameLabel,
    startLabel: formatPlaybackBoundary(scrubberMin),
    endLabel: formatPlaybackBoundary(scrubberMax),
    coverageLabel,
    autoTourPaused,
    previewFrames: [],
    eventMarkers: [],
    onModeChange: () => {},
    onWindowHoursChange: () => {},
    onScrub: () => {},
    onPlayToggle: () => {},
    onJumpToLive: () => {},
    onResumeTour: () => {},
    onPlaybackRateChange: () => {},
    landingMode: true,
    showStageTopbar: false,
    showZoomControls: false,
    showReplayControls: false,
    showSignalStrip: false,
    showRoster: false,
    showHelp: false,
    showHeatmapLegend: false,
    hoverCardMode: 'minimal' as const,
  }

  const workspaceHeaderProps = {
    variant: 'workspace' as const,
    brandName: tt(i18n.brand.name),
    statusLabel: freshness.label,
    statusColor: freshness.color,
    statusDetail: freshness.detail,
    actions: workspaceActions,
  }

  const workspaceStageSharedProps = {
    officeState,
    panRef,
    zoom,
    onZoomChange: handleZoomChange,
    onAgentClick: handleAgentClick,
    hoveredAgentId: hoverState.agentId,
    hoverPosition: hoverState.position,
    hoveredSession,
    hoveredToolStats,
    hoveredActivityPoints: hoveredInsight?.activityPoints || [],
    hoveredActiveWindow: hoveredInsight?.dominantWindow || hoveredSession?.signalWindow || 'observed',
    onCanvasHoverChange: handleCanvasHoverChange,
    onCanvasInteraction: handleCanvasInteraction,
    connectionState,
    backendError,
    officeStatus: stageStatus,
    sessions: stageSessions,
    history: stageHistory,
    selectedSession,
    selectedAgentId,
    showStatusPanel,
    showSessionPanel,
    onToggleStatusPanel: () => setShowStatusPanel((previous) => !previous),
    onCloseStatusPanel: () => setShowStatusPanel(false),
    onCloseSessionPanel: () => setShowSessionPanel(false),
    onSelectSession: handleSelectSession,
    onOpenSession: handleOpenSession,
    getNumericAgentId,
    compactViewport,
    playbackState: stagePlaybackState,
    hasReplayFrames: replayFrames.length > 0,
    isLoading,
    replayCharacterMap: currentReplayCharacterMap,
    tourTargetAgentId,
    heatmapEnabled,
    heatmapSources,
    onToggleHeatmap: handleToggleHeatmap,
    freshness,
    scrubberMin,
    scrubberMax,
    currentFrameLabel,
    startLabel: formatPlaybackBoundary(scrubberMin),
    endLabel: formatPlaybackBoundary(scrubberMax),
    coverageLabel,
    autoTourPaused,
    previewFrames: replayPreviewFrames,
    eventMarkers: replayEventMarkers,
    onModeChange: handleModeChange,
    onWindowHoursChange: handleWindowHoursChange,
    onScrub: handleScrub,
    onPlayToggle: handlePlayToggle,
    onJumpToLive: handleJumpToLive,
    onResumeTour: handleResumeTour,
    onPlaybackRateChange: handlePlaybackRateChange,
    showHeatmapLegend: heatmapEnabled,
  }

  const liveStageProps = {
    ...workspaceStageSharedProps,
    replayCharacters: playbackState.mode === 'replay' ? currentReplayFrame?.characters ?? null : null,
    scrubberValue: playbackState.mode === 'replay' ? currentReplayFrame?.timestamp ?? scrubberMax : scrubberMax,
    showReplayControls: liveStagePanels.timeline,
    showSignalStrip: liveStagePanels.pulse,
    showRoster: liveStagePanels.roster,
    showHelp: liveStagePanels.guide,
    hoverCardMode: liveStagePanels.hover ? 'full' as const : 'minimal' as const,
    panelToggles: liveStagePanelToggles,
  }

  const replayStageProps = {
    ...workspaceStageSharedProps,
    replayCharacters: playbackState.mode === 'replay' ? currentReplayFrame?.characters ?? null : null,
    scrubberValue: playbackState.mode === 'replay' ? currentReplayFrame?.timestamp ?? scrubberMax : scrubberMax,
    showReplayControls: true,
    showSignalStrip: undefined,
    showRoster: undefined,
    showHelp: undefined,
    hoverCardMode: 'full' as const,
    panelToggles: [],
  }

  const liveSidebarProps = {
    page: 'live' as const,
    loading: isLoading || analyticsLoading,
    freshnessLabel: freshness.label,
    modelMix: sidebarModelMix,
    zoneBars: sidebarZoneBars,
    responseTrend,
    metricsLive,
    analyticsTrends,
    analyticsCompare,
    zonesHeatmap,
    modelsDistribution,
    gatewayStatus: gatewayStatus ?? liveStatus,
    sessionInventoryCount: sessionInventory.length,
    analyticsError,
    sessions: liveSessions,
    getNumericAgentId,
    noteItems: demoSidebarNotes,
    showGuide,
    shortcutNotice,
    onOpenSession: handleOpenSession,
    onToggleGuide: () => setShowGuide((previous) => !previous),
    onJumpToShare: handleJumpToShare,
    onOpenHelp: handleOpenHelp,
  }

  const replaySidebarProps = {
    ...liveSidebarProps,
    page: 'replay' as const,
    sessions: displaySessions,
    noteItems: documentationPoints.slice(0, 4),
  }

  if (page === 'embed-card') {
    return (
      <EmbedView
        page="embed-card"
        summaryCardProps={summaryCardProps}
        docsStudioProps={{
          embedSnippet,
          embedCardHref,
          liveHref,
          summaryCardProps,
        }}
        shareLabel={tt(i18n.common.share)}
        onShare={handleJumpToShare}
      />
    )
  }

  let pageContent: ReactNode = null
  switch (page) {
    case 'landing':
      pageContent = <LandingView headerProps={landingHeaderProps} stageProps={landingStageProps} />
      break
    case 'live':
      pageContent = (
        <WorkspaceView
          page="live"
          headerProps={{
            ...workspaceHeaderProps,
            brandSubtitle: tt(i18n.pages.live.kicker),
          }}
          stageProps={liveStageProps}
          sidebarOpen={sidebarOpen}
          sidebarProps={liveSidebarProps}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          visibleCount={liveSessions.length}
          warmCount={liveSessions.filter((s) => s.signalScore >= 0.6).length}
          liveCount={liveSessions.filter((s) => s.status === 'running').length}
          totalSessions={snapshot.liveSnapshot?.status.total}
          connectionState={connectionState}
          connectionLabel={freshness.label}
          backendError={backendError}
        />
      )
      break
    case 'replay':
      pageContent = (
        <WorkspaceView
          page="replay"
          headerProps={{
            ...workspaceHeaderProps,
            brandSubtitle: tt(i18n.pages.replay.kicker),
          }}
          stageProps={replayStageProps}
          sidebarOpen={sidebarOpen}
          sidebarProps={replaySidebarProps}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          visibleCount={displaySessions.length}
          warmCount={displaySessions.filter((s) => s.signalScore >= 0.6).length}
          liveCount={displaySessions.filter((s) => s.status === 'running').length}
          totalSessions={undefined}
          connectionState={connectionState}
          connectionLabel={freshness.label}
          backendError={backendError}
        />
      )
      break
    case 'embed':
      pageContent = (
        <EmbedView
          page="embed"
          summaryCardProps={summaryCardProps}
          docsStudioProps={{
            embedSnippet,
            embedCardHref,
            liveHref,
            summaryCardProps,
          }}
          shareLabel={tt(i18n.common.share)}
          onShare={handleJumpToShare}
        />
      )
      break
    case 'docs':
      pageContent = (
        <DocsStudioSection
          page="docs"
          embedSnippet={embedSnippet}
          embedCardHref={embedCardHref}
          liveHref={liveHref}
          summaryCardProps={summaryCardProps}
        />
      )
      break
    case 'about':
      pageContent = (
        <AboutOverviewSection
          landingHref={landingHref}
          liveHref={liveHref}
          replayHref={replayHref}
          embedHref={embedHref}
          docsHref={docsHref}
          aboutHref={aboutHref}
          summaryCardProps={summaryCardProps}
        />
      )
      break
    default:
      pageContent = null
  }

  const surfaceContextValue = useMemo(() => ({
    officeState,
    sessions: displaySessions,
    history: displayHistory,
    connectionState,
    backendError,
    playbackState,
    isLoading,
  }), [officeState, displaySessions, displayHistory, connectionState, backendError, playbackState, isLoading])

  return (
    <SurfaceProvider value={surfaceContextValue}>
    <div className="gs-shell" data-theme={surfacePreferences.theme} data-density={surfacePreferences.density}>
      <main className="gs-page"><ErrorBoundary name="page">{pageContent}</ErrorBoundary></main>

      {/* Share Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={tt(i18n.common.share)}
        className="gs-share-modal"
      >
        <SharePanel
          livePath={liveHref}
          status={displayStatus}
          sessions={displaySessions}
          timeline={augmentedTimelineSeries}
          timestamp={displayTimestamp}
          freshnessLabel={freshness.label}
          playbackMode={playbackState.mode}
          windowHours={playbackState.windowHours}
          theme={surfacePreferences.theme}
          autoGeneratePreview={surfacePreferences.autoSharePreview}
        />
      </Modal>

      {/* 设置 Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title={tt(i18n.panels.settings)}
      >
        <SettingsContent
          preferences={surfacePreferences}
          onThemeChange={handleThemeChange}
          onDensityChange={handleDensityChange}
          onAutoSharePreviewChange={handleAutoSharePreviewChange}
          onCoachTipsChange={handleCoachTipsChange}
        />
      </Modal>

      <AgentDetailModal
        isOpen={showAgentDetailModal}
        session={agentDetailSession}
        stats={agentDetailStats}
        loading={agentDetailLoading}
        error={agentDetailError}
        onClose={handleCloseAgentDetail}
      />

      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={tt(i18n.caseStudy.modalTitle)}
        className="gs-help-modal"
      >
        <CaseStudyLayer exampleSession={liveSessions[0] || null} />
      </Modal>

    </div>
    </SurfaceProvider>
  )
}

export default GhostShiftSurface
