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
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) return 'Waiting for first snapshot'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waiting for first snapshot'

  return new Intl.DateTimeFormat(undefined, {
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
}: GhostShiftSummaryCardProps) {
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)

  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const activeWingCount = summarizeZones(sessions).length
  const topWing = summarizeZones(sessions)[0]?.label || 'Waiting for public traffic'
  const topModelFamily = summarizeModelMix(sessions)[0]?.label || 'Hidden'
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const recentTimeline = clampRecentTimeline(timeline, 24)
  const trend = computeTrendSummary(recentTimeline.map((point) => point.running))
  const displayedTrend = computeTrendSummary(recentTimeline.map((point) => point.displayed))
  const topAgents = getTopAgentEntries(sessions, (session) => getPublicAgentLabel(session.agentId), 5)
  const activeAgent = topAgents[activeAgentIndex] || null
  const statusLabel = backendError
    ? 'Snapshot unavailable'
    : connectionState === 'connected'
      ? 'Live snapshot'
      : connectionState === 'connecting'
        ? 'Connecting'
        : 'Offline'

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
    <article className={`gs-summary-card gs-summary-card--${variant}`}>
      <div className="gs-summary-card__topline">
        <span className="gs-summary-card__eyebrow">Embeddable summary card</span>
        <span className="gs-summary-card__status">
          <span
            className={`gs-summary-card__status-dot gs-summary-card__status-dot--${connectionState === 'connected' && !backendError ? 'live' : 'idle'}`}
          />
          {statusLabel}
        </span>
      </div>

      <div className="gs-summary-card__brand">Ghost Shift</div>
      <h2 className="gs-summary-card__title">
        {variant === 'embed'
          ? 'Public office demo in a portfolio-sized frame.'
          : 'A compact product surface for the live public office demo.'}
      </h2>
      <p className="gs-summary-card__body">
        Built for `me.wenfei4288.com`: enough live signal to prove the product is running, now with 24h trend context,
        mini charts, and a rotating roster of the strongest public agents.
      </p>

      <div className="gs-summary-card__metrics">
        <div className="gs-summary-card__metric">
          <span className="gs-summary-card__metric-label">Visible</span>
          <strong>{visibleCount}</strong>
        </div>
        <div className="gs-summary-card__metric">
          <span className="gs-summary-card__metric-label">Live now</span>
          <strong>{runningCount}</strong>
        </div>
        <div className="gs-summary-card__metric">
          <span className="gs-summary-card__metric-label">Active wings</span>
          <strong>{activeWingCount}</strong>
        </div>
      </div>

      <div className="gs-summary-card__sparkline-grid">
        <div className="gs-summary-card__sparkline-card">
          <div className="gs-summary-card__sparkline-meta">
            <span>24h live activity</span>
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
            <span>24h visible load</span>
            <strong>{displayedTrend.peakValue.toFixed(0)} peak</strong>
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
          <dt>Lead wing</dt>
          <dd>{topWing}</dd>
        </div>
        <div>
          <dt>Model mix</dt>
          <dd>{topModelFamily}</dd>
        </div>
        <div>
          <dt>Average signal</dt>
          <dd>{formatRatio(averageSignal)}</dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>{formatUpdatedAt(status?.lastUpdatedAt)}</dd>
        </div>
      </dl>

      <div className="gs-summary-card__carousel">
        <div className="gs-summary-card__carousel-header">
          <span>Top agents</span>
          <div className="gs-summary-card__carousel-actions">
            <button
              type="button"
              onClick={() => setActiveAgentIndex((current) => (current - 1 + topAgents.length) % Math.max(topAgents.length, 1))}
              disabled={topAgents.length <= 1}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setActiveAgentIndex((current) => (current + 1) % Math.max(topAgents.length, 1))}
              disabled={topAgents.length <= 1}
            >
              Next
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
              <span>{formatRatio(activeAgent.signalScore)} signal</span>
              <span>{getSignalWindowLabel(activeAgent.signalWindow)}</span>
              <span>{activeAgent.status}</span>
            </div>
          </div>
        ) : (
          <div className="gs-summary-card__agent is-empty">Waiting for public agents</div>
        )}

        {topAgents.length > 1 ? (
          <div className="gs-summary-card__carousel-dots">
            {topAgents.map((agent, index) => (
              <button
                key={agent.sessionKey}
                type="button"
                className={index === activeAgentIndex ? 'is-active' : ''}
                onClick={() => setActiveAgentIndex(index)}
                aria-label={`Show ${agent.label}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="gs-summary-card__footer">
        <span>Refreshes every {refreshMs / 1000}s</span>
        {liveDemoHref ? (
          <a className="gs-summary-card__link" href={liveDemoHref}>
            Open live office
          </a>
        ) : null}
      </div>
    </article>
  )
}
