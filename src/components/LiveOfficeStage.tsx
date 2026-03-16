import type { MutableRefObject } from 'react'
import { AgentHoverCard, type HoverActivityPoint, type HoverToolStat } from './AgentHoverCard.js'
import { OfficeCanvas } from '../office/components/OfficeCanvas.js'
import type { OfficeState } from '../office/engine/officeState.js'
import type { DisplaySession, PulseSample } from '../publicDisplay.js'
import { getPublicAgentLabel, getZoneColor, getZoneLabel } from '../publicDisplay.js'
import type { Character } from '../office/types.js'
import type { PublicOfficeStatus } from '../services/types.js'
import type { PlaybackState } from '../replay.js'
import { ReplayControlBar } from './ReplayControlBar.js'
import { SessionPanel } from './SessionPanel.js'
import { SignalStrip } from './SignalStrip.js'
import { StatusPanel } from './StatusPanel.js'
import { i18n } from '../content/i18n.js'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface LiveOfficeStageProps {
  officeState: OfficeState
  panRef: MutableRefObject<{ x: number; y: number }>
  zoom: number
  onZoomChange: (zoom: number) => void
  onAgentClick: (agentId: number) => void
  hoveredAgentId: number | null
  hoverPosition: { x: number; y: number } | null
  hoveredSession: DisplaySession | null
  hoveredPublicId: string | null
  hoveredToolStats: HoverToolStat[]
  hoveredActivityPoints: HoverActivityPoint[]
  hoveredActiveWindow: string
  onCanvasHoverChange?: (agentId: number | null, position: { x: number; y: number } | null) => void
  connectionState: ConnectionState
  backendError: string | null
  officeStatus: PublicOfficeStatus | null
  sessions: DisplaySession[]
  history: PulseSample[]
  selectedSession: DisplaySession | null
  selectedAgentId: number | null
  showStatusPanel: boolean
  showSessionPanel: boolean
  onToggleStatusPanel: () => void
  onCloseStatusPanel: () => void
  onCloseSessionPanel: () => void
  onSelectSession: (sessionKey: string) => void
  onOpenSession: (sessionKey: string) => void
  getNumericAgentId: (sessionKey: string) => number | undefined
  compactViewport: boolean
  playbackState: PlaybackState
  hasReplayFrames: boolean
  isLoading: boolean
  replayCharacters?: Character[] | null
  replayCharacterMap?: Map<number, Character> | null
  tourTargetAgentId?: number | null
  heatmapEnabled: boolean
  heatmapSources: Array<{ agentId: number; zone: string; intensity: number }>
  onToggleHeatmap: () => void
  freshness: {
    label: string
    color: string
    detail: string
  }
  scrubberMin: number
  scrubberMax: number
  scrubberValue: number
  currentFrameLabel: string
  startLabel: string
  endLabel: string
  coverageLabel: string
  autoTourPaused: boolean
  previewFrames: Array<{
    id: string
    timestamp: number
    label: string
    running: number
    displayed: number
    zoneLabel: string
    accent: string
    isCurrent: boolean
    previewBars: number[]
  }>
  eventMarkers: Array<{
    id: string
    timestamp: number
    position: number
    label: string
    tone: string
  }>
  onModeChange: (mode: 'live' | 'replay') => void
  onWindowHoursChange: (hours: PlaybackState['windowHours']) => void
  onScrub: (timestamp: number) => void
  onPlayToggle: () => void
  onJumpToLive: () => void
  onResumeTour: () => void
  onPlaybackRateChange: (rate: PlaybackState['playbackRate']) => void
  onCanvasInteraction?: () => void
}

function getConnectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return i18n.status.connected
    case 'connecting':
      return i18n.status.connecting
    default:
      return i18n.status.disconnected
  }
}

function getConnectionTone(state: ConnectionState, backendError: string | null): string {
  if (backendError) return '#ff8a8a'
  return state === 'connected' ? '#9bffb4' : '#ffd36d'
}

export function LiveOfficeStage({
  officeState,
  panRef,
  zoom,
  onZoomChange,
  onAgentClick,
  hoveredAgentId,
  hoverPosition,
  hoveredSession,
  hoveredPublicId,
  hoveredToolStats,
  hoveredActivityPoints,
  hoveredActiveWindow,
  onCanvasHoverChange,
  connectionState,
  backendError,
  officeStatus,
  sessions,
  history,
  selectedSession,
  selectedAgentId,
  showStatusPanel,
  showSessionPanel,
  onToggleStatusPanel,
  onCloseStatusPanel,
  onCloseSessionPanel,
  onSelectSession,
  onOpenSession,
  getNumericAgentId,
  compactViewport,
  playbackState,
  hasReplayFrames,
  isLoading,
  replayCharacters = null,
  replayCharacterMap = null,
  tourTargetAgentId = null,
  heatmapEnabled,
  heatmapSources,
  onToggleHeatmap,
  freshness,
  scrubberMin,
  scrubberMax,
  scrubberValue,
  currentFrameLabel,
  startLabel,
  endLabel,
  coverageLabel,
  autoTourPaused,
  previewFrames,
  eventMarkers,
  onModeChange,
  onWindowHoursChange,
  onScrub,
  onPlayToggle,
  onJumpToLive,
  onResumeTour,
  onPlaybackRateChange,
  onCanvasInteraction,
}: LiveOfficeStageProps) {
  const runningCount = sessions.filter((session) => session.status === 'running').length
  const warmCount = sessions.filter((session) => session.signalScore >= 0.6).length
  const heatmapZoneCount = new Set(heatmapSources.map((source) => source.zone)).size
  const zoomLabel = `${zoom >= 10 || Number.isInteger(zoom) ? zoom.toFixed(0) : zoom.toFixed(1)}x`

  return (
    <div className="gs-live-stage">
      <OfficeCanvas
        officeState={officeState}
        onClick={onAgentClick}
        zoom={zoom}
        onZoomChange={onZoomChange}
        panRef={panRef}
        replayCharacters={replayCharacters}
        replayCharacterMap={replayCharacterMap}
        tourTargetAgentId={tourTargetAgentId}
        heatmapEnabled={heatmapEnabled}
        heatmapSources={heatmapSources}
        onHoverChange={onCanvasHoverChange}
        onUserInteraction={onCanvasInteraction}
      />

      <ReplayControlBar
        playbackState={playbackState}
        hasFrames={hasReplayFrames}
        scrubberMin={scrubberMin}
        scrubberMax={scrubberMax}
        scrubberValue={scrubberValue}
        currentLabel={currentFrameLabel}
        startLabel={startLabel}
        endLabel={endLabel}
        coverageLabel={coverageLabel}
        freshnessLabel={freshness.label}
        freshnessColor={freshness.color}
        freshnessDetail={freshness.detail}
        autoTourPaused={autoTourPaused}
        previewFrames={previewFrames}
        eventMarkers={eventMarkers}
        onModeChange={onModeChange}
        onWindowHoursChange={onWindowHoursChange}
        onScrub={onScrub}
        onPlayToggle={onPlayToggle}
        onJumpToLive={onJumpToLive}
        onResumeTour={onResumeTour}
        onPlaybackRateChange={onPlaybackRateChange}
        compact={compactViewport}
      />

      <AgentHoverCard
        visible={hoveredAgentId !== null && hoverPosition !== null}
        anchor={hoverPosition}
        session={hoveredSession}
        publicId={hoveredPublicId}
        toolStats={hoveredToolStats}
        activityPoints={hoveredActivityPoints}
        dominantWindow={hoveredActiveWindow}
        loading={isLoading || (hoveredAgentId !== null && hoveredSession === null)}
        compact={compactViewport}
      />

      <div className="gs-stage-topbar">
        <div className="gs-stage-panel gs-stage-panel--brand">GHOST SHIFT</div>

        <div className="gs-stage-panel gs-stage-panel--status">
          <span
            className="gs-stage-status-dot"
            style={{ background: getConnectionTone(connectionState, backendError) }}
          />
          <span>{getConnectionLabel(connectionState)}</span>
          {backendError ? <span className="gs-stage-panel__error">{backendError}</span> : null}
        </div>

        <div className="gs-stage-panel gs-stage-panel--stats">
          <span>
            <strong>{sessions.length}</strong> {i18n.liveOffice.visible}
          </span>
          {!compactViewport ? <span>{warmCount} {i18n.liveOffice.warm}</span> : null}
          <span>{runningCount} {i18n.liveOffice.liveAgents}</span>
        </div>

        <button
          className={`gs-stage-panel gs-stage-panel--button ${showStatusPanel ? 'is-active' : ''}`}
          onClick={onToggleStatusPanel}
          aria-pressed={showStatusPanel}
        >
          {i18n.liveOffice.telemetry}
        </button>

        <button
          className={`gs-stage-panel gs-stage-panel--button ${heatmapEnabled ? 'is-active' : ''}`}
          onClick={onToggleHeatmap}
          aria-pressed={heatmapEnabled}
        >
          {i18n.liveOffice.heatmap}
        </button>
      </div>

      <div className="gs-stage-zoom">
        <button type="button" aria-label="Zoom in" onClick={() => onZoomChange(Math.min(10, zoom + 1))}>+</button>
        <span>{zoomLabel}</span>
        <button type="button" aria-label="Zoom out" onClick={() => onZoomChange(Math.max(1, zoom - 1))}>-</button>
      </div>

      {heatmapEnabled ? (
        <div className="gs-stage-heatmap-legend" role="status" aria-live="polite">
          <div className="gs-stage-heatmap-legend__eyebrow">{i18n.liveOffice.activityHeatmap}</div>
          <div className="gs-stage-heatmap-legend__body">
            <span>{heatmapSources.length} {i18n.liveOffice.activeSources}</span>
            <span>{heatmapZoneCount} {i18n.liveOffice.hotZones}</span>
            <span>{compactViewport ? i18n.liveOffice.pinchDragToInspect : i18n.liveOffice.panZoomToInspect}</span>
          </div>
        </div>
      ) : null}

      <StatusPanel
        status={officeStatus}
        sessions={sessions}
        history={history}
        selectedSessionKey={selectedSession?.sessionKey || null}
        onSelectSession={onSelectSession}
        visible={showStatusPanel}
        onClose={onCloseStatusPanel}
      />

      <SessionPanel
        session={selectedSession}
        visible={showSessionPanel && !showStatusPanel && Boolean(selectedSession)}
        onClose={onCloseSessionPanel}
        position="left"
      />

      {!compactViewport ? <SignalStrip status={officeStatus} sessions={sessions} history={history} /> : null}

      {!compactViewport && sessions.length > 0 && !showStatusPanel && !showSessionPanel ? (
        <div className="gs-stage-roster">
          <div className="gs-stage-roster__label">{playbackState.mode === 'replay' ? i18n.liveOffice.replayRoster : i18n.liveOffice.liveRoster}</div>
          {sessions.slice(0, 5).map((session) => {
            const numericAgentId = getNumericAgentId(session.sessionKey)
            const isSelected = numericAgentId === selectedAgentId

            return (
              <button
                key={session.sessionKey}
                className={`gs-stage-roster__item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onOpenSession(session.sessionKey)}
              >
                <span
                  className="gs-stage-roster__dot"
                  style={{ background: getZoneColor(session.zone) }}
                />
                <span>{getPublicAgentLabel(session.agentId, numericAgentId)}</span>
                <span className="gs-stage-roster__zone">{getZoneLabel(session.zone)}</span>
              </button>
            )
          })}
          {sessions.length > 5 ? (
            <div className="gs-stage-roster__more">+{sessions.length - 5} {i18n.liveOffice.moreInPublicOffice}</div>
          ) : null}
        </div>
      ) : null}

      {!compactViewport ? (
        <div className="gs-stage-help">
          {i18n.liveOffice.scrubHelp}
        </div>
      ) : null}

      {isLoading ? (
        <div className="gs-stage-skeleton">
          <div className="gs-skeleton gs-skeleton--canvas" />
          <div className="gs-skeleton gs-skeleton--floating" />
          <div className="gs-skeleton gs-skeleton--floating gs-skeleton--floating-right" />
        </div>
      ) : null}

      <div className="gs-stage-vignette" />
    </div>
  )
}
