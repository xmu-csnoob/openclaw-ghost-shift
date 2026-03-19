import React, { useState } from 'react'
import type { PublicOfficeStatus } from '../services/types.js'
import type { DisplaySession, PulseSample } from '../publicDisplay.js'
import {
  formatDurationShort,
  formatRatio,
  getActivityColor,
  getActivityLabel,
  getFootprintLabel,
  getPublicAgentLabel,
  getSignalWindowLabel,
  getStatusLabel,
  getZoneColor,
  getZoneLabel,
  summarizeModelMix,
  summarizeZones,
} from '../publicDisplay.js'
import { i18n } from '../content/i18n/index.js'
import { useT } from '../content/locale.js'
import { Panel } from './ghostShift/Panel.js'

export interface StatusPanelProps {
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  history: PulseSample[]
  selectedSessionKey: string | null
  onSelectSession: (sessionKey: string) => void
  visible: boolean
  onClose: () => void
  defaultCollapsed?: boolean
}

function buildSparkline(samples: PulseSample[], width: number, height: number): string {
  if (samples.length === 0) return ''
  const values = samples.map((sample) => sample.running)
  const max = Math.max(...values, 1)

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = height - (value / max) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function StatusPanel({
  status,
  sessions,
  history,
  selectedSessionKey,
  onSelectSession,
  visible,
  onClose,
  defaultCollapsed = false,
}: StatusPanelProps): React.ReactElement | null {
  const tt = useT()
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('gs-status-panel-collapsed')
    return stored !== null ? stored === 'true' : defaultCollapsed
  })

  const handleToggleCollapse = () => {
    const newValue = !collapsed
    setCollapsed(newValue)
    localStorage.setItem('gs-status-panel-collapsed', String(newValue))
  }

  if (!visible) return null

  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const warmCount = sessions.filter((session) => session.signalScore >= 0.6).length
  const sparkline = buildSparkline(history.slice(-30), 260, 56)
  const modelMix = summarizeModelMix(sessions)
  const zoneMix = summarizeZones(sessions)
  const topSessions = [...sessions]
    .sort((a, b) => {
      if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore
      return a.agentId.localeCompare(b.agentId)
    })
    .slice(0, 6)

  return (
    <Panel
      variant="overlay"
      className="gs-status-panel"
      title={tt(i18n.statusPanel.title)}
      actions={(
        <>
          <button
            type="button"
            className="gs-panel-toggle"
            onClick={handleToggleCollapse}
            aria-label={collapsed ? tt(i18n.common.expandPanel) : tt(i18n.common.collapsePanel)}
            title={collapsed ? tt(i18n.common.expandPanel) : tt(i18n.common.collapsePanel)}
          >
            {collapsed ? '▼' : '▲'}
          </button>
          <button
            type="button"
            className="gs-status-panel__close"
            onClick={onClose}
            aria-label={tt(i18n.common.close)}
            title={tt(i18n.common.close)}
          >
            ✕
          </button>
        </>
      )}
      bodyClassName="gs-status-panel__body"
    >

      {!collapsed && (
        <div className="gs-status-panel__content">
        <div className="gs-status-panel__section">
          <div className="gs-status-panel__section-title">{tt(i18n.statusPanel.livePulse)}</div>
          <div className="gs-status-panel__stat-grid">
            <div className="gs-status-panel__stat-card">
              <div className="gs-status-panel__stat-label">{tt(i18n.statusPanel.running)}</div>
              <div className="gs-status-panel__stat-value">{status?.running ?? 0}</div>
              <div className="gs-status-panel__stat-meta">{tt(i18n.statusPanel.agentsLiveNow)}</div>
            </div>
            <div className="gs-status-panel__stat-card">
              <div className="gs-status-panel__stat-label">{tt(i18n.statusPanel.recentSignal)}</div>
              <div className="gs-status-panel__stat-value">{formatRatio(averageSignal)}</div>
              <div className="gs-status-panel__stat-meta">
                {tt(i18n.statusPanel.warmOfVisible)
                  .replace('{warm}', String(warmCount))
                  .replace('{visible}', String(status?.displayed ?? sessions.length))}
              </div>
            </div>
          </div>
          <div className="gs-status-panel__sparkline">
            <svg viewBox="0 0 260 56" width="100%" height="56" preserveAspectRatio="none">
              <path d={sparkline} fill="none" stroke="#89B4FA" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="gs-status-panel__sparkline-label">
              {tt(i18n.statusPanel.historyOverLast).replace('{seconds}', String(history.length * 3))}
            </div>
          </div>
        </div>

        <div className="gs-status-panel__section">
          <div className="gs-status-panel__section-title">{tt(i18n.statusPanel.wings)}</div>
          {zoneMix.length === 0 ? (
            <div className="gs-status-panel__empty">{tt(i18n.statusPanel.noPublicRooms)}</div>
          ) : (
            zoneMix.map((entry) => (
              <div key={entry.zone} className="gs-status-panel__mix-row">
                <span className="gs-status-panel__mix-label" style={{ color: getZoneColor(entry.zone) }}>{entry.label}</span>
                <div className="gs-status-panel__meter">
                  <div
                    className="gs-status-panel__meter-fill"
                    style={{
                      width: `${Math.round((entry.count / Math.max(sessions.length, 1)) * 100)}%`,
                      '--meter-color': getZoneColor(entry.zone),
                    } as React.CSSProperties}
                  />
                </div>
                <span className="gs-status-panel__mix-value">{entry.running}/{entry.count}</span>
              </div>
            ))
          )}
        </div>

        <div className="gs-status-panel__section">
          <div className="gs-status-panel__section-title">{tt(i18n.statusPanel.modelMix)}</div>
          {modelMix.length === 0 ? (
            <div className="gs-status-panel__empty">{tt(i18n.statusPanel.noPublicModels)}</div>
          ) : (
            modelMix.map((entry) => (
              <div key={entry.label} className="gs-status-panel__mix-row">
                <span className="gs-status-panel__mix-label">{entry.label}</span>
                <div className="gs-status-panel__meter">
                  <div
                    className="gs-status-panel__meter-fill gs-status-panel__meter-fill--gradient"
                    style={{
                      width: `${Math.round(entry.share * 100)}%`,
                    }}
                  />
                </div>
                <span className="gs-status-panel__mix-value">{entry.count}</span>
              </div>
            ))
          )}
        </div>

        <div className="gs-status-panel__section">
          <div className="gs-status-panel__section-title">{tt(i18n.statusPanel.agentCadence)}</div>
          {topSessions.length === 0 ? (
            <div className="gs-status-panel__empty">{tt(i18n.statusPanel.noVisibleAgents)}</div>
          ) : (
            topSessions.map((session) => (
              <div
                key={session.sessionKey}
                className={`gs-status-panel__session-item ${selectedSessionKey === session.sessionKey ? 'is-selected' : ''}`}
                onClick={() => onSelectSession(session.sessionKey)}
              >
                <div className="gs-status-panel__session-row">
                  <span className="gs-status-panel__session-name">{getPublicAgentLabel(session.agentId)}</span>
                  <span className="gs-status-panel__session-activity" style={{ color: getActivityColor(session.activityBand) }}>
                    {getActivityLabel(session.activityBand)}
                  </span>
                </div>
                <div className="gs-status-panel__session-row gs-status-panel__session-row--secondary">
                  <span style={{ color: getZoneColor(session.zone) }}>{getZoneLabel(session.zone)}</span>
                  <span>{formatRatio(session.signalScore)} {tt(i18n.statusPanel.signal)}</span>
                </div>
                <div className="gs-status-panel__session-row gs-status-panel__session-row--tertiary">
                  <span>{session.origin}</span>
                  <span>{getFootprintLabel(session.footprint)}</span>
                </div>
                <div className="gs-status-panel__session-row gs-status-panel__session-row--tertiary">
                  <span>{getSignalWindowLabel(session.signalWindow)}</span>
                  <span>{session.modelFamily}</span>
                </div>
                <div className="gs-status-panel__session-row gs-status-panel__session-row--tertiary">
                  <span>{tt(i18n.statusPanel.observed).replace('{duration}', formatDurationShort(Date.now() - session.observedSince))}</span>
                  <span>{getStatusLabel(session.status)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      )}
    </Panel>
  )
}
