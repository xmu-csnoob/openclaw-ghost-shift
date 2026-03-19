import { useCallback, useEffect, useState } from 'react'
import type { SurfaceExperiencePreferences } from '../components/ExperiencePanel.js'
import { getNextSurfaceTheme } from '../surfaceThemes.js'
import type { GhostShiftPage, LiveStagePanelKey } from '../pages/ghost-shift/surfaceShared.js'
import {
  defaultLiveStagePanels,
  readSurfacePreferences,
  UI_PREFERENCES_KEY,
} from '../pages/ghost-shift/surfaceShared.js'

interface UseSurfaceUIParams {
  page: GhostShiftPage
}

export function useSurfaceUI({ page }: UseSurfaceUIParams) {
  const [surfacePreferences, setSurfacePreferences] = useState<SurfaceExperiencePreferences>(readSurfacePreferences)
  const [showGuide, setShowGuide] = useState(() => readSurfacePreferences().coachTips)
  const [showSettings, setShowSettings] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shortcutNotice, setShortcutNotice] = useState<string | null>(null)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => page === 'replay')
  const [liveStagePanels, setLiveStagePanels] = useState<Record<LiveStagePanelKey, boolean>>(defaultLiveStagePanels)
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
  const [hoverState, setHoverState] = useState<{ agentId: number | null; position: { x: number; y: number } | null }>({
    agentId: null,
    position: null,
  })

  useEffect(() => {
    const handleResize = () => {
      setCompactViewport(window.innerWidth < 980)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setSidebarOpen(page === 'replay')
    if (page === 'live') {
      setLiveStagePanels(defaultLiveStagePanels)
    }
  }, [page])

  useEffect(() => {
    if (!compactViewport) return
    setLiveStagePanels((previous) => ({
      ...previous,
      pulse: false,
      roster: false,
      guide: false,
    }))
  }, [compactViewport])

  useEffect(() => {
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(surfacePreferences))
  }, [surfacePreferences])

  useEffect(() => {
    if (!shortcutNotice) return undefined

    const timeoutId = window.setTimeout(() => setShortcutNotice(null), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [shortcutNotice])

  const pauseAutoTour = useCallback(() => {
    setAutoTourPaused(true)
    setTourTargetAgentId(null)
  }, [])

  const resumeAutoTour = useCallback(() => {
    setAutoTourPaused(false)
  }, [])

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

  const handleToggleHeatmap = useCallback(() => {
    pauseAutoTour()
    setHeatmapEnabled((previous) => !previous)
  }, [pauseAutoTour])

  const handleThemeChange = useCallback((theme: SurfaceExperiencePreferences['theme']) => {
    setSurfacePreferences((previous) => ({ ...previous, theme }))
  }, [])

  const handleCycleTheme = useCallback(() => {
    setSurfacePreferences((previous) => ({
      ...previous,
      theme: getNextSurfaceTheme(previous.theme),
    }))
  }, [])

  const handleDensityChange = useCallback((density: SurfaceExperiencePreferences['density']) => {
    setSurfacePreferences((previous) => ({ ...previous, density }))
  }, [])

  const handleAutoSharePreviewChange = useCallback((autoSharePreview: boolean) => {
    setSurfacePreferences((previous) => ({ ...previous, autoSharePreview }))
  }, [])

  const handleCoachTipsChange = useCallback((coachTips: boolean) => {
    setSurfacePreferences((previous) => ({ ...previous, coachTips }))
    setShowGuide(coachTips)
  }, [])

  return {
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
    pauseAutoTour,
    resumeAutoTour,
    handleZoomChange,
    handleCanvasInteraction,
    handleCanvasHoverChange,
    handleToggleHeatmap,
    handleThemeChange,
    handleCycleTheme,
    handleDensityChange,
    handleAutoSharePreviewChange,
    handleCoachTipsChange,
  }
}
