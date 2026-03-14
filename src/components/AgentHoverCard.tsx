import React from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import { formatRatio, getPublicAgentLabel, getSignalWindowLabel } from '../publicDisplay.js'

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
}: AgentHoverCardProps): React.ReactElement | null {
  if (!visible || !anchor || !session) return null

  const label = getPublicAgentLabel(session.agentId)
  const sparkline = buildSparkline(activityPoints, 176, 40)
  const top = Math.max(84, anchor.y - 18)
  const left = Math.max(12, Math.min(anchor.x + 18, 620))

  return (
    <div
      className="gs-agent-hover-card"
      style={{
        top,
        left,
      }}
    >
      <div className="gs-agent-hover-card__header">
        <div>
          <div className="gs-agent-hover-card__eyebrow">Agent hover</div>
          <div className="gs-agent-hover-card__title">{label}</div>
        </div>
        <div className={`gs-agent-hover-card__status ${session.status === 'running' ? 'is-live' : ''}`}>
          {session.status || 'idle'}
        </div>
      </div>

      <div className="gs-agent-hover-card__grid">
        <div>
          <span>Public ID</span>
          <strong>{publicId || session.publicId || session.sessionKey}</strong>
        </div>
        <div>
          <span>Activity</span>
          <strong>{formatRatio(session.signalScore)}</strong>
        </div>
        <div>
          <span>Active window</span>
          <strong>{getSignalWindowLabel(dominantWindow || session.signalWindow)}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{session.role}</strong>
        </div>
      </div>

      <div className="gs-agent-hover-card__section">
        <div className="gs-agent-hover-card__section-title">Public tool estimate</div>
        <div className="gs-agent-hover-card__tools">
          {toolStats.map((tool) => (
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
        </div>
      </div>

      <div className="gs-agent-hover-card__section">
        <div className="gs-agent-hover-card__section-title">Activity timeline</div>
        <svg viewBox="0 0 176 40" width="100%" height="44" preserveAspectRatio="none">
          <path d={sparkline} fill="none" stroke="#7db3ff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
