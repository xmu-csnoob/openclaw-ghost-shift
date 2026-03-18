import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { AgentHoverCard } from './AgentHoverCard.js'
import type { DisplaySession } from '../publicDisplay.js'

function makeSession(overrides: Partial<DisplaySession> = {}): DisplaySession {
  return {
    publicId: 'pub_agent',
    sessionKey: 'pub_agent',
    agentId: 'Agent 07',
    model: 'gpt-4.1',
    status: 'running',
    zone: 'code-studio',
    role: 'coding-agent',
    origin: 'Workspace CLI',
    activityScore: 0.82,
    activityWindow: 'live',
    footprint: 'working-set',
    modelFamily: 'GPT',
    observedSince: Date.parse('2026-03-14T10:00:00Z'),
    lastChangedAt: Date.parse('2026-03-14T11:50:00Z'),
    signalScore: 0.82,
    signalWindow: '10m',
    footprintLabel: 'Working Set',
    sampleCount: 6,
    activityBand: 'surging',
    ...overrides,
  }
}

describe('AgentHoverCard', () => {
  test('returns null when hover state is incomplete', () => {
    const { container, rerender } = render(
      <AgentHoverCard
        visible={false}
        anchor={{ x: 100, y: 100 }}
        session={makeSession()}
        publicId="pub_agent"
        toolStats={[]}
        activityPoints={[]}
        dominantWindow="live"
      />,
    )

    expect(container.firstChild).toBeNull()

    rerender(
      <AgentHoverCard
        visible
        anchor={null}
        session={makeSession()}
        publicId="pub_agent"
        toolStats={[]}
        activityPoints={[]}
        dominantWindow="live"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders agent summary, clamps placement, and builds tool and sparkline output', async () => {
    const { container } = render(
      <AgentHoverCard
        visible
        anchor={{ x: -50, y: 40 }}
        session={makeSession({ agentId: ' ', publicId: undefined, sessionKey: 'pub_fallback' })}
        publicId={null}
        dominantWindow="just-now"
        toolStats={[
          { label: 'Read', count: 0, color: '#7db3ff' },
          { label: 'Write', count: 3, color: '#f6c978' },
        ]}
        activityPoints={[
          { timestamp: 1, score: 0 },
          { timestamp: 2, score: 0.5 },
          { timestamp: 3, score: 1 },
        ]}
      />,
    )

    const card = container.querySelector('.gs-agent-hover-card')
    expect((card as HTMLElement).style.top).toBe('84px')
    expect((card as HTMLElement).style.left).toBe('12px')

    // Check that the compact info renders correctly
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('Just now')).toBeInTheDocument()
    expect(screen.getByText('GPT')).toBeInTheDocument()
    expect(screen.getByText('Code Studio')).toBeInTheDocument()
    expect(screen.getByText('View details')).toBeInTheDocument()

    // Tool stats are only visible when expanded - click to expand
    await act(async () => {
      fireEvent.click(screen.getByText('View details'))
    })

    // After expansion, check for tool stats
    await waitFor(() => {
      const fills = Array.from(container.querySelectorAll('.gs-agent-hover-card__tool-fill'))
      expect(fills).toHaveLength(2)
      expect(fills[0]).toHaveStyle({ width: '10%' })
      expect(fills[1]).toHaveStyle({ width: '54%' })
    })

    const path = container.querySelector('path')
    expect(path).toHaveAttribute('d', 'M0.00,36.80 L88.00,20.00 L176.00,0.00')
  })
})
