import { afterEach, describe, expect, test, vi } from 'vitest'

describe('ApiClient base resolution', () => {
  afterEach(() => {
    delete (window as Window & { __GHOST_SHIFT_API_BASE__?: string }).__GHOST_SHIFT_API_BASE__
    window.history.replaceState({}, '', '/')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  test('defaults to /office/api for embedded office paths', async () => {
    window.history.replaceState({}, '', '/office/embed/card')

    const { resolveAPIBase } = await import('./ApiClient.js')

    expect(resolveAPIBase()).toBe('/office/api')
  })

  test('prefers explicit global API base when present', async () => {
    ;(window as Window & { __GHOST_SHIFT_API_BASE__?: string }).__GHOST_SHIFT_API_BASE__ = 'https://example.com/custom/'

    const { resolveAPIBase } = await import('./ApiClient.js')

    expect(resolveAPIBase()).toBe('https://example.com/custom')
  })

  test('createApiClient requests against the provided base', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ connected: true, status: 'connected', displayed: 0, running: 0, lastUpdatedAt: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { createApiClient } = await import('./ApiClient.js')
    const client = createApiClient('/custom-api')
    await client.getStatus()

    expect(fetchMock).toHaveBeenCalledWith('/custom-api/status')
  })

  test('defaults to /api outside the embedded office path', async () => {
    window.history.replaceState({}, '', '/portfolio')

    const { resolveAPIBase } = await import('./ApiClient.js')

    expect(resolveAPIBase()).toBe('/api')
  })

  test('adds query parameters for timeline and replay requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response(JSON.stringify({ retentionHours: 24, intervalSeconds: 30, points: [], frames: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const { createApiClient } = await import('./ApiClient.js')
    const client = createApiClient('/custom-api')

    await client.getTimeline('2026-03-14T10:00:00Z', '2026-03-14T12:00:00Z')
    await client.getReplay(undefined, '2026-03-14T12:00:00Z')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/custom-api/public/timeline?since=2026-03-14T10%3A00%3A00Z&until=2026-03-14T12%3A00%3A00Z',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/custom-api/public/replay?until=2026-03-14T12%3A00%3A00Z',
    )
  })

  test('builds query parameters for analytics and agent detail requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const { createApiClient } = await import('./ApiClient.js')
    const client = createApiClient('/custom-api')

    await client.getAnalyticsTrends()
    await client.getZonesHeatmap('2026-03-14T10:00:00Z', '2026-03-14T12:00:00Z')
    await client.getModelsDistribution(undefined, '2026-03-14T12:00:00Z')
    await client.getAgentStats('pub/demo', '2026-03-14T10:00:00Z')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/custom-api/public/analytics/trends?hours=6',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/custom-api/public/zones/heatmap?since=2026-03-14T10%3A00%3A00Z&until=2026-03-14T12%3A00%3A00Z',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/custom-api/public/models/distribution?until=2026-03-14T12%3A00%3A00Z',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/custom-api/public/agent/pub%2Fdemo?since=2026-03-14T10%3A00%3A00Z',
    )
  })

  test('throws a descriptive error for non-OK responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }))

    const { createApiClient } = await import('./ApiClient.js')
    const client = createApiClient('/custom-api')

    await expect(client.getSnapshot()).rejects.toThrow('API request failed: 503')
  })
})
