import type { DisplaySession } from '../publicDisplay.js'
import { formatRatio, getZoneColor, summarizeModelMix, summarizeZones } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import {
  clampRecentTimeline,
  computeLinearForecast,
  computeTodayVsYesterday,
  computeTrendSummary,
  computeUptimeStats,
  computeWindowComparison,
  formatDelta,
  type HistoryMeta,
} from '../portfolioMetrics.js'
import { MiniSparkline } from './MiniSparkline.js'
import { i18n } from '../content/i18n.js'

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
  const runningWindowComparison = computeWindowComparison(comparisonTimeline, displayTimestamp, 6, 'running')
  const visibleWindowComparison = computeWindowComparison(comparisonTimeline, displayTimestamp, 6, 'displayed')
  const forecast = computeLinearForecast(recentTimeline, 'running', 14, 6)
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const peakLoad = recentTimeline.length > 0 ? Math.max(...recentTimeline.map((point) => point.displayed)) : 0
  const zoneMix = summarizeZones(sessions)
  const modelMix = summarizeModelMix(sessions)
  const topZone = zoneMix[0]
  const activeShare = (status?.displayed ?? sessions.length) > 0
    ? (status?.running ?? sessions.filter((session) => session.status === 'running').length) / Math.max(status?.displayed ?? sessions.length, 1)
    : 0
  const concentration = topZone ? topZone.count / Math.max(sessions.length, 1) : 0
  const sameHourDelta =
    comparison.yesterdayAverage <= 0
      ? (comparison.todayAverage > 0 ? 1 : 0)
      : (comparison.todayAverage - comparison.yesterdayAverage) / comparison.yesterdayAverage
  const radarMetrics = [
    { label: i18n.dashboard.charts.radarChart, value: averageSignal, color: '#7db3ff' },
    { label: i18n.dashboard.metrics.realtimeSignal, value: activeShare, color: '#f6c978' },
    { label: i18n.dashboard.metrics.freshness, value: uptime.ratio, color: '#9bffb4' },
    { label: i18n.dashboard.metrics.modelDiversity, value: Math.min(1, modelMix.length / 5), color: '#ff9fb2' },
    { label: i18n.dashboard.metrics.zoneConcentration, value: Math.max(0, Math.min(1, 1 - concentration)), color: '#8fc0ff' },
    { label: i18n.dashboard.metrics.prediction, value: Math.max(0, Math.min(1, 0.3 + (forecast.confidence * 0.7))), color: '#cba6f7' },
  ]
  const scatterPoints = sessions
    .slice()
    .sort((a, b) => b.signalScore - a.signalScore)
    .slice(0, 18)
    .map((session) => ({
      label: session.agentId,
      zone: session.zone,
      xMinutes: Math.max(0, (displayTimestamp - session.lastChangedAt) / 60_000),
      ySignal: session.signalScore,
      radius: session.status === 'running' ? 7 : 5,
    }))
  const maxScatterMinutes = Math.max(1, ...scatterPoints.map((point) => point.xMinutes))
  const maxBar = Math.max(
    1,
    ...comparison.buckets.map((bucket) => Math.max(bucket.today, bucket.yesterday)),
  )

  return (
    <section className="gs-dashboard-section" aria-label="Product dashboard">
      <div className="gs-dashboard-head">
        <div>
          <span className="gs-section-kicker">{i18n.dashboard.title}</span>
          <h2>{i18n.dashboard.subtitle}</h2>
        </div>
        <p>
          {i18n.dashboard.description}
        </p>
      </div>

      <div className="gs-dashboard-grid">
        <article className="gs-dashboard-card gs-dashboard-card--stat">
          <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.agents}</span>
          <strong>{status?.displayed ?? sessions.length}</strong>
          <span className="gs-dashboard-card__meta">{i18n.dashboard.meta.publicAliasesVisible}</span>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--stat">
          <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.sessions}</span>
          <strong>{status?.running ?? sessions.filter((session) => session.status === 'running').length}</strong>
          <span className="gs-dashboard-card__meta">{i18n.dashboard.meta.currentlyRunning}</span>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--stat">
          <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.uptime}</span>
          <strong>{uptime.label}</strong>
          <span className="gs-dashboard-card__meta">{formatRatio(uptime.ratio)} {i18n.dashboard.meta.connectedInRetainedWindow}</span>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--trend">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.liveTrend}</span>
            <strong className={runningTrend.direction === 'down' ? 'is-down' : runningTrend.direction === 'up' ? 'is-up' : ''}>
              {formatDelta(runningTrend.deltaRatio)}
            </strong>
          </div>
          <MiniSparkline
            values={recentTimeline.map((point) => point.running)}
            stroke="#7db3ff"
            fill="rgba(125, 179, 255, 0.14)"
          />
          <div className="gs-dashboard-card__meta">{i18n.dashboard.meta.peakLiveAgents}</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.realtimeSignal}</span>
            <strong>{formatRatio(averageSignal)}</strong>
          </div>
          <div className="gs-dashboard-card__meta">{i18n.dashboard.meta.averageSignalAcrossAgents}</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.visibleLoad}</span>
            <strong>{peakLoad.toFixed(0)}</strong>
          </div>
          <div className="gs-dashboard-card__meta">
            {formatDelta(visibleTrend.deltaRatio)} {i18n.dashboard.meta.vsEarlierHalf}
          </div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.rollingDelta}</span>
            <strong className={runningWindowComparison.deltaRatio < 0 ? 'is-down' : runningWindowComparison.deltaRatio > 0 ? 'is-up' : ''}>
              {formatDelta(runningWindowComparison.deltaRatio)}
            </strong>
          </div>
          <div className="gs-dashboard-card__meta">
            {runningWindowComparison.currentAverage.toFixed(1)} {i18n.dashboard.meta.avgNowVsPrevious}
          </div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.sameHourBaseline}</span>
            <strong className={sameHourDelta < 0 ? 'is-down' : sameHourDelta > 0 ? 'is-up' : ''}>
              {formatDelta(sameHourDelta)}
            </strong>
          </div>
          <div className="gs-dashboard-card__meta">
            {i18n.dashboard.meta.todayVsYesterday}
          </div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.prediction}</span>
            <strong className={forecast.deltaRatio < 0 ? 'is-down' : forecast.deltaRatio > 0 ? 'is-up' : ''}>
              {formatDelta(forecast.deltaRatio)}
            </strong>
          </div>
          <div className="gs-dashboard-card__meta">
            {i18n.dashboard.meta.nextProjection}
          </div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.zoneConcentration}</span>
            <strong>{topZone ? formatRatio(topZone.count / Math.max(sessions.length, 1)) : '0%'}</strong>
          </div>
          <div className="gs-dashboard-card__meta">
            {topZone ? `${topZone.label} ${i18n.dashboard.meta.leadsVisibleMix}` : i18n.dashboard.meta.waitingForSessions}
          </div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.modelDiversity}</span>
            <strong>{modelMix.length}</strong>
          </div>
          <div className="gs-dashboard-card__meta">{i18n.dashboard.meta.familiesVisible}</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.freshness}</span>
            <strong>{formatTimestamp(displayTimestamp)}</strong>
          </div>
          <div className="gs-dashboard-card__meta">{i18n.dashboard.meta.currentFrameTimestamp}</div>
        </article>

        <article className="gs-dashboard-card gs-dashboard-card--metric">
          <div className="gs-dashboard-card__row">
            <span className="gs-dashboard-card__label">{i18n.dashboard.metrics.retention}</span>
            <strong>{historyMeta ? `${historyMeta.retentionHours}h` : '24h'}</strong>
          </div>
          <div className="gs-dashboard-card__meta">{i18n.dashboard.meta.historyBufferUsed}</div>
        </article>
      </div>

      <div className="gs-dashboard-analytics">
        <article className="gs-dashboard-compare">
          <div className="gs-dashboard-compare__head">
            <div>
              <span className="gs-dashboard-card__label">{i18n.dashboard.charts.comparisonChart}</span>
              <h3>{i18n.dashboard.charts.todayVsYesterdayProfile}</h3>
            </div>
            <div className="gs-dashboard-compare__summary">
              <span>6h {i18n.dashboard.metrics.rollingDelta} {formatDelta(runningWindowComparison.deltaRatio)}</span>
              <span>{i18n.dashboard.metrics.visibleLoad} {formatDelta(visibleWindowComparison.deltaRatio)}</span>
              <span>{i18n.dashboard.metrics.sameHourBaseline} {formatDelta(sameHourDelta)}</span>
              {comparison.partialYesterday ? <span>{i18n.dashboard.charts.yesterdayPartial}</span> : null}
            </div>
          </div>

          <div className="gs-dashboard-compare__legend">
            <span><i className="is-today" />{i18n.dashboard.charts.today}</span>
            <span><i className="is-yesterday" />{i18n.dashboard.charts.yesterday}</span>
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

        <article className="gs-dashboard-visual gs-dashboard-visual--forecast">
          <div className="gs-dashboard-visual__head">
            <div>
              <span className="gs-dashboard-card__label">{i18n.dashboard.charts.linearForecast}</span>
              <h3>{i18n.dashboard.charts.projectedTrajectory}</h3>
            </div>
            <strong className={forecast.slope < 0 ? 'is-down' : forecast.slope > 0 ? 'is-up' : ''}>
              {forecast.projectedValue.toFixed(1)} {i18n.dashboard.charts.projected}
            </strong>
          </div>
          <svg viewBox="0 0 360 180" className="gs-dashboard-chart" role="img" aria-label="Forecast chart">
            <path className="gs-dashboard-chart__grid" d="M24 24H336 M24 78H336 M24 132H336" />
            <path className="gs-dashboard-chart__actual" d={buildSeriesPath(forecast.history, 24, 24, 312, 132, forecast)} />
            <path className="gs-dashboard-chart__forecast" d={buildForecastPath(forecast, 24, 24, 312, 132)} />
            {forecast.projection.map((point, index) => (
              <circle
                key={point.timestamp}
                className="gs-dashboard-chart__dot gs-dashboard-chart__dot--forecast"
                cx={projectPointX(index + forecast.history.length, forecast.history.length + forecast.projection.length, 24, 312)}
                cy={projectPointY(point.value, forecast, 24, 132)}
                r="3.5"
              />
            ))}
          </svg>
          <div className="gs-dashboard-card__meta">
            {i18n.dashboard.charts.forecastExplanation}
          </div>
        </article>
      </div>

      <div className="gs-dashboard-visual-grid">
        <article className="gs-dashboard-visual">
          <div className="gs-dashboard-visual__head">
            <div>
              <span className="gs-dashboard-card__label">{i18n.dashboard.charts.radarChart}</span>
              <h3>{i18n.dashboard.charts.surfaceHealthProfile}</h3>
            </div>
            <strong>{topZone?.label || i18n.dashboard.charts.noZoneLead}</strong>
          </div>
          <svg viewBox="0 0 260 240" className="gs-dashboard-radar" role="img" aria-label="Radar chart">
            {Array.from({ length: 4 }, (_, layer) => (
              <polygon
                key={layer}
                className="gs-dashboard-radar__ring"
                points={buildRadarPolygon(radarMetrics.map(() => (layer + 1) / 4), 74, 130, 112)}
              />
            ))}
            {radarMetrics.map((metric, index) => (
              <line
                key={metric.label}
                className="gs-dashboard-radar__axis"
                x1="130"
                y1="112"
                x2={polarPoint(index, radarMetrics.length, 74, 130, 112).x}
                y2={polarPoint(index, radarMetrics.length, 74, 130, 112).y}
              />
            ))}
            <polygon className="gs-dashboard-radar__shape" points={buildRadarPolygon(radarMetrics.map((metric) => metric.value), 74, 130, 112)} />
            {radarMetrics.map((metric, index) => {
              const point = polarPoint(index, radarMetrics.length, 92, 130, 112)
              return (
                <text key={metric.label} x={point.x} y={point.y} className="gs-dashboard-radar__label">
                  {metric.label}
                </text>
              )
            })}
          </svg>
          <div className="gs-dashboard-radar__legend">
            {radarMetrics.map((metric) => (
              <span key={metric.label}>
                <i style={{ background: metric.color }} />
                {metric.label} {formatRatio(metric.value)}
              </span>
            ))}
          </div>
        </article>

        <article className="gs-dashboard-visual">
          <div className="gs-dashboard-visual__head">
            <div>
              <span className="gs-dashboard-card__label">{i18n.dashboard.charts.scatterPlot}</span>
              <h3>{i18n.dashboard.charts.signalVsLatency}</h3>
            </div>
            <strong>{scatterPoints.length} {i18n.dashboard.charts.trackedAgents}</strong>
          </div>
          <svg viewBox="0 0 360 220" className="gs-dashboard-chart" role="img" aria-label="Scatter plot">
            <path className="gs-dashboard-chart__grid" d="M36 28V182 M148 28V182 M260 28V182 M36 182H332 M36 105H332 M36 28H332" />
            {scatterPoints.map((point) => (
              <circle
                key={`${point.label}-${point.zone}`}
                className="gs-dashboard-chart__dot"
                cx={36 + ((point.xMinutes / maxScatterMinutes) * 296)}
                cy={182 - (point.ySignal * 154)}
                r={point.radius}
                fill={getZoneColor(point.zone)}
              >
                <title>{`${point.label} • ${point.xMinutes.toFixed(0)}m ${i18n.dashboard.charts.minutesSinceStatusChange} • ${formatRatio(point.ySignal)}`}</title>
              </circle>
            ))}
          </svg>
          <div className="gs-dashboard-card__meta">
            X{i18n.dashboard.charts.minutesSinceStatusChange}。Y{i18n.dashboard.charts.signalScore}。
          </div>
        </article>
      </div>
    </section>
  )
}

function buildSeriesPath(
  points: Array<{ timestamp: number; value: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
  forecast: ReturnType<typeof computeLinearForecast>,
): string {
  if (points.length === 0) return ''

  const totalLength = forecast.history.length + forecast.projection.length
  return points
    .map((point, index) => {
      const px = projectPointX(index, totalLength, x, width)
      const py = projectPointY(point.value, forecast, y, height)
      return `${index === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`
    })
    .join(' ')
}

function buildForecastPath(
  forecast: ReturnType<typeof computeLinearForecast>,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  if (forecast.history.length === 0) return ''

  const totalLength = forecast.history.length + forecast.projection.length
  const firstPoint = forecast.history[forecast.history.length - 1]
  const points = [firstPoint, ...forecast.projection]

  return points
    .map((point, index) => {
      const offset = index === 0 ? forecast.history.length - 1 : forecast.history.length - 1 + index
      const px = projectPointX(offset, totalLength, x, width)
      const py = projectPointY(point.value, forecast, y, height)
      return `${index === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`
    })
    .join(' ')
}

function projectPointX(index: number, total: number, offsetX: number, width: number): number {
  if (total <= 1) return offsetX + (width / 2)
  return offsetX + ((index / (total - 1)) * width)
}

function projectPointY(
  value: number,
  forecast: ReturnType<typeof computeLinearForecast>,
  offsetY: number,
  height: number,
): number {
  const maxValue = Math.max(
    1,
    ...forecast.history.map((point) => point.value),
    ...forecast.projection.map((point) => point.value),
  )
  return offsetY + height - ((value / maxValue) * height)
}

function buildRadarPolygon(values: number[], radius: number, centerX: number, centerY: number): string {
  return values
    .map((value, index) => {
      const point = polarPoint(index, values.length, radius * value, centerX, centerY)
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
    })
    .join(' ')
}

function polarPoint(index: number, count: number, radius: number, centerX: number, centerY: number) {
  const angle = ((Math.PI * 2) / count) * index - (Math.PI / 2)
  return {
    x: centerX + (Math.cos(angle) * radius),
    y: centerY + (Math.sin(angle) * radius),
  }
}
