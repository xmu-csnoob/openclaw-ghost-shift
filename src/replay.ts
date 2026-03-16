import type { DisplaySession, PulseSample } from './publicDisplay.js'
import type { Character } from './office/types.js'
import type { PublicOfficeStatus } from './services/types.js'

export type PlaybackMode = 'live' | 'replay'
export type PlaybackWindowHours = 1 | 6 | 24

export interface TimelinePoint extends PulseSample {
  connected: boolean
}

export interface ReplayFrame {
  timestamp: number
  status: PublicOfficeStatus
  sessions: DisplaySession[]
  characters: Character[]
}

export interface PlaybackState {
  mode: PlaybackMode
  windowHours: PlaybackWindowHours
  selectedTimestamp: number | null
  currentFrameIndex: number
  isPlaying: boolean
  playbackRate: 0.5 | 1 | 2
}

export const REPLAY_RETENTION_MS = 24 * 60 * 60 * 1000

export function cloneCharacter(character: Character): Character {
  return {
    ...character,
    path: character.path.map((step) => ({ ...step })),
    matrixEffectSeeds: [...character.matrixEffectSeeds],
  }
}

export function cloneSessions(sessions: DisplaySession[]): DisplaySession[] {
  return sessions.map((session) => ({ ...session }))
}

export function clampReplayWindow<T extends { timestamp: number }>(
  entries: T[],
  maxAgeMs: number = REPLAY_RETENTION_MS,
): T[] {
  if (entries.length <= 1) return entries
  const cutoff = entries[entries.length - 1].timestamp - maxAgeMs
  return entries.filter((entry) => entry.timestamp >= cutoff)
}

export function getPlaybackWindowMs(hours: PlaybackWindowHours): number {
  return hours * 60 * 60 * 1000
}

export function findClosestFrameIndex(frames: ReplayFrame[], timestamp: number): number {
  if (frames.length === 0) return -1

  let closestIndex = 0
  let closestDistance = Math.abs(frames[0].timestamp - timestamp)
  for (let index = 1; index < frames.length; index += 1) {
    const distance = Math.abs(frames[index].timestamp - timestamp)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  }

  return closestIndex
}

export function formatPlaybackTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

export function formatPlaybackBoundary(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function formatRelativeAge(ms: number): string {
  if (ms < 5_000) return 'just now'
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s ago`
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m ago`
  return `${Math.round(ms / (60 * 60_000))}h ago`
}

export function getPlaybackFreshness(timestamp: number, now: number = Date.now()): {
  label: string
  color: string
  detail: string
} {
  const age = Math.max(0, now - timestamp)

  if (age < 15_000) {
    return {
      label: '实时',
      color: '#22c55e',
      detail: '公开办公室正在追踪最新心跳',
    }
  }
  if (age < 2 * 60_000) {
    return {
      label: '新鲜',
      color: '#14b8a6',
      detail: `${formatRelativeAge(age)}前捕获`,
    }
  }
  if (age < 30 * 60_000) {
    return {
      label: '冷却中',
      color: '#f59e0b',
      detail: `在保留窗口中查看 ${formatRelativeAge(age)} 的记录`,
    }
  }
  return {
    label: '回放',
    color: '#ff5c5c',
    detail: `正在查看 ${formatRelativeAge(age)} 的历史帧`,
  }
}

export function replayFramesToTimeline(frames: ReplayFrame[]): TimelinePoint[] {
  return frames.map((frame) => ({
    timestamp: frame.timestamp,
    displayed: frame.status.displayed,
    running: frame.status.running,
    connected: frame.status.connected,
  }))
}
