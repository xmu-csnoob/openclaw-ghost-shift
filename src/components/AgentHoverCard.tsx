import React, { useLayoutEffect, useRef, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import {
  formatRatio,
  getPublicAgentLabel,
  getSignalWindowLabel,
  getStatusLabel,
  getZoneLabel,
  getModelFamily,
} from '../publicDisplay.js'
import { i18n } from '../content/i18n/index.js'
import { useT } from '../content/locale.js'

export interface HoverToolStat {
  label: string
  count: number
  color: string
}

export interface HoverActivityPoint {
  timestamp: number
  score: number
}

export interface AgentHoverCardProps {
  visible: boolean
  anchor: { x: number; y: number } | null
  session: DisplaySession | null
  toolStats: HoverToolStat[]
  activityPoints: HoverActivityPoint[]
  dominantWindow: string
  loading?: boolean
  compact?: boolean
  minimal?: boolean
}

interface HoverCardPlacement {
  top: number
  left: number
  side: 'left' | 'right' | 'center'
  vertical: 'above' | 'below' | 'center'
}

const ESTIMATED_CARD_WIDTH = 280
const ESTIMATED_CARD_HEIGHT = 180
const HOVER_OFFSET = 18
const EDGE_GUTTER = 12
const SAFE_TOP = 84

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildSparkline(points: HoverActivityPoint[], width: number, height: number): string {
  if (points.length === 0) return ''
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
      const y = height - Math.max(0.08, point.score) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function AgentHoverCard({
  visible,
  anchor,
  session,
  toolStats,
  activityPoints,
  dominantWindow,
  loading = false,
  compact = false,
  minimal = false,
}: AgentHoverCardProps): React.ReactElement | null {
  const tt = useT()
  const cardRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [placement, setPlacement] = useState<HoverCardPlacement>({
    top: SAFE_TOP,
    left: EDGE_GUTTER,
    side: 'right',
    vertical: 'below',
  })

  useLayoutEffect(() => {
    if (!visible || !anchor) return

    const card = cardRef.current
    const container = card?.parentElement
    const containerWidth = container?.clientWidth ?? window.innerWidth
    const containerHeight = container?.clientHeight ?? window.innerHeight
    const cardWidth = card?.offsetWidth ?? Math.min(ESTIMATED_CARD_WIDTH, containerWidth - EDGE_GUTTER * 2)
    const cardHeight = card?.offsetHeight ?? (expanded ? ESTIMATED_CARD_HEIGHT + 120 : ESTIMATED_CARD_HEIGHT)
    const maxLeft = Math.max(EDGE_GUTTER, containerWidth - cardWidth - EDGE_GUTTER)
    const maxTop = Math.max(SAFE_TOP, containerHeight - cardHeight - EDGE_GUTTER)

    let side: HoverCardPlacement['side'] = 'right'
    let vertical: HoverCardPlacement['vertical'] = 'below'
    let left = anchor.x + HOVER_OFFSET
    let top = anchor.y + HOVER_OFFSET

    if (left + cardWidth > containerWidth - EDGE_GUTTER) {
      left = anchor.x - cardWidth - HOVER_OFFSET
      side = 'left'
    }
    if (left < EDGE_GUTTER) {
      left = clamp(anchor.x - cardWidth / 2, EDGE_GUTTER, maxLeft)
      side = 'center'
    }

    if (top + cardHeight > containerHeight - EDGE_GUTTER) {
      top = anchor.y - cardHeight - HOVER_OFFSET
      vertical = 'above'
    }
    if (top < SAFE_TOP) {
      top = clamp(anchor.y - cardHeight / 2, SAFE_TOP, maxTop)
      vertical = 'center'
    }

    setPlacement({
      top: clamp(top, SAFE_TOP, maxTop),
      left: clamp(left, EDGE_GUTTER, maxLeft),
      side,
      vertical,
    })
  }, [
    anchor,
    compact,
    loading,
    session?.sessionKey,
    toolStats.length,
    activityPoints.length,
    visible,
    expanded,
  ])

  if (!visible || !anchor) return null

  const agentLabel = session ? getPublicAgentLabel(session.agentId) : tt(i18n.common.loading)
  const modelFamily = session ? getModelFamily(session.model) : '-'
  const statusLabel = loading ? tt(i18n.status.connecting) : getStatusLabel(session?.status)
  const zoneLabel = session ? getZoneLabel(session.zone) : '-'
  const signalLabel = session ? getSignalWindowLabel(dominantWindow || session.signalWindow) : '-'

  const sparkline = buildSparkline(activityPoints, 176, 40)
  const statusClassName = `gs-agent-hover-card__status-badge ${session?.status === 'running' ? 'is-live' : ''}`.trim()

  if (minimal) {
    return (
      <div
        ref={cardRef}
        className="gs-agent-hover-card gs-agent-hover-card--minimal"
        data-side={placement.side}
        data-vertical={placement.vertical}
        aria-busy={loading}
        style={{
          top: placement.top,
          left: placement.left,
        }}
      >
        <div className="gs-agent-hover-card__title-row">
          <div className={statusClassName}>{statusLabel}</div>
          <div className="gs-agent-hover-card__agent-name">{agentLabel}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className="gs-agent-hover-card"
      data-side={placement.side}
      data-vertical={placement.vertical}
      aria-busy={loading}
      style={{
        top: placement.top,
        left: placement.left,
      }}
    >
      {/* Header: Status Badge + Agent Name */}
      <div className="gs-agent-hover-card__header">
        <div className="gs-agent-hover-card__title-row">
          <div className={statusClassName}>
            {statusLabel}
          </div>
          <div className="gs-agent-hover-card__agent-name">{agentLabel}</div>
        </div>
      </div>

      {/* Compact Info: Status·Zone | Last Active | Model */}
      <div className="gs-agent-hover-card__compact-info">
        <div className="gs-agent-hover-card__info-row">
          <span className="gs-agent-hover-card__info-label">{tt(i18n.zones.publicArea)}</span>
          <span className="gs-agent-hover-card__info-value">{zoneLabel}</span>
        </div>
        <div className="gs-agent-hover-card__info-row">
          <span className="gs-agent-hover-card__info-label">{tt(i18n.agent.window.active)}</span>
          <span className="gs-agent-hover-card__info-value">{signalLabel}</span>
        </div>
        <div className="gs-agent-hover-card__info-row">
          <span className="gs-agent-hover-card__info-label">{tt(i18n.agentHoverCard.modelFamily)}</span>
          <span className="gs-agent-hover-card__info-value">{modelFamily}</span>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        className="gs-agent-hover-card__expand-btn"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? tt(i18n.agentHoverCard.hideDetails) : tt(i18n.agentHoverCard.viewDetails)}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="gs-agent-hover-card__expanded-content">
          {/* Activity Signal Progress Bar */}
          <div className="gs-agent-hover-card__section">
            <div className="gs-agent-hover-card__section-title">{tt(i18n.agentHoverCard.activitySignal)}</div>
            <div className="gs-agent-hover-card__signal-bar">
              <div
                className="gs-agent-hover-card__signal-fill"
                style={{ width: `${(session?.signalScore ?? 0) * 100}%` }}
              />
              <span className="gs-agent-hover-card__signal-value">
                {loading || !session ? '...' : formatRatio(session.signalScore)}
              </span>
            </div>
          </div>

          {/* Tool Stats */}
          <div className="gs-agent-hover-card__section">
            <div className="gs-agent-hover-card__section-title">{tt(i18n.agentHoverCard.toolStats)}</div>
            <div className="gs-agent-hover-card__tools">
              {loading
                ? Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="gs-agent-hover-card__tool-row is-loading">
                      <span className="gs-agent-hover-card__skeleton-text" />
                      <div className="gs-agent-hover-card__tool-meter">
                        <div className="gs-agent-hover-card__tool-fill is-skeleton" style={{ width: `${52 + index * 14}%` }} />
                      </div>
                      <strong className="gs-agent-hover-card__skeleton-value" />
                    </div>
                  ))
                : toolStats.map((tool) => (
                    <div key={tool.label} className="gs-agent-hover-card__tool-row">
                      <span>{tool.label}</span>
                      <div className="gs-agent-hover-card__tool-meter">
                        <div
                          className="gs-agent-hover-card__tool-fill"
                          style={{
                            width: `${Math.max(10, tool.count * 18)}%`,
                            background: tool.color,
                          }}
                        />
                      </div>
                      <strong>{tool.count}</strong>
                    </div>
                  ))}
              {!loading && toolStats.length === 0 ? (
                <div className="gs-agent-hover-card__empty">{tt(i18n.common.noData)}</div>
              ) : null}
            </div>
          </div>

          {/* Activity Trend Sparkline */}
          <div className="gs-agent-hover-card__section">
            <div className="gs-agent-hover-card__section-title">{tt(i18n.agentHoverCard.activityTrend)}</div>
            {loading ? (
              <div className="gs-agent-hover-card__sparkline-skeleton">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : sparkline ? (
              <div className="gs-agent-hover-card__sparkline-wrapper">
                <svg viewBox="0 0 176 40" width="100%" height="44" preserveAspectRatio="none">
                  <path
                    className="gs-agent-hover-card__sparkline"
                    d={sparkline}
                    fill="none"
                    stroke="#ff6b35"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="gs-agent-hover-card__sparkline-labels">
                  <span>-30m</span>
                  <span>-15m</span>
                  <span>{tt(i18n.status.live)}</span>
                </div>
              </div>
            ) : (
              <div className="gs-agent-hover-card__empty">{tt(i18n.replay.replayBufferEmpty)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
