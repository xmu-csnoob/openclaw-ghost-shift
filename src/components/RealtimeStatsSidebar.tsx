import React, { useState } from 'react'
import { i18n } from '../content/i18n/index.js'
import { useT } from '../content/locale.js'

export interface RealtimeStatsModelSlice {
  label: string
  count: number
  share: number
  color: string
}

export interface RealtimeStatsZoneBar {
  label: string
  color: string
  value: number
  running: number
  count: number
}

export interface RealtimeTrendPoint {
  timestamp: number
  value: number
}

export interface RealtimeStatsSidebarProps {
  freshnessLabel: string
  loading: boolean
  modelMix: RealtimeStatsModelSlice[]
  zoneBars: RealtimeStatsZoneBar[]
  responseTrend: RealtimeTrendPoint[]
  defaultCollapsed?: boolean
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

function buildArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, endAngle)
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function buildLine(points: RealtimeTrendPoint[], width: number, height: number): string {
  if (points.length === 0) return ''
  const maxValue = Math.max(...points.map((point) => point.value), 1)
  const minValue = Math.min(...points.map((point) => point.value), 0)
  const span = Math.max(1, maxValue - minValue)
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
      const y = height - ((point.value - minValue) / span) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function RealtimeStatsSidebar({
  freshnessLabel,
  loading,
  modelMix,
  zoneBars,
  responseTrend,
  defaultCollapsed = true,
}: RealtimeStatsSidebarProps): React.ReactElement {
  const tt = useT()
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('gs-stats-sidebar-collapsed')
    return stored !== null ? stored === 'true' : defaultCollapsed
  })

  const handleToggleCollapse = () => {
    const newValue = !collapsed
    setCollapsed(newValue)
    localStorage.setItem('gs-stats-sidebar-collapsed', String(newValue))
  }

  let cumulativeAngle = -Math.PI / 2
  const donutSegments = modelMix.map((slice) => {
    const nextAngle = cumulativeAngle + Math.max(slice.share, 0.04) * Math.PI * 2
    const segment = {
      ...slice,
      path: buildArcPath(56, 56, 34, cumulativeAngle, nextAngle),
    }
    cumulativeAngle = nextAngle
    return segment
  })

  const responsePath = buildLine(responseTrend.slice(-20), 220, 56)
  const latestLatency = responseTrend[responseTrend.length - 1]?.value ?? 0

  return (
    <article className={`gs-side-card gs-stats-sidebar gs-animate-rise ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="gs-side-card__header">
        <div>
          <div className="gs-side-card__eyebrow">{tt(i18n.realtimeStats.eyebrow)}</div>
          <h3>{tt(i18n.realtimeStats.title)}</h3>
        </div>
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
      <div className="gs-stats-sidebar__meta">{tt(i18n.realtimeStats.freshness)}: {freshnessLabel}</div>

      {!collapsed && (
        <>
          <div className="gs-stats-sidebar__section">
            <div className="gs-stats-sidebar__section-title">{tt(i18n.realtimeStats.sections.modelUsage)}</div>
        {loading ? (
          <div className="gs-skeleton gs-skeleton--donut" />
        ) : (
          <div className="gs-stats-sidebar__donut">
            <svg viewBox="0 0 112 112" width="112" height="112" aria-hidden="true">
              <circle cx="56" cy="56" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
              {donutSegments.map((segment) => (
                <path
                  key={segment.label}
                  className="gs-stats-sidebar__segment"
                  d={segment.path}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="gs-stats-sidebar__legend">
              {modelMix.slice(0, 4).map((slice) => (
                <div key={slice.label} className="gs-stats-sidebar__legend-row">
                  <span className="gs-stats-sidebar__swatch" style={{ background: slice.color }} />
                  <span>{slice.label}</span>
                  <strong>{slice.count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="gs-stats-sidebar__section">
        <div className="gs-stats-sidebar__section-title">{tt(i18n.realtimeStats.sections.zoneActivity)}</div>
        {loading ? (
          <div className="gs-skeleton gs-skeleton--bars" />
        ) : (
          <div className="gs-stats-sidebar__bars">
            {zoneBars.map((bar) => (
              <div key={bar.label} className="gs-stats-sidebar__bar-row">
                <div className="gs-stats-sidebar__bar-label">
                  <span>{bar.label}</span>
                  <strong>{bar.running}/{bar.count}</strong>
                </div>
                <div className="gs-stats-sidebar__bar-track">
                  <div
                    className="gs-stats-sidebar__bar-fill"
                    style={{
                      width: `${Math.round(bar.value * 100)}%`,
                      '--bar-color': bar.color,
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="gs-stats-sidebar__section">
        <div className="gs-stats-sidebar__section-title">{tt(i18n.realtimeStats.sections.surfaceLatency)}</div>
        {loading ? (
          <div className="gs-skeleton gs-skeleton--line" />
        ) : (
          <>
            <div className="gs-stats-sidebar__latency">{Math.round(latestLatency)}ms</div>
            <svg viewBox="0 0 220 56" width="100%" height="58" preserveAspectRatio="none">
              <path
                className="gs-stats-sidebar__trend-line"
                d={responsePath}
                fill="none"
                stroke="#f6c978"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
          </>
        )}
      </div>
        </>
      )}
    </article>
  )
}
