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
      <div className="gs-status-bar__chip gs-status-bar__chip--brand">{brand}</div>

      <div className="gs-status-bar__chip gs-status-bar__chip--connection">
        <span
          className="gs-stage-status-dot"
          data-connection-tone={connectionState}
          data-has-error={backendError ? 'true' : 'false'}
        />
        <span data-testid="stage-connection-label">{connectionLabel}</span>
        {backendError ? <span className="gs-status-bar__error">{backendError}</span> : null}
      </div>

      <div className="gs-status-bar__chip gs-status-bar__chip--stats">
        <span data-testid="status-bar-visible-count">
          <strong>{visibleCount}</strong>
          {showTotal ? <span className="gs-status-bar__total">/{totalSessions}</span> : null}
          {' '}{visibleLabel}
        </span>
        {!compact ? <span data-testid="stage-warm-count">{warmCount} {warmLabel}</span> : null}
        <span data-testid="stage-live-count">{liveCount} {liveLabel}</span>
      </div>

      <div className="gs-status-bar__chip gs-status-bar__chip--filter">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`gs-status-bar__filter-btn ${filterStatus === option.value ? 'is-active' : ''}`}
            onClick={() => onFilterChange(option.value)}
            data-testid={`filter-btn-${option.value}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
