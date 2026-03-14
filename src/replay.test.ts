import { describe, expect, test } from 'vitest'
import {
  clampReplayWindow,
  cloneCharacter,
  cloneSessions,
  findClosestFrameIndex,
  formatPlaybackBoundary,
  formatPlaybackTimestamp,
  formatRelativeAge,
  getPlaybackWindowMs,
  getPlaybackFreshness,
  replayFramesToTimeline,
  type ReplayFrame,
} from './replay.js'

function makeFrame(timestamp: number, displayed: number, running: number): ReplayFrame {
  return {
    timestamp,
    status: {
      connected: true,
      status: 'connected',
      displayed,
      running,
      lastUpdatedAt: new Date(timestamp).toISOString(),
    },
    sessions: [],
    characters: [],
  }
}

describe('replay helpers', () => {
  test('clampReplayWindow keeps only recent entries', () => {
    const frames = [
      makeFrame(1_000, 1, 1),
      makeFrame(3_000, 2, 1),
      makeFrame(5_000, 3, 2),
    ]

    expect(clampReplayWindow(frames, 1_500)).toEqual([frames[2]])
    expect(clampReplayWindow(frames, 2_500)).toEqual([frames[1], frames[2]])
  })

  test('findClosestFrameIndex chooses the nearest frame', () => {
    const frames = [
      makeFrame(1_000, 1, 1),
      makeFrame(4_000, 2, 1),
      makeFrame(8_000, 3, 2),
    ]

    expect(findClosestFrameIndex(frames, 900)).toBe(0)
    expect(findClosestFrameIndex(frames, 4_500)).toBe(1)
    expect(findClosestFrameIndex(frames, 7_900)).toBe(2)
  })

  test('returns -1 when no replay frames exist', () => {
    expect(findClosestFrameIndex([], 1_000)).toBe(-1)
  })

  test('getPlaybackFreshness returns expected tones', () => {
    const now = Date.parse('2026-03-14T12:00:00Z')

    expect(getPlaybackFreshness(now, now)).toMatchObject({ label: 'Live now', color: '#A6E3A1' })
    expect(getPlaybackFreshness(now - 30_000, now)).toMatchObject({ label: 'Fresh', color: '#89B4FA' })
    expect(getPlaybackFreshness(now - 10 * 60_000, now)).toMatchObject({ label: 'Cooling', color: '#F9E2AF' })
    expect(getPlaybackFreshness(now - 60 * 60_000, now)).toMatchObject({ label: 'Replay', color: '#F38BA8' })
  })

  test('replayFramesToTimeline mirrors replay status counts', () => {
    const frames = [
      makeFrame(1_000, 2, 1),
      makeFrame(2_000, 5, 3),
    ]

    expect(replayFramesToTimeline(frames)).toEqual([
      { timestamp: 1_000, displayed: 2, running: 1, connected: true },
      { timestamp: 2_000, displayed: 5, running: 3, connected: true },
    ])
  })

  test('formatRelativeAge stays readable for seconds and hours', () => {
    expect(formatRelativeAge(3_000)).toBe('just now')
    expect(formatRelativeAge(25_000)).toBe('25s ago')
    expect(formatRelativeAge(2 * 60 * 60_000)).toBe('2h ago')
  })

  test('clones sessions and characters without sharing nested references', () => {
    const sessions = [{ sessionKey: 'pub_1', signalScore: 0.9 } as any]
    const characters = [{
      id: 1,
      path: [{ x: 1, y: 2 }],
      matrixEffectSeeds: [4, 5],
    } as any]

    const clonedSessions = cloneSessions(sessions)
    const clonedCharacter = cloneCharacter(characters[0])

    expect(clonedSessions).toEqual(sessions)
    expect(clonedSessions[0]).not.toBe(sessions[0])
    expect(clonedCharacter).toEqual(characters[0])
    expect(clonedCharacter.path).not.toBe(characters[0].path)
    expect(clonedCharacter.matrixEffectSeeds).not.toBe(characters[0].matrixEffectSeeds)
  })

  test('exposes basic playback window and formatting helpers', () => {
    const timestamp = Date.parse('2026-03-14T12:00:00Z')

    expect(getPlaybackWindowMs(1)).toBe(60 * 60 * 1000)
    expect(getPlaybackWindowMs(24)).toBe(24 * 60 * 60 * 1000)
    expect(formatPlaybackTimestamp(timestamp)).toMatch(/\d/)
    expect(formatPlaybackBoundary(timestamp)).toMatch(/\d/)
  })
})
