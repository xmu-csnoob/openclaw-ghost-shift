import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { LiveOfficeStage } from './LiveOfficeStage.js'
import type { DisplaySession, PulseSample } from '../publicDisplay.js'
import type { PlaybackState } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'

vi.mock('../office/components/OfficeCanvas.js', () => ({
  OfficeCanvas: ({
    heatmapEnabled,
    heatmapSources,
    onUserInteraction,
  }: {
    heatmapEnabled?: boolean
    heatmapSources?: Array<{ agentId: number; zone: string; intensity: number }>
    onUserInteraction?: () => void
  }) => (
    <div data-testid="office-canvas">
      <div>{heatmapEnabled ? 'heatmap:on' : 'heatmap:off'}</div>
      <div>{`sources:${heatmapSources?.length ?? 0}`}</div>
      <button type="button" onClick={() => onUserInteraction?.()}>
        Canvas interaction
      </button>
    </div>
  ),
}))

function makeSession(index: number, overrides: Partial<DisplaySession> = {}): DisplaySession {
  return {
    publicId: `pub_${index}`,
    sessionKey: `pub_${index}`,
    agentId: `Agent ${String(index).padStart(2, '0')}`,
    model: 'gpt-4.1',
    status: index <= 2 ? 'running' : 'idle',
    zone: index % 2 === 0 ? 'code-studio' : 'chat-lounge',
    role: index % 2 === 0 ? 'coding-agent' : 'webchat',
    origin: index % 2 === 0 ? 'Workspace CLI' : 'Feishu',
    activityScore: index <= 2 ? 0.95 : 0.42,
    activityWindow: index <= 2 ? 'live' : '10m',
    footprint: 'working-set',
    modelFamily: 'GPT',
    observedSince: Date.parse('2026-03-14T10:00:00Z'),
    lastChangedAt: Date.parse('2026-03-14T11:30:00Z'),
    signalScore: index <= 3 ? 0.78 : 0.3,
    signalWindow: index <= 2 ? 'live' : '10m',
    footprintLabel: 'Working Set',
    sampleCount: 6,
    activityBand: index <= 2 ? 'surging' : 'warm',
    ...overrides,
  }
}

function renderStage(overrides: Partial<ComponentProps<typeof LiveOfficeStage>> = {}) {
  const sessions = Array.from({ length: 6 }, (_, index) => makeSession(index + 1))
  const playbackState: PlaybackState = {
    mode: 'live',
    windowHours: 6,
    selectedTimestamp: null,
    currentFrameIndex: 0,
    isPlaying: false,
    playbackRate: 1,
  }
  const officeStatus: PublicOfficeStatus = {
    connected: true,
    status: 'connected',
    displayed: sessions.length,
    running: 2,
    lastUpdatedAt: '2026-03-14T12:00:00Z',
  }
  const history: PulseSample[] = [
    { timestamp: 1_000, displayed: 3, running: 1 },
    { timestamp: 2_000, displayed: 5, running: 2 },
  ]

  const props: ComponentProps<typeof LiveOfficeStage> = {
    officeState: {} as any,
    panRef: { current: { x: 0, y: 0 } },
    zoom: 3,
    onZoomChange: vi.fn(),
    onAgentClick: vi.fn(),
    hoveredAgentId: 1,
    hoverPosition: { x: 720, y: 30 },
    hoveredSession: sessions[0],
    hoveredPublicId: sessions[0].publicId || null,
    hoveredToolStats: [{ label: 'Write', count: 2, color: '#f6c978' }],
    hoveredActivityPoints: [
      { timestamp: 1, score: 0.4 },
      { timestamp: 2, score: 1 },
    ],
    hoveredActiveWindow: 'live',
    onCanvasHoverChange: vi.fn(),
    connectionState: 'connected',
    backendError: null,
    officeStatus,
    sessions,
    history,
    selectedSession: sessions[0],
    selectedAgentId: 1,
    showStatusPanel: false,
    showSessionPanel: false,
    onToggleStatusPanel: vi.fn(),
    onCloseStatusPanel: vi.fn(),
    onCloseSessionPanel: vi.fn(),
    onSelectSession: vi.fn(),
    onOpenSession: vi.fn(),
    getNumericAgentId: (sessionKey: string) => Number(sessionKey.replace('pub_', '')),
    compactViewport: false,
    playbackState,
    hasReplayFrames: true,
    isLoading: false,
    replayCharacters: null,
    replayCharacterMap: null,
    tourTargetAgentId: null,
    heatmapEnabled: false,
    heatmapSources: sessions.map((session, index) => ({
      agentId: index + 1,
      zone: session.zone,
      intensity: session.signalScore,
    })),
    onToggleHeatmap: vi.fn(),
    freshness: {
      label: 'Live now',
      color: '#A6E3A1',
      detail: 'Updated just now',
    },
    scrubberMin: 1_000,
    scrubberMax: 3_000,
    scrubberValue: 2_000,
    currentFrameLabel: 'Live edge 12:00:00',
    startLabel: 'Start',
    endLabel: 'End',
    coverageLabel: 'Buffered 24h',
    autoTourPaused: true,
    previewFrames: [
      {
        id: 'frame-a',
        timestamp: 1_000,
        label: 'Window A',
        running: 1,
        displayed: 3,
        zoneLabel: 'Code Studio',
        accent: '#89B4FA',
        isCurrent: true,
        previewBars: [0.3, 0.5, 0.7],
      },
    ],
    eventMarkers: [
      { id: 'event-1', timestamp: 1_500, position: 0.5, label: '1: +1 live', tone: '#F38BA8' },
    ],
    onModeChange: vi.fn(),
    onWindowHoursChange: vi.fn(),
    onScrub: vi.fn(),
    onPlayToggle: vi.fn(),
    onJumpToLive: vi.fn(),
    onResumeTour: vi.fn(),
    onPlaybackRateChange: vi.fn(),
    onCanvasInteraction: vi.fn(),
    ...overrides,
  }

  return {
    ...render(<LiveOfficeStage {...props} />),
    props,
  }
}

describe('LiveOfficeStage', () => {
  test('renders live stage controls, hover summary, and heatmap wiring', () => {
    const { props } = renderStage()

    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText((_, node) => node?.textContent === '6 visible')).toBeInTheDocument()
    expect(screen.getByText((_, node) => node?.textContent === '3 warm')).toBeInTheDocument()
    expect(screen.getByText((_, node) => node?.textContent === '2 live')).toBeInTheDocument()
    expect(screen.getByText('heatmap:off')).toBeInTheDocument()
    expect(screen.getByText('sources:6')).toBeInTheDocument()
    expect(screen.getByText('Agent hover')).toBeInTheDocument()
    expect(screen.getByText('Live Roster')).toBeInTheDocument()
    expect(screen.getByText('+1 more in the public office')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Telemetry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume tour' }))
    fireEvent.click(screen.getByRole('button', { name: /Window A/i }))
    fireEvent.click(screen.getByRole('button', { name: /Agent 01.*Chat Lounge/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Canvas interaction' }))

    expect(props.onToggleStatusPanel).toHaveBeenCalledTimes(1)
    expect(props.onToggleHeatmap).toHaveBeenCalledTimes(1)
    expect(props.onZoomChange).toHaveBeenNthCalledWith(1, 4)
    expect(props.onZoomChange).toHaveBeenNthCalledWith(2, 2)
    expect(props.onResumeTour).toHaveBeenCalledTimes(1)
    expect(props.onScrub).toHaveBeenCalledWith(1_000)
    expect(props.onOpenSession).toHaveBeenCalledWith('pub_1')
    expect(props.onCanvasInteraction).toHaveBeenCalledTimes(1)
  })

  test('hides desktop-only chrome in compact viewports', () => {
    renderStage({
      compactViewport: true,
      hoveredAgentId: null,
      hoverPosition: null,
      hoveredSession: null,
      autoTourPaused: false,
    })

    expect(screen.queryByText('Live Roster')).not.toBeInTheDocument()
    expect(screen.queryByText(/Scrub the timeline to replay the public office/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume tour' })).not.toBeInTheDocument()
  })
})
