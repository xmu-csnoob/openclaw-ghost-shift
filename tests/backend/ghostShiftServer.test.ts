// @vitest-environment node

import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'vitest'

type RawSession = {
  sessionKey: string
  channel?: string
  displayName?: string
  kind?: string
  model?: string
  status?: string
  updatedAt?: string
  lastActiveAt?: string
  createdAt?: string
  totalTokens?: number
  messageCount?: number
}

type PublicStatus = {
  connected: boolean
  status: string
  displayed: number
  running: number
  lastUpdatedAt: string
}

type HistoryFrame = {
  capturedAt: string
  status: PublicStatus
}

function derivePublicIdentity(sessionKey: string, salt: string): { publicId: string; agentId: string } {
  const encoded = createHmac('sha256', salt).update(sessionKey).digest('hex').slice(0, 20)
  return {
    publicId: `pub_${encoded}`,
    agentId: `Agent ${encoded.slice(-6).toUpperCase()}`,
  }
}

function sanitizePublicSession(session: RawSession, salt: string) {
  const identity = derivePublicIdentity(session.sessionKey, salt)
  return {
    publicId: identity.publicId,
    sessionKey: identity.publicId,
    agentId: identity.agentId,
    status: session.status ?? 'idle',
    model: session.model,
  }
}

function buildTimelinePoints(frames: HistoryFrame[], since?: string, until?: string) {
  const sinceMs = since ? Date.parse(since) : Number.NEGATIVE_INFINITY
  const untilMs = until ? Date.parse(until) : Number.POSITIVE_INFINITY

  return frames
    .filter((frame) => {
      const timestamp = Date.parse(frame.capturedAt)
      return timestamp >= sinceMs && timestamp <= untilMs
    })
    .map((frame) => ({
      capturedAt: frame.capturedAt,
      connected: frame.status.connected,
      status: frame.status.status,
      displayed: frame.status.displayed,
      running: frame.status.running,
    }))
}

describe('Ghost Shift backend contract', () => {
  test('public ids remain stable across restarts when the salt is unchanged', () => {
    const salt = 'vitest-public-salt'
    const sessionKey = 'agent:ghost-shift:workspace'

    const first = derivePublicIdentity(sessionKey, salt)
    const second = derivePublicIdentity(sessionKey, salt)

    expect(first).toEqual(second)
    expect(first.publicId).toMatch(/^pub_[a-f0-9]{20}$/)
    expect(first.agentId).toMatch(/^Agent [A-F0-9]{6}$/)
  })

  test('public snapshot fields stay privacy-safe and do not leak raw identifiers', () => {
    const rawSession: RawSession = {
      sessionKey: 'agent:private-workspace:main',
      channel: 'workspace',
      displayName: 'Sensitive terminal',
      kind: 'internal',
      model: 'gpt-4.1',
      status: 'running',
      totalTokens: 54_321,
      messageCount: 99,
    }

    const session = sanitizePublicSession(rawSession, 'vitest-public-salt') as Record<string, unknown>

    expect(session.publicId).toMatch(/^pub_/)
    expect(session.sessionKey).toBe(session.publicId)
    expect(session.sessionKey).not.toBe(rawSession.sessionKey)
    expect(session).not.toHaveProperty('channel')
    expect(session).not.toHaveProperty('displayName')
    expect(session).not.toHaveProperty('kind')
    expect(session).not.toHaveProperty('totalTokens')
    expect(session).not.toHaveProperty('messageCount')
  })

  test('timeline aggregation preserves counts and filters by the requested window', () => {
    const frames: HistoryFrame[] = [
      {
        capturedAt: '2026-03-14T11:58:00Z',
        status: { connected: true, status: 'connected', displayed: 0, running: 0, lastUpdatedAt: '2026-03-14T11:58:00Z' },
      },
      {
        capturedAt: '2026-03-14T11:59:00Z',
        status: { connected: true, status: 'connected', displayed: 5, running: 2, lastUpdatedAt: '2026-03-14T11:59:00Z' },
      },
      {
        capturedAt: '2026-03-14T12:00:00Z',
        status: { connected: true, status: 'connected', displayed: 20, running: 8, lastUpdatedAt: '2026-03-14T12:00:00Z' },
      },
    ]

    const points = buildTimelinePoints(frames, '2026-03-14T11:59:00Z', '2026-03-14T12:00:00Z')

    expect(points).toEqual([
      {
        capturedAt: '2026-03-14T11:59:00Z',
        connected: true,
        status: 'connected',
        displayed: 5,
        running: 2,
      },
      {
        capturedAt: '2026-03-14T12:00:00Z',
        connected: true,
        status: 'connected',
        displayed: 20,
        running: 8,
      },
    ])
  })
})
