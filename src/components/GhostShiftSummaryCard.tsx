import { useEffect, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import {
  formatRatio,
  getPublicAgentLabel,
  getSignalWindowLabel,
  getZoneColor,
  getZoneLabel,
  summarizeModelMix,
  summarizeZones,
} from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import { clampRecentTimeline, computeTrendSummary, formatDelta, getTopAgentEntries } from '../portfolioMetrics.js'
import { MiniSparkline } from './MiniSparkline.js'
import { i18n } from '../content/i18n/index.js'
import { getIntlLocale, useT } from '../content/locale.js'
import { getStatusLabel } from '../publicDisplay.js'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface GhostShiftSummaryCardProps {
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  timeline: TimelinePoint[]
  connectionState: ConnectionState
  backendError: string | null
  refreshMs: number
  liveDemoHref?: string
  variant?: 'feature' | 'embed'
  defaultCollapsed?: boolean
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(getIntlLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function GhostShiftSummaryCard({
  status,
  sessions,
  timeline,
  connectionState,
  backendError,
  refreshMs,
  liveDemoHref,
  variant = 'feature',
  defaultCollapsed = false,
}: GhostShiftSummaryCardProps) {
  const tt = useT()
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('gs-summary-card-collapsed')
    return stored !== null ? stored === 'true' : defaultCollapsed
  })

  const handleToggleCollapse = () => {
    const newValue = !collapsed
    setCollapsed(newValue)
    localStorage.setItem('gs-summary-card-collapsed', String(newValue))
  }

  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const activeWingCount = summarizeZones(sessions).length
  const topWing = summarizeZones(sessions)[0]?.label || tt(i18n.summaryCard.facts.waitingForPublicTraffic)
  const topModelFamily = summarizeModelMix(sessions)[0]?.label || tt(i18n.agent.model.hidden)
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const recentTimeline = clampRecentTimeline(timeline, 24)
  const trend = computeTrendSummary(recentTimeline.map((point) => point.running))
  const displayedTrend = computeTrendSummary(recentTimeline.map((point) => point.displayed))
  const topAgents = getTopAgentEntries(sessions, (session) => getPublicAgentLabel(session.agentId), 5)
  const activeAgent = topAgents[activeAgentIndex] || null
  const statusLabel = backendError
    ? tt(i18n.summaryCard.snapshotUnavailable)
    : connectionState === 'connected'
      ? tt(i18n.summaryCard.liveSnapshot)
      : connectionState === 'connecting'
        ? tt(i18n.summaryCard.connecting)
        : tt(i18n.summaryCard.offline)
  const updatedAtLabel = formatUpdatedAt(status?.lastUpdatedAt) || tt(i18n.summaryCard.facts.waitingForFirstSnapshot)

  useEffect(() => {
    if (topAgents.length <= 1) {
      setActiveAgentIndex(0)
      return
    }

    const intervalId = window.setInterval(() => {
      setActiveAgentIndex((current) => (current + 1) % topAgents.length)
    }, 3200)

    return () => window.clearInterval(intervalId)
  }, [topAgents.length])

  useEffect(() => {
    if (activeAgentIndex >= topAgents.length) {
      setActiveAgentIndex(0)
    }
  }, [activeAgentIndex, topAgents.length])

  return (
    <article className={`gs-summary-card gs-summary-card--${variant} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="gs-summary-card__topline">
        <span className="gs-summary-card__eyebrow">{tt(i18n.summaryCard.eyebrow)}</span>
        <div className="gs-summary-card__topline-actions">
          <span className="gs-summary-card__status">
            <span
              className={`gs-summary-card__status-dot gs-summary-card__status-dot--${connectionState === 'connected' && !backendError ? 'live' : 'idle'}`}
            />
            {statusLabel}
          </span>
          <button
            type="button"
            className="gs-panel-toggle"
            onClick={handleToggleCollapse}
            aria-label={collapsed ? tt(i18n.common.expandPanel) : tt(i18n.common.collapsePanel)}
            title={collapsed ? tt(i18n.common.expandPanel) : tt(i18n.common.collapsePanel)}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      <div className="gs-summary-card__brand">{tt(i18n.brand.name)}</div>
      <h2 className="gs-summary-card__title">
        {variant === 'embed'
          ? tt(i18n.summaryCard.title.embed)
          : tt(i18n.summaryCard.title.feature)}
      </h2>

      {!collapsed && (
        <>

      <div className="gs-summary-card__metrics">
        <div className="gs-summary-card__metric">
          <span className="gs-summary-card__metric-label">{tt(i18n.summaryCard.metrics.visible)}</span>
          <strong>{visibleCount}</strong>
        </div>
        <div className="gs-summary-card__metric">
          <span className="gs-summary-card__metric-label">{tt(i18n.summaryCard.metrics.running)}</span>
          <strong>{runningCount}</strong>
        </div>
        <div className="gs-summary-card__metric">
          <span className="gs-summary-card__metric-label">{tt(i18n.summaryCard.metrics.activeZones)}</span>
          <strong>{activeWingCount}</strong>
        </div>
      </div>

      <div className="gs-summary-card__sparkline-grid">
        <div className="gs-summary-card__sparkline-card">
          <div className="gs-summary-card__sparkline-meta">
            <span>{tt(i18n.summaryCard.sparklines.liveActivity)}</span>
            <strong className={trend.direction === 'down' ? 'is-down' : trend.direction === 'up' ? 'is-up' : ''}>
              {formatDelta(trend.deltaRatio)}
            </strong>
          </div>
          <MiniSparkline
            values={recentTimeline.map((point) => point.running)}
            stroke="#7db3ff"
            fill="rgba(125, 179, 255, 0.15)"
          />
        </div>

        <div className="gs-summary-card__sparkline-card">
          <div className="gs-summary-card__sparkline-meta">
            <span>{tt(i18n.summaryCard.sparklines.visibleLoad)}</span>
            <strong>{displayedTrend.peakValue.toFixed(0)} {tt(i18n.summaryCard.sparklines.peak)}</strong>
          </div>
          <MiniSparkline
            values={recentTimeline.map((point) => point.displayed)}
            stroke="#f6c978"
            fill="rgba(246, 201, 120, 0.14)"
          />
        </div>
      </div>

      <dl className="gs-summary-card__facts">
        <div>
          <dt>{tt(i18n.summaryCard.facts.topZone)}</dt>
          <dd>{topWing}</dd>
        </div>
        <div>
          <dt>{tt(i18n.summaryCard.facts.modelMix)}</dt>
          <dd>{topModelFamily}</dd>
        </div>
        <div>
          <dt>{tt(i18n.summaryCard.facts.averageSignal)}</dt>
          <dd>{formatRatio(averageSignal)}</dd>
        </div>
        <div>
          <dt>{tt(i18n.summaryCard.facts.lastUpdate)}</dt>
          <dd>{updatedAtLabel}</dd>
        </div>
      </dl>

      <div className="gs-summary-card__carousel">
        <div className="gs-summary-card__carousel-header">
          <span>{tt(i18n.summaryCard.carousel.topAgents)}</span>
          <div className="gs-summary-card__carousel-actions">
            <button
              type="button"
              onClick={() => setActiveAgentIndex((current) => (current - 1 + topAgents.length) % Math.max(topAgents.length, 1))}
              disabled={topAgents.length <= 1}
            >
              {tt(i18n.summaryCard.carousel.prev)}
            </button>
            <button
              type="button"
              onClick={() => setActiveAgentIndex((current) => (current + 1) % Math.max(topAgents.length, 1))}
              disabled={topAgents.length <= 1}
            >
              {tt(i18n.summaryCard.carousel.next)}
            </button>
          </div>
        </div>

        {activeAgent ? (
          <div className="gs-summary-card__agent">
            <div className="gs-summary-card__agent-main">
              <span
                className="gs-summary-card__agent-dot"
                style={{ background: getZoneColor(activeAgent.zone) }}
              />
              <div>
                <strong>{activeAgent.label}</strong>
                <div>{getZoneLabel(activeAgent.zone)}</div>
              </div>
            </div>
            <div className="gs-summary-card__agent-stats">
              <span>{formatRatio(activeAgent.signalScore)} {tt(i18n.summaryCard.carousel.signal)}</span>
              <span>{getSignalWindowLabel(activeAgent.signalWindow)}</span>
              <span>{getStatusLabel(activeAgent.status)}</span>
            </div>
          </div>
        ) : (
          <div className="gs-summary-card__agent is-empty">{tt(i18n.summaryCard.carousel.waitingForPublicAgents)}</div>
        )}

        {topAgents.length > 1 ? (
          <div className="gs-summary-card__carousel-dots">
            {topAgents.map((agent, index) => (
              <button
                key={agent.sessionKey}
                type="button"
                className={index === activeAgentIndex ? 'is-active' : ''}
                onClick={() => setActiveAgentIndex(index)}
                aria-label={`${tt(i18n.summaryCard.carousel.show)} ${agent.label}`}
              />
            ))}
          </div>
        ) : null}
      </div>

        </>
      )}

      <div className="gs-summary-card__footer">
        <span>{tt(i18n.summaryCard.footer.refreshesEvery)} {refreshMs / 1000}s</span>
        {liveDemoHref ? (
          <a className="gs-summary-card__link" href={liveDemoHref}>
            {tt(i18n.summaryCard.footer.openLiveOffice)}
          </a>
        ) : null}
      </div>
    </article>
  )
}
