import React, { useLayoutEffect, useRef, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import { formatRatio, getPublicAgentLabel, getSignalWindowLabel } from '../publicDisplay.js'
import { i18n } from '../content/i18n.js'

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
  publicId: string | null
  toolStats: HoverToolStat[]
  activityPoints: HoverActivityPoint[]
  dominantWindow: string
  loading?: boolean
  compact?: boolean
}

interface HoverCardPlacement {
  top: number
  left: number
  side: 'left' | 'right' | 'center'
  vertical: 'above' | 'below' | 'center'
}

const ESTIMATED_CARD_WIDTH = 280
const ESTIMATED_CARD_HEIGHT = 260
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
  publicId,
  toolStats,
  activityPoints,
  dominantWindow,
  loading = false,
  compact = false,
}: AgentHoverCardProps): React.ReactElement | null {
  const cardRef = useRef<HTMLDivElement>(null)
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
    const cardHeight = card?.offsetHeight ?? ESTIMATED_CARD_HEIGHT
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
  ])

  if (!visible || !anchor) return null

  const label = session ? getPublicAgentLabel(session.agentId) : i18n.common.loading
  const sparkline = buildSparkline(activityPoints, 176, 40)
  const toolRows = loading
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
      ))

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
      <div className="gs-agent-hover-card__header">
        <div>
          <div className="gs-agent-hover-card__eyebrow">{i18n.panels.stats}</div>
          <div className="gs-agent-hover-card__title">{label}</div>
        </div>
        <div className={`gs-agent-hover-card__status ${session?.status === 'running' ? 'is-live' : ''}`}>
          {loading ? i18n.status.connecting : session?.status || i18n.agent.status.idle}
        </div>
      </div>

      <div className="gs-agent-hover-card__grid">
        <div>
          <span>{i18n.summaryCard.carousel.topAgents}</span>
          <strong>{loading ? i18n.common.loading : publicId || session?.publicId || session?.sessionKey || i18n.common.error}</strong>
        </div>
        <div>
          <span>{i18n.agent.window.observed}</span>
          <strong>{loading || !session ? '...' : formatRatio(session.signalScore)}</strong>
        </div>
        <div>
          <span>{i18n.agent.window.active}</span>
          <strong>{loading || !session ? i18n.common.loading : getSignalWindowLabel(dominantWindow || session.signalWindow)}</strong>
        </div>
        <div>
          <span>{i18n.experience.settings.behavior}</span>
          <strong>{loading || !session ? i18n.common.loading : session.role}</strong>
        </div>
      </div>

      <div className="gs-agent-hover-card__section">
        <div className="gs-agent-hover-card__section-title">{i18n.dashboard.charts.scatterPlot}</div>
        <div className="gs-agent-hover-card__tools">
          {toolRows}
          {!loading && toolStats.length === 0 ? <div className="gs-agent-hover-card__empty">{i18n.caseStudy.cards.faq.eyebrow}</div> : null}
        </div>
      </div>

      <div className="gs-agent-hover-card__section">
        <div className="gs-agent-hover-card__section-title">{i18n.replay.storyline}</div>
        {loading ? (
          <div className="gs-agent-hover-card__sparkline-skeleton">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : sparkline ? (
          <svg viewBox="0 0 176 40" width="100%" height="44" preserveAspectRatio="none">
            <path
              className="gs-agent-hover-card__sparkline"
              d={sparkline}
              fill="none"
              stroke="#7db3ff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <div className="gs-agent-hover-card__empty">{i18n.replay.replayBufferEmpty}</div>
        )}
      </div>
    </div>
  )
}
