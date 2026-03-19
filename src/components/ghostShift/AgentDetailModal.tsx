import { i18n } from '../../content/i18n/index.js'
import { getIntlLocale, useLocale, useT } from '../../content/locale.js'
import {
  formatDurationShort,
  getPublicAgentLabel,
  getRoleLabel,
  getZoneColor,
  getZoneLabel,
} from '../../publicDisplay.js'
import type { DisplaySession } from '../../publicDisplay.js'
import type { PublicAgentStats } from '../../services/types.js'
import './AgentDetailModal.css'
import { Modal } from '../Modal.js'
import { Panel } from './Panel.js'

interface AgentDetailModalProps {
  isOpen: boolean
  session: DisplaySession | null
  stats: PublicAgentStats | null
  loading: boolean
  error?: string | null
  onClose: () => void
}

function formatLatency(ms: number, locale: string): string {
  if (ms >= 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: ms >= 10_000 ? 0 : 1 }).format(ms / 1000)}s`
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(ms)}ms`
}

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShare(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value)
}

export function AgentDetailModal({
  isOpen,
  session,
  stats,
  loading,
  error = null,
  onClose,
}: AgentDetailModalProps) {
  const tt = useT()
  const locale = useLocale()
  const intlLocale = getIntlLocale(locale)
  const agentLabel = getPublicAgentLabel(stats?.agentId || session?.agentId)
  const title = `${agentLabel} · ${tt(i18n.analytics.agentDetail.title)}`
  const statCards = stats
    ? [
        { key: 'work-time', label: tt(i18n.analytics.agentDetail.workTime), value: formatDurationShort(stats.workTimeSeconds * 1000) },
        { key: 'tool-calls', label: tt(i18n.analytics.agentDetail.toolCalls), value: formatCount(stats.toolCallCount, intlLocale) },
        { key: 'avg-response-time', label: tt(i18n.analytics.agentDetail.avgResponseTime), value: formatLatency(stats.avgResponseTime, intlLocale) },
        { key: 'message-count', label: tt(i18n.analytics.agentDetail.messageCount), value: formatCount(stats.messageCount, intlLocale) },
        { key: 'sample-count', label: tt(i18n.analytics.agentDetail.sampleCount), value: formatCount(stats.sampleCount, intlLocale) },
      ]
    : []

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className={`gs-agent-detail-modal ${isOpen ? 'is-open' : ''}`}
    >
      <div className="gs-agent-detail">
        <Panel
          className="gs-agent-detail__panel"
          eyebrow={tt(i18n.analytics.agentDetail.overviewEyebrow)}
          title={agentLabel}
          subtitle={
            stats?.publicId
              ? `${tt(i18n.analytics.agentDetail.publicId)} ${stats.publicId}`
              : session?.publicId
                ? `${tt(i18n.analytics.agentDetail.publicId)} ${session.publicId}`
                : undefined
          }
        >
          <div className="gs-agent-detail__hero">
            <div className="gs-agent-detail__identity">
              <span
                className="gs-agent-detail__zone-dot"
                style={{ background: session ? getZoneColor(session.zone) : '#d4a574' }}
              />
              <strong>{session ? getZoneLabel(session.zone) : tt(i18n.common.noData)}</strong>
              <span>{session ? getRoleLabel(session.role) : tt(i18n.common.noData)}</span>
            </div>
            <div className="gs-agent-detail__identity">
              <strong>{session?.modelFamily || tt(i18n.agent.model.hidden)}</strong>
              <span>{session?.origin || tt(i18n.common.noData)}</span>
            </div>
          </div>
        </Panel>

        <Panel
          className="gs-agent-detail__panel"
          eyebrow={tt(i18n.analytics.agentDetail.metricsEyebrow)}
          title={tt(i18n.analytics.agentDetail.metricsTitle)}
          subtitle={loading ? tt(i18n.common.loading) : error || undefined}
        >
          {stats ? (
            <div className="gs-agent-detail__stats">
              {statCards.map((card) => (
                <div key={card.key} className="gs-agent-detail__stat">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="gs-agent-detail__stats">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`agent-detail-stat-skeleton-${index}`} className="gs-agent-detail__stat is-skeleton">
                  <span className="gs-skeleton gs-agent-detail__skeleton-line" />
                  <strong className="gs-skeleton gs-agent-detail__skeleton-line gs-agent-detail__skeleton-line--value" />
                </div>
              ))}
            </div>
          ) : (
            <div className="gs-agent-detail__empty">
              {error || tt(i18n.common.noData)}
            </div>
          )}
        </Panel>

        <Panel
          className="gs-agent-detail__panel"
          eyebrow={tt(i18n.analytics.agentDetail.activityEyebrow)}
          title={tt(i18n.analytics.agentDetail.activityTitle)}
          subtitle={tt(i18n.analytics.agentDetail.activitySubtitle)}
        >
          {stats?.activePeriods.length ? (
            <div className="gs-agent-detail__periods">
              {stats.activePeriods.map((period) => (
                <article key={period.label} className="gs-agent-detail__period">
                  <div className="gs-agent-detail__period-head">
                    <strong>{period.label}</strong>
                    <span>{formatCount(period.count, intlLocale)} · {formatShare(period.share, intlLocale)}</span>
                  </div>
                  <div className="gs-agent-detail__period-visual" aria-hidden="true">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <span
                        key={`${period.label}-${index}`}
                        className={`gs-agent-detail__period-cell ${index < Math.round(period.share * 12) ? 'is-active' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="gs-agent-detail__period-bar">
                    <div
                      className="gs-agent-detail__period-fill"
                      style={{ width: `${Math.max(8, Math.min(period.share * 100, 100))}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : loading ? (
            <div className="gs-agent-detail__periods">
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={`agent-detail-period-skeleton-${index}`} className="gs-agent-detail__period is-skeleton">
                  <div className="gs-agent-detail__period-head">
                    <span className="gs-skeleton gs-agent-detail__skeleton-line" />
                    <span className="gs-skeleton gs-agent-detail__skeleton-line" />
                  </div>
                  <div className="gs-skeleton gs-agent-detail__skeleton-grid" />
                  <div className="gs-skeleton gs-agent-detail__skeleton-bar" />
                </article>
              ))}
            </div>
          ) : (
            <div className="gs-agent-detail__empty">{tt(i18n.analytics.agentDetail.noActivePeriods)}</div>
          )}
        </Panel>
      </div>
    </Modal>
  )
}
