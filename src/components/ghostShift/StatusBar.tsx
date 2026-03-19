import type { SessionFilterStatus } from '../../services/types.js'
import '../../styles/status-bar.css'

export type GhostShiftConnectionState = 'disconnected' | 'connecting' | 'connected'

interface StatusBarProps {
  brand: string
  connectionState: GhostShiftConnectionState
  connectionLabel: string
  backendError: string | null
  visibleCount: number
  warmCount: number
  liveCount: number
  visibleLabel: string
  warmLabel: string
  liveLabel: string
  compact: boolean
  filterStatus: SessionFilterStatus
  onFilterChange: (status: SessionFilterStatus) => void
  totalSessions?: number
}

const FILTER_OPTIONS: { value: SessionFilterStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
]

export function StatusBar({
  brand,
  connectionState,
  connectionLabel,
  backendError,
  visibleCount,
  warmCount,
  liveCount,
  visibleLabel,
  warmLabel,
  liveLabel,
  compact,
  filterStatus,
  onFilterChange,
  totalSessions,
}: StatusBarProps) {
  const showTotal = totalSessions !== undefined && totalSessions !== visibleCount

  return (
    <div className="gs-status-bar">
      <div className="gs-status-bar__chip gs-status-bar__chip--brand">
        <span className="gs-status-bar__brand-label">{brand}</span>
      </div>

      <div className="gs-status-bar__chip gs-status-bar__chip--connection">
        <span
          className="gs-stage-status-dot"
          data-connection-tone={connectionState}
          data-has-error={backendError ? 'true' : 'false'}
        />
        <span className="gs-status-bar__connection-label" data-testid="stage-connection-label">
          {connectionLabel}
        </span>
        {backendError ? <span className="gs-status-bar__error">{backendError}</span> : null}
      </div>

      <div className="gs-status-bar__chip gs-status-bar__chip--stats">
        <span className="gs-status-bar__metric" data-testid="status-bar-visible-count">
          <strong className="gs-status-bar__metric-value">{visibleCount}</strong>
          {showTotal ? <span className="gs-status-bar__total">/{totalSessions}</span> : null}
          <span className="gs-status-bar__metric-label">{visibleLabel}</span>
        </span>
        {!compact ? (
          <span className="gs-status-bar__metric" data-testid="stage-warm-count">
            <strong className="gs-status-bar__metric-value">{warmCount}</strong>
            <span className="gs-status-bar__metric-label">{warmLabel}</span>
          </span>
        ) : null}
        <span className="gs-status-bar__metric" data-testid="stage-live-count">
          <strong className="gs-status-bar__metric-value">{liveCount}</strong>
          <span className="gs-status-bar__metric-label">{liveLabel}</span>
        </span>
      </div>

      <div className="gs-status-bar__chip gs-status-bar__chip--filter">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`gs-status-bar__filter-btn ${filterStatus === option.value ? 'is-active' : ''}`}
            onClick={() => onFilterChange(option.value)}
            aria-pressed={filterStatus === option.value}
            data-testid={`filter-btn-${option.value}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
