import { createContext, useContext, type ReactNode } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import type { OfficeState } from '../office/engine/officeState.js'
import type { PlaybackState, TimelinePoint } from '../replay.js'
import type { ConnectionState } from '../pages/ghost-shift/surfaceShared.js'

export interface SurfaceContextValue {
  /** Office state (mutable class instance, use as ref) */
  officeState: OfficeState

  /** Current display sessions */
  sessions: DisplaySession[]

  /** Timeline history points */
  history: TimelinePoint[]

  /** WebSocket / API connection status */
  connectionState: ConnectionState

  /** Backend error message, if any */
  backendError: string | null

  /** Playback state machine */
  playbackState: PlaybackState

  /** Whether initial data is loading */
  isLoading: boolean
}

const SurfaceContext = createContext<SurfaceContextValue | null>(null)

export function SurfaceProvider({
  value,
  children,
}: {
  value: SurfaceContextValue
  children: ReactNode
}): ReactNode {
  return (
    <SurfaceContext.Provider value={value}>
      {children}
    </SurfaceContext.Provider>
  )
}

export function useSurface(): SurfaceContextValue {
  const ctx = useContext(SurfaceContext)
  if (!ctx) {
    throw new Error('useSurface must be used within a SurfaceProvider')
  }
  return ctx
}
