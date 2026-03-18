import { useState } from 'react'
import type { LocalizedText } from '../content/locale.js'
import type { SurfaceTheme } from '../surfaceThemes.js'
import { i18n } from '../content/i18n.js'
import { useT } from '../content/locale.js'

export interface SurfaceExperiencePreferences {
  theme: SurfaceTheme
  density: 'comfortable' | 'compact'
  autoSharePreview: boolean
  coachTips: boolean
}

export interface ExperiencePanelProps {
  showGuide: boolean
  shortcutNotice: string | LocalizedText | null
  onToggleGuide: () => void
  onJumpToShare: () => void
  onOpenHelp: () => void
  defaultCollapsed?: boolean
}

export function ExperiencePanel({
  showGuide,
  shortcutNotice,
  onToggleGuide,
  onJumpToShare,
  onOpenHelp,
  defaultCollapsed = false,
}: ExperiencePanelProps) {
  const tt = useT()
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('gs-experience-panel-collapsed')
    return stored !== null ? stored === 'true' : defaultCollapsed
  })
  const shortcutRows = i18n.experience.shortcuts.items
  const guideTips = i18n.experience.guide.tips

  const handleToggleCollapse = () => {
    const newValue = !collapsed
    setCollapsed(newValue)
    localStorage.setItem('gs-experience-panel-collapsed', String(newValue))
  }

  return (
    <section
      className={`gs-experience-panel ${collapsed ? 'is-collapsed' : ''}`}
      aria-label={tt(i18n.experience.title)}
    >
      <div className="gs-experience-panel__head">
        <div>
          <span className="gs-section-kicker">{tt(i18n.panels.experience)}</span>
          <h2>{tt(i18n.experience.title)}</h2>
        </div>

        <div className="gs-experience-panel__actions">
          <button type="button" onClick={onToggleGuide}>
            {showGuide ? tt(i18n.experience.actions.hideGuide) : tt(i18n.experience.actions.showGuide)}
          </button>
          <button type="button" onClick={onJumpToShare}>{tt(i18n.experience.actions.jumpToShare)}</button>
          <button type="button" className="gs-help-button" onClick={onOpenHelp} aria-label={tt(i18n.common.openHelpAndCaseStudy)}>
            ?
          </button>
          <button
            type="button"
            className="gs-panel-toggle"
            onClick={handleToggleCollapse}
            aria-label={collapsed ? tt(i18n.common.expandPanel) : tt(i18n.common.collapsePanel)}
            title={collapsed ? tt(i18n.common.expandPanel) : tt(i18n.common.collapsePanel)}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {shortcutNotice ? <div className="gs-experience-panel__notice">{tt(shortcutNotice)}</div> : null}

          {showGuide ? (
            <div className="gs-experience-panel__grid">
              <article className="gs-experience-card">
                <div className="gs-side-card__eyebrow">{tt(i18n.experience.guide.eyebrow)}</div>
                <h3>{tt(i18n.experience.guide.title)}</h3>
                <ul className="gs-experience-list">
                  {guideTips.map((tip) => (
                    <li key={tip.zh}>{tt(tip)}</li>
                  ))}
                </ul>
              </article>

              <article className="gs-experience-card">
                <div className="gs-side-card__eyebrow">{tt(i18n.experience.shortcuts.eyebrow)}</div>
                <h3>{tt(i18n.experience.shortcuts.title)}</h3>
                <div className="gs-shortcut-list">
                  {shortcutRows.map((row) => (
                    <div className="gs-shortcut-row" key={row.key}>
                      <span>{row.key}</span>
                      <strong>{tt(row.action)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
