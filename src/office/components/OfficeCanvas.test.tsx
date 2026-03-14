import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { OfficeState } from '../engine/officeState.js'
import { OfficeCanvas } from './OfficeCanvas.js'

const { startGameLoopMock, renderFrameMock } = vi.hoisted(() => ({
  startGameLoopMock: vi.fn(),
  renderFrameMock: vi.fn(),
}))

vi.mock('../engine/gameLoop.js', () => ({
  startGameLoop: startGameLoopMock,
}))

vi.mock('../engine/renderer.js', () => ({
  renderFrame: renderFrameMock,
}))

function makeOfficeState(): OfficeState {
  return {
    update: vi.fn(),
    getLayout: () => ({ cols: 10, rows: 8, tileColors: [] }),
    getCharacters: () => [],
    characters: new Map(),
    tileMap: [],
    furniture: [],
    seats: new Map(),
    selectedAgentId: null,
    hoveredAgentId: null,
    hoveredTile: null,
    cameraFollowId: null,
    dismissBubble: vi.fn(),
  } as unknown as OfficeState
}

describe('OfficeCanvas heatmap overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
    renderFrameMock.mockReturnValue({ offsetX: 10, offsetY: 20 })
  })

  test('renders heatmap gradients for visible zone buckets', async () => {
    const gradient = { addColorStop: vi.fn() }
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
    }

    startGameLoopMock.mockImplementation((_canvas, callbacks) => {
      callbacks.render(ctx as unknown as CanvasRenderingContext2D)
      return vi.fn()
    })

    render(
      <OfficeCanvas
        officeState={makeOfficeState()}
        zoom={1}
        onZoomChange={vi.fn()}
        panRef={{ current: { x: 0, y: 0 } }}
        heatmapEnabled
        heatmapSources={[
          { agentId: 1, zone: 'code-studio', intensity: 1 },
          { agentId: 2, zone: 'chat-lounge', intensity: 0.4 },
          { agentId: 99, zone: 'missing', intensity: 0.7 },
        ]}
        replayCharacterMap={
          new Map([
            [1, { id: 1, x: 100, y: 50 } as any],
            [2, { id: 2, x: 300, y: 150 } as any],
          ])
        }
      />,
    )

    await waitFor(() => {
      expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2)
    })

    const firstGradientCall = ctx.createRadialGradient.mock.calls[0]
    const secondGradientCall = ctx.createRadialGradient.mock.calls[1]
    expect(firstGradientCall.slice(0, 5)).toEqual([110, 70, 0, 110, 70])
    expect(secondGradientCall.slice(0, 5)).toEqual([310, 170, 0, 310, 170])
    expect(firstGradientCall[5]).toBeGreaterThan(48)
    expect(secondGradientCall[5]).toBeGreaterThan(48)
    expect(gradient.addColorStop).toHaveBeenCalledTimes(6)
    expect(ctx.arc).toHaveBeenCalledTimes(2)
  })

  test('skips heatmap work when the overlay is disabled', async () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(),
    }

    startGameLoopMock.mockImplementation((_canvas, callbacks) => {
      callbacks.render(ctx as unknown as CanvasRenderingContext2D)
      return vi.fn()
    })

    render(
      <OfficeCanvas
        officeState={makeOfficeState()}
        zoom={1}
        onZoomChange={vi.fn()}
        panRef={{ current: { x: 0, y: 0 } }}
        heatmapEnabled={false}
        heatmapSources={[{ agentId: 1, zone: 'code-studio', intensity: 1 }]}
        replayCharacterMap={new Map([[1, { id: 1, x: 100, y: 50 } as any]])}
      />,
    )

    await waitFor(() => {
      expect(startGameLoopMock).toHaveBeenCalledTimes(1)
    })
    expect(ctx.createRadialGradient).not.toHaveBeenCalled()
  })
})
