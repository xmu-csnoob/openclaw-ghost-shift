import React from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import {
  formatDurationShort,
  formatRatio,
  getActivityColor,
  getActivityLabel,
  getFootprintLabel,
  getPublicAgentLabel,
  getRoleLabel,
  getSignalWindowLabel,
  getStatusLabel,
  getZoneColor,
  getZoneLabel,
} from '../publicDisplay.js'
import { i18n } from '../content/i18n.js'
import { useT } from '../content/locale.js'
import { Panel } from './ghostShift/Panel.js'

export interface SessionPanelProps {
  session: DisplaySession | null
  onClose: () => void
  visible: boolean
  position?: 'left' | 'right'
}

export function SessionPanel({
  session,
  onClose,
  visible,
  position = 'right',
}: SessionPanelProps): React.ReactElement | null {
  const tt = useT()
  if (!visible) return null

  const label = getPublicAgentLabel(session?.agentId)
  const activity = session ? getActivityLabel(session.activityBand) : tt(i18n.agent.band.quiet)
  const activityColor = session ? getActivityColor(session.activityBand) : '#777777'
  const zoneColor = session ? getZoneColor(session.zone) : '#777777'
  const signalWindowLabel = session ? getSignalWindowLabel(session.signalWindow) : tt(i18n.agent.window.observed)
  const footprintLabel = session ? getFootprintLabel(session.footprint) : tt(i18n.dashboard.metrics.visibleLoad)

  return (
    <Panel
      variant="overlay"
      className={`gs-session-panel gs-session-panel--${position}`}
      eyebrow={tt(i18n.panels.stats)}
      title={label}
      actions={(
        <button
          type="button"
          className="gs-status-panel__close"
          onClick={onClose}
          aria-label={tt(i18n.common.close)}
          title={tt(i18n.common.close)}
        >
          ✕
        </button>
      )}
      bodyClassName="gs-session-panel__content"
    >
      <div className="gs-session-panel__hero">
        <div className="gs-session-panel__hero-status">
          <span style={{ color: activityColor, fontWeight: 700 }}>{activity}</span>
          <span>{getStatusLabel(session?.status)}</span>
        </div>
        <p className="gs-session-panel__hero-copy">
          {session?.status === 'running'
            ? tt(i18n.caseStudyContent.whatItIs.body)
            : `${tt(i18n.caseStudyContent.whatHidden.body)} ${signalWindowLabel.toLowerCase()}.`}
        </p>
      </div>

      <div className="gs-session-panel__stats">
        <div className="gs-session-panel__stat">
          <span>{tt(i18n.dashboard.metrics.realtimeSignal)}</span>
          <strong>{session ? formatRatio(session.signalScore) : '0%'}</strong>
        </div>
        <div className="gs-session-panel__stat">
          <span>{tt(i18n.agent.window.observed)}</span>
          <strong>{session ? formatDurationShort(Date.now() - session.observedSince) : '0m'}</strong>
        </div>
      </div>

      <div className="gs-session-panel__meta">
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.dashboard.metrics.zoneConcentration)}</span>
          <strong style={{ color: zoneColor }}>
            {session ? getZoneLabel(session.zone) : tt(i18n.caseStudy.fields.hidden)}
          </strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.experience.settings.behavior)}</span>
          <strong>{getRoleLabel(session?.role)}</strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.summaryCard.metrics.visible)}</span>
          <strong>{session?.origin || tt(i18n.caseStudy.fields.hidden)}</strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.replay.storyline)}</span>
          <strong>{signalWindowLabel}</strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.dashboard.metrics.modelDiversity)}</span>
          <strong>{footprintLabel}</strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.summaryCard.carousel.topAgents)}</span>
          <strong>{label}</strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.caseStudy.cards.interactive.eyebrow)}</span>
          <strong>{session?.modelFamily || tt(i18n.caseStudy.fields.hidden)}</strong>
        </div>
        <div className="gs-session-panel__meta-row">
          <span>{tt(i18n.status.live)}</span>
          <strong style={{ color: activityColor }}>{getStatusLabel(session?.status)}</strong>
        </div>
      </div>

      <div className="gs-session-panel__footer">
        {tt(i18n.caseStudyContent.whatHidden.body)}
      </div>
    </Panel>
  )
}
