import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ProductDashboard } from './ProductDashboard.tsx'
import type { DisplaySession } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'

const DISPLAY_TIMESTAMP = Date.parse('2026-03-14T12:00:00Z')

function makeSession(overrides: Partial<DisplaySession> = {}): DisplaySession {
  return {
    publicId: 'pub_1',
    sessionKey: 'pub_1',
    agentId: 'Agent 01',
    model: 'gpt-4.1',
    status: 'running',
    zone: 'code-studio',
    role: 'coding-agent',
    origin: 'Workspace CLI',
    activityScore: 1,
    activityWindow: 'live',
    footprint: 'working-set',
    modelFamily: 'GPT',
    observedSince: DISPLAY_TIMESTAMP - 120_000,
    lastChangedAt: DISPLAY_TIMESTAMP - 30_000,
    signalScore: 1,
    signalWindow: 'live',
    footprintLabel: 'Working Set',
    sampleCount: 8,
    activityBand: 'surging',
    ...overrides,
  }
}

describe('ProductDashboard', () => {
  test('renders dashboard metrics and the compare chart with partial retention notice', () => {
    const timeline: TimelinePoint[] = [
      {
        timestamp: Date.parse('2026-03-14T08:00:00Z'),
        displayed: 2,
        running: 1,
        connected: true,
      },
      {
        timestamp: Date.parse('2026-03-14T09:00:00Z'),
        displayed: 3,
        running: 2,
        connected: true,
      },
      {
        timestamp: Date.parse('2026-03-14T10:00:00Z'),
        displayed: 5,
        running: 3,
        connected: true,
      },
      {
        timestamp: Date.parse('2026-03-14T11:00:00Z'),
        displayed: 6,
        running: 4,
        connected: true,
      },
    ]

    const sessions = [
      makeSession(),
      makeSession({
        publicId: 'pub_2',
        sessionKey: 'pub_2',
        agentId: 'Agent 02',
        status: 'idle',
        zone: 'chat-lounge',
        role: 'webchat',
        origin: 'Feishu',
        activityScore: 0.4,
        signalScore: 0.4,
        signalWindow: '10m',
        activityBand: 'warm',
      }),
    ]

    const { container } = render(
      <ProductDashboard
        status={{
          connected: true,
          status: 'connected',
          displayed: 5,
          running: 2,
          lastUpdatedAt: new Date(DISPLAY_TIMESTAMP).toISOString(),
        }}
        sessions={sessions}
        timeline={timeline}
        historyMeta={{ intervalSeconds: 30, retentionHours: 12 }}
        displayTimestamp={DISPLAY_TIMESTAMP}
      />,
    )

    expect(screen.getByRole('region', { name: 'Product dashboard' })).toBeInTheDocument()
    expect(
      screen.getByText('Live metrics, comparison baselines, and lightweight forecasting in one narrative layer.'),
    ).toBeInTheDocument()
    const statValues = Array.from(container.querySelectorAll('.gs-dashboard-card--stat strong')).map((node) => node.textContent)
    expect(statValues).toEqual(['5', '2', '0.0h / 12h'])
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('Yesterday is partial because retention is limited')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Comparison chart' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Linear forecast' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Radar chart' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Scatter plot' })).toBeInTheDocument()
    expect(container.querySelectorAll('.gs-dashboard-compare__bucket')).toHaveLength(24)
  })

  test('falls back gracefully when no sessions or history are available', () => {
    const { container } = render(
      <ProductDashboard
        status={null}
        sessions={[]}
        timeline={[]}
        historyMeta={null}
        displayTimestamp={DISPLAY_TIMESTAMP}
      />,
    )

    // When no data, the dashboard still renders but with zero values
    expect(screen.getByRole('region', { name: 'Product dashboard' })).toBeInTheDocument()
    const statValues = Array.from(container.querySelectorAll('.gs-dashboard-card--stat strong')).map((node) => node.textContent)
    expect(statValues).toEqual(['0', '0', 'No history'])
    expect(screen.getByText('24h', { selector: 'strong' })).toBeInTheDocument() // retention period
  })
})
