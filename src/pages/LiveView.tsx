import type { ComponentProps } from 'react'
import { HeaderNavigation } from '../components/ghostShift/HeaderNavigation.js'
import { LiveWorkspaceSidebar } from '../components/ghostShift/LiveWorkspaceSidebar.js'
import { LiveOfficeStage } from '../components/LiveOfficeStage.js'

interface LiveViewProps {
  headerProps: ComponentProps<typeof HeaderNavigation>
  stageProps: ComponentProps<typeof LiveOfficeStage>
  sidebarOpen: boolean
  sidebarProps: ComponentProps<typeof LiveWorkspaceSidebar>
}

export function LiveView({ headerProps, stageProps, sidebarOpen, sidebarProps }: LiveViewProps) {
  return (
    <div className="gs-live-shell">
      <HeaderNavigation {...headerProps} />

      <div className="gs-live-layout">
        <div className="gs-live-main">
          <LiveOfficeStage {...stageProps} />
        </div>

        <aside className={`gs-live-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          {sidebarOpen ? <LiveWorkspaceSidebar {...sidebarProps} /> : null}
        </aside>
      </div>
    </div>
  )
}
