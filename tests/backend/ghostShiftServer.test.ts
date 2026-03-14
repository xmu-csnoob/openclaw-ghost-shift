// @vitest-environment node

import { afterEach, describe, expect, test } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'

type FixtureSession = {
  sessionKey: string
  channel?: string
  displayName?: string
  kind?: string
  model?: string
  modelProvider?: string
  status?: string
  updatedAt?: string
  lastActiveAt?: string
  totalTokens?: number
  messageCount?: number
}

type ServerHandle = {
  baseUrl: string
  stop: () => Promise<void>
}

const activeServers: Array<() => Promise<void>> = []

function makeSession(index: number, overrides: Partial<FixtureSession> = {}): FixtureSession {
  const timestamp = new Date(Date.parse('2026-03-14T12:00:00Z') - index * 60_000).toISOString()
  return {
    sessionKey: `agent:test-${index}:workspace`,
    channel: index % 2 === 0 ? 'workspace' : 'feishu',
    displayName: `Agent ${index}`,
    kind: 'assistant',
    model: 'gpt-4.1',
    modelProvider: 'openai',
    status: index % 2 === 0 ? 'running' : 'idle',
    updatedAt: timestamp,
    lastActiveAt: timestamp,
    totalTokens: 12_000,
    messageCount: 12,
    ...overrides,
  }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('failed to resolve free port'))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function waitForServer(baseUrl: string, child: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 15_000
  let lastError: unknown

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`ghost-shift server exited early with code ${child.exitCode}`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/status`)
      if (response.ok) {
        return
      }
      lastError = new Error(`status ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw lastError instanceof Error ? lastError : new Error('ghost-shift server did not become ready')
}

async function startServer(
  fixture: {
    status?: { connected: boolean; status: string }
    frames: Array<{ sessions: FixtureSession[] }>
  },
  extraEnv: Record<string, string> = {},
): Promise<ServerHandle> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ghost-shift-vitest-'))
  const fixturePath = path.join(tempDir, 'fixture.json')
  const historyPath = path.join(tempDir, 'public-history.jsonl')
  const port = await getFreePort()

  await writeFile(fixturePath, JSON.stringify(fixture))

  const child = spawn('go', ['run', '.'], {
    cwd: path.join(process.cwd(), 'server'),
    env: {
      ...process.env,
      PORT: String(port),
      BIND_ADDR: '127.0.0.1',
      GHOST_SHIFT_FIXTURE_PATH: fixturePath,
      PUBLIC_ID_SALT: 'vitest-public-salt',
      PUBLIC_HISTORY_PATH: historyPath,
      PUBLIC_HISTORY_INTERVAL_SECONDS: '1',
      PUBLIC_HISTORY_RETENTION_HOURS: '24',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })

  const baseUrl = `http://127.0.0.1:${port}`
  try {
    await waitForServer(baseUrl, child)
  } catch (error) {
    child.kill('SIGTERM')
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`)
  }

  const stop = async () => {
    child.kill('SIGTERM')
    await new Promise((resolve) => {
      child.once('exit', resolve)
      setTimeout(resolve, 2_000)
    })
    await rm(tempDir, { recursive: true, force: true })
  }

  activeServers.push(stop)
  return { baseUrl, stop }
}

afterEach(async () => {
  await Promise.all(activeServers.splice(0, activeServers.length).map((stop) => stop()))
})

describe('Ghost Shift backend', () => {
  test('keeps public ids stable across restarts with the same salt', async () => {
    const fixture = {
      frames: [
        {
          sessions: [makeSession(1), makeSession(2)],
        },
      ],
    }

    const first = await startServer(fixture)
    const firstSnapshot = await fetch(`${first.baseUrl}/api/public/snapshot`).then((response) => response.json())
    await first.stop()

    const second = await startServer(fixture)
    const secondSnapshot = await fetch(`${second.baseUrl}/api/public/snapshot`).then((response) => response.json())

    expect(firstSnapshot.sessions.map((session: { publicId: string }) => session.publicId)).toEqual(
      secondSnapshot.sessions.map((session: { publicId: string }) => session.publicId),
    )
  })

  test('redacts private fields from the public snapshot', async () => {
    const rawSessionKey = 'agent:private-workspace:main'
    const fixture = {
      frames: [
        {
          sessions: [
            makeSession(1, {
              sessionKey: rawSessionKey,
              channel: 'workspace',
              displayName: 'Private terminal',
              kind: 'internal',
              totalTokens: 54_321,
              messageCount: 99,
            }),
          ],
        },
      ],
    }

    const server = await startServer(fixture)
    const snapshot = await fetch(`${server.baseUrl}/api/public/snapshot`).then((response) => response.json())
    const session = snapshot.sessions[0] as Record<string, unknown>

    expect(session.publicId).toMatch(/^pub_/)
    expect(session.sessionKey).toBe(session.publicId)
    expect(session.sessionKey).not.toBe(rawSessionKey)
    expect(session).not.toHaveProperty('channel')
    expect(session).not.toHaveProperty('displayName')
    expect(session).not.toHaveProperty('kind')
    expect(session).not.toHaveProperty('totalTokens')
    expect(session).not.toHaveProperty('messageCount')
  })

  test('aggregates timeline history across recorded fixture frames', async () => {
    const fixture = {
      frames: [
        { sessions: [] },
        { sessions: Array.from({ length: 5 }, (_, index) => makeSession(index + 1)) },
        { sessions: Array.from({ length: 20 }, (_, index) => makeSession(index + 1)) },
      ],
    }

    const server = await startServer(fixture)
    await new Promise((resolve) => setTimeout(resolve, 2_400))

    const timeline = await fetch(`${server.baseUrl}/api/public/timeline`).then((response) => response.json())
    const displayedCounts = timeline.points.map((point: { displayed: number }) => point.displayed)

    expect(displayedCounts.slice(0, 3)).toEqual([0, 5, 20])
  })

  test('exposes an embed-friendly CSP when allowed origins are configured', async () => {
    const server = await startServer(
      {
        frames: [{ sessions: [makeSession(1)] }],
      },
      {
        GHOST_SHIFT_EMBED_ALLOWED_ORIGINS: 'self,https://me.wenfei4288.com',
      },
    )

    const response = await fetch(`${server.baseUrl}/api/status`)

    expect(response.headers.get('x-frame-options')).toBeNull()
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self' https://me.wenfei4288.com",
    )
  })
})
