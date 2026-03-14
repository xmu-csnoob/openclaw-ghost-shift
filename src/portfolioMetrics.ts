import type { DisplaySession } from './publicDisplay.js'
import type { TimelinePoint } from './replay.js'

export interface HistoryMeta {
  intervalSeconds: number
  retentionHours: number
}

export interface TrendSummary {
  deltaRatio: number
  direction: 'up' | 'down' | 'flat'
  latestValue: number
  peakValue: number
  averageValue: number
}

export interface HourCompareBucket {
  hour: number
  today: number
  yesterday: number
}

export interface TodayVsYesterdaySummary {
  buckets: HourCompareBucket[]
  todayAverage: number
  yesterdayAverage: number
  todayPeak: number
  yesterdayPeak: number
  partialYesterday: boolean
}

export interface TopAgentEntry {
  sessionKey: string
  label: string
  zone: string
  status: string
  signalScore: number
  signalWindow: string
}

export function clampRecentTimeline(points: TimelinePoint[], hours: number, now: number = Date.now()): TimelinePoint[] {
  const cutoff = now - (hours * 60 * 60 * 1000)
  return points.filter((point) => point.timestamp >= cutoff)
}

export function computeTrendSummary(values: number[]): TrendSummary {
  if (values.length === 0) {
    return {
      deltaRatio: 0,
      direction: 'flat',
      latestValue: 0,
      peakValue: 0,
      averageValue: 0,
    }
  }

  const midpoint = Math.max(1, Math.floor(values.length / 2))
  const firstHalf = values.slice(0, midpoint)
  const secondHalf = values.slice(midpoint)
  const baseline = average(firstHalf)
  const recent = average(secondHalf.length > 0 ? secondHalf : firstHalf)
  const deltaRatio = baseline <= 0 ? (recent > 0 ? 1 : 0) : (recent - baseline) / baseline

  return {
    deltaRatio,
    direction: Math.abs(deltaRatio) < 0.04 ? 'flat' : deltaRatio > 0 ? 'up' : 'down',
    latestValue: values[values.length - 1],
    peakValue: Math.max(...values),
    averageValue: average(values),
  }
}

export function computeUptimeStats(points: TimelinePoint[], meta: HistoryMeta | null): {
  ratio: number
  label: string
} {
  if (points.length === 0) {
    return {
      ratio: 0,
      label: meta ? `0h / ${meta.retentionHours}h` : 'No history',
    }
  }

  const connectedSamples = points.filter((point) => point.connected).length
  const ratio = connectedSamples / points.length
  const intervalSeconds = meta?.intervalSeconds || estimateIntervalSeconds(points)
  const uptimeHours = (connectedSamples * intervalSeconds) / 3600
  const windowHours = meta?.retentionHours || Math.max(1, Math.round((points[points.length - 1].timestamp - points[0].timestamp) / 3_600_000))

  return {
    ratio,
    label: `${formatHours(uptimeHours)} / ${windowHours}h`,
  }
}

export function computeTodayVsYesterday(points: TimelinePoint[], now: number = Date.now()): TodayVsYesterdaySummary {
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const startTodayMs = startToday.getTime()
  const startYesterdayMs = startTodayMs - (24 * 60 * 60 * 1000)

  const todayBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, values: [] as number[] }))
  const yesterdayBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, values: [] as number[] }))

  for (const point of points) {
    const pointDate = new Date(point.timestamp)
    const hour = pointDate.getHours()
    if (point.timestamp >= startTodayMs && point.timestamp <= now) {
      todayBuckets[hour].values.push(point.running)
    } else if (point.timestamp >= startYesterdayMs && point.timestamp < startTodayMs) {
      yesterdayBuckets[hour].values.push(point.running)
    }
  }

  const buckets = todayBuckets.map((bucket, index) => ({
    hour: bucket.hour,
    today: average(bucket.values),
    yesterday: average(yesterdayBuckets[index].values),
  }))

  const todayValues = buckets.map((bucket) => bucket.today).filter((value) => value > 0)
  const yesterdayValues = buckets.map((bucket) => bucket.yesterday).filter((value) => value > 0)
  const earliestTimestamp = points[0]?.timestamp ?? now

  return {
    buckets,
    todayAverage: average(todayValues),
    yesterdayAverage: average(yesterdayValues),
    todayPeak: todayValues.length > 0 ? Math.max(...todayValues) : 0,
    yesterdayPeak: yesterdayValues.length > 0 ? Math.max(...yesterdayValues) : 0,
    partialYesterday: earliestTimestamp > startYesterdayMs,
  }
}

export function getTopAgentEntries(
  sessions: DisplaySession[],
  getLabel: (session: DisplaySession) => string,
  limit = 5,
): TopAgentEntry[] {
  return sessions
    .slice()
    .sort((a, b) => {
      if ((b.status === 'running') !== (a.status === 'running')) {
        return b.status === 'running' ? -1 : 1
      }
      if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore
      return getLabel(a).localeCompare(getLabel(b))
    })
    .slice(0, limit)
    .map((session) => ({
      sessionKey: session.sessionKey,
      label: getLabel(session),
      zone: session.zone,
      status: session.status || 'idle',
      signalScore: session.signalScore,
      signalWindow: session.signalWindow,
    }))
}

export function formatDelta(deltaRatio: number): string {
  const sign = deltaRatio > 0 ? '+' : ''
  return `${sign}${Math.round(deltaRatio * 100)}%`
}

export function formatHours(hours: number): string {
  if (hours >= 10) return `${Math.round(hours)}h`
  return `${hours.toFixed(1)}h`
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function estimateIntervalSeconds(points: TimelinePoint[]): number {
  if (points.length < 2) return 30
  const deltas = points
    .slice(1)
    .map((point, index) => Math.max(1, Math.round((point.timestamp - points[index].timestamp) / 1000)))
  return Math.max(1, Math.round(average(deltas)))
}
