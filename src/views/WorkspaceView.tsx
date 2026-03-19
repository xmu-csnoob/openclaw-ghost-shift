import type { ComponentProps } from 'react'
import { HeaderNavigation } from '../components/ghostShift/HeaderNavigation.js'
import { LiveWorkspaceSidebar } from '../components/ghostShift/LiveWorkspaceSidebar.js'
import { LiveOfficeStage } from '../components/LiveOfficeStage.js'
import { StatusBar } from '../components/ghostShift/StatusBar.js'
import type { SessionFilterStatus } from '../services/types.js'
import './workspace.css'

interface WorkspaceViewProps {
  page: 'live' | 'replay'
  headerProps: ComponentProps<typeof HeaderNavigation>
  stageProps: ComponentProps<typeof LiveOfficeStage>
  sidebarOpen: boolean
  sidebarProps: ComponentProps<typeof LiveWorkspaceSidebar>
  /** Status bar filter state */
  filterStatus: SessionFilterStatus
  onFilterChange: (status: SessionFilterStatus) => void
  /** Session counts for status bar */
  visibleCount: number
  warmCount: number
  liveCount: number
  totalSessions?: number
  /** Connection info for status bar */
  connectionState: 'disconnected' | 'connecting' | 'connected'
  connectionLabel: string
  backendError: string | null
}

export function WorkspaceView({
  page,
  headerProps,
  stageProps,
  sidebarOpen,
  sidebarProps,
  filterStatus,
  onFilterChange,
  visibleCount,
  warmCount,
  liveCount,
  totalSessions,
  connectionState,
  connectionLabel,
  backendError,
}: WorkspaceViewProps) {
  return (
    <div className={`gs-live-shell gs-workspace-view gs-workspace-view--${page}`}>
      <HeaderNavigation {...headerProps} />

      <div className="gs-live-layout">
        <div className="gs-live-main">
          <StatusBar
            brand="Ghost Shift"
            connectionState={connectionState}
            connectionLabel={connectionLabel}
            backendError={backendError}
            visibleCount={visibleCount}
            warmCount={warmCount}
            liveCount={liveCount}
            visibleLabel="visible"
            warmLabel="warm"
            liveLabel="live"
            compact={false}
            filterStatus={filterStatus}
            onFilterChange={onFilterChange}
            totalSessions={totalSessions}
          />
          <LiveOfficeStage {...stageProps} />
        </div>

        <aside className={`gs-live-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          {sidebarOpen ? <LiveWorkspaceSidebar {...sidebarProps} /> : null}
        </aside>
      </div>
    </div>
  )
}
