import type { MutableRefObject } from 'react'
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

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface LiveOfficeStageProps {
  officeState: OfficeState
  panRef: MutableRefObject<{ x: number; y: number }>
  zoom: number
  onZoomChange: (zoom: number) => void
  onAgentClick: (agentId: number) => void
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
  replayCharacters?: Character[] | null
  replayCharacterMap?: Map<number, Character> | null
  tourTargetAgentId?: number | null
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
  onModeChange: (mode: 'live' | 'replay') => void
  onWindowHoursChange: (hours: PlaybackState['windowHours']) => void
  onScrub: (timestamp: number) => void
  onPlayToggle: () => void
  onJumpToLive: () => void
  onResumeTour: () => void
  onCanvasInteraction?: () => void
}

function getConnectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting'
    default:
      return 'Disconnected'
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
  replayCharacters = null,
  replayCharacterMap = null,
  tourTargetAgentId = null,
  freshness,
  scrubberMin,
  scrubberMax,
  scrubberValue,
  currentFrameLabel,
  startLabel,
  endLabel,
  coverageLabel,
  autoTourPaused,
  onModeChange,
  onWindowHoursChange,
  onScrub,
  onPlayToggle,
  onJumpToLive,
  onResumeTour,
  onCanvasInteraction,
}: LiveOfficeStageProps) {
  const runningCount = sessions.filter((session) => session.status === 'running').length
  const warmCount = sessions.filter((session) => session.signalScore >= 0.6).length

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
        onUserInteraction={onCanvasInteraction}
      />

      <ReplayControlBar
        playbackState={playbackState}
        hasFrames={scrubberMax >= scrubberMin}
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
        onModeChange={onModeChange}
        onWindowHoursChange={onWindowHoursChange}
        onScrub={onScrub}
        onPlayToggle={onPlayToggle}
        onJumpToLive={onJumpToLive}
        onResumeTour={onResumeTour}
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
            <strong>{sessions.length}</strong> visible
          </span>
          <span>{warmCount} warm</span>
          <span>{runningCount} live</span>
        </div>

        <button
          className={`gs-stage-panel gs-stage-panel--button ${showStatusPanel ? 'is-active' : ''}`}
          onClick={onToggleStatusPanel}
        >
          Telemetry
        </button>
      </div>

      <div className="gs-stage-zoom">
        <button onClick={() => onZoomChange(Math.min(10, zoom + 1))}>+</button>
        <span>{zoom}x</span>
        <button onClick={() => onZoomChange(Math.max(1, zoom - 1))}>-</button>
      </div>

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
        visible={showSessionPanel && !showStatusPanel}
        onClose={onCloseSessionPanel}
        position="left"
      />

      {!compactViewport ? <SignalStrip status={officeStatus} sessions={sessions} history={history} /> : null}

      {!compactViewport && sessions.length > 0 && !showStatusPanel && !showSessionPanel ? (
        <div className="gs-stage-roster">
          <div className="gs-stage-roster__label">Live Roster</div>
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
            <div className="gs-stage-roster__more">+{sessions.length - 5} more in the public office</div>
          ) : null}
        </div>
      ) : null}

      {!compactViewport ? (
        <div className="gs-stage-help">
          Tap or click an agent to inspect its public card. Middle-drag pans the room. Ctrl or Cmd + scroll changes
          zoom.
        </div>
      ) : null}

      <div className="gs-stage-vignette" />
    </div>
  )
}
