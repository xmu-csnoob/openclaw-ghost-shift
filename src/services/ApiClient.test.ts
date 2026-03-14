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
})
