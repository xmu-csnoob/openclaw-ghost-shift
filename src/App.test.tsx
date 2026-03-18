import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App.tsx'
import { setLocale } from './content/locale.js'
import type {
  AgentSession,
  PublicOfficeSnapshot,
  PublicReplayResponse,
  PublicTimelineResponse,
} from './services/types.js'

vi.mock('./office/components/OfficeCanvas.js', () => ({
  OfficeCanvas: ({
    onUserInteraction,
    heatmapEnabled,
    heatmapSources,
  }: {
    onUserInteraction?: () => void
    heatmapEnabled?: boolean
    heatmapSources?: Array<{ agentId: number; zone: string; intensity: number }>
  }) => (
    <div data-testid="office-canvas">
      <div data-testid="heatmap-state">
        {heatmapEnabled ? 'heatmap:on' : 'heatmap:off'}:{heatmapSources?.length ?? 0}
      </div>
      <button type="button" onClick={() => onUserInteraction?.()}>
        Canvas interaction
      </button>
    </div>
  ),
}))

const FIXED_NOW = Date.parse('2026-03-14T12:00:00Z')

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeSessions(count: number, runningCount: number = Math.min(count, Math.max(1, Math.floor(count / 2)))): AgentSession[] {
  return Array.from({ length: count }, (_, index) => ({
    publicId: `pub_${index + 1}`,
    sessionKey: `pub_${index + 1}`,
    agentId: `Agent ${String(index + 1).padStart(2, '0')}`,
    model: 'gpt-4.1',
    status: index < runningCount ? 'running' : 'idle',
    zone: index % 3 === 0 ? 'code-studio' : index % 3 === 1 ? 'chat-lounge' : 'ops-lab',
    role: index % 3 === 1 ? 'webchat' : 'coding-agent',
    origin: index % 3 === 1 ? 'Feishu' : 'Workspace CLI',
    activityScore: index < runningCount ? 0.92 : 0.48,
    activityWindow: index < runningCount ? 'live' : '10m',
    footprint: index < runningCount ? 'working-set' : 'fresh-thread',
  }))
}

function makeSnapshot(
  count: number,
  options: { runningCount?: number; updatedAt?: string } = {},
): PublicOfficeSnapshot {
  const updatedAt = options.updatedAt ?? new Date(FIXED_NOW).toISOString()
  const runningCount = options.runningCount ?? Math.min(count, Math.max(1, Math.floor(count / 2)))

  return {
    status: {
      connected: true,
      status: 'connected',
      displayed: count,
      running: runningCount,
      lastUpdatedAt: updatedAt,
    },
    sessions: makeSessions(count, runningCount),
  }
}

function makeHistory(counts: number[]): { timeline: PublicTimelineResponse; replay: PublicReplayResponse } {
  const frames = counts.map((count, index) => {
    const timestamp = FIXED_NOW - (counts.length - index - 1) * 60_000
    const snapshot = makeSnapshot(count, {
      updatedAt: new Date(timestamp).toISOString(),
    })

    return {
      capturedAt: snapshot.status.lastUpdatedAt,
      status: snapshot.status,
      sessions: snapshot.sessions,
    }
  })

  return {
    timeline: {
      retentionHours: 24,
      intervalSeconds: 30,
      points: frames.map((frame) => ({
        capturedAt: frame.capturedAt,
        connected: frame.status.connected,
        status: frame.status.status,
        displayed: frame.status.displayed,
        running: frame.status.running,
      })),
    },
    replay: {
      retentionHours: 24,
      intervalSeconds: 30,
      frames,
    },
  }
}

function installFetchMock({
  snapshots,
  timeline,
  replay,
}: {
  snapshots: PublicOfficeSnapshot | PublicOfficeSnapshot[]
  timeline?: PublicTimelineResponse
  replay?: PublicReplayResponse
}) {
  const snapshotQueue = Array.isArray(snapshots) ? [...snapshots] : [snapshots]

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)

    if (url.includes('/public/snapshot')) {
      const nextSnapshot = snapshotQueue.length > 1 ? snapshotQueue.shift()! : snapshotQueue[0]
      return jsonResponse(nextSnapshot)
    }
    if (url.includes('/public/timeline')) {
      return jsonResponse(
        timeline ?? {
          retentionHours: 24,
          intervalSeconds: 30,
          points: [],
        },
      )
    }
    if (url.includes('/public/replay')) {
      return jsonResponse(
        replay ?? {
          retentionHours: 24,
          intervalSeconds: 30,
          frames: [],
        },
      )
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })
}

beforeEach(() => {
  setLocale('en')
  window.history.replaceState({}, '', '/replay')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App replay controls', () => {
  test('supports live and replay toggles with timeline scrubbing', async () => {
    const history = makeHistory([2, 4, 5])
    installFetchMock({
      snapshots: makeSnapshot(5),
      timeline: history.timeline,
      replay: history.replay,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(/5 visible/i)
    })

    // Click Replay button to switch to replay mode
    const replayButtons = screen.getAllByRole('button', { name: 'Replay' })
    fireEvent.click(replayButtons[0])

    // Scrub to the first frame (2 sessions)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, {
      target: { value: String(Date.parse(history.replay.frames[0].capturedAt)) },
    })

    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(/2 visible/i)
    })

    // Switch back to Live mode
    const liveButtons = screen.getAllByRole('button', { name: 'Live' })
    fireEvent.click(liveButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(/5 visible/i)
    })
  })

  test('shows delayed freshness and pauses then resumes auto-tour after canvas interaction', async () => {
    const delayedSnapshot = makeSnapshot(3, {
      updatedAt: new Date(FIXED_NOW - 30_000).toISOString(),
    })
    const history = makeHistory([1, 3])

    installFetchMock({
      snapshots: delayedSnapshot,
      timeline: history.timeline,
      replay: history.replay,
    })

    render(<App />)

    // Wait for the component to load and show sessions
    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(/3 visible/i)
    })

    // First, switch to Live mode (the page starts in Replay mode)
    const liveButtons = screen.getAllByRole('button', { name: 'Live' })
    fireEvent.click(liveButtons[0])

    // Wait to be in live mode (freshness label should show "Delayed" for 30s old data)
    await waitFor(() => {
      expect(screen.getByTestId('workspace-freshness-label')).toHaveTextContent('Delayed')
    })

    // Click canvas interaction button to pause the auto-tour
    const canvasInteractionButton = screen.getByRole('button', { name: 'Canvas interaction' })
    fireEvent.click(canvasInteractionButton)

    // After canvas interaction in live mode, auto-tour should be paused
    // Check for Continue tour button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue tour/i })).toBeInTheDocument()
    })

    // Click Continue tour to resume
    fireEvent.click(screen.getByRole('button', { name: /continue tour/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /continue tour/i })).not.toBeInTheDocument()
    })
  })

  test('toggles heatmap and telemetry from the replay stage', async () => {
    const history = makeHistory([2, 4, 5])
    installFetchMock({
      snapshots: makeSnapshot(5),
      timeline: history.timeline,
      replay: history.replay,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(/5 visible/i)
    })
    // Verify heatmap is initially off (mock displays heatmap state)
    expect(screen.getByTestId('heatmap-state')).toHaveTextContent('heatmap:off:5')

    // Click Heatmap button to enable heatmap
    fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }))
    expect(screen.getByTestId('heatmap-state')).toHaveTextContent('heatmap:on:5')

    // Click Telemetry button to open the status panel
    fireEvent.click(screen.getByRole('button', { name: 'Telemetry' }))
    // Verify telemetry panel is visible by checking for its content
    expect(await screen.findByText(/office telemetry/i)).toBeInTheDocument()
  })

  test('falls back to the offline state when the snapshot API is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/public/snapshot')) {
        throw new Error('snapshot unavailable')
      }
      return jsonResponse({
        retentionHours: 24,
        intervalSeconds: 30,
        points: [],
        frames: [],
      })
    })

    render(<App />)

    // The replay page starts in Replay mode, so first switch to Live mode
    // to test the offline state. There are multiple Live buttons (header and replay bar).
    await waitFor(() => {
      const liveButtons = screen.getAllByRole('button', { name: 'Live' })
      expect(liveButtons.length).toBeGreaterThan(0)
    })

    const liveButtons = screen.getAllByRole('button', { name: 'Live' })
    fireEvent.click(liveButtons[0])

    // Wait for offline state to be reflected in the freshness label
    await waitFor(() => {
      expect(screen.getByTestId('workspace-freshness-label')).toHaveTextContent('Offline')
    })
    // Check for offline detail message (shows "API unavailable" when fetch fails)
    expect(screen.getByTestId('workspace-freshness-detail')).toHaveTextContent(/API unavailable/i)
  })

  test('switches to the compact mobile layout on narrow viewports', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const history = makeHistory([3, 4])
    installFetchMock({
      snapshots: makeSnapshot(4),
      timeline: history.timeline,
      replay: history.replay,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(/4 visible/i)
    })
    // On compact viewport, the sidebar is hidden by default
    // Live Roster should not be visible when sidebar is closed
    expect(screen.queryByText('Live Roster')).not.toBeInTheDocument()
    // Help text for scrubbing should be hidden on compact viewport
    expect(screen.queryByText(/Scrub the timeline to replay the public office/i)).not.toBeInTheDocument()
  })
})

describe.each([0, 5, 20, 100, 250])('App integration at %i sessions', (count) => {
  test('renders the public office scenario without collapsing', async () => {
    const history = makeHistory([count])
    installFetchMock({
      snapshots: makeSnapshot(count, { runningCount: Math.min(count, 5) }),
      timeline: history.timeline,
      replay: history.replay,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('stage-visible-count')).toHaveTextContent(new RegExp(`${count} visible`, 'i'))
    })

    // On the replay page with full presentation, when there are more than 5 sessions,
    // the roster shows first 5 plus a "more" message
    if (count > 5) {
      expect(screen.getByText(new RegExp(`${count - 5} more in the public office`, 'i'))).toBeInTheDocument()
    } else {
      expect(screen.queryByText(/more in the public office/)).not.toBeInTheDocument()
    }
  })
})
