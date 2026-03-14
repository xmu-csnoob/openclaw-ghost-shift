import { useState, useCallback, useRef, useEffect } from 'react'
import { OfficeState } from './office/engine/officeState.js'
import { OfficeCanvas } from './office/components/OfficeCanvas.js'
import { StatusPanel } from './components/StatusPanel.js'
import { SessionPanel } from './components/SessionPanel.js'
import { SignalStrip } from './components/SignalStrip.js'
import { apiClient } from './services/ApiClient.js'
import type { PublicOfficeStatus } from './services/types.js'
import type { DisplaySession, PulseSample, SessionObservation } from './publicDisplay.js'
import { getZoneColor, getZoneLabel, toDisplaySession, updateObservation } from './publicDisplay.js'

// Game state lives outside React
const officeStateRef = { current: null as OfficeState | null }
let clientIdCounter = 0

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState()
  }
  return officeStateRef.current
}

// Map session key to numeric agent ID
const sessionToAgentId = new Map<string, number>()

const zoneSeatPrefixes: Record<string, string[]> = {
  'code-studio': ['code-'],
  'chat-lounge': ['chat-'],
  'ops-lab': ['ops-'],
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

function App() {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [officeStatus, setOfficeStatus] = useState<PublicOfficeStatus | null>(null)
  const [sessions, setSessions] = useState<DisplaySession[]>([])
  const [history, setHistory] = useState<PulseSample[]>([])
  const [backendError, setBackendError] = useState<string | null>(null)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const [zoom, setZoom] = useState(() => {
    const dpr = window.devicePixelRatio || 1
    return Math.round(2 * dpr)
  })
  const panRef = useRef({ x: 0, y: 0 })
  const observationsRef = useRef<Map<string, SessionObservation>>(new Map())

  const officeState = getOfficeState()

  // Get or create agent ID for a session
  const getAgentIdForSession = useCallback((sessionKey: string): number => {
    let agentId = sessionToAgentId.get(sessionKey)
    if (agentId === undefined) {
      agentId = ++clientIdCounter
      sessionToAgentId.set(sessionKey, agentId)
    }
    return agentId
  }, [])

  // Poll backend API for data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await apiClient.getSnapshot()
        const now = Date.now()
        const currentKeys = new Set(snapshot.sessions.map((session) => session.sessionKey))
        const nextSessions: DisplaySession[] = []

        for (const session of snapshot.sessions) {
          const agentId = getAgentIdForSession(session.sessionKey)
          const previous = observationsRef.current.get(session.sessionKey)
          const nextObservation = updateObservation(previous, session, now)
          observationsRef.current.set(session.sessionKey, nextObservation)
          const preferredSeatId = findPreferredSeat(officeState, session.zone)
          const displaySession = toDisplaySession(session, nextObservation)

          if (!officeState.characters.has(agentId)) {
            const palette = agentId % 6
            officeState.addAgent(agentId, palette, undefined, preferredSeatId || undefined, true)
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

        for (const [sessionKey, agentId] of Array.from(sessionToAgentId.entries())) {
          if (!currentKeys.has(sessionKey)) {
            officeState.removeAgent(agentId)
            sessionToAgentId.delete(sessionKey)
            observationsRef.current.delete(sessionKey)
          }
        }

        nextSessions.sort((a, b) => a.agentId.localeCompare(b.agentId))
        setSessions(nextSessions)
        setOfficeStatus(snapshot.status)
        setHistory((prev) => {
          const next = prev.concat({
            timestamp: now,
            displayed: snapshot.status.displayed,
            running: snapshot.status.running,
          })
          return next.slice(-40)
        })
        setConnectionState(snapshot.status.connected ? 'connected' : 'disconnected')
        setBackendError(null)
      } catch {
        setOfficeStatus(null)
        setBackendError('API unavailable')
        setConnectionState('disconnected')
      }
    }
    
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [officeState, getAgentIdForSession])

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  const handleAgentClick = useCallback((agentId: number) => {
    officeState.selectedAgentId = agentId
    // Show session panel when clicking an agent
    setShowSessionPanel(true)
    // Hide status panel if open
    setShowStatusPanel(false)
    // Force re-render
    setSessions(prev => [...prev])
  }, [officeState])

  const handleSelectSession = useCallback((sessionKey: string) => {
    const agentId = sessionToAgentId.get(sessionKey)
    if (agentId !== undefined) {
      officeState.selectedAgentId = agentId
    }
    setSessions(prev => [...prev])
  }, [officeState])

  const getConnectionColor = (connected: boolean) => {
    return connected ? '#A6E3A1' : '#F38BA8'
  }

  const getConnectionLabel = (state: typeof connectionState) => {
    const labels = {
      'connected': 'Connected',
      'connecting': 'Connecting...',
      'disconnected': 'Disconnected'
    }
    return labels[state]
  }

  // Get selected agent info
  const selectedAgentId = officeState.selectedAgentId
  const selectedSession = sessions.find(s => sessionToAgentId.get(s.sessionKey) === selectedAgentId)

  // Calculate totals
  const runningCount = sessions.filter(s => s.status === 'running').length
  const warmCount = sessions.filter((session) => session.signalScore >= 0.6).length

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Canvas */}
      <OfficeCanvas
        officeState={officeState}
        onClick={handleAgentClick}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        panRef={panRef}
      />

      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            padding: '6px 12px',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#89B4FA',
            letterSpacing: 1,
          }}
        >
          GHOST SHIFT
        </div>

        {/* Connection status */}
        <div
          style={{
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#CDD6F4',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getConnectionColor(connectionState === 'connected'),
            }}
          />
          <span>{getConnectionLabel(connectionState)}</span>
          {backendError && (
            <span style={{ color: '#F38BA8', fontSize: 10 }}>
              {backendError}
            </span>
          )}
        </div>

        {/* Stats */}
        <div
          style={{
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 11,
            color: '#CDD6F4',
          }}
        >
          <span>
            <span style={{ color: '#6C7086' }}>Sessions:</span> {sessions.length}
            {warmCount > 0 && (
              <span style={{ color: '#F9E2AF' }}> ({warmCount} warm)</span>
            )}
            {runningCount > 0 && (
              <span style={{ color: '#A6E3A1' }}> • {runningCount} live</span>
            )}
          </span>
        </div>

        {/* Status button */}
        <button
          onClick={() => setShowStatusPanel(!showStatusPanel)}
          style={{
            background: showStatusPanel ? 'rgba(137, 180, 250, 0.2)' : 'rgba(30, 30, 46, 0.9)',
            border: '2px solid',
            borderColor: showStatusPanel ? '#89B4FA' : '#45475A',
            padding: '6px 12px',
            fontSize: 12,
            color: showStatusPanel ? '#89B4FA' : '#CDD6F4',
            cursor: 'pointer',
          }}
        >
          📊 Status
        </button>
      </div>

      {/* Zoom controls */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: showStatusPanel ? 340 : 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 100,
          transition: 'right 0.2s ease',
        }}
      >
        <button
          onClick={() => handleZoomChange(Math.min(10, zoom + 1))}
          style={{
            width: 32,
            height: 32,
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            color: '#CDD6F4',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          +
        </button>
        <div
          style={{
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            padding: '4px 8px',
            textAlign: 'center',
            fontSize: 11,
            color: '#6C7086',
          }}
        >
          {zoom}x
        </div>
        <button
          onClick={() => handleZoomChange(Math.max(1, zoom - 1))}
          style={{
            width: 32,
            height: 32,
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            color: '#CDD6F4',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          −
        </button>
      </div>

      {/* Status Panel */}
      <StatusPanel
        status={officeStatus}
        sessions={sessions}
        history={history}
        selectedSessionKey={selectedSession?.sessionKey || null}
        onSelectSession={handleSelectSession}
        visible={showStatusPanel}
        onClose={() => setShowStatusPanel(false)}
      />

      {/* Session Panel (shows detailed session info) */}
      <SessionPanel
        session={selectedSession || null}
        visible={showSessionPanel && !showStatusPanel}
        onClose={() => setShowSessionPanel(false)}
        position="left"
      />

      <SignalStrip status={officeStatus} sessions={sessions} history={history} />

      {/* Sessions mini-list (if multiple and not showing panel) */}
      {sessions.length > 0 && !showStatusPanel && !showSessionPanel && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            background: 'rgba(30, 30, 46, 0.9)',
            border: '2px solid #45475A',
            padding: '8px 12px',
            maxWidth: 250,
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 11, color: '#6C7086', marginBottom: 4 }}>
            Live Roster
          </div>
          {sessions.slice(0, 5).map((session) => {
            const agentId = sessionToAgentId.get(session.sessionKey)
            const isSelected = agentId === selectedAgentId
            return (
              <div
                key={session.sessionKey}
                onClick={() => {
                  if (agentId !== undefined) {
                    officeState.selectedAgentId = agentId
                    setShowSessionPanel(true)
                    setSessions(prev => [...prev])
                  }
                }}
                style={{
                  fontSize: 11,
                  color: session.status === 'running' ? '#A6E3A1' : '#CDD6F4',
                  padding: '2px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
                  borderRadius: 2,
                  paddingLeft: isSelected ? 4 : 0,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      session.activityBand === 'surging'
                        ? '#F38BA8'
                        : session.activityBand === 'steady'
                          ? '#A6E3A1'
                          : session.activityBand === 'warm'
                            ? '#F9E2AF'
                            : '#6C7086',
                  }}
                />
                <span>{session.agentId || session.sessionKey.split(':').pop()}</span>
                <span style={{ color: getZoneColor(session.zone), fontSize: 9 }}>{getZoneLabel(session.zone)}</span>
              </div>
            )
          })}
          {sessions.length > 5 && (
            <div style={{ fontSize: 10, color: '#45475A', marginTop: 4 }}>
              +{sessions.length - 5} more
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 12,
          background: 'rgba(30, 30, 46, 0.9)',
          border: '2px solid #45475A',
          padding: '6px 12px',
          fontSize: 10,
          color: '#6C7086',
          zIndex: 100,
        }}
      >
        Click agent to select • Middle-click + drag to pan • Ctrl+scroll to zoom • Press 📊 for details
      </div>

      {/* Vignette overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
          zIndex: 40,
        }}
      />
    </div>
  )
}

export default App
