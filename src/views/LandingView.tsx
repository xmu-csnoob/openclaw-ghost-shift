import type { ComponentProps } from 'react'
import { HeaderNavigation } from '../components/ghostShift/HeaderNavigation.js'
import { LiveOfficeStage } from '../components/LiveOfficeStage.js'

interface LandingViewProps {
  headerProps: ComponentProps<typeof HeaderNavigation>
  stageProps: ComponentProps<typeof LiveOfficeStage>
}

export function LandingView({ headerProps, stageProps }: LandingViewProps) {
  return (
    <div className="gs-live-minimal-shell">
      <HeaderNavigation {...headerProps} />
      <div className="gs-live-minimal-stage">
        <LiveOfficeStage {...stageProps} />
      </div>
    </div>
  )
}
