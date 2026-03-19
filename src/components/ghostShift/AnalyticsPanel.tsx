import { MiniSparkline } from '../MiniSparkline.js'
import { i18n } from '../../content/i18n/index.js'
import { getIntlLocale, useLocale, useT } from '../../content/locale.js'
import { getZoneColor, getZoneLabel } from '../../publicDisplay.js'
import type {
  PublicAnalyticsCompareResponse,
  PublicAnalyticsTrendsResponse,
  PublicMetricsLive,
  PublicModelsDistributionResponse,
  PublicOfficeStatus,
  PublicZonesHeatmapResponse,
} from '../../services/types.js'
import './AnalyticsPanel.css'
import { Panel } from './Panel.js'

interface AnalyticsPanelProps {
  metricsLive: PublicMetricsLive | null
  trends: PublicAnalyticsTrendsResponse | null
  compare: PublicAnalyticsCompareResponse | null
  zonesHeatmap: PublicZonesHeatmapResponse | null
  modelsDistribution: PublicModelsDistributionResponse | null
  gatewayStatus: PublicOfficeStatus | null
  sessionCount: number
  loading: boolean
  error?: string | null
}

function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value)
}

function formatSignedNumber(value: number, locale: string, maximumFractionDigits: number = 1): string {
  const formatter = new Intl.NumberFormat(locale, {
    signDisplay: 'exceptZero',
    maximumFractionDigits,
  })
  return formatter.format(value)
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatLatency(ms: number, locale: string): string {
  if (ms >= 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: ms >= 10_000 ? 0 : 1 }).format(ms / 1000)}s`
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(ms)}ms`
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return '-'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '-'
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function getStatusTone(status: string): string {
  switch (status) {
    case 'running':
      return '#ef4444'
    case 'idle':
      return '#ff6b35'
    case 'connected':
      return '#f59e0b'
    default:
      return '#d4a574'
  }
}

function getStatusLabel(status: string, tt: AnalyticsPanelTranslate): string {
  if (status === 'running') return tt(i18n.agent.status.running)
  if (status === 'idle') return tt(i18n.agent.status.idle)
  return status
}

function getDeltaArrow(value: number): string {
  if (value > 0) return '↑'
  if (value < 0) return '↓'
  return '→'
}

function getGradientFill(color: string): string {
  return `linear-gradient(90deg, ${color} 0%, ${color}cc 55%, rgba(255, 255, 255, 0.96) 100%)`
}

type AnalyticsPanelTranslate = ReturnType<typeof useT>

export function AnalyticsPanel({
  metricsLive,
  trends,
  compare,
  zonesHeatmap,
  modelsDistribution,
  gatewayStatus,
  sessionCount,
  loading,
  error = null,
}: AnalyticsPanelProps) {
  const locale = useLocale()
  const tt = useT()
  const intlLocale = getIntlLocale(locale)
  const latestTrendPoint = trends?.points[trends.points.length - 1] ?? null
  const trendSummary = trends?.summary
  const modelEntries = modelsDistribution?.models ?? []
  const heatmapZones = zonesHeatmap?.zones ?? []
  const realtimeStats = [
    {
      key: 'tps',
      label: tt(i18n.analytics.realtime.tps),
      value: typeof metricsLive?.tps === 'number' ? metricsLive.tps.toFixed(1) : '--',
      intensity: typeof metricsLive?.tps === 'number' ? Math.min(1, metricsLive.tps / 20) : 0,
    },
    {
      key: 'online-agents',
      label: tt(i18n.analytics.realtime.onlineAgents),
      value: typeof metricsLive?.onlineAgents === 'number' ? formatCompactNumber(metricsLive.onlineAgents, intlLocale) : '--',
      intensity: typeof metricsLive?.onlineAgents === 'number' ? Math.min(1, metricsLive.onlineAgents / 24) : 0,
    },
    {
      key: 'average-load',
      label: tt(i18n.analytics.realtime.averageLoad),
      value: typeof metricsLive?.averageLoad === 'number' ? formatPercent(metricsLive.averageLoad, intlLocale) : '--',
      intensity: typeof metricsLive?.averageLoad === 'number' ? Math.min(1, metricsLive.averageLoad) : 0,
    },
  ]
  const trendCards = [
    {
      key: 'online-agents',
      label: tt(i18n.analytics.trends.onlineAgents),
      value: latestTrendPoint?.onlineAgents ?? metricsLive?.onlineAgents ?? 0,
      delta: trendSummary?.onlineAgentsDelta ?? 0,
      values: trends?.points.map((point) => point.onlineAgents) ?? [],
      accent: '#ef4444',
      fill: 'rgba(239, 68, 68, 0.14)',
    },
    {
      key: 'messages',
      label: tt(i18n.analytics.trends.messageCount),
      value: latestTrendPoint?.messageCount ?? 0,
      delta: trendSummary?.messageCountDelta ?? 0,
      values: trends?.points.map((point) => point.messageCount) ?? [],
      accent: '#ff6b35',
      fill: 'rgba(255, 107, 53, 0.14)',
    },
    {
      key: 'tokens',
      label: tt(i18n.analytics.trends.tokenCount),
      value: latestTrendPoint?.totalTokens ?? 0,
      delta: trendSummary?.totalTokensDelta ?? 0,
      values: trends?.points.map((point) => point.totalTokens) ?? [],
      accent: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.16)',
    },
  ]
  const compareCards = compare?.today && compare?.yesterday && compare?.delta
    ? [
        {
          key: 'avg-online-agents',
          label: tt(i18n.analytics.compare.avgOnlineAgents),
          today: compare.today.avgOnlineAgents.toFixed(2),
          yesterday: compare.yesterday.avgOnlineAgents.toFixed(2),
          rawDelta: compare.delta.avgOnlineAgents,
          delta: formatSignedNumber(compare.delta.avgOnlineAgents, intlLocale, 2),
        },
        {
          key: 'avg-running-agents',
          label: tt(i18n.analytics.compare.avgRunningAgents),
          today: compare.today.avgRunningAgents.toFixed(2),
          yesterday: compare.yesterday.avgRunningAgents.toFixed(2),
          rawDelta: compare.delta.avgRunningAgents,
          delta: formatSignedNumber(compare.delta.avgRunningAgents, intlLocale, 2),
        },
        {
          key: 'messages',
          label: tt(i18n.analytics.compare.messageCount),
          today: formatCompactNumber(compare.today.messageCountDelta, intlLocale),
          yesterday: formatCompactNumber(compare.yesterday.messageCountDelta, intlLocale),
          rawDelta: compare.delta.messageCountDelta,
          delta: formatSignedNumber(compare.delta.messageCountDelta, intlLocale, 0),
        },
        {
          key: 'tools',
          label: tt(i18n.analytics.compare.toolCalls),
          today: formatCompactNumber(compare.today.toolCallCount, intlLocale),
          yesterday: formatCompactNumber(compare.yesterday.toolCallCount, intlLocale),
          rawDelta: compare.delta.toolCallCount,
          delta: formatSignedNumber(compare.delta.toolCallCount, intlLocale, 0),
        },
        {
          key: 'tokens',
          label: tt(i18n.analytics.compare.tokenCount),
          today: formatCompactNumber(compare.today.totalTokensDelta, intlLocale),
          yesterday: formatCompactNumber(compare.yesterday.totalTokensDelta, intlLocale),
          rawDelta: compare.delta.totalTokensDelta,
          delta: formatSignedNumber(compare.delta.totalTokensDelta, intlLocale, 0),
        },
        {
          key: 'response-time',
          label: tt(i18n.analytics.compare.avgResponseTime),
          today: formatLatency(compare.today.avgResponseTime, intlLocale),
          yesterday: formatLatency(compare.yesterday.avgResponseTime, intlLocale),
          rawDelta: compare.delta.avgResponseTime,
          delta: formatSignedNumber(compare.delta.avgResponseTime, intlLocale, 0),
        },
      ]
    : []
  return (
    <div className="gs-analytics-stack">
      <Panel
        className="gs-analytics-panel"
        eyebrow={tt(i18n.analytics.realtime.eyebrow)}
        title={tt(i18n.analytics.realtime.title)}
        subtitle={
          metricsLive
            ? `${tt(i18n.analytics.realtime.updatedAt)} ${formatDate(metricsLive.updatedAt, intlLocale)}`
            : error || (loading ? tt(i18n.common.loading) : tt(i18n.common.noData))
        }
      >
        <div className="gs-analytics-strip">
          {realtimeStats.map((stat) => (
            <div key={stat.key} className={`gs-analytics-stat ${loading && !metricsLive ? 'is-skeleton' : ''}`}>
              <span>{stat.label}</span>
              {loading && !metricsLive ? (
                <span className="gs-skeleton gs-analytics-skeleton-line gs-analytics-skeleton-line--value" />
              ) : (
                <strong>{stat.value}</strong>
              )}
              <div className="gs-analytics-stat__meter" aria-hidden="true">
                <div className="gs-analytics-stat__meter-fill" style={{ width: `${Math.max(10, stat.intensity * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="gs-analytics-inline-meta">
          <div className="gs-analytics-inline-meta__item">
            <span>{tt(i18n.analytics.realtime.gatewayStatus)}</span>
            {loading && !gatewayStatus ? (
              <span className="gs-skeleton gs-analytics-skeleton-line" />
            ) : (
              <strong className={gatewayStatus?.connected ? 'is-positive' : 'is-negative'}>
                {gatewayStatus?.connected ? tt(i18n.status.connected) : tt(i18n.status.disconnected)}
              </strong>
            )}
          </div>
          <div className="gs-analytics-inline-meta__item">
            <span>{tt(i18n.analytics.realtime.gatewayAgents)}</span>
            {loading && !gatewayStatus ? (
              <span className="gs-skeleton gs-analytics-skeleton-line" />
            ) : (
              <strong>
                {gatewayStatus
                  ? `${formatCompactNumber(gatewayStatus.displayed, intlLocale)} / ${formatCompactNumber(gatewayStatus.running, intlLocale)}`
                  : '--'}
              </strong>
            )}
          </div>
          <div className="gs-analytics-inline-meta__item">
            <span>{tt(i18n.analytics.realtime.sessionInventory)}</span>
            {loading && sessionCount === 0 ? (
              <span className="gs-skeleton gs-analytics-skeleton-line" />
            ) : (
              <strong>{formatCompactNumber(sessionCount, intlLocale)}</strong>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        className="gs-analytics-panel"
        eyebrow={tt(i18n.analytics.compare.eyebrow)}
        title={tt(i18n.analytics.compare.title)}
        subtitle={
          compare
            ? `${tt(i18n.analytics.compare.meta)} ${compare.timezone} • ${formatDate(compare.comparedAt, intlLocale)}`
            : loading
              ? tt(i18n.common.loading)
              : tt(i18n.common.noData)
        }
      >
        {compareCards.length > 0 ? (
          <div className="gs-analytics-compare-grid">
            {compareCards.map((card) => {
              const deltaTone = card.rawDelta > 0 ? 'is-positive' : card.rawDelta < 0 ? 'is-negative' : ''
              return (
                <article key={card.key} className="gs-analytics-compare-card">
                  <span className="gs-analytics-compare-card__label">{card.label}</span>
                  <strong className="gs-analytics-compare-card__primary">{card.today}</strong>
                  <div className="gs-analytics-compare-card__meta">
                    <span>{tt(i18n.analytics.compare.yesterdayShort)} {card.yesterday}</span>
                    <span className={['gs-analytics-delta', deltaTone].filter(Boolean).join(' ')}>
                      <span className="gs-analytics-compare-card__delta-icon" aria-hidden="true">
                        {getDeltaArrow(card.rawDelta)}
                      </span>
                      {tt(i18n.analytics.compare.deltaShort)} {card.delta}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        ) : loading ? (
          <div className="gs-analytics-skeleton-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`compare-skeleton-${index}`} className="gs-analytics-skeleton-card">
                <div className="gs-skeleton gs-analytics-skeleton-line" />
                <div className="gs-skeleton gs-analytics-skeleton-line gs-analytics-skeleton-line--value" />
                <div className="gs-skeleton gs-analytics-skeleton-line" />
              </div>
            ))}
          </div>
        ) : (
          <div className="gs-analytics-empty">{tt(i18n.common.noData)}</div>
        )}
      </Panel>

      <Panel
        className="gs-analytics-panel"
        eyebrow={tt(i18n.analytics.trends.eyebrow)}
        title={tt(i18n.analytics.trends.title)}
        subtitle={
          trends
            ? `${formatDate(trends.since, intlLocale)} → ${formatDate(trends.until, intlLocale)} • ${trendSummary?.sampleCount ?? 0} ${tt(i18n.analytics.trends.samples)}`
            : loading
              ? tt(i18n.common.loading)
              : tt(i18n.common.noData)
        }
      >
        {trendCards.some((card) => card.values.length > 0) ? (
          <div className="gs-analytics-trend-grid">
            {trendCards.map((card) => (
              <article key={card.key} className="gs-analytics-trend-card">
                <div className="gs-analytics-trend-card__head">
                  <span>{card.label}</span>
                  <strong>{formatCompactNumber(card.value, intlLocale)}</strong>
                </div>
                <div
                  className="gs-analytics-trend-card__chart"
                  data-tooltip={`${card.label}: ${formatCompactNumber(card.value, intlLocale)}`}
                  title={`${card.label}: ${formatCompactNumber(card.value, intlLocale)}`}
                >
                  <MiniSparkline values={card.values} stroke={card.accent} fill={card.fill} height={48} />
                </div>
                <div className="gs-analytics-trend-card__delta">
                  <span>{tt(i18n.analytics.compare.deltaShort)}</span>
                  <strong className={['gs-analytics-delta', card.delta > 0 ? 'is-positive' : card.delta < 0 ? 'is-negative' : ''].filter(Boolean).join(' ')}>
                    <span className="gs-analytics-compare-card__delta-icon" aria-hidden="true">
                      {getDeltaArrow(card.delta)}
                    </span>
                    {formatSignedNumber(card.delta, intlLocale, 0)}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        ) : loading ? (
          <div className="gs-analytics-skeleton-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`trend-skeleton-${index}`} className="gs-analytics-skeleton-card">
                <div className="gs-skeleton gs-analytics-skeleton-line" />
                <div className="gs-skeleton gs-analytics-skeleton-block" />
                <div className="gs-skeleton gs-analytics-skeleton-line" />
              </div>
            ))}
          </div>
        ) : (
          <div className="gs-analytics-empty">{tt(i18n.common.noData)}</div>
        )}
      </Panel>

      <Panel
        className="gs-analytics-panel"
        eyebrow={tt(i18n.analytics.models.eyebrow)}
        title={tt(i18n.analytics.models.title)}
        subtitle={tt(i18n.analytics.models.subtitle)}
      >
        {modelEntries.length ? (
          <div className="gs-analytics-list">
            {modelEntries.map((entry) => (
              <article key={entry.model} className="gs-analytics-list__row">
                <div className="gs-analytics-list__head">
                  <div>
                    <strong>{entry.model}</strong>
                    <span>{formatPercent(entry.share, intlLocale)}</span>
                  </div>
                  <div className="gs-analytics-list__meta">
                    <span>{formatCompactNumber(entry.agentCount, intlLocale)} {tt(i18n.analytics.models.agents)}</span>
                    <span>{formatLatency(entry.avgResponseTime, intlLocale)}</span>
                  </div>
                </div>
                <div className="gs-analytics-bar">
                  <div className="gs-analytics-bar__fill" style={{ width: `${Math.max(6, entry.share * 100)}%` }} />
                </div>
                <div className="gs-analytics-list__foot">
                  <span>{formatCompactNumber(entry.sampleCount, intlLocale)} {tt(i18n.analytics.models.samples)}</span>
                  <span>{entry.throughputTokensPerMinute.toFixed(1)} TPM</span>
                  <span>{tt(i18n.analytics.models.load)} {formatPercent(entry.avgLoad, intlLocale)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : loading ? (
          <div className="gs-analytics-skeleton-grid gs-analytics-skeleton-grid--stack">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`model-skeleton-${index}`} className="gs-analytics-skeleton-card">
                <div className="gs-skeleton gs-analytics-skeleton-line" />
                <div className="gs-skeleton gs-analytics-skeleton-line" />
                <div className="gs-skeleton gs-analytics-skeleton-block gs-analytics-skeleton-block--thin" />
              </div>
            ))}
          </div>
        ) : (
          <div className="gs-analytics-empty">{tt(i18n.common.noData)}</div>
        )}
      </Panel>

      <Panel
        className="gs-analytics-panel"
        eyebrow={tt(i18n.analytics.zones.eyebrow)}
        title={tt(i18n.analytics.zones.title)}
        subtitle={
          zonesHeatmap
            ? `${tt(i18n.analytics.zones.capturedAt)} ${formatDate(zonesHeatmap.capturedAt, intlLocale)}`
            : loading
              ? tt(i18n.common.loading)
              : tt(i18n.common.noData)
        }
      >
        {heatmapZones.length ? (
          <div className="gs-analytics-zone-grid">
            {heatmapZones.map((zone) => (
              <article key={zone.zone} className="gs-analytics-zone-card">
                <div className="gs-analytics-zone-card__head">
                  <div>
                    <strong>{getZoneLabel(zone.zone)}</strong>
                    <span>{formatCompactNumber(zone.agentCount, intlLocale)} {tt(i18n.analytics.zones.agents)}</span>
                  </div>
                  <strong style={{ color: getZoneColor(zone.zone) }}>
                    {formatPercent(zone.activityScore, intlLocale)}
                  </strong>
                </div>
                <div className="gs-analytics-bar gs-analytics-bar--zone">
                  <div
                    className="gs-analytics-bar__fill"
                    style={{
                      width: `${Math.max(8, Math.min(zone.activityScore * 100, 100))}%`,
                      background: getGradientFill(getZoneColor(zone.zone)),
                    }}
                  />
                </div>
                <div className="gs-analytics-zone-card__mix">
                  {zone.statusDistribution.map((status) => (
                    <span
                      key={`${zone.zone}-${status.status}`}
                      className="gs-analytics-zone-card__pill"
                      style={{ borderColor: `${getStatusTone(status.status)}55`, color: getStatusTone(status.status) }}
                    >
                      {getStatusLabel(status.status, tt)} {status.count}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : loading ? (
          <div className="gs-analytics-skeleton-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`zone-skeleton-${index}`} className="gs-analytics-skeleton-card">
                <div className="gs-skeleton gs-analytics-skeleton-line" />
                <div className="gs-skeleton gs-analytics-skeleton-block gs-analytics-skeleton-block--thin" />
                <div className="gs-skeleton gs-analytics-skeleton-line" />
              </div>
            ))}
          </div>
        ) : (
          <div className="gs-analytics-empty">{tt(i18n.common.noData)}</div>
        )}
      </Panel>
    </div>
  )
}
