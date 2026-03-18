import { ExperiencePanel } from '../ExperiencePanel.js'
import { RealtimeStatsSidebar } from '../RealtimeStatsSidebar.js'
import type {
  RealtimeStatsModelSlice,
  RealtimeStatsZoneBar,
  RealtimeTrendPoint,
} from '../RealtimeStatsSidebar.js'
import { i18n } from '../../content/i18n.js'
import type { DisplaySession } from '../../publicDisplay.js'
import {
  getPublicAgentLabel,
  getSignalWindowLabel,
  getZoneColor,
  getZoneLabel,
} from '../../publicDisplay.js'
import { useT } from '../../content/locale.js'
import { Panel } from './Panel.js'

interface LiveWorkspaceSidebarProps {
  page: 'live' | 'replay'
  loading: boolean
  freshnessLabel: string
  modelMix: RealtimeStatsModelSlice[]
  zoneBars: RealtimeStatsZoneBar[]
  responseTrend: RealtimeTrendPoint[]
  sessions: DisplaySession[]
  getNumericAgentId: (sessionKey: string) => number | undefined
  noteItems: ReadonlyArray<{ zh: string; en: string }>
  showGuide: boolean
  shortcutNotice: { zh: string; en: string } | string | null
  onOpenSession: (sessionKey: string) => void
  onToggleGuide: () => void
  onJumpToShare: () => void
  onOpenHelp: () => void
}

export function LiveWorkspaceSidebar({
  page,
  loading,
  freshnessLabel,
  modelMix,
  zoneBars,
  responseTrend,
  sessions,
  getNumericAgentId,
  noteItems,
  showGuide,
  shortcutNotice,
  onOpenSession,
  onToggleGuide,
  onJumpToShare,
  onOpenHelp,
}: LiveWorkspaceSidebarProps) {
  const tt = useT()

  return (
    <div className="gs-live-sidebar__content">
      <RealtimeStatsSidebar
        freshnessLabel={freshnessLabel}
        loading={loading}
        modelMix={modelMix}
        zoneBars={zoneBars}
        responseTrend={responseTrend}
      />

      <Panel
        className="gs-live-sidebar__panel"
        eyebrow={page === 'replay' ? tt(i18n.replayRoster) : tt(i18n.liveRoster)}
        title={tt(i18n.sidebar.publicAliases)}
      >
        <div className="gs-live-roster">
          {sessions.slice(0, 5).map((session) => {
            const agentId = getNumericAgentId(session.sessionKey)
            return (
              <button
                key={session.sessionKey}
                type="button"
                className="gs-live-roster__row"
                onClick={() => onOpenSession(session.sessionKey)}
              >
                <div className="gs-live-roster__meta">
                  <span
                    className="gs-live-roster__dot"
                    style={{ background: getZoneColor(session.zone) }}
                  />
                  <span className="gs-live-roster__name">
                    {getPublicAgentLabel(session.agentId, agentId)}
                  </span>
                  <span className="gs-live-roster__zone">{getZoneLabel(session.zone)}</span>
                </div>
                <div className="gs-live-roster__window">{getSignalWindowLabel(session.signalWindow)}</div>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        className="gs-live-sidebar__panel"
        eyebrow={page === 'replay' ? tt(i18n.replayNotes) : tt(i18n.whyThisSurface)}
        title={page === 'replay' ? tt(i18n.sidebar.replayTitle) : tt(i18n.sidebar.liveTitle)}
      >
        <ul className="gs-side-list">
          {noteItems.map((note) => (
            <li key={note.zh}>{tt(note)}</li>
          ))}
        </ul>
      </Panel>

      <ExperiencePanel
        showGuide={showGuide}
        shortcutNotice={shortcutNotice}
        onToggleGuide={onToggleGuide}
        onJumpToShare={onJumpToShare}
        onOpenHelp={onOpenHelp}
        defaultCollapsed={true}
      />
    </div>
  )
}
