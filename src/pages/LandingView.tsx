import type { ComponentProps } from 'react'
import { HeaderNavigation } from '../components/ghostShift/HeaderNavigation.js'
import { LiveOfficeStage } from '../components/LiveOfficeStage.js'
import './ghost-shift/landing.css'

interface LandingViewProps {
  headerProps: ComponentProps<typeof HeaderNavigation>
  stageProps: ComponentProps<typeof LiveOfficeStage>
}

export function LandingView({ headerProps, stageProps }: LandingViewProps) {
  return (
    <div className="gs-live-minimal-shell gs-live-minimal-shell--landing">
      <HeaderNavigation {...headerProps} />
      <div className="gs-live-minimal-stage">
        <LiveOfficeStage {...stageProps} />
      </div>
    </div>
  )
}
