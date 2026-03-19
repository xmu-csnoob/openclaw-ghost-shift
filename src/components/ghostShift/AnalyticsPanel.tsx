import { MiniSparkline } from '../MiniSparkline.js'
import { i18n } from '../../content/i18n.js'
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
  const trendCards = [
    {
      key: 'online-agents',
      label: tt(i18n.analytics.trends.onlineAgents),
      value: latestTrendPoint?.onlineAgents ?? metricsLive?.onlineAgents ?? 0,
      delta: trends?.summary.onlineAgentsDelta ?? 0,
      values: trends?.points.map((point) => point.onlineAgents) ?? [],
      accent: '#ef4444',
      fill: 'rgba(239, 68, 68, 0.14)',
    },
    {
      key: 'messages',
      label: tt(i18n.analytics.trends.messageCount),
      value: latestTrendPoint?.messageCount ?? 0,
      delta: trends?.summary.messageCountDelta ?? 0,
      values: trends?.points.map((point) => point.messageCount) ?? [],
      accent: '#ff6b35',
      fill: 'rgba(255, 107, 53, 0.14)',
    },
    {
      key: 'tokens',
      label: tt(i18n.analytics.trends.tokenCount),
      value: latestTrendPoint?.totalTokens ?? 0,
      delta: trends?.summary.totalTokensDelta ?? 0,
      values: trends?.points.map((point) => point.totalTokens) ?? [],
      accent: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.16)',
    },
  ]
  const compareCards = compare
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
          <div className="gs-analytics-stat">
            <span>{tt(i18n.analytics.realtime.tps)}</span>
            <strong>{metricsLive ? metricsLive.tps.toFixed(1) : '--'}</strong>
          </div>
          <div className="gs-analytics-stat">
            <span>{tt(i18n.analytics.realtime.onlineAgents)}</span>
            <strong>{metricsLive ? formatCompactNumber(metricsLive.onlineAgents, intlLocale) : '--'}</strong>
          </div>
          <div className="gs-analytics-stat">
            <span>{tt(i18n.analytics.realtime.averageLoad)}</span>
            <strong>{metricsLive ? formatPercent(metricsLive.averageLoad, intlLocale) : '--'}</strong>
          </div>
        </div>

        <div className="gs-analytics-inline-meta">
          <div className="gs-analytics-inline-meta__item">
            <span>{tt(i18n.analytics.realtime.gatewayStatus)}</span>
            <strong className={gatewayStatus?.connected ? 'is-positive' : 'is-negative'}>
              {gatewayStatus?.connected ? tt(i18n.status.connected) : tt(i18n.status.disconnected)}
            </strong>
          </div>
          <div className="gs-analytics-inline-meta__item">
            <span>{tt(i18n.analytics.realtime.gatewayAgents)}</span>
            <strong>
              {gatewayStatus
                ? `${formatCompactNumber(gatewayStatus.displayed, intlLocale)} / ${formatCompactNumber(gatewayStatus.running, intlLocale)}`
                : '--'}
            </strong>
          </div>
          <div className="gs-analytics-inline-meta__item">
            <span>{tt(i18n.analytics.realtime.sessionInventory)}</span>
            <strong>{formatCompactNumber(sessionCount, intlLocale)}</strong>
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
              return (
                <article key={card.key} className="gs-analytics-compare-card">
                  <span className="gs-analytics-compare-card__label">{card.label}</span>
                  <strong className="gs-analytics-compare-card__primary">{card.today}</strong>
                  <div className="gs-analytics-compare-card__meta">
                    <span>{tt(i18n.analytics.compare.yesterdayShort)} {card.yesterday}</span>
                    <span className={card.rawDelta >= 0 ? 'is-positive' : 'is-negative'}>
                      {tt(i18n.analytics.compare.deltaShort)} {card.delta}
                    </span>
                  </div>
                </article>
              )
            })}
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
            ? `${formatDate(trends.since, intlLocale)} → ${formatDate(trends.until, intlLocale)} • ${trends.summary.sampleCount} ${tt(i18n.analytics.trends.samples)}`
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
                <MiniSparkline values={card.values} stroke={card.accent} fill={card.fill} height={48} />
                <div className="gs-analytics-trend-card__delta">
                  <span>{tt(i18n.analytics.compare.deltaShort)}</span>
                  <strong className={card.delta >= 0 ? 'is-positive' : 'is-negative'}>
                    {formatSignedNumber(card.delta, intlLocale, 0)}
                  </strong>
                </div>
              </article>
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
        {modelsDistribution?.models.length ? (
          <div className="gs-analytics-list">
            {modelsDistribution.models.map((entry) => (
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
        {zonesHeatmap?.zones.length ? (
          <div className="gs-analytics-zone-grid">
            {zonesHeatmap.zones.map((zone) => (
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
                      background: getZoneColor(zone.zone),
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
        ) : (
          <div className="gs-analytics-empty">{tt(i18n.common.noData)}</div>
        )}
      </Panel>
    </div>
  )
}
