import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App.tsx'
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
  window.history.replaceState({}, '', '/live')
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

    await screen.findByText((_, node) => node?.textContent === '5 visible')
    expect(screen.getByText('Updated just now')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    fireEvent.change(screen.getByRole('slider'), {
      target: { value: String(Date.parse(history.replay.frames[0].capturedAt)) },
    })

    await screen.findByText((_, node) => node?.textContent === '2 visible')

    fireEvent.click(screen.getByRole('button', { name: 'Live' }))

    await screen.findByText((_, node) => node?.textContent === '5 visible')
    expect(screen.getByText('Updated just now')).toBeInTheDocument()
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

    await screen.findByText('Delayed')
    expect(screen.queryByRole('button', { name: 'Resume tour' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Canvas interaction' }))
    expect(screen.getByRole('button', { name: 'Resume tour' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resume tour' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Resume tour' })).not.toBeInTheDocument()
    })
  })

  test('toggles heatmap and telemetry from the live stage', async () => {
    const history = makeHistory([2, 4, 5])
    installFetchMock({
      snapshots: makeSnapshot(5),
      timeline: history.timeline,
      replay: history.replay,
    })

    render(<App />)

    await screen.findByText((_, node) => node?.textContent === '5 visible')
    expect(screen.getByTestId('heatmap-state')).toHaveTextContent('heatmap:off:5')

    fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }))
    expect(screen.getByTestId('heatmap-state')).toHaveTextContent('heatmap:on:5')

    fireEvent.click(screen.getByRole('button', { name: 'Telemetry' }))
    expect(await screen.findByText('Office Telemetry')).toBeInTheDocument()
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

    await screen.findByText('Offline')
    expect(screen.getAllByText('API unavailable').length).toBeGreaterThan(0)
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

    await screen.findByText((_, node) => node?.textContent === '4 visible')
    expect(screen.queryByText('Live Roster')).not.toBeInTheDocument()
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

    await screen.findByText((_, node) => node?.textContent === `${count} visible`)

    if (count > 5) {
      expect(screen.getByText(`+${count - 5} more in the public office`)).toBeInTheDocument()
    } else {
      expect(screen.queryByText(/more in the public office/)).not.toBeInTheDocument()
    }
  })
})
