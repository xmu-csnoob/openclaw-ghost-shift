import type { DisplaySession } from '../publicDisplay.js'
import { formatRatio } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import {
  clampRecentTimeline,
  computeTodayVsYesterday,
  computeTrendSummary,
  computeUptimeStats,
  formatDelta,
  type HistoryMeta,
} from '../portfolioMetrics.js'
import { MiniSparkline } from './MiniSparkline.js'

export interface ProductDashboardProps {
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  timeline: TimelinePoint[]
  historyMeta: HistoryMeta | null
  displayTimestamp: number
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(timestamp)
}

export function ProductDashboard({
  status,
  sessions,
  timeline,
  historyMeta,
  displayTimestamp,
}: ProductDashboardProps) {
  const recentTimeline = clampRecentTimeline(timeline, 24, displayTimestamp)
  const comparisonTimeline = clampRecentTimeline(timeline, 48, displayTimestamp)
  const runningTrend = computeTrendSummary(recentTimeline.map((point) => point.running))
  const visibleTrend = computeTrendSummary(recentTimeline.map((point) => point.displayed))
  const uptime = computeUptimeStats(recentTimeline, historyMeta)
  const comparison = computeTodayVsYesterday(comparisonTimeline, displayTimestamp)
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const peakLoad = recentTimeline.length > 0 ? Math.max(...recentTimeline.map((point) => point.displayed)) : 0
  const maxBar = Math.max(
    1,
    ...comparison.buckets.map((bucket) => Math.max(bucket.today, bucket.yesterday)),
  )

  return (
    <section className="gs-dashboard-section" aria-label="Product dashboard">
      <div className="gs-dashboard-head">
        <div>
          <span className="gs-section-kicker">Statistics Dashboard</span>
          <h2>Realtime metrics with 24h context.</h2>
        </div>
        <p>
          A compact analytics layer for the product surface: live counts, uptime posture, recent trend direction, and a
          today-vs-yesterday comparison that stays readable on mobile.
        </p>
      </div>

      <div className="gs-dashboard-grid">
        <article className="gs-dashboard-card gs-dashboard-card--stat">
          <span className="gs-dashboard-card__label">Agents</span>
          <strong>{status?.displayed ?? sessions.length}</strong>
          <span className="gs-dashboard-card__meta">public aliases visible right now</span>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--stat">
          <span className="gs-dashboard-card__label">Sessions</span>
          <strong>{status?.running ?? sessions.filter((session) => session.status === 'running').length}</strong>
          <span className="gs-dashboard-card__meta">currently running in the public office</span>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--stat">
          <span className="gs-dashboard-card__label">Uptime</span>
          <strong>{uptime.label}</strong>
          <span className="gs-dashboard-card__meta">{formatRatio(uptime.ratio)} connected in the retained window</span>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--trend">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">24h live trend</span>
            <strong className={runningTrend.direction === 'down' ? 'is-down' : runningTrend.direction === 'up' ? 'is-up' : ''}>
              {formatDelta(runningTrend.deltaRatio)}
            </strong>
          </div>
          <MiniSparkline
            values={recentTimeline.map((point) => point.running)}
            stroke="#7db3ff"
            fill="rgba(125, 179, 255, 0.14)"
          />
          <div className="gs-dashboard-card__meta">peak {runningTrend.peakValue.toFixed(0)} live agents in the last 24h</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">Realtime signal</span>
            <strong>{formatRatio(averageSignal)}</strong>
          </div>
          <div className="gs-dashboard-card__meta">average signal score across visible agents</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">Visible load</span>
            <strong>{peakLoad.toFixed(0)}</strong>
          </div>
          <div className="gs-dashboard-card__meta">
            {formatDelta(visibleTrend.deltaRatio)} vs the earlier half of the 24h window
          </div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">Freshness</span>
            <strong>{formatTimestamp(displayTimestamp)}</strong>
          </div>
          <div className="gs-dashboard-card__meta">current frame timestamp for the displayed surface</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">Retention</span>
            <strong>{historyMeta ? `${historyMeta.retentionHours}h` : '24h'}</strong>
          </div>
          <div className="gs-dashboard-card__meta">history buffer used for replay, trends, and comparisons</div>
        </article>
      </div>

      <article className="gs-dashboard-compare">
        <div className="gs-dashboard-compare__head">
          <div>
            <span className="gs-dashboard-card__label">Today vs yesterday</span>
            <h3>Running-agent compare chart</h3>
          </div>
          <div className="gs-dashboard-compare__summary">
            <span>Today avg {comparison.todayAverage.toFixed(1)}</span>
            <span>Yesterday avg {comparison.yesterdayAverage.toFixed(1)}</span>
            {comparison.partialYesterday ? <span>Yesterday is partial because retention is limited</span> : null}
          </div>
        </div>

        <div className="gs-dashboard-compare__chart" role="img" aria-label="Today versus yesterday running agent comparison chart">
          {comparison.buckets.map((bucket) => (
            <div className="gs-dashboard-compare__bucket" key={bucket.hour}>
              <div className="gs-dashboard-compare__bars">
                <span
                  className="gs-dashboard-compare__bar gs-dashboard-compare__bar--today"
                  style={{ height: `${(bucket.today / maxBar) * 100}%` }}
                  title={`Today ${bucket.hour}:00 - ${bucket.today.toFixed(1)}`}
                />
                <span
                  className="gs-dashboard-compare__bar gs-dashboard-compare__bar--yesterday"
                  style={{ height: `${(bucket.yesterday / maxBar) * 100}%` }}
                  title={`Yesterday ${bucket.hour}:00 - ${bucket.yesterday.toFixed(1)}`}
                />
              </div>
              <span className="gs-dashboard-compare__label">{bucket.hour}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
