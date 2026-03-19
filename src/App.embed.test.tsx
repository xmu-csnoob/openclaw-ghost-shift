import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type {
  PublicOfficeSnapshot,
  PublicReplayResponse,
  PublicTimelineResponse,
} from './services/types.js'
import { setLocale } from './content/locale.js'

const FIXED_NOW = Date.parse('2026-03-14T12:00:00Z')

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeSnapshot(): PublicOfficeSnapshot {
  return {
    status: {
      connected: true,
      status: 'connected',
      displayed: 3,
      running: 2,
      lastUpdatedAt: new Date(FIXED_NOW).toISOString(),
    },
    sessions: [
      {
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
      },
    ],
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  window.history.replaceState({}, '', '/office/embed/card')
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  // Ensure locale is set to English before each test
  setLocale('en')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('renders the embed summary card and uses the /office API base on mobile paths', async () => {
  const urls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    urls.push(url)

    if (url.includes('/public/snapshot')) {
      return jsonResponse(makeSnapshot())
    }

    return jsonResponse({
      retentionHours: 24,
      intervalSeconds: 30,
      points: [],
      frames: [],
    } satisfies Partial<PublicTimelineResponse & PublicReplayResponse>)
  })

  vi.resetModules()
  // Reset modules re-import, locale, so we need to set it again
  setLocale('en')
  const { default: App } = await import('./App.tsx')

  render(<App />)

  await screen.findByText('Ghost Shift')
  expect(screen.getByText('Public office demo in a portfolio-sized Embed frame.')).toBeInTheDocument()
  expect(urls).toEqual(
    expect.arrayContaining([
      expect.stringContaining('/office/api/public/snapshot'),
      expect.stringContaining('/office/api/public/timeline'),
      expect.stringContaining('/office/api/public/replay'),
    ]),
  )
})
