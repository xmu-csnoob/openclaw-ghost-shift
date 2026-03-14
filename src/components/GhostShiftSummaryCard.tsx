import type { DisplaySession } from '../publicDisplay.js'
import { formatRatio, summarizeModelMix, summarizeZones } from '../publicDisplay.js'
import type { PublicOfficeStatus } from '../services/types.js'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface GhostShiftSummaryCardProps {
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
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
  connectionState,
  backendError,
  refreshMs,
  liveDemoHref,
  variant = 'feature',
}: GhostShiftSummaryCardProps) {
  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const activeWingCount = summarizeZones(sessions).length
  const topWing = summarizeZones(sessions)[0]?.label || 'Waiting for public traffic'
  const topModelFamily = summarizeModelMix(sessions)[0]?.label || 'Hidden'
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const statusLabel = backendError
    ? 'Snapshot unavailable'
    : connectionState === 'connected'
      ? 'Live snapshot'
      : connectionState === 'connecting'
        ? 'Connecting'
        : 'Offline'

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
        Built for `me.wenfei4288.com`: enough live signal to prove the product is running, without turning the embed into a dense operator panel.
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
